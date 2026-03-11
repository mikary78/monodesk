# ============================================================
# services/corporate_service.py — 법인 관리 비즈니스 로직
# 동업자 관리, 배당 계산, 법인 비용 관리, 재무 개요 집계
# ============================================================

from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import Optional, List
from models.corporate import Partner, DividendRecord, CorporateExpense
from models.accounting import SalesRecord, ExpenseRecord
from models.sales_analysis import PosSalesRaw
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
# 법인세 계산 (법인세법 기준)
# ─────────────────────────────────────────

# 2026년 법인세율 구간 (법인세법 제55조)
# 과세표준 2억 이하: 9%
# 과세표준 2억 초과 ~ 200억 이하: 1,800만원 + (2억 초과분 × 19%)
CORP_TAX_BRACKET_1_LIMIT = 200_000_000       # 2억 원
CORP_TAX_BRACKET_1_RATE = 0.09               # 9%
CORP_TAX_BRACKET_2_RATE = 0.19               # 19%
CORP_TAX_BRACKET_1_MAX = 18_000_000          # 2억 × 9% = 1,800만원

# 배당소득세율 (소득세법 제129조)
DIVIDEND_INCOME_TAX_RATE = 0.14              # 배당소득세 14%
DIVIDEND_LOCAL_TAX_RATE = 0.014              # 지방소득세 1.4%
DIVIDEND_WITHHOLDING_RATE = DIVIDEND_INCOME_TAX_RATE + DIVIDEND_LOCAL_TAX_RATE  # 합계 15.4%


def _calculate_corporate_tax(taxable_income: float) -> float:
    """
    법인세 자동 계산 (법인세법 제55조, 2026년 기준).
    - 과세표준 2억 이하: 9%
    - 과세표준 2억 초과 ~ 200억 이하: 1,800만원 + (초과분 × 19%)
    음수 소득(손실)의 경우 법인세는 0원.
    """
    if taxable_income <= 0:
        return 0.0

    if taxable_income <= CORP_TAX_BRACKET_1_LIMIT:
        # 과세표준 2억 이하: 전액 9%
        return round(taxable_income * CORP_TAX_BRACKET_1_RATE)
    else:
        # 과세표준 2억 초과: 1,800만원 + 초과분 × 19%
        excess = taxable_income - CORP_TAX_BRACKET_1_LIMIT
        return round(CORP_TAX_BRACKET_1_MAX + excess * CORP_TAX_BRACKET_2_RATE)


# ─────────────────────────────────────────
# 배당 정산 서비스
# ─────────────────────────────────────────

