# ============================================================
# services/accounting_service.py — 세무/회계 비즈니스 로직
# 지출/매출 CRUD, 손익 계산, 월별 리포트 생성을 담당합니다.
# ============================================================

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, distinct
from typing import List, Optional
from models.accounting import ExpenseCategory, ExpenseRecord, ExpenseItem, SalesRecord
from models.operations import Vendor
from models.sales_analysis import PosSalesRaw
from schemas.accounting import (
    ExpenseCategoryCreate, ExpenseCategoryUpdate,
    ExpenseRecordCreate, ExpenseRecordUpdate,
    SalesRecordCreate, SalesRecordUpdate, ProfitLossResponse,
    VendorStatItem, ExpenseItemCreate
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


def _sync_vendor(db: Session, vendor_name: Optional[str], category_name: Optional[str]) -> None:
    """
    vendors 테이블 자동 연동 내부 유틸.
    지출 저장 시 거래처명이 있고 vendors 테이블에 미등록된 경우 자동으로 신규 등록합니다.

    - 이미 등록된 거래처는 업데이트하지 않습니다.
    - 오류 발생 시 조용히 무시합니다 (지출 저장은 계속 진행).

    지출 분류명 → vendors 카테고리 매핑 규칙:
      식재료비 → 식자재
      주류비   → 주류
      소모품비 → 소모품
      인건비   → 인건비
      그 외    → 기타
    """
    # 거래처명이 없으면 연동 대상이 아님
    if not vendor_name or not vendor_name.strip():
        return

    try:
        # 지출 분류명 → 거래처 카테고리 변환 맵
        category_map = {
            "식재료비": "식자재",
            "주류비":   "주류",
            "소모품비": "소모품",
            "인건비":   "인건비",
        }
        vendor_category = category_map.get(category_name or "", "기타")

        # vendors 테이블에서 동일 이름의 활성 거래처 검색
        existing = db.query(Vendor).filter(
            Vendor.name == vendor_name.strip(),
            Vendor.is_deleted == 0
        ).first()

        # 이미 등록된 거래처는 스킵 (업데이트 안 함)
        if existing:
            return

        # 미등록 거래처 → 자동 생성
        new_vendor = Vendor(
            name=vendor_name.strip(),
            category=vendor_category,
        )
        db.add(new_vendor)
        db.flush()  # commit 전에 ID 확보 (부모 트랜잭션에 합류)

    except Exception as e:
        # 거래처 연동 실패가 지출 저장을 막아서는 안 됨
        print(f"[vendors 자동 연동 무시] {vendor_name}: {e}")


def create_expense(db: Session, data: ExpenseRecordCreate) -> ExpenseRecord:
    """
    새 지출 기록 생성.
    거래처명이 있으면 vendors 테이블에 자동 연동을 시도합니다.
    구매 품목(items)이 있으면 expense_items 테이블에 저장합니다.
    """
    # items 필드를 분리하여 ExpenseRecord 모델 생성에서 제외
    items_data = data.items
    expense_dict = data.model_dump(exclude={"items"})
    expense = ExpenseRecord(**expense_dict)
    db.add(expense)
    db.flush()  # expense.id 확보 (commit 전)

    # 구매 품목 저장
    for item in items_data:
        db_item = ExpenseItem(expense_id=expense.id, **item.model_dump())
        db.add(db_item)

    # 거래처명이 있으면 분류명을 조회하여 vendors 자동 등록 시도
    if expense.vendor:
        try:
            category = db.query(ExpenseCategory).filter(
                ExpenseCategory.id == expense.category_id,
                ExpenseCategory.is_deleted == 0
            ).first()
            category_name = category.name if category else None
            _sync_vendor(db, expense.vendor, category_name)
        except Exception as e:
            print(f"[vendors 연동 오류 무시] create_expense: {e}")

    db.commit()
    db.refresh(expense)
    return expense


def update_expense(db: Session, expense_id: int, data: ExpenseRecordUpdate) -> Optional[ExpenseRecord]:
    """
    지출 기록 수정.
    거래처명이 변경된 경우 vendors 테이블 자동 연동을 시도합니다.
    items가 전달된 경우 기존 품목을 삭제하고 새 품목으로 교체합니다.
    """
    expense = get_expense_by_id(db, expense_id)
    if not expense:
        return None
    update_data = data.model_dump(exclude_unset=True)

    # items 분리 (ExpenseRecord 컬럼이 아님)
    items_data = update_data.pop("items", None)

    for key, value in update_data.items():
        setattr(expense, key, value)

    # items가 전달된 경우 기존 품목 삭제 후 새로 저장
    if items_data is not None:
        db.query(ExpenseItem).filter(ExpenseItem.expense_id == expense_id).delete()
        for item in items_data:
            db_item = ExpenseItem(expense_id=expense_id, **item)
            db.add(db_item)

    # 거래처명이 수정된 경우 vendors 자동 연동 시도
    if "vendor" in update_data and update_data["vendor"]:
        try:
            cat_id = update_data.get("category_id", expense.category_id)
            category = db.query(ExpenseCategory).filter(
                ExpenseCategory.id == cat_id,
                ExpenseCategory.is_deleted == 0
            ).first()
            category_name = category.name if category else None
            _sync_vendor(db, update_data["vendor"], category_name)
        except Exception as e:
            print(f"[vendors 연동 오류 무시] update_expense: {e}")

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


def get_item_name_suggestions(db: Session, q: str = "") -> List[str]:
    """
    품목명 자동완성 제안 목록 조회.
    기존 expense_items에서 유니크한 품목명을 추출합니다.
    """
    query = db.query(distinct(ExpenseItem.item_name)).filter(
        ExpenseItem.item_name.isnot(None),
        ExpenseItem.item_name != ""
    )
    if q:
        query = query.filter(ExpenseItem.item_name.ilike(f"%{q}%"))
    results = query.order_by(ExpenseItem.item_name).limit(30).all()
    return [row[0] for row in results]


def get_vendor_stats(
    db: Session,
    year: int,
    month: Optional[int] = None
) -> List[VendorStatItem]:
    """
    거래처별 지출 통계 집계.

    - expense_records를 vendor로 GROUP BY하여 구매 횟수, 총 금액, 최근 구매일을 집계합니다.
    - LEFT JOIN vendors ON name 매칭으로 vendors 테이블 등록 여부를 확인합니다.
    - vendor가 None 또는 빈 문자열인 레코드는 "미입력"으로 묶어 맨 아래에 배치합니다.
    - total_amount DESC 정렬, 단 "미입력"은 항상 맨 뒤.

    @param year  - 조회 연도 (필수)
    @param month - 조회 월 (None이면 해당 연도 전체)
    @return List[VendorStatItem]
    """
    # ── 날짜 범위 계산 ──────────────────────────────────────────
    if month:
        # 특정 월만 조회
        start_date = f"{year}-{month:02d}-01"
        end_date = f"{year}-{month + 1:02d}-01" if month < 12 else f"{year + 1}-01-01"
    else:
        # 연도 전체 조회
        start_date = f"{year}-01-01"
        end_date = f"{year + 1}-01-01"

    # ── 거래처별 집계 쿼리 ─────────────────────────────────────
    # coalesce로 vendor가 NULL이면 빈 문자열로 치환하여 그룹 처리
    vendor_col = func.coalesce(ExpenseRecord.vendor, "").label("vendor_key")

    rows = db.query(
        vendor_col,
        func.count(ExpenseRecord.id).label("purchase_count"),
        # amount + vat = 총 지출금액
        func.sum(ExpenseRecord.amount + func.coalesce(ExpenseRecord.vat, 0)).label("total_amount"),
        func.max(ExpenseRecord.expense_date).label("last_purchase_date"),
    ).filter(
        ExpenseRecord.is_deleted == 0,
        ExpenseRecord.expense_date >= start_date,
        ExpenseRecord.expense_date < end_date,
    ).group_by(
        vendor_col
    ).all()

    # ── 카테고리명 목록 조회 (거래처별) ───────────────────────
    # 거래처별로 사용한 분류명을 별도 쿼리로 조회합니다.
    # (GROUP_CONCAT은 SQLite에서 지원되지만 SQLAlchemy ORM이 아닌 raw로 처리하면 간단하나,
    #  ORM 방식으로 개별 조회하여 호환성을 유지합니다.)
    from sqlalchemy import text as sa_text
    category_rows = db.execute(sa_text("""
        SELECT
            COALESCE(er.vendor, '') AS vendor_key,
            ec.name                 AS cat_name
        FROM expense_records er
        LEFT JOIN expense_categories ec ON ec.id = er.category_id AND ec.is_deleted = 0
        WHERE er.is_deleted = 0
          AND er.expense_date >= :start_date
          AND er.expense_date < :end_date
        GROUP BY COALESCE(er.vendor, ''), ec.name
    """), {"start_date": start_date, "end_date": end_date}).fetchall()

    # 거래처명 → 분류명 목록 딕셔너리로 변환
    cat_map: dict[str, List[str]] = {}
    for cat_row in category_rows:
        vkey = cat_row[0]  # vendor_key
        cname = cat_row[1]  # cat_name (NULL 가능)
        if vkey not in cat_map:
            cat_map[vkey] = []
        if cname and cname not in cat_map[vkey]:
            cat_map[vkey].append(cname)

    # ── vendors 테이블 매칭 ────────────────────────────────────
    # 활성 거래처 전체를 한 번에 조회하여 이름 → ID 매핑 딕셔너리 생성
    vendor_records = db.query(Vendor).filter(Vendor.is_deleted == 0).all()
    vendor_id_map: dict[str, int] = {v.name: v.id for v in vendor_records}

    # ── 결과 조립 ─────────────────────────────────────────────
    normal_items: List[VendorStatItem] = []   # 거래처명이 있는 항목
    unknown_item: Optional[VendorStatItem] = None  # "미입력" 항목

    for row in rows:
        vendor_key = row.vendor_key  # "" 또는 거래처명
        vendor_name = vendor_key if vendor_key else "미입력"
        categories = cat_map.get(vendor_key, [])
        vid = vendor_id_map.get(vendor_key) if vendor_key else None

        item = VendorStatItem(
            vendor_name=vendor_name,
            purchase_count=row.purchase_count,
            total_amount=float(row.total_amount or 0),
            last_purchase_date=row.last_purchase_date or "",
            categories=categories,
            vendor_id=vid,
        )

        if vendor_key == "":
            # 거래처 미입력 항목은 별도 보관하여 맨 뒤에 배치
            unknown_item = item
        else:
            normal_items.append(item)

    # 금액 기준 내림차순 정렬
    normal_items.sort(key=lambda x: x.total_amount, reverse=True)

    # "미입력" 항목을 맨 뒤에 추가
    if unknown_item:
        normal_items.append(unknown_item)

    return normal_items


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

def _get_combined_sales(db: Session, start_date: str, end_date: str) -> dict:
    """
    이중 저장 구조를 고려한 매출 합산 내부 유틸.

    데이터 소스:
    1. SalesRecord (수동 입력): is_pos_synced == 0 인 레코드만 포함
       - is_pos_synced == 1 은 POS 연동 확정 기록이므로 중복 방지를 위해 제외
    2. PosSalesRaw (POS CSV 원본): 취소되지 않은 레코드의 total_price 합산

    두 소스를 합산하여 전체 매출로 반환합니다.
    """
    # 수동 입력 매출 (is_pos_synced == 0 만 포함)
    manual_result = db.query(
        func.coalesce(func.sum(SalesRecord.cash_amount), 0).label("cash"),
        func.coalesce(func.sum(SalesRecord.card_amount), 0).label("card"),
        func.coalesce(func.sum(SalesRecord.delivery_amount), 0).label("delivery"),
    ).filter(
        SalesRecord.is_deleted == 0,
        SalesRecord.is_pos_synced == 0,
        SalesRecord.sales_date >= start_date,
        SalesRecord.sales_date < end_date
    ).first()

    manual_cash = float(manual_result.cash or 0)
    manual_card = float(manual_result.card or 0)
    manual_delivery = float(manual_result.delivery or 0)
    manual_total = manual_cash + manual_card + manual_delivery

    # POS 원본 매출 집계 (취소 제외)
    pos_result = db.query(
        func.coalesce(func.sum(PosSalesRaw.total_price), 0).label("pos_total")
    ).filter(
        PosSalesRaw.is_deleted == 0,
        PosSalesRaw.is_cancelled == False,
        PosSalesRaw.sale_date >= start_date,
        PosSalesRaw.sale_date < end_date
    ).first()

    pos_total = float(pos_result.pos_total or 0)

    return {
        "cash": manual_cash,
        "card": manual_card,
        "delivery": manual_delivery,
        "manual_total": manual_total,
        "pos_total": pos_total,
        "total": manual_total + pos_total,
    }


def calculate_profit_loss(db: Session, year: int, month: int) -> ProfitLossResponse:
    """
    월별 손익 계산.
    수동 입력 매출(SalesRecord, is_pos_synced=0)과 POS 원본 매출(PosSalesRaw)을
    합산하여 이중 계산 없이 전체 매출을 집계합니다.
    """
    # 날짜 범위 설정
    start_date = f"{year}-{month:02d}-01"
    end_date = f"{year}-{month + 1:02d}-01" if month < 12 else f"{year + 1}-01-01"

    # 수동 입력 + POS 원본 합산 매출 집계
    sales_data = _get_combined_sales(db, start_date, end_date)

    cash_sales = sales_data["cash"]
    card_sales = sales_data["card"]
    delivery_sales = sales_data["delivery"]
    total_sales = sales_data["total"]

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

    # 고정비 실제지출 합계 (fixed_cost_records) 연동
    from services.operations_service import get_fixed_cost_actual_total
    total_fixed_cost = float(get_fixed_cost_actual_total(db, year, month))
    total_combined_expense = total_expense + total_fixed_cost

    # 손익 계산 (변동비 + 고정비 합산)
    gross_profit = total_sales - total_combined_expense
    profit_margin = (gross_profit / total_sales * 100) if total_sales > 0 else 0

    # 전월 매출 조회 (증감률 계산용 — 동일하게 수동+POS 합산)
    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    prev_start = f"{prev_year}-{prev_month:02d}-01"
    prev_end = f"{year}-{month:02d}-01"

    prev_sales_data = _get_combined_sales(db, prev_start, prev_end)
    prev_month_sales = prev_sales_data["total"]
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
        total_fixed_cost=total_fixed_cost,
        total_combined_expense=total_combined_expense,
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
