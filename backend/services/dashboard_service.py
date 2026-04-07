# ============================================================
# services/dashboard_service.py — 대시보드 비즈니스 로직
# 모든 모듈(회계/재고/직원)에서 KPI를 집계해 대시보드용 데이터를 반환합니다.
# ============================================================

from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
from datetime import date, timedelta
import calendar

from models.accounting import ExpenseCategory, ExpenseRecord, SalesRecord
from models.sales_analysis import PosSalesRaw
from models.inventory import InventoryItem, PurchaseOrder
from models.employee import Employee, SalaryRecord

from schemas.dashboard import (
    DashboardResponse,
    ProfitLossKPI,
    MonthlySalesTrend,
    LowStockAlert,
    SalaryKPI,
    RecentExpense,
    OrderStatusKPI,
    DailyKpiResponse,
    WeeklyKpiResponse,
    WeeklyDailyBreakdown,
    MonthlyKpiResponse,
    MonthlyWeeklyTrend,
    MonthlyDailyTrend,
)


def _get_date_range(year: int, month: int) -> tuple[str, str]:
    """
    해당 연월의 시작일과 종료일(다음달 1일)을 반환하는 내부 유틸.
    """
    start = f"{year}-{month:02d}-01"
    if month == 12:
        end = f"{year + 1}-01-01"
    else:
        end = f"{year}-{month + 1:02d}-01"
    return start, end


def _get_total_sales(db: Session, start: str, end: str) -> float:
    """
    특정 기간의 총 매출을 수동 입력과 POS 원본 데이터를 합산하여 집계합니다.

    이중 계산 방지 규칙:
    - SalesRecord: is_pos_synced == 0 (수동 입력)만 포함
      is_pos_synced == 1 은 이미 POS 데이터를 반영한 것으로 PosSalesRaw와 중복이므로 제외
    - PosSalesRaw: 취소되지 않은 레코드의 total_price 합산
    """
    # 수동 입력 매출만 집계 (POS 연동 기록 제외)
    manual_result = db.query(
        func.coalesce(
            func.sum(
                SalesRecord.cash_amount
                + SalesRecord.card_amount
                + SalesRecord.delivery_amount
            ),
            0,
        ).label("total")
    ).filter(
        SalesRecord.is_deleted == 0,
        SalesRecord.is_pos_synced == 0,
        SalesRecord.sales_date >= start,
        SalesRecord.sales_date < end,
    ).first()
    manual_total = float(manual_result.total or 0)

    # POS 원본 매출 집계 (취소 제외)
    pos_result = db.query(
        func.coalesce(func.sum(PosSalesRaw.total_price), 0).label("pos_total")
    ).filter(
        PosSalesRaw.is_deleted == 0,
        PosSalesRaw.is_cancelled == False,
        PosSalesRaw.sale_date >= start,
        PosSalesRaw.sale_date < end,
    ).first()
    pos_total = float(pos_result.pos_total or 0)

    return manual_total + pos_total


def _get_total_expense(db: Session, start: str, end: str) -> float:
    """
    특정 기간의 총 지출(공급가+부가세)을 집계합니다.
    """
    result = db.query(
        func.coalesce(
            func.sum(ExpenseRecord.amount + ExpenseRecord.vat), 0
        ).label("total")
    ).filter(
        ExpenseRecord.is_deleted == 0,
        ExpenseRecord.expense_date >= start,
        ExpenseRecord.expense_date < end,
    ).first()
    return float(result.total or 0)


def _build_profit_loss_kpi(db: Session, year: int, month: int) -> ProfitLossKPI:
    """
    이번 달 손익 KPI를 계산합니다.
    매출 합계, 지출 합계, 순이익, 이익률, 전월 대비 증감률을 반환합니다.
    """
    start, end = _get_date_range(year, month)
    total_sales = _get_total_sales(db, start, end)
    total_expense = _get_total_expense(db, start, end)
    net_profit = total_sales - total_expense
    profit_margin = round((net_profit / total_sales * 100), 1) if total_sales > 0 else 0.0

    # 전월 매출 조회 (증감률 계산용)
    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    prev_start, prev_end = _get_date_range(prev_year, prev_month)
    prev_sales = _get_total_sales(db, prev_start, prev_end)

    # 전월 대비 증감률 계산
    sales_growth_rate = None
    if prev_sales > 0:
        sales_growth_rate = round(((total_sales - prev_sales) / prev_sales) * 100, 1)

    return ProfitLossKPI(
        total_sales=total_sales,
        total_expense=total_expense,
        net_profit=net_profit,
        profit_margin=profit_margin,
        sales_growth_rate=sales_growth_rate,
        prev_month_sales=prev_sales,
    )


