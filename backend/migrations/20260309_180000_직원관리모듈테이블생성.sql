-- ============================================================
-- 직원 관리 모듈 테이블 생성 마이그레이션
-- 생성일: 2026-03-09
-- 대상 테이블: employees, attendance_records, salary_records
-- ============================================================

-- 직원 기본 정보 테이블
CREATE TABLE IF NOT EXISTS employees (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT NOT NULL,                          -- 직원 이름
    phone               TEXT,                                   -- 연락처
    employment_type     TEXT NOT NULL DEFAULT 'PART_TIME',      -- 고용형태 (FULL_TIME/PART_TIME)
    salary_type         TEXT NOT NULL DEFAULT 'HOURLY',         -- 급여유형 (HOURLY/MONTHLY)
    hourly_wage         REAL,                                   -- 시급 (원)
    monthly_salary      REAL,                                   -- 월급 (원)
    has_insurance       INTEGER NOT NULL DEFAULT 0,             -- 4대보험 적용 여부 (0/1)
    hire_date           TEXT,                                   -- 입사일 (YYYY-MM-DD)
    resign_date         TEXT,                                   -- 퇴사일 (YYYY-MM-DD, NULL이면 재직 중)
    position            TEXT,                                   -- 직무/포지션
    bank_account        TEXT,                                   -- 급여 계좌번호 (민감정보)
    bank_name           TEXT,                                   -- 은행명
    contract_file_path  TEXT,                                   -- 근로계약서 파일 경로
    memo                TEXT,                                   -- 메모
    is_deleted          INTEGER NOT NULL DEFAULT 0,             -- 소프트 삭제 (0: 정상, 1: 삭제)
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 출퇴근 기록 테이블
CREATE TABLE IF NOT EXISTS attendance_records (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id     INTEGER NOT NULL REFERENCES employees(id),  -- 직원 ID
    work_date       TEXT NOT NULL,                              -- 근무 날짜 (YYYY-MM-DD)
    clock_in        TEXT,                                       -- 출근 시각 (HH:MM)
    clock_out       TEXT,                                       -- 퇴근 시각 (HH:MM)
    work_hours      REAL,                                       -- 실제 근무시간 (시간 단위, 휴게 제외)
    overtime_hours  REAL DEFAULT 0,                             -- 연장근로 시간
    night_hours     REAL DEFAULT 0,                             -- 야간근로 시간 (22:00~06:00)
    memo            TEXT,                                       -- 메모 (지각/결근 사유 등)
    is_deleted      INTEGER NOT NULL DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendance_work_date ON attendance_records(work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance_records(employee_id);

-- 월별 급여 정산 테이블
CREATE TABLE IF NOT EXISTS salary_records (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id             INTEGER NOT NULL REFERENCES employees(id),
    year                    INTEGER NOT NULL,                   -- 정산 연도
    month                   INTEGER NOT NULL,                   -- 정산 월
    work_days               INTEGER DEFAULT 0,                  -- 총 근무일수
    total_work_hours        REAL DEFAULT 0,                     -- 총 근무시간
    total_overtime_hours    REAL DEFAULT 0,                     -- 연장근로 합계
    total_night_hours       REAL DEFAULT 0,                     -- 야간근로 합계
    base_pay                REAL DEFAULT 0,                     -- 기본급 (원)
    weekly_holiday_pay      REAL DEFAULT 0,                     -- 주휴수당 (원)
    overtime_pay            REAL DEFAULT 0,                     -- 연장근로수당 (원)
    night_pay               REAL DEFAULT 0,                     -- 야간근로수당 (원)
    gross_pay               REAL DEFAULT 0,                     -- 총 지급액 (원, 공제 전)
    deduction_pension       REAL DEFAULT 0,                     -- 국민연금 공제액
    deduction_health        REAL DEFAULT 0,                     -- 건강보험 공제액
    deduction_care          REAL DEFAULT 0,                     -- 장기요양보험 공제액
    deduction_employment    REAL DEFAULT 0,                     -- 고용보험 공제액
    total_deduction         REAL DEFAULT 0,                     -- 총 공제액
    net_pay                 REAL DEFAULT 0,                     -- 실수령액 (원)
    is_paid                 INTEGER DEFAULT 0,                  -- 지급 완료 여부 (0/1)
    paid_date               TEXT,                               -- 지급일 (YYYY-MM-DD)
    memo                    TEXT,
    is_deleted              INTEGER NOT NULL DEFAULT 0,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, year, month)                            -- 직원당 월 1개 정산
);
