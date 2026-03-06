# MonoDesk 프로젝트 구조 문서 (Project Structure)

문서 버전: v1.0
작성일: 2025년
작성자: MonoBound 대표 (Claude Code 협업)

---

## 1. 전체 폴더 구조

```
MonoDesk/
├── frontend/                        # React 프론트엔드
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/              # 재사용 컴포넌트
│   │   │   ├── common/              # 공통 컴포넌트
│   │   │   │   ├── Button.jsx
│   │   │   │   ├── Card.jsx
│   │   │   │   ├── Input.jsx
│   │   │   │   ├── Modal.jsx
│   │   │   │   ├── Table.jsx
│   │   │   │   ├── Badge.jsx
│   │   │   │   ├── Toast.jsx
│   │   │   │   ├── Loading.jsx
│   │   │   │   └── EmptyState.jsx
│   │   │   ├── layout/              # 레이아웃 컴포넌트
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   ├── Header.jsx
│   │   │   │   └── Layout.jsx
│   │   │   └── modules/             # 모듈별 컴포넌트
│   │   │       ├── accounting/      # 세무/회계
│   │   │       ├── sales/           # 매출 분석
│   │   │       ├── inventory/       # 재고/발주
│   │   │       ├── menu/            # 메뉴 관리
│   │   │       ├── employee/        # 직원 관리
│   │   │       ├── dashboard/       # 대시보드
│   │   │       ├── corporate/       # 법인 관리
│   │   │       └── operations/      # 운영 관리
│   │   ├── pages/                   # 페이지 컴포넌트
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Accounting.jsx
│   │   │   ├── Sales.jsx
│   │   │   ├── Inventory.jsx
│   │   │   ├── Menu.jsx
│   │   │   ├── Employee.jsx
│   │   │   ├── Corporate.jsx
│   │   │   └── Operations.jsx
│   │   ├── hooks/                   # 커스텀 훅
│   │   │   ├── useAccounting.js
│   │   │   ├── useSales.js
│   │   │   └── useTheme.js
│   │   ├── api/                     # API 호출 함수
│   │   │   ├── accounting.js
│   │   │   ├── sales.js
│   │   │   ├── inventory.js
│   │   │   ├── menu.js
│   │   │   ├── employee.js
│   │   │   └── corporate.js
│   │   ├── utils/                   # 유틸리티 함수
│   │   │   ├── formatter.js         # 숫자/날짜 포맷
│   │   │   ├── calculator.js        # 계산 로직
│   │   │   └── validator.js         # 입력 유효성 검사
│   │   ├── constants/               # 상수 정의
│   │   │   ├── categories.js        # 지출 분류 등
│   │   │   └── shareholders.js      # 동업자 지분 정보
│   │   ├── styles/                  # 스타일
│   │   │   └── index.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── __tests__/                   # 프론트엔드 테스트
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── backend/                         # Python FastAPI 백엔드
│   ├── main.py                      # FastAPI 앱 진입점
│   ├── database.py                  # DB 연결 설정
│   ├── routers/                     # API 라우터
│   │   ├── accounting.py            # 세무/회계 API
│   │   ├── sales.py                 # 매출 분석 API
│   │   ├── inventory.py             # 재고/발주 API
│   │   ├── menu.py                  # 메뉴 관리 API
│   │   ├── employee.py              # 직원 관리 API
│   │   ├── corporate.py             # 법인 관리 API
│   │   ├── operations.py            # 운영 관리 API
│   │   └── ai.py                    # AI 기능 API
│   ├── models/                      # SQLAlchemy 모델
│   │   ├── accounting.py
│   │   ├── sales.py
│   │   ├── inventory.py
│   │   ├── menu.py
│   │   ├── employee.py
│   │   └── corporate.py
│   ├── schemas/                     # Pydantic 스키마
│   │   ├── accounting.py
│   │   ├── sales.py
│   │   └── employee.py
│   ├── services/                    # 비즈니스 로직
│   │   ├── accounting_service.py    # 손익 계산, 지분 정산
│   │   ├── sales_service.py         # 매출 분석
│   │   ├── employee_service.py      # 급여 계산
│   │   └── report_service.py        # Excel 리포트 생성
│   ├── ai/                          # AI 기능 모듈
│   │   ├── ocr.py                   # 영수증 OCR
│   │   ├── whisper.py               # 음성 → 텍스트
│   │   ├── ollama_client.py         # Ollama 연동
│   │   └── vector_search.py         # ChromaDB 검색
│   ├── utils/                       # 유틸리티
│   │   ├── file_handler.py          # 파일 업로드/저장
│   │   ├── backup.py                # 백업 관리
│   │   └── scheduler.py             # 자동 백업 스케줄러
│   ├── migrations/                  # DB 마이그레이션
│   ├── tests/                       # 백엔드 테스트
│   └── requirements.txt
│
├── database/                        # 데이터 저장
│   ├── monodesk.db                  # SQLite 메인 DB
│   └── chromadb/                    # 벡터 DB
│
├── uploads/                         # 업로드 파일
│   ├── receipts/                    # 영수증 이미지
│   │   └── YYYY/MM/
│   ├── documents/                   # 법인 문서
│   │   ├── contracts/
│   │   ├── minutes/
│   │   └── legal/
│   └── audio/                       # 회의 음성
│       └── YYYY/MM/
│
├── backup/                          # 백업 파일
│   ├── auto/
│   └── manual/
│
├── history/                         # 변경 이력 문서
│
├── .claude/                         # Claude 설정
│   ├── CLAUDE.md
│   ├── agents/
│   └── policies/
│
├── PRD.md                           # 제품 요구사항
├── DEVPLAN.md                       # 개발 계획서
├── STRUCTURE.md                     # 프로젝트 구조
├── README.md                        # 프로젝트 소개
├── .gitignore
└── .env.example                     # 환경변수 예시
```

