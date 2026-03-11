-- ============================================================
-- 마이그레이션: POS 메뉴 마스터 테이블 이름 변경
-- 날짜: 2026-03-10
-- 사유: menu_items 테이블 이름이 메뉴 관리 모듈과 충돌하여 서버 기동 오류 발생
--       sales_analysis 모듈의 MenuItem을 PosMenuItem으로 분리
-- ============================================================

-- 기존 menu_items 테이블이 sales_analysis 모듈에서 생성된 경우만 이름 변경
-- (이미 menu.py의 menu_items가 존재하면 이 작업 불필요)
-- SQLite는 ALTER TABLE ... RENAME TO 지원

-- 주의: 서버를 처음 시작하는 경우 SQLAlchemy가 자동으로 pos_menu_items를 생성합니다.
-- 기존 데이터가 있는 경우에만 아래 명령을 수동 실행하세요.

-- ALTER TABLE menu_items RENAME TO pos_menu_items;

-- 새 테이블 자동 생성 (서버 재시작 시 SQLAlchemy가 처리)
CREATE TABLE IF NOT EXISTS pos_menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL UNIQUE,
    category VARCHAR(100) DEFAULT '기타',
    price FLOAT DEFAULT 0,
    cost FLOAT DEFAULT 0,
    is_seasonal BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME
);
