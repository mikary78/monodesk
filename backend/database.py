# ============================================================
# database.py — 데이터베이스 연결 설정
# DATABASE_URL 환경변수로 SQLite(로컬) / PostgreSQL(Render) 자동 분기
# ============================================================

import os
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

# ─── DATABASE_URL 결정 ────────────────────────────────────────
# 환경변수 우선, 없으면 로컬 SQLite (database/monodesk.db)
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DEFAULT_SQLITE = f"sqlite:///{os.path.join(_BASE_DIR, 'database', 'monodesk.db')}"

DATABASE_URL = os.getenv("DATABASE_URL", _DEFAULT_SQLITE)

# Render PostgreSQL URL은 postgres:// 로 시작하지만
# SQLAlchemy는 postgresql:// 이 필요하므로 자동 변환
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# ─── 엔진 생성 (SQLite vs PostgreSQL 분기) ────────────────────
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},  # FastAPI 비동기 환경 필수
    )

    # SQLite 외래키 제약 활성화 (SQLite 기본값은 비활성)
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

else:
    # PostgreSQL — pool_pre_ping으로 연결 끊김 자동 재연결
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# ─── 세션 및 베이스 ───────────────────────────────────────────
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI 의존성 주입용 DB 세션 생성 함수."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """
    SQLAlchemy 모델 기반으로 테이블을 생성합니다.
    이미 존재하는 테이블은 건드리지 않습니다 (데이터 보존).
    SQLite, PostgreSQL 모두 동일하게 동작합니다.
    """
    import models.accounting   # noqa: F401
    import models.sales_analysis  # noqa: F401
    import models.inventory    # noqa: F401
    import models.menu         # noqa: F401
    import models.employee     # noqa: F401
    import models.corporate    # noqa: F401
    import models.operations   # noqa: F401
    import models.document     # noqa: F401
    import models.auth         # noqa: F401
    Base.metadata.create_all(bind=engine)


def add_missing_columns():
    """
    기존 DB 스키마에 누락된 컬럼을 추가합니다 (알터 마이그레이션).
    create_all은 기존 테이블 컬럼을 추가하지 않으므로 별도로 처리합니다.
    이미 존재하는 컬럼에 대한 오류는 무시합니다.
    """
    from sqlalchemy import text

    migrations = []

    if DATABASE_URL.startswith("sqlite"):
        # SQLite: IF NOT EXISTS 미지원 — 오류 캐치로 처리
        migrations = [
            "ALTER TABLE users ADD COLUMN employee_id INTEGER",
            "ALTER TABLE sales_records ADD COLUMN catchtable_count INTEGER DEFAULT 0",
            "ALTER TABLE sales_records ADD COLUMN catchtable_amount FLOAT DEFAULT 0",
            # POS 데이터 컬럼 추가
            "ALTER TABLE sales_records ADD COLUMN pos_total FLOAT DEFAULT 0",
            "ALTER TABLE sales_records ADD COLUMN pos_card FLOAT DEFAULT 0",
            "ALTER TABLE sales_records ADD COLUMN pos_cash FLOAT DEFAULT 0",
        ]
        with engine.connect() as conn:
            for sql in migrations:
                try:
                    conn.execute(text(sql))
                    conn.commit()
                except Exception:
                    pass  # 컬럼이 이미 존재하면 무시
    else:
        # PostgreSQL: ADD COLUMN IF NOT EXISTS 지원
        migrations = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id INTEGER",
            "ALTER TABLE sales_records ADD COLUMN IF NOT EXISTS catchtable_count INTEGER DEFAULT 0",
            "ALTER TABLE sales_records ADD COLUMN IF NOT EXISTS catchtable_amount FLOAT DEFAULT 0",
            # POS 데이터 컬럼 추가
            "ALTER TABLE sales_records ADD COLUMN IF NOT EXISTS pos_total FLOAT DEFAULT 0",
            "ALTER TABLE sales_records ADD COLUMN IF NOT EXISTS pos_card FLOAT DEFAULT 0",
            "ALTER TABLE sales_records ADD COLUMN IF NOT EXISTS pos_cash FLOAT DEFAULT 0",
        ]
        with engine.connect() as conn:
            for sql in migrations:
                try:
                    conn.execute(text(sql))
                    conn.commit()
                except Exception:
                    pass