---

## 2. 데이터베이스 스키마

### 2-1. 매출 관련 테이블

```sql
-- 매출 기록
CREATE TABLE sales_records (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_date       DATE NOT NULL,              -- 매출 날짜
    card_amount     INTEGER DEFAULT 0,          -- 카드 매출
    cash_amount     INTEGER DEFAULT 0,          -- 현금 매출
    other_amount    INTEGER DEFAULT 0,          -- 기타 매출
    total_amount    INTEGER DEFAULT 0,          -- 총 매출 (자동 계산)
    memo            TEXT,                       -- 메모
    source          TEXT DEFAULT 'manual',      -- 입력 방법 (manual/pos)
    is_deleted      INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- POS 원본 데이터
CREATE TABLE pos_raw_data (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_date       DATE NOT NULL,
    menu_name       TEXT,                       -- 메뉴명
    quantity        INTEGER DEFAULT 1,          -- 수량
    unit_price      INTEGER DEFAULT 0,          -- 단가
    total_price     INTEGER DEFAULT 0,          -- 합계
    payment_method  TEXT,                       -- 결제 수단
    sale_time       TIME,                       -- 판매 시간
    imported_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2-2. 지출 관련 테이블

```sql
-- 지출 분류
CREATE TABLE expense_categories (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,              -- 분류명
    description     TEXT,
    is_active       INTEGER DEFAULT 1
);

-- 기본 분류 데이터
INSERT INTO expense_categories (name) VALUES
('재료비'), ('임대료'), ('인건비'), ('공과금'),
('소모품'), ('수수료'), ('광고비'), ('기타');

