-- ============================================================
-- 메뉴 관리 모듈 테이블 생성 마이그레이션
-- 날짜: 2026-03-09
-- 포함 테이블: menu_categories, menu_items, menu_ingredients
-- ============================================================

-- 메뉴 카테고리 테이블
CREATE TABLE IF NOT EXISTS menu_categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,            -- 카테고리명 (예: 회/해산물, 주류)
    description TEXT,                               -- 카테고리 설명
    color       TEXT    DEFAULT '#64748B',           -- UI 표시 색상 (HEX)
    sort_order  INTEGER DEFAULT 0,                  -- 정렬 순서
    is_deleted  INTEGER DEFAULT 0,                  -- 소프트 삭제 (0: 정상, 1: 삭제)
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP, -- 생성일시
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP  -- 수정일시
);

-- 메뉴 아이템 테이블
CREATE TABLE IF NOT EXISTS menu_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,                   -- 메뉴명
    category_id INTEGER NOT NULL,                   -- 카테고리 FK
    price       REAL    NOT NULL,                   -- 판매가 (원)
    cost        REAL    DEFAULT 0,                  -- 원가 (원, 재료 기반 자동 계산 가능)
    description TEXT,                               -- 메뉴 설명
    allergens   TEXT,                               -- 알레르기 정보
    image_path  TEXT,                               -- 메뉴 이미지 경로
    is_active   INTEGER DEFAULT 1,                  -- 판매 여부 (1: 판매중, 0: 중지)
    is_featured INTEGER DEFAULT 0,                  -- 대표 메뉴 여부
    is_deleted  INTEGER DEFAULT 0,                  -- 소프트 삭제
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES menu_categories(id)
);

-- 메뉴 구성 재료 테이블
CREATE TABLE IF NOT EXISTS menu_ingredients (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id      INTEGER NOT NULL,             -- 메뉴 아이템 FK
    ingredient_name   TEXT    NOT NULL,             -- 재료명
    inventory_item_id INTEGER,                      -- 재고 품목 연동 ID (선택)
    quantity          REAL    NOT NULL,             -- 사용 수량
    unit              TEXT    DEFAULT 'g',          -- 단위 (g, ml, 개 등)
    unit_price        REAL    DEFAULT 0,            -- 단가 (원/단위)
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
);

-- 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_active ON menu_items(is_active, is_deleted);
CREATE INDEX IF NOT EXISTS idx_menu_ingredients_menu ON menu_ingredients(menu_item_id);
