# ============================================================
# schemas/menu.py — 메뉴 관리 Pydantic V2 스키마
# API 요청/응답 데이터 유효성 검사 및 직렬화를 담당합니다.
# ============================================================

from pydantic import BaseModel, field_validator, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


# ─────────────────────────────────────────
# 메뉴 카테고리 (MenuCategory) 스키마
# ─────────────────────────────────────────

class MenuCategoryBase(BaseModel):
    """메뉴 카테고리 공통 필드"""
    name: str = Field(..., min_length=1, max_length=50, description="카테고리명")
    description: Optional[str] = Field(None, max_length=200, description="카테고리 설명")
    color: Optional[str] = Field("#64748B", description="UI 색상 (HEX)")
    sort_order: Optional[int] = Field(0, ge=0, description="정렬 순서")


class MenuCategoryCreate(MenuCategoryBase):
    """메뉴 카테고리 생성 요청 스키마"""
    pass


class MenuCategoryUpdate(BaseModel):
    """메뉴 카테고리 수정 요청 스키마 (부분 수정 허용)"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = Field(None, ge=0)


class MenuCategoryResponse(MenuCategoryBase):
    """메뉴 카테고리 응답 스키마"""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 메뉴 구성 재료 (MenuIngredient) 스키마
# ─────────────────────────────────────────

class MenuIngredientBase(BaseModel):
    """메뉴 구성 재료 공통 필드"""
    ingredient_name: str = Field(..., min_length=1, max_length=100, description="재료명")
    inventory_item_id: Optional[int] = Field(None, gt=0, description="재고 품목 ID (선택)")
    quantity: float = Field(..., gt=0, description="사용 수량")
    unit: str = Field("g", max_length=20, description="단위 (g, ml, 개 등)")
    unit_price: float = Field(0, ge=0, description="단가 (원/단위)")


class MenuIngredientCreate(MenuIngredientBase):
    """메뉴 구성 재료 생성 요청 스키마"""
    pass


class MenuIngredientUpdate(BaseModel):
    """메뉴 구성 재료 수정 요청 스키마 (부분 수정 허용)"""
    ingredient_name: Optional[str] = Field(None, min_length=1, max_length=100)
    inventory_item_id: Optional[int] = Field(None, gt=0)
    quantity: Optional[float] = Field(None, gt=0)
    unit: Optional[str] = Field(None, max_length=20)
    unit_price: Optional[float] = Field(None, ge=0)


class MenuIngredientResponse(MenuIngredientBase):
    """메뉴 구성 재료 응답 스키마"""
    id: int
    menu_item_id: int
    # 재료 소계 (수량 × 단가) — 모델 property에서 계산
    subtotal: float
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 메뉴 아이템 (MenuItem) 스키마
# ─────────────────────────────────────────

class MenuItemBase(BaseModel):
    """메뉴 아이템 공통 필드"""
    name: str = Field(..., min_length=1, max_length=100, description="메뉴명")
    category_id: int = Field(..., gt=0, description="카테고리 ID")
    price: float = Field(..., gt=0, description="판매가 (원)")
    cost: Optional[float] = Field(0, ge=0, description="원가 (원)")
    description: Optional[str] = Field(None, description="메뉴 설명")
    allergens: Optional[str] = Field(None, max_length=200, description="알레르기 정보")
    is_active: Optional[int] = Field(1, ge=0, le=1, description="판매 여부 (1: 판매중, 0: 중지)")
    is_featured: Optional[int] = Field(0, ge=0, le=1, description="대표 메뉴 여부")

    @field_validator("price")
    @classmethod
    def validate_price(cls, v):
        """판매가는 100원 이상이어야 합니다."""
        if v < 100:
            raise ValueError("판매가는 100원 이상이어야 합니다.")
        return v


class MenuItemCreate(MenuItemBase):
    """
    메뉴 아이템 생성 요청 스키마.
    구성 재료 목록을 함께 전달할 수 있습니다.
    """
    ingredients: Optional[List[MenuIngredientCreate]] = Field(
        default=[], description="구성 재료 목록 (선택)"
    )


class MenuItemUpdate(BaseModel):
    """메뉴 아이템 수정 요청 스키마 (부분 수정 허용)"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category_id: Optional[int] = Field(None, gt=0)
    price: Optional[float] = Field(None, gt=0)
    cost: Optional[float] = Field(None, ge=0)
    description: Optional[str] = None
    allergens: Optional[str] = None
    is_active: Optional[int] = Field(None, ge=0, le=1)
    is_featured: Optional[int] = Field(None, ge=0, le=1)

    @field_validator("price")
    @classmethod
    def validate_price(cls, v):
        """수정 시 판매가 최소값 검증"""
        if v is not None and v < 100:
            raise ValueError("판매가는 100원 이상이어야 합니다.")
        return v


class MenuItemResponse(MenuItemBase):
    """
    메뉴 아이템 응답 스키마.
    원가율, 마진 등 계산 필드를 포함합니다.
    """
    id: int
    # 원가율 (%) — 원가 ÷ 판매가 × 100
    cost_ratio: float
    # 마진 금액 (원)
    margin: float
    # 마진율 (%)
    margin_ratio: float
    # 카테고리 정보
    category: Optional[MenuCategoryResponse] = None
    # 구성 재료 목록
    ingredients: List[MenuIngredientResponse] = []
    image_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────
# 메뉴 통계 / 요약 스키마
# ─────────────────────────────────────────

class MenuStatsResponse(BaseModel):
    """
    메뉴 현황 통계 응답 스키마.
    카테고리별 메뉴 수, 평균 원가율, 판매중 메뉴 수 등을 반환합니다.
    """
    # 전체 메뉴 수 (삭제 제외)
    total_items: int
    # 판매 중인 메뉴 수
    active_items: int
    # 판매 중지 메뉴 수
    inactive_items: int
    # 대표 메뉴 수
    featured_items: int
    # 전체 평균 원가율 (%)
    avg_cost_ratio: float
    # 카테고리별 통계
    by_category: List[dict]
    # 원가율 경고 메뉴 목록 (원가율 70% 초과)
    high_cost_ratio_items: List[dict]


class MenuCostAnalysisResponse(BaseModel):
    """
    메뉴 원가 분석 응답 스키마.
    원가율 구간별 메뉴 분포와 개선 필요 메뉴를 반환합니다.
    """
    # 원가율 구간별 메뉴 수 (0-30%, 30-50%, 50-70%, 70%+)
    cost_ratio_distribution: List[dict]
    # 원가율 낮은 순 상위 10개 (고마진 메뉴)
    top_margin_items: List[dict]
    # 원가율 높은 순 상위 10개 (저마진 / 개선 필요)
    high_cost_items: List[dict]
    # 평균 원가율
    avg_cost_ratio: float
    # 가중 평균 원가율 (판매가 기준)
    weighted_avg_cost_ratio: float
