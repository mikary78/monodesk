# ============================================================
# schemas/ocr.py — OCR 영수증 스캔 Pydantic 스키마
# /api/ocr/* 엔드포인트의 요청/응답 데이터 구조를 정의합니다.
# ============================================================

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List
import re


# ─────────────────────────────────────────
# 스캔 결과 품목 스키마
# ─────────────────────────────────────────

class OcrItemResult(BaseModel):
    """OCR로 파싱된 개별 품목 정보"""
    # 품목명 (OCR 인식 결과)
    name: str = Field(..., description="품목명")
    # 수량
    quantity: float = Field(default=1.0, ge=0, description="수량")
    # 단위 (kg, 개, 병, 박스 등)
    unit: str = Field(default="개", description="단위")
    # 단가
    unit_price: float = Field(default=0.0, ge=0, description="단가 (원)")
    # 소계 (수량 × 단가)
    amount: float = Field(default=0.0, ge=0, description="소계 (원)")
    # 재고 매칭 결과
    matched_inventory_id: Optional[int] = Field(None, description="매칭된 재고 품목 ID")
    matched_inventory_name: Optional[str] = Field(None, description="매칭된 재고 품목명")
    match_score: Optional[float] = Field(None, description="매칭 유사도 (0.0~1.0)")
    # 재고 반영 여부 (사용자가 조정 가능)
    apply_to_inventory: bool = Field(default=False, description="재고 반영 여부")


# ─────────────────────────────────────────
# 스캔 결과 응답 스키마 (사용자 검토용)
# ─────────────────────────────────────────

class OcrScanResponse(BaseModel):
    """POST /api/ocr/scan-receipt 응답 — 사용자 검토용 파싱 결과"""
    # OCR 성공 여부
    success: bool = Field(..., description="OCR 처리 성공 여부")
    # 저장된 이미지 파일 경로 (프론트에서 미리보기용)
    image_path: Optional[str] = Field(None, description="저장된 영수증 이미지 경로")
    # 파싱된 날짜 (YYYY-MM-DD)
    date: Optional[str] = Field(None, description="인식된 날짜")
    # 파싱된 거래처명
    vendor: Optional[str] = Field(None, description="인식된 거래처명")
    # 파싱된 합계 금액
    total_amount: float = Field(default=0.0, description="인식된 합계 금액")
    # 파싱된 품목 리스트 (재고 매칭 포함)
    items: List[OcrItemResult] = Field(default_factory=list, description="인식된 품목 목록")
    # OCR 원본 텍스트 (디버깅용)
    raw_text: Optional[str] = Field(None, description="OCR 원본 텍스트")
    # 오류 메시지 (실패 시)
    error_message: Optional[str] = Field(None, description="오류 메시지")


# ─────────────────────────────────────────
# 확정 요청 품목 스키마
# ─────────────────────────────────────────

class ConfirmItemRequest(BaseModel):
    """사용자가 검토/수정 후 확정하는 개별 품목"""
    # 품목명 (사용자 수정 가능)
    name: str = Field(..., min_length=1, max_length=100, description="품목명")
    # 수량
    quantity: float = Field(..., gt=0, description="수량")
    # 단위
    unit: str = Field(default="개", max_length=20, description="단위")
    # 단가
    unit_price: float = Field(default=0.0, ge=0, description="단가 (원)")
    # 소계
    amount: float = Field(..., gt=0, description="소계 (원)")
    # 매칭된 재고 품목 ID (None이면 신규 품목 또는 재고 미반영)
    matched_inventory_id: Optional[int] = Field(None, description="매칭된 재고 품목 ID")
    # 재고 반영 여부
    apply_to_inventory: bool = Field(default=False, description="재고 반영 여부")


# ─────────────────────────────────────────
# 확정 요청 스키마
# ─────────────────────────────────────────

class OcrConfirmRequest(BaseModel):
    """
    POST /api/ocr/confirm-receipt 요청 — 사용자 검토 완료 후 저장 요청.
    지출 기록과 발주/입고 기록을 동시에 생성합니다.
    """
    # 영수증 이미지 경로 (지출 기록에 첨부)
    image_path: Optional[str] = Field(None, description="영수증 이미지 경로")
    # 지출 날짜 (YYYY-MM-DD)
    date: str = Field(..., description="지출 날짜 (YYYY-MM-DD)")
    # 거래처명
    vendor: Optional[str] = Field(None, max_length=100, description="거래처명")
    # 합계 금액 (부가세 포함)
    total_amount: float = Field(..., gt=0, description="합계 금액 (원)")
    # 부가세 금액 (0이면 미포함)
    vat: float = Field(default=0.0, ge=0, description="부가세 (원)")
    # 결제 수단
    payment_method: str = Field(default="카드", description="결제 수단")
    # 지출 분류 ID (기본값: 식재료비 카테고리 ID)
    expense_category_id: int = Field(..., gt=0, description="지출 분류 ID")
    # 메모
    memo: Optional[str] = Field(None, description="메모")
    # 품목 리스트
    items: List[ConfirmItemRequest] = Field(default_factory=list, description="품목 목록")

    @field_validator("date")
    @classmethod
    def validate_date(cls, v):
        """날짜 형식 검증 (YYYY-MM-DD)"""
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.")
        return v

    @field_validator("payment_method")
    @classmethod
    def validate_payment_method(cls, v):
        """결제 수단 유효성 검증"""
        allowed = ["카드", "현금", "계좌이체"]
        if v not in allowed:
            raise ValueError(f"결제 수단은 {', '.join(allowed)} 중 하나여야 합니다.")
        return v


# ─────────────────────────────────────────
# 확정 응답 스키마
# ─────────────────────────────────────────

class OcrConfirmResponse(BaseModel):
    """POST /api/ocr/confirm-receipt 응답"""
    success: bool = Field(..., description="저장 성공 여부")
    # 생성된 지출 기록 ID
    expense_id: int = Field(..., description="생성된 지출 기록 ID")
    # 생성된 발주서 ID (재고 반영 품목이 있는 경우)
    purchase_order_id: Optional[int] = Field(None, description="생성된 발주서 ID")
    # 재고 반영된 품목 수
    inventory_updated_count: int = Field(default=0, description="재고 반영된 품목 수")
    # 결과 메시지
    message: str = Field(..., description="처리 결과 메시지")
