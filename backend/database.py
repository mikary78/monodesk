# ============================================================
# database.py — SQLite 데이터베이스 연결 설정
# SQLAlchemy를 사용해 로컬 SQLite DB에 연결합니다.
# ============================================================

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import sqlite3
import glob

# 데이터베이스 파일 경로 설정 (프로젝트 루트/database/ 폴더)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_PATH = os.path.join(BASE_DIR, "database", "monodesk.db")
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# SQLAlchemy 엔진 생성
# check_same_thread=False: FastAPI의 비동기 환경에서 SQLite 사용 시 필요
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

# SQLite 외래키 제약 활성화 (기본값이 비활성화이므로 명시 설정)
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """SQLite 연결 시 외래키 제약조건 활성화"""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

# 세션 팩토리 생성
# autocommit=False: 트랜잭션 명시 커밋 필요
# autoflush=False: 명시적 flush 필요
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 모델 베이스 클래스
Base = declarative_base()


def get_db():
    """
    FastAPI 의존성 주입용 DB 세션 생성 함수.
    요청 처리 후 세션을 자동으로 닫습니다.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations():
    """
    migrations/ 폴더의 SQL 파일을 순서대로 실행합니다.
    이미 실행된 파일은 migration_history 테이블로 추적하여 중복 실행을 방지합니다.
    앱 시작 시 create_tables() 이후에 호출됩니다.
    """
    # migration_history 테이블이 없으면 생성 (최초 실행 시)
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS migration_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL UNIQUE,
            executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()

    # migrations/ 폴더의 SQL 파일을 파일명 기준 오름차순 정렬 후 실행
    migrations_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migrations")
    sql_files = sorted(glob.glob(os.path.join(migrations_dir, "*.sql")))

    for sql_file in sql_files:
        filename = os.path.basename(sql_file)

        # 이미 실행된 파일인지 확인
        cursor.execute("SELECT id FROM migration_history WHERE filename = ?", (filename,))
        if cursor.fetchone():
            continue  # 이미 실행된 파일은 건너뜀

        # SQL 파일 읽기 및 실행
        try:
            with open(sql_file, "r", encoding="utf-8") as f:
                sql_content = f.read()

            # 세미콜론 기준으로 각 구문 분리 실행
            statements = [s.strip() for s in sql_content.split(";") if s.strip()]
            for statement in statements:
                # 주석 줄만 있는 경우 건너뜀
                non_comment_lines = [
                    line for line in statement.splitlines()
                    if line.strip() and not line.strip().startswith("--")
                ]
                if non_comment_lines:
                    try:
                        cursor.execute(statement)
                    except sqlite3.OperationalError as e:
                        # 이미 컬럼이 존재하는 경우 무시 (멱등성 보장)
                        if "duplicate column name" in str(e).lower():
                            pass
                        else:
                            raise

            # 실행 이력 기록
            cursor.execute(
                "INSERT INTO migration_history (filename) VALUES (?)", (filename,)
            )
            conn.commit()
            print(f"[마이그레이션] {filename} 실행 완료")

        except Exception as e:
            conn.rollback()
            print(f"[마이그레이션 오류] {filename} 실행 실패: {e}")
            raise

    cursor.close()
    conn.close()


def create_tables():
    """
    모든 테이블을 데이터베이스에 생성합니다.
    앱 시작 시 한 번 호출됩니다.
    모든 모델을 import해야 Base.metadata에 등록됩니다.
    """
    # 모든 모델 import (테이블 자동 생성을 위해 필요)
    import models.accounting  # noqa: F401
    import models.sales_analysis  # noqa: F401
    import models.inventory  # noqa: F401 — 재고/발주 모델
    import models.menu       # noqa: F401 — 메뉴 관리 모델
    import models.employee   # noqa: F401 — 직원 관리 모델
    import models.corporate   # noqa: F401 — 법인 관리 모델
    import models.operations  # noqa: F401 — 운영 관리 모델
    import models.document    # noqa: F401 — 문서 관리 모델 (지결서·회의록)
    Base.metadata.create_all(bind=engine)
