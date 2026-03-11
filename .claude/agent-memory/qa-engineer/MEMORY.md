# QA Engineer Memory — MonoDesk

## 프로젝트 구조 핵심 파악

- Backend: FastAPI + SQLAlchemy + SQLite (`database/monodesk.db`)
- Frontend: React 18 + Tailwind CSS, Vite dev server (port 5173)
- API base: `http://localhost:8000/api/`
- 모든 라우터는 `backend/routers/`에, 서비스는 `backend/services/`에 있음
- 모든 모델은 `database.py`의 `create_tables()`에서 import됨 (현재 accounting, sales_analysis, inventory, menu, employee, corporate, operations 7개)

## 확인된 치명적 버그 패턴

### [BUG-001] sales_analysis 모델 테이블명 충돌 (치명적)
- `models/sales_analysis.py`의 `MenuItem` 클래스가 `__tablename__ = "menu_items"` 사용
- `models/menu.py`의 `MenuItem` 클래스도 동일하게 `__tablename__ = "menu_items"` 사용
- 두 모델이 같은 테이블을 선언 → SQLAlchemy 충돌 또는 컬럼 불일치로 앱 시작 실패 가능

### [BUG-002] salary/history 라우터 경로 충돌 (치명적)
- `GET /salary/{salary_id}` (동적) 와 `GET /salary/history` (정적) 가 모두 존재
- `GET /salary/history`가 `/salary/{salary_id}` 뒤에 등록되어 있어 FastAPI가 "history"를 salary_id로 파싱
- `routers/employee.py` line 292 (`GET /salary`) 다음에 line 316 (`GET /salary/history`) 등록됨
- 이 순서 때문에 `/salary/history` 호출 시 실제로 `GET /salary/{salary_id}`로 라우팅됨

### [BUG-003] corporate partners/seed 경로 충돌 (치명적)
- `POST /partners/seed` (고정 경로)가 `GET /partners/{partner_id}` 보다 앞에 등록됨
- 하지만 HTTP method가 다르므로 문제없음 — 재확인 필요

## 확인된 중요 버그 패턴

### [BUG-004] AttendanceFormModal useEffect 무한 루프 위험
- `form.clock_in`, `form.clock_out` 변경 시 `handleCalculate()` 자동 호출
- `handleCalculate()` 내부에서 `setForm()` 호출 → `form` 변경 → 재렌더링
- `useEffect` dependency가 `[form.clock_in, form.clock_out]`이므로 무한 루프는 아니지만, 불필요한 API 호출이 반복될 수 있음

### [BUG-005] corporateApi.js 에러 핸들링 비일관성
- `fetchPartners`, `fetchPartnerById`, `deletePurchaseOrder` 등은 공통 `request()` 헬퍼 없이 직접 fetch
- 에러 메시지가 한국어로 하드코딩되어 백엔드 상세 에러가 손실됨

## 프로젝트 QA 정책

- 비전문가(매장 운영자)가 주 사용자 → 에러 메시지 한국어 필수
- 코드 수정 없이 문제만 리스팅하는 검토 방식 존재
- 급여 계산은 한국 노동법 기준 (2026년 최저임금 10,030원)
