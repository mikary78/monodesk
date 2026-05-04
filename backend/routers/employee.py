# ============================================================
# routers/employee.py — 직원 관리 API 라우터
# 직원 정보, 출퇴근 기록, 급여 계산/정산, 근로계약서 엔드포인트
#
# 주의: FastAPI는 경로를 등록 순서대로 매칭합니다.
#       /salary/overview 같은 고정 경로를 /salary/{id} 앞에 등록해야 합니다.
# ============================================================

import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Body
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List, Any
from database import get_db
from schemas.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    AttendanceRecordCreate, AttendanceRecordUpdate, AttendanceRecordResponse,
    SalaryRecordUpdate, SalaryRecordResponse,
    SalaryCalculationRequest, SalaryCalculationResult,
    MonthlySalarySummary,
    LeaveRecordCreate, LeaveRecordUpdate, LeaveRecordResponse
)
import services.employee_service as service
from auth import require_role
from models.auth import User

# 라우터 인스턴스 생성
router = APIRouter()

# 근로계약서 파일 저장 경로
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CONTRACT_DIR = os.path.join(BASE_DIR, "uploads", "contracts")
os.makedirs(CONTRACT_DIR, exist_ok=True)


# ─────────────────────────────────────────
# 직원 정보 API
# ─────────────────────────────────────────

