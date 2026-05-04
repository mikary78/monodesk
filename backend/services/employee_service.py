# ============================================================
# services/employee_service.py — 직원 관리 비즈니스 로직
# 직원 CRUD, 출퇴근 관리, 급여 계산(한국 노동법 기준)을 담당합니다.
#
# 2026년 기준 적용 법령:
# - 최저임금: 10,030원/시 (2026년 최저임금위원회 고시)
# - 주휴수당: 근로기준법 제55조 (주 15시간 이상 시 적용)
# - 연장근로: 근로기준법 제56조 (1일 8시간, 주 40시간 초과 시 1.5배)
# - 야간근로: 근로기준법 제56조 (22:00~06:00, 0.5배 가산)
# - 4대보험: 2026년 요율 기준 (국민연금 4.5%, 건강 3.545%, 고용 0.9%)
# ============================================================

from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional, Dict, Any
from datetime import date, timedelta
from models.employee import Employee, AttendanceRecord, SalaryRecord, LeaveRecord
from schemas.employee import (
    EmployeeCreate, EmployeeUpdate,
    AttendanceRecordCreate, AttendanceRecordUpdate,
    SalaryRecordUpdate,
    SalaryCalculationResult, MonthlySalarySummary,
    LeaveRecordCreate, LeaveRecordUpdate
)
import math

# ─────────────────────────────────────────
# 상수 정의 (2026년 법령 기준)
# ─────────────────────────────────────────

# 2026년 최저임금 (원/시)
MINIMUM_WAGE_PER_HOUR = 10_030

# 4대보험 근로자 부담 요율
PENSION_RATE = 0.045          # 국민연금 4.5%
HEALTH_RATE = 0.03545         # 건강보험 3.545%
CARE_RATE = 0.1295            # 장기요양보험 (건강보험료의 12.95%)
EMPLOYMENT_RATE = 0.009       # 고용보험 0.9%

# 1일 기준 근무시간 (초과 시 연장근로)
DAILY_STANDARD_HOURS = 8.0

# 주 기준 근무시간 (초과 시 주 연장근로)
WEEKLY_STANDARD_HOURS = 40.0

# 주휴수당 적용 기준 (주 최소 근무시간)
WEEKLY_HOLIDAY_THRESHOLD = 15.0

# 식사 시간 공제 기준 (8시간 이상 근무 시 1시간 공제)
BREAK_THRESHOLD_HOURS = 8.0
BREAK_HOURS = 1.0


# ─────────────────────────────────────────
# 직원 서비스
# ─────────────────────────────────────────

def get_all_employees(db: Session, include_resigned: bool = False) -> List[Employee]:
    """
    직원 목록 조회.
    include_resigned: True이면 퇴사자 포함, False이면 현직자만 반환
    """
    query = db.query(Employee).filter(Employee.is_deleted == 0)
    if not include_resigned:
        # 퇴사일이 없거나, 퇴사일이 오늘 이후인 직원만 조회
        query = query.filter(
            (Employee.resign_date == None) | (Employee.resign_date == "")
        )
    return query.order_by(Employee.name).all()


def get_employee_by_id(db: Session, employee_id: int) -> Optional[Employee]:
    """ID로 직원 단건 조회"""
    return db.query(Employee).filter(
        Employee.id == employee_id,
        Employee.is_deleted == 0
    ).first()


def create_employee(db: Session, data: EmployeeCreate) -> Employee:
    """새 직원 등록"""
    employee = Employee(**data.model_dump())
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


def update_employee(db: Session, employee_id: int, data: EmployeeUpdate) -> Optional[Employee]:
    """직원 정보 수정 (부분 수정 허용)"""
    employee = get_employee_by_id(db, employee_id)
    if not employee:
        return None
    # None이 아닌 값만 업데이트
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(employee, key, value)
    db.commit()
    db.refresh(employee)
    return employee


def delete_employee(db: Session, employee_id: int) -> bool:
    """직원 소프트 삭제"""
    employee = get_employee_by_id(db, employee_id)
    if not employee:
        return False
    employee.is_deleted = 1
    db.commit()
    return True


def update_employee_contract_path(
    db: Session,
    employee_id: int,
    file_path: Optional[str]
) -> Optional[Employee]:
    """
    직원의 근로계약서 파일 경로를 업데이트합니다.
    파일 삭제 시에는 None을 전달합니다.
    """
    employee = get_employee_by_id(db, employee_id)
    if not employee:
        return None
    employee.contract_file_path = file_path
    db.commit()
    db.refresh(employee)
    return employee


# ─────────────────────────────────────────
# 출퇴근 서비스
# ─────────────────────────────────────────

def get_attendance_list(
    db: Session,
    year: int,
    month: int,
    employee_id: Optional[int] = None
) -> List[AttendanceRecord]:
    """
    월별 출퇴근 기록 목록 조회.
    employee_id가 주어지면 해당 직원의 기록만 반환합니다.
    """
    start_date = f"{year}-{month:02d}-01"
    end_date = f"{year}-{month + 1:02d}-01" if month < 12 else f"{year + 1}-01-01"

    query = db.query(AttendanceRecord).filter(
        AttendanceRecord.is_deleted == 0,
        AttendanceRecord.work_date >= start_date,
        AttendanceRecord.work_date < end_date
    )
    if employee_id:
        query = query.filter(AttendanceRecord.employee_id == employee_id)

    return query.order_by(
        AttendanceRecord.work_date.desc(),
        AttendanceRecord.employee_id
    ).all()


