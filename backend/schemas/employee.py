# ============================================================
# schemas/employee.py — 직원 관리 Pydantic V2 스키마
# API 요청/응답 데이터 유효성 검사를 담당합니다.
# Pydantic V2: ConfigDict, @field_validator, model_dump() 사용
# ============================================================

from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List
from datetime import datetime


# ─────────────────────────────────────────
# 직원 기본 정보 스키마
# ─────────────────────────────────────────

class EmployeeBase(BaseModel):
    """직원 기본 정보 공통 필드"""
    name: str
    phone: Optional[str] = None
    employment_type: str = "PART_TIME"   # FULL_TIME / PART_TIME
    salary_type: str = "HOURLY"          # HOURLY / MONTHLY
    hourly_wage: Optional[float] = None
    monthly_salary: Optional[float] = None
    has_insurance: bool = False
    hire_date: Optional[str] = None
    resign_date: Optional[str] = None
    position: Optional[str] = None
    bank_account: Optional[str] = None
    bank_name: Optional[str] = None
    contract_file_path: Optional[str] = None
    # 근무파트 (hall: 홀 / kitchen: 주방 / management: 관리)
    work_part: Optional[str] = "hall"
    # 식대 비과세 (기본 200,000원)
    meal_allowance: int = 200000
    # 차량유지비 비과세
    car_allowance: int = 0
    # 근무조건 텍스트 (예: 주5일 17:00~24:00)
    work_condition: Optional[str] = None
    # 계약형태: 4대보험 / 3.3% / 시급알바
    contract_type: Optional[str] = "4대보험"
    memo: Optional[str] = None

    @field_validator("employment_type")
    @classmethod
    def validate_employment_type(cls, v: str) -> str:
        """고용 형태 유효성 검사"""
        allowed = {"FULL_TIME", "PART_TIME"}
        if v not in allowed:
            raise ValueError("고용 형태는 FULL_TIME 또는 PART_TIME이어야 합니다.")
        return v

    @field_validator("salary_type")
    @classmethod
    def validate_salary_type(cls, v: str) -> str:
        """급여 유형 유효성 검사"""
        allowed = {"HOURLY", "MONTHLY"}
        if v not in allowed:
            raise ValueError("급여 유형은 HOURLY 또는 MONTHLY이어야 합니다.")
        return v

    @field_validator("hourly_wage", "monthly_salary")
    @classmethod
    def validate_wage(cls, v: Optional[float]) -> Optional[float]:
        """급여 금액 유효성 검사 (양수 여부)"""
        if v is not None and v < 0:
            raise ValueError("급여 금액은 0 이상이어야 합니다.")
        return v


class EmployeeCreate(EmployeeBase):
    """직원 생성 요청 스키마"""
    pass


class EmployeeUpdate(BaseModel):
    """직원 정보 수정 요청 스키마 (부분 수정 허용)"""
    name: Optional[str] = None
    phone: Optional[str] = None
    employment_type: Optional[str] = None
    salary_type: Optional[str] = None
    hourly_wage: Optional[float] = None
    monthly_salary: Optional[float] = None
    has_insurance: Optional[bool] = None
    hire_date: Optional[str] = None
    resign_date: Optional[str] = None
    position: Optional[str] = None
    bank_account: Optional[str] = None
    bank_name: Optional[str] = None
    contract_file_path: Optional[str] = None
    # 근무파트 (hall: 홀 / kitchen: 주방 / management: 관리)
    work_part: Optional[str] = None
    # 식대 비과세
    meal_allowance: Optional[int] = None
    # 차량유지비 비과세
    car_allowance: Optional[int] = None
    # 근무조건 텍스트
    work_condition: Optional[str] = None
    # 계약형태: 4대보험 / 3.3% / 시급알바
    contract_type: Optional[str] = None
    memo: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class EmployeeResponse(EmployeeBase):
    """직원 정보 응답 스키마"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 출퇴근 기록 스키마
# ─────────────────────────────────────────

class AttendanceRecordBase(BaseModel):
    """출퇴근 기록 공통 필드"""
    employee_id: int
    work_date: str              # YYYY-MM-DD
    clock_in: Optional[str] = None   # HH:MM
    clock_out: Optional[str] = None  # HH:MM
    work_hours: Optional[float] = None
    overtime_hours: float = 0
    night_hours: float = 0
    memo: Optional[str] = None
    # 일일 근무 상태 (근무표 달력용)
    # 허용값: work/off/annual/half_am/half_pm/absent/early_leave/recommended_off/support
    daily_status: Optional[str] = "work"

    @field_validator("work_date")
    @classmethod
    def validate_work_date(cls, v: str) -> str:
        """날짜 형식 유효성 검사 (YYYY-MM-DD)"""
        import re
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("날짜 형식은 YYYY-MM-DD이어야 합니다.")
        return v

    @field_validator("clock_in", "clock_out")
    @classmethod
    def validate_time(cls, v: Optional[str]) -> Optional[str]:
        """시간 형식 유효성 검사 (HH:MM)"""
        import re
        if v is not None and not re.match(r"^\d{2}:\d{2}$", v):
            raise ValueError("시간 형식은 HH:MM이어야 합니다.")
        return v


class AttendanceRecordCreate(AttendanceRecordBase):
    """출퇴근 기록 생성 요청 스키마"""
    pass


class AttendanceRecordUpdate(BaseModel):
    """출퇴근 기록 수정 요청 스키마 (부분 수정 허용)"""
    clock_in: Optional[str] = None
    clock_out: Optional[str] = None
    work_hours: Optional[float] = None
    overtime_hours: Optional[float] = None
    night_hours: Optional[float] = None
    memo: Optional[str] = None
    # 일일 근무 상태 수정 허용
    daily_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AttendanceRecordResponse(AttendanceRecordBase):
    """출퇴근 기록 응답 스키마"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 급여 정산 스키마
