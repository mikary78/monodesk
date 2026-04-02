-- ============================================================
-- 20260402_100000_sales_record_컬럼_확장.sql
-- 매출 기록 테이블 컬럼 확장 (엑셀 1.매출 시트 대응)
-- 실행일: 2026-04-02
-- ============================================================

-- 현금영수증 금액 (원)
ALTER TABLE sales_records ADD COLUMN cash_receipt_amount REAL DEFAULT 0;

-- 할인액 (원)
ALTER TABLE sales_records ADD COLUMN discount_amount REAL DEFAULT 0;

-- 서비스액 (원)
ALTER TABLE sales_records ADD COLUMN service_amount REAL DEFAULT 0;

-- 영수건수 (영수증 발행 건수)
ALTER TABLE sales_records ADD COLUMN receipt_count INTEGER DEFAULT 0;

-- 고객수 (방문 고객 수)
ALTER TABLE sales_records ADD COLUMN customer_count INTEGER DEFAULT 0;

-- 계좌이체 건수
ALTER TABLE sales_records ADD COLUMN transfer_count INTEGER DEFAULT 0;

-- 계좌이체 금액 (원)
ALTER TABLE sales_records ADD COLUMN transfer_amount REAL DEFAULT 0;

-- 캐치테이블 영수건수
ALTER TABLE sales_records ADD COLUMN catchtable_count INTEGER DEFAULT 0;

-- 캐치테이블 이체금액 (원)
ALTER TABLE sales_records ADD COLUMN catchtable_amount REAL DEFAULT 0;

-- 카드취소 건수
ALTER TABLE sales_records ADD COLUMN card_cancel_count INTEGER DEFAULT 0;

-- 카드취소 금액 (원)
ALTER TABLE sales_records ADD COLUMN card_cancel_amount REAL DEFAULT 0;

-- 카드취소 사유
ALTER TABLE sales_records ADD COLUMN card_cancel_reason TEXT;

-- 카드수수료 예상 (원, 카드매출 × 1.92%)
ALTER TABLE sales_records ADD COLUMN card_fee_estimated REAL DEFAULT 0;

-- 배달수수료 예상 (원, 배달매출 × 21.3%)
ALTER TABLE sales_records ADD COLUMN delivery_fee_estimated REAL DEFAULT 0;

-- 품목별 매출: 메뉴 (원)
ALTER TABLE sales_records ADD COLUMN sales_menu REAL DEFAULT 0;

-- 품목별 매출: 기타메뉴 (원)
ALTER TABLE sales_records ADD COLUMN sales_other_menu REAL DEFAULT 0;

-- 품목별 매출: 포장 (원)
ALTER TABLE sales_records ADD COLUMN sales_takeout REAL DEFAULT 0;

-- 품목별 매출: 주류 (원)
ALTER TABLE sales_records ADD COLUMN sales_liquor REAL DEFAULT 0;

-- 품목별 매출: 기타주류 (원)
ALTER TABLE sales_records ADD COLUMN sales_other_liquor REAL DEFAULT 0;

-- 품목별 매출: 기타 (원)
ALTER TABLE sales_records ADD COLUMN sales_etc REAL DEFAULT 0;

-- 특이사항 메모
ALTER TABLE sales_records ADD COLUMN special_note TEXT;
