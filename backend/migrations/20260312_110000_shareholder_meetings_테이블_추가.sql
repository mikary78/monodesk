-- ============================================================
-- 마이그레이션: shareholder_meetings 테이블 추가
-- 일시: 2026-03-12 11:00:00
-- 목적: 주주총회 의사록 기능 추가 (상법 제373조 — 10년 보관 의무)
-- 법인명: MonoBound / 매장명: 여남동
-- ============================================================

-- 주주총회 의사록 테이블 생성
CREATE TABLE IF NOT EXISTS shareholder_meetings (
    -- 기본 키
    id          INTEGER PRIMARY KEY AUTOINCREMENT,

    -- 개최일 (YYYY-MM-DD 형식)
    meeting_date    TEXT    NOT NULL,

    -- 회의 유형: 정기총회 | 임시총회
    meeting_type    TEXT    NOT NULL    DEFAULT '정기총회',

    -- 의사록 제목 (최대 200자)
    title           TEXT    NOT NULL,

    -- 개최 장소 (선택)
    location        TEXT,

    -- 안건 목록 (줄바꿈으로 구분하여 저장)
    agenda          TEXT,

    -- 결의 사항 (자유 형식 텍스트)
    resolution      TEXT,

    -- 참석자 정보 JSON 문자열
    -- 형식: [{"partner_id": 1, "name": "동업자A", "equity": 29.0, "is_present": true}]
    attendees_json  TEXT,

    -- 의사록 상태: 초안 | 확정
    status          TEXT    NOT NULL    DEFAULT '초안',

    -- 작성자
    created_by      TEXT,

    -- 소프트 삭제 (0: 정상, 1: 삭제)
    is_deleted      INTEGER NOT NULL    DEFAULT 0,

    -- 생성/수정 일시
    created_at      DATETIME            DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME            DEFAULT CURRENT_TIMESTAMP
);

-- 개최일 인덱스 (날짜 순 정렬 성능 향상)
CREATE INDEX IF NOT EXISTS idx_shareholder_meetings_date
    ON shareholder_meetings (meeting_date DESC);

-- 상태 인덱스 (초안/확정 필터 성능 향상)
CREATE INDEX IF NOT EXISTS idx_shareholder_meetings_status
    ON shareholder_meetings (status);

-- 소프트 삭제 인덱스 (삭제 여부 필터 성능 향상)
CREATE INDEX IF NOT EXISTS idx_shareholder_meetings_is_deleted
    ON shareholder_meetings (is_deleted);
