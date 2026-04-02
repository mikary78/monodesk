# 변경 이력: SalesRecord 컬럼 21개 확장 및 매출 입력 폼 재작성

## 기본 정보
- 날짜: 2026년 04월 02일
- 브랜치: feature/expand-sales-record (master에 직접 반영)
- 작업자: Claude Code

## 요청 내용
엑셀 "1.매출" 시트와 MonoDesk SalesRecord 테이블 간 갭 분석 후,
누락된 21개 컬럼을 추가하고 프론트엔드 매출 입력 폼을 7개 섹션으로 전면 재작성

## 변경한 내용

### 추가된 파일
- `backend/migrations/20260402_100000_sales_record_컬럼_확장.sql` : ALTER TABLE 21개 구문

### 수정된 파일
- `backend/database.py` : run_migrations() 함수 추가 (migration_history 테이블로 중복 실행 방지)
- `backend/main.py` : lifespan 훅에서 서버 시작 시 자동 마이그레이션 실행
- `backend/models/accounting.py` : SalesRecord 모델 21개 컬럼 추가, total_sales 프로퍼티 업데이트
- `backend/schemas/accounting.py` : SalesRecordCreate/Update/Response에 21개 필드 추가
- `frontend/src/components/modules/accounting/SalesForm.jsx` : 7섹션 모달 폼으로 전면 재작성

### 데이터베이스 변경
- `sales_records` 테이블: 기존 10개 → 31개 컬럼으로 확장
  - 추가: cash_receipt_amount, discount_amount, service_amount
  - 추가: receipt_count, customer_count
  - 추가: transfer_count, transfer_amount, catchtable_count, catchtable_amount
  - 추가: card_cancel_count, card_cancel_amount, card_cancel_reason
  - 추가: card_fee_estimated, delivery_fee_estimated
  - 추가: sales_menu, sales_other_menu, sales_takeout, sales_liquor, sales_other_liquor, sales_etc
  - 추가: special_note

### 프론트엔드 SalesForm 7개 섹션
1. 기본 매출 (카드/현금/현금영수증/배달/할인/서비스)
2. 고객 정보 (영수증 수/고객 수)
3. 추가 결제수단 (계좌이체/캐치테이블)
4. 품목별 매출 (메뉴/기타메뉴/포장/주류/기타주류/기타)
5. 카드취소 (취소 건수/금액/사유)
6. 수수료 예상 (카드 1.92% / 배달 21.3% 자동계산)
7. 특이사항

## 테스트 및 검증 방법
- [ ] 매출 입력 → 7개 섹션 폼 정상 표시
- [ ] 순매출 하단 스티키 요약 카드 실시간 계산
- [ ] 수수료 자동계산 "자동계산" 배지 표시
- [ ] 기존 매출 데이터 수정 정상 동작
- [ ] API 응답에 신규 필드 포함 확인

## 주의사항
- 기존 레코드의 신규 컬럼값은 모두 NULL (기본값 0)
- SalesForm은 기존 컴포넌트 완전 교체이므로 구버전 복구 시 git revert 필요

## 향후 작업 제안
- POS CSV 가져오기 시 새 컬럼 매핑 처리 필요
- 매출 분석 대시보드에서 품목별 매출 차트 활용 가능
