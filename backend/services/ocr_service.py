# ============================================================
# services/ocr_service.py — 영수증/거래명세서 OCR 처리 서비스
# 이미지 전처리(OpenCV) → Tesseract OCR → 텍스트 파싱 → 재고 매칭
# ============================================================

import os
import re
import logging
from typing import Optional
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np
import pytesseract
from PIL import Image
import io

# OCR 작업용 스레드 풀 (blocking 작업을 async 환경에서 실행)
_ocr_executor = ThreadPoolExecutor(max_workers=2)

from sqlalchemy.orm import Session
from models.inventory import InventoryItem

# ─────────────────────────────────────────
# 경로 설정
# ─────────────────────────────────────────

# Tesseract 실행 파일 경로 (Windows 로컬 설치 기준)
TESSERACT_CMD = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# tessdata 경로 (프로젝트 내 kor+eng 팩)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESSDATA_DIR = os.path.join(BASE_DIR, "tessdata")

# Tesseract 경로 설정
pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────
# 이미지 전처리
# ─────────────────────────────────────────

def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """
    OCR 정확도 향상을 위한 이미지 전처리.
    그레이스케일 → 크기 제한 → 이진화 순서로 처리합니다.
    기울기 보정은 처리 시간이 길어 제외합니다.

    Args:
        image_bytes: 업로드된 이미지 바이트

    Returns:
        전처리된 OpenCV 이미지 배열 (numpy ndarray)
    """
    # 바이트 → PIL → numpy 배열 변환
    pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # 너무 큰 이미지는 OCR 속도 저하 → 최대 2000px로 축소
    max_dim = 2000
    w, h = pil_image.size
    if max(w, h) > max_dim:
        scale = max_dim / max(w, h)
        pil_image = pil_image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    img_array = np.array(pil_image)

    # BGR 변환 (OpenCV 기본 형식)
    img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

    # 그레이스케일 변환
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # 가우시안 블러로 노이즈 제거
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)

    # Otsu 이진화 (영수증처럼 흑백 대비가 높은 이미지에 적합, 속도 빠름)
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    return binary


