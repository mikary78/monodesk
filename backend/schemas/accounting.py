# ============================================================
# schemas/accounting.py — 세무/회계 Pydantic 스키마
# API 요청/응답 데이터 유효성 검사 및 직렬화를 담당합니다.
# ============================================================

from pydantic import BaseModel, field_validator, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


# ─────────────────────────────────────────
# 지출 분류 (ExpenseCategory) 스키마
# ─────────────────────────────────────────

class ExpenseCategoryBase(BaseModel):
    """지출 분류 공통 필드"""
    name: str = Field(..., min_length=1, max_length=50, description="분류명")
    description: Optional[str] = Field(None, max_length=200, description="분류 설명")
    color: Optional[str] = Field("#64748B", description="UI 색상 (HEX)")


class ExpenseCategoryCreate(ExpenseCategoryBase):
    """지출 분류 생성 요청 스키마"""
    pass


class ExpenseCategoryUpdate(BaseModel):
    """지출 분류 수정 요청 스키마 (부분 수정 허용)"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None
    color: Optional[str] = None


class ExpenseCategoryResponse(ExpenseCategoryBase):
    """지출 분류 응답 스키마"""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 지출 기록 (ExpenseRecord) 스키마
# ─────────────────────────────────────────

class ExpenseRecordBase(BaseModel):
    """지출 기록 공통 필드"""
    expense_date: str = Field(..., description="지출 날짜 (YYYY-MM-DD)")
    category_id: int = Field(..., gt=0, description="지출 분류 ID")
    vendor: Optional[str] = Field(None, max_length=100, description="거래처명")
    description: str = Field(..., min_length=1, max_length=200, description="지출 내용")
    amount: float = Field(..., gt=0, le=99999999, description="공급가액 (원)")
    vat: Optional[float] = Field(0, ge=0, description="부가세 (원)")
    payment_method: Optional[str] = Field("카드", description="결제 수단")
    memo: Optional[str] = None
    receipt_image_path: Optional[str] = None
    tax_invoice: Optional[bool] = Field(False, description="세금계산서 수취 여부")

    @field_validator("expense_date")
    @classmethod
    def validate_date_format(cls, v):
        """날짜 형식 검증 (YYYY-MM-DD)"""
        import re
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


class ExpenseRecordCreate(ExpenseRecordBase):
    """지출 기록 생성 요청 스키마"""
    pass


class ExpenseRecordUpdate(BaseModel):
    """지출 기록 수정 요청 스키마 (부분 수정 허용)"""
    expense_date: Optional[str] = None
    category_id: Optional[int] = None
    vendor: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0, le=99999999)
    vat: Optional[float] = Field(None, ge=0)
    payment_method: Optional[str] = None
    memo: Optional[str] = None
    tax_invoice: Optional[bool] = None


class ExpenseRecordResponse(ExpenseRecordBase):
    """지출 기록 응답 스키마"""
    id: int
    total_amount: float
    category: Optional[ExpenseCategoryResponse] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 매출 기록 (SalesRecord) 스키마
# ─────────────────────────────────────────

class SalesRecordBase(BaseModel):
    """매출 기록 공통 필드"""
    sales_date: str = Field(..., description="매출 날짜 (YYYY-MM-DD)")
    cash_amount: Optional[float] = Field(0, ge=0, description="현금 매출")
    card_amount: Optional[float] = Field(0, ge=0, description="카드 매출")
    delivery_amount: Optional[float] = Field(0, ge=0, description="배달앱 매출")
    memo: Optional[str] = None

    @field_validator("sales_date")
    @classmethod
    def validate_date_format(cls, v):
        """날짜 형식 검증"""
        import re
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.")
        return v


class SalesRecordCreate(SalesRecordBase):
    """매출 기록 생성 요청 스키마"""
    pass


class SalesRecordUpdate(BaseModel):
    """매출 기록 수정 요청 스키마 (부분 수정 허용)"""
    sales_date: Optional[str] = None
    cash_amount: Optional[float] = Field(None, ge=0)
    card_amount: Optional[float] = Field(None, ge=0)
    delivery_amount: Optional[float] = Field(None, ge=0)
    memo: Optional[str] = None


class SalesRecordResponse(SalesRecordBase):
    """매출 기록 응답 스키마"""
    id: int
    total_sales: float
    is_pos_synced: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 손익 계산 응답 스키마
# ─────────────────────────────────────────

class ProfitLossResponse(BaseModel):
    """월별 손익 현황 응답 스키마"""
    year: int
    month: int
    # 매출
    total_sales: float
    cash_sales: float
    card_sales: float
    delivery_sales: float
    # 지출 (카테고리별)
    total_expense: float
    expense_by_category: List[dict]
    # 손익
    gross_profit: float          # 매출 - 총지출
    profit_margin: float         # 손익률 (%)
    cost_ratio: Optional[float] = None   # 원가율 = 식재료비 ÷ 매출 x 100 (%)
    # 전월 대비
    prev_month_sales: Optional[float] = None
    sales_growth_rate: Optional[float] = None  # 전월 대비 매출 증감률 (%)


# ─────────────────────────────────────────
# 공통 응답 래퍼
# ─────────────────────────────────────────

class ApiResponse(BaseModel):
    """공통 API 응답 래퍼"""
    success: bool
    message: str
    data: Optional[dict] = None