-- 지출 기록
CREATE TABLE expense_records (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_date    DATE NOT NULL,              -- 지출 날짜
    category_id     INTEGER,                    -- 지출 분류
    vendor_name     TEXT,                       -- 거래처명
    description     TEXT,                       -- 내용
    amount          INTEGER NOT NULL,           -- 금액
    tax_invoice     INTEGER DEFAULT 0,          -- 세금계산서 여부
    receipt_image   TEXT,                       -- 영수증 이미지 경로
    memo            TEXT,
    is_deleted      INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES expense_categories(id)
);
```

### 2-3. 직원 관련 테이블

```sql
-- 직원 정보
CREATE TABLE employees (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,              -- 이름
    employee_type   TEXT NOT NULL,              -- 'full_time' / 'part_time'
    position        TEXT,                       -- 직책
    hire_date       DATE,                       -- 입사일
    resign_date     DATE,                       -- 퇴사일
    hourly_wage     INTEGER DEFAULT 0,          -- 시급 (알바)
    monthly_salary  INTEGER DEFAULT 0,          -- 월급 (정직원)
    phone           TEXT,                       -- 연락처 (마스킹)
    bank_account    TEXT,                       -- 계좌번호 (마스킹)
    contract_file   TEXT,                       -- 계약서 파일 경로
    is_active       INTEGER DEFAULT 1,
    is_deleted      INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 근태 기록
CREATE TABLE attendance_records (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id     INTEGER NOT NULL,
    work_date       DATE NOT NULL,
    check_in        TIME,                       -- 출근 시간
    check_out       TIME,                       -- 퇴근 시간
    work_hours      REAL DEFAULT 0,             -- 근무 시간
    memo            TEXT,
    is_deleted      INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- 급여 지급 내역
CREATE TABLE salary_records (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id     INTEGER NOT NULL,           -- 직원
    pay_year        INTEGER NOT NULL,           -- 지급 연도
    pay_month       INTEGER NOT NULL,           -- 지급 월
    base_salary     INTEGER DEFAULT 0,          -- 기본급
    overtime_pay    INTEGER DEFAULT 0,          -- 초과근무수당
    deduction       INTEGER DEFAULT 0,          -- 공제액 (4대보험)
    net_salary      INTEGER DEFAULT 0,          -- 실수령액
    paid_date       DATE,                       -- 지급일
    is_deleted      INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);
```

### 2-4. 메뉴 관련 테이블

```sql
-- 메뉴 정보
CREATE TABLE menu_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,              -- 메뉴명
    category        TEXT,                       -- 카테고리
    price           INTEGER DEFAULT 0,          -- 판매가
    cost            INTEGER DEFAULT 0,          -- 원가 (자동 계산)
    margin_rate     REAL DEFAULT 0,             -- 마진율 (자동 계산)
    season          TEXT DEFAULT 'all',         -- 계절 (all/spring/summer/fall/winter)
    is_active       INTEGER DEFAULT 1,
    description     TEXT,
    image_path      TEXT,
    is_deleted      INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 메뉴 레시피
CREATE TABLE menu_recipes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_id         INTEGER NOT NULL,
    ingredient_name TEXT NOT NULL,              -- 재료명
    quantity        REAL DEFAULT 0,             -- 수량
    unit            TEXT,                       -- 단위 (g, ml, 개)
    unit_cost       INTEGER DEFAULT 0,          -- 재료 단가
    FOREIGN KEY (menu_id) REFERENCES menu_items(id)
);
```

### 2-5. 재고 관련 테이블

```sql
-- 거래처 정보
CREATE TABLE suppliers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,              -- 거래처명
    contact_name    TEXT,                       -- 담당자
    phone           TEXT,                       -- 연락처
    category        TEXT,                       -- 거래처 분류
    memo            TEXT,
    is_active       INTEGER DEFAULT 1,
    is_deleted      INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 재고 항목
CREATE TABLE inventory_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,              -- 재료명
    unit            TEXT,                       -- 단위
    current_stock   REAL DEFAULT 0,             -- 현재 재고
    min_stock       REAL DEFAULT 0,             -- 최소 재고 (부족 알림 기준)
    unit_price      INTEGER DEFAULT 0,          -- 단가
    supplier_id     INTEGER,                    -- 주거래처
    is_active       INTEGER DEFAULT 1,
    is_deleted      INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- 발주 내역
CREATE TABLE purchase_orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_date      DATE NOT NULL,              -- 발주일
    supplier_id     INTEGER,                    -- 거래처
    item_id         INTEGER,                    -- 재고 항목
    quantity        REAL DEFAULT 0,             -- 발주 수량
    unit_price      INTEGER DEFAULT 0,          -- 단가
    total_price     INTEGER DEFAULT 0,          -- 합계
    status          TEXT DEFAULT 'ordered',     -- ordered/received
    memo            TEXT,
    is_deleted      INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (item_id) REFERENCES inventory_items(id)
);
```

### 2-6. 법인 관련 테이블

```sql
-- 주주(동업자) 정보
CREATE TABLE shareholders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,              -- 이름
    share_ratio     REAL NOT NULL,              -- 지분 비율 (0.29 등)
    role            TEXT,                       -- 역할
    is_active       INTEGER DEFAULT 1,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 기본 주주 데이터
