# ============================================================
# routers/operations.py — 운영 관리 API 라우터
# 공지사항, 위생점검, 영업일 관리, 업무 체크리스트 엔드포인트
# 주의: 정적 경로를 동적 경로({id}) 보다 반드시 먼저 등록해야 합니다.
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from schemas.operations import (
    NoticeCreate, NoticeUpdate, NoticeResponse,
    HygieneChecklistCreate, HygieneChecklistUpdate, HygieneChecklistResponse,
    HygieneRecordCreate, HygieneRecordUpdate, HygieneRecordResponse,
    BusinessDayCreate, BusinessDayUpdate, BusinessDayResponse,
    TaskChecklistCreate, TaskChecklistUpdate, TaskChecklistResponse,
    TaskRecordCreate, TaskRecordUpdate, TaskRecordResponse,
    VendorCreate, VendorUpdate, VendorResponse,
    DailyClosingCreate, DailyClosingResponse,
    DailyIssueCreate, DailyIssueUpdate, DailyIssueResponse,
    FixedCostItemCreate, FixedCostItemUpdate, FixedCostItemResponse,
    FixedCostRecordUpdate, FixedCostRecordResponse, FixedCostMonthlyResponse,
)
import services.operations_service as service
from auth import require_role

# 라우터 인스턴스 생성 — admin/manager 전용 (라우터 레벨 권한 적용)
router = APIRouter(dependencies=[Depends(require_role("admin", "manager"))])


# ─────────────────────────────────────────
# 공지사항 API
# ─────────────────────────────────────────

@router.get("/notices", response_model=dict)
def get_notices(
    notice_type: Optional[str] = Query(None, description="공지 유형 필터 (notice/memo/urgent)"),
    skip: int = Query(0, ge=0, description="페이지 오프셋"),
    limit: int = Query(50, ge=1, le=200, description="페이지 크기"),
    db: Session = Depends(get_db)
):
    """
    공지사항 목록 조회.
    고정 공지 우선, 최신순 정렬. 유형 필터 지원.
    """
    result = service.get_all_notices(db, notice_type, skip, limit)
    return {
        "success": True,
        "total": result["total"],
        "items": [NoticeResponse.model_validate(item) for item in result["items"]],
    }


@router.post("/notices", response_model=NoticeResponse, status_code=201)
def create_notice(data: NoticeCreate, db: Session = Depends(get_db)):
    """공지사항 생성. 긴급 공지는 자동으로 상단 고정됩니다."""
    try:
        return service.create_notice(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"공지사항 저장 중 오류가 발생했습니다: {str(e)}")


@router.get("/notices/{notice_id}", response_model=NoticeResponse)
def get_notice(notice_id: int, db: Session = Depends(get_db)):
    """공지사항 단건 조회"""
    notice = service.get_notice_by_id(db, notice_id)
    if not notice:
        raise HTTPException(status_code=404, detail="해당 공지사항을 찾을 수 없습니다.")
    return notice