def get_attendance_by_id(db: Session, attendance_id: int) -> Optional[AttendanceRecord]:
    """ID로 출퇴근 기록 단건 조회"""
    return db.query(AttendanceRecord).filter(
        AttendanceRecord.id == attendance_id,
        AttendanceRecord.is_deleted == 0
    ).first()


def calculate_work_hours(clock_in: str, clock_out: str) -> Dict[str, float]:
    """
    출퇴근 시각으로 근무시간, 연장근로시간, 야간근로시간을 계산합니다.
    - 근무시간: 출퇴근 차이 - 휴게시간 (8시간 이상 시 1시간 공제)
    - 연장근로: 1일 8시간 초과분
    - 야간근로: 22:00~06:00 구간 근무 시간
    """
    def time_to_minutes(t: str) -> int:
        """HH:MM을 분으로 변환"""
        h, m = map(int, t.split(":"))
        return h * 60 + m

    in_minutes = time_to_minutes(clock_in)
    out_minutes = time_to_minutes(clock_out)

    # 자정을 넘기는 경우 처리 (예: 18:00 ~ 02:00)
    if out_minutes <= in_minutes:
        out_minutes += 24 * 60

    # 총 근무 시간 (분)
    total_minutes = out_minutes - in_minutes

    # 8시간(480분) 이상 근무 시 1시간 휴게 공제
    if total_minutes >= BREAK_THRESHOLD_HOURS * 60:
        total_minutes -= int(BREAK_HOURS * 60)

    # 실제 근무시간 (시간 단위, 소수점 2자리)
    work_hours = round(total_minutes / 60, 2)

    # 연장근로 시간 계산 (1일 8시간 초과분)
    overtime_hours = max(0.0, round(work_hours - DAILY_STANDARD_HOURS, 2))

    # 야간근로 시간 계산 (22:00~06:00 구간)
    # 22:00 = 1320분, 30:00(=다음날 06:00) = 1800분
    night_start = 22 * 60        # 1320
    night_end = (24 + 6) * 60   # 1800

    # 근무 구간과 야간 구간의 교집합 계산
    overlap_start = max(in_minutes, night_start)
    overlap_end = min(out_minutes, night_end)

    # 자정 전 야간 구간 (22:00~24:00)도 추가 확인
    night_minutes = 0
    if overlap_start < overlap_end:
        night_minutes += overlap_end - overlap_start

    # 자정을 넘기지 않는 경우, 다음날 00:00~06:00도 확인
    if out_minutes > 24 * 60:
        extra_night_end = min(out_minutes - 24 * 60, 6 * 60)
        if extra_night_end > 0:
            night_minutes += extra_night_end

    night_hours = round(night_minutes / 60, 2)

    return {
        "work_hours": work_hours,
        "overtime_hours": overtime_hours,
        "night_hours": night_hours
    }


def create_attendance(db: Session, data: AttendanceRecordCreate) -> AttendanceRecord:
    """
    출퇴근 기록 생성.
    출근/퇴근 시각이 모두 있으면 근무시간을 자동 계산합니다.
    """
    record_data = data.model_dump()

    # 출퇴근 시각이 모두 있으면 근무시간 자동 계산
    if data.clock_in and data.clock_out:
        hours_info = calculate_work_hours(data.clock_in, data.clock_out)
        record_data["work_hours"] = hours_info["work_hours"]
        record_data["overtime_hours"] = hours_info["overtime_hours"]
        record_data["night_hours"] = hours_info["night_hours"]

    record = AttendanceRecord(**record_data)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_attendance(
    db: Session,
    attendance_id: int,
    data: AttendanceRecordUpdate
) -> Optional[AttendanceRecord]:
    """
    출퇴근 기록 수정.
    출퇴근 시각 변경 시 근무시간을 재계산합니다.
    """
    record = get_attendance_by_id(db, attendance_id)
    if not record:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)

    # 출퇴근 시각이 모두 있으면 근무시간 재계산
    if record.clock_in and record.clock_out:
        hours_info = calculate_work_hours(record.clock_in, record.clock_out)
        record.work_hours = hours_info["work_hours"]
        record.overtime_hours = hours_info["overtime_hours"]
        record.night_hours = hours_info["night_hours"]

    db.commit()
    db.refresh(record)
    return record


def delete_attendance(db: Session, attendance_id: int) -> bool:
    """출퇴근 기록 소프트 삭제"""
    record = get_attendance_by_id(db, attendance_id)
    if not record:
        return False
    record.is_deleted = 1
    db.commit()
    return True


def get_monthly_calendar(db: Session, year: int, month: int) -> dict:
    """
    해당 월 전체 직원 근태 달력 데이터 반환.
    반환 형태:
    {
      "employees": [{id, name, employment_type, position}],
      "attendance": {
        "직원id": {
          "YYYY-MM-DD": {record_id, status, clock_in, clock_out, work_hours}
        }
      }
    }
    """
    # 활성 직원 목록 (고용 형태 → ID 순으로 정렬)
    employees = db.query(Employee).filter(
        Employee.is_deleted == 0
    ).order_by(Employee.employment_type, Employee.id).all()

    # 해당 월 출퇴근 기록 전체 조회 (YYYY-MM- 패턴 매칭)
    year_month = f"{year:04d}-{month:02d}"
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.work_date.like(f"{year_month}-%"),
        AttendanceRecord.is_deleted == 0
    ).all()

    # 직원별 날짜별 맵 초기화
    attendance_map: Dict[int, Dict[str, Any]] = {}
    for emp in employees:
        attendance_map[emp.id] = {}

    # 출퇴근 기록을 {직원id: {날짜: 상세}} 구조로 변환
    for rec in records:
        attendance_map[rec.employee_id][rec.work_date] = {
            "record_id": rec.id,
            "status": rec.daily_status or "work",
            "clock_in": rec.clock_in,
            "clock_out": rec.clock_out,
            "work_hours": rec.work_hours,
        }

    return {
        "employees": [
            {
                "id": e.id,
                "name": e.name,
                "employment_type": e.employment_type,
                "position": e.position,
                "work_part": e.work_part or "hall",
            }
            for e in employees
        ],
        # JSON 직렬화를 위해 키를 문자열로 변환
        "attendance": {str(k): v for k, v in attendance_map.items()},
    }


