# ============================================================
# routers/sales_analysis.py — 매출 분석 API 라우터
# POS 가져오기, 트렌드 분석, 메뉴 분석, 시간대 분석 엔드포인트를 제공합니다.
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from schemas.sales_analysis import (
    PosImportResult, PosImportResponse,
    SalesTrendResponse, SalesSummaryResponse,
    MenuAnalysisResponse,
    TimeAnalysisResponse,
    PaymentAnalysisResponse,
    MenuItemUpdate, MenuItemResponse,
    SalesTargetCreate, SalesTargetResponse,
    AiInsightRequest, AiInsightResponse,
)
import services.sales_analysis_service as service
from auth import require_role

# 라우터 인스턴스 생성 — admin/manager 전용 (라우터 레벨 권한 적용)
router = APIRouter(dependencies=[Depends(require_role("admin", "manager"))])

# CSV/Excel 업로드 허용 파일 크기 (10MB)
MAX_FILE_SIZE = 10 * 1024 * 1024


# ─────────────────────────────────────────
# POS 데이터 가져오기 API
# ─────────────────────────────────────────

@router.post("/import", response_model=PosImportResult)
async def import_pos_csv(
    file: UploadFile = File(..., description="POS CSV 또는 Excel 파일"),
    db: Session = Depends(get_db),
):
    """
    POS 파일을 업로드하고 데이터를 파싱하여 저장합니다.
    - 지원 형식: CSV (UTF-8, CP949), Excel (.xlsx)
    - 최대 파일 크기: 10MB
    - 중복 파일 자동 감지
    """
    # 파일 확장자 검사
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일명이 없습니다.")

    file_ext = file.filename.rsplit(".", 1)[-1].lower()
    if file_ext not in ["csv", "txt", "xlsx"]:
        raise HTTPException(
            status_code=400,
            detail="CSV 또는 Excel 파일만 업로드 가능합니다. (.csv, .txt, .xlsx)"
        )

    # 파일 내용 읽기
    file_bytes = await file.read()

    # 파일 크기 검사
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"파일 크기가 너무 큽니다. 최대 {MAX_FILE_SIZE // 1024 // 1024}MB까지 업로드 가능합니다."
        )

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")

    try:
        # xlsx 파일은 Excel 파싱 경로, 나머지는 CSV 파싱 경로
        if file_ext == "xlsx":
            result = service.parse_xlsx_file(db, file_bytes, file.filename)
        else:
            result = service.parse_csv_file(db, file_bytes, file.filename)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"파일 처리 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/imports", response_model=list[PosImportResponse])
def get_import_history(
    limit: int = Query(20, ge=1, le=100, description="조회 개수"),
    db: Session = Depends(get_db),
):
    """
    POS 파일 가져오기 이력 목록을 반환합니다.
    최신 가져오기부터 내림차순으로 정렬됩니다.
    """
    return service.get_import_history(db, limit)


@router.delete("/imports/{import_id}")
def delete_import(import_id: int, db: Session = Depends(get_db)):
    """
    특정 가져오기 이력과 연결된 판매 데이터를 삭제합니다.
    잘못 가져온 데이터를 제거할 때 사용합니다.
    """
    success = service.delete_import(db, import_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 가져오기 이력을 찾을 수 없습니다.")
    return {"success": True, "message": "가져오기 데이터가 삭제되었습니다."}


# ─────────────────────────────────────────
# 매출 요약 KPI API
# ─────────────────────────────────────────

@router.get("/summary", response_model=SalesSummaryResponse)
def get_sales_summary(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    db: Session = Depends(get_db),
):
    """
    월별 매출 요약 KPI를 반환합니다.
    총매출, 주문건수, 평균주문금액, 전월 대비, 목표 달성률 포함.
    """
    try:
        return service.get_sales_summary(db, year, month)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"매출 요약 데이터 조회 중 오류가 발생했습니다: {str(e)}"
        )


# ─────────────────────────────────────────
# 매출 트렌드 분석 API
# ─────────────────────────────────────────

@router.get("/trend", response_model=SalesTrendResponse)
def get_sales_trend(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    period_type: str = Query("daily", description="집계 단위: daily / weekly / monthly"),
    db: Session = Depends(get_db),
):
    """
    매출 트렌드 데이터를 반환합니다.
    - daily: 해당 월의 일별 매출
    - weekly: 해당 월의 주별 매출
    - monthly: 해당 연도의 월별 매출
    """
    if period_type not in ["daily", "weekly", "monthly"]:
        raise HTTPException(
            status_code=400,
            detail="period_type은 daily, weekly, monthly 중 하나여야 합니다."
        )
    try:
        return service.get_sales_trend(db, year, month, period_type)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"매출 트렌드 조회 중 오류가 발생했습니다: {str(e)}"
        )


