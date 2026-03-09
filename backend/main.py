# ============================================================
# main.py — FastAPI 앱 엔트리포인트
# MonoDesk 백엔드 서버의 시작점입니다.
# 실행: uvicorn main:app --reload --port 8000
# ============================================================

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import create_tables
from routers import accounting, sales_analysis, inventory, menu, employee, dashboard, corporate, operations

@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 라이프스팬 이벤트"""
    create_tables()
    print("MonoDesk 서버가 시작되었습니다.")
    yield

# FastAPI 앱 인스턴스 생성
app = FastAPI(
    title="MonoDesk API",
    description="여남동 외식업 통합 관리 시스템 백엔드 API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 설정 (React 개발 서버 허용)
# 로컬 전용이므로 localhost만 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite 개발 서버
        "http://localhost:3000",   # CRA 개발 서버 (대비)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["대시보드"])
app.include_router(accounting.router, prefix="/api/accounting", tags=["세무/회계"])
app.include_router(sales_analysis.router, prefix="/api/sales-analysis", tags=["매출 분석"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["재고/발주"])
app.include_router(menu.router, prefix="/api/menu", tags=["메뉴 관리"])
app.include_router(employee.router, prefix="/api/employee", tags=["직원 관리"])
app.include_router(corporate.router, prefix="/api/corporate", tags=["법인 관리"])
app.include_router(operations.router, prefix="/api/operations", tags=["운영 관리"])



@app.get("/")
def root():
    """서버 상태 확인 엔드포인트"""
    return {
        "message": "MonoDesk API 서버가 실행 중입니다.",
        "version": "0.1.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    """헬스 체크 엔드포인트"""
    return {"status": "ok"}
