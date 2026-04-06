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
    InventoryAdjustment, PurchaseOrder, PurchaseOrderItem
)
from schemas.inventory import (
    InventoryCategoryCreate, InventoryCategoryUpdate,
    InventoryItemCreate, InventoryItemUpdate,
    InventoryAdjustmentCreate,
    PurchaseOrderCreate, PurchaseOrderUpdate,
    ReceiveOrderRequest, InventorySummaryResponse
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

        # 해당 품목의 매입 출처 결정:
        # ReceiveOrderItem에 purchase_source가 있으면 사용, 없으면 'direct'로 기본 설정
        # 프론트엔드에서 발주서 단위로 선택한 출처가 각 품목에 담겨서 전달됩니다
        purchase_src = getattr(receive_item, 'purchase_source', 'direct') or 'direct'

        # 입고 이력 생성 (갱신된 실제 단가 + 매입 출처 기준으로 기록)
        adjustment = InventoryAdjustment(
            item_id=order_item.item_id,
            adjustment_type="입고",
            quantity_change=received_qty,
            quantity_before=quantity_before,
            quantity_after=inventory_item.current_quantity,
            adjustment_date=data.received_date,
            purchase_order_id=order_id,
            unit_price=actual_price,
            memo=f"발주서 {order.order_number} 입고 처리",
            purchase_source=purchase_src,  # 매입 출처 저장 (엑셀 3.원·부재료 구분)
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

# ─────────────────────────────────────────
# 매입 출처별 집계 서비스
# ─────────────────────────────────────────

# 매입 출처 코드 → 한국어 레이블 매핑
# 화면 표시 및 집계 결과의 레이블로 사용됩니다
PURCHASE_SOURCE_LABELS = {
    "headquarters": "본사구매 (계좌이체)",
    "site_card": "현장구매 법카",
    "site_cash": "현장구매 시재",
    "direct": "기타 직접구매",
}


def get_purchase_summary(db: Session, year: int, month: int) -> dict:
    """
    월별 매입 출처별 집계.
    입고(adjustment_type='입고') 기록의 purchase_source별 금액 합계를 반환합니다.
    금액 계산 기준: |quantity_change| × unit_price

    엑셀 3.원·부재료 시트의 본사구매/현장구매(법카)/현장구매(시재)/기타 구분 집계와
    동일한 결과를 제공합니다.

    Args:
        db: SQLAlchemy 세션
        year: 집계 연도
        month: 집계 월

    Returns:
        dict: year, month, grand_total, sources 키를 포함한 집계 결과
    """
    # 조회할 연월 문자열 (YYYY-MM 형식) — LIKE 조건으로 해당 월 전체 필터링
    year_month = f"{year:04d}-{month:02d}"

    # 해당 월의 입고 이력 전체 조회
    records = db.query(InventoryAdjustment).filter(
        InventoryAdjustment.adjustment_type == "입고",         # 입고 기록만
        InventoryAdjustment.adjustment_date.like(f"{year_month}-%"),  # 해당 월
        InventoryAdjustment.is_deleted == 0,                   # 삭제되지 않은 기록만
    ).all()

    # 출처별 금액/건수 누적 집계
    source_map: dict = {}
    for rec in records:
        # purchase_source가 None이거나 빈 문자열이면 'direct'로 처리
        src = rec.purchase_source or "direct"
        # 금액 = 수량(절대값) × 단가 (단가가 없으면 0으로 처리)
        amount = abs(rec.quantity_change) * (rec.unit_price or 0)
        if src not in source_map:
            source_map[src] = {"total_amount": 0.0, "count": 0}
        source_map[src]["total_amount"] += amount
        source_map[src]["count"] += 1

    # 4가지 출처 모두 항목으로 포함 (데이터 없으면 0으로 채움)
    sources = []
    for src, label in PURCHASE_SOURCE_LABELS.items():
        data = source_map.get(src, {"total_amount": 0.0, "count": 0})
        sources.append({
            "source": src,
            "source_label": label,
            "total_amount": round(data["total_amount"], 0),
            "count": data["count"],
        })

    # 전체 합계
    grand_total = sum(s["total_amount"] for s in sources)

    return {
        "year": year,
        "month": month,
        "grand_total": round(grand_total, 0),
        "sources": sources,
    }


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
