# ============================================================
# main.py — FastAPI 앱 엔트리포인트
# MonoDesk 백엔드 서버의 시작점입니다.
# 실행: uvicorn main:app --port 8000
# ============================================================

import os
from dotenv import load_dotenv
from contextlib import asynccontextmanager

# .env 파일 로드 — 절대 경로로 지정해 서버 실행 위치에 관계없이 항상 찾도록 함
_ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(_ENV_PATH)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from database import create_tables, SessionLocal
from routers import (
    accounting, sales_analysis, inventory, menu, employee,
    dashboard, corporate, operations, ocr, document,
    auth as auth_router,
)

# 프론트엔드 빌드 결과물 경로 (frontend/dist)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")


# ─────────────────────────────────────────
# 기초 데이터 시드 함수
# ─────────────────────────────────────────

def seed_initial_data():
    """
    DB가 비어 있을 때 최초 1회만 기초 데이터를 삽입합니다.
    이미 존재하는 데이터는 건드리지 않습니다 (멱등성 보장).
    """
    from models.auth import User
    from models.accounting import ExpenseCategory
    from models.operations import FixedCostItem

    db = SessionLocal()
    try:
        # ── 1. 관리자 계정 ────────────────────────────────────
        # 비밀번호: admin1234 (bcrypt 4.0.1 기준 해시, 017_auth.sql과 동일)
        if not db.query(User).filter(User.username == "admin").first():
            db.add(User(
                username="admin",
                password_hash="$2b$12$Gb8FTNYZ7S46rKr9orJUXukepdAspSBW6grAjmW0GCeikP.n8wDiK",
                name="관리자",
                role="admin",
                is_active=True,
            ))
            print("[시드] admin 계정 생성")

        # ── 2. 지출 분류 기본값 ───────────────────────────────
        default_categories = [
            ("식재료비",  "#EF4444"),
            ("인건비",    "#F97316"),
            ("임대료",    "#8B5CF6"),
            ("공과금",    "#06B6D4"),
            ("소모품비",  "#84CC16"),
            ("수수료",    "#EC4899"),
            ("기타",      "#64748B"),
        ]
        for name, color in default_categories:
            if not db.query(ExpenseCategory).filter(ExpenseCategory.name == name).first():
                db.add(ExpenseCategory(name=name, color=color))

        # ── 3. 고정비 항목 기본값 ─────────────────────────────
        default_fixed_costs = [
            ("임대료",     "facility",  5,  0),
            ("도시가스",   "facility", 20,  0),
            ("전기료",     "facility", 15,  0),
            ("수도료",     "facility", 15,  0),
            ("산재보험",   "operation", 10, 0),
            ("유선전화",   "operation", 10, 0),
        ]
        for name, cat, day, amount in default_fixed_costs:
            if not db.query(FixedCostItem).filter(FixedCostItem.name == name).first():
                db.add(FixedCostItem(
                    name=name, category=cat,
                    payment_day=day, default_amount=amount,
                ))

        db.commit()
        print("[시드] 기초 데이터 삽입 완료")

    except Exception as e:
        db.rollback()
        print(f"[시드] 기초 데이터 삽입 실패: {e}")
    finally:
        db.close()


# ─────────────────────────────────────────
# 앱 라이프사이클
# ─────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 라이프스팬 이벤트"""
    # 1. SQLAlchemy 모델 기반 테이블 생성 (없는 테이블만, 기존 데이터 보존)
    create_tables()
    # 2. 기초 데이터 삽입 (admin 계정, 카테고리 등 — 이미 있으면 건너뜀)
    seed_initial_data()
    print("MonoDesk 서버가 시작되었습니다.")
    yield


# ─────────────────────────────────────────
# FastAPI 앱 초기화
# ─────────────────────────────────────────

app = FastAPI(
    title="MonoDesk API",
    description="여남동 외식업 통합 관리 시스템 백엔드 API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 설정 — 배포 후 ALLOWED_ORIGINS 환경변수로 실제 URL 지정 권장
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*")
_allow_origins = [o.strip() for o in _raw_origins.split(",")] if _raw_origins != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────
# API 라우터 등록
# ─────────────────────────────────────────

app.include_router(auth_router.router,    prefix="/api/auth",           tags=["인증"])
app.include_router(dashboard.router,      prefix="/api/dashboard",       tags=["대시보드"])
app.include_router(accounting.router,     prefix="/api/accounting",      tags=["세무/회계"])
app.include_router(sales_analysis.router, prefix="/api/sales-analysis",  tags=["매출 분석"])
app.include_router(inventory.router,      prefix="/api/inventory",       tags=["재고/발주"])
app.include_router(menu.router,           prefix="/api/menu",            tags=["메뉴 관리"])
app.include_router(employee.router,       prefix="/api/employee",        tags=["직원 관리"])
app.include_router(corporate.router,      prefix="/api/corporate",       tags=["법인 관리"])
app.include_router(operations.router,     prefix="/api/operations",      tags=["운영 관리"])
app.include_router(ocr.router,            prefix="/api/ocr",             tags=["영수증 OCR"])
app.include_router(document.router,       prefix="/api/documents",       tags=["문서 관리"])


@app.get("/health")
def health_check():
    return {"status": "ok"}


# ─────────────────────────────────────────
# 정적 파일 서빙
# ─────────────────────────────────────────

# uploads 폴더 (영수증 이미지 미리보기용)
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# React SPA 정적 파일 서빙 (빌드된 경우에만)
if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

    @app.get("/favicon.ico", include_in_schema=False)
    def favicon():
        favicon_path = os.path.join(FRONTEND_DIST, "favicon.ico")
        if os.path.exists(favicon_path):
            return FileResponse(favicon_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

    # React Router SPA — /api/* 외 모든 경로는 index.html 반환
    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

else:
    @app.get("/")
    def root():
        return {
            "message": "MonoDesk API 서버가 실행 중입니다. (프론트엔드 빌드 필요)",
            "docs": "/docs",
        }
