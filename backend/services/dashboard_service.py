# ============================================================
# services/dashboard_service.py — 대시보드 비즈니스 로직
# 모든 모듈(회계/재고/직원)에서 KPI를 집계해 대시보드용 데이터를 반환합니다.
# ============================================================

from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List
from datetime import date

from models.accounting import ExpenseCategory, ExpenseRecord, SalesRecord
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
    특정 기간의 총 매출(현금+카드+배달)을 집계합니다.
    """
    result = db.query(
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
        SalesRecord.sales_date >= start,
        SalesRecord.sales_date < end,
    ).first()
    return float(result.total or 0)


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


def get_dashboard_data(db: Session, year: int, month: int) -> DashboardResponse:
    """
    대시보드 전체 데이터를 집계하여 반환합니다.
    각 모듈(회계/재고/직원)에서 KPI를 수집합니다.
    """
    # 각 KPI 집계
    profit_loss = _build_profit_loss_kpi(db, year, month)
    monthly_trend = _build_monthly_trend(db, year, month)
    low_stock_alerts = _build_low_stock_alerts(db)
    salary_kpi = _build_salary_kpi(db, year, month)
    recent_expenses = _build_recent_expenses(db, year, month)
    order_status = _build_order_status(db)

    return DashboardResponse(
        year=year,
        month=month,
        profit_loss=profit_loss,
        monthly_trend=monthly_trend,
        low_stock_alerts=low_stock_alerts,
        salary_kpi=salary_kpi,
        recent_expenses=recent_expenses,
        order_status=order_status,
    )
