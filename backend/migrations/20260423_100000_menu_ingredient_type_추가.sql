-- ============================================================
-- 마이그레이션: 메뉴 구성 재료 구분(ingredient_type) 컬럼 추가
-- 작성일: 2026-04-23
-- 목적: 재료를 원재료/부재료/양념/소스/기타로 구분하는 필드 추가
-- ============================================================

-- menu_ingredients 테이블에 ingredient_type 컬럼 추가
ALTER TABLE menu_ingredients
ADD COLUMN ingredient_type VARCHAR(20) DEFAULT '원재료';

-- 기존 데이터는 기본값 '원재료'로 자동 설정됨
