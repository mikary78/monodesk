# ============================================================
# routers/corporate.py — 법인 관리 API 라우터
# 동업자, 배당 정산, 법인 비용, 재무 개요 엔드포인트를 제공합니다.
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from schemas.corporate import (
    PartnerCreate, PartnerUpdate, PartnerResponse,
    DividendSimulationRequest, DividendSimulationResponse,
    DividendRecordUpdate, DividendRecordResponse,
    CorporateExpenseCreate, CorporateExpenseUpdate, CorporateExpenseResponse,
    CorporateOverviewResponse,
)
import services.corporate_service as service

# 라우터 인스턴스 생성
router = APIRouter()


# ─────────────────────────────────────────
# 동업자 관리 API
# ─────────────────────────────────────────

@router.get("/partners", response_model=list[PartnerResponse])
def get_partners(db: Session = Depends(get_db)):
    """
    동업자 목록 전체 조회.
    지분율 높은 순으로 반환합니다.
    """
    return service.get_all_partners(db)


@router.get("/partners/{partner_id}", response_model=PartnerResponse)
def get_partner(partner_id: int, db: Session = Depends(get_db)):
    """동업자 단건 조회"""
    partner = service.get_partner_by_id(db, partner_id)
    if not partner:
        raise HTTPException(status_code=404, detail="해당 동업자를 찾을 수 없습니다.")
    return partner


@router.post("/partners", response_model=PartnerResponse, status_code=201)
def create_partner(data: PartnerCreate, db: Session = Depends(get_db)):
    """새 동업자 등록"""
    try:
        return service.create_partner(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"동업자 등록 중 오류가 발생했습니다: {str(e)}")


@router.put("/partners/{partner_id}", response_model=PartnerResponse)
def update_partner(partner_id: int, data: PartnerUpdate, db: Session = Depends(get_db)):
    """동업자 정보 수정"""
    try:
        result = service.update_partner(db, partner_id, data)
        if not result:
            raise HTTPException(status_code=404, detail="해당 동업자를 찾을 수 없습니다.")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"동업자 정보 수정 중 오류가 발생했습니다: {str(e)}")


@router.delete("/partners/{partner_id}")
def delete_partner(partner_id: int, db: Session = Depends(get_db)):
    """동업자 삭제 (소프트 삭제)"""
    success = service.delete_partner(db, partner_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 동업자를 찾을 수 없습니다.")
    return {"success": True, "message": "동업자가 삭제되었습니다."}


@router.post("/partners/seed")
def seed_partners(db: Session = Depends(get_db)):
    """기본 동업자 4명 초기 등록 (최초 설정 시 1회 사용)"""
    service.seed_default_partners(db)
    return {"success": True, "message": "기본 동업자 정보가 등록되었습니다."}


# ─────────────────────────────────────────
# 배당 정산 API
# 주의: 정적 경로를 동적 경로보다 먼저 등록
# ─────────────────────────────────────────

@router.post("/dividend/simulate", response_model=DividendSimulationResponse)
def simulate_dividend(data: DividendSimulationRequest, db: Session = Depends(get_db)):
    """
    배당 시뮬레이션 실행.
    DB에 저장하지 않고 계산 결과만 반환합니다.
    """
    try:
        return service.simulate_dividend(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"배당 시뮬레이션 중 오류가 발생했습니다: {str(e)}")


@router.post("/dividend/confirm", response_model=list[DividendRecordResponse])
def confirm_dividend(data: DividendSimulationRequest, db: Session = Depends(get_db)):
    """
    배당 정산을 확정하고 DB에 저장합니다.
    동일 연도에 이미 기록이 있으면 덮어씁니다.
    """
    try:
        return service.create_dividend_records(db, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"배당 확정 중 오류가 발생했습니다: {str(e)}")


@router.get("/dividend", response_model=list[DividendRecordResponse])
def get_dividend_records(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    db: Session = Depends(get_db),
):
    """연도별 배당 기록 목록 조회"""
    return service.get_dividend_records(db, year)


@router.put("/dividend/{record_id}", response_model=DividendRecordResponse)
def update_dividend_record(
    record_id: int, data: DividendRecordUpdate, db: Session = Depends(get_db)
):
    """배당 기록 지급 상태 수정"""
    result = service.update_dividend_record(db, record_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 배당 기록을 찾을 수 없습니다.")
    return result


@router.delete("/dividend/{year}")
def delete_dividend_records_by_year(year: int, db: Session = Depends(get_db)):
    """특정 연도의 배당 기록 전체 삭제 (소프트 삭제)"""
    count = service.delete_dividend_records_by_year(db, year)
    if count == 0:
        raise HTTPException(status_code=404, detail="해당 연도의 배당 기록이 없습니다.")
    return {"success": True, "message": f"{year}년 배당 기록 {count}건이 삭제되었습니다."}


# ─────────────────────────────────────────
# 법인 비용 API
# ─────────────────────────────────────────

@router.get("/expenses", response_model=dict)
def get_corporate_expenses(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: Optional[int] = Query(None, ge=1, le=12, description="조회 월 (없으면 연간 전체)"),
    category: Optional[str] = Query(None, description="분류 필터"),
    skip: int = Query(0, ge=0, description="페이지 오프셋"),
    limit: int = Query(50, ge=1, le=200, description="페이지 크기"),
    db: Session = Depends(get_db),
):
    """
    법인 비용 목록 조회.
    연도 필수, 월/분류 필터 선택 가능.
    """
    result = service.get_corporate_expenses(db, year, month, category, skip, limit)
    return {
        "success": True,
        "total": result["total"],
        "items": [CorporateExpenseResponse.model_validate(item) for item in result["items"]],
    }


@router.get("/expenses/{expense_id}", response_model=CorporateExpenseResponse)
def get_corporate_expense(expense_id: int, db: Session = Depends(get_db)):
    """법인 비용 단건 조회"""
    expense = service.get_corporate_expense_by_id(db, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="해당 법인 비용을 찾을 수 없습니다.")
    return expense


@router.post("/expenses", response_model=CorporateExpenseResponse, status_code=201)
def create_corporate_expense(data: CorporateExpenseCreate, db: Session = Depends(get_db)):
    """법인 비용 새로 등록"""
    try:
        return service.create_corporate_expense(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"법인 비용 등록 중 오류가 발생했습니다: {str(e)}")


@router.put("/expenses/{expense_id}", response_model=CorporateExpenseResponse)
def update_corporate_expense(
    expense_id: int, data: CorporateExpenseUpdate, db: Session = Depends(get_db)
):
    """법인 비용 수정"""
    result = service.update_corporate_expense(db, expense_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 법인 비용을 찾을 수 없습니다.")
    return result


@router.delete("/expenses/{expense_id}")
def delete_corporate_expense(expense_id: int, db: Session = Depends(get_db)):
    """법인 비용 삭제 (소프트 삭제)"""
    success = service.delete_corporate_expense(db, expense_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 법인 비용을 찾을 수 없습니다.")
    return {"success": True, "message": "법인 비용이 삭제되었습니다."}


# ─────────────────────────────────────────
# 법인 재무 개요 API
# ─────────────────────────────────────────

@router.get("/overview", response_model=CorporateOverviewResponse)
def get_corporate_overview(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    db: Session = Depends(get_db),
):
    """
    연도별 법인 재무 개요 조회.
    연간 매출, 총 지출, 순이익, 동업자별 예상 배당금을 반환합니다.
    """
    try:
        return service.get_corporate_overview(db, year)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"재무 개요 조회 중 오류가 발생했습니다: {str(e)}")
