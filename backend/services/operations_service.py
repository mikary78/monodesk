# ============================================================
# services/operations_service.py — 운영 관리 비즈니스 로직
# 공지사항, 위생점검, 영업일, 업무 체크리스트 서비스 함수
# ============================================================

from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional, List
from models.operations import (
    Notice, HygieneChecklist, HygieneRecord, BusinessDay,
    TaskChecklist, TaskRecord, Vendor, DailyClosing, DailyIssue
)
from schemas.operations import (
    NoticeCreate, NoticeUpdate,
    HygieneChecklistCreate, HygieneChecklistUpdate,
    HygieneRecordCreate, HygieneRecordUpdate,
    BusinessDayCreate, BusinessDayUpdate,
    TaskChecklistCreate, TaskChecklistUpdate,
    TaskRecordCreate, TaskRecordUpdate,
    VendorCreate, VendorUpdate,
    DailyClosingCreate, DailyIssueCreate, DailyIssueUpdate,
)


# ─────────────────────────────────────────
# 공지사항 서비스
# ─────────────────────────────────────────

def get_all_notices(
    db: Session,
    notice_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
) -> dict:
    """
    공지사항 목록 조회.
    고정 공지 우선, 최신순 정렬. 유형 필터 지원.
    """
    query = db.query(Notice).filter(Notice.is_deleted == 0)

    # 유형 필터 적용
    if notice_type:
        query = query.filter(Notice.notice_type == notice_type)

    total = query.count()

    # 고정 공지 우선, 최신순 정렬
    items = (
        query
        .order_by(Notice.is_pinned.desc(), Notice.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return {"total": total, "items": items}


def get_notice_by_id(db: Session, notice_id: int) -> Optional[Notice]:
    """공지사항 단건 조회"""
    return db.query(Notice).filter(
        Notice.id == notice_id,
        Notice.is_deleted == 0
    ).first()


def create_notice(db: Session, data: NoticeCreate) -> Notice:
    """
    공지사항 생성.
    긴급 공지는 자동으로 상단 고정 처리.
    """
    is_pinned = data.is_pinned
    # 긴급 공지는 자동 고정
    if data.notice_type == "urgent":
        is_pinned = 1

    notice = Notice(
        title=data.title,
        content=data.content,
        notice_type=data.notice_type,
        is_pinned=is_pinned,
        author=data.author,
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return notice


def update_notice(db: Session, notice_id: int, data: NoticeUpdate) -> Optional[Notice]:
    """공지사항 수정"""
    notice = get_notice_by_id(db, notice_id)
    if not notice:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(notice, field, value)

    db.commit()
    db.refresh(notice)
    return notice


def delete_notice(db: Session, notice_id: int) -> bool:
    """공지사항 소프트 삭제"""
    notice = get_notice_by_id(db, notice_id)
    if not notice:
        return False

    notice.is_deleted = 1
    db.commit()
    return True


# ─────────────────────────────────────────
# 위생 점검 체크리스트 서비스
# ─────────────────────────────────────────

def get_all_hygiene_checklists(
    db: Session,
    check_type: Optional[str] = None,
    category: Optional[str] = None
) -> List[HygieneChecklist]:
    """
    위생 점검 항목 목록 조회.
    유형/카테고리 필터 지원, 정렬 순서 기준 정렬.
    """
    query = db.query(HygieneChecklist).filter(HygieneChecklist.is_deleted == 0)

    if check_type:
        query = query.filter(HygieneChecklist.check_type == check_type)
    if category:
        query = query.filter(HygieneChecklist.category == category)

    return query.order_by(HygieneChecklist.sort_order.asc()).all()


def create_hygiene_checklist(db: Session, data: HygieneChecklistCreate) -> HygieneChecklist:
    """위생 점검 항목 생성"""
    item = HygieneChecklist(
        item_name=data.item_name,
        check_type=data.check_type,
        category=data.category,
        sort_order=data.sort_order,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_hygiene_checklist(
    db: Session, item_id: int, data: HygieneChecklistUpdate
) -> Optional[HygieneChecklist]:
    """위생 점검 항목 수정"""
    item = db.query(HygieneChecklist).filter(
        HygieneChecklist.id == item_id,
        HygieneChecklist.is_deleted == 0
    ).first()

    if not item:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    return item


def delete_hygiene_checklist(db: Session, item_id: int) -> bool:
    """위생 점검 항목 소프트 삭제"""
    item = db.query(HygieneChecklist).filter(
        HygieneChecklist.id == item_id,
        HygieneChecklist.is_deleted == 0
    ).first()

    if not item:
        return False

    item.is_deleted = 1
    db.commit()
    return True


def get_hygiene_records_by_date(db: Session, check_date: str) -> dict:
    """
    특정 날짜의 위생 점검 기록 조회.
    체크리스트 항목 정보와 함께 반환하고 통계 집계.
    """
    # 해당 날짜의 모든 기록 조회
    records = db.query(HygieneRecord).filter(
        HygieneRecord.check_date == check_date
    ).all()

    # 체크리스트 항목 전체 조회
    checklists = get_all_hygiene_checklists(db)

    # 기록 매핑 (checklist_id → record)
    record_map = {r.checklist_id: r for r in records}

    # 결과 조립
    result_list = []
    for cl in checklists:
        rec = record_map.get(cl.id)
        result_list.append({
            "checklist_id": cl.id,
            "item_name": cl.item_name,
            "check_type": cl.check_type,
            "category": cl.category,
            "sort_order": cl.sort_order,
            "record_id": rec.id if rec else None,
            "result": rec.result if rec else None,
            "inspector": rec.inspector if rec else None,
            "memo": rec.memo if rec else None,
        })

    # 통계 계산
    total = len(checklists)
    passed = sum(1 for r in records if r.result == "pass")
    failed = sum(1 for r in records if r.result == "fail")
    na_count = sum(1 for r in records if r.result == "na")
    checked_count = len(records)
    completion_rate = round(checked_count / total * 100, 1) if total > 0 else 0.0

    return {
        "check_date": check_date,
        "total": total,
        "passed": passed,
        "failed": failed,
        "na_count": na_count,
        "completion_rate": completion_rate,
        "records": result_list,
    }


def upsert_hygiene_record(db: Session, data: HygieneRecordCreate) -> HygieneRecord:
    """
    위생 점검 기록 저장 (날짜+항목 조합으로 upsert).
    같은 날짜+항목 조합은 업데이트, 없으면 신규 생성.
    """
    existing = db.query(HygieneRecord).filter(
        HygieneRecord.check_date == data.check_date,
        HygieneRecord.checklist_id == data.checklist_id
    ).first()

    if existing:
        # 기존 기록 업데이트
        existing.result = data.result
        if data.inspector is not None:
            existing.inspector = data.inspector
        if data.memo is not None:
            existing.memo = data.memo
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # 신규 기록 생성
        record = HygieneRecord(
            check_date=data.check_date,
            checklist_id=data.checklist_id,
            result=data.result,
            inspector=data.inspector,
            memo=data.memo,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record


def get_hygiene_monthly_summary(db: Session, year: int, month: int) -> List[dict]:
    """
    월별 위생 점검 현황 요약.
    날짜별 완료율을 반환합니다.
    """
    # 해당 월의 날짜 범위 계산
    start_date = f"{year:04d}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1:04d}-01-01"
    else:
        end_date = f"{year:04d}-{month + 1:02d}-01"

    # 해당 월의 모든 점검 기록 조회
    records = db.query(HygieneRecord).filter(
        HygieneRecord.check_date >= start_date,
        HygieneRecord.check_date < end_date
    ).all()

    total_items = db.query(HygieneChecklist).filter(HygieneChecklist.is_deleted == 0).count()

    # 날짜별 그룹화
    date_map: dict = {}
    for r in records:
        if r.check_date not in date_map:
            date_map[r.check_date] = {"passed": 0, "failed": 0, "na": 0, "total_checked": 0}
        date_map[r.check_date]["total_checked"] += 1
        if r.result == "pass":
            date_map[r.check_date]["passed"] += 1
        elif r.result == "fail":
            date_map[r.check_date]["failed"] += 1
        else:
            date_map[r.check_date]["na"] += 1

    result = []
    for date, stats in sorted(date_map.items()):
        completion_rate = round(stats["total_checked"] / total_items * 100, 1) if total_items > 0 else 0.0
        result.append({
            "check_date": date,
            "total_items": total_items,
            "total_checked": stats["total_checked"],
            "passed": stats["passed"],
            "failed": stats["failed"],
            "na_count": stats["na"],
            "completion_rate": completion_rate,
        })

    return result


# ─────────────────────────────────────────
# 영업일 관리 서비스
# ─────────────────────────────────────────

def get_business_days_by_month(db: Session, year: int, month: int) -> List[BusinessDay]:
    """
    월별 영업일 목록 조회.
    해당 월의 모든 영업일 기록을 반환합니다.
    """
    start_date = f"{year:04d}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1:04d}-01-01"
    else:
        end_date = f"{year:04d}-{month + 1:02d}-01"

    return (
        db.query(BusinessDay)
        .filter(
            BusinessDay.business_date >= start_date,
            BusinessDay.business_date < end_date
        )
        .order_by(BusinessDay.business_date.asc())
        .all()
    )


def get_business_day_by_date(db: Session, date: str) -> Optional[BusinessDay]:
    """특정 날짜 영업일 기록 단건 조회"""
    return db.query(BusinessDay).filter(BusinessDay.business_date == date).first()


def upsert_business_day(db: Session, data: BusinessDayCreate) -> BusinessDay:
    """
    영업일 기록 저장 (날짜별 upsert).
    같은 날짜 기록이 있으면 업데이트, 없으면 신규 생성.
    """
    existing = get_business_day_by_date(db, data.business_date)

    if existing:
        # 기존 기록 업데이트
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # 신규 기록 생성
        day = BusinessDay(
            business_date=data.business_date,
            status=data.status,
            closed_reason=data.closed_reason,
            memo=data.memo,
            target_sales=data.target_sales,
            weather=data.weather,
        )
        db.add(day)
        db.commit()
        db.refresh(day)
        return day


def delete_business_day(db: Session, date: str) -> bool:
    """특정 날짜 영업일 기록 삭제"""
    day = get_business_day_by_date(db, date)
    if not day:
        return False

    db.delete(day)
    db.commit()
    return True


def get_business_month_stats(db: Session, year: int, month: int) -> dict:
    """
    월별 영업 현황 통계.
    정상 영업일, 휴무일, 특별영업일 집계.
    """
    days = get_business_days_by_month(db, year, month)

    # 해당 월의 총 일수 계산
    import calendar
    total_days_in_month = calendar.monthrange(year, month)[1]

    # 상태별 집계
    open_count = sum(1 for d in days if d.status == "open")
    closed_count = sum(1 for d in days if d.status == "closed")
    special_count = sum(1 for d in days if d.status == "special")
    recorded_count = len(days)

    return {
        "year": year,
        "month": month,
        "total_days_in_month": total_days_in_month,
        "recorded_count": recorded_count,
        "open_count": open_count,
        "closed_count": closed_count,
        "special_count": special_count,
    }


# ─────────────────────────────────────────
# 업무 체크리스트 서비스
# ─────────────────────────────────────────

def get_all_task_checklists(
    db: Session,
    task_type: Optional[str] = None
) -> List[TaskChecklist]:
    """
    업무 체크리스트 항목 목록 조회.
    task_type 필터 지원 (open/close/weekly/monthly).
    """
    query = db.query(TaskChecklist).filter(TaskChecklist.is_deleted == 0)

    if task_type:
        query = query.filter(TaskChecklist.task_type == task_type)

    return query.order_by(TaskChecklist.sort_order.asc()).all()


def create_task_checklist(db: Session, data: TaskChecklistCreate) -> TaskChecklist:
    """업무 체크리스트 항목 생성"""
    task = TaskChecklist(
        task_name=data.task_name,
        task_type=data.task_type,
        role=data.role,
        sort_order=data.sort_order,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_task_checklist(
    db: Session, task_id: int, data: TaskChecklistUpdate
) -> Optional[TaskChecklist]:
    """업무 체크리스트 항목 수정"""
    task = db.query(TaskChecklist).filter(
        TaskChecklist.id == task_id,
        TaskChecklist.is_deleted == 0
    ).first()

    if not task:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)
    return task


def delete_task_checklist(db: Session, task_id: int) -> bool:
    """업무 체크리스트 항목 소프트 삭제"""
    task = db.query(TaskChecklist).filter(
        TaskChecklist.id == task_id,
        TaskChecklist.is_deleted == 0
    ).first()

    if not task:
        return False

    task.is_deleted = 1
    db.commit()
    return True


def get_task_records_by_date(db: Session, record_date: str, task_type: Optional[str] = None) -> dict:
    """
    특정 날짜의 업무 체크리스트 완료 현황 조회.
    업무 항목 정보와 완료 여부를 함께 반환.
    """
    # 해당 날짜의 완료 기록 조회
    query = db.query(TaskRecord).filter(TaskRecord.record_date == record_date)
    records = query.all()

    # 업무 항목 조회
    checklists = get_all_task_checklists(db, task_type=task_type)

    # 기록 매핑 (task_id → record)
    record_map = {r.task_id: r for r in records}

    # 결과 조립
    result_list = []
    for task in checklists:
        rec = record_map.get(task.id)
        result_list.append({
            "task_id": task.id,
            "task_name": task.task_name,
            "task_type": task.task_type,
            "role": task.role,
            "sort_order": task.sort_order,
            "record_id": rec.id if rec else None,
            "is_done": rec.is_done if rec else 0,
            "completed_by": rec.completed_by if rec else None,
            "memo": rec.memo if rec else None,
        })

    # 통계 (전체 항목 기준)
    all_tasks = get_all_task_checklists(db, task_type=task_type)
    total = len(all_tasks)
    completed = sum(1 for r in result_list if r["is_done"] == 1)
    completion_rate = round(completed / total * 100, 1) if total > 0 else 0.0

    return {
        "record_date": record_date,
        "task_type": task_type or "all",
        "total": total,
        "completed": completed,
        "completion_rate": completion_rate,
        "tasks": result_list,
    }


def upsert_task_record(db: Session, data: TaskRecordCreate) -> TaskRecord:
    """
    업무 완료 기록 저장 (날짜+업무 조합으로 upsert).
    같은 날짜+업무 조합은 업데이트, 없으면 신규 생성.
    """
    existing = db.query(TaskRecord).filter(
        TaskRecord.record_date == data.record_date,
        TaskRecord.task_id == data.task_id
    ).first()

    if existing:
        existing.is_done = data.is_done
        if data.completed_by is not None:
            existing.completed_by = data.completed_by
        if data.memo is not None:
            existing.memo = data.memo
        db.commit()
        db.refresh(existing)
        return existing
    else:
        record = TaskRecord(
            record_date=data.record_date,
            task_id=data.task_id,
            is_done=data.is_done,
            completed_by=data.completed_by,
            memo=data.memo,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return record


# ─────────────────────────────────────────
# 초기 데이터 시드 함수
# ─────────────────────────────────────────

def seed_default_hygiene_checklists(db: Session) -> None:
    """
    기본 위생 점검 항목 초기화.
    제철해산물 주점 특화 위생 점검 항목을 생성합니다.
    기존 항목이 있으면 건너뜁니다.
    """
    existing = db.query(HygieneChecklist).filter(HygieneChecklist.is_deleted == 0).count()
    if existing > 0:
        return

    default_items = [
        # 주방 개점 점검
        {"item_name": "냉장/냉동고 온도 확인 (냉장 0~5도, 냉동 -18도 이하)", "check_type": "open", "category": "kitchen", "sort_order": 1},
        {"item_name": "해산물 신선도 및 유통기한 확인", "check_type": "open", "category": "kitchen", "sort_order": 2},
        {"item_name": "조리 도구 세척 및 소독 상태 확인", "check_type": "open", "category": "kitchen", "sort_order": 3},
        {"item_name": "식재료 보관 상태 (밀폐 용기, 날음식/조리식 분리)", "check_type": "open", "category": "kitchen", "sort_order": 4},
        {"item_name": "가스/화구 누출 점검", "check_type": "open", "category": "kitchen", "sort_order": 5},
        # 홀 개점 점검
        {"item_name": "테이블 및 의자 청결 상태 확인", "check_type": "open", "category": "hall", "sort_order": 6},
        {"item_name": "환기 및 실내 냄새 제거 확인", "check_type": "open", "category": "hall", "sort_order": 7},
        # 화장실 개점 점검
        {"item_name": "화장실 청소 및 소독 완료", "check_type": "open", "category": "restroom", "sort_order": 8},
        {"item_name": "화장실 비품 보충 (화장지, 비누 등)", "check_type": "open", "category": "restroom", "sort_order": 9},
        # 주방 마감 점검
        {"item_name": "잔여 식재료 냉장/냉동 보관 처리", "check_type": "close", "category": "kitchen", "sort_order": 1},
        {"item_name": "조리대 및 개수대 청소 완료", "check_type": "close", "category": "kitchen", "sort_order": 2},
        {"item_name": "가스 밸브 잠금 확인", "check_type": "close", "category": "kitchen", "sort_order": 3},
        {"item_name": "음식물 쓰레기 처리 완료", "check_type": "close", "category": "kitchen", "sort_order": 4},
        # 홀 마감 점검
        {"item_name": "테이블 정리 및 청소 완료", "check_type": "close", "category": "hall", "sort_order": 5},
        {"item_name": "바닥 청소 (쓸기, 물걸레) 완료", "check_type": "close", "category": "hall", "sort_order": 6},
        {"item_name": "소등 및 전기 안전 확인", "check_type": "close", "category": "hall", "sort_order": 7},
        # 설비 마감 점검
        {"item_name": "에어컨/냉난방 기기 전원 차단 확인", "check_type": "close", "category": "equipment", "sort_order": 8},
        {"item_name": "잠금 장치 및 방범 설비 확인", "check_type": "close", "category": "equipment", "sort_order": 9},
        # 일상 점검
        {"item_name": "종업원 개인 위생 (손 세척, 위생모 착용)", "check_type": "daily", "category": "kitchen", "sort_order": 1},
        {"item_name": "조리 중 교차오염 방지 (날음식/조리식 도마 분리)", "check_type": "daily", "category": "kitchen", "sort_order": 2},
    ]

    for item in default_items:
        checklist = HygieneChecklist(**item)
        db.add(checklist)

    db.commit()


def seed_default_task_checklists(db: Session) -> None:
    """
    기본 업무 체크리스트 항목 초기화.
    개점/마감 루틴 업무 항목을 생성합니다.
    기존 항목이 있으면 건너뜁니다.
    """
    existing = db.query(TaskChecklist).filter(TaskChecklist.is_deleted == 0).count()
    if existing > 0:
        return

    default_tasks = [
        # 개점 업무
        {"task_name": "POS 시스템 부팅 및 정상 작동 확인", "task_type": "open", "role": "공통", "sort_order": 1},
        {"task_name": "당일 예약 현황 확인 및 테이블 세팅", "task_type": "open", "role": "홀", "sort_order": 2},
        {"task_name": "당일 식재료 입고 확인 및 수령 처리", "task_type": "open", "role": "주방", "sort_order": 3},
        {"task_name": "메뉴판 및 특선 메뉴 업데이트 확인", "task_type": "open", "role": "홀", "sort_order": 4},
        {"task_name": "홀 배경음악 및 조명 세팅", "task_type": "open", "role": "홀", "sort_order": 5},
        {"task_name": "직원 출근 확인 및 업무 배치", "task_type": "open", "role": "공통", "sort_order": 6},
        # 마감 업무
        {"task_name": "당일 매출 정산 및 현금 수납 확인", "task_type": "close", "role": "공통", "sort_order": 1},
        {"task_name": "POS 마감 처리 및 매출 보고서 출력", "task_type": "close", "role": "공통", "sort_order": 2},
        {"task_name": "재고 소진량 체크 및 발주 여부 결정", "task_type": "close", "role": "주방", "sort_order": 3},
        {"task_name": "직원 퇴근 확인 및 마감 청소 완료 확인", "task_type": "close", "role": "공통", "sort_order": 4},
        {"task_name": "CCTV 및 방범 설비 작동 확인", "task_type": "close", "role": "공통", "sort_order": 5},
        # 주간 업무
        {"task_name": "주간 식재료 발주 계획 수립", "task_type": "weekly", "role": "주방", "sort_order": 1},
        {"task_name": "직원 주간 근무 스케줄 확인", "task_type": "weekly", "role": "공통", "sort_order": 2},
        {"task_name": "냉동고 정리 및 재고 파악", "task_type": "weekly", "role": "주방", "sort_order": 3},
        {"task_name": "환기 필터 청소 확인", "task_type": "weekly", "role": "공통", "sort_order": 4},
        # 월간 업무
        {"task_name": "월간 매출 및 비용 정산 보고", "task_type": "monthly", "role": "공통", "sort_order": 1},
        {"task_name": "식기 및 조리 도구 소독 실시", "task_type": "monthly", "role": "주방", "sort_order": 2},
        {"task_name": "소화기 및 안전 설비 점검", "task_type": "monthly", "role": "공통", "sort_order": 3},
    ]

    for task in default_tasks:
        checklist = TaskChecklist(**task)
        db.add(checklist)

    db.commit()


# ─────────────────────────────────────────
# 거래처 관리 서비스
# ─────────────────────────────────────────

def get_all_vendors(
    db: Session,
    category: Optional[str] = None,
    search: Optional[str] = None
) -> List[Vendor]:
    """
    거래처 목록 조회.
    카테고리 필터 및 거래처명/담당자 검색 지원.
    소프트 삭제된 항목은 제외합니다.
    """
    query = db.query(Vendor).filter(Vendor.is_deleted == 0)

    # 카테고리 필터 적용
    if category:
        query = query.filter(Vendor.category == category)

    # 검색어 필터 (거래처명 또는 담당자명)
    if search:
        query = query.filter(
            Vendor.name.contains(search) | Vendor.contact_name.contains(search)
        )

    return query.order_by(Vendor.category.asc(), Vendor.name.asc()).all()


def create_vendor(db: Session, data: VendorCreate) -> Vendor:
    """거래처 등록"""
    vendor = Vendor(
        name=data.name,
        category=data.category,
        contact_name=data.contact_name,
        phone=data.phone,
        bank_name=data.bank_name,
        account_number=data.account_number,
        payment_day=data.payment_day,
        payment_method=data.payment_method,
        memo=data.memo,
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return vendor


def update_vendor(db: Session, vendor_id: int, data: VendorUpdate) -> Optional[Vendor]:
    """거래처 수정"""
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.is_deleted == 0
    ).first()

    if not vendor:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vendor, field, value)

    db.commit()
    db.refresh(vendor)
    return vendor


def delete_vendor(db: Session, vendor_id: int) -> bool:
    """거래처 소프트 삭제"""
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id,
        Vendor.is_deleted == 0
    ).first()

    if not vendor:
        return False

    vendor.is_deleted = 1
    db.commit()
    return True


# ─────────────────────────────────────────
# 현금 시재 관리 서비스
# ─────────────────────────────────────────

def _calc_total_cash(data: DailyClosingCreate) -> int:
    """권종별 수량 × 단위금액 합계 계산"""
    return (
        data.bill_100000 * 100000
        + data.bill_50000  * 50000
        + data.bill_10000  * 10000
        + data.bill_5000   * 5000
        + data.bill_1000   * 1000
        + data.coin_500    * 500
        + data.coin_100    * 100
    )


def _get_prev_day_balance(db: Session, closing_date: str) -> int:
    """
    해당 날짜 바로 전날의 잔액을 조회합니다.
    전날 기록이 없으면 0을 반환합니다.
    """
    from datetime import date, timedelta
    try:
        d = date.fromisoformat(closing_date)
        prev_date_str = (d - timedelta(days=1)).isoformat()
    except ValueError:
        return 0

    prev = db.query(DailyClosing).filter(
        DailyClosing.closing_date == prev_date_str
    ).first()

    return prev.balance if prev else 0


def get_closing_by_date(db: Session, closing_date: str) -> Optional[DailyClosing]:
    """특정 날짜 시재 조회. 없으면 None 반환."""
    return db.query(DailyClosing).filter(
        DailyClosing.closing_date == closing_date
    ).first()


def get_closing_list(db: Session, year: int, month: int) -> List[DailyClosing]:
    """월별 시재 목록 조회 (날짜 오름차순)"""
    start_date = f"{year:04d}-{month:02d}-01"
    end_date = f"{year:04d}-{month + 1:02d}-01" if month < 12 else f"{year + 1:04d}-01-01"

    return (
        db.query(DailyClosing)
        .filter(
            DailyClosing.closing_date >= start_date,
            DailyClosing.closing_date < end_date,
        )
        .order_by(DailyClosing.closing_date.asc())
        .all()
    )


def save_closing(db: Session, data: DailyClosingCreate) -> DailyClosing:
    """
    현금 시재 저장 (upsert).
    total_cash = 권종 합계 자동계산
    prev_day_cash = 전일 잔액 자동참조
    balance = prev_day_cash + daily_deposit - daily_expense
    """
    total_cash = _calc_total_cash(data)
    prev_day_cash = _get_prev_day_balance(db, data.closing_date)
    balance = prev_day_cash + data.daily_deposit - data.daily_expense

    existing = get_closing_by_date(db, data.closing_date)

    if existing:
        # 기존 기록 업데이트
        existing.bill_100000  = data.bill_100000
        existing.bill_50000   = data.bill_50000
        existing.bill_10000   = data.bill_10000
        existing.bill_5000    = data.bill_5000
        existing.bill_1000    = data.bill_1000
        existing.coin_500     = data.coin_500
        existing.coin_100     = data.coin_100
        existing.total_cash   = total_cash
        existing.prev_day_cash = prev_day_cash
        existing.daily_deposit = data.daily_deposit
        existing.daily_expense = data.daily_expense
        existing.balance      = balance
        existing.memo         = data.memo
        db.commit()
        db.refresh(existing)
        return existing

    closing = DailyClosing(
        closing_date   = data.closing_date,
        bill_100000    = data.bill_100000,
        bill_50000     = data.bill_50000,
        bill_10000     = data.bill_10000,
        bill_5000      = data.bill_5000,
        bill_1000      = data.bill_1000,
        coin_500       = data.coin_500,
        coin_100       = data.coin_100,
        total_cash     = total_cash,
        prev_day_cash  = prev_day_cash,
        daily_deposit  = data.daily_deposit,
        daily_expense  = data.daily_expense,
        balance        = balance,
        memo           = data.memo,
    )
    db.add(closing)
    db.commit()
    db.refresh(closing)
    return closing


def update_closing(db: Session, closing_id: int, data: DailyClosingCreate) -> Optional[DailyClosing]:
    """
    시재 수정 (ID 기준).
    total_cash, balance 재계산 포함.
    """
    closing = db.query(DailyClosing).filter(DailyClosing.id == closing_id).first()
    if not closing:
        return None

    total_cash = _calc_total_cash(data)
    prev_day_cash = _get_prev_day_balance(db, data.closing_date)
    balance = prev_day_cash + data.daily_deposit - data.daily_expense

    closing.bill_100000   = data.bill_100000
    closing.bill_50000    = data.bill_50000
    closing.bill_10000    = data.bill_10000
    closing.bill_5000     = data.bill_5000
    closing.bill_1000     = data.bill_1000
    closing.coin_500      = data.coin_500
    closing.coin_100      = data.coin_100
    closing.total_cash    = total_cash
    closing.prev_day_cash = prev_day_cash
    closing.daily_deposit = data.daily_deposit
    closing.daily_expense = data.daily_expense
    closing.balance       = balance
    closing.memo          = data.memo

    db.commit()
    db.refresh(closing)
    return closing


# ─────────────────────────────────────────
# 이슈 트래킹 서비스
# ─────────────────────────────────────────

def get_issues_by_date(db: Session, issue_date: str) -> List[DailyIssue]:
    """특정 날짜 이슈 목록 조회 (최신순)"""
    return (
        db.query(DailyIssue)
        .filter(DailyIssue.issue_date == issue_date)
        .order_by(DailyIssue.created_at.desc())
        .all()
    )


def get_issues_list(db: Session, year: int, month: int) -> List[DailyIssue]:
    """월별 이슈 목록 조회 (날짜/최신순)"""
    start_date = f"{year:04d}-{month:02d}-01"
    end_date = f"{year:04d}-{month + 1:02d}-01" if month < 12 else f"{year + 1:04d}-01-01"

    return (
        db.query(DailyIssue)
        .filter(
            DailyIssue.issue_date >= start_date,
            DailyIssue.issue_date < end_date,
        )
        .order_by(DailyIssue.issue_date.asc(), DailyIssue.created_at.desc())
        .all()
    )


def create_issue(db: Session, data: DailyIssueCreate) -> DailyIssue:
    """이슈 등록"""
    issue = DailyIssue(
        issue_date   = data.issue_date,
        issue_type   = data.issue_type,
        content      = data.content,
        action_taken = data.action_taken,
        is_resolved  = 1 if data.is_resolved else 0,
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return issue


def update_issue(db: Session, issue_id: int, data: DailyIssueUpdate) -> Optional[DailyIssue]:
    """이슈 수정 (처리내역 추가, 완료 처리 등)"""
    issue = db.query(DailyIssue).filter(DailyIssue.id == issue_id).first()
    if not issue:
        return None

    if data.issue_type is not None:
        issue.issue_type = data.issue_type
    if data.content is not None:
        issue.content = data.content
    if data.action_taken is not None:
        issue.action_taken = data.action_taken
    if data.is_resolved is not None:
        issue.is_resolved = 1 if data.is_resolved else 0

    db.commit()
    db.refresh(issue)
    return issue


def delete_issue(db: Session, issue_id: int) -> bool:
    """이슈 삭제 (하드 삭제)"""
    issue = db.query(DailyIssue).filter(DailyIssue.id == issue_id).first()
    if not issue:
        return False

    db.delete(issue)
    db.commit()
    return True
