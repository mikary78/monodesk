# ============================================================
# services/menu_service.py — 메뉴 관리 비즈니스 로직
# 메뉴 카테고리/아이템 CRUD, 원가율 계산, 통계 분석을 담당합니다.
# ============================================================

from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from models.menu import MenuCategory, MenuItem, MenuIngredient
from schemas.menu import (
    MenuCategoryCreate, MenuCategoryUpdate,
    MenuItemCreate, MenuItemUpdate,
    MenuIngredientCreate, MenuIngredientUpdate,
    MenuStatsResponse, MenuCostAnalysisResponse
)


# ─────────────────────────────────────────
# 메뉴 카테고리 서비스
# ─────────────────────────────────────────

def get_all_categories(db: Session) -> List[MenuCategory]:
    """삭제되지 않은 모든 메뉴 카테고리 목록 조회 (정렬 순서 기준)"""
    return db.query(MenuCategory).filter(
        MenuCategory.is_deleted == 0
    ).order_by(MenuCategory.sort_order, MenuCategory.id).all()


def get_category_by_id(db: Session, category_id: int) -> Optional[MenuCategory]:
    """ID로 메뉴 카테고리 단건 조회"""
    return db.query(MenuCategory).filter(
        MenuCategory.id == category_id,
        MenuCategory.is_deleted == 0
    ).first()