# ─────────────────────────────────────────
# 메뉴 분석 API
# ─────────────────────────────────────────

@router.get("/menu-analysis", response_model=MenuAnalysisResponse)
def get_menu_analysis(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    category: Optional[str] = Query(None, description="카테고리 필터"),
    db: Session = Depends(get_db),
):
    """
    메뉴별 판매 분석을 반환합니다.
    - TOP 10 인기 메뉴 (매출 기여도 포함)
    - BOTTOM 10 비인기 메뉴
    - 카테고리별 집계
    """
    try:
        return service.get_menu_analysis(db, year, month, category)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"메뉴 분석 데이터 조회 중 오류가 발생했습니다: {str(e)}"
        )


# ─────────────────────────────────────────
# 시간대/요일 분석 API
# ─────────────────────────────────────────

@router.get("/time-analysis", response_model=TimeAnalysisResponse)
def get_time_analysis(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    db: Session = Depends(get_db),
):
    """
    시간대별, 요일별 매출 패턴을 분석합니다.
    피크 시간대와 한산한 시간대, 바쁜 요일을 포함합니다.
    """
    try:
        return service.get_time_analysis(db, year, month)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"시간대 분석 데이터 조회 중 오류가 발생했습니다: {str(e)}"
        )


# ─────────────────────────────────────────
# 결제 수단 분석 API
# ─────────────────────────────────────────

@router.get("/payment-analysis", response_model=PaymentAnalysisResponse)
def get_payment_analysis(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    db: Session = Depends(get_db),
):
    """
    결제 수단별 매출 비중과 월별 변화 추이를 반환합니다.
    """
    try:
        return service.get_payment_analysis(db, year, month)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"결제 수단 분석 데이터 조회 중 오류가 발생했습니다: {str(e)}"
        )


# ─────────────────────────────────────────
# 메뉴 마스터 관리 API
# ─────────────────────────────────────────

@router.get("/menus", response_model=list[MenuItemResponse])
def get_menu_items(
    active_only: bool = Query(True, description="활성 메뉴만 조회"),
    db: Session = Depends(get_db),
):
    """메뉴 마스터 목록 조회 (POS 가져오기 시 자동 생성됨)"""
    return service.get_menu_items(db, active_only)


@router.put("/menus/{menu_id}", response_model=MenuItemResponse)
def update_menu_item(
    menu_id: int,
    data: MenuItemUpdate,
    db: Session = Depends(get_db),
):
    """메뉴 마스터 정보 수정 (원가, 카테고리, 계절 메뉴 여부 등)"""
    result = service.update_menu_item(db, menu_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 메뉴를 찾을 수 없습니다.")
    return result


# ─────────────────────────────────────────
# 목표 매출 API
# ─────────────────────────────────────────

@router.post("/targets", response_model=SalesTargetResponse)
def upsert_sales_target(data: SalesTargetCreate, db: Session = Depends(get_db)):
    """월별 목표 매출을 등록하거나 수정합니다."""
    try:
        return service.upsert_sales_target(db, data)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"목표 매출 저장 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/targets/{year}/{month}", response_model=SalesTargetResponse)
def get_sales_target(year: int, month: int, db: Session = Depends(get_db)):
    """특정 월의 목표 매출 조회"""
    target = service.get_sales_target(db, year, month)
    if not target:
        raise HTTPException(status_code=404, detail="해당 월의 목표 매출이 설정되지 않았습니다.")
    return target


# ─────────────────────────────────────────
# AI 경영 인사이트 API
# ─────────────────────────────────────────

@router.post("/ai-insight", response_model=AiInsightResponse)
def generate_ai_insight(data: AiInsightRequest, db: Session = Depends(get_db)):
    """
    Ollama를 사용하여 매출 데이터 기반 경영 인사이트를 생성합니다.
    Ollama가 실행 중이 아닌 경우 기본 텍스트 분석으로 자동 대체됩니다.
    """
    try:
        return service.generate_ai_insight(db, data.year, data.month)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI 인사이트 생성 중 오류가 발생했습니다: {str(e)}"
        )