def get_weekly_calendar(db: Session, date_str: str) -> dict:
    """
    특정 날짜가 포함된 주(월~일)의 전체 직원 근태 데이터 반환.
    date 파라미터 기준 해당 주 월요일~일요일 7일 데이터를 반환합니다.

    반환 형태:
    {
      "week_start": "YYYY-MM-DD",
      "week_end": "YYYY-MM-DD",
      "employees": [{id, name, role, contract_type}],
      "attendance": {
        "직원id": {
          "YYYY-MM-DD": {"status": "work"|null, "memo": null}
        }
      },
      "year": 2026,
      "month": 4,
      "week_number": 3
    }
    """
    import calendar as cal_module

    # 기준 날짜 파싱 → 해당 주 월요일 계산
    target = date.fromisoformat(date_str)
    week_start = target - timedelta(days=target.weekday())   # 월요일
    week_end = week_start + timedelta(days=6)                # 일요일

    # 주차 번호 계산 (해당 월 기준 몇 번째 주인지)
    # ISO 기준이 아닌 "월의 첫 번째 주가 1주차" 방식 사용
    year = week_start.year
    month = week_start.month
    # week_start가 속한 달을 기준으로 주차 계산
    first_day_of_month = date(year, month, 1)
    first_monday = first_day_of_month - timedelta(days=first_day_of_month.weekday())
    week_number = ((week_start - first_monday).days // 7) + 1

    # 주 날짜 목록 (월~일, 7개)
    week_dates = [(week_start + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]

    # 활성 직원 목록 조회 (계약형태 기준 정렬)
    employees = db.query(Employee).filter(
        Employee.is_deleted == 0
    ).order_by(Employee.contract_type, Employee.id).all()

    # 해당 주 출퇴근 기록 조회
    records = db.query(AttendanceRecord).filter(
        AttendanceRecord.work_date >= week_dates[0],
        AttendanceRecord.work_date <= week_dates[6],
        AttendanceRecord.is_deleted == 0
    ).all()

    # 직원별 날짜별 맵 초기화 (기록 없는 날은 null 상태)
    attendance_map: Dict[int, Dict[str, Any]] = {}
    for emp in employees:
        attendance_map[emp.id] = {
            d: {"status": None, "memo": None} for d in week_dates
        }

    # 출퇴근 기록을 맵에 채워 넣기
    for rec in records:
        if rec.employee_id in attendance_map and rec.work_date in attendance_map[rec.employee_id]:
            attendance_map[rec.employee_id][rec.work_date] = {
                "status": rec.daily_status or "work",
                "memo": rec.memo,
            }

    return {
        "week_start": week_dates[0],
        "week_end": week_dates[6],
        "employees": [
            {
                "id": e.id,
                "name": e.name,
                "role": e.work_part or "hall",
                "contract_type": e.contract_type or "4대보험",
            }
            for e in employees
        ],
        # JSON 직렬화를 위해 키를 문자열로 변환
        "attendance": {str(k): v for k, v in attendance_map.items()},
        "year": year,
        "month": month,
        "week_number": week_number,
    }


def get_today_attendance_status(db: Session, employee_id: int) -> dict:
    """
    오늘 날짜의 출퇴근 상태 조회.
    헤더 출퇴근 버튼의 현재 상태 표시에 사용합니다.
    """
    from datetime import datetime as dt
    today = dt.now().strftime("%Y-%m-%d")

    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.employee_id == employee_id,
        AttendanceRecord.work_date == today,
        AttendanceRecord.is_deleted == 0
    ).first()

    if not record:
        return {
            "clocked_in": False,
            "clocked_out": False,
            "clock_in": None,
            "clock_out": None,
            "record_id": None,
        }

    return {
        "clocked_in": bool(record.clock_in),
        "clocked_out": bool(record.clock_out),
        "clock_in": record.clock_in,
        "clock_out": record.clock_out,
        "record_id": record.id,
    }


def clock_in(db: Session, employee_id: int) -> dict:
    """
    출근 처리 — 현재 시각을 clock_in으로 기록합니다.
    오늘 기록이 없으면 생성하고, 있으면 clock_in을 추가합니다.
    """
    from datetime import datetime as dt
    now = dt.now()
    today = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M")

    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.employee_id == employee_id,
        AttendanceRecord.work_date == today,
        AttendanceRecord.is_deleted == 0
    ).first()

    if existing:
        if existing.clock_in:
            raise ValueError(f"이미 출근 처리되었습니다. ({existing.clock_in})")
        existing.clock_in = current_time
        existing.daily_status = "work"
        existing.updated_at = dt.utcnow()
        db.commit()
        db.refresh(existing)
        return {"success": True, "clock_in": current_time, "record_id": existing.id}
    else:
        record = AttendanceRecord(
            employee_id=employee_id,
            work_date=today,
            clock_in=current_time,
            daily_status="work",
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        return {"success": True, "clock_in": current_time, "record_id": record.id}


def clock_out(db: Session, employee_id: int) -> dict:
    """
    퇴근 처리 — 현재 시각을 clock_out으로 기록하고 근무시간을 자동 계산합니다.
    오늘 출근 기록이 없으면 오류를 반환합니다.
    """
    from datetime import datetime as dt
    now = dt.now()
    today = now.strftime("%Y-%m-%d")
    current_time = now.strftime("%H:%M")

    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.employee_id == employee_id,
        AttendanceRecord.work_date == today,
        AttendanceRecord.is_deleted == 0
    ).first()

    if not existing or not existing.clock_in:
        raise ValueError("출근 기록이 없습니다. 먼저 출근 처리를 해주세요.")

    if existing.clock_out:
        raise ValueError(f"이미 퇴근 처리되었습니다. ({existing.clock_out})")

    existing.clock_out = current_time

    # 근무시간 자동 계산
    hours_info = calculate_work_hours(existing.clock_in, current_time)
    existing.work_hours = hours_info["work_hours"]
    existing.overtime_hours = hours_info["overtime_hours"]
    existing.night_hours = hours_info["night_hours"]

    existing.updated_at = dt.utcnow()
    db.commit()
    db.refresh(existing)

    return {
        "success": True,
        "clock_in": existing.clock_in,
        "clock_out": current_time,
        "work_hours": existing.work_hours,
        "record_id": existing.id,
    }


