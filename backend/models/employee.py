# ============================================================
# models/employee.py — 직원 관리 SQLAlchemy 데이터 모델
# 직원 정보, 출퇴근 기록, 급여 정산 테이블을 정의합니다.
# ============================================================

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
from enum import Enum


class AttendanceStatus(str, Enum):
    """
    일일 근무 상태 Enum.
    근무표 달력에서 셀별 상태를 표현합니다.
    """
    WORK = "work"                        # 근무
    OFF = "off"                          # 정기휴무
    ANNUAL = "annual"                    # 월차
    HALF_AM = "half_am"                  # 반차 (오전)
    HALF_PM = "half_pm"                  # 반차 (오후)
    ABSENT = "absent"                    # 무단결근
    EARLY_LEAVE = "early_leave"          # 무단조퇴
    RECOMMENDED_OFF = "recommended_off"  # 권장휴무
    SUPPORT = "support"                  # 타매장 지원


class Employee(Base):
    """
    직원 기본 정보 테이블.
    정규직/아르바이트 모두 포함하며, 시급제/월급제를 지원합니다.
    """
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 직원 이름
    name = Column(String(50), nullable=False, comment="직원 이름")

    # 연락처
    phone = Column(String(20), nullable=True, comment="연락처")

    # 고용 형태: FULL_TIME(정규직), PART_TIME(아르바이트)
    employment_type = Column(String(20), nullable=False, default="PART_TIME", comment="고용형태 (FULL_TIME/PART_TIME)")

    # 급여 유형: HOURLY(시급제), MONTHLY(월급제)
    salary_type = Column(String(10), nullable=False, default="HOURLY", comment="급여유형 (HOURLY/MONTHLY)")

    # 시급 (salary_type이 HOURLY일 때 사용)
    hourly_wage = Column(Float, nullable=True, comment="시급 (원, 시급제일 때 사용)")

    # 월급 (salary_type이 MONTHLY일 때 사용)
    monthly_salary = Column(Float, nullable=True, comment="월급 (원, 월급제일 때 사용)")

    # 4대보험 적용 여부 (True: 적용, False: 미적용)
    has_insurance = Column(Boolean, default=False, comment="4대보험 적용 여부")

    # 입사일 (YYYY-MM-DD)
    hire_date = Column(String(10), nullable=True, comment="입사일")

    # 퇴사일 (YYYY-MM-DD, None이면 재직 중)
    resign_date = Column(String(10), nullable=True, comment="퇴사일 (없으면 재직 중)")

    # 담당 직무 (예: 홀서빙, 주방, 매니저)
    position = Column(String(50), nullable=True, comment="직무/포지션")

    # 계좌번호 (급여 이체용) — 로그 출력 금지 대상
    bank_account = Column(String(100), nullable=True, comment="급여 계좌번호")

    # 은행명
    bank_name = Column(String(30), nullable=True, comment="은행명")

    # 근로계약서 파일 경로 (로컬 저장)
    contract_file_path = Column(String(500), nullable=True, comment="근로계약서 파일 경로")

    # 메모
    memo = Column(Text, nullable=True, comment="비고/메모")

    # 소프트 삭제
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")

    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    # 관계 정의
    attendance_records = relationship("AttendanceRecord", back_populates="employee")
    salary_records = relationship("SalaryRecord", back_populates="employee")

    def __repr__(self):
        return f"<Employee(id={self.id}, name={self.name}, type={self.employment_type})>"


