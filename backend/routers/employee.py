# ============================================================
# routers/employee.py — 직원 관리 API 라우터
# 직원 정보, 출퇴근 기록, 급여 계산/정산, 근로계약서 엔드포인트
#
# 주의: FastAPI는 경로를 등록 순서대로 매칭합니다.
#       /salary/overview 같은 고정 경로를 /salary/{id} 앞에 등록해야 합니다.
# ============================================================

import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from database import get_db
from schemas.employee import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    AttendanceRecordCreate, AttendanceRecordUpdate, AttendanceRecordResponse,
    SalaryRecordUpdate, SalaryRecordResponse,
    SalaryCalculationRequest, SalaryCalculationResult,
    MonthlySalarySummary
)
import services.employee_service as service

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
    db: Session = Depends(get_db)
):
    """
    직원 목록 조회.
    기본값으로 현직자만 반환합니다. include_resigned=true 시 퇴사자도 포함합니다.
    """
    return service.get_all_employees(db, include_resigned=include_resigned)


@router.get("/employees/{employee_id}", response_model=EmployeeResponse)
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    """직원 단건 조회"""
    employee = service.get_employee_by_id(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="해당 직원을 찾을 수 없습니다.")
    return employee


@router.post("/employees", response_model=EmployeeResponse, status_code=201)
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db)):
    """새 직원 등록"""
    try:
        return service.create_employee(db, data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"직원 등록 중 오류가 발생했습니다: {str(e)}")


@router.put("/employees/{employee_id}", response_model=EmployeeResponse)
def update_employee(employee_id: int, data: EmployeeUpdate, db: Session = Depends(get_db)):
    """직원 정보 수정"""
    result = service.update_employee(db, employee_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 직원을 찾을 수 없습니다.")
    return result


@router.delete("/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    """직원 삭제 (소프트 삭제)"""
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
    db: Session = Depends(get_db)
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
def download_contract(employee_id: int, db: Session = Depends(get_db)):
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
def delete_contract(employee_id: int, db: Session = Depends(get_db)):
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
    db: Session = Depends(get_db)
):
    """
    월별 출퇴근 기록 목록 조회.
    employee_id 파라미터로 특정 직원만 필터링 가능합니다.
    """
    return service.get_attendance_list(db, year, month, employee_id)


@router.get("/attendance/calculate-hours")
def calculate_hours(
    clock_in: str = Query(..., description="출근 시각 (HH:MM)"),
    clock_out: str = Query(..., description="퇴근 시각 (HH:MM)")
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


@router.post("/attendance", response_model=AttendanceRecordResponse, status_code=201)
def create_attendance(data: AttendanceRecordCreate, db: Session = Depends(get_db)):
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
    db: Session = Depends(get_db)
):
    """출퇴근 기록 수정 (시각 수정 시 근무시간 자동 재계산)"""
    result = service.update_attendance(db, attendance_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 출퇴근 기록을 찾을 수 없습니다.")
    return result


@router.delete("/attendance/{attendance_id}")
def delete_attendance(attendance_id: int, db: Session = Depends(get_db)):
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
    db: Session = Depends(get_db)
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
def calculate_salary(data: SalaryCalculationRequest, db: Session = Depends(get_db)):
    """
    직원의 월 급여를 계산합니다 (저장 없이 미리보기).
    출퇴근 기록 기반으로 기본급, 수당, 공제액, 실수령액을 계산합니다.
    """
    try:
        return service.calculate_salary(db, data.employee_id, data.year, data.month)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"급여 계산 중 오류가 발생했습니다: {str(e)}")


@router.post("/salary/save", response_model=SalaryRecordResponse)
def save_salary(data: SalaryCalculationRequest, db: Session = Depends(get_db)):
    """
    계산된 급여를 DB에 저장합니다.
    이미 해당 월 정산 기록이 있으면 업데이트합니다.
    """
    try:
        calc_result = service.calculate_salary(db, data.employee_id, data.year, data.month)
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
    db: Session = Depends(get_db)
):
    """월별 급여 정산 기록 조회"""
    return service.get_salary_records(db, year, month, employee_id)


@router.get("/salary/history")
def get_salary_history(
    employee_id: int = Query(..., description="직원 ID"),
    db: Session = Depends(get_db)
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
    db: Session = Depends(get_db)
):
    """급여 정산 기록 수정 (지급 완료 처리 등)"""
    result = service.update_salary_record(db, salary_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="해당 급여 정산 기록을 찾을 수 없습니다.")
    return result