def _build_monthly_trend(db: Session, year: int, month: int) -> List[MonthlySalesTrend]:
    """
    최근 6개월 매출/지출/순이익 트렌드 데이터를 반환합니다.
    차트 표시를 위해 오래된 달부터 정렬합니다.
    """
    trend = []
    for i in range(5, -1, -1):
        # 6개월 전부터 이번 달까지 역순으로 계산
        m = month - i
        y = year
        while m <= 0:
            m += 12
            y -= 1

        start, end = _get_date_range(y, m)
        total_sales = _get_total_sales(db, start, end)
        total_expense = _get_total_expense(db, start, end)
        net_profit = total_sales - total_expense

        trend.append(
            MonthlySalesTrend(
                year=y,
                month=m,
                label=f"{m}월",
                total_sales=total_sales,
                total_expense=total_expense,
                net_profit=net_profit,
            )
        )
    return trend


def _build_low_stock_alerts(db: Session) -> List[LowStockAlert]:
    """
    재고가 최소 기준 이하인 품목(부족/품절)을 최대 10건 반환합니다.
    """
    # 현재 재고가 최소 임계값(min_quantity) 이하인 품목 조회
    items = (
        db.query(InventoryItem)
        .filter(
            InventoryItem.is_deleted == 0,
            InventoryItem.current_quantity <= InventoryItem.min_quantity,
        )
        .order_by(InventoryItem.current_quantity.asc())
        .limit(10)
        .all()
    )

    alerts = []
    for item in items:
        # 현재 수량이 0 이하면 '품절', 그 외는 '부족'
        status = "품절" if item.current_quantity <= 0 else "부족"
        alerts.append(
            LowStockAlert(
                item_id=item.id,
                item_name=item.name,
                current_quantity=float(item.current_quantity or 0),
                minimum_quantity=float(item.min_quantity or 0),
                unit=item.unit or "",
                status=status,
            )
        )
    return alerts


def _build_salary_kpi(db: Session, year: int, month: int) -> SalaryKPI:
    """
    이번 달 급여 현황 KPI를 반환합니다.
    재직 중 직원 수, 총 지급액, 지급 완료/미완료 현황을 포함합니다.
    """
    # 재직 중인 직원 수 (퇴사일이 없으면 재직 중으로 판단)
    active_count = (
        db.query(func.count(Employee.id))
        .filter(
            Employee.is_deleted == 0,
            Employee.resign_date.is_(None),
        )
        .scalar()
        or 0
    )

    # 이번 달 급여 정산 기록 조회
    salary_records = (
        db.query(SalaryRecord)
        .filter(
            SalaryRecord.is_deleted == 0,
            SalaryRecord.year == year,
            SalaryRecord.month == month,
        )
        .all()
    )

    # 지급 완료/미완료 집계 (is_paid는 Boolean으로 True/False 또는 1/0 모두 처리)
    paid_records = [r for r in salary_records if r.is_paid]
    unpaid_records = [r for r in salary_records if not r.is_paid]
    # net_pay 컬럼을 사용 (실수령액)
    total_paid = sum(float(r.net_pay or 0) for r in paid_records)

    return SalaryKPI(
        active_employee_count=active_count,
        total_salary_paid=total_paid,
        paid_count=len(paid_records),
        unpaid_count=len(unpaid_records),
    )