INSERT INTO shareholders (name, share_ratio, role) VALUES
('주주1', 0.29, '공동대표'),
('주주2', 0.29, '이사'),
('주주3', 0.29, '이사'),
('주주4', 0.13, '이사');

-- 배당 기록
CREATE TABLE dividend_records (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    dividend_year   INTEGER NOT NULL,           -- 배당 연도
    shareholder_id  INTEGER NOT NULL,           -- 주주
    base_amount     INTEGER DEFAULT 0,          -- 기준 순이익
    dividend_amount INTEGER DEFAULT 0,          -- 배당금
    tax_amount      INTEGER DEFAULT 0,          -- 배당소득세
    net_amount      INTEGER DEFAULT 0,          -- 실수령액
    paid_date       DATE,
    is_deleted      INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shareholder_id) REFERENCES shareholders(id)
);

-- 회의록
CREATE TABLE corporate_minutes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_date    DATE NOT NULL,              -- 회의 날짜
    meeting_type    TEXT,                       -- 주주총회/이사회/기타
    attendees       TEXT,                       -- 참석자
    agenda          TEXT,                       -- 안건
    content         TEXT,                       -- 회의 내용
    decisions       TEXT,                       -- 결정 사항
    audio_file      TEXT,                       -- 원본 음성 파일
    document_file   TEXT,                       -- 문서 파일
    is_deleted      INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 계약서 관리
CREATE TABLE contracts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_name   TEXT NOT NULL,              -- 계약명
    contract_type   TEXT,                       -- 임대차/거래처/기타
    counterparty    TEXT,                       -- 계약 상대방
    start_date      DATE,                       -- 계약 시작일
    end_date        DATE,                       -- 계약 만료일
    file_path       TEXT,                       -- 파일 경로
    memo            TEXT,
    is_deleted      INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 3. API 엔드포인트 구조

### 세무/회계 API
```
GET    /api/accounting/sales              # 매출 목록
POST   /api/accounting/sales              # 매출 입력
PUT    /api/accounting/sales/{id}         # 매출 수정
DELETE /api/accounting/sales/{id}         # 매출 삭제

GET    /api/accounting/expenses           # 지출 목록
POST   /api/accounting/expenses           # 지출 입력
PUT    /api/accounting/expenses/{id}      # 지출 수정
DELETE /api/accounting/expenses/{id}      # 지출 삭제

GET    /api/accounting/profit/{year}/{month}    # 월별 손익
GET    /api/accounting/dividend/{year}/{month}  # 지분 정산 시뮬레이션
POST   /api/accounting/report/{year}/{month}    # Excel 리포트 생성
```

### 매출 분석 API
```
POST   /api/sales/import                  # POS 데이터 가져오기
GET    /api/sales/trend                   # 매출 트렌드
GET    /api/sales/menu-analysis           # 메뉴 분석
GET    /api/sales/by-weekday              # 요일별 분석
GET    /api/sales/by-hour                 # 시간대별 분석
```

### AI API
```
POST   /api/ai/ocr                        # 영수증 OCR
POST   /api/ai/transcribe                 # 음성 → 텍스트
POST   /api/ai/analyze                    # 매출 분석 리포트
POST   /api/ai/search                     # 문서 검색
GET    /api/ai/status                     # Ollama 상태 확인
```

---

## 4. 실행 방법

### 개발 환경 실행
```bash
# 백엔드 실행
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# 프론트엔드 실행
cd frontend
npm install
npm run dev
```

### 브라우저 접속
```
http://localhost:5173
```

---

이 문서는 MonoDesk의 프로젝트 구조 기준입니다.
구조 변경 시 반드시 이 문서를 함께 업데이트합니다.
