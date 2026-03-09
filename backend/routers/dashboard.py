# ============================================================
# routers/dashboard.py — 대시보드 API 라우터
# 모든 모듈의 KPI를 집계해 한 번에 반환하는 엔드포인트를 제공합니다.
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from schemas.dashboard import DashboardResponse
import services.dashboard_service as service

# 라우터 인스턴스 생성
router = APIRouter()


@router.get("/summary", response_model=DashboardResponse)
def get_dashboard_summary(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    db: Session = Depends(get_db),
):
    """
    대시보드 전체 KPI 집계 API.
    손익 현황, 매출 트렌드, 재고 경고, 급여 현황, 최근 지출을 한 번에 반환합니다.

    - year: 조회 연도 (2020~2099)
    - month: 조회 월 (1~12)
    """
    try:
        return service.get_dashboard_data(db, year, month)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"대시보드 데이터 조회 중 오류가 발생했습니다: {str(e)}",
        )
