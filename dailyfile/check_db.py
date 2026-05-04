"""캐치페이 현금 수정 롤백 — cash_amount += catchtable_amount"""
import sqlite3, psycopg2

RENDER_URL = "postgresql://monodesk_user:oEC6WHpoWqT0RUWR4OOF242NayiWTufw@dpg-d7jdmqvlk1mc73a72krg-a.oregon-postgres.render.com/monodesk"
SQLITE_PATH = "database/monodesk.db"
SQL = "UPDATE sales_records SET cash_amount = cash_amount + catchtable_amount WHERE catchtable_amount > 0 AND sales_date LIKE '2026-04-%'"

# 로컬 SQLite
conn = sqlite3.connect(SQLITE_PATH)
cur = conn.cursor()
cur.execute(SQL.replace("LIKE '2026-04-%'", "LIKE '2026-04-%'"))
print(f"[SQLite] {cur.rowcount}건 수정")
# 검증
cur.execute("SELECT SUM(cash_amount), SUM(catchtable_amount) FROM sales_records WHERE sales_date LIKE '2026-04-%' AND is_deleted=0")
r = cur.fetchone()
print(f"[SQLite] 현금합계: {int(r[0] or 0):,} / 캐치합계: {int(r[1] or 0):,}")
conn.commit()
conn.close()

# Render PostgreSQL
conn2 = psycopg2.connect(RENDER_URL)
cur2 = conn2.cursor()
cur2.execute(SQL.replace("LIKE '2026-04-%'", "LIKE '2026-04-%%'"))
print(f"[Render] {cur2.rowcount}건 수정")
cur2.execute("SELECT SUM(cash_amount), SUM(catchtable_amount) FROM sales_records WHERE sales_date::text LIKE '2026-04-%' AND is_deleted=0")
r2 = cur2.fetchone()
print(f"[Render] 현금합계: {int(r2[0] or 0):,} / 캐치합계: {int(r2[1] or 0):,}")
conn2.commit()
conn2.close()
print("완료")