def bulk_update_attendance(
    db: Session,
    records: list
) -> dict:
    """
    여러 직원의 근태 기록을 일괄 업데이트(UPSERT)합니다.
    기존 레코드가 있으면 status/memo를 UPDATE, 없으면 INSERT합니다.

    records 형식:
    [{"employee_id": 1, "date": "2026-04-14", "status": "work", "memo": null}, ...]

    반환: {"updated": N, "created": N}
    """
    from datetime import datetime as dt

    updated_count = 0
    created_count = 0

    for item in records:
        employee_id = item.get("employee_id")
        work_date = item.get("date")
        status = item.get("status")
        memo = item.get("memo")

        # 기존 기록 조회 (소프트 삭제 제외)
        existing = db.query(AttendanceRecord).filter(
            AttendanceRecord.employee_id == employee_id,
            AttendanceRecord.work_date == work_date,
            AttendanceRecord.is_deleted == 0
        ).first()

        if existing:
            # 기존 기록 업데이트
            existing.daily_status = status
            existing.memo = memo
            existing.updated_at = dt.utcnow()
            updated_count += 1
        else:
            # 새 기록 생성 (status가 null이면 건너뜀 — 빈 상태 저장 불필요)
            if status is not None:
                new_record = AttendanceRecord(
                    employee_id=employee_id,
                    work_date=work_date,
                    daily_status=status,
                    memo=memo,
                )
                db.add(new_record)
                created_count += 1

    db.commit()
    return {"updated": updated_count, "created": created_count}


def calculate_daily_wage_monthly(
    db: Session,
    employee_id: int,
    year: int,
    month: int
) -> int:
    """
    일급 직원의 월 급여를 계산합니다.
    일급 × 해당 월 AttendanceRecord에서 status='work'인 일수.
    """
    employee = get_employee_by_id(db, employee_id)
    if not employee:
        return 0

    daily_wage = getattr(employee, "daily_wage", 0) or 0

    # 해당 월 'work' 상태 근무일수 카운트
    start_date = f"{year}-{month:02d}-01"
    end_date = f"{year}-{month + 1:02d}-01" if month < 12 else f"{year + 1}-01-01"

    work_day_count = db.query(AttendanceRecord).filter(
        AttendanceRecord.employee_id == employee_id,
        AttendanceRecord.is_deleted == 0,
        AttendanceRecord.work_date >= start_date,
        AttendanceRecord.work_date < end_date,
        AttendanceRecord.daily_status == "work"
    ).count()

    return daily_wage * work_day_count


def update_attendance_status(
    db: Session,
    attendance_id: int,
    status: str
) -> Optional[AttendanceRecord]:
    """
    daily_status만 빠르게 수정하는 전용 함수.
    근무표 달력에서 셀 클릭 시 상태 변경에 사용합니다.
    """
    record = db.query(AttendanceRecord).filter(
        AttendanceRecord.id == attendance_id,
        AttendanceRecord.is_deleted == 0
    ).first()
    if not record:
        return None
    record.daily_status = status
    from datetime import datetime as dt
    record.updated_at = dt.utcnow()
    db.commit()
    db.refresh(record)
    return record


# ─────────────────────────────────────────
# 급여 계산 서비스 (한국 노동법 기준)
# ─────────────────────────────────────────

def _calculate_weekly_holiday_pay(weekly_work_hours: float, hourly_wage: float) -> float:
    """
    주휴수당 계산.
    근거: 근로기준법 제55조, 고용노동부 주휴수당 산정 방식
    - 조건: 주 15시간 이상 근무
    - 계산: (주 근무시간 / 40) × 8 × 시급
    - 최대: 1일분 (8시간 × 시급)
    """
    if weekly_work_hours < WEEKLY_HOLIDAY_THRESHOLD:
        return 0.0

    # 주휴시간 계산 (최대 8시간)
    weekly_holiday_hours = min(8.0, (weekly_work_hours / 40.0) * 8.0)
    return round(weekly_holiday_hours * hourly_wage, 0)