class AttendanceRecord(Base):
    """
    출퇴근 기록 테이블.
    직원별 일별 출근/퇴근 시각과 실제 근무시간을 저장합니다.
    """
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 직원 ID (외래키)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, comment="직원 ID")

    # 근무 날짜 (YYYY-MM-DD)
    work_date = Column(String(10), nullable=False, index=True, comment="근무 날짜")

    # 출근 시각 (HH:MM)
    clock_in = Column(String(5), nullable=True, comment="출근 시각 (HH:MM)")

    # 퇴근 시각 (HH:MM)
    clock_out = Column(String(5), nullable=True, comment="퇴근 시각 (HH:MM)")

    # 실제 근무시간 (소수 시간, 예: 8.5 = 8시간 30분)
    # 휴게시간 제외 후 저장
    work_hours = Column(Float, nullable=True, comment="실제 근무시간 (시간 단위, 휴게 제외)")

    # 연장근로 시간 (1일 8시간 초과분)
    overtime_hours = Column(Float, default=0, comment="연장근로 시간 (시간 단위)")

    # 야간근로 시간 (22:00~06:00 해당분)
    night_hours = Column(Float, default=0, comment="야간근로 시간 (시간 단위)")

    # 메모 (결근/조퇴/지각 사유 등)
    memo = Column(String(200), nullable=True, comment="메모 (결근/지각 사유 등)")

    # 일일 근무 상태 (근무표 달력용)
    # 허용값: work/off/annual/half_am/half_pm/absent/early_leave/recommended_off/support
    daily_status = Column(
        String(20),
        default="work",
        comment="일일 근무상태 (work/off/annual/half_am/half_pm/absent/early_leave/recommended_off/support)"
    )

    # 소프트 삭제
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")

    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    # 관계 정의
    employee = relationship("Employee", back_populates="attendance_records")

    def __repr__(self):
        return f"<AttendanceRecord(id={self.id}, employee_id={self.employee_id}, date={self.work_date})>"


class SalaryRecord(Base):
    """
    월별 급여 정산 테이블.
    직원별 월 근무 집계와 최종 급여(공제 후)를 저장합니다.
    """
    __tablename__ = "salary_records"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 직원 ID (외래키)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, comment="직원 ID")

    # 정산 연도/월
    year = Column(Integer, nullable=False, comment="정산 연도")
    month = Column(Integer, nullable=False, comment="정산 월")

    # 총 근무일수
    work_days = Column(Integer, default=0, comment="총 근무일수")

    # 총 근무시간 (시급제용)
    total_work_hours = Column(Float, default=0, comment="총 근무시간 (시간 단위)")

    # 연장근로 시간 합계
    total_overtime_hours = Column(Float, default=0, comment="연장근로 시간 합계")

    # 야간근로 시간 합계
    total_night_hours = Column(Float, default=0, comment="야간근로 시간 합계")

    # 기본급 (시급×시간 또는 월급)
    base_pay = Column(Float, default=0, comment="기본급 (원)")

    # 주휴수당 (주 15시간 이상 근무 시)
    weekly_holiday_pay = Column(Float, default=0, comment="주휴수당 (원)")

    # 연장근로수당 (기본 시급의 0.5배 가산)
    overtime_pay = Column(Float, default=0, comment="연장근로수당 (원)")

    # 야간근로수당 (기본 시급의 0.5배 가산)
    night_pay = Column(Float, default=0, comment="야간근로수당 (원)")

    # 총 지급액 (기본급 + 각종 수당)
    gross_pay = Column(Float, default=0, comment="총 지급액 (원, 공제 전)")

    # 국민연금 공제액 (4.5%)
    deduction_pension = Column(Float, default=0, comment="국민연금 공제액 (원)")

    # 건강보험 공제액 (3.545%)
    deduction_health = Column(Float, default=0, comment="건강보험 공제액 (원)")

    # 장기요양보험 공제액 (건강보험료의 12.95%)
    deduction_care = Column(Float, default=0, comment="장기요양보험 공제액 (원)")

    # 고용보험 공제액 (0.9%)
    deduction_employment = Column(Float, default=0, comment="고용보험 공제액 (원)")

    # 총 공제액
    total_deduction = Column(Float, default=0, comment="총 공제액 (원)")

    # 실수령액 (총 지급액 - 총 공제액)
    net_pay = Column(Float, default=0, comment="실수령액 (원)")

    # 지급 완료 여부
    is_paid = Column(Boolean, default=False, comment="지급 완료 여부")

    # 지급일 (YYYY-MM-DD)
    paid_date = Column(String(10), nullable=True, comment="지급일")

    # 메모
    memo = Column(Text, nullable=True, comment="메모")

    # 소프트 삭제
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")

    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    # 관계 정의
    employee = relationship("Employee", back_populates="salary_records")

    def __repr__(self):
        return f"<SalaryRecord(id={self.id}, employee_id={self.employee_id}, year={self.year}, month={self.month})>"
