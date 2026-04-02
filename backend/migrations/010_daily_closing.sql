-- ============================================================
-- 010_daily_closing.sql — 일일 마감 관련 테이블 생성
-- daily_closings: 현금 시재 관리
-- daily_issues: 특이사항 이슈 트래킹
-- ============================================================

-- 현금 시재 관리 테이블
CREATE TABLE IF NOT EXISTS daily_closings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    closing_date DATE NOT NULL UNIQUE,  -- 마감 날짜 (하루에 1개)
    bill_100000 INTEGER DEFAULT 0,      -- 십만원권 수량
    bill_50000  INTEGER DEFAULT 0,      -- 오만원권 수량
    bill_10000  INTEGER DEFAULT 0,      -- 만원권 수량
    bill_5000   INTEGER DEFAULT 0,      -- 오천원권 수량
    bill_1000   INTEGER DEFAULT 0,      -- 천원권 수량
    coin_500    INTEGER DEFAULT 0,      -- 오백원 수량
    coin_100    INTEGER DEFAULT 0,      -- 백원 수량
    total_cash  INTEGER DEFAULT 0,      -- 권종별 합계 (자동계산)
    prev_day_cash INTEGER DEFAULT 0,    -- 전일 이월 현금
    daily_deposit INTEGER DEFAULT 0,    -- 당일 입금액
    daily_expense INTEGER DEFAULT 0,    -- 당일 시재지출액
    balance     INTEGER DEFAULT 0,      -- 잔액 (자동계산)
    memo        TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 특이사항 이슈 트래킹 테이블
CREATE TABLE IF NOT EXISTS daily_issues (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_date   DATE NOT NULL,                         -- 발생 날짜
    issue_type   TEXT NOT NULL CHECK (issue_type IN ('customer','ingredient','employee')),
    content      TEXT NOT NULL,                         -- 특이사항 내역
    action_taken TEXT,                                  -- 처리내역
    is_resolved  INTEGER DEFAULT 0,                     -- 처리완료 여부 (0:미완료, 1:완료)
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_daily_closings_date ON daily_closings(closing_date);
CREATE INDEX IF NOT EXISTS idx_daily_issues_date   ON daily_issues(issue_date);
CREATE INDEX IF NOT EXISTS idx_daily_issues_type   ON daily_issues(issue_type);
