# ============================================================
# routers/inventory.py — 재고/발주 API 라우터
# 재고 분류, 품목, 수량 조정, 발주서, 입고 처리 엔드포인트를 제공합니다.
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from schemas.inventory import (
    InventoryCategoryCreate, InventoryCategoryUpdate, InventoryCategoryResponse,
    InventoryItemCreate, InventoryItemUpdate, InventoryItemResponse,
    InventoryAdjustmentCreate, InventoryAdjustmentResponse,
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse,
    ReceiveOrderRequest, InventorySummaryResponse,
    InventorySnapshotCreate, InventorySnapshotUpdate,
    SnapshotSummaryResponse, SnapshotConfirmRequest,
)
import services.inventory_service as service

# 라우터 인스턴스 생성
router = APIRouter()


# ─────────────────────────────────────────
# 재고 현황 요약 API
# ─────────────────────────────────────────

@router.get("/summary", response_model=InventorySummaryResponse)
def get_inventory_summary(db: Session = Depends(get_db)):
    """
    재고 현황 요약 정보 조회.
    전체 품목 수, 재고 부족/품절 품목, 발주 진행 중 수를 반환합니다.
    """
    try:
        return service.get_inventory_summary(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"재고 현황 조회 중 오류가 발생했습니다: {str(e)}")


# ─────────────────────────────────────────
# 재고 분류 API
# ─────────────────────────────────────────

