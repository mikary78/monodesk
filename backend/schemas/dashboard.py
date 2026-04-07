# ============================================================
# schemas/dashboard.py — 대시보드 API 응답 스키마
# 모든 모듈의 KPI를 한데 모아 반환하는 구조를 정의합니다.
# ============================================================

from pydantic import BaseModel, ConfigDict
from typing import Optional, List


# ─────────────────────────────────────────
# 손익 KPI 스키마
# ─────────────────────────────────────────

class ProfitLossKPI(BaseModel):
    """이번 달 손익 핵심 지표"""
    model_config = ConfigDict(from_attributes=True)

    # 이번 달 매출 합계
    total_sales: float
    # 이번 달 지출 합계
    total_expense: float
    # 순이익 (매출 - 지출)
    net_profit: float
    # 이익률 (%)
    profit_margin: float
    # 전월 대비 매출 증감률 (%)
    sales_growth_rate: Optional[float] = None
    # 전월 매출 (비교용)
    prev_month_sales: float = 0


# ─────────────────────────────────────────
# 매출 트렌드 스키마
# ─────────────────────────────────────────

class MonthlySalesTrend(BaseModel):
    """월별 매출 트렌드 항목 (차트용)"""
    model_config = ConfigDict(from_attributes=True)

    # 연도
    year: int
    # 월
    month: int
    # 레이블 (예: "2월")
    label: str
    # 총 매출
    total_sales: float
    # 총 지출
    total_expense: float
    # 순이익
    net_profit: float


# ─────────────────────────────────────────
# 재고 부족 경고 스키마
# ─────────────────────────────────────────

class LowStockAlert(BaseModel):
    """재고 부족 또는 품절 품목 알림"""
    model_config = ConfigDict(from_attributes=True)

    # 품목 ID
    item_id: int
    # 품목명
    item_name: str
    # 현재 재고 수량
    current_quantity: float
    # 최소 재고 기준
    minimum_quantity: float
    # 단위
    unit: str
    # 상태 ('부족' 또는 '품절')
    status: str


# ─────────────────────────────────────────
# 급여 현황 요약 스키마
# ─────────────────────────────────────────

class SalaryKPI(BaseModel):
    """이번 달 급여 현황 요약"""
    model_config = ConfigDict(from_attributes=True)

    # 재직 중인 직원 수
    active_employee_count: int
    # 이번 달 총 급여 지급액 (정산 완료 기준)
    total_salary_paid: float
    # 급여 지급 완료 인원 수
    paid_count: int
    # 급여 지급 미완료 인원 수
    unpaid_count: int


# ─────────────────────────────────────────
# 최근 지출 내역 스키마
# ─────────────────────────────────────────

class RecentExpense(BaseModel):
    """최근 지출 내역 항목"""
    model_config = ConfigDict(from_attributes=True)

    # 지출 ID
    id: int
    # 지출 날짜
    expense_date: str
    # 지출 내용
    description: str
    # 분류명
    category_name: str
    # 분류 색상
    category_color: str
    # 금액 (부가세 포함)
    total_amount: float


# ─────────────────────────────────────────
# 발주 현황 스키마
# ─────────────────────────────────────────

class OrderStatusKPI(BaseModel):
    """현재 발주 진행 현황"""
    model_config = ConfigDict(from_attributes=True)

    # 발주 중인 건수
    pending_orders: int
    # 오늘 입고 예정 건수
    expected_today: int


# ─────────────────────────────────────────
# 대시보드 통합 응답 스키마
# ─────────────────────────────────────────

class DashboardResponse(BaseModel):
    """대시보드 전체 데이터 응답"""
    model_config = ConfigDict(from_attributes=True)

    # 조회 연월 정보
    year: int
    month: int

    # 이번 달 손익 KPI
    profit_loss: ProfitLossKPI

    # 최근 6개월 매출 트렌드
    monthly_trend: List[MonthlySalesTrend]

    # 재고 부족 경고 목록 (최대 10건)
    low_stock_alerts: List[LowStockAlert]

    # 이번 달 급여 현황
    salary_kpi: SalaryKPI

    # 최근 지출 5건
    recent_expenses: List[RecentExpense]

    # 발주 현황
    order_status: OrderStatusKPI

    # 이번 달 매입 출처별 합계 (선택적 — 미집계 시 None)
    # 본사구매/현장구매(법카/시재)/기타 구분별 원재료 지출 총합
    purchase_summary: Optional[dict] = None


# ─────────────────────────────────────────
# 일별 KPI 스키마
# ─────────────────────────────────────────

