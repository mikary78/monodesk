# ============================================================
# services/corporate_service.py — 법인 관리 비즈니스 로직
# 동업자 관리, 배당 계산, 법인 비용 관리, 재무 개요 집계
# ============================================================

from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import Optional, List
from models.corporate import Partner, DividendRecord, CorporateExpense
from models.accounting import SalesRecord, ExpenseRecord
from schemas.corporate import (
    PartnerCreate, PartnerUpdate,
    DividendRecordCreate, DividendRecordUpdate,
    DividendSimulationRequest, DividendSimulationResponse, DividendSimulationItem,
    CorporateExpenseCreate, CorporateExpenseUpdate,
    CorporateOverviewResponse,
)


# ─────────────────────────────────────────
# 동업자 관리 서비스
# ─────────────────────────────────────────

def get_all_partners(db: Session) -> List[Partner]:
    """
    삭제되지 않은 모든 동업자 목록을 지분율 내림차순으로 반환합니다.
    """
    return (
        db.query(Partner)
        .filter(Partner.is_deleted == 0)
        .order_by(Partner.equity_ratio.desc())
        .all()
    )


def get_partner_by_id(db: Session, partner_id: int) -> Optional[Partner]:
    """
    동업자 ID로 단건 조회합니다.
    """
    return (
        db.query(Partner)
        .filter(Partner.id == partner_id, Partner.is_deleted == 0)
        .first()
    )


def create_partner(db: Session, data: PartnerCreate) -> Partner:
    """
    신규 동업자를 등록합니다.
    등록 전 지분율 합계가 100%를 초과하는지 검증합니다.
    """
    # 기존 동업자들의 지분율 합계 조회
    existing_total = (
        db.query(func.sum(Partner.equity_ratio))
        .filter(Partner.is_deleted == 0)
        .scalar()
    ) or 0.0

    if existing_total + data.equity_ratio > 100.0:
        raise ValueError(
            f"지분율 합계가 100%를 초과합니다. "
            f"현재 등록된 지분율 합계: {existing_total:.1f}%, "
            f"추가하려는 지분율: {data.equity_ratio:.1f}%"
        )

    # 동업자 생성
    partner = Partner(**data.model_dump())
    db.add(partner)
    db.commit()
    db.refresh(partner)
    return partner


def update_partner(db: Session, partner_id: int, data: PartnerUpdate) -> Optional[Partner]:
    """
    동업자 정보를 수정합니다.
    지분율 변경 시 전체 합계가 100%를 초과하지 않는지 검증합니다.
    """
    partner = get_partner_by_id(db, partner_id)
    if not partner:
        return None

    update_data = data.model_dump(exclude_unset=True)

    # 지분율 변경 시 유효성 검증
    if "equity_ratio" in update_data:
        # 현재 동업자를 제외한 나머지 지분율 합계
        other_total = (
            db.query(func.sum(Partner.equity_ratio))
            .filter(Partner.is_deleted == 0, Partner.id != partner_id)
            .scalar()
        ) or 0.0

        if other_total + update_data["equity_ratio"] > 100.0:
            raise ValueError(
                f"지분율 합계가 100%를 초과합니다. "
                f"다른 동업자들의 지분율 합계: {other_total:.1f}%, "
                f"변경하려는 지분율: {update_data['equity_ratio']:.1f}%"
            )

    for key, value in update_data.items():
        setattr(partner, key, value)

    db.commit()
    db.refresh(partner)
    return partner


def delete_partner(db: Session, partner_id: int) -> bool:
    """
    동업자를 소프트 삭제합니다.
    배당 기록이 있는 경우에도 이력은 보존됩니다.
    """
    partner = get_partner_by_id(db, partner_id)
    if not partner:
        return False

    partner.is_deleted = 1
    db.commit()
    return True


def seed_default_partners(db: Session) -> None:
    """
    MonoBound 법인 기본 동업자 4명을 초기 등록합니다.
    (최초 설정 시 1회 사용 — 이미 등록된 동업자가 있으면 건너뜁니다)
    """
    existing_count = db.query(Partner).filter(Partner.is_deleted == 0).count()
    if existing_count > 0:
        return  # 이미 등록된 동업자가 있으면 건너뜀

    default_partners = [
        {"name": "동업자 A", "equity_ratio": 29.0, "role": "대표이사"},
        {"name": "동업자 B", "equity_ratio": 29.0, "role": "이사"},
        {"name": "동업자 C", "equity_ratio": 29.0, "role": "이사"},
        {"name": "동업자 D", "equity_ratio": 13.0, "role": "이사"},
    ]

    for p in default_partners:
        partner = Partner(**p)
        db.add(partner)

    db.commit()