def _calculate_monthly_weekly_holiday_pay(
    attendance_list: list,
    hourly_wage: float,
    year: int,
    month: int
) -> float:
    """
    월 전체 주휴수당 계산 (근로기준법 제55조).
    월 평균이 아닌 각 주차별로 실제 근무시간을 집계하여 개별 판단합니다.

    주차 구분 기준:
    - 해당 월의 월요일을 기준으로 주차를 나눕니다.
    - 단, 해당 달에 속한 날짜만 계산에 포함합니다.

    조건:
    - 해당 주 실제 근무시간 합계가 15시간 이상인 경우에만 주휴수당 발생

    계산식:
    - 주휴시간 = min((주 근무시간 / 40) × 8, 8) 시간
    - 주휴수당 = 주휴시간 × 시급
    """
    # 출퇴근 기록을 날짜별 딕셔너리로 변환 (work_date → work_hours)
    work_hours_by_date: Dict[str, float] = {}
    for record in attendance_list:
        if record.work_date and record.work_hours:
            work_hours_by_date[record.work_date] = (
                work_hours_by_date.get(record.work_date, 0.0) + record.work_hours
            )

    # 해당 월의 첫날과 마지막날 계산
    import calendar
    first_day = date(year, month, 1)
    last_day_num = calendar.monthrange(year, month)[1]
    last_day = date(year, month, last_day_num)

    # 월요일 기준으로 주차를 순회
    # 첫 번째 월요일 찾기 (first_day가 월요일이 아니면, 이전 주의 월요일부터 시작)
    # 주 단위로 순회하되 해당 월에 속한 날짜만 집계
    week_start = first_day - timedelta(days=first_day.weekday())  # 해당 월 첫날이 속한 주의 월요일

    total_weekly_holiday_pay = 0.0

    while week_start <= last_day:
        week_end = week_start + timedelta(days=6)  # 일요일

        # 이 주에서 해당 월에 속하는 날짜만 합산
        weekly_hours = 0.0
        current_day = week_start
        while current_day <= week_end:
            if first_day <= current_day <= last_day:
                date_str = current_day.strftime("%Y-%m-%d")
                weekly_hours += work_hours_by_date.get(date_str, 0.0)
            current_day += timedelta(days=1)

        # 해당 주에 실제 근무한 시간이 있는 경우에만 주휴수당 판단
        # (해당 월에 걸친 날짜가 전혀 없으면 건너뜀)
        if weekly_hours >= WEEKLY_HOLIDAY_THRESHOLD:
            # 주휴시간 = (주 근무시간 / 40) × 8, 최대 8시간
            holiday_hours = min(8.0, (weekly_hours / 40.0) * 8.0)
            total_weekly_holiday_pay += round(holiday_hours * hourly_wage, 0)

        week_start += timedelta(weeks=1)

    return total_weekly_holiday_pay


def _calculate_insurance_deductions(gross_pay: float) -> Dict[str, float]:
    """
    4대보험 근로자 공제액 계산 (2026년 요율).
    - 국민연금: 4.5%
    - 건강보험: 3.545%
    - 장기요양보험: 건강보험료 × 12.95%
    - 고용보험: 0.9%
    """
    # 각 공제액을 원 단위 절사 (10원 단위 아님, 원 단위)
    pension = math.floor(gross_pay * PENSION_RATE)
    health = math.floor(gross_pay * HEALTH_RATE)
    care = math.floor(health * CARE_RATE)
    employment = math.floor(gross_pay * EMPLOYMENT_RATE)
    total = pension + health + care + employment

    return {
        "deduction_pension": float(pension),
        "deduction_health": float(health),
        "deduction_care": float(care),
        "deduction_employment": float(employment),
        "total_deduction": float(total)
    }