def simulate_dividend(
    db: Session, request: DividendSimulationRequest
) -> DividendSimulationResponse:
    """
    배당 시뮬레이션을 실행합니다.
    법인세 차감 후 세후 순이익 기준으로 배당금을 계산하고,
    배당소득세 원천징수(15.4%)를 반영한 세후 실수령액을 산출합니다.
    DB에 저장하지 않고 계산 결과만 반환합니다.
    """
    partners = get_all_partners(db)
    if not partners:
        raise ValueError("등록된 동업자가 없습니다. 먼저 동업자를 등록해주세요.")

    # 법인세 계산 (#7: 법인세법 반영)
    if request.corporate_tax_mode == "manual" and request.corporate_tax_manual is not None:
        # 세무사 확정 법인세 직접 입력 모드
        corporate_tax = round(request.corporate_tax_manual)
    else:
        # 자동 계산 모드 (법인세법 제55조 누진세율)
        corporate_tax = _calculate_corporate_tax(request.annual_net_profit)

    # 세후 순이익 = 세전 순이익 - 법인세
    after_tax_profit = request.annual_net_profit - corporate_tax

    # 배당 대상 금액 = 세후 순이익 × 배당 비율
    distributable_amount = after_tax_profit * (request.distribution_ratio / 100.0)

    items = []
    total_dividend = 0.0
    total_withholding_tax = 0.0
    total_net_dividend = 0.0

    for partner in partners:
        # 지분율에 따른 세전 배당금 계산
        dividend_amount = round(distributable_amount * (partner.equity_ratio / 100.0))

        # 배당소득세 원천징수 계산 (#8: 소득세법 제129조)
        # 배당소득세 14% + 지방소득세 1.4% = 15.4%
        withholding_tax = round(dividend_amount * DIVIDEND_WITHHOLDING_RATE)

        # 세후 실수령액
        net_dividend = dividend_amount - withholding_tax

        total_dividend += dividend_amount
        total_withholding_tax += withholding_tax
        total_net_dividend += net_dividend

        items.append(DividendSimulationItem(
            partner_id=partner.id,
            partner_name=partner.name,
            equity_ratio=partner.equity_ratio,
            dividend_amount=dividend_amount,
            withholding_tax=withholding_tax,
            net_dividend=net_dividend,
        ))

    return DividendSimulationResponse(
        year=request.year,
        annual_net_profit=request.annual_net_profit,
        corporate_tax=corporate_tax,
        after_tax_profit=round(after_tax_profit),
        distribution_ratio=request.distribution_ratio,
        distributable_amount=round(distributable_amount),
        items=items,
        total_dividend=round(total_dividend),
        total_withholding_tax=round(total_withholding_tax),
        total_net_dividend=round(total_net_dividend),
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
    법인세 차감 후 세후 순이익 기준으로 배당금을 계산하며,
    동일 연도에 이미 배당 기록이 있으면 upsert(업데이트) 방식으로 처리합니다.
    """
    partners = get_all_partners(db)
    if not partners:
        raise ValueError("등록된 동업자가 없습니다.")

    # 법인세 계산 (#7)
    if request.corporate_tax_mode == "manual" and request.corporate_tax_manual is not None:
        corporate_tax = round(request.corporate_tax_manual)
    else:
        corporate_tax = _calculate_corporate_tax(request.annual_net_profit)

    # 세후 순이익 기준 배당 대상 금액 계산
    after_tax_profit = request.annual_net_profit - corporate_tax
    distributable_amount = after_tax_profit * (request.distribution_ratio / 100.0)

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
    # 연도 범위 문자열 (YYYY-01-01 ~ 다음 해 첫날 미만)
    date_start = f"{year}-01-01"
    date_end_exclusive = f"{year + 1}-01-01"  # end_date < 조건용 (12-31 포함)

    # 연간 매출 집계 — 수동 입력(is_pos_synced=0) + POS 원본(PosSalesRaw) 합산
    # 이중 계산 방지: is_pos_synced==1 은 POS 연동 확정 기록으로 PosSalesRaw와 중복이므로 제외
    manual_revenue_row = (
        db.query(
            func.coalesce(func.sum(SalesRecord.cash_amount), 0).label("cash"),
            func.coalesce(func.sum(SalesRecord.card_amount), 0).label("card"),
            func.coalesce(func.sum(SalesRecord.delivery_amount), 0).label("delivery"),
        )
        .filter(
            SalesRecord.sales_date >= date_start,
            SalesRecord.sales_date < date_end_exclusive,
            SalesRecord.is_deleted == 0,
            SalesRecord.is_pos_synced == 0,
        )
        .first()
    )
    manual_revenue = (
        (manual_revenue_row.cash + manual_revenue_row.card + manual_revenue_row.delivery)
        if manual_revenue_row
        else 0.0
    )

    # POS 원본 연간 매출 집계 (취소 제외)
    pos_revenue_result = (
        db.query(func.coalesce(func.sum(PosSalesRaw.total_price), 0).label("pos_total"))
        .filter(
            PosSalesRaw.sale_date >= date_start,
            PosSalesRaw.sale_date < date_end_exclusive,
            PosSalesRaw.is_deleted == 0,
            PosSalesRaw.is_cancelled == False,
        )
        .first()
    )
    pos_revenue = float(pos_revenue_result.pos_total or 0)

    annual_revenue = manual_revenue + pos_revenue

    # 연간 매장 운영비 집계 (expense_records 테이블)
    operating_expense = (
        db.query(func.coalesce(func.sum(ExpenseRecord.amount + ExpenseRecord.vat), 0))
        .filter(
            ExpenseRecord.expense_date >= date_start,
            ExpenseRecord.expense_date < date_end_exclusive,
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
    prev_date_end_exclusive = f"{year}-01-01"  # 전년 12월 31일 포함을 위한 미만 조건

    # 전년 수동 입력 매출 집계 (is_pos_synced=0 만 포함)
    prev_manual_revenue_row = (
        db.query(
            func.coalesce(func.sum(SalesRecord.cash_amount), 0).label("cash"),
            func.coalesce(func.sum(SalesRecord.card_amount), 0).label("card"),
            func.coalesce(func.sum(SalesRecord.delivery_amount), 0).label("delivery"),
        )
        .filter(
            SalesRecord.sales_date >= prev_date_start,
            SalesRecord.sales_date < prev_date_end_exclusive,
            SalesRecord.is_deleted == 0,
            SalesRecord.is_pos_synced == 0,
        )
        .first()
    )
    prev_manual_revenue = (
        (prev_manual_revenue_row.cash + prev_manual_revenue_row.card + prev_manual_revenue_row.delivery)
        if prev_manual_revenue_row
        else 0.0
    )

    # 전년 POS 원본 매출 집계 (취소 제외)
    prev_pos_revenue_result = (
        db.query(func.coalesce(func.sum(PosSalesRaw.total_price), 0).label("pos_total"))
        .filter(
            PosSalesRaw.sale_date >= prev_date_start,
            PosSalesRaw.sale_date < prev_date_end_exclusive,
            PosSalesRaw.is_deleted == 0,
            PosSalesRaw.is_cancelled == False,
        )
        .first()
    )
    prev_pos_revenue = float(prev_pos_revenue_result.pos_total or 0)

    prev_annual_revenue = prev_manual_revenue + prev_pos_revenue

    prev_operating_expense = (
        db.query(func.coalesce(func.sum(ExpenseRecord.amount + ExpenseRecord.vat), 0))
        .filter(
            ExpenseRecord.expense_date >= prev_date_start,
            ExpenseRecord.expense_date < prev_date_end_exclusive,
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

    # 파트너별 예상 배당금 계산 (100% 배당 가정, 법인세·배당소득세 반영)
    partners = get_all_partners(db)
    partner_dividends = []
    if annual_net_profit > 0:
        # 법인세 자동 계산 후 세후 순이익 기준 배당
        overview_corporate_tax = _calculate_corporate_tax(annual_net_profit)
        overview_after_tax_profit = annual_net_profit - overview_corporate_tax
    else:
        overview_after_tax_profit = 0.0

    for partner in partners:
        # 세전 배당금 (세후 순이익 × 지분율)
        dividend_amount = round(overview_after_tax_profit * (partner.equity_ratio / 100.0)) if overview_after_tax_profit > 0 else 0
        # 배당소득세 원천징수 (15.4%)
        withholding_tax = round(dividend_amount * DIVIDEND_WITHHOLDING_RATE)
        net_dividend = dividend_amount - withholding_tax
        partner_dividends.append(DividendSimulationItem(
            partner_id=partner.id,
            partner_name=partner.name,
            equity_ratio=partner.equity_ratio,
            dividend_amount=dividend_amount,
            withholding_tax=withholding_tax,
            net_dividend=net_dividend,
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