@router.get("/categories", response_model=list[InventoryCategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    """재고 분류 목록 전체 조회"""
    return service.get_all_categories(db)


@router.post("/categories", response_model=InventoryCategoryResponse, status_code=201)
def create_category(data: InventoryCategoryCreate, db: Session = Depends(get_db)):
    """재고 분류 생성"""
    try:
        return service.create_category(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"재고 분류 생성 중 오류가 발생했습니다: {str(e)}")


@router.put("/categories/{category_id}", response_model=InventoryCategoryResponse)
def update_category(
    category_id: int, data: InventoryCategoryUpdate, db: Session = Depends(get_db)
):
    """재고 분류 수정"""
    result = service.update_category(db, category_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 재고 분류를 찾을 수 없습니다.")
    return result


@router.delete("/categories/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)):
    """재고 분류 삭제 (소프트 삭제)"""
    success = service.delete_category(db, category_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 재고 분류를 찾을 수 없습니다.")
    return {"success": True, "message": "재고 분류가 삭제되었습니다."}


# ─────────────────────────────────────────
# 재고 품목 API
# ─────────────────────────────────────────

@router.get("/items", response_model=dict)
def get_items(
    category_id: Optional[int] = Query(None, description="분류 필터"),
    low_stock_only: bool = Query(False, description="재고 부족 품목만 조회"),
    search: Optional[str] = Query(None, description="품목명 검색"),
    skip: int = Query(0, ge=0, description="페이지 오프셋"),
    limit: int = Query(100, ge=1, le=500, description="페이지 크기"),
    db: Session = Depends(get_db)
):
    """
    재고 품목 목록 조회.
    분류, 재고 부족 여부, 검색어 필터를 지원합니다.
    """
    result = service.get_item_list(db, category_id, low_stock_only, search, skip, limit)
    return {
        "success": True,
        "total": result["total"],
        "items": [InventoryItemResponse.model_validate(item) for item in result["items"]]
    }


@router.get("/items/{item_id}", response_model=InventoryItemResponse)
def get_item(item_id: int, db: Session = Depends(get_db)):
    """재고 품목 단건 조회"""
    item = service.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="해당 재고 품목을 찾을 수 없습니다.")
    return item


@router.post("/items", response_model=InventoryItemResponse, status_code=201)
def create_item(data: InventoryItemCreate, db: Session = Depends(get_db)):
    """새 재고 품목 등록"""
    try:
        return service.create_item(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"재고 품목 등록 중 오류가 발생했습니다: {str(e)}")


@router.put("/items/{item_id}", response_model=InventoryItemResponse)
def update_item(item_id: int, data: InventoryItemUpdate, db: Session = Depends(get_db)):
    """재고 품목 기본 정보 수정"""
    result = service.update_item(db, item_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 재고 품목을 찾을 수 없습니다.")
    return result


@router.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db)):
    """재고 품목 삭제 (소프트 삭제)"""
    success = service.delete_item(db, item_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 재고 품목을 찾을 수 없습니다.")
    return {"success": True, "message": "재고 품목이 삭제되었습니다."}


# ─────────────────────────────────────────
# 재고 수량 조정 API
# ─────────────────────────────────────────

@router.post("/adjustments", response_model=InventoryAdjustmentResponse, status_code=201)
def adjust_quantity(data: InventoryAdjustmentCreate, db: Session = Depends(get_db)):
    """
    재고 수량 조정.
    입고, 출고, 실사조정, 폐기 처리를 수행합니다.
    """
    try:
        return service.adjust_quantity(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"재고 수량 조정 중 오류가 발생했습니다: {str(e)}")


@router.get("/adjustments", response_model=dict)
def get_adjustments(
    item_id: Optional[int] = Query(None, description="품목 필터"),
    start_date: Optional[str] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료 날짜 (YYYY-MM-DD)"),
    adjustment_type: Optional[str] = Query(None, description="조정 유형 필터"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """재고 수량 조정 이력 조회"""
    result = service.get_adjustment_history(
        db, item_id, start_date, end_date, adjustment_type, skip, limit
    )
    return {
        "success": True,
        "total": result["total"],
        "items": [InventoryAdjustmentResponse.model_validate(item) for item in result["items"]]
    }


# ─────────────────────────────────────────
# 발주서 API
# ─────────────────────────────────────────

@router.get("/orders", response_model=dict)
def get_orders(
    status: Optional[str] = Query(None, description="발주 상태 필터 (발주중/입고완료/취소)"),
    supplier: Optional[str] = Query(None, description="거래처명 검색"),
    start_date: Optional[str] = Query(None, description="시작 날짜 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="종료 날짜 (YYYY-MM-DD)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """발주서 목록 조회"""
    result = service.get_order_list(db, status, supplier, start_date, end_date, skip, limit)
    return {
        "success": True,
        "total": result["total"],
        "items": [PurchaseOrderResponse.model_validate(order) for order in result["items"]]
    }


@router.get("/orders/{order_id}", response_model=PurchaseOrderResponse)
def get_order(order_id: int, db: Session = Depends(get_db)):
    """발주서 단건 조회 (품목 포함)"""
    order = service.get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="해당 발주서를 찾을 수 없습니다.")
    return order


@router.post("/orders", response_model=PurchaseOrderResponse, status_code=201)
def create_order(data: PurchaseOrderCreate, db: Session = Depends(get_db)):
    """발주서 생성"""
    try:
        return service.create_order(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"발주서 생성 중 오류가 발생했습니다: {str(e)}")


@router.put("/orders/{order_id}", response_model=PurchaseOrderResponse)
def update_order(order_id: int, data: PurchaseOrderUpdate, db: Session = Depends(get_db)):
    """발주서 수정"""
    try:
        result = service.update_order(db, order_id, data)
        if not result:
            raise HTTPException(status_code=404, detail="해당 발주서를 찾을 수 없습니다.")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"발주서 수정 중 오류가 발생했습니다: {str(e)}")


@router.post("/orders/{order_id}/cancel")
def cancel_order(order_id: int, db: Session = Depends(get_db)):
    """발주서 취소"""
    try:
        success = service.cancel_order(db, order_id)
        if not success:
            raise HTTPException(status_code=404, detail="해당 발주서를 찾을 수 없습니다.")
        return {"success": True, "message": "발주서가 취소되었습니다."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"발주서 취소 중 오류가 발생했습니다: {str(e)}")


@router.post("/orders/{order_id}/receive", response_model=PurchaseOrderResponse)
def receive_order(
    order_id: int, data: ReceiveOrderRequest, db: Session = Depends(get_db)
):
    """
    발주서 입고 처리.
    실제 입고 수량을 입력하면 재고가 자동으로 증가합니다.
    """
    try:
        return service.receive_order(db, order_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"입고 처리 중 오류가 발생했습니다: {str(e)}")


@router.delete("/orders/{order_id}")
def delete_order(order_id: int, db: Session = Depends(get_db)):
    """발주서 삭제 (소프트 삭제)"""
    success = service.delete_order(db, order_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 발주서를 찾을 수 없습니다.")
    return {"success": True, "message": "발주서가 삭제되었습니다."}


# ─────────────────────────────────────────
# 초기 데이터 설정 API
# ─────────────────────────────────────────

@router.post("/seed-categories")
def seed_categories(db: Session = Depends(get_db)):
    """기본 재고 분류 데이터 초기화 (최초 설정 시 1회 사용)"""
    service.seed_default_categories(db)
    return {"success": True, "message": "기본 재고 분류가 생성되었습니다."}


# ─────────────────────────────────────────
# 재고 스냅샷 API (월초/월말 재고)
# 엔드포인트 등록 순서 주의:
#   1. /snapshot/confirm        (POST, 고정 경로)
#   2. /snapshot/generate/...   (POST, 고정 prefix)
#   3. /snapshot/{type}/{y}/{m} (GET, 동적 경로)
#   4. /snapshot/{id}           (PUT, 동적 경로 - GET과 메소드 다르므로 충돌 없음)
# ─────────────────────────────────────────

@router.post("/snapshot/confirm", response_model=SnapshotSummaryResponse)
def confirm_snapshot(data: SnapshotConfirmRequest, db: Session = Depends(get_db)):
    """
    스냅샷 확정 처리.
    확정 후 수정 불가. month_end 확정 시 다음달 month_start 자동 생성.
    """
    try:
        return service.confirm_snapshot(db, data.snapshot_type, data.year, data.month)
    except ValueError as e:
        # 확정할 데이터 없음, 이미 확정됨 등 비즈니스 오류
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"확정 처리 중 오류: {str(e)}")


@router.post(
    "/snapshot/generate/{snapshot_type}/{year}/{month}",
    response_model=SnapshotSummaryResponse
)
def generate_snapshot(
    snapshot_type: str,
    year: int,
    month: int,
    db: Session = Depends(get_db)
):
    """
    현재 재고 기준으로 스냅샷 초안 자동 생성.
    이미 확정된 스냅샷이 있으면 400 에러를 반환합니다.
    """
    try:
        return service.generate_snapshot(db, snapshot_type, year, month)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"초안 생성 중 오류: {str(e)}")


@router.get(
    "/snapshot/{snapshot_type}/{year}/{month}",
    response_model=SnapshotSummaryResponse
)
def get_snapshot(
    snapshot_type: str,
    year: int,
    month: int,
    db: Session = Depends(get_db)
):
    """
    스냅샷 조회.
    month_start이고 데이터가 없으면 직전달 month_end(확정)를 자동 복사 후 반환합니다.
    """
    try:
        return service.get_snapshot(db, snapshot_type, year, month)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"스냅샷 조회 중 오류: {str(e)}")


@router.put("/snapshot/{snapshot_id}", response_model=SnapshotSummaryResponse)
def update_snapshot_item(
    snapshot_id: int,
    data: InventorySnapshotUpdate,
    db: Session = Depends(get_db)
):
    """
    스냅샷 항목 수량/단가 수정 (확정 전만 가능).
    수정 후 해당 스냅샷 전체 요약을 반환합니다.
    """
    try:
        snap = service.update_snapshot_item(db, snapshot_id, data)
        if not snap:
            raise HTTPException(status_code=404, detail="스냅샷 항목을 찾을 수 없습니다.")
        # 수정된 항목이 속한 스냅샷 전체 요약 반환
        return service.get_snapshot(db, snap.snapshot_type, snap.year, snap.month)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"수정 중 오류: {str(e)}")
