-- ============================================================
-- 011_fixed_costs.sql — 고정비 관리 테이블 생성
-- fixed_cost_items:   고정비 항목 마스터
-- fixed_cost_records: 월별 실제 지출 기록
-- ============================================================

-- 고정비 항목 마스터 테이블
CREATE TABLE IF NOT EXISTS fixed_cost_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,               -- 항목명 (임대료, 도시가스 등)
    category       TEXT NOT NULL,               -- 'facility' | 'operation'
    vendor_name    TEXT,                        -- 업체명
    payment_day    INTEGER,                     -- 이체일 (1~31)
    default_amount INTEGER DEFAULT 0,           -- 설정금액 (기본 예산)
    is_active      INTEGER DEFAULT 1,           -- 사용여부 (0: 비활성)
    sort_order     INTEGER DEFAULT 0,           -- 정렬순서
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 월별 실제 지출 기록 테이블
CREATE TABLE IF NOT EXISTS fixed_cost_records (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id        INTEGER NOT NULL REFERENCES fixed_cost_items(id),
    year           INTEGER NOT NULL,
    month          INTEGER NOT NULL,
    default_amount INTEGER DEFAULT 0,           -- 해당 월 설정금액 (마스터에서 복사)
    actual_amount  INTEGER DEFAULT 0,           -- 실제 지출금액
    payment_date   TEXT,                        -- 실제 납부일 (YYYY-MM-DD)
    memo           TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_id, year, month)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_fixed_cost_records_year_month ON fixed_cost_records(year, month);
CREATE INDEX IF NOT EXISTS idx_fixed_cost_items_category     ON fixed_cost_items(category);