# ─────────────────────────────────────────

class SalaryRecordBase(BaseModel):
    """급여 정산 공통 필드"""
    employee_id: int
    year: int
    month: int
    work_days: int = 0
    total_work_hours: float = 0
    total_overtime_hours: float = 0
    total_night_hours: float = 0
    base_pay: float = 0
    weekly_holiday_pay: float = 0
    overtime_pay: float = 0
    night_pay: float = 0
    gross_pay: float = 0
    deduction_pension: float = 0
    deduction_health: float = 0
    deduction_care: float = 0
    deduction_employment: float = 0
    total_deduction: float = 0
    net_pay: float = 0
    is_paid: bool = False
    paid_date: Optional[str] = None
    memo: Optional[str] = None


class SalaryRecordCreate(SalaryRecordBase):
    """급여 정산 생성 요청 스키마"""
    pass


class SalaryRecordUpdate(BaseModel):
    """급여 정산 수정 요청 스키마"""
    is_paid: Optional[bool] = None
    paid_date: Optional[str] = None
    memo: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SalaryRecordResponse(SalaryRecordBase):
    """급여 정산 응답 스키마"""
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 급여 계산 요청/결과 스키마
# ─────────────────────────────────────────

class SalaryCalculationRequest(BaseModel):
    """급여 계산 요청 스키마"""
    employee_id: int
    year: int
    month: int


class SalaryCalculationResult(BaseModel):
    """급여 계산 결과 스키마 (저장 전 미리보기용)"""
    employee_id: int
    employee_name: str
    year: int
    month: int
    salary_type: str
    # 근무 집계
    work_days: int
    total_work_hours: float
    total_overtime_hours: float
    total_night_hours: float
    # 급여 항목
    base_pay: float
    weekly_holiday_pay: float
    overtime_pay: float
    night_pay: float
    gross_pay: float
    # 4대보험 공제 항목
    deduction_pension: float
    deduction_health: float
    deduction_care: float
    deduction_employment: float
    total_deduction: float
    # 실수령액
    net_pay: float
    # 최저임금 충족 여부
    minimum_wage_ok: bool
    minimum_wage_per_hour: float  # 2026년 기준: 10,030원


class MonthlySalarySummary(BaseModel):
    """월별 전체 급여 현황 요약 스키마"""
    year: int
    month: int
    total_employees: int          # 해당 월 근무 직원 수
    total_gross_pay: float        # 총 지급액 합계
    total_deduction: float        # 총 공제액 합계
    total_net_pay: float          # 총 실수령액 합계
    paid_count: int               # 지급 완료 직원 수
    unpaid_count: int             # 미지급 직원 수
    salary_details: List[dict]    # 직원별 상세 내역

    model_config = ConfigDict(from_attributes=True)
