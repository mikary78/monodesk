# Dev Orchestrator Memory — MonoDesk

## 프로젝트 구조 핵심 경로
- 백엔드 루트: `/c/Users/KIM sungje/OneDrive/1_Dev projects/2_MonoDesk/backend/`
- 프론트엔드 루트: `/c/Users/KIM sungje/OneDrive/1_Dev projects/2_MonoDesk/frontend/src/`
- DB 파일: `database/monodesk.db`
- 마이그레이션: `backend/migrations/`
- 변경 이력: `history/`

## 완료된 모듈 (2026-03-09 기준)
- Step 1: 세무/회계 — `/accounting`
- Step 2: 매출 분석 — `/sales`
- Step 3: 재고/발주 — `/inventory`
- Step 4: 메뉴 관리 — `/menu`
- Step 5: 직원 관리 — `/employee` (브랜치: feature/employee-management)

## 백엔드 패턴 (반드시 일관성 유지)
- Pydantic V2: `@field_validator`, `ConfigDict`, `.model_dump()`
- FastAPI lifespan 패턴 (`@asynccontextmanager`)
- 소프트 삭제: `is_deleted = Column(Integer, default=0)`
- 필수 컬럼: `created_at`, `updated_at` (`func.now()` 사용)
- 새 모듈 등록: `main.py`에 라우터 추가, `database.py`에 모델 import 추가

## 프론트엔드 패턴
- 함수형 컴포넌트 + Hooks
- API 파일: `frontend/src/api/{module}Api.js`
- 페이지: `frontend/src/pages/{Module}Page.jsx`
- 컴포넌트: `frontend/src/components/modules/{module}/`
- 차트: Recharts / 아이콘: Lucide React
- 라우터 등록: `App.jsx`

## 신규 모듈 개발 파일 체크리스트
백엔드: models/{m}.py, schemas/{m}.py, services/{m}_service.py, routers/{m}.py
업데이트: main.py (라우터 등록), database.py (모델 import)
프론트엔드: api/{m}Api.js, pages/{M}Page.jsx, components/modules/{m}/*.jsx
업데이트: App.jsx (라우트 등록)
기록: migrations/, history/

## FastAPI 라우트 등록 순서 (중요)
정적 경로를 동적 경로보다 반드시 먼저 등록해야 한다.
- 잘못된 예: `PUT /salary/{id}` 이후에 `GET /salary/overview` 등록 → FastAPI가 "overview"를 {id}로 파싱해 422 오류 발생
- 올바른 예: `GET /salary/overview` 먼저 → `PUT /salary/{id}` 나중에
- 동일 규칙: `/attendance/calculate-hours` 반드시 `/attendance/{id}` 앞에 위치

## 직원 관리 모듈 특이사항
- 2026년 최저임금: 10,030원/시 (`MINIMUM_WAGE_PER_HOUR` 상수, 정부 고시 변경 시 services/employee_service.py 수동 업데이트 필요)
- 4대보험 요율: 국민연금 4.5%, 건강보험 3.545%, 장기요양 12.95%(건강보험 기준), 고용보험 0.9%
- 주휴수당: 주 15시간 이상 근무 시 발생, 공식: (주근무시간/40)×8×시급×4
- 파일 업로드: `backend/uploads/contracts/{employee_id}/` 에 저장 (PDF/JPG/PNG, 10MB 제한)
- FormData 업로드 시 Content-Type 헤더 생략 필수 (브라우저 자동 처리)
- 급여 정산: UNIQUE(employee_id, year, month) 제약으로 월 1회만 저장, upsert 방식 처리

## 메뉴 관리 모듈 특이사항
- 구성 재료 추가/수정/삭제 시 메뉴 원가 자동 재계산 (_recalculate_menu_cost)
- 카테고리에 메뉴가 있으면 삭제 불가 (ValueError 발생)
- 원가율 경고 기준: 70% 초과 (빨강), 50-70% (노랑), 30-50% (파랑), 0-30% (초록)
- seed_default_categories: 제철해산물 주점 맞춤 6개 카테고리 자동 생성