# ─────────────────────────────────────────
# 배당 정산 서비스
# ─────────────────────────────────────────

def simulate_dividend(
    db: Session, request: DividendSimulationRequest
) -> DividendSimulationResponse:
    """
    배당 시뮬레이션을 실행합니다.
    순이익과 배당 비율을 입력받아 동업자별 예상 배당금을 계산합니다.
    DB에 저장하지 않고 계산 결과만 반환합니다.
    """
    partners = get_all_partners(db)
    if not partners:
        raise ValueError("등록된 동업자가 없습니다. 먼저 동업자를 등록해주세요.")

    # 배당 대상 금액 계산 (순이익 × 배당 비율)
    distributable_amount = request.annual_net_profit * (request.distribution_ratio / 100.0)

    items = []
    total_dividend = 0.0

    for partner in partners:
        # 지분율에 따른 배당금 계산
        dividend_amount = distributable_amount * (partner.equity_ratio / 100.0)
        total_dividend += dividend_amount

        items.append(DividendSimulationItem(
            partner_id=partner.id,
            partner_name=partner.name,
            equity_ratio=partner.equity_ratio,
            dividend_amount=round(dividend_amount),
        ))

    return DividendSimulationResponse(
        year=request.year,
        annual_net_profit=request.annual_net_profit,
        distribution_ratio=request.distribution_ratio,
        distributable_amount=round(distributable_amount),
        items=items,
        total_dividend=round(total_dividend),
    )


def get_dividend_records(db: Session, year: int) -> List[DividendRecord]:
    """
    특정 연도의 배당 기록 목록을 반환합니다.
    """
    return (
        db.query(DividendRecord)
        .filter(DividendRecord.year == year, DividendRecord.is_deleted == 0)
        .order_by(DividendRecord.partner_id)
        .all()
    )


def create_dividend_records(
    db: Session, request: DividendSimulationRequest
) -> List[DividendRecord]:
    """
    배당 정산을 확정하고 DB에 저장합니다.
    동일 연도에 이미 배당 기록이 있으면 upsert(업데이트) 방식으로 처리합니다.
    """
    partners = get_all_partners(db)
    if not partners:
        raise ValueError("등록된 동업자가 없습니다.")

    distributable_amount = request.annual_net_profit * (request.distribution_ratio / 100.0)
    records = []

    for partner in partners:
        dividend_amount = round(distributable_amount * (partner.equity_ratio / 100.0))

        # 기존 기록 확인 (upsert 처리)
        existing = (
            db.query(DividendRecord)
            .filter(
                DividendRecord.year == request.year,
                DividendRecord.partner_id == partner.id,
                DividendRecord.is_deleted == 0,
            )
            .first()
        )

        if existing:
            # 기존 기록 업데이트
            existing.annual_net_profit = request.annual_net_profit
            existing.distributable_amount = round(distributable_amount)
            existing.dividend_amount = dividend_amount
            existing.equity_ratio_snapshot = partner.equity_ratio
            existing.partner_name = partner.name
            records.append(existing)
        else:
            # 신규 기록 생성
            record = DividendRecord(
                year=request.year,
                partner_id=partner.id,
                partner_name=partner.name,
                equity_ratio_snapshot=partner.equity_ratio,
                annual_net_profit=request.annual_net_profit,
                distributable_amount=round(distributable_amount),
                dividend_amount=dividend_amount,
                memo=request.memo if hasattr(request, "memo") else None,
            )
            db.add(record)
            records.append(record)

    db.commit()
    for r in records:
        db.refresh(r)
    return records


def update_dividend_record(
    db: Session, record_id: int, data: DividendRecordUpdate
) -> Optional[DividendRecord]:
    """
    배당 기록의 지급 상태(지급 완료/미지급)와 지급일을 수정합니다.
    """
    record = (
        db.query(DividendRecord)
        .filter(DividendRecord.id == record_id, DividendRecord.is_deleted == 0)
        .first()
    )
    if not record:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)

    db.commit()
    db.refresh(record)
    return record


