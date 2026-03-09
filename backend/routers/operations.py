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
)
import services.operations_service as service

# 라우터 인스턴스 생성
router = APIRouter()


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
