-- ============================================================
-- 018_daily_wage.sql — 일급 직원 지원을 위한 daily_wage 컬럼 추가
-- employees 테이블에 일급(원/일) 컬럼을 추가합니다.
-- ============================================================

ALTER TABLE employees ADD COLUMN daily_wage INTEGER DEFAULT 0;
