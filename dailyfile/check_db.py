import psycopg2

DB_URL = "postgresql://monodesk_user:oEC6WHpoWqT0RUWR4OOF242NayiWTufw@dpg-d7jdmqvlk1mc73a72krg-a.oregon-postgres.render.com/monodesk"
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

cur.execute("SELECT COUNT(*), SUM(card_amount), SUM(cash_amount), SUM(catchtable_amount), SUM(transfer_amount) FROM sales_records WHERE sales_date::text LIKE '2026-04-%' AND is_deleted=0")
r = cur.fetchone()
print(f'[Render] 4월 매출: {r[0]}건 | 카드 {int(r[1] or 0):,} | 현금 {int(r[2] or 0):,} | 캐치 {int(r[3] or 0):,} | 이체 {int(r[4] or 0):,}')

cur.execute("SELECT COUNT(*) FROM sales_records WHERE pos_total > 0 AND sales_date::text LIKE '2026-04-%'")
print(f'[Render] POS 데이터: {cur.fetchone()[0]}건')

cur.execute("SELECT COUNT(*), SUM(amount) FROM expense_records WHERE expense_date::text LIKE '2026-04-%'")
r2 = cur.fetchone()
print(f'[Render] 4월 지출: {r2[0]}건 | {int(r2[1] or 0):,}원')

cur.execute("SELECT name FROM expense_categories WHERE is_deleted=0 ORDER BY id")
cats = [row[0] for row in cur.fetchall()]
print(f'[Render] 지출 카테고리: {cats}')

conn.close()
