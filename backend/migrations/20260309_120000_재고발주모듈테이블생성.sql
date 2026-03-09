-- ============================================================
-- 마이그레이션: 재고/발주 관리 모듈 테이블 생성
-- 날짜: 2026-03-09
-- 설명: 재고 분류, 재고 품목, 수량 조정 이력, 발주서, 발주 품목 테이블 신규 생성
-- ============================================================

-- 재고 분류 테이블
CREATE TABLE IF NOT EXISTS inventory_categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        VARCHAR(50)  NOT NULL UNIQUE,
    description VARCHAR(200),
    color       VARCHAR(7)   DEFAULT '#64748B',
    is_deleted  INTEGER      DEFAULT 0,
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- 재고 품목 테이블
CREATE TABLE IF NOT EXISTS inventory_items (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    name                   VARCHAR(100) NOT NULL,
    category_id            INTEGER      NOT NULL REFERENCES inventory_categories(id),
    unit                   VARCHAR(20)  NOT NULL DEFAULT '개',
    current_quantity       FLOAT        DEFAULT 0,
    min_quantity           FLOAT        DEFAULT 0,
    default_order_quantity FLOAT        DEFAULT 1,
    unit_price             FLOAT        DEFAULT 0,
    supplier               VARCHAR(100),
    memo                   TEXT,
    is_deleted             INTEGER      DEFAULT 0,
    created_at             DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- 발주서 테이블 (InventoryAdjustment에서 외래키로 참조하므로 먼저 생성)
CREATE TABLE IF NOT EXISTS purchase_orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number   VARCHAR(30)  NOT NULL UNIQUE,
    supplier       VARCHAR(100) NOT NULL,
    order_date     VARCHAR(10)  NOT NULL,
    expected_date  VARCHAR(10),
    received_date  VARCHAR(10),
    status         VARCHAR(20)  NOT NULL DEFAULT '발주중',
    total_amount   FLOAT        DEFAULT 0,
    memo           TEXT,
    is_deleted     INTEGER      DEFAULT 0,
    created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- 재고 수량 조정 이력 테이블
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id           INTEGER     NOT NULL REFERENCES inventory_items(id),
    adjustment_type   VARCHAR(20) NOT NULL,
    quantity_change   FLOAT       NOT NULL,
    quantity_before   FLOAT       NOT NULL,
    quantity_after    FLOAT       NOT NULL,
    adjustment_date   VARCHAR(10) NOT NULL,
    purchase_order_id INTEGER     REFERENCES purchase_orders(id),
    unit_price        FLOAT,
    memo              TEXT,
    is_deleted        INTEGER     DEFAULT 0,
    created_at        DATETIME    DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME    DEFAULT CURRENT_TIMESTAMP
);

-- 발주 품목 테이블
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id          INTEGER NOT NULL REFERENCES purchase_orders(id),
    item_id           INTEGER NOT NULL REFERENCES inventory_items(id),
    quantity          FLOAT   NOT NULL,
    unit_price        FLOAT   DEFAULT 0,
    received_quantity FLOAT   DEFAULT 0,
    memo              TEXT,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_item ON inventory_adjustments(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_date ON inventory_adjustments(adjustment_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON purchase_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(order_id);