@router.get("/employees", response_model=List[EmployeeResponse])
def get_employees(
    include_resigned: bool = Query(False, description="퇴사자 포함 여부"),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """
    직원 목록 조회 — admin/manager 전용.
    기본값으로 현직자만 반환합니다. include_resigned=true 시 퇴사자도 포함합니다.
    """
    return service.get_all_employees(db, include_resigned=include_resigned)


@router.get("/employees/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """직원 단건 조회 — admin/manager 전용"""
    employee = service.get_employee_by_id(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="해당 직원을 찾을 수 없습니다.")
    return employee


@router.post("/employees", response_model=EmployeeResponse, status_code=201)
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """새 직원 등록 — admin/manager 전용"""
    try:
        return service.create_employee(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"직원 등록 중 오류가 발생했습니다: {str(e)}")


@router.put("/employees/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """직원 정보 수정 — admin/manager 전용"""
    result = service.update_employee(db, employee_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 직원을 찾을 수 없습니다.")
    return result


@router.delete("/employees/{employee_id}")
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """직원 삭제 (소프트 삭제) — admin/manager 전용"""
    success = service.delete_employee(db, employee_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 직원을 찾을 수 없습니다.")
    return {"success": True, "message": "직원이 삭제되었습니다."}


# ─────────────────────────────────────────
# 근로계약서 파일 API
# ─────────────────────────────────────────

@router.post("/employees/{employee_id}/contract")
async def upload_contract(
    employee_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """
    근로계약서 파일 업로드.
    PDF, 이미지 파일만 허용합니다.
    """
    # 직원 존재 여부 확인
    employee = service.get_employee_by_id(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="해당 직원을 찾을 수 없습니다.")

    # 파일 확장자 검사
    allowed_extensions = {".pdf", ".jpg", ".jpeg", ".png"}
    _, ext = os.path.splitext(file.filename.lower())
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="PDF, JPG, PNG 파일만 업로드 가능합니다."
        )

    # 파일 저장 (직원별 디렉토리)
    employee_dir = os.path.join(CONTRACT_DIR, str(employee_id))
    os.makedirs(employee_dir, exist_ok=True)
    file_path = os.path.join(employee_dir, f"contract{ext}")

    try:
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 저장 중 오류가 발생했습니다: {str(e)}")

    # DB에 계약서 파일 경로 저장
    service.update_employee_contract_path(db, employee_id, file_path)

    return {
        "success": True,
        "message": "근로계약서가 업로드되었습니다.",
        "file_name": file.filename,
        "file_path": file_path
    }


@router.get("/employees/{employee_id}/contract")
def download_contract(
    employee_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """근로계약서 파일 다운로드"""
    employee = service.get_employee_by_id(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="해당 직원을 찾을 수 없습니다.")

    if not employee.contract_file_path or not os.path.exists(employee.contract_file_path):
        raise HTTPException(status_code=404, detail="근로계약서 파일이 없습니다.")

    return FileResponse(
        path=employee.contract_file_path,
        filename=f"{employee.name}_근로계약서{os.path.splitext(employee.contract_file_path)[1]}"
    )


@router.delete("/employees/{employee_id}/contract")
def delete_contract(
    employee_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """근로계약서 파일 삭제"""
    employee = service.get_employee_by_id(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="해당 직원을 찾을 수 없습니다.")

    if employee.contract_file_path and os.path.exists(employee.contract_file_path):
        os.remove(employee.contract_file_path)

    service.update_employee_contract_path(db, employee_id, None)
    return {"success": True, "message": "근로계약서가 삭제되었습니다."}


# ─────────────────────────────────────────
# 출퇴근 기록 API
# ─────────────────────────────────────────

@router.get("/attendance", response_model=List[AttendanceRecordResponse])
def get_attendance(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    employee_id: Optional[int] = Query(None, description="직원 필터"),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager", "staff")),
):
    """
    월별 출퇴근 기록 목록 조회.
    employee_id 파라미터로 특정 직원만 필터링 가능합니다.
    """
    return service.get_attendance_list(db, year, month, employee_id)


@router.get("/attendance/calculate-hours")
def calculate_hours(
    clock_in: str = Query(..., description="출근 시각 (HH:MM)"),
    clock_out: str = Query(..., description="퇴근 시각 (HH:MM)"),
    _: User = Depends(require_role("admin", "manager", "staff")),
):
    """
    출퇴근 시각으로 근무시간/연장/야간 시간을 미리 계산합니다.
    저장 없이 계산 결과만 반환하는 유틸리티 엔드포인트입니다.
    주의: /attendance/{id} 앞에 등록해야 경로 충돌이 없습니다.
    """
    try:
        result = service.calculate_work_hours(clock_in, clock_out)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"시간 계산 중 오류가 발생했습니다: {str(e)}")


@router.get("/attendance/monthly-calendar")
def get_monthly_attendance_calendar(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager", "staff")),
):
    """
    해당 월 전체 직원 근태 달력 데이터 반환.
    {직원id: {날짜: {status, clock_in, clock_out, work_hours}}} 형태로 반환합니다.
    주의: 고정 경로이므로 /attendance/{attendance_id} 앞에 등록합니다.
    """
    return service.get_monthly_calendar(db, year, month)


@router.get("/attendance/weekly")
def get_weekly_attendance_calendar(
    date: str = Query(..., description="기준 날짜 (YYYY-MM-DD) — 해당 날짜가 속한 주 반환"),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager", "staff")),
):
    """
    특정 날짜가 포함된 주(월~일) 전체 직원 근태 데이터 반환.
    주별 근무표 뷰에서 사용하는 엔드포인트입니다.
    주의: 고정 경로이므로 /attendance/{attendance_id} 앞에 등록합니다.
    """
    try:
        return service.get_weekly_calendar(db, date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"날짜 형식 오류: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"주별 근태 데이터 조회 중 오류가 발생했습니다: {str(e)}")


@router.get("/attendance/my", response_model=List[AttendanceRecordResponse])
def get_my_attendance(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager", "staff")),
):
    """
    현재 로그인한 사용자 본인의 출퇴근 기록 조회.
    users.employee_id로 연결된 직원의 기록만 반환합니다.
    staff 역할은 이 엔드포인트로만 출퇴근 기록에 접근합니다.
    """
    if not current_user.employee_id:
        raise HTTPException(
            status_code=400,
            detail="직원 정보가 연결되지 않았습니다. 관리자에게 문의하세요.",
        )
    return service.get_attendance_list(db, year, month, current_user.employee_id)


@router.get("/attendance/today-status")
def get_today_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager", "staff")),
):
    """
    오늘 날짜 출퇴근 상태 조회 (헤더 출퇴근 버튼용).
    직원 미연결 시 linked=False를 반환합니다.
    """
    if not current_user.employee_id:
        return {
            "linked": False,
            "clocked_in": False,
            "clocked_out": False,
            "clock_in": None,
            "clock_out": None,
            "record_id": None,
        }
    status = service.get_today_attendance_status(db, current_user.employee_id)
    return {"linked": True, **status}


@router.post("/attendance/clock-in")
def clock_in(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager", "staff")),
):
    """
    출근 처리 — 현재 시각으로 오늘 날짜 출근 기록을 생성합니다.
    직원 미연결 시 400 오류를 반환합니다.
    """
    if not current_user.employee_id:
        raise HTTPException(status_code=400, detail="직원 정보가 연결되지 않았습니다. 관리자에게 문의하세요.")
    try:
        return service.clock_in(db, current_user.employee_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/attendance/clock-out")
def clock_out(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin", "manager", "staff")),
):
    """
    퇴근 처리 — 현재 시각으로 오늘 날짜 퇴근 기록을 업데이트합니다.
    출근 기록 없으면 400 오류를 반환합니다.
    """
    if not current_user.employee_id:
        raise HTTPException(status_code=400, detail="직원 정보가 연결되지 않았습니다. 관리자에게 문의하세요.")
    try:
        return service.clock_out(db, current_user.employee_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/attendance/bulk")
def bulk_update_attendance(
    records: List[Any] = Body(..., description="근태 일괄 업데이트 목록"),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager", "staff")),
):
    """
    여러 직원의 근태 기록을 일괄 UPSERT합니다.
    기존 레코드가 있으면 UPDATE, 없으면 INSERT합니다.
    주의: 고정 경로(/attendance/bulk)를 동적 경로(/attendance/{id}) 앞에 등록합니다.

    요청 형식:
    [{"employee_id": 1, "date": "2026-04-14", "status": "work", "memo": null}, ...]
    """
    try:
        return service.bulk_update_attendance(db, records)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"근태 일괄 저장 중 오류가 발생했습니다: {str(e)}")


@router.patch("/attendance/{attendance_id}/status")
def update_attendance_status(
    attendance_id: int,
    status: str = Query(..., description="변경할 근무 상태값"),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager", "staff")),
):
    """
    daily_status만 수정하는 전용 엔드포인트.
    근무표 달력에서 셀 클릭 시 상태 변경에 사용합니다.
    """
    result = service.update_attendance_status(db, attendance_id, status)
    if not result:
        raise HTTPException(status_code=404, detail="해당 출퇴근 기록을 찾을 수 없습니다.")
    return result


@router.post("/attendance", response_model=AttendanceRecordResponse, status_code=201)
def create_attendance(
    data: AttendanceRecordCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager", "staff")),
):
    """
    출퇴근 기록 입력.
    출퇴근 시각이 모두 입력되면 근무시간을 자동 계산합니다.
    """
    try:
        # 직원 존재 여부 확인
        employee = service.get_employee_by_id(db, data.employee_id)
        if not employee:
            raise HTTPException(status_code=404, detail="해당 직원을 찾을 수 없습니다.")
        return service.create_attendance(db, data)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"출퇴근 기록 저장 중 오류가 발생했습니다: {str(e)}")


@router.put("/attendance/{attendance_id}", response_model=AttendanceRecordResponse)
def update_attendance(
    attendance_id: int,
    data: AttendanceRecordUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager", "staff")),
):
    """출퇴근 기록 수정 (시각 수정 시 근무시간 자동 재계산)"""
    result = service.update_attendance(db, attendance_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 출퇴근 기록을 찾을 수 없습니다.")
    return result


@router.delete("/attendance/{attendance_id}")
def delete_attendance(
    attendance_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager", "staff")),
):
    """출퇴근 기록 삭제 (소프트 삭제)"""
    success = service.delete_attendance(db, attendance_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 출퇴근 기록을 찾을 수 없습니다.")
    return {"success": True, "message": "출퇴근 기록이 삭제되었습니다."}


# ─────────────────────────────────────────
# 급여 정산 API
# 주의: 고정 경로(/salary/overview, /salary/calculate 등)를
#       동적 경로(/salary/{salary_id})보다 반드시 앞에 등록합니다.
# ─────────────────────────────────────────

@router.get("/salary/overview", response_model=MonthlySalarySummary)
def get_salary_overview(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """
    월별 전체 급여 현황 요약.
    총 지급액, 공제액, 실수령액, 지급 완료/미완료 현황을 반환합니다.
    """
    try:
        return service.get_monthly_salary_summary(db, year, month)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"급여 현황 조회 중 오류가 발생했습니다: {str(e)}")


@router.post("/salary/calculate", response_model=SalaryCalculationResult)
def calculate_salary(
    data: SalaryCalculationRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """
    직원의 월 급여를 계산합니다 (저장 없이 미리보기).
    출퇴근 기록 기반으로 기본급, 수당, 공제액, 실수령액을 계산합니다.
    extra_allowance를 요청 바디에 포함하면 기타 추가 수당이 반영됩니다.
    """
    try:
        return service.calculate_salary(
            db, data.employee_id, data.year, data.month,
            extra_allowance=data.extra_allowance
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"급여 계산 중 오류가 발생했습니다: {str(e)}")


@router.post("/salary/save", response_model=SalaryRecordResponse)
def save_salary(
    data: SalaryCalculationRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """
    계산된 급여를 DB에 저장합니다.
    이미 해당 월 정산 기록이 있으면 업데이트합니다.
    extra_allowance를 요청 바디에 포함하면 기타 추가 수당이 반영됩니다.
    """
    try:
        calc_result = service.calculate_salary(
            db, data.employee_id, data.year, data.month,
            extra_allowance=data.extra_allowance
        )
        return service.save_salary_record(db, calc_result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"급여 저장 중 오류가 발생했습니다: {str(e)}")


@router.get("/salary", response_model=List[SalaryRecordResponse])
def get_salary_records(
    year: int = Query(..., ge=2020, le=2099, description="조회 연도"),
    month: int = Query(..., ge=1, le=12, description="조회 월"),
    employee_id: Optional[int] = Query(None, description="직원 필터"),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """월별 급여 정산 기록 조회"""
    return service.get_salary_records(db, year, month, employee_id)


@router.get("/salary/history")
def get_salary_history(
    employee_id: int = Query(..., description="직원 ID"),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """
    특정 직원의 전체 급여 지급 이력 조회.
    연도/월 순으로 정렬하여 반환합니다.
    고정 경로(/salary/history)를 동적 경로(/salary/{salary_id})보다 반드시 먼저 등록해야 합니다.
    """
    try:
        return service.get_salary_history(db, employee_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"급여 이력 조회 중 오류가 발생했습니다: {str(e)}")


@router.put("/salary/{salary_id}", response_model=SalaryRecordResponse)
def update_salary_record(
    salary_id: int,
    data: SalaryRecordUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """급여 정산 기록 수정 (지급 완료 처리 등)"""
    result = service.update_salary_record(db, salary_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 급여 정산 기록을 찾을 수 없습니다.")
    return result


# ─────────────────────────────────────────
# 휴가 관리 API
# 주의: 고정 경로를 동적 경로보다 앞에 등록합니다.
# ─────────────────────────────────────────

@router.get("/leave", response_model=List[LeaveRecordResponse])
def get_leave_records(
    employee_id: Optional[int] = Query(None, description="직원 ID 필터"),
    year: Optional[int] = Query(None, ge=2020, le=2099, description="조회 연도"),
    month: Optional[int] = Query(None, ge=1, le=12, description="조회 월"),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """
    휴가 기록 목록 조회.
    employee_id, year, month로 필터링 가능합니다.
    """
    return service.get_leave_records(db, employee_id, year, month)


@router.post("/leave", response_model=LeaveRecordResponse, status_code=201)
def create_leave_record(
    data: LeaveRecordCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """
    휴가 기록 등록.
    등록 시 해당 날짜의 출퇴근 기록 daily_status를 자동 반영합니다.
    """
    # 직원 존재 여부 확인
    employee = service.get_employee_by_id(db, data.employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="해당 직원을 찾을 수 없습니다.")
    try:
        return service.create_leave_record(db, data, sync_attendance=True)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"휴가 등록 중 오류가 발생했습니다: {str(e)}")


@router.put("/leave/{leave_id}", response_model=LeaveRecordResponse)
def update_leave_record(
    leave_id: int,
    data: LeaveRecordUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """휴가 기록 수정. 휴가 유형 변경 시 출퇴근 상태도 자동 업데이트됩니다."""
    result = service.update_leave_record(db, leave_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 휴가 기록을 찾을 수 없습니다.")
    return result


@router.delete("/leave/{leave_id}")
def delete_leave_record(
    leave_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "manager")),
):
    """
    휴가 기록 삭제 (소프트 삭제).
    삭제 시 다른 휴가가 없으면 출퇴근 상태를 'work'로 되돌립니다.
    """
    success = service.delete_leave_record(db, leave_id)
    if not success:
        raise HTTPException(status_code=404, detail="해당 휴가 기록을 찾을 수 없습니다.")
    return {"success": True, "message": "휴가 기록이 삭제되었습니다."}