def _build_recent_expenses(db: Session, year: int, month: int) -> List[RecentExpense]:
    """
    이번 달 최근 지출 5건을 반환합니다.
    분류명과 색상 정보를 함께 포함합니다.
    """
    start, end = _get_date_range(year, month)

    # 지출 기록과 분류 정보를 JOIN하여 최근 5건 조회
    rows = (
        db.query(
            ExpenseRecord.id,
            ExpenseRecord.expense_date,
            ExpenseRecord.description,
            ExpenseRecord.amount,
            ExpenseRecord.vat,
            ExpenseCategory.name.label("category_name"),
            ExpenseCategory.color.label("category_color"),
        )
        .join(ExpenseCategory, ExpenseRecord.category_id == ExpenseCategory.id)
        .filter(
            ExpenseRecord.is_deleted == 0,
            ExpenseRecord.expense_date >= start,
            ExpenseRecord.expense_date < end,
        )
        .order_by(ExpenseRecord.expense_date.desc(), ExpenseRecord.id.desc())
        .limit(5)
        .all()
    )

    return [
        RecentExpense(
            id=row.id,
            expense_date=row.expense_date,
            description=row.description,
            category_name=row.category_name,
            category_color=row.category_color,
            total_amount=float((row.amount or 0) + (row.vat or 0)),
        )
        for row in rows
    ]


def _build_order_status(db: Session) -> OrderStatusKPI:
    """
    현재 발주 진행 현황을 반환합니다.
    발주 중인 건수와 오늘 입고 예정 건수를 포함합니다.
    """
    # 발주 중 상태 건수
    pending_count = (
        db.query(func.count(PurchaseOrder.id))
        .filter(
            PurchaseOrder.is_deleted == 0,
            PurchaseOrder.status == "발주중",
        )
        .scalar()
        or 0
    )

    # 오늘 입고 예정 건수 (예정일이 오늘인 발주중 건)
    today_str = date.today().isoformat()
    today_count = (
        db.query(func.count(PurchaseOrder.id))
        .filter(
            PurchaseOrder.is_deleted == 0,
            PurchaseOrder.status == "발주중",
            PurchaseOrder.expected_date == today_str,
        )
        .scalar()
        or 0
    )

    return OrderStatusKPI(
        pending_orders=pending_count,
        expected_today=today_count,
    )


# ─────────────────────────────────────────
# 일별/주별/월별 KPI 서비스 함수
# ─────────────────────────────────────────

def _get_day_sales(db: Session, date_str: str) -> dict:
    """
    특정 날짜의 매출 데이터를 집계합니다.
    이중 계산 방지 규칙을 적용하여 수동 입력 + POS 합산합니다.

    반환: card, cash, delivery, receipt_count, customer_count, discount, service
    """
    # 수동 입력 매출 집계 (is_pos_synced == 0)
    manual = db.query(
        func.coalesce(func.sum(SalesRecord.card_amount), 0).label("card"),
        func.coalesce(func.sum(SalesRecord.cash_amount), 0).label("cash"),
        func.coalesce(func.sum(SalesRecord.delivery_amount), 0).label("delivery"),
        func.coalesce(func.sum(SalesRecord.receipt_count), 0).label("receipt_count"),
        func.coalesce(func.sum(SalesRecord.customer_count), 0).label("customer_count"),
        func.coalesce(func.sum(SalesRecord.discount_amount), 0).label("discount"),
        func.coalesce(func.sum(SalesRecord.service_amount), 0).label("service"),
    ).filter(
        SalesRecord.is_deleted == 0,
        SalesRecord.is_pos_synced == 0,
        SalesRecord.sales_date == date_str,
    ).first()

    # POS 원본 매출 집계 (취소 제외)
    pos = db.query(
        func.coalesce(func.sum(PosSalesRaw.total_price), 0).label("pos_total")
    ).filter(
        PosSalesRaw.is_deleted == 0,
        PosSalesRaw.is_cancelled == False,
        PosSalesRaw.sale_date == date_str,
    ).first()

    card = float(manual.card or 0)
    cash = float(manual.cash or 0)
    delivery = float(manual.delivery or 0)
    pos_total = float(pos.pos_total or 0)
    total = card + cash + delivery + pos_total

    return {
        "total_sales": total,
        "card_sales": card,
        "cash_sales": cash,
        "delivery_sales": delivery,
        "receipt_count": int(manual.receipt_count or 0),
        "customer_count": int(manual.customer_count or 0),
        "discount_amount": float(manual.discount or 0),
        "service_amount": float(manual.service or 0),
    }