def calculate_salary(
    db: Session,
    employee_id: int,
    year: int,
    month: int,
    extra_allowance: float = 0.0
) -> SalaryCalculationResult:
    """
    직원의 월 급여를 계산합니다.
    - 시급제: 출퇴근 기록 기반으로 기본급/연장/야간/주휴수당 계산
    - 월급제: 설정된 월급에서 4대보험 공제
    """
    # 직원 정보 조회
    employee = get_employee_by_id(db, employee_id)
    if not employee:
        raise ValueError(f"직원을 찾을 수 없습니다. ID: {employee_id}")

    # 해당 월 출퇴근 기록 조회
    start_date = f"{year}-{month:02d}-01"
    end_date = f"{year}-{month + 1:02d}-01" if month < 12 else f"{year + 1}-01-01"

    attendance_list = db.query(AttendanceRecord).filter(
        AttendanceRecord.employee_id == employee_id,
        AttendanceRecord.is_deleted == 0,
        AttendanceRecord.work_date >= start_date,
        AttendanceRecord.work_date < end_date
    ).all()

    # 근무 집계
    work_days = len([a for a in attendance_list if a.work_hours and a.work_hours > 0])
    total_work_hours = sum(a.work_hours or 0 for a in attendance_list)
    total_overtime_hours = sum(a.overtime_hours or 0 for a in attendance_list)
    total_night_hours = sum(a.night_hours or 0 for a in attendance_list)

    # 급여 계산
    if employee.salary_type == "HOURLY":
        # 시급제 계산
        hourly_wage = employee.hourly_wage or MINIMUM_WAGE_PER_HOUR

        # 기본급: 정규 근무시간 × 시급
        regular_hours = total_work_hours - total_overtime_hours
        base_pay = round(regular_hours * hourly_wage, 0)

        # 연장근로수당: 연장 시간 × 시급 × 1.5배 (단, 기본 1배는 이미 기본급에 포함)
        # → 가산분만 계산: 연장 시간 × 시급 × 0.5
        overtime_pay = round(total_overtime_hours * hourly_wage * 0.5, 0)

        # 야간근로수당: 야간 시간 × 시급 × 0.5 (가산분)
        night_pay = round(total_night_hours * hourly_wage * 0.5, 0)

        # 주휴수당: 근로기준법 제55조 — 주차별 실제 근무시간으로 개별 판단
        # 월 전체를 평균내지 않고, 각 주에 15시간 이상 근무한 경우에만 발생
        weekly_holiday_pay = _calculate_monthly_weekly_holiday_pay(
            attendance_list, hourly_wage, year, month
        )

        gross_pay = base_pay + overtime_pay + night_pay + weekly_holiday_pay + extra_allowance

        # 최저임금 충족 여부 확인 (최저임금법 제6조)
        # 비교 기준: 기본급만 / 실제 근무시간 (주휴·연장·야간수당은 제외)
        # 기본급 = 정규 근무시간 × 시급 (연장·야간 가산분 제외)
        effective_hourly = (base_pay / total_work_hours) if total_work_hours > 0 else hourly_wage
        minimum_wage_ok = effective_hourly >= MINIMUM_WAGE_PER_HOUR

    else:
        # 월급제 계산 (근로기준법 제56조)
        # 월급에는 기본 근로시간(주 40시간 × 4.345주 ≈ 209시간)이 포함되어 있음
        base_pay = float(employee.monthly_salary or 0)

        # 통상시급 = 월급 ÷ 209시간 (주 40시간 기준 월 환산 시간)
        monthly_standard_hours = 209.0
        hourly_wage_monthly = base_pay / monthly_standard_hours if base_pay > 0 else 0.0

        # 연장근로수당: 월급에 기본 1배가 포함되어 있으므로 가산분 0.5배만 추가
        # (총 연장 시간은 출퇴근 기록에서 집계)
        overtime_pay = round(total_overtime_hours * hourly_wage_monthly * 0.5, 0)

        # 야간근로수당: 22:00~06:00 구간 가산분 0.5배
        night_pay = round(total_night_hours * hourly_wage_monthly * 0.5, 0)

        # 월급제는 소정근로 이행 시 주휴 포함, 별도 주휴수당 없음
        weekly_holiday_pay = 0.0

        gross_pay = base_pay + overtime_pay + night_pay + extra_allowance

        # 최저임금 확인: 월급 ÷ 209시간 >= 최저시급 (기본급 기준)
        effective_hourly = hourly_wage_monthly
        minimum_wage_ok = effective_hourly >= MINIMUM_WAGE_PER_HOUR

    # 계약형태에 따른 공제 분기
    # contract_type이 없는 기존 데이터는 has_insurance로 fallback 처리
    ct = getattr(employee, "contract_type", None) or (
        "4대보험" if employee.has_insurance else "시급알바"
    )

    if ct == "4대보험":
        # 과세급여 = 총급여 - 식대(비과세) - 차량유지비(비과세)
        # 4대보험은 과세급여 기준으로 계산 (소득세법 제12조)
        meal = getattr(employee, "meal_allowance", None) or 0
        car = getattr(employee, "car_allowance", None) or 0
        taxable_pay = max(0.0, gross_pay - meal - car)
        deductions = _calculate_insurance_deductions(taxable_pay)

    elif ct == "3.3%":
        # 3.3% 원천징수: 소득세 3% + 지방소득세 0.3% (소득세법 제129조)
        withholding_tax = round(gross_pay * 0.033, 0)
        deductions = {
            "deduction_pension": 0.0,
            "deduction_health": 0.0,
            "deduction_care": 0.0,
            # deduction_employment 컬럼에 3.3% 원천징수액 저장
            "deduction_employment": withholding_tax,
            "total_deduction": withholding_tax,
        }

    else:
        # 시급알바: 공제 없음
        deductions = {
            "deduction_pension": 0.0,
            "deduction_health": 0.0,
            "deduction_care": 0.0,
            "deduction_employment": 0.0,
            "total_deduction": 0.0,
        }

    net_pay = round(gross_pay - deductions["total_deduction"], 0)

    return SalaryCalculationResult(
        employee_id=employee_id,
        employee_name=employee.name,
        year=year,
        month=month,
        salary_type=employee.salary_type,
        work_days=work_days,
        total_work_hours=round(total_work_hours, 2),
        total_overtime_hours=round(total_overtime_hours, 2),
        total_night_hours=round(total_night_hours, 2),
        base_pay=base_pay,
        weekly_holiday_pay=weekly_holiday_pay,
        overtime_pay=overtime_pay,
        night_pay=night_pay,
        extra_allowance=extra_allowance,
        gross_pay=gross_pay,
        deduction_pension=deductions["deduction_pension"],
        deduction_health=deductions["deduction_health"],
        deduction_care=deductions["deduction_care"],
        deduction_employment=deductions["deduction_employment"],
        total_deduction=deductions["total_deduction"],
        net_pay=net_pay,
        minimum_wage_ok=minimum_wage_ok,
        minimum_wage_per_hour=MINIMUM_WAGE_PER_HOUR
    )


