# System Architect Memory — MonoDesk

## 프로젝트 기본 정보
- 앱명: MonoDesk (여남동 외식업 통합 관리)
- 스택: React 18 + Tailwind / FastAPI / SQLite + SQLAlchemy
- 실행 환경: Windows 로컬 전용 (외부 서버 없음)
- Python 버전: 3.14 (cpython-314 pycache 확인)

## 모듈 인벤토리 (백엔드)
| 모듈 | 모델 파일 | 라우터 prefix | 서비스 파일 |
|------|-----------|---------------|-------------|
| 세무/회계 | models/accounting.py | /api/accounting | services/accounting_service.py |
| 매출 분석 | models/sales_analysis.py | /api/sales-analysis | services/sales_analysis_service.py |
| 재고/발주 | models/inventory.py | /api/inventory | services/inventory_service.py |
| 메뉴 관리 | models/menu.py | /api/menu | services/menu_service.py |
| 직원 관리 | models/employee.py | /api/employee | services/employee_service.py |
| 대시보드 | (없음-다중 모델 참조) | /api/dashboard | services/dashboard_service.py |
| 법인 관리 | models/corporate.py | /api/corporate | services/corporate_service.py |
| 운영 관리 | models/operations.py | /api/operations | services/operations_service.py |

## 핵심 아키텍처 결정사항
- 소프트 삭제: is_deleted 컬럼(Integer 0/1) — 전 모듈 공통
- 날짜 저장: String(10) "YYYY-MM-DD" 방식 (Date 타입 미사용)
- 세션 관리: get_db() generator + FastAPI Depends()
- 테이블 생성: database.py create_tables()에서 모든 모델 import 후 create_all()
- CORS: localhost:5173, localhost:3000만 허용

## 알려진 구조적 결함 (2026-03-09 점검)
1. [치명] 테이블명 충돌: models/sales_analysis.py의 MenuItem.__tablename__ = "menu_items"와
   models/menu.py의 MenuItem.__tablename__ = "menu_items" 동일 — SQLAlchemy 기동 불가
2. [치명] PosSalesRaw.import_id가 pos_imports.id를 참조하지만 ForeignKey 선언 없음 — DB 정합성 깨짐
3. [주의] salary/history 엔드포인트가 salary/{salary_id} 이후에 등록됨 — 경로 충돌 위험
4. [주의] DividendRecord.partner_id가 ForeignKey 없이 raw integer — 참조 무결성 없음
5. [주의] MenuIngredient.inventory_item_id가 ForeignKey 없이 raw integer — inventory 모듈 연동 시 깨짐
6. [주의] 프론트엔드 각 api/*.js 파일에 request()·formatCurrency() 등 중복 선언 (8개 파일)

## 프론트엔드 라우팅
- App.jsx: /dashboard, /accounting, /sales, /inventory, /menu, /employee, /corporate, /operations, /settings
- 백엔드 prefix /api/sales-analysis vs 프론트 경로 /sales — 불일치는 아님 (프론트 URL != API URL)

## 데이터 흐름 교차점
- dashboard_service.py → models/accounting, models/inventory, models/employee 직접 import
- corporate_service.py → models/accounting (SalesRecord, ExpenseRecord) 직접 참조
- 메뉴-재고 연동: MenuIngredient.inventory_item_id (FK 없는 soft reference)
