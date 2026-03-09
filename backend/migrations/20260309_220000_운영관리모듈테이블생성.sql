-- ============================================================
-- 운영 관리 모듈 테이블 생성 마이그레이션
-- 작성일: 2026-03-09
-- 대상 테이블: notices, hygiene_checklists, hygiene_records,
--              business_days, task_checklists, task_records
-- ============================================================

-- 1. 공지사항 테이블
CREATE TABLE IF NOT EXISTS notices (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       VARCHAR(200) NOT NULL,                          -- 공지 제목
    content     TEXT NOT NULL,                                  -- 공지 본문
    notice_type VARCHAR(20)  NOT NULL DEFAULT 'notice',         -- 유형: notice/memo/urgent
    is_pinned   INTEGER      NOT NULL DEFAULT 0,                -- 상단 고정 여부
    author      VARCHAR(50),                                    -- 작성자
    is_deleted  INTEGER      NOT NULL DEFAULT 0,                -- 소프트 삭제
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notices_type    ON notices (notice_type);
CREATE INDEX IF NOT EXISTS idx_notices_pinned  ON notices (is_pinned);

-- 2. 위생 점검 체크리스트 항목 테이블
CREATE TABLE IF NOT EXISTS hygiene_checklists (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name   VARCHAR(200) NOT NULL,                          -- 점검 항목명
    check_type  VARCHAR(20)  NOT NULL DEFAULT 'daily',          -- open/close/daily
    category    VARCHAR(50)  NOT NULL DEFAULT 'kitchen',        -- kitchen/hall/restroom/equipment
    sort_order  INTEGER      NOT NULL DEFAULT 0,                -- 정렬 순서
    is_deleted  INTEGER      NOT NULL DEFAULT 0,                -- 소프트 삭제
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. 위생 점검 기록 테이블
CREATE TABLE IF NOT EXISTS hygiene_records (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    check_date    VARCHAR(10)  NOT NULL,                        -- 점검 날짜 YYYY-MM-DD
    checklist_id  INTEGER      NOT NULL,                        -- FK → hygiene_checklists.id
    result        VARCHAR(10)  NOT NULL DEFAULT 'pass',         -- pass/fail/na
    inspector     VARCHAR(50),                                  -- 점검자
    memo          TEXT,                                         -- 비고
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (checklist_id) REFERENCES hygiene_checklists(id)
);

CREATE INDEX IF NOT EXISTS idx_hygiene_records_date ON hygiene_records (check_date);

-- 4. 영업일 관리 테이블
CREATE TABLE IF NOT EXISTS business_days (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    business_date   VARCHAR(10)  NOT NULL UNIQUE,               -- 날짜 YYYY-MM-DD (유니크)
    status          VARCHAR(20)  NOT NULL DEFAULT 'open',       -- open/closed/special
    closed_reason   VARCHAR(200),                               -- 휴무 사유
    memo            TEXT,                                       -- 특이사항
    target_sales    REAL,                                       -- 매출 목표
    weather         VARCHAR(50),                                -- 날씨
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_business_days_date   ON business_days (business_date);

-- 5. 업무 체크리스트 항목 테이블
CREATE TABLE IF NOT EXISTS task_checklists (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_name   VARCHAR(200) NOT NULL,                          -- 업무 항목명
    task_type   VARCHAR(20)  NOT NULL DEFAULT 'open',           -- open/close/weekly/monthly
    role        VARCHAR(50),                                    -- 담당 역할
    sort_order  INTEGER      NOT NULL DEFAULT 0,                -- 정렬 순서
    is_deleted  INTEGER      NOT NULL DEFAULT 0,                -- 소프트 삭제
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. 업무 완료 기록 테이블
CREATE TABLE IF NOT EXISTS task_records (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    record_date   VARCHAR(10)  NOT NULL,                        -- 기록 날짜 YYYY-MM-DD
    task_id       INTEGER      NOT NULL,                        -- FK → task_checklists.id
    is_done       INTEGER      NOT NULL DEFAULT 0,              -- 완료 여부
    completed_by  VARCHAR(50),                                  -- 완료자
    memo          TEXT,                                         -- 비고
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES task_checklists(id)
);

CREATE INDEX IF NOT EXISTS idx_task_records_date ON task_records (record_date);