class DailyKpiResponse(BaseModel):
    """일별 대시보드 KPI 응답"""
    model_config = ConfigDict(from_attributes=True)

    # 조회 날짜 (YYYY-MM-DD)
    date: str
    # 당일 매출
    total_sales: float = 0
    # 카드 매출
    card_sales: float = 0
    # 현금 매출
    cash_sales: float = 0
    # 배달 매출
    delivery_sales: float = 0
    # 고객수
    customer_count: int = 0
    # 영수건수
    receipt_count: int = 0
    # 테이블 단가 (매출 / 영수건수)
    table_average: float = 0
    # 당일 지출
    total_expense: float = 0
    # 당일 순이익
    net_profit: float = 0
    # 목표 달성률 (%)
    achievement_rate: float = 0.0
    # 할인액
    discount_amount: float = 0
    # 서비스액
    service_amount: float = 0
    # 전일 매출
    prev_day_sales: float = 0
    # 전주 같은 요일 매출
    prev_week_same_day_sales: float = 0
    # 전주 같은 요일 대비 증감률 (%)
    prev_week_same_day_diff: float = 0.0
    # 월 누적 매출
    monthly_total_sales: float = 0
    # 월 누적 지출
    monthly_total_expense: float = 0
    # 월 누적 순이익
    monthly_net_profit: float = 0
    # 월 목표 달성률 (%)
    monthly_achievement_rate: float = 0.0
    # 경과 영업일 수
    business_days_passed: int = 0
    # 총 영업일 수 (고정 25일 또는 실제 기록 기반)
    business_days_total: int = 25
    # 일 목표 매출 (월 매출 / 영업일 수)
    target_sales: float = 0


# ─────────────────────────────────────────
# 주별 KPI 스키마
# ─────────────────────────────────────────

class WeeklyDailyBreakdown(BaseModel):
    """주별 KPI 내 요일별 매출 항목"""
    model_config = ConfigDict(from_attributes=True)

    # 날짜 (YYYY-MM-DD)
    date: str
    # 요일 (월/화/수/목/금/토/일)
    day_of_week: str
    # 당일 매출
    total_sales: float = 0
    # 고객수
    customer_count: int = 0
    # 휴무일 여부 (데이터 없으면 True)
    is_holiday: bool = False


class WeeklyKpiResponse(BaseModel):
    """주별 대시보드 KPI 응답"""
    model_config = ConfigDict(from_attributes=True)

    # 주 시작일 (월요일, YYYY-MM-DD)
    week_start: str
    # 주 종료일 (일요일, YYYY-MM-DD)
    week_end: str
    # 주간 총 매출
    weekly_total_sales: float = 0
    # 주간 총 지출
    weekly_total_expense: float = 0
    # 주간 순이익
    weekly_net_profit: float = 0
    # 주간 총 고객수
    weekly_customer_count: int = 0
    # 요일별 매출 상세
    daily_breakdown: List[WeeklyDailyBreakdown] = []
    # 매출 최고 요일
    best_day: Optional[str] = None
    # 매출 최저 요일 (영업일 중)
    worst_day: Optional[str] = None
    # 전주 총 매출
    prev_week_total: float = 0
    # 전주 대비 증감률 (%)
    prev_week_diff: float = 0.0


# ─────────────────────────────────────────
# 월별 상세 KPI 스키마
# ─────────────────────────────────────────

class MonthlyWeeklyTrend(BaseModel):
    """월별 KPI 내 주차별 트렌드 항목"""
    model_config = ConfigDict(from_attributes=True)

    # 주차 (1~4)
    week: int
    # 주차 매출
    sales: float = 0
    # 주차 지출
    expense: float = 0


class MonthlyDailyTrend(BaseModel):
    """월별 KPI 내 일별 트렌드 항목"""
    model_config = ConfigDict(from_attributes=True)

    # 날짜 (YYYY-MM-DD)
    date: str
    # 당일 매출
    sales: float = 0
    # 고객수
    customer_count: int = 0


class MonthlyKpiResponse(BaseModel):
    """월별 대시보드 KPI 응답 (기존 summary보다 상세)"""
    model_config = ConfigDict(from_attributes=True)

    # 조회 연도
    year: int
    # 조회 월
    month: int
    # 월 총 매출
    total_sales: float = 0
    # 월 총 지출
    total_expense: float = 0
    # 월 순이익
    net_profit: float = 0
    # 이익률 (%)
    profit_margin: float = 0.0
    # 일 평균 매출
    avg_daily_sales: float = 0
    # 전월 대비 매출 증감률 (%)
    sales_growth_rate: Optional[float] = None
    # 원재료비 합계
    food_cost_total: float = 0
    # 원재료비율 (%)
    food_cost_rate: float = 0.0
    # 인건비 합계
    labor_cost_total: float = 0
    # 인건비율 (%)
    labor_cost_rate: float = 0.0
    # 고정비 합계
    fixed_cost_total: float = 0
    # 고정비 예산 (현재는 0 — 추후 확장 가능)
    fixed_cost_budget: float = 0
    # 주차별 매출/지출 트렌드
    weekly_trend: List[MonthlyWeeklyTrend] = []
    # 일별 매출/고객수 트렌드
    daily_trend: List[MonthlyDailyTrend] = []
    # 매출 최고 날짜 (YYYY-MM-DD)
    top_sales_day: Optional[str] = None
    # 전월 매출
    prev_month_sales: float = 0
