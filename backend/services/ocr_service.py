# ============================================================
# services/ocr_service.py — 영수증 OCR 처리 서비스
# Claude Vision API (claude-sonnet-4-20250514)를 사용하여
# 영수증/거래명세서 이미지에서 구조화된 데이터를 추출합니다.
#
# 변경 이력:
#   2026-04-07 — Tesseract OCR + OpenCV 전처리 방식에서 교체
#                Claude Vision API 기반으로 전면 재작성
# ============================================================

import os
import json
import base64
import logging
from pathlib import Path
from typing import Optional

import anthropic
from sqlalchemy.orm import Session
from models.inventory import InventoryItem

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────
# Claude API 클라이언트 (싱글턴)
# ─────────────────────────────────────────

# 모듈 전역 클라이언트 인스턴스 (최초 호출 시 한 번만 생성)
_claude_client = None


def _get_client() -> anthropic.Anthropic:
    """
    Claude API 클라이언트를 싱글턴 패턴으로 반환합니다.
    ANTHROPIC_API_KEY 환경변수를 자동으로 참조합니다.
    서버 시작 후 첫 OCR 요청 시 한 번만 초기화됩니다.
    """
    global _claude_client
    if _claude_client is None:
        # 환경변수 ANTHROPIC_API_KEY를 자동으로 읽어 클라이언트 생성
        _claude_client = anthropic.Anthropic()
    return _claude_client


# ─────────────────────────────────────────
# 상수 정의
# ─────────────────────────────────────────

# 지원 이미지 확장자 → MIME 타입 매핑
# Claude Vision API가 인식할 수 있는 형식으로 변환합니다.
MEDIA_TYPE_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/jpeg",  # BMP는 JPEG로 처리 (Claude API 미지원)
}

# Claude에게 전달하는 영수증 파싱 프롬프트
# JSON 외 텍스트를 일절 포함하지 않도록 강하게 지시합니다.
RECEIPT_PROMPT = """이 영수증 이미지에서 정보를 추출해서 반드시 아래 JSON 형식으로만 응답해줘.
JSON 외의 다른 텍스트는 절대 포함하지 마. 코드블록(```)도 사용하지 마.

{
  "vendor_name": "업체명 (없으면 null)",
  "business_number": "사업자번호 (없으면 null)",
  "receipt_date": "YYYY-MM-DD 형식 날짜 (없으면 null)",
  "receipt_time": "HH:MM 형식 시간 (없으면 null)",
  "total_amount": 숫자만 (원 단위, 없으면 0),
  "vat_amount": 숫자만 (부가세, 없으면 0),
  "supply_amount": 숫자만 (공급가액, 없으면 0),
  "payment_method": "카드 또는 현금 또는 계좌이체 또는 기타",
  "card_number": "카드 끝 4자리 (없으면 null)",
  "items": [
    {
      "name": "품목명",
      "quantity": 숫자,
      "unit_price": 숫자,
      "amount": 숫자
    }
  ],
  "memo": "기타 특이사항 (없으면 null)"
}

규칙:
- 날짜는 반드시 YYYY-MM-DD 형식으로 변환
- 금액은 반드시 숫자만 (콤마, 원 기호, 공백 제외)
- 품목이 없으면 items는 빈 배열 []
- 확실하지 않은 값은 null로 표시
"""


# ─────────────────────────────────────────
# 핵심 OCR 함수
# ─────────────────────────────────────────

