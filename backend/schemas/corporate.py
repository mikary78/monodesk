# ============================================================
# schemas/corporate.py — 법인 관리 Pydantic 스키마
# API 요청/응답 데이터 유효성 검사 및 직렬화를 담당합니다.
# ============================================================

from pydantic import BaseModel, field_validator, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


# ─────────────────────────────────────────
# 동업자 (Partner) 스키마
# ─────────────────────────────────────────

class PartnerBase(BaseModel):
    """동업자 공통 필드"""
    name: str = Field(..., min_length=1, max_length=50, description="동업자 이름")
    equity_ratio: float = Field(..., gt=0, le=100, description="지분율 (%)")
    phone: Optional[str] = Field(None, max_length=20, description="연락처")
    email: Optional[str] = Field(None, max_length=100, description="이메일")
    bank_name: Optional[str] = Field(None, max_length=30, description="은행명")
    bank_account: Optional[str] = Field(None, max_length=100, description="배당금 이체 계좌")
    role: Optional[str] = Field("이사", max_length=50, description="법인 내 역할")
    investment_amount: Optional[float] = Field(0, ge=0, description="출자금 (원)")
    memo: Optional[str] = None


class PartnerCreate(PartnerBase):
    """동업자 생성 요청 스키마"""
    pass


class PartnerUpdate(BaseModel):
    """동업자 수정 요청 스키마 (부분 수정 허용)"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    equity_ratio: Optional[float] = Field(None, gt=0, le=100)
    phone: Optional[str] = None
    email: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    role: Optional[str] = None
    investment_amount: Optional[float] = Field(None, ge=0)
    memo: Optional[str] = None


class PartnerResponse(PartnerBase):
    """동업자 응답 스키마"""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 배당 기록 (DividendRecord) 스키마
# ─────────────────────────────────────────

class DividendRecordBase(BaseModel):
    """배당 기록 공통 필드"""
    year: int = Field(..., ge=2020, le=2099, description="정산 연도")
    partner_id: int = Field(..., gt=0, description="동업자 ID")
    annual_net_profit: float = Field(..., description="연간 순이익 (원)")
    distributable_amount: float = Field(..., ge=0, description="배당 대상 금액 (원)")
    memo: Optional[str] = None


class DividendRecordCreate(DividendRecordBase):
    """배당 기록 생성 요청 스키마"""
    pass


class DividendRecordUpdate(BaseModel):
    """배당 기록 수정 요청 스키마 (부분 수정 허용)"""
    is_paid: Optional[int] = Field(None, ge=0, le=1)
    paid_date: Optional[str] = None
    memo: Optional[str] = None

    @field_validator("paid_date")
    @classmethod
    def validate_paid_date(cls, v):
        """지급일 날짜 형식 검증 (YYYY-MM-DD)"""
        import re
        if v is not None and not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.")
        return v


class DividendRecordResponse(BaseModel):
    """배당 기록 응답 스키마"""
    id: int
    year: int
    partner_id: int
    partner_name: str
    equity_ratio_snapshot: float
    annual_net_profit: float
    distributable_amount: float
    # 세전 배당금 (지분율 × 배당 대상 금액)
    dividend_amount: float
    # 원천징수세액 (소득세법 제129조: 배당소득세 14% + 지방소득세 1.4% = 15.4%)
    # nullable: 기존 데이터 하위 호환 유지
    withholding_tax: Optional[float] = None
    # 세후 실수령액 (세전 배당금 - 원천징수세액)
    # nullable: 기존 데이터 하위 호환 유지
    net_dividend: Optional[float] = None
    is_paid: int
    paid_date: Optional[str] = None
    memo: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 배당 시뮬레이션 요청/응답 스키마
# ─────────────────────────────────────────

class DividendSimulationRequest(BaseModel):
    """배당 시뮬레이션 요청 스키마"""
    year: int = Field(..., ge=2020, le=2099, description="정산 연도")
    annual_net_profit: float = Field(..., description="연간 순이익 (원, 법인세 차감 전)")
    distribution_ratio: float = Field(
        100.0, ge=0, le=100,
        description="세후 순이익 중 배당으로 분배할 비율 (%)"
    )
    # 법인세 입력 방식 선택
    # - auto: 과세표준에 따라 자동 계산 (법인세법 기준)
    # - manual: 사용자가 직접 입력 (세무사 확정액 사용 시)
    corporate_tax_mode: str = Field(
        "auto",
        description="법인세 계산 방식: 'auto'(자동) 또는 'manual'(직접 입력)"
    )
    corporate_tax_manual: Optional[float] = Field(
        None, ge=0,
        description="법인세 직접 입력 금액 (corporate_tax_mode='manual'일 때 사용)"
    )


class DividendSimulationItem(BaseModel):
    """개별 동업자 배당 시뮬레이션 결과"""
    partner_id: int
    partner_name: str
    equity_ratio: float
    # 세전 배당금 (지분율 × 배당 대상 금액)
    dividend_amount: float
    # 배당소득세 원천징수액 (14%) + 지방소득세 (1.4%) = 15.4%
    withholding_tax: float = 0.0
    # 세후 실수령액
    net_dividend: float = 0.0


class DividendSimulationResponse(BaseModel):
    """배당 시뮬레이션 전체 응답"""
    year: int
    annual_net_profit: float
    # 법인세 (자동 계산 또는 수동 입력)
    corporate_tax: float
    # 세후 순이익 (annual_net_profit - corporate_tax)
    after_tax_profit: float
    distribution_ratio: float
    # 배당 대상 금액 (세후 순이익 × 배당 비율)
    distributable_amount: float
    items: List[DividendSimulationItem]
    total_dividend: float
    # 전체 원천징수 합계
    total_withholding_tax: float = 0.0
    # 전체 세후 실수령액 합계
    total_net_dividend: float = 0.0


# ─────────────────────────────────────────
# 법인 비용 (CorporateExpense) 스키마
# ─────────────────────────────────────────

class CorporateExpenseBase(BaseModel):
    """법인 비용 공통 필드"""
    expense_date: str = Field(..., description="비용 발생 날짜 (YYYY-MM-DD)")
    category: str = Field(..., min_length=1, max_length=50, description="비용 분류")
    description: str = Field(..., min_length=1, max_length=200, description="비용 내용")
    vendor: Optional[str] = Field(None, max_length=100, description="거래처명")
    amount: float = Field(..., gt=0, le=99999999, description="금액 (원)")
    payment_method: Optional[str] = Field("계좌이체", description="결제 수단")
    is_recurring: Optional[int] = Field(0, ge=0, le=1, description="반복 비용 여부")
    memo: Optional[str] = None

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


class CorporateExpenseCreate(CorporateExpenseBase):
    """법인 비용 생성 요청 스키마"""
    pass


class CorporateExpenseUpdate(BaseModel):
    """법인 비용 수정 요청 스키마 (부분 수정 허용)"""
    expense_date: Optional[str] = None
    category: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, min_length=1, max_length=200)
    vendor: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0, le=99999999)
    payment_method: Optional[str] = None
    is_recurring: Optional[int] = Field(None, ge=0, le=1)
    memo: Optional[str] = None


class CorporateExpenseResponse(CorporateExpenseBase):
    """법인 비용 응답 스키마"""
    id: int
    year: int
    month: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 법인 재무 개요 응답 스키마
# ─────────────────────────────────────────

class CorporateOverviewResponse(BaseModel):
    """법인 재무 개요 응답 스키마"""
    year: int
    # 연간 매출 (세무/회계 모듈 집계)
    annual_revenue: float
    # 연간 매장 운영비 (세무/회계 모듈 집계)
    annual_operating_expense: float
    # 연간 법인 비용 (법인 관리 모듈 집계)
    annual_corporate_expense: float
    # 연간 총 지출
    annual_total_expense: float
    # 연간 순이익
    annual_net_profit: float
    # 순이익률 (%)
    net_profit_margin: float
    # 파트너별 예상 배당금 (지분율 기준 100% 배당 시)
    partner_dividends: List[DividendSimulationItem]
    # 법인 비용 카테고리별 집계
    expense_by_category: List[dict]
    # 전년 대비 순이익 증감률 (%)
    yoy_profit_growth: Optional[float] = None
