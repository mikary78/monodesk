"""
import_expenses_april.py — 4월 지출 내역.xls → MonoDesk expense_records 삽입
로컬 SQLite + Render PostgreSQL 동시 처리

파일 구조:
  Sheet0, row 10(헤더행): [번호, 지출일자, 지출금액(원), 지출항목, ...]
  row 11~: 실제 데이터 (역순)

카테고리 매핑:
  식재료비 → 식재료비 (id=1)
  인건비   → 인건비   (id=2)
  임대료   → 임대료   (id=3)
  세금과공과 → 공과금  (id=4)
  소모품비  → 소모품비 (id=5)
  수수료   → 수수료   (id=6)
  주류비   → 주류비   (신규)
  그 외    → 기타     (id=7)

실행: python dailyfile/import_expenses_april.py
"""
import os
import sqlite3
import psycopg2
import xlrd
from datetime import datetime

EXCEL_DIR  = os.path.dirname(os.path.abspath(__file__))
DB_PATH    = os.path.join(os.path.dirname(EXCEL_DIR), 'database', 'monodesk.db')
XLS_PATH   = os.path.join(EXCEL_DIR, '4월 지출 내역.xls')
DB_URL     = "postgresql://monodesk_user:oEC6WHpoWqT0RUWR4OOF242NayiWTufw@dpg-d7jdmqvlk1mc73a72krg-a.oregon-postgres.render.com/monodesk"

print(f'XLS: {XLS_PATH}')
print(f'SQLite: {DB_PATH}')
print(f'Render: (연결 중...)')
print()

def safe_float(v, default=0.0):
    if v is None: return default
    try: return float(v)
    except: return default

def parse_date(v):
    """
    xlrd에서 읽은 날짜 문자열 파싱 (2026/04/30 형식)
    반환: 'YYYY-MM-DD' 문자열
    """
    if v is None: return None
    s = str(v).strip()
    if '/' in s:
        parts = s.split('/')
        if len(parts) == 3:
            return f'{parts[0]}-{parts[1].zfill(2)}-{parts[2][:2].zfill(2)}'
    return None

# XLS 파싱
wb = xlrd.open_workbook(XLS_PATH, encoding_override='cp949')
ws = wb.sheet_by_index(0)

# 헤더 확인 (row index 9 = 10번째 행)
print('헤더 확인 (row 10):')
for c in range(10):
    v = ws.cell_value(9, c)
    if v: print(f'  col{c}: {v}')
print()

# 카테고리 매핑 (xls 지출항목 -> MonoDesk 카테고리명)
CATEGORY_MAP = {
    '식재료비': '식재료비',
    '인건비':   '인건비',
    '임대료':   '임대료',
    '세금과공과': '공과금',
    '소모품비': '소모품비',
    '수수료':   '수수료',
    '주류비':   '주류비',    # 신규 추가
    # 그 외 → '기타'
}

# 데이터 수집 (row 10~: 0-indexed = row index 10)
records = []
for r in range(10, ws.nrows):
    번호   = ws.cell_value(r, 0)
    날짜   = ws.cell_value(r, 1)
    금액   = ws.cell_value(r, 2)
    항목   = ws.cell_value(r, 3)
    지출처 = ws.cell_value(r, 6)  # 상점명

    # 헤더나 빈 행 스킵
    if not 날짜 or str(날짜).strip() in ('지출일자', ''):
        continue
    if not 금액 or str(항목).strip() in ('지출항목', ''):
        continue

    expense_date = parse_date(날짜)
    if not expense_date:
        continue

    amount = safe_float(금액)
    if amount <= 0:
        continue

    category_name = CATEGORY_MAP.get(str(항목).strip(), '기타')
    vendor = str(지출처).strip() if 지출처 else None

    records.append({
        'expense_date': expense_date,
        'amount': amount,
        'category_name': category_name,
        'vendor': vendor,
        'description': str(항목).strip(),
    })

print(f'XLS 파싱 완료: {len(records)}건')

# 카테고리별 집계 출력
cat_count = {}
for r in records:
    cat_count[r['category_name']] = cat_count.get(r['category_name'], 0) + 1