def extract_receipt_data(image_path: str) -> dict:
    """
    Claude Vision API를 사용하여 영수증 이미지에서 구조화된 데이터를 추출합니다.
    기존 Tesseract OCR 대비 높은 인식률과 한국어 처리 정확도를 제공합니다.

    처리 흐름:
        이미지 파일 읽기 → base64 인코딩 → Claude API 호출 → JSON 파싱

    Args:
        image_path: 서버에 저장된 이미지 파일의 절대 경로

    Returns:
        성공 시:
            {
                vendor_name, business_number, receipt_date, receipt_time,
                total_amount, vat_amount, supply_amount, payment_method,
                card_number, items, memo
            }
        실패 시:
            {"error": "사용자 메시지", "detail": "기술 상세 정보"}
    """
    # 파일 존재 여부 확인 (잘못된 경로로 API 호출하는 낭비 방지)
    if not os.path.exists(image_path):
        logger.error(f"이미지 파일 없음: {image_path}")
        return {"error": "이미지 파일을 찾을 수 없습니다.", "detail": image_path}

    try:
        # 이미지 바이트를 읽어 base64 문자열로 인코딩
        # Claude Vision API는 바이너리가 아닌 base64 문자열을 요구합니다.
        with open(image_path, "rb") as f:
            image_data = base64.standard_b64encode(f.read()).decode("utf-8")

        # 파일 확장자로 MIME 타입 결정 (기본값: image/jpeg)
        ext = Path(image_path).suffix.lower()
        media_type = MEDIA_TYPE_MAP.get(ext, "image/jpeg")

        # Claude Vision API 호출
        # max_tokens=1024: 영수증 JSON 응답에 충분한 토큰 수
        client = _get_client()
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            # 이미지 블록: base64 인코딩된 이미지 데이터 전달
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_data,
                            },
                        },
                        {
                            # 텍스트 블록: 파싱 지시 프롬프트 전달
                            "type": "text",
                            "text": RECEIPT_PROMPT,
                        },
                    ],
                }
            ],
        )

        # API 응답 텍스트 추출 (앞뒤 공백 제거)
        response_text = message.content[0].text.strip()
        logger.info(f"Claude OCR 응답 수신: {len(response_text)}자")

        # JSON 파싱 시도
        try:
            receipt_data = json.loads(response_text)
            return receipt_data
        except json.JSONDecodeError as e:
            # JSON 형식이 아닌 응답이 오면 raw 텍스트를 memo에 담아 반환
            # 이 경우 사용자가 수동으로 확인하고 수정할 수 있습니다.
            logger.warning(f"JSON 파싱 실패, raw 텍스트 반환: {e}")
            return {
                "vendor_name": None,
                "business_number": None,
                "receipt_date": None,
                "receipt_time": None,
                "total_amount": 0,
                "vat_amount": 0,
                "supply_amount": 0,
                "payment_method": "기타",
                "card_number": None,
                "items": [],
                "memo": f"[OCR 파싱 실패] {response_text[:500]}",
            }

    except anthropic.APIConnectionError as e:
        # 인터넷 연결 또는 Anthropic 서버 접속 실패
        logger.error(f"Claude API 연결 실패: {e}")
        return {"error": "OCR 서버 연결에 실패했습니다.", "detail": str(e)}
    except anthropic.AuthenticationError as e:
        # ANTHROPIC_API_KEY가 없거나 잘못된 경우
        logger.error(f"Claude API 인증 실패: {e}")
        return {"error": "API 키 인증에 실패했습니다. ANTHROPIC_API_KEY를 확인해주세요.", "detail": str(e)}
    except anthropic.RateLimitError as e:
        # API 요청 횟수 한도 초과
        logger.error(f"Claude API 요청 한도 초과: {e}")
        return {"error": "API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.", "detail": str(e)}
    except anthropic.NotFoundError as e:
        # 잘못된 모델 이름 등 리소스 없음 오류
        logger.error(f"Claude API 리소스 없음 (모델명 오류 가능성): {e}")
        return {"error": "OCR 모델을 찾을 수 없습니다. 서버 설정을 확인해주세요.", "detail": str(e)}
    except anthropic.BadRequestError as e:
        # 이미지 형식 또는 요청 본문 오류
        logger.error(f"Claude API 요청 오류 (이미지 형식 문제 가능성): {e}")
        return {"error": "이미지를 처리할 수 없습니다. 다른 이미지를 시도해주세요.", "detail": str(e)}
    except Exception as e:
        # 그 외 예상치 못한 오류
        logger.error(f"OCR 처리 중 예상치 못한 오류: {type(e).__name__}: {e}")
        return {"error": "OCR 처리 중 오류가 발생했습니다.", "detail": str(e)}


# ─────────────────────────────────────────
# 재고 품목 매칭
# ─────────────────────────────────────────

