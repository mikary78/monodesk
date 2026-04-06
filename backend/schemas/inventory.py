# ============================================================
# schemas/inventory.py — 재고/발주 Pydantic V2 스키마
# API 요청/응답 데이터 유효성 검사 및 직렬화를 담당합니다.
# ============================================================

from pydantic import BaseModel, field_validator, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
import re


# ─────────────────────────────────────────
# 공통 날짜 유효성 검사 헬퍼
# ─────────────────────────────────────────

def validate_date_format(v: str) -> str:
    """날짜 형식 YYYY-MM-DD 검증"""
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
        raise ValueError("날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.")
    return v


# ─────────────────────────────────────────
# 재고 분류 (InventoryCategory) 스키마
# ─────────────────────────────────────────

class InventoryCategoryBase(BaseModel):
    """재고 분류 공통 필드"""
    name: str = Field(..., min_length=1, max_length=50, description="분류명")
    description: Optional[str] = Field(None, max_length=200, description="분류 설명")
    color: Optional[str] = Field("#64748B", description="UI 색상 (HEX)")


class InventoryCategoryCreate(InventoryCategoryBase):
    """재고 분류 생성 요청 스키마"""
    pass


class InventoryCategoryUpdate(BaseModel):
    """재고 분류 수정 요청 스키마 (부분 수정 허용)"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None
    color: Optional[str] = None


class InventoryCategoryResponse(InventoryCategoryBase):
    """재고 분류 응답 스키마"""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 재고 품목 (InventoryItem) 스키마
# ─────────────────────────────────────────

class InventoryItemBase(BaseModel):
    """재고 품목 공통 필드"""
    name: str = Field(..., min_length=1, max_length=100, description="품목명")
    category_id: int = Field(..., gt=0, description="분류 ID")
    unit: str = Field("개", max_length=20, description="단위 (kg, 병, 박스 등)")
    current_quantity: float = Field(0, ge=0, description="현재 재고 수량")
    min_quantity: float = Field(0, ge=0, description="최소 재고 임계값")
    default_order_quantity: float = Field(1, gt=0, description="기본 발주 수량")
    unit_price: float = Field(0, ge=0, description="단가 (원)")
    supplier: Optional[str] = Field(None, max_length=100, description="주 거래처명")
    memo: Optional[str] = None


class InventoryItemCreate(InventoryItemBase):
    """재고 품목 생성 요청 스키마"""
    pass


class InventoryItemUpdate(BaseModel):
    """재고 품목 수정 요청 스키마 (부분 수정 허용)"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category_id: Optional[int] = Field(None, gt=0)
    unit: Optional[str] = Field(None, max_length=20)
    min_quantity: Optional[float] = Field(None, ge=0)
    default_order_quantity: Optional[float] = Field(None, gt=0)
    unit_price: Optional[float] = Field(None, ge=0)
    supplier: Optional[str] = None
    memo: Optional[str] = None


class InventoryItemResponse(InventoryItemBase):
    """재고 품목 응답 스키마"""
    id: int
    is_low_stock: bool
    stock_status: str
    category: Optional[InventoryCategoryResponse] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 재고 수량 조정 (InventoryAdjustment) 스키마
# ─────────────────────────────────────────

# 허용되는 조정 유형 목록
ADJUSTMENT_TYPES = ["입고", "출고", "실사조정", "폐기"]


class InventoryAdjustmentBase(BaseModel):
    """재고 수량 조정 공통 필드"""
    item_id: int = Field(..., gt=0, description="품목 ID")
    adjustment_type: str = Field(..., description="조정 유형 (입고/출고/실사조정/폐기)")
    quantity_change: float = Field(..., description="수량 변동 (양수: 증가, 음수: 감소)")
    adjustment_date: str = Field(..., description="조정 날짜 (YYYY-MM-DD)")
    unit_price: Optional[float] = Field(None, ge=0, description="단가 (원)")
    memo: Optional[str] = None
    # 매입 출처 (입고 시 구매 경로 구분)
    # headquarters: 본사구매, site_card: 현장 법카, site_cash: 현장 시재, direct: 기타
    purchase_source: Optional[str] = Field("direct", description="매입 출처 (headquarters/site_card/site_cash/direct)")
    # 연결 지출내역 ID (현장구매 시 지출관리 기록과 연결)
    linked_expense_id: Optional[int] = Field(None, description="연결 지출내역 ID (expense_records.id)")

    @field_validator("adjustment_type")
    @classmethod
    def validate_adjustment_type(cls, v):
        """조정 유형 유효성 검증"""
        if v not in ADJUSTMENT_TYPES:
            raise ValueError(f"조정 유형은 {', '.join(ADJUSTMENT_TYPES)} 중 하나여야 합니다.")
        return v

    @field_validator("adjustment_date")
    @classmethod
    def validate_date(cls, v):
        """날짜 형식 검증"""
        return validate_date_format(v)


class InventoryAdjustmentCreate(InventoryAdjustmentBase):
    """재고 수량 조정 생성 요청 스키마"""
    pass


class InventoryAdjustmentResponse(InventoryAdjustmentBase):
    """
    재고 수량 조정 응답 스키마.
    Base에 purchase_source, linked_expense_id가 포함되어 있으므로
    from_attributes=True 설정으로 DB 모델에서 자동 반영됩니다.
    """
    id: int
    quantity_before: float
    quantity_after: float
    purchase_order_id: Optional[int] = None
    created_at: datetime
    # purchase_source, linked_expense_id는 Base에서 상속됩니다

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 발주 품목 (PurchaseOrderItem) 스키마
# ─────────────────────────────────────────

