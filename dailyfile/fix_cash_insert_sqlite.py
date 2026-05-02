"""
fix_cash_insert_sqlite.py
작업1-A: 기존 4월 cash_amount에서 catchtable_amount 차감 (이중계산 수정)
작업1-B: 4/27~4/30 신규 INSERT (수정된 수식 적용)
대상: 로컬 SQLite
"""
import os
import sqlite3
import openpyxl
from datetime import datetime

EXCEL_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(os.path.dirname(EXCEL_DIR), 'database', 'monodesk.db')
EXCEL_PATH = os.path.join(EXCEL_DIR, '여남동 4월.xlsx')

print(f'DB: {DB_PATH}')
print(f'EXCEL: {EXCEL_PATH}')
print()

def safe_int(v, default=0):
    if v is None: return default
    try: return int(float(v))
    except: return default

def safe_float(v, default=0.0):
    if v is None: return default
    try: return float(v)
    except: return default

def safe_str(v):
    if v is None: return None
    s = str(v).strip()
    return s if s and s != '0' else None

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# ===================================================
# 작업1-A: 기존 1~26일 cash_amount 수정
# cash_amount에 catchtable_amount가 포함되어 있으므로 차감
# ===================================================
print('=== 작업1-A: 기존 cash_amount 수정 (catchtable 이중계산 제거) ===')

cur.execute("""
    SELECT id, sales_date, cash_amount, catchtable_amount
    FROM sales_records
    WHERE sales_date LIKE '2026-04-%'
      AND catchtable_amount > 0
      AND is_deleted = 0
    ORDER BY sales_date
""")
rows_to_fix = cur.fetchall()

fixed_count = 0
for row in rows_to_fix:
    rid, date, cash, catch = row
    new_cash = cash - catch
    cur.execute(
        "UPDATE sales_records SET cash_amount=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (new_cash, rid)
    )
    print(f'  {date}: cash {int(cash):,} -> {int(new_cash):,} (캐치 {int(catch):,} 차감)')
    fixed_count += 1

conn.commit()
print(f'[OK] {fixed_count}건 수정 완료\n')

# ===================================================
# 작업1-B: 4/27~4/30 신규 INSERT (수정된 수식 적용)
# cash_pure = col[6] - col[15] - col[17]  (현금 - 이체 - 캐치페이)
# ===================================================
print('=== 작업1-B: 4/27~4/30 신규 INSERT ===')

wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
ws = wb['1.매출']
YEAR, MONTH = 2026, 4

inserted = 0
skipped = 0

for row in ws.iter_rows(min_row=4, values_only=True):
    day = row[0]
    if not isinstance(day, int) or day < 27 or day > 30:
        continue

    total = safe_int(row[1])
    if total == 0:
        print(f'  {day:02d}일: 총매출 0 -> 스킵')
        continue

    sales_date = f'{YEAR}-{MONTH:02d}-{day:02d}'

    cur.execute(
        'SELECT id FROM sales_records WHERE sales_date=? AND is_deleted=0',
        (sales_date,)
    )
    if cur.fetchone():
        skipped += 1
        print(f'  {day:02d}일: 이미 존재 -> 스킵')
        continue

    card_net       = safe_float(row[4])   # 카드순매출
    cash_col       = safe_float(row[6])   # 현금 (이체+캐치 포함)
    transfer_amt   = safe_float(row[15])  # 계좌이체 금액
    catchtable_amt = safe_float(row[17])  # 캐치페이 금액
    # 수정된 수식: 현금 - 이체 - 캐치페이
    cash_pure      = cash_col - transfer_amt - catchtable_amt

    cur.execute('''
        INSERT INTO sales_records (
            sales_date,
            card_amount, cash_amount, cash_receipt_amount,
            delivery_amount, discount_amount, service_amount,
            receipt_count, customer_count,
            transfer_count, transfer_amount,
            catchtable_count, catchtable_amount,
            card_cancel_count, card_cancel_amount, card_cancel_reason,
            card_fee_estimated, delivery_fee_estimated,
            special_note,
            is_pos_synced, is_deleted, created_at, updated_at
        ) VALUES (
            ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
            0,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
        )
    ''', (
        sales_date,
        card_net,
        cash_pure,
        0,
        safe_float(row[13]),     # delivery_amount
        safe_float(row[8]),      # discount_amount
        safe_float(row[9]),      # service_amount
        safe_int(row[10]),       # receipt_count
        safe_int(row[11]),       # customer_count
        safe_int(row[14]),       # transfer_count
        transfer_amt,
        safe_int(row[16]),       # catchtable_count
        catchtable_amt,
        safe_int(row[26]),       # card_cancel_count
        safe_float(row[27]),     # card_cancel_amount
        safe_str(row[28]),       # card_cancel_reason
        safe_float(row[31]),     # card_fee_estimated
        safe_float(row[32]),     # delivery_fee_estimated
        safe_str(row[29]),       # special_note
    ))
    inserted += 1
    print(f'  {day:02d}일: 총 {total:,}원 INSERT (카드 {int(card_net):,} / 현금 {int(cash_pure):,} / 이체 {int(transfer_amt):,} / 캐치 {int(catchtable_amt):,})')

conn.commit()
print(f'[OK] 신규 {inserted}건 INSERT, {skipped}건 스킵\n')

# 검증
conn.close()
conn2 = sqlite3.connect(DB_PATH)
cur2 = conn2.cursor()
cur2.execute("""
    SELECT COUNT(*), SUM(card_amount), SUM(cash_amount), SUM(catchtable_amount), SUM(transfer_amount)
    FROM sales_records
    WHERE sales_date LIKE '2026-04-%' AND is_deleted=0
""")
cnt, card_sum, cash_sum, catch_sum, trans_sum = cur2.fetchone()
print('=== 최종 검증 ===')
print(f'  레코드 수: {cnt}')
print(f'  카드 합계: {int(card_sum or 0):,}원')
print(f'  현금 합계: {int(cash_sum or 0):,}원')
print(f'  캐치 합계: {int(catch_sum or 0):,}원')
print(f'  이체 합계: {int(trans_sum or 0):,}원')
total_all = int((card_sum or 0) + (cash_sum or 0) + (catch_sum or 0) + (trans_sum or 0))
print(f'  총 매출:  {total_all:,}원')
conn2.close()
