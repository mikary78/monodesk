-- ============================================================
-- migrations/015_inventory_snapshot.sql
-- 월초/월말 재고 스냅샷 테이블 생성
-- 월말 확정 후 다음달 월초로 자동 이월되는 구조
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_type TEXT NOT NULL,   -- 'month_start' | 'month_end'
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    item_id INTEGER NOT NULL REFERENCES inventory_items(id),
    quantity REAL DEFAULT 0,
    unit_price INTEGER DEFAULT 0,
    amount INTEGER DEFAULT 0,      -- quantity × unit_price 자동계산
    is_confirmed BOOLEAN DEFAULT 0,
    confirmed_at DATETIME,
    memo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(snapshot_type, year, month, item_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshot_type_ym
    ON inventory_snapshots(snapshot_type, year, month);
CREATE INDEX IF NOT EXISTS idx_snapshot_item
    ON inventory_snapshots(item_id);
