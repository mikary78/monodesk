-- ============================================================
-- 마이그레이션: menu_ingredients 테이블에 inventory_items FK 추가
-- 작성일: 2026-03-12
-- 목적: MenuIngredient.inventory_item_id 컬럼에 외래키 제약 적용
--       SQLite는 기존 컬럼에 FK를 ALTER TABLE로 추가할 수 없으므로
--       테이블 재생성(rename → create → copy → drop) 방식을 사용합니다.
-- 적용 방법 (서버 재시작 없이):
--   SQLite CLI 또는 DB Browser for SQLite에서 아래 SQL을 실행합니다.
--   1) 파일 열기: backend/database/monodesk.db
--   2) "SQL 실행" 탭에서 이 파일 전체 내용 붙여넣기 후 실행
-- ============================================================

-- 외래키 지원 활성화 (SQLite 기본값 OFF)
PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

-- 1단계: 기존 테이블을 임시 이름으로 백업
ALTER TABLE menu_ingredients RENAME TO menu_ingredients_backup;

-- 2단계: FK 제약을 포함한 새 테이블 생성
CREATE TABLE menu_ingredients (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_item_id      INTEGER NOT NULL
                        REFERENCES menu_items(id) ON DELETE CASCADE,
    ingredient_name   VARCHAR(100) NOT NULL,
    -- inventory_items 삭제 시 SET NULL (레시피 재료 데이터는 보존)
    inventory_item_id INTEGER
                        REFERENCES inventory_items(id) ON DELETE SET NULL,
    quantity          REAL NOT NULL,
    unit              VARCHAR(20) DEFAULT 'g',
    unit_price        REAL DEFAULT 0,
    created_at        DATETIME DEFAULT (datetime('now')),
    updated_at        DATETIME DEFAULT (datetime('now'))
);

-- 3단계: 기존 데이터 복사
INSERT INTO menu_ingredients (
    id, menu_item_id, ingredient_name, inventory_item_id,
    quantity, unit, unit_price, created_at, updated_at
)
SELECT
    id, menu_item_id, ingredient_name, inventory_item_id,
    quantity, unit, unit_price, created_at, updated_at
FROM menu_ingredients_backup;

-- 4단계: 백업 테이블 삭제
DROP TABLE menu_ingredients_backup;

COMMIT;

-- 외래키 지원 재활성화
PRAGMA foreign_keys = ON;

-- 적용 확인 (FK 목록 출력 — inventory_items 참조가 보이면 성공)
PRAGMA foreign_key_list(menu_ingredients);