def save_salary_record(
    db: Session,
    calc_result: SalaryCalculationResult
) -> SalaryRecord:
    """
    계산된 급여를 DB에 저장합니다.
    이미 해당 월 정산 기록이 있으면 업데이트합니다.
    """
    # 기존 정산 기록 확인
    existing = db.query(SalaryRecord).filter(
        SalaryRecord.employee_id == calc_result.employee_id,
        SalaryRecord.year == calc_result.year,
        SalaryRecord.month == calc_result.month,
        SalaryRecord.is_deleted == 0
    ).first()

    salary_data = {
        "employee_id": calc_result.employee_id,
        "year": calc_result.year,
        "month": calc_result.month,
        "work_days": calc_result.work_days,
        "total_work_hours": calc_result.total_work_hours,
        "total_overtime_hours": calc_result.total_overtime_hours,
        "total_night_hours": calc_result.total_night_hours,
        "base_pay": calc_result.base_pay,
        "weekly_holiday_pay": calc_result.weekly_holiday_pay,
        "overtime_pay": calc_result.overtime_pay,
        "night_pay": calc_result.night_pay,
        "extra_allowance": calc_result.extra_allowance,
        "gross_pay": calc_result.gross_pay,
        "deduction_pension": calc_result.deduction_pension,
        "deduction_health": calc_result.deduction_health,
        "deduction_care": calc_result.deduction_care,
        "deduction_employment": calc_result.deduction_employment,
        "total_deduction": calc_result.total_deduction,
        "net_pay": calc_result.net_pay,
    }

    if existing:
        # 기존 기록 업데이트
        for key, value in salary_data.items():
            setattr(existing, key, value)
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # 새 기록 생성
        record = SalaryRecord(**salary_data)
        db.add(record)
        db.commit()
        db.refresh(record)
        return record


def get_salary_records(
    db: Session,
    year: int,
    month: int,
    employee_id: Optional[int] = None
) -> List[SalaryRecord]:
    """월별 급여 정산 기록 목록 조회"""
    query = db.query(SalaryRecord).filter(
        SalaryRecord.year == year,
        SalaryRecord.month == month,
        SalaryRecord.is_deleted == 0
    )
    if employee_id:
        query = query.filter(SalaryRecord.employee_id == employee_id)
    return query.all()


def update_salary_record(
    db: Session,
    salary_id: int,
    data: SalaryRecordUpdate
) -> Optional[SalaryRecord]:
    """급여 정산 기록 수정 (지급 완료 처리 등)"""
    record = db.query(SalaryRecord).filter(
        SalaryRecord.id == salary_id,
        SalaryRecord.is_deleted == 0
    ).first()
    if not record:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return record


def get_monthly_salary_summary(
    db: Session,
    year: int,
    month: int
) -> MonthlySalarySummary:
    """
    월별 전체 급여 현황 요약.
    총 지급액, 공제액, 실수령액, 지급 현황을 집계합니다.
    """
    records = get_salary_records(db, year, month)

    total_employees = len(records)
    total_gross_pay = sum(r.gross_pay or 0 for r in records)
    total_deduction = sum(r.total_deduction or 0 for r in records)
    total_net_pay = sum(r.net_pay or 0 for r in records)
    paid_count = sum(1 for r in records if r.is_paid)
    unpaid_count = total_employees - paid_count

    # 직원별 상세 내역 (이름 포함)
    salary_details = []
    for record in records:
        employee = get_employee_by_id(db, record.employee_id)
        salary_details.append({
            "salary_id": record.id,
            "employee_id": record.employee_id,
            "employee_name": employee.name if employee else "알 수 없음",
            "position": employee.position if employee else "",
            "employment_type": employee.employment_type if employee else "",
            "work_days": record.work_days,
            "total_work_hours": record.total_work_hours,
            "gross_pay": record.gross_pay,
            "total_deduction": record.total_deduction,
            "net_pay": record.net_pay,
            "is_paid": record.is_paid,
            "paid_date": record.paid_date,
        })

    return MonthlySalarySummary(
        year=year,
        month=month,
        total_employees=total_employees,
        total_gross_pay=total_gross_pay,
        total_deduction=total_deduction,
        total_net_pay=total_net_pay,
        paid_count=paid_count,
        unpaid_count=unpaid_count,
        salary_details=salary_details
    )


def get_salary_history(
    db: Session,
    employee_id: int
) -> List[dict]:
    """
    특정 직원의 전체 급여 지급 이력 조회.
    연도/월 역순으로 정렬하여 반환합니다.
    """
    employee = get_employee_by_id(db, employee_id)
    if not employee:
        raise ValueError(f"직원을 찾을 수 없습니다. ID: {employee_id}")

    records = db.query(SalaryRecord).filter(
        SalaryRecord.employee_id == employee_id,
        SalaryRecord.is_deleted == 0
    ).order_by(
        SalaryRecord.year.desc(),
        SalaryRecord.month.desc()
    ).all()

    history = []
    for record in records:
        history.append({
            "salary_id": record.id,
            "year": record.year,
            "month": record.month,
            "work_days": record.work_days,
            "total_work_hours": record.total_work_hours,
            "gross_pay": record.gross_pay,
            "total_deduction": record.total_deduction,
            "net_pay": record.net_pay,
            "is_paid": record.is_paid,
            "paid_date": record.paid_date,
            "memo": record.memo,
        })

    return history


# ─────────────────────────────────────────
# 휴가 관리 서비스
# ─────────────────────────────────────────

# 휴가 유형 → AttendanceRecord daily_status 매핑
LEAVE_TYPE_TO_STATUS = {
    "annual": "annual",        # 연차 → annual
    "half_am": "half_am",      # 반차(오전) → half_am
    "half_pm": "half_pm",      # 반차(오후) → half_pm
    "substitute": "annual",    # 대체휴가 → annual로 통합 처리
    "petition": "annual",      # 청원휴가 → annual로 통합 처리
    "special": "annual",       # 특별휴가 → annual로 통합 처리
    "day_off": "off",          # 일반휴무 → off
}