def _get_day_expense(db: Session, date_str: str) -> float:
    """
    특정 날짜의 총 지출(공급가 + 부가세)을 집계합니다.
    """
    result = db.query(
        func.coalesce(func.sum(ExpenseRecord.amount + ExpenseRecord.vat), 0).label("total")
    ).filter(
        ExpenseRecord.is_deleted == 0,
        ExpenseRecord.expense_date == date_str,
    ).first()
    return float(result.total or 0)


def _count_business_days(db: Session, year: int, month: int, up_to_date: Optional[str] = None) -> tuple[int, int]:
    """
    해당 월의 영업일 수를 반환합니다.
    SalesRecord 또는 PosSalesRaw에 데이터가 있는 날만 영업일로 판단합니다.

    반환: (경과 영업일 수, 총 영업일 수)
    총 영업일 수는 실제 기록 기반 또는 고정 25일 중 큰 값 사용.
    """
    start, end = _get_date_range(year, month)

    # 매출 기록이 있는 날짜 목록 조회
    manual_dates = db.query(SalesRecord.sales_date).filter(
        SalesRecord.is_deleted == 0,
        SalesRecord.sales_date >= start,
        SalesRecord.sales_date < end,
    ).distinct().all()

    pos_dates = db.query(PosSalesRaw.sale_date).filter(
        PosSalesRaw.is_deleted == 0,
        PosSalesRaw.is_cancelled == False,
        PosSalesRaw.sale_date >= start,
        PosSalesRaw.sale_date < end,
    ).distinct().all()

    # 합집합으로 영업일 계산
    all_dates = set()
    all_dates.update(d[0] for d in manual_dates)
    all_dates.update(d[0] for d in pos_dates)

    total_days = max(len(all_dates), 25)  # 최소 25일 보장

    if up_to_date:
        # 해당 날짜까지의 영업일 수만 카운트
        passed = len([d for d in all_dates if d <= up_to_date])
    else:
        passed = len(all_dates)

    return passed, total_days


