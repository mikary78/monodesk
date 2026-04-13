-- ============================================================
-- 017_auth.sql — 사용자 인증 테이블 생성
-- 로그인 계정 및 역할(admin/manager/staff) 관리
-- ============================================================

-- 사용자 계정 테이블 생성
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,          -- 로그인 아이디 (유니크)
    password_hash TEXT NOT NULL,            -- bcrypt 해시된 비밀번호
    name TEXT NOT NULL,                     -- 표시 이름 (한국어 이름)
    role TEXT NOT NULL DEFAULT 'staff',     -- 역할: admin / manager / staff
    is_active BOOLEAN DEFAULT 1,            -- 계정 활성화 여부 (0=비활성)
    last_login DATETIME,                    -- 마지막 로그인 시각
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 기본 관리자 계정 삽입 (비밀번호: admin1234, bcrypt 4.0.1 기준 생성)
-- 주의: bcrypt 버전이 변경되면 이 해시값도 재생성 필요
INSERT OR IGNORE INTO users (username, password_hash, name, role, is_active)
VALUES (
    'admin',
    '$2b$12$Gb8FTNYZ7S46rKr9orJUXukepdAspSBW6grAjmW0GCeikP.n8wDiK',
    '관리자',
    'admin',
    1
)