# 휴가 유형 한국어 레이블
LEAVE_TYPE_LABELS = {
    "annual": "연차",
    "half_am": "반차(오전)",
    "half_pm": "반차(오후)",
    "substitute": "대체휴가",
    "petition": "청원휴가",
    "special": "특별휴가",
    "day_off": "일반휴무",
}


def get_leave_records(
    db: Session,
    employee_id: Optional[int] = None,
    year: Optional[int] = None,
    month: Optional[int] = None
) -> List[LeaveRecord]:
    """
    휴가 기록 목록 조회.
    employee_id, year, month로 필터링 가능합니다.
    """
    query = db.query(LeaveRecord).filter(LeaveRecord.is_deleted == 0)

    if employee_id:
        query = query.filter(LeaveRecord.employee_id == employee_id)

    if year and month:
        # YYYY-MM 패턴으로 해당 월 필터
        year_month = f"{year:04d}-{month:02d}"
        query = query.filter(LeaveRecord.leave_date.like(f"{year_month}-%"))
    elif year:
        query = query.filter(LeaveRecord.leave_date.like(f"{year:04d}-%"))

    return query.order_by(LeaveRecord.leave_date.desc()).all()


def get_leave_record_by_id(db: Session, leave_id: int) -> Optional[LeaveRecord]:
    """ID로 휴가 기록 단건 조회"""
    return db.query(LeaveRecord).filter(
        LeaveRecord.id == leave_id,
        LeaveRecord.is_deleted == 0
    ).first()


def create_leave_record(
    db: Session,
    data: LeaveRecordCreate,
    sync_attendance: bool = True
) -> LeaveRecord:
    """
    휴가 기록 생성.
    sync_attendance=True이면 해당 날짜의 AttendanceRecord daily_status를 자동 반영합니다.
    기존 출퇴근 기록이 없으면 새로 생성합니다.
    """
    from datetime import datetime as dt

    # 중복 체크: 동일 직원, 동일 날짜, 동일 휴가 유형은 1개만 허용
    existing = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id == data.employee_id,
        LeaveRecord.leave_date == data.leave_date,
        LeaveRecord.leave_type == data.leave_type,
        LeaveRecord.is_deleted == 0
    ).first()
    if existing:
        raise ValueError(
            f"해당 날짜({data.leave_date})에 동일한 휴가({LEAVE_TYPE_LABELS.get(data.leave_type, data.leave_type)})가 이미 등록되어 있습니다."
        )

    record = LeaveRecord(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)

    # AttendanceRecord daily_status 자동 반영
    if sync_attendance:
        status = LEAVE_TYPE_TO_STATUS.get(data.leave_type, "off")
        _sync_attendance_status(db, data.employee_id, data.leave_date, status)

    return record


def update_leave_record(
    db: Session,
    leave_id: int,
    data: LeaveRecordUpdate
) -> Optional[LeaveRecord]:
    """
    휴가 기록 수정.
    휴가 유형이 변경되면 AttendanceRecord daily_status도 업데이트합니다.
    """
    record = get_leave_record_by_id(db, leave_id)
    if not record:
        return None

    old_type = record.leave_type
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)

    db.commit()
    db.refresh(record)

    # 휴가 유형이 변경된 경우 AttendanceRecord 동기화
    if "leave_type" in update_data and update_data["leave_type"] != old_type:
        status = LEAVE_TYPE_TO_STATUS.get(record.leave_type, "off")
        _sync_attendance_status(db, record.employee_id, record.leave_date, status)

    return record


def delete_leave_record(db: Session, leave_id: int) -> bool:
    """
    휴가 기록 소프트 삭제.
    삭제 시 AttendanceRecord daily_status를 'work'로 되돌립니다.
    단, 해당 날짜에 다른 휴가 기록이 남아 있으면 되돌리지 않습니다.
    """
    record = get_leave_record_by_id(db, leave_id)
    if not record:
        return False

    record.is_deleted = 1
    from datetime import datetime as dt
    record.updated_at = dt.utcnow()
    db.commit()

    # 해당 날짜에 남은 휴가 기록이 있는지 확인
    remaining = db.query(LeaveRecord).filter(
        LeaveRecord.employee_id == record.employee_id,
        LeaveRecord.leave_date == record.leave_date,
        LeaveRecord.is_deleted == 0
    ).count()

    # 남은 휴가가 없으면 출퇴근 상태를 'work'로 복구
    if remaining == 0:
        _sync_attendance_status(db, record.employee_id, record.leave_date, "work")

    return True


def _sync_attendance_status(
    db: Session,
    employee_id: int,
    work_date: str,
    status: str
) -> None:
    """
    AttendanceRecord의 daily_status를 해당 날짜로 동기화합니다.
    기록이 없으면 새로 생성하고, 있으면 status만 업데이트합니다.
    """
    from datetime import datetime as dt

    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.employee_id == employee_id,
        AttendanceRecord.work_date == work_date,
        AttendanceRecord.is_deleted == 0
    ).first()

    if existing:
        existing.daily_status = status
        existing.updated_at = dt.utcnow()
    else:
        new_record = AttendanceRecord(
            employee_id=employee_id,
            work_date=work_date,
            daily_status=status,
        )
        db.add(new_record)

    db.commit()