def get_daily_kpi(db: Session, target_date: str) -> DailyKpiResponse:
    """
    특정 날짜의 일별 KPI를 집계합니다.
    당일 매출/지출, 전일/전주 비교, 월 누적 현황을 반환합니다.
    """
    # 날짜 파싱
    d = date.fromisoformat(target_date)
    year, month = d.year, d.month

    # 당일 매출 집계
    day_sales = _get_day_sales(db, target_date)
    total_sales = day_sales["total_sales"]

    # 당일 지출
    total_expense = _get_day_expense(db, target_date)
    net_profit = total_sales - total_expense

    # 테이블 단가 (영수건수 기준)
    receipt_count = day_sales["receipt_count"]
    table_average = total_sales / receipt_count if receipt_count > 0 else 0.0

    # 전일 매출
    prev_day_str = (d - timedelta(days=1)).isoformat()
    prev_day_data = _get_day_sales(db, prev_day_str)
    prev_day_sales = prev_day_data["total_sales"]

    # 전주 같은 요일 매출
    prev_week_str = (d - timedelta(days=7)).isoformat()
    prev_week_data = _get_day_sales(db, prev_week_str)
    prev_week_same_day_sales = prev_week_data["total_sales"]

    # 전주 같은 요일 대비 증감률 계산
    if prev_week_same_day_sales > 0:
        prev_week_same_day_diff = round(
            (total_sales - prev_week_same_day_sales) / prev_week_same_day_sales * 100, 1
        )
    else:
        prev_week_same_day_diff = 0.0

    # 월 누적 데이터 집계 (1일 ~ 당일)
    month_start = f"{year}-{month:02d}-01"
    # 다음날 00:00 기준으로 범위 설정 (당일 포함)
    next_day_str = (d + timedelta(days=1)).isoformat()
    monthly_total_sales = _get_total_sales(db, month_start, next_day_str)
    monthly_total_expense = _get_total_expense(db, month_start, next_day_str)
    monthly_net_profit = monthly_total_sales - monthly_total_expense

    # 영업일 수 계산
    business_days_passed, business_days_total = _count_business_days(db, year, month, target_date)

    # 일 목표 매출 (전월 월 매출 / 영업일 수 — 또는 월간 목표 매출 기반)
    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    prev_start, prev_end = _get_date_range(prev_year, prev_month)
    prev_month_sales = _get_total_sales(db, prev_start, prev_end)
    target_sales = prev_month_sales / business_days_total if business_days_total > 0 else 0.0

    # 월 목표 달성률 (월 누적 / 전월 매출 기준)
    if prev_month_sales > 0:
        monthly_achievement_rate = round(monthly_total_sales / prev_month_sales * 100, 1)
    else:
        monthly_achievement_rate = 0.0

    # 당일 목표 달성률
    achievement_rate = round(total_sales / target_sales * 100, 1) if target_sales > 0 else 0.0

    return DailyKpiResponse(
        date=target_date,
        total_sales=total_sales,
        card_sales=day_sales["card_sales"],
        cash_sales=day_sales["cash_sales"],
        delivery_sales=day_sales["delivery_sales"],
        customer_count=day_sales["customer_count"],
        receipt_count=receipt_count,
        table_average=round(table_average, 0),
        total_expense=total_expense,
        net_profit=net_profit,
        achievement_rate=achievement_rate,
        discount_amount=day_sales["discount_amount"],
        service_amount=day_sales["service_amount"],
        prev_day_sales=prev_day_sales,
        prev_week_same_day_sales=prev_week_same_day_sales,
        prev_week_same_day_diff=prev_week_same_day_diff,
        monthly_total_sales=monthly_total_sales,
        monthly_total_expense=monthly_total_expense,
        monthly_net_profit=monthly_net_profit,
        monthly_achievement_rate=monthly_achievement_rate,
        business_days_passed=business_days_passed,
        business_days_total=business_days_total,
        target_sales=round(target_sales, 0),
    )


def get_weekly_kpi(db: Session, target_date: str) -> WeeklyKpiResponse:
    """
    해당 날짜가 속한 주(월~일)의 주별 KPI를 집계합니다.
    요일별 매출 상세, 전주 대비, 베스트/워스트 요일을 반환합니다.
    """
    # 한국 요일명 매핑 (0=월요일 ... 6=일요일)
    KR_DAY = ["월", "화", "수", "목", "금", "토", "일"]

    d = date.fromisoformat(target_date)
    # 해당 주 월요일 계산
    week_start = d - timedelta(days=d.weekday())
    week_end = week_start + timedelta(days=6)

    # 주간 총 매출/지출/고객수 초기화
    weekly_total_sales = 0.0
    weekly_total_expense = 0.0
    weekly_customer_count = 0
    daily_breakdown = []

    # 7일 반복 집계
    for i in range(7):
        cur_date = week_start + timedelta(days=i)
        cur_str = cur_date.isoformat()
        day_data = _get_day_sales(db, cur_str)
        day_expense = _get_day_expense(db, cur_str)

        # 매출 데이터가 없으면 휴무일로 간주
        is_holiday = day_data["total_sales"] == 0 and day_data["customer_count"] == 0

        weekly_total_sales += day_data["total_sales"]
        weekly_total_expense += day_expense
        weekly_customer_count += day_data["customer_count"]

        daily_breakdown.append(WeeklyDailyBreakdown(
            date=cur_str,
            day_of_week=KR_DAY[i],
            total_sales=day_data["total_sales"],
            customer_count=day_data["customer_count"],
            is_holiday=is_holiday,
        ))

    weekly_net_profit = weekly_total_sales - weekly_total_expense

    # 베스트/워스트 요일 계산 (영업일만 대상)
    sales_days = [b for b in daily_breakdown if not b.is_holiday]
    best_day = max(sales_days, key=lambda x: x.total_sales).day_of_week if sales_days else None
    worst_day = min(sales_days, key=lambda x: x.total_sales).day_of_week if sales_days else None

    # 전주 집계
    prev_week_start = week_start - timedelta(days=7)
    prev_week_end_str = (prev_week_start + timedelta(days=7)).isoformat()
    prev_week_start_str = prev_week_start.isoformat()
    prev_week_total = _get_total_sales(db, prev_week_start_str, prev_week_end_str)

    # 전주 대비 증감률
    if prev_week_total > 0:
        prev_week_diff = round((weekly_total_sales - prev_week_total) / prev_week_total * 100, 1)
    else:
        prev_week_diff = 0.0

    return WeeklyKpiResponse(
        week_start=week_start.isoformat(),
        week_end=week_end.isoformat(),
        weekly_total_sales=weekly_total_sales,
        weekly_total_expense=weekly_total_expense,
        weekly_net_profit=weekly_net_profit,
        weekly_customer_count=weekly_customer_count,
        daily_breakdown=daily_breakdown,
        best_day=best_day,
        worst_day=worst_day,
        prev_week_total=prev_week_total,
        prev_week_diff=prev_week_diff,
    )


