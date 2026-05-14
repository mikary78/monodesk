# ============================================================
# import_product_sales.py — 상품별 판매 데이터 임포트 스크립트
# dailyfile/202604/상품별매출_202604.xlsx 파일을 파싱하여
# 로컬 SQLite와 Render PostgreSQL 양쪽에 동시 적재합니다.
#
# 실행 방법:
#   cd "c:\Users\KIM sungje\OneDrive\1_Dev projects\2_MonoDesk\dailyfile\202604"
#   python import_product_sales.py
#
# 사전 요구사항:
#   pip install openpyxl sqlalchemy psycopg2-binary python-dotenv
# ============================================================

import os
import sys
import re
from pathlib import Path
from io import BytesIO

# ── 경로 설정 ────────────────────────────────────────────────
# 이 스크립트가 있는 폴더 (dailyfile/202604/)
SCRIPT_DIR = Path(__file__).parent.resolve()
# 엑셀 파일 경로 (같은 폴더에 위치)
XLSX_PATH = SCRIPT_DIR / "상품별매출_202604.xlsx"
# 프로젝트 루트 (MonoDesk/)
PROJECT_ROOT = SCRIPT_DIR.parent.parent.resolve()
# 로컬 SQLite DB 경로
SQLITE_PATH = PROJECT_ROOT / "database" / "monodesk.db"

# ── .env 파일 로드 (백엔드 설정 공유) ───────────────────────
# DATABASE_URL (Render PostgreSQL) 환경변수를 가져옵니다
env_file = PROJECT_ROOT / "backend" / ".env"
if env_file.exists():
    # python-dotenv가 설치된 경우 사용
    try:
        from dotenv import load_dotenv
        load_dotenv(env_file)
        print(f"[설정] .env 로드: {env_file}")
    except ImportError:
        # dotenv 없으면 수동 파싱
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
        print(f"[설정] .env 수동 로드: {env_file}")

# ── Render PostgreSQL URL ────────────────────────────────────
# 환경변수 DATABASE_URL이 있으면 PostgreSQL, 없으면 SQLite만 적재
RENDER_DB_URL = os.getenv("DATABASE_URL", "")
if RENDER_DB_URL.startswith("postgres://"):
    RENDER_DB_URL = RENDER_DB_URL.replace("postgres://", "postgresql://", 1)

# ─────────────────────────────────────────
# 1. 엑셀 파싱 함수
# ─────────────────────────────────────────

def parse_xlsx(xlsx_path: Path) -> tuple[list[dict], int, int]:
    """
    상품별매출 xlsx 파일을 파싱하여 상품 목록과 연/월을 반환합니다.

    반환값: (상품_딕셔너리_목록, 연도, 월)
    """
    import openpyxl

    print(f"[파싱] 엑셀 파일 읽기: {xlsx_path}")
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))

    # ── 기간 추출 (row1) ──────────────────────────────────────
    # 예: "조회기간 : 2026-04-01 ~ 2026-04-30"
    period_text = str(rows[0][0] or "") if rows else ""
    m = re.search(r"(\d{4})-(\d{2})-\d{2}", period_text)
    if not m:
        print(f"[경고] 기간 파싱 실패. 첫 번째 셀: '{period_text}'")
        print("       2026년 4월로 강제 설정합니다.")
        year, month = 2026, 4
    else:
        year = int(m.group(1))
        month = int(m.group(2))

    print(f"[파싱] 집계 기간: {year}년 {month}월")

    # ── 데이터 파싱 (row6부터) ──────────────────────────────
    # rows[5:]는 0-based: rows[0]=row1, rows[5]=row6(첫 데이터행)
    result = []
    skipped = 0
    for i, row in enumerate(rows[5:], start=6):
        # 상품명(col2) 없으면 합계행 또는 빈 행
        if not row[2]:
            skipped += 1
            continue

        # 총판매수량(col6) — 0 이하면 판매 없음
        qty = row[6]
        if not isinstance(qty, (int, float)) or qty <= 0:
            skipped += 1
            continue

        result.append({
            "product_code":   str(row[1]).strip() if row[1] else None,
            "product_name":   str(row[2]).strip(),
            "category":       str(row[3]).strip() if row[3] else None,
            "tax_type":       str(row[4]).strip() if row[4] else None,
            "status":         str(row[5]).strip() if row[5] else None,
            "quantity":       int(qty),
            "unit_cost":      float(row[7] or 0),
            "total_sales":    float(row[8] or 0),
            "quantity_ratio": float(row[9] or 0),
            "sales_ratio":    float(row[11] or 0),
        })

    print(f"[파싱] 파싱 완료: {len(result)}개 상품 (스킵: {skipped}행)")
    return result, year, month


