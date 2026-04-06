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
