# ============================================================
# routers/dashboard.py — 대시보드 API 라우터
# 모든 모듈의 KPI를 집계해 한 번에 반환하는 엔드포인트를 제공합니다.
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from schemas.dashboard import DashboardResponse, DailyKpiResponse, WeeklyKpiResponse, MonthlyKpiResponse
import services.dashboard_service as service
from auth import require_role

# 라우터 인스턴스 생성 — admin/manager 전용 (라우터 레벨 권한 적용)
router = APIRouter(dependencies=[Depends(require_role("admin", "manager"))])


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


@router.get("/daily", response_model=DailyKpiResponse)
def get_daily_kpi(
    date: str = Query(..., description="조회 날짜 (YYYY-MM-DD 형식)"),
    db: Session = Depends(get_db),
):
    """
    일별 KPI 집계 API.
    특정 날짜의 매출/지출, 전일·전주 비교, 월 누적 현황을 반환합니다.

    - date: 조회 날짜 (예: 2026-04-07)
    """
    try:
        # 날짜 형식 유효성 검사
        from datetime import date as dt
        dt.fromisoformat(date)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.",
        )
    try:
        return service.get_daily_kpi(db, date)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"일별 KPI 조회 중 오류가 발생했습니다: {str(e)}",
        )


@router.get("/weekly", response_model=WeeklyKpiResponse)
def get_weekly_kpi(
    date: str = Query(..., description="조회 기준 날짜 (YYYY-MM-DD 형식)"),
    db: Session = Depends(get_db),
):
    """
    주별 KPI 집계 API.
    해당 날짜가 속한 주(월~일)의 요일별 매출, 전주 대비를 반환합니다.

    - date: 기준 날짜 (예: 2026-04-07) — 해당 날짜의 주(월~일)를 집계
    """
    try:
        from datetime import date as dt
        dt.fromisoformat(date)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail="날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.",
        )
    try:
        return service.get_weekly_kpi(db, date)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"주별 KPI 조회 중 오류가 발생했습니다: {str(e)}",
        )


@router.get("/monthly", response_model=MonthlyKpiResponse)
def get_monthly_kpi(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    db: Session = Depends(get_db),
):
    """
    월별 상세 KPI 집계 API.
    손익 구조(원재료비/인건비/고정비), 일별/주차별 트렌드, 달력 히트맵 데이터를 반환합니다.

    - year: 조회 연도 (2020~2099)
    - month: 조회 월 (1~12)
    """
    try:
        return service.get_monthly_kpi(db, year, month)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"월별 KPI 조회 중 오류가 발생했습니다: {str(e)}",
        )