# ─────────────────────────────────────────
# 2. DB 적재 함수
# ─────────────────────────────────────────

def load_to_db(db_url: str, product_list: list[dict], year: int, month: int, db_label: str):
    """
    지정한 DB URL에 상품 판매 데이터를 적재합니다.
    - 해당 연/월 기존 데이터는 삭제 후 재삽입 (멱등성 보장)

    @param db_url: SQLAlchemy 연결 문자열
    @param product_list: 파싱된 상품 딕셔너리 목록
    @param year: 집계 연도
    @param month: 집계 월
    @param db_label: 로그 출력용 DB 이름 레이블
    """
    from sqlalchemy import create_engine, text

    print(f"\n[{db_label}] 연결 시작...")
    try:
        # SQLite는 check_same_thread=False 필요
        connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
        engine = create_engine(db_url, connect_args=connect_args)
    except Exception as e:
        print(f"[{db_label}] 연결 실패: {e}")
        return

    with engine.connect() as conn:
        # ── 테이블 생성 (없는 경우) ─────────────────────────
        if db_url.startswith("sqlite"):
            # SQLite용 CREATE TABLE IF NOT EXISTS
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS product_sales_monthly (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    year INTEGER NOT NULL,
                    month INTEGER NOT NULL,
                    product_code TEXT,
                    product_name TEXT NOT NULL,
                    category TEXT,
                    tax_type TEXT,
                    status TEXT,
                    quantity INTEGER DEFAULT 0,
                    unit_cost FLOAT DEFAULT 0,
                    total_sales FLOAT DEFAULT 0,
                    quantity_ratio FLOAT DEFAULT 0,
                    sales_ratio FLOAT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(year, month, product_code)
                )
            """))
        else:
            # PostgreSQL용 CREATE TABLE IF NOT EXISTS
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS product_sales_monthly (
                    id SERIAL PRIMARY KEY,
                    year INTEGER NOT NULL,
                    month INTEGER NOT NULL,
                    product_code TEXT,
                    product_name TEXT NOT NULL,
                    category TEXT,
                    tax_type TEXT,
                    status TEXT,
                    quantity INTEGER DEFAULT 0,
                    unit_cost FLOAT DEFAULT 0,
                    total_sales FLOAT DEFAULT 0,
                    quantity_ratio FLOAT DEFAULT 0,
                    sales_ratio FLOAT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(year, month, product_code)
                )
            """))
        conn.commit()

        # ── 기존 데이터 삭제 ─────────────────────────────────
        delete_result = conn.execute(text("""
            DELETE FROM product_sales_monthly
            WHERE year = :year AND month = :month
        """), {"year": year, "month": month})
        deleted_count = delete_result.rowcount
        conn.commit()

        if deleted_count > 0:
            print(f"[{db_label}] 기존 {deleted_count}건 삭제 완료")

        # ── 새 데이터 삽입 ──────────────────────────────────
        inserted = 0
        for product in product_list:
            conn.execute(text("""
                INSERT INTO product_sales_monthly
                    (year, month, product_code, product_name, category,
                     tax_type, status, quantity, unit_cost, total_sales,
                     quantity_ratio, sales_ratio)
                VALUES
                    (:year, :month, :product_code, :product_name, :category,
                     :tax_type, :status, :quantity, :unit_cost, :total_sales,
                     :quantity_ratio, :sales_ratio)
            """), {
                "year": year,
                "month": month,
                **product,  # product_code, product_name, ... 딕셔너리 언패킹
            })
            inserted += 1

        conn.commit()
        print(f"[{db_label}] {inserted}건 삽입 완료")


# ─────────────────────────────────────────
# 3. 결과 요약 출력 함수
# ─────────────────────────────────────────

