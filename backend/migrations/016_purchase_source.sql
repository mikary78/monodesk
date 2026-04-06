-- ============================================================
-- migrations/016_purchase_source.sql
-- 재고 조정 매입 출처 구분 컬럼 추가
-- 엑셀 3.원·부재료 시트의 본사구매/현장구매(법카)/현장구매(시재) 구분
-- ============================================================

-- 매입 출처 구분
-- 'headquarters': 본사구매 (계좌이체)
-- 'site_card':    현장구매 법카
-- 'site_cash':    현장구매 시재
-- 'direct':       기타 직접구매
ALTER TABLE inventory_adjustments
ADD COLUMN purchase_source TEXT DEFAULT 'direct';

-- 연결 지출내역 ID (법카/시재 구매 시 expense_records.id 연결)
ALTER TABLE inventory_adjustments
ADD COLUMN linked_expense_id INTEGER;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_adj_purchase_source
    ON inventory_adjustments(purchase_source);
