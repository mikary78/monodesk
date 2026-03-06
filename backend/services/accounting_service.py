# ============================================================
# services/accounting_service.py — 세무/회계 비즈니스 로직
# 지출/매출 CRUD, 손익 계산, 월별 리포트 생성을 담당합니다.
# ============================================================

from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
from models.accounting import ExpenseCategory, ExpenseRecord, SalesRecord
from schemas.accounting import (
    ExpenseCategoryCreate, ExpenseCategoryUpdate,
    ExpenseRecordCreate, ExpenseRecordUpdate,
    SalesRecordCreate, SalesRecordUpdate, ProfitLossResponse
)


# ─────────────────────────────────────────
# 지출 분류 서비스
# ─────────────────────────────────────────

def get_all_categories(db: Session) -> List[ExpenseCategory]:
    """삭제되지 않은 모든 지출 분류 목록 조회"""
    return db.query(ExpenseCategory).filter(
        ExpenseCategory.is_deleted == 0
    ).order_by(ExpenseCategory.id).all()


def create_category(db: Session, data: ExpenseCategoryCreate) -> ExpenseCategory:
    """새 지출 분류 생성"""
    category = ExpenseCategory(**data.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update_category(db: Session, category_id: int, data: ExpenseCategoryUpdate) -> Optional[ExpenseCategory]:
    """지출 분류 정보 수정"""
    category = db.query(ExpenseCategory).filter(
        ExpenseCategory.id == category_id,
        ExpenseCategory.is_deleted == 0
    ).first()
    if not category:
        return None
    # None이 아닌 값만 업데이트
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(category, key, value)
    db.commit()
    db.refresh(category)
    return category


def delete_category(db: Session, category_id: int) -> bool:
    """지출 분류 소프트 삭제"""
    category = db.query(ExpenseCategory).filter(
        ExpenseCategory.id == category_id,
        ExpenseCategory.is_deleted == 0
    ).first()
    if not category:
        return False
    category.is_deleted = 1
    db.commit()
    return True


# ─────────────────────────────────────────
# 지출 기록 서비스
# ─────────────────────────────────────────

def get_expense_list(
    db: Session,
    year: int,
    month: int,
    category_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50
) -> dict:
    """
    월별 지출 목록 조회.
    카테고리 필터링 및 페이지네이션을 지원합니다.
    """
    # 해당 월의 날짜 범위 계산
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"

    query = db.query(ExpenseRecord).filter(
        ExpenseRecord.is_deleted == 0,
        ExpenseRecord.expense_date >= start_date,
        ExpenseRecord.expense_date < end_date
    )

    # 카테고리 필터 적용
    if category_id:
        query = query.filter(ExpenseRecord.category_id == category_id)

    total = query.count()
    records = query.order_by(
        ExpenseRecord.expense_date.desc()
    ).offset(skip).limit(limit).all()

    return {"total": total, "items": records}


def get_expense_by_id(db: Session, expense_id: int) -> Optional[ExpenseRecord]:
    """ID로 지출 기록 단건 조회"""
    return db.query(ExpenseRecord).filter(
        ExpenseRecord.id == expense_id,
        ExpenseRecord.is_deleted == 0
    ).first()


def create_expense(db: Session, data: ExpenseRecordCreate) -> ExpenseRecord:
    """새 지출 기록 생성"""
    expense = ExpenseRecord(**data.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


def update_expense(db: Session, expense_id: int, data: ExpenseRecordUpdate) -> Optional[ExpenseRecord]:
    """지출 기록 수정"""
    expense = get_expense_by_id(db, expense_id)
    if not expense:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(expense, key, value)
    db.commit()
    db.refresh(expense)
    return expense


def delete_expense(db: Session, expense_id: int) -> bool:
    """지출 기록 소프트 삭제"""
    expense = get_expense_by_id(db, expense_id)
    if not expense:
        return False
    expense.is_deleted = 1
    db.commit()
    return True


# ─────────────────────────────────────────
# 매출 기록 서비스
# ─────────────────────────────────────────

def get_sales_by_month(db: Session, year: int, month: int) -> List[SalesRecord]:
    """월별 매출 기록 전체 조회"""
    start_date = f"{year}-{month:02d}-01"
    end_date = f"{year}-{month + 1:02d}-01" if month < 12 else f"{year + 1}-01-01"
    return db.query(SalesRecord).filter(
        SalesRecord.is_deleted == 0,
        SalesRecord.sales_date >= start_date,
        SalesRecord.sales_date < end_date
    ).order_by(SalesRecord.sales_date.desc()).all()


def create_sales(db: Session, data: SalesRecordCreate) -> SalesRecord:
    """매출 기록 생성"""
    sales = SalesRecord(**data.model_dump())
    db.add(sales)
    db.commit()
    db.refresh(sales)
    return sales


def update_sales(db: Session, sales_id: int, data: SalesRecordUpdate) -> Optional[SalesRecord]:
    """매출 기록 수정 (부분 수정)"""
    sales = db.query(SalesRecord).filter(
        SalesRecord.id == sales_id,
        SalesRecord.is_deleted == 0
    ).first()
    if not sales:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(sales, key, value)
    db.commit()
    db.refresh(sales)
    return sales


def delete_sales(db: Session, sales_id: int) -> bool:
    """매출 기록 소프트 삭제"""
    sales = db.query(SalesRecord).filter(
        SalesRecord.id == sales_id,
        SalesRecord.is_deleted == 0
    ).first()
    if not sales:
        return False
    sales.is_deleted = 1
    db.commit()
    return True


# ─────────────────────────────────────────
# 손익 계산 서비스
# ─────────────────────────────────────────

def calculate_profit_loss(db: Session, year: int, month: int) -> ProfitLossResponse:
    """
    월별 손익 계산.
    매출에서 총 지출을 빼서 순이익과 이익률을 계산합니다.
    """
    # 날짜 범위 설정
    start_date = f"{year}-{month:02d}-01"
    end_date = f"{year}-{month + 1:02d}-01" if month < 12 else f"{year + 1}-01-01"

    # 매출 합계 집계
    sales_result = db.query(
        func.coalesce(func.sum(SalesRecord.cash_amount), 0).label("cash"),
        func.coalesce(func.sum(SalesRecord.card_amount), 0).label("card"),
        func.coalesce(func.sum(SalesRecord.delivery_amount), 0).label("delivery"),
    ).filter(
        SalesRecord.is_deleted == 0,
        SalesRecord.sales_date >= start_date,
        SalesRecord.sales_date < end_date
    ).first()

    cash_sales = float(sales_result.cash or 0)
    card_sales = float(sales_result.card or 0)
    delivery_sales = float(sales_result.delivery or 0)
    total_sales = cash_sales + card_sales + delivery_sales

    # 지출 카테고리별 집계
    expense_by_category = db.query(
        ExpenseCategory.name.label("category_name"),
        ExpenseCategory.color.label("category_color"),
        func.coalesce(func.sum(ExpenseRecord.amount + ExpenseRecord.vat), 0).label("total")
    ).join(
        ExpenseRecord,
        and_(
            ExpenseRecord.category_id == ExpenseCategory.id,
            ExpenseRecord.is_deleted == 0,
            ExpenseRecord.expense_date >= start_date,
            ExpenseRecord.expense_date < end_date
        ),
        isouter=True
    ).filter(
        ExpenseCategory.is_deleted == 0
    ).group_by(ExpenseCategory.id).all()

    # 지출 카테고리별 데이터 포맷
    expense_categories = [
        {
            "category_name": row.category_name,
            "category_color": row.category_color,
            "total": float(row.total or 0)
        }
        for row in expense_by_category
    ]
    total_expense = sum(item["total"] for item in expense_categories)

    # 손익 계산
    gross_profit = total_sales - total_expense
    profit_margin = (gross_profit / total_sales * 100) if total_sales > 0 else 0

    # 전월 매출 조회 (증감률 계산용)
    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    prev_start = f"{prev_year}-{prev_month:02d}-01"
    prev_end = f"{year}-{month:02d}-01"

    prev_sales_result = db.query(
        func.coalesce(func.sum(
            SalesRecord.cash_amount + SalesRecord.card_amount + SalesRecord.delivery_amount
        ), 0).label("total")
    ).filter(
        SalesRecord.is_deleted == 0,
        SalesRecord.sales_date >= prev_start,
        SalesRecord.sales_date < prev_end
    ).first()

    prev_month_sales = float(prev_sales_result.total or 0)
    sales_growth_rate = None
    if prev_month_sales > 0:
        sales_growth_rate = ((total_sales - prev_month_sales) / prev_month_sales) * 100

    # 원가율 계산: 식재료비 ÷ 매출 × 100
    food_cost = next(
        (item["total"] for item in expense_categories if item["category_name"] == "식재료비"),
        0
    )
    cost_ratio = round((food_cost / total_sales * 100), 1) if total_sales > 0 else None

    return ProfitLossResponse(
        year=year,
        month=month,
        total_sales=total_sales,
        cash_sales=cash_sales,
        card_sales=card_sales,
        delivery_sales=delivery_sales,
        total_expense=total_expense,
        expense_by_category=expense_categories,
        gross_profit=gross_profit,
        profit_margin=round(profit_margin, 1),
        cost_ratio=cost_ratio,
        prev_month_sales=prev_month_sales,
        sales_growth_rate=round(sales_growth_rate, 1) if sales_growth_rate is not None else None
    )


def seed_default_categories(db: Session) -> None:
    """
    기본 지출 분류 데이터 초기 생성.
    앱 최초 실행 시 호출합니다.
    """
    default_categories = [
        {"name": "식재료비", "description": "수산물, 채소, 주류 등 원재료", "color": "#3B82F6"},
        {"name": "인건비", "description": "직원 급여 및 4대보험", "color": "#8B5CF6"},
        {"name": "임대료", "description": "가게 월세 및 관리비", "color": "#F59E0B"},
        {"name": "수도/광열비", "description": "전기, 가스, 수도요금", "color": "#06B6D4"},
        {"name": "소모품비", "description": "포장재, 용기, 청소용품 등", "color": "#10B981"},
        {"name": "마케팅비", "description": "배달앱 광고, SNS 홍보 등", "color": "#EF4444"},
        {"name": "기타", "description": "위 분류에 해당하지 않는 지출", "color": "#64748B"},
    ]
    existing = db.query(ExpenseCategory).count()
    if existing == 0:
        for cat_data in default_categories:
            db.add(ExpenseCategory(**cat_data))
        db.commit()
