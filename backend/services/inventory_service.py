# ============================================================
# services/inventory_service.py — 재고/발주 비즈니스 로직
# 재고 품목 CRUD, 수량 조정, 발주서 관리, 입고 처리를 담당합니다.
# ============================================================

from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from models.inventory import (
    InventoryCategory, InventoryItem,
    InventoryAdjustment, PurchaseOrder, PurchaseOrderItem,
    DailyPriceRecord
)
from schemas.inventory import (
    InventoryCategoryCreate, InventoryCategoryUpdate,
    InventoryItemCreate, InventoryItemUpdate,
    InventoryAdjustmentCreate,
    PurchaseOrderCreate, PurchaseOrderUpdate,
    ReceiveOrderRequest, InventorySummaryResponse,
    DailyPriceRecordCreate
)


# ─────────────────────────────────────────
# 재고 분류 서비스
# ─────────────────────────────────────────

def get_all_categories(db: Session) -> List[InventoryCategory]:
    """삭제되지 않은 모든 재고 분류 목록 조회"""
    return db.query(InventoryCategory).filter(
        InventoryCategory.is_deleted == 0
    ).order_by(InventoryCategory.id).all()


def create_category(db: Session, data: InventoryCategoryCreate) -> InventoryCategory:
    """새 재고 분류 생성"""
    category = InventoryCategory(**data.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update_category(
    db: Session, category_id: int, data: InventoryCategoryUpdate
) -> Optional[InventoryCategory]:
    """재고 분류 정보 수정"""
    category = db.query(InventoryCategory).filter(
        InventoryCategory.id == category_id,
        InventoryCategory.is_deleted == 0
    ).first()
    if not category:
        return None
    # None이 아닌 값만 업데이트
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    db.commit()
    db.refresh(category)
    return category


def delete_category(db: Session, category_id: int) -> bool:
    """재고 분류 소프트 삭제"""
    category = db.query(InventoryCategory).filter(
        InventoryCategory.id == category_id,
        InventoryCategory.is_deleted == 0
    ).first()
    if not category:
        return False
    category.is_deleted = 1
    db.commit()
    return True


# ─────────────────────────────────────────
# 재고 품목 서비스
# ─────────────────────────────────────────

def get_item_list(
    db: Session,
    category_id: Optional[int] = None,
    low_stock_only: bool = False,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> dict:
    """
    재고 품목 목록 조회.
    분류 필터, 재고 부족 필터, 검색어 필터를 지원합니다.
    """
    query = db.query(InventoryItem).filter(InventoryItem.is_deleted == 0)

    # 분류 필터
    if category_id:
        query = query.filter(InventoryItem.category_id == category_id)

    # 재고 부족 필터 (현재 수량 <= 최소 임계값)
    if low_stock_only:
        query = query.filter(InventoryItem.current_quantity <= InventoryItem.min_quantity)

    # 품목명 검색
    if search:
        query = query.filter(InventoryItem.name.like(f"%{search}%"))

    total = query.count()
    items = query.order_by(
        # 재고 부족 품목 우선 정렬
        InventoryItem.current_quantity.asc(),
        InventoryItem.name.asc()
    ).offset(skip).limit(limit).all()

    return {"total": total, "items": items}


def get_item_by_id(db: Session, item_id: int) -> Optional[InventoryItem]:
    """ID로 재고 품목 단건 조회"""
    return db.query(InventoryItem).filter(
        InventoryItem.id == item_id,
        InventoryItem.is_deleted == 0
    ).first()


def create_item(db: Session, data: InventoryItemCreate) -> InventoryItem:
    """
    새 재고 품목 생성.
    초기 수량이 있는 경우 입고 이력도 함께 생성합니다.
    """
    item_data = data.model_dump()
    initial_quantity = item_data.get("current_quantity", 0)

    item = InventoryItem(**item_data)
    db.add(item)
    db.flush()  # ID 할당을 위해 flush

    # 초기 수량이 0보다 크면 초기입고 이력 생성
    if initial_quantity > 0:
        adjustment = InventoryAdjustment(
            item_id=item.id,
            adjustment_type="입고",
            quantity_change=initial_quantity,
            quantity_before=0,
            quantity_after=initial_quantity,
            adjustment_date=datetime.now().strftime("%Y-%m-%d"),
            unit_price=item.unit_price,
            memo="초기 재고 등록"
        )
        db.add(adjustment)

    db.commit()
    db.refresh(item)
    return item


def update_item(
    db: Session, item_id: int, data: InventoryItemUpdate
) -> Optional[InventoryItem]:
    """재고 품목 기본 정보 수정 (수량 제외)"""
    item = get_item_by_id(db, item_id)
    if not item:
        return None
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


def delete_item(db: Session, item_id: int) -> bool:
    """재고 품목 소프트 삭제"""
    item = get_item_by_id(db, item_id)
    if not item:
        return False
    item.is_deleted = 1
    db.commit()
    return True


# ─────────────────────────────────────────
# 재고 수량 조정 서비스
# ─────────────────────────────────────────

def adjust_quantity(
    db: Session, data: InventoryAdjustmentCreate
) -> InventoryAdjustment:
    """
    재고 수량 조정 처리.
    - 입고: 현재 수량 증가 (quantity_change 만큼 증감)
    - 출고/폐기: 현재 수량 감소 (quantity_change 만큼 증감)
    - 실사조정: 목표 수량을 절대값으로 설정 (quantity_change = 최종 재고 목표치)
      예) 현재 재고 10개 → 실사 결과 7개면 quantity_change=7 입력 → 재고 7개로 확정
    """
    item = get_item_by_id(db, data.item_id)
    if not item:
        raise ValueError(f"품목 ID {data.item_id}를 찾을 수 없습니다.")

    # 조정 전 수량 기록
    quantity_before = item.current_quantity

    # 조정 유형에 따른 수량 계산
    if data.adjustment_type == "실사조정":
        # 실사조정: quantity_change를 목표 재고 수량(절대값)으로 설정
        # quantity_change에는 실사 확인 후 확정된 수량을 직접 입력
        new_quantity = data.quantity_change
    else:
        # 입고/출고/폐기: 현재 수량에서 증감
        new_quantity = quantity_before + data.quantity_change

    # 음수 재고 방지
    if new_quantity < 0:
        raise ValueError(
            f"재고가 부족합니다. 현재 재고: {quantity_before} {item.unit}, "
            f"요청 수량: {abs(data.quantity_change)} {item.unit}"
        )

    # 품목 수량 업데이트
    item.current_quantity = new_quantity

    # 조정 이력 생성
    adjustment_data = data.model_dump()
    adjustment = InventoryAdjustment(
        **adjustment_data,
        quantity_before=quantity_before,
        quantity_after=new_quantity
    )
    db.add(adjustment)
    db.commit()
    db.refresh(adjustment)
    return adjustment


def get_adjustment_history(
    db: Session,
    item_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    adjustment_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
) -> dict:
    """
    재고 수량 조정 이력 조회.
    품목, 날짜 범위, 조정 유형 필터를 지원합니다.
    """
    query = db.query(InventoryAdjustment).filter(
        InventoryAdjustment.is_deleted == 0
    )

    if item_id:
        query = query.filter(InventoryAdjustment.item_id == item_id)
    if start_date:
        query = query.filter(InventoryAdjustment.adjustment_date >= start_date)
    if end_date:
        query = query.filter(InventoryAdjustment.adjustment_date <= end_date)
    if adjustment_type:
        query = query.filter(InventoryAdjustment.adjustment_type == adjustment_type)

    total = query.count()
    records = query.order_by(
        InventoryAdjustment.adjustment_date.desc(),
        InventoryAdjustment.id.desc()
    ).offset(skip).limit(limit).all()

    return {"total": total, "items": records}


# ─────────────────────────────────────────
# 발주서 서비스
# ─────────────────────────────────────────

def _generate_order_number(db: Session, order_date: str) -> str:
    """
    발주 번호 자동 생성.
    형식: PO-YYYYMMDD-NNN (예: PO-20260306-001)
    """
    date_str = order_date.replace("-", "")
    # 해당 날짜의 발주서 수 카운트
    count = db.query(PurchaseOrder).filter(
        PurchaseOrder.order_date == order_date,
        PurchaseOrder.is_deleted == 0
    ).count()
    return f"PO-{date_str}-{count + 1:03d}"


def get_order_list(
    db: Session,
    status: Optional[str] = None,
    supplier: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
) -> dict:
    """
    발주서 목록 조회.
    상태, 거래처, 날짜 범위 필터를 지원합니다.
    """
    query = db.query(PurchaseOrder).filter(PurchaseOrder.is_deleted == 0)

    if status:
        query = query.filter(PurchaseOrder.status == status)
    if supplier:
        query = query.filter(PurchaseOrder.supplier.like(f"%{supplier}%"))
    if start_date:
        query = query.filter(PurchaseOrder.order_date >= start_date)
    if end_date:
        query = query.filter(PurchaseOrder.order_date <= end_date)

    total = query.count()
    orders = query.order_by(
        PurchaseOrder.order_date.desc(),
        PurchaseOrder.id.desc()
    ).offset(skip).limit(limit).all()

    return {"total": total, "items": orders}


def get_order_by_id(db: Session, order_id: int) -> Optional[PurchaseOrder]:
    """ID로 발주서 단건 조회"""
    return db.query(PurchaseOrder).filter(
        PurchaseOrder.id == order_id,
        PurchaseOrder.is_deleted == 0
    ).first()


def create_order(db: Session, data: PurchaseOrderCreate) -> PurchaseOrder:
    """
    발주서 생성.
    발주 번호를 자동 생성하고, 발주 품목들을 함께 저장합니다.
    """
    # 발주 번호 자동 생성
    order_number = _generate_order_number(db, data.order_date)

    # 발주 품목 소계 합산으로 총 발주 금액 계산
    total_amount = sum(
        item.quantity * item.unit_price
        for item in data.order_items
    )

    # 발주서 생성
    order = PurchaseOrder(
        order_number=order_number,
        supplier=data.supplier,
        order_date=data.order_date,
        expected_date=data.expected_date,
        memo=data.memo,
        status="발주중",
        total_amount=total_amount
    )
    db.add(order)
    db.flush()  # 발주서 ID 확보

    # 발주 품목 생성
    for item_data in data.order_items:
        order_item = PurchaseOrderItem(
            order_id=order.id,
            item_id=item_data.item_id,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            memo=item_data.memo
        )
        db.add(order_item)

    db.commit()
    db.refresh(order)
    return order


def update_order(
    db: Session, order_id: int, data: PurchaseOrderUpdate
) -> Optional[PurchaseOrder]:
    """발주서 기본 정보 수정 (상태, 거래처, 날짜 등)"""
    order = get_order_by_id(db, order_id)
    if not order:
        return None
    # 입고완료 상태에서는 수정 불가
    if order.status == "입고완료":
        raise ValueError("입고 완료된 발주서는 수정할 수 없습니다.")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(order, key, value)
    db.commit()
    db.refresh(order)
    return order


def cancel_order(db: Session, order_id: int) -> bool:
    """발주서 취소 (입고완료 상태는 취소 불가)"""
    order = get_order_by_id(db, order_id)
    if not order:
        return False
    if order.status == "입고완료":
        raise ValueError("입고 완료된 발주서는 취소할 수 없습니다.")
    order.status = "취소"
    db.commit()
    return True


def delete_order(db: Session, order_id: int) -> bool:
    """발주서 소프트 삭제 (취소 상태인 경우에만 삭제 허용)"""
    order = get_order_by_id(db, order_id)
    if not order:
        return False
    order.is_deleted = 1
    db.commit()
    return True


def receive_order(
    db: Session, order_id: int, data: ReceiveOrderRequest
) -> PurchaseOrder:
    """
    발주서 입고 처리.
    각 품목의 실제 입고 수량을 반영하여 재고를 증가시키고
    수량 조정 이력을 생성합니다.
    """
    order = get_order_by_id(db, order_id)
    if not order:
        raise ValueError("발주서를 찾을 수 없습니다.")
    if order.status != "발주중":
        raise ValueError(f"현재 상태({order.status})에서는 입고 처리할 수 없습니다.")

    # 발주 품목 ID → 품목 매핑 생성
    order_items_map = {oi.id: oi for oi in order.order_items}

    for receive_item in data.items:
        order_item = order_items_map.get(receive_item.order_item_id)
        if not order_item:
            raise ValueError(f"발주 품목 ID {receive_item.order_item_id}를 찾을 수 없습니다.")

        received_qty = receive_item.received_quantity
        if received_qty <= 0:
            continue  # 입고 수량이 0이면 스킵

        # 실제 입고 수량 기록
        order_item.received_quantity = received_qty

        # 실제 입고 단가 처리:
        # actual_price가 있으면 발주 단가를 실제 단가로 갱신 후 총액 계산
        # (발주 시 단가와 실제 납품 단가가 다를 수 있으므로 반드시 갱신 필요)
        actual_price = receive_item.unit_price or order_item.unit_price
        if receive_item.unit_price:
            # 실제 단가가 입력된 경우 발주 품목 단가를 갱신
            order_item.unit_price = actual_price

        # 재고 품목 수량 증가
        inventory_item = get_item_by_id(db, order_item.item_id)
        if not inventory_item:
            continue

        quantity_before = inventory_item.current_quantity
        inventory_item.current_quantity += received_qty

        # 입고 이력 생성 (갱신된 실제 단가 기준으로 기록)
        adjustment = InventoryAdjustment(
            item_id=order_item.item_id,
            adjustment_type="입고",
            quantity_change=received_qty,
            quantity_before=quantity_before,
            quantity_after=inventory_item.current_quantity,
            adjustment_date=data.received_date,
            purchase_order_id=order_id,
            unit_price=actual_price,
            memo=f"발주서 {order.order_number} 입고 처리"
        )
        db.add(adjustment)

    # 발주서 상태 업데이트
    order.status = "입고완료"
    order.received_date = data.received_date
    if data.memo:
        order.memo = (order.memo or "") + f"\n입고메모: {data.memo}"

    # 총 입고 금액 재계산 (단가 갱신 후 order_item.unit_price 기준으로 계산)
    order.total_amount = sum(
        oi.received_quantity * oi.unit_price
        for oi in order.order_items
        if oi.received_quantity > 0
    )

    db.commit()
    db.refresh(order)
    return order


# ─────────────────────────────────────────
# 재고 현황 요약 서비스
# ─────────────────────────────────────────

def get_inventory_summary(db: Session) -> InventorySummaryResponse:
    """
    재고 현황 요약 정보 계산.
    전체 품목 수, 재고 부족/품절 품목 수, 발주 진행 중 수를 반환합니다.
    """
    # 전체 활성 품목 수
    total_items = db.query(InventoryItem).filter(
        InventoryItem.is_deleted == 0
    ).count()

    # 재고 부족 품목 (현재 수량 <= 최소 임계값, 단 수량 > 0)
    low_stock_items_query = db.query(InventoryItem).filter(
        InventoryItem.is_deleted == 0,
        InventoryItem.current_quantity <= InventoryItem.min_quantity,
        InventoryItem.current_quantity > 0
    ).order_by(InventoryItem.current_quantity.asc()).limit(10).all()

    low_stock_count = db.query(InventoryItem).filter(
        InventoryItem.is_deleted == 0,
        InventoryItem.current_quantity <= InventoryItem.min_quantity,
        InventoryItem.current_quantity > 0
    ).count()

    # 품절 품목 수 (현재 수량 = 0)
    out_of_stock_count = db.query(InventoryItem).filter(
        InventoryItem.is_deleted == 0,
        InventoryItem.current_quantity <= 0
    ).count()

    # 발주 진행 중인 발주서 수
    pending_orders = db.query(PurchaseOrder).filter(
        PurchaseOrder.is_deleted == 0,
        PurchaseOrder.status == "발주중"
    ).count()

    # 재고 부족 품목 상세 목록 (알림용)
    low_stock_list = [
        {
            "id": item.id,
            "name": item.name,
            "current_quantity": item.current_quantity,
            "min_quantity": item.min_quantity,
            "unit": item.unit,
            "stock_status": item.stock_status
        }
        for item in low_stock_items_query
    ]

    return InventorySummaryResponse(
        total_items=total_items,
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
        pending_orders=pending_orders,
        low_stock_items=low_stock_list
    )


# ─────────────────────────────────────────
# 기본 데이터 초기화 서비스
# ─────────────────────────────────────────

def seed_default_categories(db: Session) -> None:
    """
    기본 재고 분류 데이터 초기 생성.
    제철해산물 주점 특성에 맞는 분류를 설정합니다.
    """
    default_categories = [
        {"name": "수산물", "description": "제철 수산물, 활어, 패류 등", "color": "#3B82F6"},
        {"name": "채소/과일", "description": "신선 채소, 과일, 허브 등", "color": "#22C55E"},
        {"name": "주류", "description": "소주, 맥주, 막걸리, 와인 등", "color": "#F59E0B"},
        {"name": "음료/기타식재료", "description": "음료, 조미료, 건식품 등", "color": "#06B6D4"},
        {"name": "포장재/용기", "description": "포장재, 일회용기, 비닐 등", "color": "#8B5CF6"},
        {"name": "소모품", "description": "청소용품, 위생용품, 주방소모품 등", "color": "#EF4444"},
    ]
    existing = db.query(InventoryCategory).count()
    if existing == 0:
        for cat_data in default_categories:
            db.add(InventoryCategory(**cat_data))
        db.commit()


# ─────────────────────────────────────────
# 데일리 단가 서비스
# ─────────────────────────────────────────

def get_daily_price_grid(db: Session, year: int, month: int) -> dict:
    """
    해당 월 데일리 단가 그리드 전체 반환.
    is_daily_price_tracked=True(1) 품목만 조회합니다.
    """
    import calendar
    days_in_month = calendar.monthrange(year, month)[1]
    year_month = f"{year:04d}-{month:02d}"

    # 추적 대상 품목 조회 (카테고리 ID 순 정렬)
    tracked_items = (
        db.query(InventoryItem)
        .filter(InventoryItem.is_daily_price_tracked == 1, InventoryItem.is_deleted == 0)
        .order_by(InventoryItem.category_id, InventoryItem.id)
        .all()
    )

    if not tracked_items:
        return {
            "year": year, "month": month, "days_in_month": days_in_month,
            "items": [], "daily_totals": {}
        }

    item_ids = [item.id for item in tracked_items]

    # 해당 월 단가 기록 전체 조회
    records = (
        db.query(DailyPriceRecord)
        .filter(
            DailyPriceRecord.item_id.in_(item_ids),
            DailyPriceRecord.record_date.like(f"{year_month}-%")
        )
        .all()
    )

    # 품목×날짜 인덱스 구성 {item_id: {date_str: record}}
    record_map = {}
    for rec in records:
        if rec.item_id not in record_map:
            record_map[rec.item_id] = {}
        record_map[rec.item_id][rec.record_date] = rec

    # 날짜별 합계 계산 (0인 날짜는 제외)
    daily_totals = {}
    for d in range(1, days_in_month + 1):
        date_str = f"{year_month}-{d:02d}"
        total = sum(
            record_map.get(item.id, {}).get(date_str).amount or 0
            for item in tracked_items
            if record_map.get(item.id, {}).get(date_str) is not None
        )
        if total > 0:
            daily_totals[date_str] = total

    # 품목별 행 데이터 구성
    items_data = []
    for item in tracked_items:
        item_records = record_map.get(item.id, {})
        monthly_total = sum(r.amount or 0 for r in item_records.values())
        records_dict = {}
        for date_str, rec in item_records.items():
            records_dict[date_str] = {
                "record_id": rec.id,
                "quantity": rec.quantity,
                "unit_price": rec.unit_price,
                "amount": rec.amount,
                "vendor": rec.vendor,
            }
        items_data.append({
            "item_id": item.id,
            "item_name": item.name,
            "unit": item.unit,
            "monthly_total": monthly_total,
            "records": records_dict,
        })

    return {
        "year": year, "month": month, "days_in_month": days_in_month,
        "items": items_data, "daily_totals": daily_totals,
    }


def save_daily_price(db: Session, data: DailyPriceRecordCreate) -> DailyPriceRecord:
    """
    데일리 단가 기록 저장 또는 업데이트 (UPSERT).
    amount는 quantity × unit_price로 서비스 레이어에서 자동 계산합니다.
    """
    # 금액 자동 계산 (반올림 후 정수 변환)
    amount = int(round(data.quantity * data.unit_price))

    # 기존 기록 조회 (같은 품목 + 날짜 조합)
    existing = (
        db.query(DailyPriceRecord)
        .filter(
            DailyPriceRecord.item_id == data.item_id,
            DailyPriceRecord.record_date == data.record_date
        )
        .first()
    )

    if existing:
        # 기존 기록 업데이트
        existing.quantity = data.quantity
        existing.unit_price = data.unit_price
        existing.amount = amount
        existing.vendor = data.vendor
        existing.memo = data.memo
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # 신규 기록 생성
        record = DailyPriceRecord(
            item_id=data.item_id,
            record_date=data.record_date,
            quantity=data.quantity,
            unit_price=data.unit_price,
            amount=amount,
            vendor=data.vendor,
            memo=data.memo,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record


def get_daily_price_summary(db: Session, year: int, month: int) -> dict:
    """
    데일리 단가 월별 품목별 요약.
    평균/최고/최저 단가 및 총 금액을 반환합니다.
    0원 단가는 최저/평균 계산에서 제외합니다.
    """
    year_month = f"{year:04d}-{month:02d}"
    records = (
        db.query(DailyPriceRecord)
        .filter(DailyPriceRecord.record_date.like(f"{year_month}-%"))
        .all()
    )

    # 품목별 집계 {item_id: {quantities, prices, amounts}}
    item_map = {}
    for rec in records:
        if rec.item_id not in item_map:
            item_map[rec.item_id] = {"quantities": [], "prices": [], "amounts": []}
        item_map[rec.item_id]["quantities"].append(rec.quantity)
        # 0원 단가는 평균/최고/최저 계산에서 제외
        if rec.unit_price > 0:
            item_map[rec.item_id]["prices"].append(rec.unit_price)
        item_map[rec.item_id]["amounts"].append(rec.amount or 0)

    items_summary = []
    total_amount = 0
    for item_id, data in item_map.items():
        item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
        if not item:
            continue
        prices = data["prices"]
        item_total = sum(data["amounts"])
        total_amount += item_total
        items_summary.append({
            "item_id": item_id,
            "item_name": item.name,
            "unit": item.unit,
            "total_quantity": round(sum(data["quantities"]), 2),
            "total_amount": item_total,
            "avg_unit_price": int(sum(prices) / len(prices)) if prices else 0,
            "max_unit_price": max(prices) if prices else 0,
            "min_unit_price": min(prices) if prices else 0,
            "record_count": len(data["quantities"]),
        })

    return {"year": year, "month": month, "total_amount": total_amount, "items": items_summary}


def toggle_daily_price_tracking(db: Session, item_id: int) -> Optional[InventoryItem]:
    """
    데일리 단가 추적 대상 토글.
    1 → 0 (미추적), 0 → 1 (추적) 으로 전환합니다.
    """
    item = db.query(InventoryItem).filter(
        InventoryItem.id == item_id, InventoryItem.is_deleted == 0
    ).first()
    if not item:
        return None
    # 현재 값을 반전 (0이면 1로, 1이면 0으로)
    item.is_daily_price_tracked = 0 if item.is_daily_price_tracked else 1
    db.commit()
    db.refresh(item)
    return item