def match_inventory_items(db: Session, items: list) -> list:
    """
    OCR로 파싱한 품목 리스트를 기존 재고 품목과 퍼지 매칭합니다.
    문자열 유사도 계산(부분 일치 + Jaccard + LCS)으로 후보를 찾습니다.

    Args:
        db: SQLAlchemy 세션
        items: extract_receipt_data에서 반환된 items 리스트
               [{"name": str, "quantity": num, "unit_price": num, "amount": num}, ...]

    Returns:
        각 품목에 다음 필드가 추가된 리스트:
        - matched_inventory_id: 매칭된 재고 품목 ID (없으면 None)
        - matched_inventory_name: 매칭된 재고 품목명 (없으면 None)
        - match_score: 유사도 점수 (0.0 ~ 1.0)
        - apply_to_inventory: 재고 반영 기본값 (매칭 성공 시 True)
        - unit: 단위 (Claude 응답에 없을 경우 기본값 "개")
    """
    import re

    # 삭제되지 않은 전체 재고 품목을 한 번에 로드 (쿼리 최소화)
    all_inventory = db.query(InventoryItem).filter(
        InventoryItem.is_deleted == 0
    ).all()

    enriched_items = []
    for item in items:
        name = item.get("name", "")
        matched_id = None
        matched_name = None
        match_score = 0.0

        # 모든 재고 품목과 유사도를 비교해 가장 높은 것을 선택
        for inv in all_inventory:
            score = _calculate_similarity(name, inv.name)
            # 40% 이상 유사도인 경우에만 매칭 후보로 인정
            if score > match_score and score >= 0.4:
                match_score = score
                matched_id = inv.id
                matched_name = inv.name

        enriched_items.append({
            **item,
            # Claude 응답에 unit 필드가 없을 수 있으므로 기본값 "개" 설정
            "unit": item.get("unit", "개"),
            "matched_inventory_id": matched_id,
            "matched_inventory_name": matched_name,
            "match_score": round(match_score, 2),
            # 매칭 성공 시 재고 반영 기본값 True (사용자가 검토 후 변경 가능)
            "apply_to_inventory": matched_id is not None,
        })

    return enriched_items


def _calculate_similarity(ocr_name: str, inv_name: str) -> float:
    """
    OCR 인식 품목명과 재고 품목명의 유사도를 계산합니다.

    계산 방식 (단계적 적용):
    1. 정확히 같으면 1.0 (최고점)
    2. 한쪽이 다른 쪽을 포함하면 0.7~1.0
    3. Jaccard 유사도(0.5) + LCS 비율(0.5) 혼합 점수

    Args:
        ocr_name: OCR 인식 품목명
        inv_name: 재고 품목명

    Returns:
        0.0 ~ 1.0 사이의 유사도 점수
    """
    import re

    # 공백 제거 후 소문자 변환 (비교 정규화)
    ocr_clean = re.sub(r"\s+", "", ocr_name).lower()
    inv_clean = re.sub(r"\s+", "", inv_name).lower()

    if not ocr_clean or not inv_clean:
        return 0.0

    # 정확히 같은 경우 최고점
    if ocr_clean == inv_clean:
        return 1.0

    # 포함 관계 체크: 한쪽이 다른 쪽을 완전히 포함하는 경우
    # 예: "킹크랩다리" vs "킹크랩" — 길이 비율로 점수 조정
    if inv_clean in ocr_clean or ocr_clean in inv_clean:
        shorter = min(len(ocr_clean), len(inv_clean))
        longer = max(len(ocr_clean), len(inv_clean))
        return 0.7 + 0.3 * (shorter / longer)

    # Jaccard 유사도: 공통 글자 집합 비율 계산
    ocr_chars = set(ocr_clean)
    inv_chars = set(inv_clean)
    intersection = len(ocr_chars & inv_chars)
    union = len(ocr_chars | inv_chars)
    if union == 0:
        return 0.0
    jaccard = intersection / union

    # LCS(최장 공통 부분 문자열) 비율로 연속 공통 부분 보정
    lcs_bonus = _longest_common_substring_ratio(ocr_clean, inv_clean)

    # Jaccard + LCS 혼합 (각 50% 가중치)
    return min(1.0, jaccard * 0.5 + lcs_bonus * 0.5)


def _longest_common_substring_ratio(s1: str, s2: str) -> float:
    """
    두 문자열의 최장 공통 부분 문자열(LCS) 길이 비율을 계산합니다.
    짧은 문자열 대비 LCS 길이 비율로 연속 글자 일치도를 측정합니다.

    예: "킹크랩", "킹크랩다리" → LCS="킹크랩"(3) / min(3,5) = 1.0

    Args:
        s1, s2: 비교할 두 문자열

    Returns:
        0.0 ~ 1.0 사이의 LCS 비율
    """
    if not s1 or not s2:
        return 0.0
    m, n = len(s1), len(s2)
    # 동적 프로그래밍으로 LCS 길이 계산 (O(m*n) 공간)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    max_len = 0
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if s1[i - 1] == s2[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
                if dp[i][j] > max_len:
                    max_len = dp[i][j]
    shorter = min(m, n)
    return max_len / shorter if shorter > 0 else 0.0