for cat, cnt in sorted(cat_count.items(), key=lambda x: -x[1]):
    print(f'  {cat:<15}: {cnt:>3}건')
print()


def process_db(conn, cur, is_postgres=False):
    """SQLite 또는 PostgreSQL에 데이터 삽입"""
    ph = '%s' if is_postgres else '?'  # 플레이스홀더

    # 1. 카테고리 목록 조회 (name -> id)
    cur.execute('SELECT id, name FROM expense_categories WHERE is_deleted=0')
    cat_map = {row[1]: row[0] for row in cur.fetchall()}

    # 2. '주류비' 카테고리 없으면 추가
    if '주류비' not in cat_map:
        if is_postgres:
            cur.execute(
                f"INSERT INTO expense_categories (name, description, color, is_deleted, created_at, updated_at) VALUES ({ph},{ph},{ph},0,NOW(),NOW()) RETURNING id",
                ('주류비', '주류 구입비', '#F59E0B')
            )
            new_id = cur.fetchone()[0]
        else:
            cur.execute(
                f"INSERT INTO expense_categories (name, description, color, is_deleted, created_at, updated_at) VALUES ({ph},{ph},{ph},0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)",
                ('주류비', '주류 구입비', '#F59E0B')
            )
            new_id = cur.lastrowid
        cat_map['주류비'] = new_id
        conn.commit()
        print(f'  [카테고리 추가] 주류비 (id={new_id})')

    inserted = 0
    skipped = 0
    dup_skipped = 0

    for rec in records:
        category_id = cat_map.get(rec['category_name'], cat_map.get('기타'))
        if category_id is None:
            skipped += 1
            continue

        # 중복 체크: 같은 날짜 + 금액 + 카테고리 + 지출처 조합
        cur.execute(
            f"""SELECT id FROM expense_records
                WHERE expense_date={ph} AND amount={ph}
                  AND category_id={ph} AND vendor={ph} AND is_deleted=0""",
            (rec['expense_date'], rec['amount'], category_id, rec['vendor'])
        )
        if cur.fetchone():
            dup_skipped += 1
            continue

        if is_postgres:
            cur.execute(f"""
                INSERT INTO expense_records
                    (expense_date, category_id, vendor, description, amount, vat,
                     payment_method, is_deleted, created_at, updated_at)
                VALUES ({ph},{ph},{ph},{ph},{ph},0,'카드',0,NOW(),NOW())
            """, (
                rec['expense_date'], category_id, rec['vendor'],
                rec['description'], rec['amount'],
            ))
        else:
            cur.execute(f"""
                INSERT INTO expense_records
                    (expense_date, category_id, vendor, description, amount, vat,
                     payment_method, is_deleted, created_at, updated_at)
                VALUES ({ph},{ph},{ph},{ph},{ph},0,'카드',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
            """, (
                rec['expense_date'], category_id, rec['vendor'],
                rec['description'], rec['amount'],
            ))
        inserted += 1

    conn.commit()
    return inserted, skipped, dup_skipped


# ─── 로컬 SQLite ─────────────────────────────────────────────────
print('=== 로컬 SQLite 처리 ===')
conn_sq = sqlite3.connect(DB_PATH)
cur_sq  = conn_sq.cursor()
ins, skip, dup = process_db(conn_sq, cur_sq, is_postgres=False)
conn_sq.close()
print(f'[OK] SQLite: {ins}건 삽입, {dup}건 중복스킵, {skip}건 카테고리없음\n')

# ─── Render PostgreSQL ───────────────────────────────────────────
print('=== Render PostgreSQL 처리 ===')
conn_pg = psycopg2.connect(DB_URL)
cur_pg  = conn_pg.cursor()
ins_pg, skip_pg, dup_pg = process_db(conn_pg, cur_pg, is_postgres=True)
cur_pg.close()
conn_pg.close()
print(f'[OK] PostgreSQL: {ins_pg}건 삽입, {dup_pg}건 중복스킵, {skip_pg}건 카테고리없음\n')

# ─── 최종 요약 ──────────────────────────────────────────────────
print('=== 최종 요약 ===')
print(f'  SQLite     : {ins}건 삽입')
print(f'  PostgreSQL : {ins_pg}건 삽입')
print('완료')