@router.put("/notices/{notice_id}", response_model=NoticeResponse)
def update_notice(notice_id: int, data: NoticeUpdate, db: Session = Depends(get_db)):
    """공지사항 수정"""
    result = service.update_notice(db, notice_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 공지사항을 찾을 수 없습니다.")
    return result


@router.delete("/notices/{notice_id}")
def delete_notice(notice_id: int, db: Session = Depends(get_db)):
    """공지사항 소프트 삭제"""
    success = service.delete_notice(db, notice_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 공지사항을 찾을 수 없습니다.")
    return {"success": True, "message": "공지사항이 삭제되었습니다."}


# ─────────────────────────────────────────
# 위생 점검 체크리스트 API
# ─────────────────────────────────────────

@router.get("/hygiene/checklists", response_model=list[HygieneChecklistResponse])
def get_hygiene_checklists(
    check_type: Optional[str] = Query(None, description="점검 구분 필터 (open/close/daily)"),
    category: Optional[str] = Query(None, description="카테고리 필터 (kitchen/hall/restroom/equipment)"),
    db: Session = Depends(get_db)
):
    """위생 점검 항목 목록 조회"""
    return service.get_all_hygiene_checklists(db, check_type, category)


@router.post("/hygiene/checklists", response_model=HygieneChecklistResponse, status_code=201)
def create_hygiene_checklist(data: HygieneChecklistCreate, db: Session = Depends(get_db)):
    """위생 점검 항목 추가"""
    try:
        return service.create_hygiene_checklist(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"위생 점검 항목 저장 중 오류가 발생했습니다: {str(e)}")


@router.put("/hygiene/checklists/{item_id}", response_model=HygieneChecklistResponse)
def update_hygiene_checklist(item_id: int, data: HygieneChecklistUpdate, db: Session = Depends(get_db)):
    """위생 점검 항목 수정"""
    result = service.update_hygiene_checklist(db, item_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 위생 점검 항목을 찾을 수 없습니다.")
    return result


@router.delete("/hygiene/checklists/{item_id}")
def delete_hygiene_checklist(item_id: int, db: Session = Depends(get_db)):
    """위생 점검 항목 소프트 삭제"""
    success = service.delete_hygiene_checklist(db, item_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 위생 점검 항목을 찾을 수 없습니다.")
    return {"success": True, "message": "위생 점검 항목이 삭제되었습니다."}


@router.get("/hygiene/monthly-summary")
def get_hygiene_monthly_summary(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    db: Session = Depends(get_db)
):
    """
    월별 위생 점검 현황 요약.
    날짜별 완료율 목록을 반환합니다.
    """
    try:
        return service.get_hygiene_monthly_summary(db, year, month)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"위생 점검 월별 집계 중 오류가 발생했습니다: {str(e)}")


@router.get("/hygiene/records")
def get_hygiene_records_by_date(
    check_date: str = Query(..., description="점검 날짜 (YYYY-MM-DD)"),
    db: Session = Depends(get_db)
):
    """
    특정 날짜의 위생 점검 기록 조회.
    체크리스트 항목 정보와 점검 결과를 함께 반환합니다.
    """
    try:
        return service.get_hygiene_records_by_date(db, check_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"위생 점검 기록 조회 중 오류가 발생했습니다: {str(e)}")


@router.post("/hygiene/records", response_model=HygieneRecordResponse, status_code=201)
def upsert_hygiene_record(data: HygieneRecordCreate, db: Session = Depends(get_db)):
    """
    위생 점검 결과 저장.
    날짜+항목 조합으로 upsert 처리합니다.
    """
    try:
        return service.upsert_hygiene_record(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"위생 점검 기록 저장 중 오류가 발생했습니다: {str(e)}")


@router.post("/hygiene/seed")
def seed_hygiene_checklists(db: Session = Depends(get_db)):
    """기본 위생 점검 항목 초기화 (최초 설정 시 1회 사용)"""
    service.seed_default_hygiene_checklists(db)
    return {"success": True, "message": "기본 위생 점검 항목이 생성되었습니다."}


# ─────────────────────────────────────────
# 영업일 관리 API
# ─────────────────────────────────────────

@router.get("/business-days/monthly-stats")
def get_business_month_stats(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    db: Session = Depends(get_db)
):
    """
    월별 영업 현황 통계.
    정상 영업일, 휴무일, 특별영업일 집계를 반환합니다.
    """
    try:
        return service.get_business_month_stats(db, year, month)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"영업일 통계 집계 중 오류가 발생했습니다: {str(e)}")


@router.get("/business-days", response_model=list[BusinessDayResponse])
def get_business_days(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    db: Session = Depends(get_db)
):
    """월별 영업일 목록 조회"""
    return service.get_business_days_by_month(db, year, month)


@router.post("/business-days", response_model=BusinessDayResponse, status_code=201)
def upsert_business_day(data: BusinessDayCreate, db: Session = Depends(get_db)):
    """
    영업일 기록 저장.
    같은 날짜 기록이 있으면 업데이트, 없으면 신규 생성합니다.
    """
    try:
        return service.upsert_business_day(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"영업일 저장 중 오류가 발생했습니다: {str(e)}")


@router.get("/business-days/{date}", response_model=BusinessDayResponse)
def get_business_day(date: str, db: Session = Depends(get_db)):
    """특정 날짜 영업일 기록 단건 조회"""
    day = service.get_business_day_by_date(db, date)
    if not day:
        raise HTTPException(status_code=404, detail="해당 날짜의 영업일 기록이 없습니다.")
    return day


@router.delete("/business-days/{date}")
def delete_business_day(date: str, db: Session = Depends(get_db)):
    """특정 날짜 영업일 기록 삭제"""
    success = service.delete_business_day(db, date)
    if not success:
        raise HTTPException(status_code=404, detail="해당 날짜의 영업일 기록이 없습니다.")
    return {"success": True, "message": "영업일 기록이 삭제되었습니다."}


# ─────────────────────────────────────────
# 업무 체크리스트 API
# ─────────────────────────────────────────

@router.get("/tasks/checklists", response_model=list[TaskChecklistResponse])
def get_task_checklists(
    task_type: Optional[str] = Query(None, description="업무 구분 필터 (open/close/weekly/monthly)"),
    db: Session = Depends(get_db)
):
    """업무 체크리스트 항목 목록 조회"""
    return service.get_all_task_checklists(db, task_type)


@router.post("/tasks/checklists", response_model=TaskChecklistResponse, status_code=201)
def create_task_checklist(data: TaskChecklistCreate, db: Session = Depends(get_db)):
    """업무 체크리스트 항목 추가"""
    try:
        return service.create_task_checklist(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"업무 항목 저장 중 오류가 발생했습니다: {str(e)}")


@router.put("/tasks/checklists/{task_id}", response_model=TaskChecklistResponse)
def update_task_checklist(task_id: int, data: TaskChecklistUpdate, db: Session = Depends(get_db)):
    """업무 체크리스트 항목 수정"""
    result = service.update_task_checklist(db, task_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 업무 항목을 찾을 수 없습니다.")
    return result


@router.delete("/tasks/checklists/{task_id}")
def delete_task_checklist(task_id: int, db: Session = Depends(get_db)):
    """업무 체크리스트 항목 소프트 삭제"""
    success = service.delete_task_checklist(db, task_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 업무 항목을 찾을 수 없습니다.")
    return {"success": True, "message": "업무 항목이 삭제되었습니다."}


@router.get("/tasks/records")
def get_task_records(
    record_date: str = Query(..., description="조회 날짜 (YYYY-MM-DD)"),
    task_type: Optional[str] = Query(None, description="업무 구분 필터"),
    db: Session = Depends(get_db)
):
    """
    특정 날짜의 업무 체크리스트 완료 현황 조회.
    업무 항목 정보와 완료 여부를 함께 반환합니다.
    """
    try:
        return service.get_task_records_by_date(db, record_date, task_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"업무 기록 조회 중 오류가 발생했습니다: {str(e)}")


@router.post("/tasks/records", response_model=TaskRecordResponse, status_code=201)
def upsert_task_record(data: TaskRecordCreate, db: Session = Depends(get_db)):
    """
    업무 완료 기록 저장.
    날짜+업무 조합으로 upsert 처리합니다.
    """
    try:
        return service.upsert_task_record(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"업무 기록 저장 중 오류가 발생했습니다: {str(e)}")


@router.post("/tasks/seed")
def seed_task_checklists(db: Session = Depends(get_db)):
    """기본 업무 체크리스트 항목 초기화 (최초 설정 시 1회 사용)"""
    service.seed_default_task_checklists(db)
    return {"success": True, "message": "기본 업무 체크리스트 항목이 생성되었습니다."}


# ─────────────────────────────────────────
# 거래처 관리 API
# ─────────────────────────────────────────

@router.get("/vendors", response_model=list[VendorResponse])
def get_vendors(
    category: Optional[str] = Query(None, description="카테고리 필터 (식자재/주류/소모품/기타)"),
    search: Optional[str] = Query(None, description="거래처명 또는 담당자명 검색"),
    db: Session = Depends(get_db)
):
    """
    거래처 목록 조회.
    카테고리 필터 및 검색어 지원. 카테고리→이름 순 정렬.
    """
    return service.get_all_vendors(db, category, search)


@router.post("/vendors", response_model=VendorResponse, status_code=201)
def create_vendor(data: VendorCreate, db: Session = Depends(get_db)):
    """거래처 등록"""
    try:
        return service.create_vendor(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"거래처 등록 중 오류가 발생했습니다: {str(e)}")


@router.put("/vendors/{vendor_id}", response_model=VendorResponse)
def update_vendor(vendor_id: int, data: VendorUpdate, db: Session = Depends(get_db)):
    """거래처 정보 수정"""
    result = service.update_vendor(db, vendor_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 거래처를 찾을 수 없습니다.")
    return result


@router.delete("/vendors/{vendor_id}")
def delete_vendor(vendor_id: int, db: Session = Depends(get_db)):
    """거래처 소프트 삭제"""
    success = service.delete_vendor(db, vendor_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 거래처를 찾을 수 없습니다.")
    return {"success": True, "message": "거래처가 삭제되었습니다."}


# ─────────────────────────────────────────
# 현금 시재 API
# ─────────────────────────────────────────
# 주의: /closing/list 정적 경로를 /closing/{date} 동적 경로보다 먼저 등록

@router.get("/closing/list", response_model=list[DailyClosingResponse])
def get_closing_list(
    year:  int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    db: Session = Depends(get_db),
):
    """월별 현금 시재 목록 조회"""
    return service.get_closing_list(db, year, month)


@router.get("/closing/{date}", response_model=DailyClosingResponse)
def get_closing_by_date(date: str, db: Session = Depends(get_db)):
    """
    특정 날짜 시재 조회.
    기록이 없으면 전일 잔액을 prev_day_cash로 세팅하여 빈 폼 데이터 반환.
    """
    closing = service.get_closing_by_date(db, date)
    if closing:
        return closing

    # 기록 없음 → 전일 잔액 포함 빈 응답 (저장 전 폼 초기값용)
    from datetime import datetime as _dt
    prev_balance = service._get_prev_day_balance(db, date)
    return DailyClosingResponse(
        id=0,
        closing_date=date,
        bill_100000=0, bill_50000=0, bill_10000=0,
        bill_5000=0, bill_1000=0, coin_500=0, coin_100=0,
        total_cash=0,
        prev_day_cash=prev_balance,
        daily_deposit=0,
        daily_expense=0,
        balance=prev_balance,
        memo=None,
        created_at=_dt.utcnow(),
        updated_at=_dt.utcnow(),
    )


@router.post("/closing", response_model=DailyClosingResponse, status_code=201)
def save_closing(data: DailyClosingCreate, db: Session = Depends(get_db)):
    """
    현금 시재 저장 (upsert).
    total_cash / prev_day_cash / balance 자동계산 후 저장.
    """
    try:
        return service.save_closing(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"시재 저장 중 오류가 발생했습니다: {str(e)}")


@router.put("/closing/{closing_id}", response_model=DailyClosingResponse)
def update_closing(closing_id: int, data: DailyClosingCreate, db: Session = Depends(get_db)):
    """시재 수정 (total_cash, balance 재계산 포함)"""
    result = service.update_closing(db, closing_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 시재 기록을 찾을 수 없습니다.")
    return result


# ─────────────────────────────────────────
# 이슈 트래킹 API
# ─────────────────────────────────────────

@router.get("/issues/list", response_model=list[DailyIssueResponse])
def get_issues_list(
    year:  int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    db: Session = Depends(get_db),
):
    """월별 이슈 목록 조회"""
    return service.get_issues_list(db, year, month)


@router.get("/issues", response_model=list[DailyIssueResponse])
def get_issues_by_date(
    date: str = Query(..., description="조회 날짜 (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    """특정 날짜 이슈 목록 조회"""
    return service.get_issues_by_date(db, date)


@router.post("/issues", response_model=DailyIssueResponse, status_code=201)
def create_issue(data: DailyIssueCreate, db: Session = Depends(get_db)):
    """이슈 등록"""
    try:
        return service.create_issue(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"이슈 등록 중 오류가 발생했습니다: {str(e)}")


@router.put("/issues/{issue_id}", response_model=DailyIssueResponse)
def update_issue(issue_id: int, data: DailyIssueUpdate, db: Session = Depends(get_db)):
    """이슈 수정 (처리내역 추가, 완료 처리)"""
    result = service.update_issue(db, issue_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 이슈를 찾을 수 없습니다.")
    return result


@router.delete("/issues/{issue_id}")
def delete_issue(issue_id: int, db: Session = Depends(get_db)):
    """이슈 삭제"""
    success = service.delete_issue(db, issue_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 이슈를 찾을 수 없습니다.")
    return {"success": True, "message": "이슈가 삭제되었습니다."}


# ─────────────────────────────────────────
# 고정비 항목 마스터 API
# ─────────────────────────────────────────

@router.get("/fixed-costs/items", response_model=list[FixedCostItemResponse])
def get_fixed_cost_items(db: Session = Depends(get_db)):
    """고정비 항목 목록 조회 (카테고리→정렬순 기준)"""
    return service.get_fixed_cost_items(db)


@router.post("/fixed-costs/items", response_model=FixedCostItemResponse, status_code=201)
def create_fixed_cost_item(data: FixedCostItemCreate, db: Session = Depends(get_db)):
    """고정비 항목 추가"""
    try:
        return service.create_fixed_cost_item(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"고정비 항목 저장 중 오류가 발생했습니다: {str(e)}")


@router.put("/fixed-costs/items/{item_id}", response_model=FixedCostItemResponse)
def update_fixed_cost_item(item_id: int, data: FixedCostItemUpdate, db: Session = Depends(get_db)):
    """고정비 항목 수정"""
    result = service.update_fixed_cost_item(db, item_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 고정비 항목을 찾을 수 없습니다.")
    return result


@router.delete("/fixed-costs/items/{item_id}")
def deactivate_fixed_cost_item(item_id: int, db: Session = Depends(get_db)):
    """고정비 항목 비활성화 (실제 삭제 아님)"""
    success = service.deactivate_fixed_cost_item(db, item_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 고정비 항목을 찾을 수 없습니다.")
    return {"success": True, "message": "고정비 항목이 비활성화되었습니다."}


# ─────────────────────────────────────────
# 고정비 월별 실적 API
# 주의: 정적 경로(/summary, /record)를 동적 경로보다 먼저 등록
# ─────────────────────────────────────────

@router.get("/fixed-costs/summary/{year}/{month}", response_model=FixedCostMonthlyResponse)
def get_fixed_cost_summary(
    year: int, month: int, db: Session = Depends(get_db)
):
    """
    월별 고정비 요약.
    설정금액 합계 / 실제금액 합계 / 차이 + 카테고리별 소계.
    """
    try:
        return service.get_fixed_cost_summary(db, year, month)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"고정비 요약 조회 중 오류가 발생했습니다: {str(e)}")


@router.put("/fixed-costs/record/{record_id}", response_model=FixedCostRecordResponse)
def update_fixed_cost_record(
    record_id: int, data: FixedCostRecordUpdate, db: Session = Depends(get_db)
):
    """월별 고정비 실적 수정 (실제금액, 납부일, 메모)"""
    result = service.update_fixed_cost_record(db, record_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 고정비 기록을 찾을 수 없습니다.")
    return result


@router.get("/fixed-costs/{year}/{month}", response_model=list[FixedCostRecordResponse])
def get_fixed_cost_monthly(
    year: int, month: int, db: Session = Depends(get_db)
):
    """
    월별 고정비 기록 조회.
    레코드 없으면 마스터 기준으로 자동 생성 후 반환.
    """
    try:
        return service.get_fixed_cost_monthly(db, year, month)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"고정비 월별 조회 중 오류가 발생했습니다: {str(e)}")
