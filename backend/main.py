# ============================================================
# main.py — FastAPI 앱 엔트리포인트
# MonoDesk 백엔드 서버의 시작점입니다.
# 실행: uvicorn main:app --port 8000
# 브라우저: http://localhost:8000
# ============================================================

import os
from dotenv import load_dotenv
from contextlib import asynccontextmanager

# .env 파일 로드 (ANTHROPIC_API_KEY 등 환경변수)
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import create_tables, run_migrations
from routers import accounting, sales_analysis, inventory, menu, employee, dashboard, corporate, operations, ocr, document

# 프론트엔드 빌드 결과물 경로 (frontend/dist)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 라이프스팬 이벤트"""
    # 1. SQLAlchemy 모델 기반 테이블 생성 (없는 테이블 자동 생성)
    create_tables()
    # 2. migrations/ 폴더의 SQL 파일 순서대로 실행 (이미 실행된 파일은 건너뜀)
    run_migrations()
    print("MonoDesk 서버가 시작되었습니다.")
    print(f"브라우저에서 http://localhost:8000 으로 접속하세요.")
    yield

# FastAPI 앱 인스턴스 생성
app = FastAPI(
    title="MonoDesk API",
    description="여남동 외식업 통합 관리 시스템 백엔드 API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 설정 (로컬 전용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록 (/api/* 경로)
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["대시보드"])
app.include_router(accounting.router, prefix="/api/accounting", tags=["세무/회계"])
app.include_router(sales_analysis.router, prefix="/api/sales-analysis", tags=["매출 분석"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["재고/발주"])
app.include_router(menu.router, prefix="/api/menu", tags=["메뉴 관리"])
app.include_router(employee.router, prefix="/api/employee", tags=["직원 관리"])
app.include_router(corporate.router, prefix="/api/corporate", tags=["법인 관리"])
app.include_router(operations.router, prefix="/api/operations", tags=["운영 관리"])
app.include_router(ocr.router, prefix="/api/ocr", tags=["영수증 OCR"])
app.include_router(document.router, prefix="/api/documents", tags=["문서 관리"])


@app.get("/health")
def health_check():
    """헬스 체크 엔드포인트"""
    return {"status": "ok"}


# uploads 정적 파일 서빙 (영수증 이미지 미리보기용)
# 프로젝트 루트의 uploads/ 폴더를 /uploads 경로로 노출합니다.
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

# React SPA 정적 파일 서빙 (빌드된 경우에만)
if os.path.exists(FRONTEND_DIST):
    # /assets, /favicon.ico 등 정적 자원 서빙
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
        """React SPA 라우팅 지원 — 모든 프론트엔드 경로를 index.html로 처리"""
        index_path = os.path.join(FRONTEND_DIST, "index.html")
        return FileResponse(index_path)
else:
    @app.get("/")
    def root():
        """빌드 파일 없을 때 안내 메시지"""
        return {
            "message": "MonoDesk API 서버가 실행 중입니다. (프론트엔드 빌드 필요)",
            "version": "0.1.0",
            "docs": "/docs",
            "build_guide": "frontend/ 폴더에서 npm run build 를 실행하세요."
        }
