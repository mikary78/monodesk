-- ============================================================
-- migrations/013_employee_detail.sql
-- 직원 상세 정보 컬럼 추가
-- 근무파트, 식대/차량유지비 비과세, 근무조건, 계약형태를 관리합니다.
-- ============================================================

-- 근무파트: hall(홀) / kitchen(주방) / management(관리)
ALTER TABLE employees ADD COLUMN work_part TEXT DEFAULT 'hall';

-- 식대 비과세 (기본 200,000원 — 소득세법 제12조 비과세 한도)
ALTER TABLE employees ADD COLUMN meal_allowance INTEGER DEFAULT 200000;

-- 차량유지비 비과세 (소득세법 제12조)
ALTER TABLE employees ADD COLUMN car_allowance INTEGER DEFAULT 0;

-- 근무조건 텍스트 (예: 주5일 17:00~24:00)
ALTER TABLE employees ADD COLUMN work_condition TEXT;

-- 계약형태: 4대보험 / 3.3% / 시급알바
ALTER TABLE employees ADD COLUMN contract_type TEXT DEFAULT '4대보험';