class PurchaseOrderItemBase(BaseModel):
    """발주 품목 공통 필드"""
    item_id: int = Field(..., gt=0, description="품목 ID")
    quantity: float = Field(..., gt=0, description="발주 수량")
    unit_price: float = Field(0, ge=0, description="발주 단가 (원)")
    memo: Optional[str] = None


class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    """발주 품목 생성 요청 스키마"""
    pass


class PurchaseOrderItemResponse(PurchaseOrderItemBase):
    """발주 품목 응답 스키마"""
    id: int
    order_id: int
    received_quantity: float
    subtotal: float
    item: Optional[InventoryItemResponse] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 발주서 (PurchaseOrder) 스키마
# ─────────────────────────────────────────

# 허용되는 발주 상태 목록
ORDER_STATUSES = ["발주중", "입고완료", "취소"]


class PurchaseOrderBase(BaseModel):
    """발주서 공통 필드"""
    supplier: str = Field(..., min_length=1, max_length=100, description="거래처명")
    order_date: str = Field(..., description="발주 날짜 (YYYY-MM-DD)")
    expected_date: Optional[str] = Field(None, description="예상 입고일 (YYYY-MM-DD)")
    memo: Optional[str] = None

    @field_validator("order_date")
    @classmethod
    def validate_order_date(cls, v):
        """발주 날짜 형식 검증"""
        return validate_date_format(v)

    @field_validator("expected_date")
    @classmethod
    def validate_expected_date(cls, v):
        """예상 입고일 형식 검증 (선택 입력)"""
        if v is not None:
            return validate_date_format(v)
        return v


class PurchaseOrderCreate(PurchaseOrderBase):
    """발주서 생성 요청 스키마 (품목 목록 포함)"""
    order_items: List[PurchaseOrderItemCreate] = Field(..., min_length=1, description="발주 품목 목록")


class PurchaseOrderUpdate(BaseModel):
    """발주서 수정 요청 스키마 (부분 수정 허용)"""
    supplier: Optional[str] = Field(None, min_length=1, max_length=100)
    order_date: Optional[str] = None
    expected_date: Optional[str] = None
    status: Optional[str] = None
    memo: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v):
        """발주 상태 유효성 검증"""
        if v is not None and v not in ORDER_STATUSES:
            raise ValueError(f"발주 상태는 {', '.join(ORDER_STATUSES)} 중 하나여야 합니다.")
        return v


class PurchaseOrderResponse(PurchaseOrderBase):
    """발주서 응답 스키마"""
    id: int
    order_number: str
    status: str
    total_amount: float
    received_date: Optional[str] = None
    order_items: List[PurchaseOrderItemResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 입고 처리 스키마
# ─────────────────────────────────────────

class ReceiveOrderItem(BaseModel):
    """
    입고 처리 시 개별 품목의 실제 입고 수량.
    발주서 단위로 동일한 매입 출처를 사용하지만,
    스키마 수준에서도 품목별 출처 오버라이드를 허용합니다.
    """
    order_item_id: int = Field(..., gt=0, description="발주 품목 ID")
    received_quantity: float = Field(..., ge=0, description="실제 입고 수량")
    unit_price: Optional[float] = Field(None, ge=0, description="실제 입고 단가 (원)")
    # 해당 품목의 매입 출처 (발주서 전체 출처를 ReceiveOrderRequest에서 지정하고 여기서 전달)
    purchase_source: Optional[str] = Field("direct", description="매입 출처 (headquarters/site_card/site_cash/direct)")


class ReceiveOrderRequest(BaseModel):
    """발주서 입고 처리 요청 스키마"""
    received_date: str = Field(..., description="실제 입고일 (YYYY-MM-DD)")
    items: List[ReceiveOrderItem] = Field(..., min_length=1, description="입고 품목별 실제 수량")
    memo: Optional[str] = None

    @field_validator("received_date")
    @classmethod
    def validate_received_date(cls, v):
        """입고일 형식 검증"""
        return validate_date_format(v)


# ─────────────────────────────────────────
# 재고 현황 요약 스키마
# ─────────────────────────────────────────

class InventorySummaryResponse(BaseModel):
    """재고 현황 요약 응답 스키마 (대시보드용)"""
    # 전체 품목 수
    total_items: int
    # 재고 부족 품목 수 (최소 임계값 이하)
    low_stock_count: int
    # 품절 품목 수
    out_of_stock_count: int
    # 발주 진행 중인 발주서 수
    pending_orders: int
    # 재고 부족 품목 목록 (알림용)
    low_stock_items: List[dict]


# ─────────────────────────────────────────
# 매입 출처별 집계 스키마
# 엑셀 3.원·부재료 시트의 구매 경로별 금액 집계에 대응합니다.
# ─────────────────────────────────────────

class PurchaseSourceTotal(BaseModel):
    """
    매입 출처별 금액 합계.
    본사구매/현장구매(법카/시재)/기타 각각의 입고 금액 총합을 담습니다.
    """
    # 매입 출처 코드 (headquarters / site_card / site_cash / direct)
    source: str
    # 한국어 레이블 (화면 표시용)
    source_label: str
    # 해당 출처의 입고 금액 합계 (수량 × 단가)
    total_amount: float
    # 해당 출처의 입고 건수
    count: int


class PurchaseSummaryResponse(BaseModel):
    """
    월별 매입 출처별 집계 응답 스키마.
    /api/inventory/purchases/summary/{year}/{month} 엔드포인트에서 반환합니다.
    엑셀 ★보고서의 원재료 지출 집계와 동일한 결과를 반환합니다.
    """
    # 조회 연도
    year: int
    # 조회 월
    month: int
    # 모든 출처의 전체 합계 금액
    grand_total: float
    # 출처별 상세 목록 (headquarters, site_card, site_cash, direct 순)
    sources: List[PurchaseSourceTotal]
