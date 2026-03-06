# ============================================================
# tests/test_accounting.py — 세무/회계 백엔드 pytest 테스트
# API 엔드포인트, 비즈니스 로직, 경계값을 검증합니다.
# ============================================================

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from database import Base, get_db
import models.accounting  # noqa: F401 — 모델 등록 강제
from main import app

# 테스트 전용 인메모리 SQLite DB 사용
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    """테스트용 DB 세션 오버라이드"""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# 테스트 클라이언트 설정
app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    """각 테스트 실행 전 테이블 생성, 후 삭제"""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def sample_category():
    """테스트용 지출 분류 생성 픽스처"""
    response = client.post("/api/accounting/categories", json={
        "name": "식재료비",
        "description": "수산물 원재료",
        "color": "#3B82F6"
    })
    assert response.status_code == 201
    return response.json()


# ─────────────────────────────────────────
# 지출 분류 API 테스트
# ─────────────────────────────────────────

class TestExpenseCategory:
    """지출 분류 CRUD 테스트"""

    def test_지출_분류_생성_성공(self):
        """정상적인 지출 분류 생성 테스트"""
        response = client.post("/api/accounting/categories", json={
            "name": "인건비",
            "description": "직원 급여",
            "color": "#8B5CF6"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "인건비"
        assert data["id"] is not None

    def test_지출_분류_목록_조회(self, sample_category):
        """지출 분류 목록 조회 테스트"""
        response = client.get("/api/accounting/categories")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["name"] == "식재료비"

    def test_지출_분류_삭제_소프트삭제(self, sample_category):
        """소프트 삭제 후 목록에서 제외 확인"""
        category_id = sample_category["id"]
        # 삭제 실행
        delete_response = client.delete(f"/api/accounting/categories/{category_id}")
        assert delete_response.status_code == 200
        # 목록 조회 시 삭제된 항목 없어야 함
        list_response = client.get("/api/accounting/categories")
        ids = [item["id"] for item in list_response.json()]
        assert category_id not in ids

    def test_존재하지_않는_분류_삭제(self):
        """존재하지 않는 분류 삭제 시 404 반환"""
        response = client.delete("/api/accounting/categories/99999")
        assert response.status_code == 404


# ─────────────────────────────────────────
# 지출 기록 API 테스트
# ─────────────────────────────────────────

class TestExpenseRecord:
    """지출 기록 CRUD 테스트"""

    def test_지출_기록_생성_성공(self, sample_category):
        """정상적인 지출 기록 생성 테스트"""
        response = client.post("/api/accounting/expenses", json={
            "expense_date": "2026-03-04",
            "category_id": sample_category["id"],
            "description": "활전복 50kg 구매",
            "vendor": "노량진수산시장",
            "amount": 500000,
            "vat": 50000,
            "payment_method": "카드"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["description"] == "활전복 50kg 구매"
        assert data["amount"] == 500000
        # 부가세 포함 합계 검증
        assert data["total_amount"] == 550000

    def test_지출_기록_금액_0원_불가(self, sample_category):
        """금액 0원 입력 시 유효성 오류 반환"""
        response = client.post("/api/accounting/expenses", json={
            "expense_date": "2026-03-04",
            "category_id": sample_category["id"],
            "description": "테스트",
            "amount": 0
        })
        assert response.status_code == 422

    def test_지출_기록_최대금액_초과(self, sample_category):
        """99,999,999원 초과 입력 시 유효성 오류 반환"""
        response = client.post("/api/accounting/expenses", json={
            "expense_date": "2026-03-04",
            "category_id": sample_category["id"],
            "description": "테스트",
            "amount": 100000000  # 1억 초과
        })
        assert response.status_code == 422

    def test_날짜_형식_오류(self, sample_category):
        """잘못된 날짜 형식 입력 시 유효성 오류 반환"""
        response = client.post("/api/accounting/expenses", json={
            "expense_date": "20260304",  # YYYYMMDD 형식은 불가
            "category_id": sample_category["id"],
            "description": "테스트",
            "amount": 10000
        })
        assert response.status_code == 422

    def test_월별_지출_조회(self, sample_category):
        """월별 지출 목록 조회 테스트"""
        # 3월 지출 생성
        client.post("/api/accounting/expenses", json={
            "expense_date": "2026-03-04",
            "category_id": sample_category["id"],
            "description": "3월 식재료",
            "amount": 300000
        })
        # 4월 지출 생성 (조회에서 제외되어야 함)
        client.post("/api/accounting/expenses", json={
            "expense_date": "2026-04-01",
            "category_id": sample_category["id"],
            "description": "4월 식재료",
            "amount": 400000
        })
        # 3월만 조회
        response = client.get("/api/accounting/expenses?year=2026&month=3")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["description"] == "3월 식재료"


# ─────────────────────────────────────────
# 손익 계산 테스트
# ─────────────────────────────────────────

class TestProfitLoss:
    """손익 계산 비즈니스 로직 테스트"""

    def test_매출_없을때_손익(self):
        """매출 데이터 없을 때 0 반환 확인"""
        response = client.get("/api/accounting/profit-loss?year=2026&month=3")
        assert response.status_code == 200
        data = response.json()
        assert data["total_sales"] == 0
        assert data["total_expense"] == 0
        assert data["gross_profit"] == 0

    def test_손익_계산_정확성(self, sample_category):
        """매출 - 지출 = 순이익 계산 정확성 테스트"""
        # 매출 입력
        client.post("/api/accounting/sales", json={
            "sales_date": "2026-03-04",
            "card_amount": 5000000,
            "cash_amount": 1000000,
            "delivery_amount": 500000
        })
        # 지출 입력
        client.post("/api/accounting/expenses", json={
            "expense_date": "2026-03-04",
            "category_id": sample_category["id"],
            "description": "식재료비",
            "amount": 2000000,
            "vat": 0
        })
        # 손익 계산 조회
        response = client.get("/api/accounting/profit-loss?year=2026&month=3")
        assert response.status_code == 200
        data = response.json()

        assert data["total_sales"] == 6500000   # 5000000 + 1000000 + 500000
        assert data["total_expense"] == 2000000
        assert data["gross_profit"] == 4500000  # 6500000 - 2000000
        assert data["profit_margin"] == 69.2    # 4500000 / 6500000 * 100
