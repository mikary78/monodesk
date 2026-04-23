# ============================================================
# models/menu.py — 메뉴 관리 SQLAlchemy 데이터 모델
# 메뉴 카테고리, 메뉴 아이템, 메뉴 구성 재료 테이블을 정의합니다.
# ============================================================

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class MenuCategory(Base):
    """
    메뉴 카테고리 테이블.
    해산물 요리, 주류, 안주류 등 메뉴 분류를 관리합니다.
    """
    __tablename__ = "menu_categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 카테고리명 (예: 해산물 요리, 주류, 안주류)
    name = Column(String(50), nullable=False, unique=True, comment="카테고리명")
    # 카테고리 설명
    description = Column(String(200), nullable=True, comment="카테고리 설명")
    # UI 표시 색상
    color = Column(String(7), default="#64748B", comment="UI 표시 색상 (HEX)")
    # 정렬 순서 (낮을수록 먼저 표시)
    sort_order = Column(Integer, default=0, comment="정렬 순서")
    # 소프트 삭제 (0: 정상, 1: 삭제)
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    # 메뉴 아이템과의 관계
    menu_items = relationship("MenuItem", back_populates="category")

    def __repr__(self):
        return f"<MenuCategory(id={self.id}, name={self.name})>"


class MenuItem(Base):
    """
    메뉴 아이템 테이블.
    판매 메뉴의 가격, 원가, 마진율 등을 관리합니다.
    """
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 메뉴명 (예: 광어회, 소주, 해물파전)
    name = Column(String(100), nullable=False, comment="메뉴명")
    # 카테고리 (외래키)
    category_id = Column(Integer, ForeignKey("menu_categories.id"), nullable=False, comment="카테고리 ID")
    # 판매가 (원)
    price = Column(Float, nullable=False, comment="판매가 (원)")
    # 원가 (직접 입력 또는 구성 재료에서 자동 계산)
    cost = Column(Float, default=0, comment="원가 (원)")
    # 메뉴 설명
    description = Column(Text, nullable=True, comment="메뉴 설명")
    # 알레르기 정보
    allergens = Column(String(200), nullable=True, comment="알레르기 정보")
    # 메뉴 이미지 경로
    image_path = Column(String(500), nullable=True, comment="메뉴 이미지 경로")
    # 판매 여부 (활성/비활성)
    is_active = Column(Integer, default=1, comment="판매 여부 (1: 판매중, 0: 판매중지)")
    # 대표 메뉴 여부 (메인 화면 강조 표시)
    is_featured = Column(Integer, default=0, comment="대표 메뉴 여부 (0: 일반, 1: 대표)")
    # 소프트 삭제 (0: 정상, 1: 삭제)
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    # 카테고리와의 관계
    category = relationship("MenuCategory", back_populates="menu_items")
    # 구성 재료와의 관계
    ingredients = relationship("MenuIngredient", back_populates="menu_item", cascade="all, delete-orphan")

    @property
    def cost_ratio(self) -> float:
        """
        원가율 계산 (원가 ÷ 판매가 × 100).
        판매가가 0이면 0 반환.
        """
        if self.price and self.price > 0:
            return round((self.cost or 0) / self.price * 100, 1)
        return 0.0

    @property
    def margin(self) -> float:
        """마진 금액 계산 (판매가 - 원가)"""
        return (self.price or 0) - (self.cost or 0)

    @property
    def margin_ratio(self) -> float:
        """
        마진율 계산 (마진 ÷ 판매가 × 100).
        원가율의 반대값.
        """
        if self.price and self.price > 0:
            return round(self.margin / self.price * 100, 1)
        return 0.0

    def __repr__(self):
        return f"<MenuItem(id={self.id}, name={self.name}, price={self.price})>"


class MenuIngredient(Base):
    """
    메뉴 구성 재료 테이블.
    메뉴 1개를 만들기 위한 재료별 소요량을 정의합니다.
    재고 품목(InventoryItem)과 연동하여 원가를 자동 계산할 수 있습니다.
    """
    __tablename__ = "menu_ingredients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 메뉴 아이템 (외래키)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False, comment="메뉴 ID")
    # 재료명 (직접 입력 또는 재고 품목 이름)
    ingredient_name = Column(String(100), nullable=False, comment="재료명")
    # 재고 품목 연동 ID (선택 사항 — 재고 모듈과 연결 시 사용)
    # ondelete="SET NULL": 재고 품목 삭제 시 레시피 재료는 유지하되 연결만 해제
    inventory_item_id = Column(
        Integer,
        ForeignKey("inventory_items.id", ondelete="SET NULL"),
        nullable=True,
        comment="재고 품목 ID (선택)"
    )
    # 재료 구분: 원재료 / 부재료 / 양념 / 소스 / 기타
    ingredient_type = Column(String(20), default="원재료", comment="재료 구분")
    # 사용 수량
    quantity = Column(Float, nullable=False, comment="사용 수량")
    # 단위 (g, ml, 개 등)
    unit = Column(String(20), default="g", comment="단위")
    # 단가 (원/단위) — 재고 연동 시 자동 계산, 미연동 시 직접 입력
    unit_price = Column(Float, default=0, comment="단가 (원/단위)")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    # 메뉴 아이템과의 관계
    menu_item = relationship("MenuItem", back_populates="ingredients")

    @property
    def subtotal(self) -> float:
        """재료 소계 계산 (수량 × 단가)"""
        return round((self.quantity or 0) * (self.unit_price or 0), 2)

    def __repr__(self):
        return f"<MenuIngredient(menu_id={self.menu_item_id}, name={self.ingredient_name})>"