def safe_print(text: str):
    """
    Windows CP949 터미널에서 출력 불가능한 문자(이모지 등)를 '?'로 대체하여 출력합니다.
    인코딩 오류 없이 안전하게 출력합니다.
    """
    # UTF-8 → CP949 변환 시 오류 문자는 '?'로 대체
    encoded = text.encode("cp949", errors="replace").decode("cp949")
    print(encoded)


def print_summary(product_list: list[dict], year: int, month: int):
    """
    적재 결과를 요약하여 출력합니다.
    - 전체 건수
    - 카테고리별 수량 합계 (내림차순)
    """
    safe_print(f"\n{'='*50}")
    safe_print(f"  {year}년 {month}월 상품별 판매 적재 결과 요약")
    safe_print(f"{'='*50}")
    safe_print(f"  총 상품 수: {len(product_list)}개")
    safe_print(f"  총 판매 수량: {sum(p['quantity'] for p in product_list):,}개")
    safe_print("")

    # 카테고리별 수량 집계
    cat_stats: dict[str, int] = {}
    for p in product_list:
        cat = p.get("category") or "미분류"
        cat_stats[cat] = cat_stats.get(cat, 0) + p["quantity"]

    # 수량 내림차순 정렬
    sorted_cats = sorted(cat_stats.items(), key=lambda x: x[1], reverse=True)
    total_qty = sum(q for _, q in sorted_cats)

    safe_print("  카테고리별 판매 수량:")
    for cat, qty in sorted_cats:
        pct = (qty / total_qty * 100) if total_qty > 0 else 0
        bar = "#" * int(pct / 2)  # 최대 50칸 바 (ASCII 사용 — Windows 터미널 호환)
        safe_print(f"    {cat:<20} {qty:>6,}개  ({pct:5.1f}%)  {bar}")

    safe_print("")
    safe_print("  수량 TOP 10 상품:")
    sorted_products = sorted(product_list, key=lambda x: x["quantity"], reverse=True)
    for i, p in enumerate(sorted_products[:10], start=1):
        safe_print(f"    {i:>2}위  {p['product_name']:<30} {p['quantity']:>5,}개")

    safe_print(f"{'='*50}\n")


# ─────────────────────────────────────────
# 4. 메인 실행
# ─────────────────────────────────────────

if __name__ == "__main__":
    print("\n[MonoDesk] 상품별 판매 데이터 임포트 시작")
    print(f"  엑셀 파일: {XLSX_PATH}")
    print(f"  SQLite DB: {SQLITE_PATH}")
    print(f"  Render DB: {'설정됨' if RENDER_DB_URL else '없음 (SQLite만 적재)'}\n")

    # ── 엑셀 파일 존재 확인 ───────────────────────────────
    if not XLSX_PATH.exists():
        print(f"[오류] 엑셀 파일을 찾을 수 없습니다: {XLSX_PATH}")
        sys.exit(1)

    # ── 엑셀 파싱 ────────────────────────────────────────
    try:
        product_list, year, month = parse_xlsx(XLSX_PATH)
    except Exception as e:
        print(f"[오류] 엑셀 파싱 실패: {e}")
        sys.exit(1)

    if not product_list:
        print("[오류] 파싱된 데이터가 없습니다. 파일 형식을 확인해주세요.")
        sys.exit(1)

    # ── 로컬 SQLite 적재 ─────────────────────────────────
    sqlite_url = f"sqlite:///{SQLITE_PATH}"
    load_to_db(sqlite_url, product_list, year, month, "로컬 SQLite")

    # ── Render PostgreSQL 적재 (URL이 있는 경우에만) ──────
    if RENDER_DB_URL:
        load_to_db(RENDER_DB_URL, product_list, year, month, "Render PostgreSQL")
    else:
        print("\n[Render PostgreSQL] DATABASE_URL 환경변수가 없어 SQLite만 적재했습니다.")
        print("  Render에도 적재하려면 backend/.env에 DATABASE_URL을 추가하세요.")

    # ── 결과 요약 출력 ────────────────────────────────────
    print_summary(product_list, year, month)
    print("[MonoDesk] 임포트 완료!")
