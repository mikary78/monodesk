-- ============================================================
-- 마이그레이션: dividend_records 테이블에 원천징수 컬럼 추가
-- 날짜: 2026-03-11
-- 목적: 배당소득세 원천징수(15.4%) 및 세후 실수령액을 DB에 영속화
--       (소득세법 제129조: 배당소득세 14% + 지방소득세 1.4%)
-- 기존 데이터 하위 호환: NULL 허용 컬럼으로 추가 (기존 레코드 영향 없음)
-- ============================================================

-- 원천징수세액 컬럼 추가 (배당금 × 15.4%)
ALTER TABLE dividend_records
ADD COLUMN withholding_tax REAL DEFAULT NULL;

-- 세후 실수령액 컬럼 추가 (세전 배당금 - 원천징수세액)
ALTER TABLE dividend_records
ADD COLUMN net_dividend REAL DEFAULT NULL;

-- 마이그레이션 완료 확인용 주석
-- withholding_tax: NULL이면 구 데이터 (원천징수 미반영), 값이 있으면 신규 데이터
-- net_dividend: NULL이면 구 데이터 (실수령액 미반영), 값이 있으면 신규 데이터
