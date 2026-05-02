"""
fix_cash_insert_render.py
작업1-A: 기존 4월 cash_amount에서 catchtable_amount 차감 (이중계산 수정)
작업1-B: 4/27~4/30 신규 INSERT (수정된 수식 적용)
대상: Render PostgreSQL
"""
import os
import psycopg2
import openpyxl
from datetime import datetime

EXCEL_DIR = os.path.dirname(os.path.abspath(__file__))
DB_URL = "postgresql://monodesk_user:oEC6WHpoWqT0RUWR4OOF242NayiWTufw@dpg-d7jdmqvlk1mc73a72krg-a.oregon-postgres.render.com/monodesk"
EXCEL_PATH = os.path.join(EXCEL_DIR, '여남동 4월.xlsx')

print(f'DB: Render PostgreSQL')
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

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# ===================================================
# 작업1-A: 기존 1~26일 cash_amount 수정
# cash_amount에 catchtable_amount가 포함되어 있으므로 차감
# 음수가 되면 0으로 처리
# ===================================================
print('=== 작업1-A: 기존 cash_amount 수정 (catchtable 이중계산 제거) ===')

cur.execute("""
    SELECT id, sales_date, cash_amount, catchtable_amount
    FROM sales_records
    WHERE sales_date::text LIKE '2026-04-%'
      AND catchtable_amount > 0
      AND is_deleted = 0
    ORDER BY sales_date
""")
rows_to_fix = cur.fetchall()

fixed_count = 0
for row in rows_to_fix:
    rid, date, cash, catch = row
    new_cash = max(float(cash or 0) - float(catch or 0), 0.0)
    cur.execute(
        "UPDATE sales_records SET cash_amount=%s, updated_at=NOW() WHERE id=%s",
        (new_cash, rid)
    )
    print(f'  {date}: cash {int(cash or 0):,} -> {int(new_cash):,} (캐치 {int(catch or 0):,} 차감)')
    fixed_count += 1

conn.commit()
print(f'[OK] {fixed_count}건 수정 완료\n')

# ===================================================
# 작업1-B: 4/27~4/30 신규 INSERT
# cash_pure = col[6] - col[15] - col[17]  max(0)
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
        'SELECT id FROM sales_records WHERE sales_date=%s AND is_deleted=0',
        (sales_date,)
    )
    if cur.fetchone():
        skipped += 1
        print(f'  {day:02d}일: 이미 존재 -> 스킵')
        continue

    card_net       = safe_float(row[4])
    cash_col       = safe_float(row[6])
    transfer_amt   = safe_float(row[15])
    catchtable_amt = safe_float(row[17])
    # 수정된 수식: max(현금 - 이체 - 캐치페이, 0)
    cash_pure      = max(cash_col - transfer_amt - catchtable_amt, 0.0)

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
            %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
            0,0,NOW(),NOW()
        )
    ''', (
        sales_date,
        card_net, cash_pure, 0,
        safe_float(row[13]),
        safe_float(row[8]),
        safe_float(row[9]),
        safe_int(row[10]),
        safe_int(row[11]),
        safe_int(row[14]),
        transfer_amt,
        safe_int(row[16]),
        catchtable_amt,
        safe_int(row[26]),
        safe_float(row[27]),
        safe_str(row[28]),
        safe_float(row[31]),
        safe_float(row[32]),
        safe_str(row[29]),
    ))
    inserted += 1
    print(f'  {day:02d}일: 총 {total:,}원 INSERT (카드 {int(card_net):,} / 현금 {int(cash_pure):,} / 이체 {int(transfer_amt):,} / 캐치 {int(catchtable_amt):,})')

conn.commit()
print(f'[OK] 신규 {inserted}건 INSERT, {skipped}건 스킵\n')

# 검증
cur.execute("""
    SELECT COUNT(*), SUM(card_amount), SUM(cash_amount), SUM(catchtable_amount), SUM(transfer_amount)
    FROM sales_records
    WHERE sales_date::text LIKE '2026-04-%' AND is_deleted=0
""")
cnt, card_sum, cash_sum, catch_sum, trans_sum = cur.fetchone()
print('=== 최종 검증 ===')
print(f'  레코드 수: {cnt}')
print(f'  카드 합계: {int(card_sum or 0):,}원')
print(f'  현금 합계: {int(cash_sum or 0):,}원')
print(f'  캐치 합계: {int(catch_sum or 0):,}원')
print(f'  이체 합계: {int(trans_sum or 0):,}원')
total_all = int((card_sum or 0) + (cash_sum or 0) + (catch_sum or 0) + (trans_sum or 0))
print(f'  총 매출:  {total_all:,}원')

cur.close()
conn.close()
