# ============================================================
# routers/sales_analysis.py — 매출 분석 API 라우터
# POS 가져오기, 트렌드 분석, 메뉴 분석, 시간대 분석, 상품별 판매 엔드포인트를 제공합니다.
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
    # 상품별 판매 스키마
    ProductSalesListResponse, ProductSalesUploadResponse,
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


# ─────────────────────────────────────────
# 상품별 월간 판매 API
# ─────────────────────────────────────────

def _parse_product_sales_xlsx(file_bytes: bytes) -> tuple[list[dict], int, int]:
    """
    상품별매출 엑셀 파일을 파싱하여 상품 데이터 목록과 연/월을 반환합니다.

    엑셀 구조:
    - row1: 기간 정보 ("조회기간 : 2026-04-01 ~ 2026-04-30")
    - row2~3: 가맹점 정보 (스킵)
    - row4: 주요 헤더 (브랜드, 상품코드, 상품명, 상품분류, 과세구분, 상품상태, 합계)
    - row5: 서브 헤더 (총판매수량, 상품원가, 총판매금액, 판매수량비율, 판매금액, 판매금액비율)
    - row6~: 실제 데이터 (상품 하나씩)

    반환: (상품_딕셔너리_목록, 연도, 월)
    """
    import openpyxl
    import re
    from io import BytesIO

    # openpyxl로 엑셀 파일 읽기 (data_only=True: 수식이 아닌 값 읽기)
    wb = openpyxl.load_workbook(BytesIO(file_bytes), data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))

    # ── 기간 추출 (row1) ──────────────────────────────────────
    # 예: "조회기간 : 2026-04-01 ~ 2026-04-30"
    period_text = str(rows[0][0] or "") if rows else ""
    year, month = None, None

    # 정규식으로 시작 날짜에서 연/월 추출
    m = re.search(r"(\d{4})-(\d{2})-\d{2}", period_text)
    if m:
        year = int(m.group(1))
        month = int(m.group(2))

    # 기간 파싱 실패 시 기본값 (파일명에서 못 찾으면 호출측에서 처리)
    if not year or not month:
        raise ValueError(
            f"엑셀 파일에서 조회 기간을 찾을 수 없습니다. "
            f"첫 번째 셀 값: '{period_text}'"
        )

    # ── 상품 데이터 파싱 (row6부터) ──────────────────────────
    result = []
    # rows[5:]는 파이썬 0-based index: rows[0]=row1, rows[5]=row6(첫 데이터행)
    for row in rows[5:]:
        # 상품명(col[2]) 없으면 합계행 또는 빈 행 — 스킵
        if not row[2]:
            continue

        # 총판매수량(col[6]) — 숫자이고 0보다 커야 의미 있는 데이터
        qty = row[6]
        if not isinstance(qty, (int, float)) or qty <= 0:
            continue

        # 판매금액(col[10]) — 판매금액비율 기준으로 사용
        # total_sales(col[8])은 단가 미등록 시 0이므로 col[10]을 보조로 저장
        result.append({
            "product_code": str(row[1]).strip() if row[1] else None,
            "product_name": str(row[2]).strip(),
            "category":     str(row[3]).strip() if row[3] else None,
            "tax_type":     str(row[4]).strip() if row[4] else None,
            "status":       str(row[5]).strip() if row[5] else None,
            "quantity":     int(qty),
            "unit_cost":    float(row[7] or 0),     # 상품 원가 (단가 미등록 시 0)
            "total_sales":  float(row[8] or 0),     # 총판매금액 (단가 미등록 시 0)
            "quantity_ratio": float(row[9] or 0),   # 판매수량비율 (%)
            "sales_ratio":  float(row[11] or 0),    # 판매금액비율 (%)
        })

    return result, year, month


