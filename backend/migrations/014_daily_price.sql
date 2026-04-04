-- ============================================================
-- migrations/014_daily_price.sql
-- 데일리 단가 추적 기능 추가
-- 수산물 등 시가 품목의 일별 매입 단가와 수량을 추적합니다.
-- ============================================================

-- 데일리 단가 기록 테이블
CREATE TABLE IF NOT EXISTS daily_price_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES inventory_items(id),
    record_date DATE NOT NULL,
    quantity REAL DEFAULT 0,
    unit_price INTEGER DEFAULT 0,
    amount INTEGER DEFAULT 0,      -- quantity × unit_price 자동계산
    vendor TEXT,                   -- 당일 구매처
    memo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(item_id, record_date)
);

-- 데일리 단가 추적 대상 품목 플래그
ALTER TABLE inventory_items
ADD COLUMN is_daily_price_tracked BOOLEAN DEFAULT 0;

-- 조회 성능 인덱스
CREATE INDEX IF NOT EXISTS idx_daily_price_item_date
    ON daily_price_records(item_id, record_date);
CREATE INDEX IF NOT EXISTS idx_daily_price_date
    ON daily_price_records(record_date);