def get_monthly_kpi(db: Session, year: int, month: int) -> MonthlyKpiResponse:
    """
    특정 연월의 상세 월별 KPI를 집계합니다.
    손익 구조(원재료비/인건비/고정비), 일별/주차별 트렌드, 매출 최고 날짜를 포함합니다.
    """
    start, end = _get_date_range(year, month)

    # 총 매출/지출
    total_sales = _get_total_sales(db, start, end)
    total_expense = _get_total_expense(db, start, end)
    net_profit = total_sales - total_expense
    profit_margin = round(net_profit / total_sales * 100, 1) if total_sales > 0 else 0.0

    # 전월 매출 (증감률 계산용)
    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    prev_start, prev_end = _get_date_range(prev_year, prev_month)
    prev_month_sales = _get_total_sales(db, prev_start, prev_end)

    sales_growth_rate = None
    if prev_month_sales > 0:
        sales_growth_rate = round((total_sales - prev_month_sales) / prev_month_sales * 100, 1)

    # 원재료비: 카테고리명에 원재료/식자재/주류 포함
    food_cost_result = db.query(
        func.coalesce(func.sum(ExpenseRecord.amount + ExpenseRecord.vat), 0).label("total")
    ).join(
        ExpenseCategory, ExpenseRecord.category_id == ExpenseCategory.id
    ).filter(
        ExpenseRecord.is_deleted == 0,
        ExpenseRecord.expense_date >= start,
        ExpenseRecord.expense_date < end,
        ExpenseCategory.name.like("%원재료%") |
        ExpenseCategory.name.like("%식자재%") |
        ExpenseCategory.name.like("%주류%"),
    ).first()
    food_cost_total = float(food_cost_result.total or 0)
    food_cost_rate = round(food_cost_total / total_sales * 100, 1) if total_sales > 0 else 0.0

    # 인건비: SalaryRecord에서 해당 월 net_pay 합산
    labor_result = db.query(
        func.coalesce(func.sum(SalaryRecord.net_pay), 0).label("total")
    ).filter(
        SalaryRecord.is_deleted == 0,
        SalaryRecord.year == year,
        SalaryRecord.month == month,
    ).first()
    labor_cost_total = float(labor_result.total or 0)
    labor_cost_rate = round(labor_cost_total / total_sales * 100, 1) if total_sales > 0 else 0.0

    # 고정비: 카테고리명에 고정/임대/관리비 포함
    fixed_cost_result = db.query(
        func.coalesce(func.sum(ExpenseRecord.amount + ExpenseRecord.vat), 0).label("total")
    ).join(
        ExpenseCategory, ExpenseRecord.category_id == ExpenseCategory.id
    ).filter(
        ExpenseRecord.is_deleted == 0,
        ExpenseRecord.expense_date >= start,
        ExpenseRecord.expense_date < end,
        ExpenseCategory.name.like("%고정%") |
        ExpenseCategory.name.like("%임대%") |
        ExpenseCategory.name.like("%관리비%"),
    ).first()
    fixed_cost_total = float(fixed_cost_result.total or 0)

    # 일별 트렌드 집계
    days_in_month = calendar.monthrange(year, month)[1]
    daily_trend = []
    best_sales = 0.0
    top_sales_day = None

    for day in range(1, days_in_month + 1):
        date_str = f"{year}-{month:02d}-{day:02d}"
        day_data = _get_day_sales(db, date_str)
        day_sales_val = day_data["total_sales"]

        daily_trend.append(MonthlyDailyTrend(
            date=date_str,
            sales=day_sales_val,
            customer_count=day_data["customer_count"],
        ))

        if day_sales_val > best_sales:
            best_sales = day_sales_val
            top_sales_day = date_str

    # 영업일 수 계산 (일 평균 매출용)
    business_days = len([t for t in daily_trend if t.sales > 0])
    avg_daily_sales = round(total_sales / business_days, 0) if business_days > 0 else 0.0

    # 주차별 트렌드 집계 (1~4주차, 각 주는 7일 단위)
    weekly_trend = []
    for week_num in range(1, 5):
        week_start_day = (week_num - 1) * 7 + 1
        week_end_day = min(week_num * 7, days_in_month)
        week_start_str = f"{year}-{month:02d}-{week_start_day:02d}"
        week_end_str = f"{year}-{month:02d}-{week_end_day:02d}"
        # 다음날 00:00까지로 범위 설정
        week_end_exclusive = (
            date.fromisoformat(week_end_str) + timedelta(days=1)
        ).isoformat()
        week_sales = _get_total_sales(db, week_start_str, week_end_exclusive)
        week_expense = _get_total_expense(db, week_start_str, week_end_exclusive)

        weekly_trend.append(MonthlyWeeklyTrend(
            week=week_num,
            sales=week_sales,
            expense=week_expense,
        ))

    return MonthlyKpiResponse(
        year=year,
        month=month,
        total_sales=total_sales,
        total_expense=total_expense,
        net_profit=net_profit,
        profit_margin=profit_margin,
        avg_daily_sales=avg_daily_sales,
        sales_growth_rate=sales_growth_rate,
        food_cost_total=food_cost_total,
        food_cost_rate=food_cost_rate,
        labor_cost_total=labor_cost_total,
        labor_cost_rate=labor_cost_rate,
        fixed_cost_total=fixed_cost_total,
        fixed_cost_budget=0,
        weekly_trend=weekly_trend,
        daily_trend=daily_trend,
        top_sales_day=top_sales_day,
        prev_month_sales=prev_month_sales,
    )