@router.get("/product-sales", response_model=ProductSalesListResponse)
def get_product_sales(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    category: Optional[str] = Query(None, description="카테고리 필터 (없으면 전체)"),
    db: Session = Depends(get_db),
):
    """
    월별 상품 판매 현황을 조회합니다.
    - 판매 수량 내림차순 정렬
    - category 파라미터로 특정 분류만 필터링 가능
    - 프론트엔드 필터 드롭다운용 카테고리 목록도 함께 반환
    """
    from models.accounting import ProductSalesMonthly
    from sqlalchemy import func

    # 기본 쿼리: 해당 연/월 데이터 전체
    query = db.query(ProductSalesMonthly).filter(
        ProductSalesMonthly.year == year,
        ProductSalesMonthly.month == month,
    )

    # 카테고리 필터가 있으면 적용
    if category:
        query = query.filter(ProductSalesMonthly.category == category)

    # 수량 내림차순 정렬
    items = query.order_by(ProductSalesMonthly.quantity.desc()).all()

    # 해당 연/월의 전체 카테고리 목록 (필터 드롭다운용)
    # 카테고리 필터와 무관하게 전체 데이터에서 추출
    categories_raw = (
        db.query(ProductSalesMonthly.category)
        .filter(
            ProductSalesMonthly.year == year,
            ProductSalesMonthly.month == month,
            ProductSalesMonthly.category.isnot(None),
        )
        .distinct()
        .all()
    )
    # None 제거 후 정렬
    categories = sorted([c[0] for c in categories_raw if c[0]])

    # 전체 수량 합계 (필터 적용 상태 기준)
    total_quantity = sum(item.quantity for item in items)

    return ProductSalesListResponse(
        year=year,
        month=month,
        total_products=len(items),
        total_quantity=total_quantity,
        categories=categories,
        items=items,
    )


@router.post("/product-sales/upload", response_model=ProductSalesUploadResponse)
async def upload_product_sales(
    file: UploadFile = File(..., description="상품별매출 xlsx 파일"),
    db: Session = Depends(get_db),
):
    """
    상품별매출 xlsx 파일을 업로드하고 DB에 저장합니다.
    - 같은 연/월의 기존 데이터는 전체 삭제 후 재삽입 (upsert)
    - 파일명 예시: 상품별매출_202604.xlsx
    """
    from models.accounting import ProductSalesMonthly

    # 파일 확장자 검사 — xlsx만 허용
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(
            status_code=400,
            detail="xlsx 파일만 업로드 가능합니다. (상품별매출_YYYYMM.xlsx)"
        )

    # 파일 내용 읽기
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="빈 파일입니다.")

    # 파일 크기 제한 (10MB)
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"파일 크기가 너무 큽니다. 최대 10MB까지 가능합니다."
        )

    try:
        # 엑셀 파싱 — 상품 목록과 연/월 반환
        product_list, year, month = _parse_product_sales_xlsx(file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"엑셀 파일 파싱 중 오류가 발생했습니다: {str(e)}"
        )

    if not product_list:
        raise HTTPException(
            status_code=422,
            detail="파싱된 상품 데이터가 없습니다. 파일 형식을 확인해주세요."
        )

    # 기존 해당 연/월 데이터 전체 삭제 (재업로드 시 초기화)
    deleted_count = (
        db.query(ProductSalesMonthly)
        .filter(
            ProductSalesMonthly.year == year,
            ProductSalesMonthly.month == month,
        )
        .delete()
    )

    # 파싱된 상품 데이터 일괄 삽입
    new_records = [
        ProductSalesMonthly(
            year=year,
            month=month,
            **product_data,  # product_code, product_name, category, ... 딕셔너리 언패킹
        )
        for product_data in product_list
    ]
    db.add_all(new_records)
    db.commit()

    return ProductSalesUploadResponse(
        success=True,
        inserted=len(new_records),
        year=year,
        month=month,
        message=(
            f"{year}년 {month}월 상품별 판매 데이터 {len(new_records)}건이 저장되었습니다."
            + (f" (기존 {deleted_count}건 교체)" if deleted_count else "")
        ),
    )


@router.delete("/product-sales")
def delete_product_sales(
    year: int = Query(..., ge=2020, le=2099, description="삭제할 연도"),
    month: int = Query(..., ge=1, le=12, description="삭제할 월"),
    db: Session = Depends(get_db),
):
    """
    특정 연/월의 상품별 판매 데이터 전체를 삭제합니다.
    admin / manager 권한만 사용 가능합니다.
    """
    from models.accounting import ProductSalesMonthly

    # 해당 연/월 데이터 전체 삭제
    deleted = (
        db.query(ProductSalesMonthly)
        .filter(
            ProductSalesMonthly.year == year,
            ProductSalesMonthly.month == month,
        )
        .delete()
    )
    db.commit()

    if deleted == 0:
        # 삭제할 데이터가 없어도 성공으로 처리 (멱등성)
        return {
            "success": True,
            "deleted": 0,
            "message": f"{year}년 {month}월 삭제할 데이터가 없습니다.",
        }

    return {
        "success": True,
        "deleted": deleted,
        "message": f"{year}년 {month}월 상품별 판매 데이터 {deleted}건이 삭제되었습니다.",
    }
