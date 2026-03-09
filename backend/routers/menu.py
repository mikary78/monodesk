# ============================================================
# routers/menu.py — 메뉴 관리 API 라우터
# 메뉴 카테고리, 메뉴 아이템, 구성 재료, 통계 엔드포인트를 제공합니다.
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from schemas.menu import (
    MenuCategoryCreate, MenuCategoryUpdate, MenuCategoryResponse,
    MenuItemCreate, MenuItemUpdate, MenuItemResponse,
    MenuIngredientCreate, MenuIngredientUpdate, MenuIngredientResponse,
    MenuStatsResponse, MenuCostAnalysisResponse
)
import services.menu_service as service

# 라우터 인스턴스 생성
router = APIRouter()


# ─────────────────────────────────────────
# 메뉴 카테고리 API
# ─────────────────────────────────────────

@router.get("/categories", response_model=list[MenuCategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    """
    메뉴 카테고리 목록 전체 조회.
    정렬 순서 기준으로 반환합니다.
    """
    return service.get_all_categories(db)


@router.post("/categories", response_model=MenuCategoryResponse, status_code=201)
def create_category(data: MenuCategoryCreate, db: Session = Depends(get_db)):
    """메뉴 카테고리 신규 생성"""
    try:
        return service.create_category(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"메뉴 카테고리 생성 중 오류가 발생했습니다: {str(e)}")


@router.put("/categories/{category_id}", response_model=MenuCategoryResponse)
def update_category(category_id: int, data: MenuCategoryUpdate, db: Session = Depends(get_db)):
    """메뉴 카테고리 정보 수정"""
    result = service.update_category(db, category_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 메뉴 카테고리를 찾을 수 없습니다.")
    return result


@router.delete("/categories/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    """메뉴 카테고리 삭제 (소프트 삭제). 해당 카테고리에 메뉴가 있으면 삭제 불가."""
    try:
        success = service.delete_category(db, category_id)
        if not success:
            raise HTTPException(status_code=404, detail="해당 메뉴 카테고리를 찾을 수 없습니다.")
        return {"success": True, "message": "메뉴 카테고리가 삭제되었습니다."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"카테고리 삭제 중 오류가 발생했습니다: {str(e)}")


# ─────────────────────────────────────────
# 메뉴 아이템 API
# ─────────────────────────────────────────

@router.get("/items", response_model=dict)
def get_menu_items(
    category_id: Optional[int] = Query(None, description="카테고리 필터"),
    is_active: Optional[int] = Query(None, ge=0, le=1, description="판매 여부 필터 (1: 판매중, 0: 중지)"),
    is_featured: Optional[int] = Query(None, ge=0, le=1, description="대표 메뉴 필터"),
    skip: int = Query(0, ge=0, description="페이지 오프셋"),
    limit: int = Query(100, ge=1, le=500, description="페이지 크기"),
    db: Session = Depends(get_db)
):
    """
    메뉴 아이템 목록 조회.
    카테고리, 판매 상태, 대표 메뉴 필터와 페이지네이션을 지원합니다.
    """
    result = service.get_menu_items(db, category_id, is_active, is_featured, skip, limit)
    return {
        "success": True,
        "total": result["total"],
        "items": [MenuItemResponse.model_validate(item) for item in result["items"]]
    }


@router.get("/items/{item_id}", response_model=MenuItemResponse)
def get_menu_item(item_id: int, db: Session = Depends(get_db)):
    """메뉴 아이템 단건 조회 (구성 재료 포함)"""
    item = service.get_menu_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="해당 메뉴를 찾을 수 없습니다.")
    return item


@router.post("/items", response_model=MenuItemResponse, status_code=201)
def create_menu_item(data: MenuItemCreate, db: Session = Depends(get_db)):
    """
    새 메뉴 아이템 등록.
    구성 재료를 함께 전달하면 원가가 자동 계산됩니다.
    """
    try:
        return service.create_menu_item(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"메뉴 등록 중 오류가 발생했습니다: {str(e)}")


@router.put("/items/{item_id}", response_model=MenuItemResponse)
def update_menu_item(item_id: int, data: MenuItemUpdate, db: Session = Depends(get_db)):
    """메뉴 아이템 정보 수정 (부분 수정 가능)"""
    result = service.update_menu_item(db, item_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 메뉴를 찾을 수 없습니다.")
    return result


@router.delete("/items/{item_id}")
def delete_menu_item(item_id: int, db: Session = Depends(get_db)):
    """메뉴 아이템 삭제 (소프트 삭제)"""
    success = service.delete_menu_item(db, item_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 메뉴를 찾을 수 없습니다.")
    return {"success": True, "message": "메뉴가 삭제되었습니다."}


@router.patch("/items/{item_id}/toggle-active", response_model=MenuItemResponse)
def toggle_menu_active(item_id: int, db: Session = Depends(get_db)):
    """메뉴 판매 여부 토글 (판매중 ↔ 판매중지)"""
    result = service.toggle_menu_active(db, item_id)
    if not result:
        raise HTTPException(status_code=404, detail="해당 메뉴를 찾을 수 없습니다.")
    return result


@router.patch("/items/{item_id}/toggle-featured", response_model=MenuItemResponse)
def toggle_menu_featured(item_id: int, db: Session = Depends(get_db)):
    """대표 메뉴 여부 토글"""
    result = service.toggle_menu_featured(db, item_id)
    if not result:
        raise HTTPException(status_code=404, detail="해당 메뉴를 찾을 수 없습니다.")
    return result


# ─────────────────────────────────────────
# 메뉴 구성 재료 API
# ─────────────────────────────────────────

@router.get("/items/{item_id}/ingredients", response_model=list[MenuIngredientResponse])
def get_ingredients(item_id: int, db: Session = Depends(get_db)):
    """메뉴 아이템의 구성 재료 전체 조회"""
    # 메뉴 존재 여부 확인
    item = service.get_menu_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="해당 메뉴를 찾을 수 없습니다.")
    return service.get_ingredients_by_menu(db, item_id)


@router.post("/items/{item_id}/ingredients", response_model=MenuIngredientResponse, status_code=201)
def add_ingredient(item_id: int, data: MenuIngredientCreate, db: Session = Depends(get_db)):
    """메뉴에 구성 재료 추가 (원가 자동 재계산)"""
    item = service.get_menu_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="해당 메뉴를 찾을 수 없습니다.")
    try:
        return service.add_ingredient(db, item_id, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"재료 추가 중 오류가 발생했습니다: {str(e)}")


@router.put("/ingredients/{ingredient_id}", response_model=MenuIngredientResponse)
def update_ingredient(ingredient_id: int, data: MenuIngredientUpdate, db: Session = Depends(get_db)):
    """구성 재료 수정 (원가 자동 재계산)"""
    result = service.update_ingredient(db, ingredient_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 재료를 찾을 수 없습니다.")
    return result


@router.delete("/ingredients/{ingredient_id}")
def delete_ingredient(ingredient_id: int, db: Session = Depends(get_db)):
    """구성 재료 삭제 (원가 자동 재계산)"""
    success = service.delete_ingredient(db, ingredient_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 재료를 찾을 수 없습니다.")
    return {"success": True, "message": "재료가 삭제되었습니다."}


# ─────────────────────────────────────────
# 메뉴 통계 / 분석 API
# ─────────────────────────────────────────

@router.get("/stats", response_model=MenuStatsResponse)
def get_menu_stats(db: Session = Depends(get_db)):
    """
    메뉴 현황 통계.
    전체 메뉴 수, 카테고리별 현황, 원가율 경고 메뉴를 반환합니다.
    """
    try:
        return service.get_menu_stats(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"메뉴 통계 조회 중 오류가 발생했습니다: {str(e)}")


@router.get("/cost-analysis", response_model=MenuCostAnalysisResponse)
def get_cost_analysis(db: Session = Depends(get_db)):
    """
    메뉴 원가 분석.
    원가율 구간별 분포, 고마진 메뉴, 개선 필요 메뉴를 반환합니다.
    """
    try:
        return service.get_cost_analysis(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"원가 분석 중 오류가 발생했습니다: {str(e)}")


@router.post("/seed-categories")
def seed_categories(db: Session = Depends(get_db)):
    """기본 메뉴 카테고리 데이터 초기화 (최초 설정 시 1회 사용)"""
    service.seed_default_categories(db)
    return {"success": True, "message": "기본 메뉴 카테고리가 생성되었습니다."}