def delete_dividend_records_by_year(db: Session, year: int) -> int:
    """
    특정 연도의 배당 기록 전체를 소프트 삭제합니다.
    삭제된 건수를 반환합니다.
    """
    records = (
        db.query(DividendRecord)
        .filter(DividendRecord.year == year, DividendRecord.is_deleted == 0)
        .all()
    )
    count = len(records)
    for record in records:
        record.is_deleted = 1

    db.commit()
    return count


# ─────────────────────────────────────────
# 법인 비용 서비스
# ─────────────────────────────────────────

def get_corporate_expenses(
    db: Session,
    year: int,
    month: Optional[int] = None,
    category: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> dict:
    """
    법인 비용 목록을 조회합니다.
    연도 필수, 월과 분류는 선택 필터입니다.
    """
    query = db.query(CorporateExpense).filter(
        CorporateExpense.year == year,
        CorporateExpense.is_deleted == 0,
    )

    if month is not None:
        query = query.filter(CorporateExpense.month == month)

    if category:
        query = query.filter(CorporateExpense.category == category)

    total = query.count()
    items = (
        query.order_by(CorporateExpense.expense_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {"total": total, "items": items}


def get_corporate_expense_by_id(
    db: Session, expense_id: int
) -> Optional[CorporateExpense]:
    """법인 비용 단건 조회"""
    return (
        db.query(CorporateExpense)
        .filter(CorporateExpense.id == expense_id, CorporateExpense.is_deleted == 0)
        .first()
    )


def create_corporate_expense(
    db: Session, data: CorporateExpenseCreate
) -> CorporateExpense:
    """
    법인 비용을 새로 등록합니다.
    날짜에서 연도와 월을 자동 추출하여 저장합니다.
    """
    # 날짜에서 연도/월 추출
    parts = data.expense_date.split("-")
    year = int(parts[0])
    month = int(parts[1])

    expense = CorporateExpense(
        **data.model_dump(),
        year=year,
        month=month,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


def update_corporate_expense(
    db: Session, expense_id: int, data: CorporateExpenseUpdate
) -> Optional[CorporateExpense]:
    """법인 비용을 수정합니다."""
    expense = get_corporate_expense_by_id(db, expense_id)
    if not expense:
        return None

    update_data = data.model_dump(exclude_unset=True)

    # 날짜 변경 시 연도/월 자동 재계산
    if "expense_date" in update_data:
        parts = update_data["expense_date"].split("-")
        update_data["year"] = int(parts[0])
        update_data["month"] = int(parts[1])

    for key, value in update_data.items():
        setattr(expense, key, value)

    db.commit()
    db.refresh(expense)
    return expense


def delete_corporate_expense(db: Session, expense_id: int) -> bool:
    """법인 비용을 소프트 삭제합니다."""
    expense = get_corporate_expense_by_id(db, expense_id)
    if not expense:
        return False

    expense.is_deleted = 1
    db.commit()
    return True


# ─────────────────────────────────────────
# 법인 재무 개요 서비스
# ─────────────────────────────────────────

def get_corporate_overview(db: Session, year: int) -> CorporateOverviewResponse:
    """
    연도별 법인 재무 개요를 계산합니다.
    세무/회계 모듈의 매출/지출 데이터와 법인 비용을 종합 집계합니다.
    """
    # 연도 범위 문자열 (YYYY-01-01 ~ YYYY-12-31)
    date_start = f"{year}-01-01"
    date_end = f"{year}-12-31"

    # 연간 매출 집계 (sales_records 테이블)
    revenue_row = (
        db.query(
            func.coalesce(func.sum(SalesRecord.cash_amount), 0).label("cash"),
            func.coalesce(func.sum(SalesRecord.card_amount), 0).label("card"),
            func.coalesce(func.sum(SalesRecord.delivery_amount), 0).label("delivery"),
        )
        .filter(
            SalesRecord.sales_date >= date_start,
            SalesRecord.sales_date <= date_end,
            SalesRecord.is_deleted == 0,
        )
        .first()
    )
    annual_revenue = (revenue_row.cash + revenue_row.card + revenue_row.delivery) if revenue_row else 0.0

    # 연간 매장 운영비 집계 (expense_records 테이블)
    operating_expense = (
        db.query(func.coalesce(func.sum(ExpenseRecord.amount + ExpenseRecord.vat), 0))
        .filter(
            ExpenseRecord.expense_date >= date_start,
            ExpenseRecord.expense_date <= date_end,
            ExpenseRecord.is_deleted == 0,
        )
        .scalar()
    ) or 0.0

    # 연간 법인 비용 집계 (corporate_expenses 테이블)
    corporate_expense = (
        db.query(func.coalesce(func.sum(CorporateExpense.amount), 0))
        .filter(
            CorporateExpense.year == year,
            CorporateExpense.is_deleted == 0,
        )
        .scalar()
    ) or 0.0

    # 법인 비용 카테고리별 집계
    category_rows = (
        db.query(
            CorporateExpense.category,
            func.sum(CorporateExpense.amount).label("total"),
        )
        .filter(CorporateExpense.year == year, CorporateExpense.is_deleted == 0)
        .group_by(CorporateExpense.category)
        .order_by(func.sum(CorporateExpense.amount).desc())
        .all()
    )
    expense_by_category = [
        {"category": row.category, "total": row.total}
        for row in category_rows
    ]

    # 연간 총 지출 및 순이익 계산
    annual_total_expense = operating_expense + corporate_expense
    annual_net_profit = annual_revenue - annual_total_expense
    net_profit_margin = (annual_net_profit / annual_revenue * 100) if annual_revenue > 0 else 0.0

    # 전년 대비 순이익 증감률 계산
    prev_year = year - 1
    prev_date_start = f"{prev_year}-01-01"
    prev_date_end = f"{prev_year}-12-31"

    prev_revenue_row = (
        db.query(
            func.coalesce(func.sum(SalesRecord.cash_amount), 0).label("cash"),
            func.coalesce(func.sum(SalesRecord.card_amount), 0).label("card"),
            func.coalesce(func.sum(SalesRecord.delivery_amount), 0).label("delivery"),
        )
        .filter(
            SalesRecord.sales_date >= prev_date_start,
            SalesRecord.sales_date <= prev_date_end,
            SalesRecord.is_deleted == 0,
        )
        .first()
    )
    prev_annual_revenue = (
        (prev_revenue_row.cash + prev_revenue_row.card + prev_revenue_row.delivery)
        if prev_revenue_row
        else 0.0
    )

    prev_operating_expense = (
        db.query(func.coalesce(func.sum(ExpenseRecord.amount + ExpenseRecord.vat), 0))
        .filter(
            ExpenseRecord.expense_date >= prev_date_start,
            ExpenseRecord.expense_date <= prev_date_end,
            ExpenseRecord.is_deleted == 0,
        )
        .scalar()
    ) or 0.0

    prev_corporate_expense = (
        db.query(func.coalesce(func.sum(CorporateExpense.amount), 0))
        .filter(
            CorporateExpense.year == prev_year,
            CorporateExpense.is_deleted == 0,
        )
        .scalar()
    ) or 0.0

    prev_net_profit = prev_annual_revenue - prev_operating_expense - prev_corporate_expense
    yoy_profit_growth = None
    if prev_net_profit != 0:
        yoy_profit_growth = round(
            (annual_net_profit - prev_net_profit) / abs(prev_net_profit) * 100, 1
        )

    # 파트너별 예상 배당금 계산 (100% 배당 가정)
    partners = get_all_partners(db)
    partner_dividends = []
    for partner in partners:
        dividend_amount = round(annual_net_profit * (partner.equity_ratio / 100.0)) if annual_net_profit > 0 else 0
        partner_dividends.append(DividendSimulationItem(
            partner_id=partner.id,
            partner_name=partner.name,
            equity_ratio=partner.equity_ratio,
            dividend_amount=dividend_amount,
        ))

    return CorporateOverviewResponse(
        year=year,
        annual_revenue=round(annual_revenue),
        annual_operating_expense=round(operating_expense),
        annual_corporate_expense=round(corporate_expense),
        annual_total_expense=round(annual_total_expense),
        annual_net_profit=round(annual_net_profit),
        net_profit_margin=round(net_profit_margin, 1),
        partner_dividends=partner_dividends,
        expense_by_category=expense_by_category,
        yoy_profit_growth=yoy_profit_growth,
    )
