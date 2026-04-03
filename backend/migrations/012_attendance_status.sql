-- ============================================================
-- 마이그레이션 012: attendance_records 테이블에 daily_status 컬럼 추가
-- 목적: 근무표 달력 기능을 위해 일일 근무 상태 구분 컬럼 추가
-- 적용일: 2026-04-03
-- ============================================================

-- daily_status 컬럼 추가 (기본값: 'work')
-- 허용값: work(근무), off(정기휴무), annual(월차), half_am(반차_오전),
--         half_pm(반차_오후), absent(무단결근), early_leave(무단조퇴),
--         recommended_off(권장휴무), support(타매장지원)
ALTER TABLE attendance_records
ADD COLUMN daily_status TEXT DEFAULT 'work';
