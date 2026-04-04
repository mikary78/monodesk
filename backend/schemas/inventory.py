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
    """재고 수량 조정 응답 스키마"""
    id: int
    quantity_before: float
    quantity_after: float
    purchase_order_id: Optional[int] = None
    created_at: datetime

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
    """입고 처리 시 개별 품목의 실제 입고 수량"""
    order_item_id: int = Field(..., gt=0, description="발주 품목 ID")
    received_quantity: float = Field(..., ge=0, description="실제 입고 수량")
    unit_price: Optional[float] = Field(None, ge=0, description="실제 입고 단가 (원)")


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
# 재고 스냅샷 스키마 (월초/월말 재고)
# 엑셀 8-1.월초재고 / 8-2.월말재고 시트 구현
# ─────────────────────────────────────────

class InventorySnapshotCreate(BaseModel):
    """재고 스냅샷 항목 생성 요청 스키마"""
    # 스냅샷 유형: month_start(월초) 또는 month_end(월말)
    snapshot_type: str = Field(..., description="스냅샷 유형 (month_start/month_end)")
    # 연도 (2020~2099 허용)
    year: int = Field(..., ge=2020, le=2099)
    # 월 (1~12 허용)
    month: int = Field(..., ge=1, le=12)
    # 품목 ID
    item_id: int = Field(..., gt=0)
    # 재고 수량 (0 이상)
    quantity: float = Field(0, ge=0)
    # 매입 단가 (0 이상)
    unit_price: int = Field(0, ge=0)
    memo: Optional[str] = None

    @field_validator("snapshot_type")
    @classmethod
    def validate_snapshot_type(cls, v):
        """스냅샷 유형 유효성 검사 — month_start 또는 month_end만 허용"""
        if v not in ("month_start", "month_end"):
            raise ValueError("snapshot_type은 month_start 또는 month_end이어야 합니다.")
        return v


class InventorySnapshotUpdate(BaseModel):
    """재고 스냅샷 항목 수정 요청 스키마 (확정 전만 가능)"""
    # 수정할 수량 (선택 입력)
    quantity: Optional[float] = Field(None, ge=0)
    # 수정할 단가 (선택 입력)
    unit_price: Optional[int] = Field(None, ge=0)
    memo: Optional[str] = None


class InventorySnapshotItemResponse(BaseModel):
    """스냅샷 개별 항목 응답 스키마 (테이블 행 단위)"""
    id: int
    item_id: int
    item_name: str
    unit: str
    quantity: float
    unit_price: int
    amount: int
    memo: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SnapshotCategoryGroup(BaseModel):
    """카테고리별 스냅샷 그룹 (테이블 섹션 단위)"""
    category_id: int
    category_name: str
    category_color: str
    items: List[InventorySnapshotItemResponse]
    # 해당 카테고리의 금액 소계
    subtotal: int


class SnapshotConfirmRequest(BaseModel):
    """스냅샷 확정 요청 스키마"""
    # 확정할 스냅샷 유형
    snapshot_type: str
    year: int
    month: int

    @field_validator("snapshot_type")
    @classmethod
    def validate_snapshot_type(cls, v):
        """스냅샷 유형 유효성 검사"""
        if v not in ("month_start", "month_end"):
            raise ValueError("snapshot_type은 month_start 또는 month_end이어야 합니다.")
        return v


class SnapshotSummaryResponse(BaseModel):
    """재고 스냅샷 전체 요약 응답 (페이지 전체 데이터)"""
    # 스냅샷 유형 (month_start / month_end)
    snapshot_type: str
    year: int
    month: int
    # 확정 여부
    is_confirmed: bool
    # 확정 처리 일시 (미확정이면 None)
    confirmed_at: Optional[datetime] = None
    # 카테고리별 그룹 목록
    categories: List[SnapshotCategoryGroup]
    # 전체 합계 금액 (원)
    grand_total: int