def _deskew(image: np.ndarray) -> np.ndarray:
    """
    이미지 기울기 감지 및 보정.
    Hough 변환으로 기울기 각도를 추정합니다.

    Args:
        image: 이진화된 이미지

    Returns:
        기울기 보정된 이미지
    """
    try:
        # 외곽선 추출
        coords = np.column_stack(np.where(image > 0))
        if len(coords) < 10:
            return image

        # 최소 외접 사각형으로 각도 추정
        angle = cv2.minAreaRect(coords)[-1]

        # 각도 범위 조정 (-45 ~ 45도)
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle

        # 미세한 기울기(0.5도 이하)는 무시
        if abs(angle) < 0.5:
            return image

        # 회전 변환 행렬 계산 후 보정
        h, w = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(
            image, M, (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE
        )
        return rotated

    except Exception as e:
        logger.warning(f"기울기 보정 실패 (무시하고 원본 사용): {e}")
        return image


# ─────────────────────────────────────────
# OCR 실행
# ─────────────────────────────────────────

def extract_text(image_bytes: bytes) -> str:
    """
    전처리된 이미지에서 Tesseract OCR로 텍스트를 추출합니다.
    kor+eng 언어 모드를 사용합니다.

    Args:
        image_bytes: 업로드된 이미지 바이트

    Returns:
        추출된 텍스트 문자열
    """
    try:
        # 이미지 전처리
        processed = preprocess_image(image_bytes)

        # PIL 이미지로 변환 (pytesseract 입력 형식)
        pil_image = Image.fromarray(processed)

        # tessdata 경로를 환경 변수로 설정 (공백 포함 경로 대응)
        os.environ["TESSDATA_PREFIX"] = TESSDATA_DIR

        # Tesseract OCR 실행
        # --oem 1: LSTM 신경망 모드 (--oem 3보다 빠름)
        # --psm 6: 단일 균일 블록 텍스트로 가정
        custom_config = "--psm 6 --oem 1"
        text = pytesseract.image_to_string(
            pil_image,
            lang="kor+eng",
            config=custom_config
        )

        logger.info(f"OCR 텍스트 추출 완료: {len(text)}자")
        return text

    except pytesseract.TesseractError as e:
        logger.error(f"Tesseract OCR 오류: {e}")
        raise RuntimeError(f"OCR 처리 중 오류가 발생했습니다: {str(e)}")
    except Exception as e:
        logger.error(f"이미지 처리 오류: {e}")
        raise RuntimeError(f"이미지 처리 중 오류가 발생했습니다: {str(e)}")


# ─────────────────────────────────────────
# 텍스트 파싱
# ─────────────────────────────────────────

def parse_receipt(text: str) -> dict:
    """
    OCR 추출 텍스트에서 영수증/거래명세서 정보를 파싱합니다.
    날짜, 거래처명, 품목 리스트, 합계 금액을 추출합니다.

    Args:
        text: OCR 추출 텍스트

    Returns:
        {
          date: str (YYYY-MM-DD 또는 None),
          vendor: str (거래처명 또는 None),
          total_amount: float (합계 금액 또는 0),
          items: [
            {name, quantity, unit, unit_price, amount}
          ]
        }
    """
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    date = _parse_date(lines)
    vendor = _parse_vendor(lines)
    total_amount = _parse_total_amount(lines)
    items = _parse_items(lines)

    return {
        "date": date,
        "vendor": vendor,
        "total_amount": total_amount,
        "items": items,
    }


def _parse_date(lines: list) -> Optional[str]:
    """
    텍스트에서 날짜를 추출합니다.
    지원 형식: YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD, YY-MM-DD 등
    """
    # 연-월-일 패턴 (우선순위: 4자리 연도)
    patterns = [
        r"(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})",  # YYYY-MM-DD / YYYY.MM.DD
        r"(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})",   # YY-MM-DD
    ]
    for pattern in patterns:
        for line in lines:
            m = re.search(pattern, line)
            if m:
                groups = m.groups()
                year = groups[0] if len(groups[0]) == 4 else f"20{groups[0]}"
                month = groups[1].zfill(2)
                day = groups[2].zfill(2)
                # 유효성 범위 간단 체크
                if 1 <= int(month) <= 12 and 1 <= int(day) <= 31:
                    return f"{year}-{month}-{day}"
    return None


def _parse_vendor(lines: list) -> Optional[str]:
    """
    텍스트에서 거래처명을 추출합니다.
    상호명 패턴 또는 공급자 라벨 다음 줄에서 추출합니다.
    """
    # "상호", "공급자", "거래처", "업체" 키워드 다음 내용 추출
    vendor_keywords = ["상호", "공급자", "거래처", "업체명", "판매처", "공급업체"]
    for i, line in enumerate(lines):
        for keyword in vendor_keywords:
            if keyword in line:
                # 같은 줄에 콜론(:) 뒤 내용 우선
                colon_match = re.search(r"[:：]\s*(.+)", line)
                if colon_match:
                    candidate = colon_match.group(1).strip()
                    if len(candidate) >= 2:
                        return candidate
                # 다음 줄에서 추출
                if i + 1 < len(lines):
                    next_line = lines[i + 1]
                    # 숫자만 있거나 너무 짧은 줄은 제외
                    if len(next_line) >= 2 and not re.match(r"^\d+$", next_line):
                        return next_line

    # 첫 번째 줄이 한글로 시작하고 2~20자이면 거래처명으로 추정
    for line in lines[:5]:
        if re.match(r"^[가-힣a-zA-Z\s]{2,20}$", line) and not any(
            kw in line for kw in ["영수증", "거래명세서", "세금계산서", "합계", "소계"]
        ):
            return line

    return None


def _parse_total_amount(lines: list) -> float:
    """
    텍스트에서 합계 금액을 추출합니다.
    '합계', '총액', '총계', '공급가액' 키워드 근처의 금액을 파싱합니다.
    """
    # 합계 관련 키워드 (우선순위 순)
    total_keywords = ["합  계", "합계", "총액", "총계", "공급가액합계", "청구금액", "결제금액", "total"]
    exclude_keywords = ["공급가액", "부가세", "세액"]  # 합계가 아닌 항목 제외

    best_amount = 0.0
    for line in lines:
        line_lower = line.lower()
        # 합계 키워드가 포함된 줄에서 금액 추출
        if any(kw in line for kw in total_keywords):
            # 제외 키워드가 있으면 건너뜀
            if any(ex in line for ex in exclude_keywords):
                continue
            amount = _extract_amount(line)
            if amount and amount > best_amount:
                best_amount = amount

    # 합계를 못 찾으면 텍스트에서 가장 큰 금액 추출
    if best_amount == 0:
        amounts = []
        for line in lines:
            amt = _extract_amount(line)
            if amt and amt > 0:
                amounts.append(amt)
        if amounts:
            best_amount = max(amounts)

    return best_amount


def _extract_amount(text: str) -> Optional[float]:
    """
    문자열에서 금액(숫자)을 추출합니다.
    쉼표, 원 기호 등을 처리합니다.
    """
    # 쉼표 포함 숫자 패턴 (예: 1,234,567 또는 1234567)
    matches = re.findall(r"[\d,]+", text)
    for m in reversed(matches):
        clean = m.replace(",", "")
        if len(clean) >= 3:  # 100원 이상만 금액으로 인식
            try:
                return float(clean)
            except ValueError:
                continue
    return None


def _parse_items(lines: list) -> list:
    """
    텍스트에서 품목 리스트를 파싱합니다.
    품목명 / 수량 / 단위 / 단가 / 소계 형식의 행을 인식합니다.

    반환 형식:
    [{"name": str, "quantity": float, "unit": str, "unit_price": float, "amount": float}]
    """
    items = []
    # 품목 행 인식: 한글/영문 품목명 + 숫자들이 포함된 행 패턴
    # 예: "킹크랩 2 kg 45,000 90,000"
    item_pattern = re.compile(
        r"([가-힣a-zA-Z\s]{1,20})\s+(\d+(?:\.\d+)?)\s*(kg|g|개|병|박스|팩|set|SET|L|l|ea|EA)?\s*([0-9,]+)?\s*([0-9,]+)"
    )

    # "품명", "품목", "상품명" 이후 행부터 파싱 시작
    start_parsing = False
    stop_keywords = ["합계", "총계", "부가세", "세액", "합  계", "공급가액합계"]

    for line in lines:
        # 품목 목록 시작 감지
        if any(kw in line for kw in ["품명", "품목", "상품명", "내역"]):
            start_parsing = True
            continue

        # 합계 영역 도달 시 파싱 중지
        if any(kw in line for kw in stop_keywords):
            break

        # 패턴 매칭으로 품목 추출
        m = item_pattern.search(line)
        if m:
            name = m.group(1).strip()
            # 너무 짧거나 숫자만 있는 이름 제외
            if len(name) < 1 or re.match(r"^\d+$", name):
                continue

            try:
                quantity = float(m.group(2))
                unit = m.group(3) or "개"
                # 단가, 소계 추출
                raw_price = m.group(4) or "0"
                raw_amount = m.group(5) or "0"
                unit_price = float(raw_price.replace(",", ""))
                amount = float(raw_amount.replace(",", ""))

                # 단가가 없으면 소계로 추정
                if unit_price == 0 and amount > 0 and quantity > 0:
                    unit_price = amount / quantity

                items.append({
                    "name": name,
                    "quantity": quantity,
                    "unit": unit,
                    "unit_price": unit_price,
                    "amount": amount,
                })
            except (ValueError, ZeroDivisionError):
                continue

    # 패턴 매칭으로 품목을 찾지 못한 경우 — 간단한 줄 기반 파싱 시도
    if not items:
        items = _parse_items_simple(lines)

    return items


def _parse_items_simple(lines: list) -> list:
    """
    복잡한 패턴 매칭이 실패했을 때 사용하는 간단한 품목 파싱.
    금액이 포함된 줄을 품목으로 추정합니다.
    """
    items = []
    skip_keywords = ["합계", "총계", "소계", "부가세", "세액", "날짜", "거래처", "주소", "전화", "사업자"]

    for line in lines:
        # 제외 키워드 있는 줄 건너뜀
        if any(kw in line for kw in skip_keywords):
            continue

        # 한글 품목명과 금액이 모두 있는 줄
        has_korean = bool(re.search(r"[가-힣]", line))
        amounts_in_line = re.findall(r"[\d,]{3,}", line)

        if has_korean and amounts_in_line:
            # 품목명 추출 (숫자, 특수문자 제거)
            name_match = re.match(r"([가-힣a-zA-Z\s]+)", line)
            if name_match:
                name = name_match.group(1).strip()
                if len(name) >= 1:
                    # 마지막 숫자를 금액으로
                    try:
                        amount = float(amounts_in_line[-1].replace(",", ""))
                        if amount > 0:
                            items.append({
                                "name": name,
                                "quantity": 1.0,
                                "unit": "개",
                                "unit_price": amount,
                                "amount": amount,
                            })
                    except ValueError:
                        continue

    return items


# ─────────────────────────────────────────
# 재고 품목 매칭
# ─────────────────────────────────────────

def match_inventory_items(db: Session, items: list) -> list:
    """
    OCR로 파싱한 품목 리스트를 기존 재고 품목과 매칭합니다.
    문자열 포함 검색(부분 일치)으로 후보를 찾습니다.

    Args:
        db: SQLAlchemy 세션
        items: parse_receipt에서 반환된 품목 리스트

    Returns:
        각 품목에 matched_inventory_id, matched_inventory_name 필드가 추가된 리스트
    """
    # 삭제되지 않은 전체 재고 품목 로드
    all_inventory = db.query(InventoryItem).filter(
        InventoryItem.is_deleted == 0
    ).all()

    enriched_items = []
    for item in items:
        name = item.get("name", "")
        matched_id = None
        matched_name = None
        match_score = 0

        for inv in all_inventory:
            score = _calculate_similarity(name, inv.name)
            if score > match_score and score >= 0.4:  # 40% 이상 유사도만 매칭
                match_score = score
                matched_id = inv.id
                matched_name = inv.name

        enriched_items.append({
            **item,
            "matched_inventory_id": matched_id,
            "matched_inventory_name": matched_name,
            "match_score": round(match_score, 2),
            # 재고 반영 여부 기본값 (매칭된 경우 True)
            "apply_to_inventory": matched_id is not None,
        })

    return enriched_items


def _calculate_similarity(ocr_name: str, inv_name: str) -> float:
    """
    두 품목명의 유사도를 계산합니다.
    1. 정확히 포함되면 1.0
    2. 공통 글자 비율 기반 유사도
    3. 형태소 단위 부분 매칭

    Args:
        ocr_name: OCR 파싱 품목명
        inv_name: 재고 품목명

    Returns:
        0.0 ~ 1.0 유사도 점수
    """
    ocr_clean = re.sub(r"\s+", "", ocr_name).lower()
    inv_clean = re.sub(r"\s+", "", inv_name).lower()

    if not ocr_clean or not inv_clean:
        return 0.0

    # 정확히 같으면 최고점
    if ocr_clean == inv_clean:
        return 1.0

    # 포함 관계 체크 (한쪽이 다른 쪽을 포함)
    if inv_clean in ocr_clean or ocr_clean in inv_clean:
        # 길이 비율에 따라 점수 조정
        shorter = min(len(ocr_clean), len(inv_clean))
        longer = max(len(ocr_clean), len(inv_clean))
        return 0.7 + 0.3 * (shorter / longer)

    # 공통 글자 수 기반 유사도 (Jaccard 유사도 응용)
    ocr_chars = set(ocr_clean)
    inv_chars = set(inv_clean)
    intersection = len(ocr_chars & inv_chars)
    union = len(ocr_chars | inv_chars)

    if union == 0:
        return 0.0

    jaccard = intersection / union

    # 2글자 이상 연속 공통 부분 문자열 보너스
    lcs_bonus = _longest_common_substring_ratio(ocr_clean, inv_clean)

    return min(1.0, jaccard * 0.5 + lcs_bonus * 0.5)


def _longest_common_substring_ratio(s1: str, s2: str) -> float:
    """
    두 문자열의 최장 공통 부분 문자열 길이 비율 계산.
    짧은 문자열 대비 LCS 길이 비율을 반환합니다.
    """
    if not s1 or not s2:
        return 0.0
    m, n = len(s1), len(s2)
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
