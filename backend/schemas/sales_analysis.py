# ============================================================
# schemas/sales_analysis.py — 매출 분석 Pydantic 스키마
# API 요청/응답 데이터 유효성 검사 및 직렬화를 담당합니다.
# ============================================================

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List
from datetime import datetime


# ─────────────────────────────────────────
# POS 가져오기 이력 스키마
# ─────────────────────────────────────────

class PosImportResponse(BaseModel):
    """POS 가져오기 이력 응답 스키마"""
    id: int
    file_name: str
    row_count: int
    status: str
    error_message: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PosImportResult(BaseModel):
    """CSV 가져오기 처리 결과 응답"""
    success: bool
    message: str
    import_id: Optional[int] = None
    row_count: int = 0
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    duplicate: bool = False


# ─────────────────────────────────────────
# 매출 트렌드 스키마
# ─────────────────────────────────────────

class TrendDataPoint(BaseModel):
    """트렌드 차트 데이터 포인트"""
    label: str        # 날짜 또는 기간 레이블
    amount: float     # 매출 금액
    count: int        # 주문 건수
    avg_amount: float = 0  # 평균 주문 금액


class SalesTrendResponse(BaseModel):
    """매출 트렌드 분석 응답"""
    period_type: str  # daily / weekly / monthly
    data: List[TrendDataPoint]
    total_amount: float
    total_count: int
    avg_daily_amount: float = 0


# ─────────────────────────────────────────
# 매출 요약 KPI 스키마
# ─────────────────────────────────────────

class SalesSummaryResponse(BaseModel):
    """매출 요약 KPI 응답"""
    year: int
    month: int
    # 이번 달 실적
    total_amount: float
    total_count: int
    avg_order_amount: float
    # 전월 대비
    prev_month_amount: float
    growth_rate: Optional[float] = None  # 전월 대비 증감률 (%)
    # 목표 대비
    target_amount: Optional[float] = None
    achievement_rate: Optional[float] = None  # 목표 달성률 (%)
    # 기간 범위
    date_from: Optional[str] = None
    date_to: Optional[str] = None


# ─────────────────────────────────────────
# 메뉴 분석 스키마
# ─────────────────────────────────────────

class MenuAnalysisItem(BaseModel):
    """메뉴별 분석 아이템"""
    menu_name: str
    menu_category: Optional[str] = None
    total_quantity: int
    total_amount: float
    contribution_rate: float  # 매출 기여도 (%)
    avg_unit_price: float
    rank: int


class MenuAnalysisResponse(BaseModel):
    """메뉴 분석 응답"""
    year: int
    month: int
    total_menu_count: int       # 집계된 메뉴 종류 수
    total_amount: float         # 전체 매출
    top_menus: List[MenuAnalysisItem]   # 인기 TOP 10
    bottom_menus: List[MenuAnalysisItem]  # 비인기 BOTTOM 10
    category_summary: List[dict]  # 카테고리별 집계


# ─────────────────────────────────────────
# 시간대/요일 분석 스키마
# ─────────────────────────────────────────

class HourlyDataPoint(BaseModel):
    """시간대별 데이터 포인트"""
    hour: int           # 0~23
    label: str          # "00시", "01시" ...
    amount: float
    count: int


class WeekdayDataPoint(BaseModel):
    """요일별 데이터 포인트"""
    weekday: int        # 0=월요일, 6=일요일
    label: str          # "월", "화", "수" ...
    amount: float
    count: int
    avg_amount: float


class TimeAnalysisResponse(BaseModel):
    """시간대/요일 분석 응답"""
    year: int
    month: int
    hourly_data: List[HourlyDataPoint]
    weekday_data: List[WeekdayDataPoint]
    peak_hour: Optional[int] = None      # 가장 바쁜 시간대
    peak_weekday: Optional[int] = None   # 가장 바쁜 요일
    quiet_hour: Optional[int] = None     # 가장 한산한 시간대


# ─────────────────────────────────────────
# 결제 수단 분석 스키마
# ─────────────────────────────────────────

class PaymentMethodItem(BaseModel):
    """결제 수단별 집계 아이템"""
    method: str          # 결제 수단명
    amount: float        # 매출 금액
    count: int           # 건수
    rate: float          # 비중 (%)


class PaymentAnalysisResponse(BaseModel):
    """결제 수단 분석 응답"""
    year: int
    month: int
    total_amount: float
    items: List[PaymentMethodItem]
    # 월별 추이 (최근 6개월)
    monthly_trend: List[dict]


# ─────────────────────────────────────────
# 메뉴 마스터 스키마
# ─────────────────────────────────────────

class MenuItemBase(BaseModel):
    """메뉴 마스터 공통 필드"""
    name: str = Field(..., min_length=1, max_length=200, description="메뉴명")
    category: Optional[str] = Field("기타", max_length=100, description="카테고리")
    price: Optional[float] = Field(0, ge=0, description="판매 단가")
    cost: Optional[float] = Field(0, ge=0, description="원가")
    is_seasonal: Optional[bool] = Field(False, description="계절 메뉴 여부")


class MenuItemCreate(MenuItemBase):
    """메뉴 마스터 생성 요청"""
    pass


class MenuItemUpdate(BaseModel):
    """메뉴 마스터 수정 요청 (부분 수정)"""
    category: Optional[str] = None
    price: Optional[float] = Field(None, ge=0)
    cost: Optional[float] = Field(None, ge=0)
    is_seasonal: Optional[bool] = None
    is_active: Optional[bool] = None


class MenuItemResponse(MenuItemBase):
    """메뉴 마스터 응답"""
    id: int
    is_active: bool
    margin_rate: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 목표 매출 스키마
# ─────────────────────────────────────────

class SalesTargetCreate(BaseModel):
    """목표 매출 생성/수정 요청"""
    year: int = Field(..., ge=2020, le=2099)
    month: int = Field(..., ge=1, le=12)
    target_amount: float = Field(..., gt=0, description="목표 매출액 (원)")
    memo: Optional[str] = Field(None, max_length=200)


class SalesTargetResponse(BaseModel):
    """목표 매출 응답"""
    id: int
    year: int
    month: int
    target_amount: float
    memo: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# AI 인사이트 스키마
# ─────────────────────────────────────────

class AiInsightRequest(BaseModel):
    """AI 경영 인사이트 요청"""
    year: int = Field(..., ge=2020, le=2099)
    month: int = Field(..., ge=1, le=12)


class AiInsightResponse(BaseModel):
    """AI 경영 인사이트 응답"""
    success: bool
    insight: str                   # Ollama가 생성한 한국어 인사이트 텍스트
    anomalies: List[str] = []      # 이상 감지 항목
    recommendations: List[str] = []  # 추천 액션
    generated_at: str              # 생성 일시