def get_dashboard_data(db: Session, year: int, month: int) -> DashboardResponse:
    """
    대시보드 전체 데이터를 집계하여 반환합니다.
    각 모듈(회계/재고/직원)에서 KPI를 수집합니다.
    """
    # 재고 서비스에서 매입 출처별 집계 함수를 가져옵니다
    # 순환 import 방지를 위해 함수 내부에서 import합니다
    from services.inventory_service import get_purchase_summary

    # 각 KPI 집계
    profit_loss = _build_profit_loss_kpi(db, year, month)
    monthly_trend = _build_monthly_trend(db, year, month)
    low_stock_alerts = _build_low_stock_alerts(db)
    salary_kpi = _build_salary_kpi(db, year, month)
    recent_expenses = _build_recent_expenses(db, year, month)
    order_status = _build_order_status(db)

    # 이번 달 매입 출처별 집계 (엑셀 3.원·부재료 시트 구분 데이터)
    # 오류 발생 시 대시보드 전체가 실패하지 않도록 try-except로 보호
    try:
        purchase_summary_data = get_purchase_summary(db, year, month)
    except Exception:
        # 집계 실패 시 None으로 처리 (대시보드 나머지 KPI는 정상 반환)
        purchase_summary_data = None

    return DashboardResponse(
        year=year,
        month=month,
        profit_loss=profit_loss,
        monthly_trend=monthly_trend,
        low_stock_alerts=low_stock_alerts,
        salary_kpi=salary_kpi,
        recent_expenses=recent_expenses,
        order_status=order_status,
        purchase_summary=purchase_summary_data,  # 매입 출처별 집계 포함
    )