def create_category(db: Session, data: MenuCategoryCreate) -> MenuCategory:
    """새 메뉴 카테고리 생성"""
    category = MenuCategory(**data.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


def update_category(db: Session, category_id: int, data: MenuCategoryUpdate) -> Optional[MenuCategory]:
    """메뉴 카테고리 정보 수정"""
    category = get_category_by_id(db, category_id)
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
    """메뉴 카테고리 소프트 삭제"""
    category = get_category_by_id(db, category_id)
    if not category:
        return False
    # 해당 카테고리에 속한 메뉴가 있으면 삭제 불가
    active_menu_count = db.query(MenuItem).filter(
        MenuItem.category_id == category_id,
        MenuItem.is_deleted == 0
    ).count()
    if active_menu_count > 0:
        raise ValueError(f"해당 카테고리에 메뉴 {active_menu_count}개가 있어 삭제할 수 없습니다. 메뉴를 먼저 이동하거나 삭제해주세요.")
    category.is_deleted = 1
    db.commit()
    return True


# ─────────────────────────────────────────
# 메뉴 아이템 서비스
# ─────────────────────────────────────────

def get_menu_items(
    db: Session,
    category_id: Optional[int] = None,
    is_active: Optional[int] = None,
    is_featured: Optional[int] = None,
    skip: int = 0,
    limit: int = 100
) -> dict:
    """
    메뉴 아이템 목록 조회.
    카테고리 필터, 판매 상태 필터, 페이지네이션을 지원합니다.
    """
    query = db.query(MenuItem).filter(MenuItem.is_deleted == 0)

    # 카테고리 필터 적용
    if category_id is not None:
        query = query.filter(MenuItem.category_id == category_id)

    # 판매 여부 필터 적용
    if is_active is not None:
        query = query.filter(MenuItem.is_active == is_active)

    # 대표 메뉴 필터 적용
    if is_featured is not None:
        query = query.filter(MenuItem.is_featured == is_featured)

    total = query.count()
    items = query.order_by(
        MenuItem.category_id, MenuItem.name
    ).offset(skip).limit(limit).all()

    return {"total": total, "items": items}


def get_menu_item_by_id(db: Session, item_id: int) -> Optional[MenuItem]:
    """ID로 메뉴 아이템 단건 조회"""
    return db.query(MenuItem).filter(
        MenuItem.id == item_id,
        MenuItem.is_deleted == 0
    ).first()


def create_menu_item(db: Session, data: MenuItemCreate) -> MenuItem:
    """
    새 메뉴 아이템 생성.
    구성 재료가 있으면 함께 생성하고 원가를 자동 계산합니다.
    """
    # 구성 재료 분리
    ingredients_data = data.ingredients or []
    item_data = data.model_dump(exclude={"ingredients"})

    # 구성 재료에서 원가 자동 계산
    if ingredients_data:
        calculated_cost = sum(
            ing.quantity * ing.unit_price for ing in ingredients_data
        )
        # 직접 입력 원가가 0이면 재료 기반 원가로 설정
        if item_data.get("cost", 0) == 0:
            item_data["cost"] = round(calculated_cost, 0)

    # 메뉴 아이템 생성
    menu_item = MenuItem(**item_data)
    db.add(menu_item)
    db.flush()  # ID 확보를 위해 flush (commit은 아직)

    # 구성 재료 생성
    for ing in ingredients_data:
        ingredient = MenuIngredient(
            menu_item_id=menu_item.id,
            **ing.model_dump()
        )
        db.add(ingredient)

    db.commit()
    db.refresh(menu_item)
    return menu_item


def update_menu_item(db: Session, item_id: int, data: MenuItemUpdate) -> Optional[MenuItem]:
    """메뉴 아이템 정보 수정 (부분 수정)"""
    item = get_menu_item_by_id(db, item_id)
    if not item:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


def delete_menu_item(db: Session, item_id: int) -> bool:
    """메뉴 아이템 소프트 삭제"""
    item = get_menu_item_by_id(db, item_id)
    if not item:
        return False
    item.is_deleted = 1
    db.commit()
    return True


def toggle_menu_active(db: Session, item_id: int) -> Optional[MenuItem]:
    """메뉴 판매 여부 토글 (판매중 ↔ 판매중지)"""
    item = get_menu_item_by_id(db, item_id)
    if not item:
        return None
    item.is_active = 0 if item.is_active == 1 else 1
    db.commit()
    db.refresh(item)
    return item


def toggle_menu_featured(db: Session, item_id: int) -> Optional[MenuItem]:
    """대표 메뉴 여부 토글"""
    item = get_menu_item_by_id(db, item_id)
    if not item:
        return None
    item.is_featured = 0 if item.is_featured == 1 else 1
    db.commit()
    db.refresh(item)
    return item


# ─────────────────────────────────────────
# 메뉴 구성 재료 서비스
# ─────────────────────────────────────────

def get_ingredients_by_menu(db: Session, menu_item_id: int) -> List[MenuIngredient]:
    """메뉴 아이템의 구성 재료 전체 조회"""
    return db.query(MenuIngredient).filter(
        MenuIngredient.menu_item_id == menu_item_id
    ).all()


def add_ingredient(db: Session, menu_item_id: int, data: MenuIngredientCreate) -> MenuIngredient:
    """메뉴 구성 재료 추가 후 원가 재계산"""
    ingredient = MenuIngredient(
        menu_item_id=menu_item_id,
        **data.model_dump()
    )
    db.add(ingredient)
    db.flush()

    # 원가 재계산 (모든 재료 소계 합산)
    _recalculate_menu_cost(db, menu_item_id)
    db.commit()
    db.refresh(ingredient)
    return ingredient


def update_ingredient(
    db: Session,
    ingredient_id: int,
    data: MenuIngredientUpdate
) -> Optional[MenuIngredient]:
    """메뉴 구성 재료 수정 후 원가 재계산"""
    ingredient = db.query(MenuIngredient).filter(
        MenuIngredient.id == ingredient_id
    ).first()
    if not ingredient:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(ingredient, key, value)
    db.flush()

    # 원가 재계산
    _recalculate_menu_cost(db, ingredient.menu_item_id)
    db.commit()
    db.refresh(ingredient)
    return ingredient


def delete_ingredient(db: Session, ingredient_id: int) -> bool:
    """메뉴 구성 재료 삭제 후 원가 재계산"""
    ingredient = db.query(MenuIngredient).filter(
        MenuIngredient.id == ingredient_id
    ).first()
    if not ingredient:
        return False
    menu_item_id = ingredient.menu_item_id
    db.delete(ingredient)
    db.flush()

    # 원가 재계산
    _recalculate_menu_cost(db, menu_item_id)
    db.commit()
    return True


def _recalculate_menu_cost(db: Session, menu_item_id: int) -> None:
    """
    메뉴 아이템의 원가를 구성 재료 소계 합산으로 재계산합니다.
    재료가 없으면 원가를 0으로 초기화합니다.
    """
    ingredients = db.query(MenuIngredient).filter(
        MenuIngredient.menu_item_id == menu_item_id
    ).all()

    if not ingredients:
        # 재료가 없으면 원가를 0으로
        total_cost = 0.0
    else:
        total_cost = sum(
            (ing.quantity or 0) * (ing.unit_price or 0) for ing in ingredients
        )

    menu_item = db.query(MenuItem).filter(MenuItem.id == menu_item_id).first()
    if menu_item:
        menu_item.cost = round(total_cost, 0)


# ─────────────────────────────────────────
# 메뉴 통계 서비스
# ─────────────────────────────────────────

def get_menu_stats(db: Session) -> MenuStatsResponse:
    """
    메뉴 현황 통계 계산.
    전체 메뉴 수, 카테고리별 현황, 원가율 경고 메뉴를 반환합니다.
    """
    # 전체 메뉴 목록 조회 (삭제 제외)
    all_items = db.query(MenuItem).filter(MenuItem.is_deleted == 0).all()

    total_items = len(all_items)
    active_items = sum(1 for item in all_items if item.is_active == 1)
    inactive_items = total_items - active_items
    featured_items = sum(1 for item in all_items if item.is_featured == 1)

    # 전체 평균 원가율 계산 (원가 등록된 메뉴만 포함, 원가=0 제외)
    # 원가 미등록 메뉴를 포함하면 평균이 왜곡되므로 제외
    costed_items = [item for item in all_items if item.cost > 0]
    if costed_items:
        avg_cost_ratio = round(
            sum(item.cost_ratio for item in costed_items) / len(costed_items), 1
        )
    else:
        avg_cost_ratio = 0.0

    # 카테고리별 통계 집계
    categories = db.query(MenuCategory).filter(MenuCategory.is_deleted == 0).all()
    by_category = []
    for cat in categories:
        cat_items = [item for item in all_items if item.category_id == cat.id]
        cat_active = sum(1 for item in cat_items if item.is_active == 1)
        cat_avg_cost = (
            round(sum(item.cost_ratio for item in cat_items) / len(cat_items), 1)
            if cat_items else 0.0
        )
        by_category.append({
            "category_id": cat.id,
            "category_name": cat.name,
            "category_color": cat.color,
            "total_items": len(cat_items),
            "active_items": cat_active,
            "avg_cost_ratio": cat_avg_cost,
        })

    # 원가율 경고 메뉴 (70% 초과)
    high_cost_ratio_items = [
        {
            "id": item.id,
            "name": item.name,
            "price": item.price,
            "cost": item.cost,
            "cost_ratio": item.cost_ratio,
        }
        for item in all_items
        if item.cost_ratio > 70 and item.is_active == 1
    ]
    # 원가율 높은 순 정렬
    high_cost_ratio_items.sort(key=lambda x: x["cost_ratio"], reverse=True)

    return MenuStatsResponse(
        total_items=total_items,
        active_items=active_items,
        inactive_items=inactive_items,
        featured_items=featured_items,
        avg_cost_ratio=avg_cost_ratio,
        by_category=by_category,
        high_cost_ratio_items=high_cost_ratio_items,
    )


def get_cost_analysis(db: Session) -> MenuCostAnalysisResponse:
    """
    메뉴 원가 분석.
    원가율 구간별 분포, 고마진 메뉴, 개선 필요 메뉴를 반환합니다.
    """
    # 판매 중인 메뉴만 분석 대상
    items = db.query(MenuItem).filter(
        MenuItem.is_deleted == 0,
        MenuItem.is_active == 1
    ).all()

    if not items:
        return MenuCostAnalysisResponse(
            cost_ratio_distribution=[],
            top_margin_items=[],
            high_cost_items=[],
            avg_cost_ratio=0.0,
            weighted_avg_cost_ratio=0.0,
            cost_unregistered_count=0,
        )

    # 원가 등록 여부로 메뉴 분리
    # 원가=0인 메뉴는 분석 통계에서 제외하고 미등록 카운트로 별도 집계
    registered_items = [item for item in items if item.cost > 0]
    cost_unregistered_count = len(items) - len(registered_items)

    # 원가율 구간별 분포 (원가 등록 메뉴만 대상)
    dist = {"0-30%": 0, "30-50%": 0, "50-70%": 0, "70%+": 0}
    for item in registered_items:
        cr = item.cost_ratio
        if cr <= 30:
            dist["0-30%"] += 1
        elif cr <= 50:
            dist["30-50%"] += 1
        elif cr <= 70:
            dist["50-70%"] += 1
        else:
            dist["70%+"] += 1

    cost_ratio_distribution = [
        {"range": k, "count": v} for k, v in dist.items()
    ]

    # 단순 평균 원가율 계산 (원가 등록 메뉴만 포함)
    if registered_items:
        avg_cost_ratio = round(
            sum(item.cost_ratio for item in registered_items) / len(registered_items), 1
        )
    else:
        avg_cost_ratio = 0.0

    # 근사 가중 평균 원가율 계산 (판매가 기준 가중치)
    # 주의: 판매 수량 데이터 미연동 상태에서의 근사값입니다.
    #       실제 판매 수량 연동 시에는 수량 기반 가중평균으로 교체 필요.
    total_price = sum(item.price for item in registered_items)
    if total_price > 0:
        weighted_avg = sum(item.cost_ratio * item.price for item in registered_items) / total_price
        weighted_avg_cost_ratio = round(weighted_avg, 1)
    else:
        weighted_avg_cost_ratio = 0.0

    # 메뉴별 통계 목록 구성 (원가 등록 메뉴만 포함)
    item_list = [
        {
            "id": item.id,
            "name": item.name,
            "category_id": item.category_id,
            "price": item.price,
            "cost": item.cost,
            "cost_ratio": item.cost_ratio,
            "margin": item.margin,
            "margin_ratio": item.margin_ratio,
        }
        for item in registered_items
    ]

    # 고마진 메뉴 (원가율 낮은 순 상위 10개)
    top_margin_items = sorted(item_list, key=lambda x: x["cost_ratio"])[:10]

    # 개선 필요 메뉴 (원가율 높은 순 상위 10개)
    high_cost_items = sorted(item_list, key=lambda x: x["cost_ratio"], reverse=True)[:10]

    return MenuCostAnalysisResponse(
        cost_ratio_distribution=cost_ratio_distribution,
        top_margin_items=top_margin_items,
        high_cost_items=high_cost_items,
        avg_cost_ratio=avg_cost_ratio,
        weighted_avg_cost_ratio=weighted_avg_cost_ratio,
        cost_unregistered_count=cost_unregistered_count,
    )


def seed_default_categories(db: Session) -> None:
    """
    기본 메뉴 카테고리 데이터 초기 생성.
    앱 최초 실행 시 호출합니다.
    """
    # 제철해산물 주점에 맞는 기본 카테고리
    default_categories = [
        {"name": "회/해산물", "description": "광어회, 문어숙회 등 해산물 요리", "color": "#3B82F6", "sort_order": 1},
        {"name": "구이/찜", "description": "새우구이, 조개구이 등 구이/찜 요리", "color": "#F59E0B", "sort_order": 2},
        {"name": "안주류", "description": "해물파전, 골뱅이 등 안주 요리", "color": "#10B981", "sort_order": 3},
        {"name": "주류", "description": "소주, 맥주, 막걸리 등 주류", "color": "#8B5CF6", "sort_order": 4},
        {"name": "음료", "description": "탄산음료, 주스 등 비알코올 음료", "color": "#06B6D4", "sort_order": 5},
        {"name": "기타", "description": "공기밥, 추가 재료 등", "color": "#64748B", "sort_order": 6},
    ]
    existing = db.query(MenuCategory).count()
    if existing == 0:
        for cat_data in default_categories:
            db.add(MenuCategory(**cat_data))
        db.commit()
