# ============================================================
# routers/accounting.py — 세무/회계 API 라우터
# 지출 분류, 지출 기록, 매출 기록, 손익 계산 엔드포인트를 제공합니다.
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from schemas.accounting import (
    ExpenseCategoryCreate, ExpenseCategoryUpdate, ExpenseCategoryResponse,
    ExpenseRecordCreate, ExpenseRecordUpdate, ExpenseRecordResponse,
    SalesRecordCreate, SalesRecordUpdate, SalesRecordResponse,
    ProfitLossResponse
)
import services.accounting_service as service
from auth import require_role
from models.auth import User

# 라우터 인스턴스 생성
router = APIRouter()


# ─────────────────────────────────────────
# 지출 분류 API
# ─────────────────────────────────────────

@router.get("/categories", response_model=list[ExpenseCategoryResponse])
def get_categories(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """
    지출 분류 목록 전체 조회.
    삭제되지 않은 모든 분류를 반환합니다.
    """
    return service.get_all_categories(db)


@router.post("/categories", response_model=ExpenseCategoryResponse, status_code=201)
def create_category(
    data: ExpenseCategoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """지출 분류 새로 생성"""
    try:
        return service.create_category(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"지출 분류 생성 중 오류가 발생했습니다: {str(e)}")


@router.put("/categories/{category_id}", response_model=ExpenseCategoryResponse)
def update_category(
    category_id: int,
    data: ExpenseCategoryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """지출 분류 정보 수정"""
    result = service.update_category(db, category_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 지출 분류를 찾을 수 없습니다.")
    return result


@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """지출 분류 삭제 (소프트 삭제)"""
    success = service.delete_category(db, category_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 지출 분류를 찾을 수 없습니다.")
    return {"success": True, "message": "지출 분류가 삭제되었습니다."}


# ─────────────────────────────────────────
# 지출 기록 API
# ─────────────────────────────────────────

@router.get("/expenses", response_model=dict)
def get_expenses(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    category_id: Optional[int] = Query(None, description="분류 필터"),
    skip: int = Query(0, ge=0, description="페이지 오프셋"),
    limit: int = Query(50, ge=1, le=200, description="페이지 크기"),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """
    월별 지출 목록 조회.
    카테고리 필터와 페이지네이션을 지원합니다.
    """
    result = service.get_expense_list(db, year, month, category_id, skip, limit)
    return {
        "success": True,
        "total": result["total"],
        "items": [ExpenseRecordResponse.model_validate(item) for item in result["items"]]
    }


@router.get("/expenses/{expense_id}", response_model=ExpenseRecordResponse)
def get_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """지출 기록 단건 조회"""
    expense = service.get_expense_by_id(db, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="해당 지출 기록을 찾을 수 없습니다.")
    return expense


@router.post("/expenses", response_model=ExpenseRecordResponse, status_code=201)
def create_expense(
    data: ExpenseRecordCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """새 지출 기록 입력"""
    try:
        return service.create_expense(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"지출 기록 저장 중 오류가 발생했습니다: {str(e)}")


@router.put("/expenses/{expense_id}", response_model=ExpenseRecordResponse)
def update_expense(
    expense_id: int,
    data: ExpenseRecordUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """지출 기록 수정"""
    result = service.update_expense(db, expense_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 지출 기록을 찾을 수 없습니다.")
    return result


@router.delete("/expenses/{expense_id}")
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """지출 기록 삭제 (소프트 삭제)"""
    success = service.delete_expense(db, expense_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 지출 기록을 찾을 수 없습니다.")
    return {"success": True, "message": "지출 기록이 삭제되었습니다."}


# ─────────────────────────────────────────
# 매출 기록 API
# ─────────────────────────────────────────

@router.get("/sales", response_model=list[SalesRecordResponse])
def get_sales(
    year: int = Query(..., ge=2020, le=2099),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """월별 매출 기록 목록 조회"""
    return service.get_sales_by_month(db, year, month)


@router.post("/sales", response_model=SalesRecordResponse, status_code=201)
def create_sales(
    data: SalesRecordCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """매출 기록 입력"""
    try:
        return service.create_sales(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"매출 기록 저장 중 오류가 발생했습니다: {str(e)}")


@router.put("/sales/{sales_id}", response_model=SalesRecordResponse)
def update_sales(
    sales_id: int,
    data: SalesRecordUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """매출 기록 수정"""
    result = service.update_sales(db, sales_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 매출 기록을 찾을 수 없습니다.")
    return result


@router.delete("/sales/{sales_id}")
def delete_sales(
    sales_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """매출 기록 삭제 (소프트 삭제)"""
    success = service.delete_sales(db, sales_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 매출 기록을 찾을 수 없습니다.")
    return {"success": True, "message": "매출 기록이 삭제되었습니다."}


# ─────────────────────────────────────────
# 손익 계산 API
# ─────────────────────────────────────────

@router.get("/profit-loss", response_model=ProfitLossResponse)
def get_profit_loss(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """
    월별 손익 현황 계산.
    매출 합계, 지출 합계, 순이익, 전월 대비 증감률을 반환합니다.
    """
    try:
        return service.calculate_profit_loss(db, year, month)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"손익 계산 중 오류가 발생했습니다: {str(e)}")


@router.post("/seed-categories")
def seed_categories(
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin")),
):
    """기본 지출 분류 데이터 초기화 (최초 설정 시 1회 사용) — admin 전용"""
    service.seed_default_categories(db)
    return {"success": True, "message": "기본 지출 분류가 생성되었습니다."}
