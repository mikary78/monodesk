"""
import_may_sales.py — 여남동 5월 매출 데이터 → SQLite + Render PostgreSQL 적재
실행: python dailyfile/202605/import_may_sales.py

컬럼 매핑 (1.매출 시트, row5부터 데이터):
  col0  일자
  col1  총매출액
  col3  매장순매출 (카드순 + 현금순 + 캐치pay)
  col4  카드순매출   → card_amount
  col6  현금순매출   → cash_amount = col6 - col16 (이체 제외)
  col7  현금매출액   (참고용)
  col9  할인액       → discount_amount
  col10 서비스액     → service_amount
  col11 영수건수     → receipt_count
  col12 고객수       → customer_count
  col14 배달매출     → delivery_amount
  col15 이체건수     → transfer_count
  col16 이체금액     → transfer_amount (cash_amount에서 이미 제외)
  col17 캐치테이블 건수 → catchtable_count
  col18 C-pay       → catchtable_amount
"""
import os, sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent.parent.resolve()
XLSX_PATH = SCRIPT_DIR / "여남동 5월_v2_0531.xlsx"
SQLITE_URL = f"sqlite:///{PROJECT_ROOT}/database/monodesk.db"
RENDER_URL = "postgresql://monodesk_user:oEC6WHpoWqT0RUWR4OOF242NayiWTufw@dpg-d7jdmqvlk1mc73a72krg-a.oregon-postgres.render.com/monodesk"

YEAR, MONTH = 2026, 5


def safe_int(v, default=0):
    if v is None: return default
    try: return int(float(v))
    except: return default


def safe_float(v, default=0.0):
    if v is None: return default
    try: return float(v)
    except: return default


def parse_sales(xlsx_path):
    """1.매출 시트 파싱 → 일별 딕셔너리 목록 반환"""
    import openpyxl
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb["1.매출"]

    records = []
    for row in ws.iter_rows(min_row=5, values_only=True):
        day = row[0]
        if not isinstance(day, int) or day <= 0:
            continue
        total_display = safe_int(row[1])
        if total_display == 0:
            continue

        card       = safe_float(row[4])   # 카드순매출
        cash_gross = safe_float(row[6])   # 현금순매출 (이체 포함)
        transfer   = safe_float(row[16])  # 이체금액
        cash_pure  = max(cash_gross - transfer, 0.0)  # 순수현금 = 현금순매출 - 이체
        catch      = safe_float(row[18])  # C-pay

        records.append({
            "sales_date":     f"{YEAR}-{MONTH:02d}-{day:02d}",
            "card_amount":    card,
            "cash_amount":    cash_pure,
            "catchtable_amount": catch,
            "catchtable_count":  safe_int(row[17]),
            "transfer_amount":   transfer,
            "transfer_count":    safe_int(row[15]),
            "discount_amount":   safe_float(row[9]),
            "service_amount":    safe_float(row[10]),
            "receipt_count":     safe_int(row[11]),
            "customer_count":    safe_int(row[12]),
            "delivery_amount":   safe_float(row[14]),
            "cash_receipt_amount": 0,
        })
        net = card + cash_pure + transfer + catch
        print(f"  {day:02d}일: 카드 {int(card):,} / 현금 {int(cash_pure):,} / 이체 {int(transfer):,} / 캐치 {int(catch):,} = {int(net):,}")
    return records


def load_to_db(db_url, records, label):
    """sales_records 테이블에 INSERT (중복 날짜 스킵)"""
    import sqlite3, psycopg2
    is_pg = db_url.startswith("postgresql")

    if is_pg:
        conn = psycopg2.connect(db_url)
    else:
        path = db_url.replace("sqlite:///", "")
        conn = sqlite3.connect(path)

    cur = conn.cursor()
    inserted = skipped = 0

    for r in records:
        # 중복 확인
        q_check = "SELECT id FROM sales_records WHERE sales_date=%s AND is_deleted=0" if is_pg \
             else "SELECT id FROM sales_records WHERE sales_date=? AND is_deleted=0"
        cur.execute(q_check, (r["sales_date"],))
        if cur.fetchone():
            skipped += 1
            print(f"  [{label}] {r['sales_date']} 이미 존재 → 스킵")
            continue

        ph = "%s" if is_pg else "?"
        sql = f"""
            INSERT INTO sales_records (
                sales_date,
                card_amount, cash_amount, cash_receipt_amount,
                delivery_amount, discount_amount, service_amount,
                receipt_count, customer_count,
                transfer_count, transfer_amount,
                catchtable_count, catchtable_amount,
                is_pos_synced, is_deleted, created_at, updated_at
            ) VALUES (
                {ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},
                0,0,{'NOW()' if is_pg else "datetime('now')"},{'NOW()' if is_pg else "datetime('now')"}
            )
        """
        cur.execute(sql, (
            r["sales_date"],
            r["card_amount"], r["cash_amount"], r["cash_receipt_amount"],
            r["delivery_amount"], r["discount_amount"], r["service_amount"],
            r["receipt_count"], r["customer_count"],
            r["transfer_count"], r["transfer_amount"],
            r["catchtable_count"], r["catchtable_amount"],
        ))
        inserted += 1

    conn.commit()
    conn.close()

    # 검증 합계
    if is_pg:
        conn2 = psycopg2.connect(db_url)
        cur2 = conn2.cursor()
        cur2.execute(
            "SELECT SUM(card_amount), SUM(cash_amount), SUM(transfer_amount), SUM(catchtable_amount) "
            "FROM sales_records WHERE sales_date::text LIKE '2026-05-%%' AND is_deleted=0"
        )
    else:
        path = db_url.replace("sqlite:///", "")
        conn2 = sqlite3.connect(path)
        cur2 = conn2.cursor()
        cur2.execute(
            "SELECT SUM(card_amount), SUM(cash_amount), SUM(transfer_amount), SUM(catchtable_amount) "
            "FROM sales_records WHERE sales_date LIKE '2026-05-%' AND is_deleted=0"
        )
    row = cur2.fetchone()
    card_s = int(row[0] or 0)
    cash_s = int(row[1] or 0)
    tran_s = int(row[2] or 0)
    catc_s = int(row[3] or 0)
    total_s = card_s + cash_s + tran_s + catc_s
    conn2.close()

    print(f"\n[{label}] {inserted}건 삽입 / {skipped}건 스킵")
    print(f"[{label}] 5월 검증: 카드 {card_s:,} / 현금 {cash_s:,} / 이체 {tran_s:,} / 캐치 {catc_s:,} = {total_s:,}")
    print(f"[{label}] 목표합계: 98,785,000 → {'OK' if total_s == 98785000 else 'MISMATCH'}")


if __name__ == "__main__":
    print(f"\n[파싱] {XLSX_PATH.name}")
    records = parse_sales(XLSX_PATH)
    print(f"\n총 {len(records)}일 파싱 완료\n")

    print("=== 로컬 SQLite ===")
    load_to_db(SQLITE_URL, records, "SQLite")

    print("\n=== Render PostgreSQL ===")
    load_to_db(RENDER_URL, records, "Render")

    print("\n완료!")
