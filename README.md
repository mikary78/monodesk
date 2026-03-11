# MonoDesk

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Windows_Local-0078D4?style=flat-square&logo=windows&logoColor=white)

> 여남동 (MonoBound) — 용산 삼각지 제철해산물 주점을 위한 외식업 통합 관리 로컬 웹앱

---

## 소개

**MonoDesk**는 소규모 외식업 매장을 위해 설계된 올인원 관리 시스템입니다. 세무·회계부터 재고 발주, 직원 급여, 법인 정산까지 매장 운영에 필요한 모든 기능을 하나의 인터페이스에서 처리합니다.

- 인터넷 연결 없이 **Windows 로컬 환경**에서만 동작합니다.
- 외부 서버나 클라우드 없이 모든 데이터를 로컬 SQLite DB에 저장합니다.
- 비전문가도 유지보수할 수 있도록 단순하고 읽기 쉬운 코드 구조를 유지합니다.

---

## 주요 기능

| # | 모듈 | 주요 기능 |
|---|------|-----------|
| 1 | **세무/회계 관리** | 매출·지출 입력, 월별 손익 계산, 지분 정산 시뮬레이션, Excel 리포트 생성 |
| 2 | **매출 분석** | POS 데이터 연동, 트렌드·메뉴·시간대·결제수단 분석, AI 인사이트 |
| 3 | **재고/발주 관리** | 품목 재고 관리, 발주 등록, 재고 부족 알림, 조정 이력 |
| 4 | **메뉴 관리** | 메뉴 CRUD, 카테고리 분류, 레시피 기반 원가 자동 계산 |
| 5 | **직원 관리** | 직원 정보 등록, 근태 기록, 급여 계산 및 지급 내역 |
| 6 | **대시보드** | 핵심 KPI 카드, 매출 트렌드 차트, 재고 알림, 급여 현황 |
| 7 | **법인 관리** | 동업자 4인 지분 관리, 배당 정산 계산, 법인 비용 기록 |
| 8 | **운영 관리** | 공지사항, 위생 점검 체크리스트, 영업 캘린더, 업무 체크리스트 |

---

## 기술 스택

| 구분 | 기술 | 버전 |
|------|------|------|
| **Frontend** | React | 18 |
| | Tailwind CSS | 3 |
| | Vite | 최신 |
| | React Router | v6 |
| **Backend** | Python | 3.11+ |
| | FastAPI | 0.115+ |
| | Uvicorn | 0.30+ |
| | SQLAlchemy | 2.0+ |
| | Pydantic | 2.9+ |
| **Database** | SQLite | 3 |
| **AI (예정)** | Ollama | 로컬 LLM |
| | Whisper | 음성 인식 |
| | Tesseract | OCR |
| | ChromaDB | 벡터 검색 |

---

## 시작하기

### 사전 준비

- **Python** 3.11 이상
- **Node.js** 18 이상 (npm 포함)
- **Git**

### 설치 및 실행

```bash
# 1. 저장소 클론
git clone https://github.com/MonoBound/MonoDesk.git
cd MonoDesk

# 2. 의존성 설치
cd backend && pip install -r requirements.txt && cd ..
cd frontend && npm install && npm run build && cd ..

# 3. 서버 실행 (백엔드 하나만 실행하면 됩니다)
cd backend
uvicorn main:app --port 8000
```

또는 프로젝트 루트의 `start.bat`을 더블클릭하면 자동으로 실행됩니다.

### 접속

브라우저에서 아래 주소 하나만 사용합니다.

```
http://localhost:8000
```

API 문서 (Swagger UI):

```
http://localhost:8000/docs
```

> **참고**: 프론트엔드와 백엔드가 단일 서버(포트 8000)로 통합되어 있습니다.
> 코드 수정 후에는 `frontend/` 폴더에서 `npm run build`를 다시 실행하세요.

---

## 프로젝트 구조

```
MonoDesk/
├── frontend/                   # React 프론트엔드
│   └── src/
│       ├── api/                # API 호출 함수
│       ├── components/
│       │   ├── common/         # 공통 컴포넌트 (Button, Modal, Table 등)
│       │   ├── layout/         # 레이아웃 (Sidebar, Header)
│       │   └── modules/        # 모듈별 컴포넌트
│       ├── pages/              # 페이지 컴포넌트
│       └── utils/              # 유틸리티 함수
│
├── backend/                    # Python FastAPI 백엔드
│   ├── main.py                 # 앱 진입점
│   ├── database.py             # DB 연결 설정
│   ├── routers/                # API 라우터 (모듈별)
│   ├── models/                 # SQLAlchemy 모델
│   ├── schemas/                # Pydantic 스키마
│   ├── services/               # 비즈니스 로직
│   └── requirements.txt
│
├── database/                   # SQLite 데이터 파일
│   └── monodesk.db
│
├── backup/                     # 백업 파일
├── uploads/                    # 업로드 파일 (영수증, 문서 등)
│
├── database/                   # SQLite 데이터 파일
│   └── monodesk.db
│
├── start.bat                   # 원클릭 실행 파일 (더블클릭으로 서버 시작)
├── .claude/                    # Claude Code 에이전트 설정
├── PRD.md                      # 제품 요구사항 문서
├── DEVPLAN.md                  # 개발 계획서
└── STRUCTURE.md                # 프로젝트 구조 상세 문서
```

---

## API 엔드포인트

| 모듈 | 베이스 URL |
|------|-----------|
| 대시보드 | `GET /api/dashboard` |
| 세무/회계 | `/api/accounting` |
| 매출 분석 | `/api/sales-analysis` |
| 재고/발주 | `/api/inventory` |
| 메뉴 관리 | `/api/menu` |
| 직원 관리 | `/api/employee` |
| 법인 관리 | `/api/corporate` |
| 운영 관리 | `/api/operations` |

전체 API 문서는 서버 실행 후 `http://localhost:8000/docs` 에서 확인할 수 있습니다.

---

## 스크린샷

> 스크린샷은 추후 추가 예정입니다.

| 대시보드 | 세무/회계 |
|----------|-----------|
| *(추가 예정)* | *(추가 예정)* |

| 매출 분석 | 재고/발주 |
|-----------|-----------|
| *(추가 예정)* | *(추가 예정)* |

---

## 개발 정보

- **법인명**: MonoBound
- **매장명**: 여남동 (용산 삼각지 제철해산물 주점)
- **개발 방식**: 바이브코딩 — Claude Code와 협업하는 비전문가 주도 개발
- **운영 환경**: Windows 로컬 전용 (외부 인터넷 연결 불필요)

---

## 라이선스

이 프로젝트는 MonoBound 내부 운영 목적으로 개발된 사유 소프트웨어입니다. 무단 배포 및 상업적 이용을 금지합니다.

---

*Built with Claude Code — MonoBound © 2025*
