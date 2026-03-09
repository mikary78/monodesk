-- ============================================================
-- 법인 관리 모듈 테이블 생성 마이그레이션
-- 날짜: 2026-03-09
-- 대상: partners, dividend_records, corporate_expenses
-- ============================================================

-- 동업자 정보 테이블
CREATE TABLE IF NOT EXISTS partners (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    name             TEXT    NOT NULL,                          -- 동업자 이름
    equity_ratio     REAL    NOT NULL,                          -- 지분율 (%)
    phone            TEXT,                                      -- 연락처
    email            TEXT,                                      -- 이메일
    bank_name        TEXT,                                      -- 은행명
    bank_account     TEXT,                                      -- 배당금 이체 계좌 (민감 정보)
    role             TEXT    DEFAULT '이사',                    -- 법인 내 역할
    investment_amount REAL   DEFAULT 0,                         -- 출자금 (원)
    memo             TEXT,                                      -- 비고
    is_deleted       INTEGER DEFAULT 0,                         -- 소프트 삭제
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 배당 정산 기록 테이블
CREATE TABLE IF NOT EXISTS dividend_records (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    year                   INTEGER NOT NULL,                    -- 정산 연도
    partner_id             INTEGER NOT NULL,                    -- 동업자 ID
    partner_name           TEXT    NOT NULL,                    -- 동업자 이름 스냅샷
    equity_ratio_snapshot  REAL    NOT NULL,                    -- 정산 시점 지분율 스냅샷
    annual_net_profit      REAL    DEFAULT 0,                   -- 연간 순이익
    distributable_amount   REAL    DEFAULT 0,                   -- 배당 대상 금액
    dividend_amount        REAL    DEFAULT 0,                   -- 배당금
    is_paid                INTEGER DEFAULT 0,                   -- 지급 완료 여부
    paid_date              TEXT,                                -- 지급일 (YYYY-MM-DD)
    memo                   TEXT,
    is_deleted             INTEGER DEFAULT 0,
    created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (year, partner_id)                                   -- 연도+동업자 고유 제약
);

-- 법인 비용 테이블
CREATE TABLE IF NOT EXISTS corporate_expenses (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    year           INTEGER NOT NULL,                            -- 발생 연도
    month          INTEGER NOT NULL,                            -- 발생 월
    expense_date   TEXT    NOT NULL,                            -- 발생 날짜 (YYYY-MM-DD)
    category       TEXT    NOT NULL,                            -- 비용 분류
    description    TEXT    NOT NULL,                            -- 비용 내용
    vendor         TEXT,                                        -- 거래처명
    amount         REAL    NOT NULL,                            -- 금액 (원)
    payment_method TEXT    DEFAULT '계좌이체',                  -- 결제 수단
    is_recurring   INTEGER DEFAULT 0,                           -- 반복 비용 여부
    memo           TEXT,
    is_deleted     INTEGER DEFAULT 0,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_corporate_expenses_year ON corporate_expenses(year);
CREATE INDEX IF NOT EXISTS idx_dividend_records_year ON dividend_records(year);
