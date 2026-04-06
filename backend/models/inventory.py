# ============================================================
# models/inventory.py — 재고/발주 SQLAlchemy 데이터 모델
# 재고 품목, 수량 조정 이력, 발주서, 발주 품목 테이블을 정의합니다.
# ============================================================

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
import datetime as dt_module

# InventorySnapshot 모델에서 UNIQUE 제약 조건을 위해 UniqueConstraint 임포트
from sqlalchemy import UniqueConstraint


class InventoryCategory(Base):
    """
    재고 품목 분류 테이블.
    수산물, 채소류, 주류, 소모품 등 카테고리를 관리합니다.
    """
    __tablename__ = "inventory_categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 분류명 (예: 수산물, 채소류, 주류, 소모품)
    name = Column(String(50), nullable=False, unique=True, comment="분류명")
    description = Column(String(200), nullable=True, comment="분류 설명")
    # UI 표시용 색상 코드
    color = Column(String(7), default="#64748B", comment="UI 표시 색상 (HEX)")
    # 소프트 삭제
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    # 재고 품목과의 관계
    items = relationship("InventoryItem", back_populates="category")

    def __repr__(self):
        return f"<InventoryCategory(id={self.id}, name={self.name})>"


class InventoryItem(Base):
    """
    재고 품목 테이블.
    매장에서 관리하는 식재료, 주류, 소모품 등의 품목 마스터 데이터입니다.
    """
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 품목명 (예: 킹크랩, 소주, 물티슈)
    name = Column(String(100), nullable=False, comment="품목명")
    # 분류 (외래키)
    category_id = Column(Integer, ForeignKey("inventory_categories.id"), nullable=False, comment="분류 ID")
    # 단위 (예: kg, 병, 박스, 개)
    unit = Column(String(20), nullable=False, default="개", comment="단위")
    # 현재 재고 수량
    current_quantity = Column(Float, default=0, comment="현재 재고 수량")
    # 최소 재고 임계값 (이 수량 이하로 떨어지면 발주 알림)
    min_quantity = Column(Float, default=0, comment="최소 재고 임계값 (발주 알림 기준)")
    # 기본 발주 수량 (발주서 자동 생성 시 사용)
    default_order_quantity = Column(Float, default=1, comment="기본 발주 수량")
    # 단가 (원가 계산용)
    unit_price = Column(Float, default=0, comment="단가 (원)")
    # 주 거래처명
    supplier = Column(String(100), nullable=True, comment="주 거래처명")
    # 데일리 단가 추적 대상 여부 (0: 미추적, 1: 추적)
    is_daily_price_tracked = Column(Integer, default=0, comment="데일리 단가 추적 여부 (0: 미추적, 1: 추적)")
    # 메모 (특이사항, 보관방법 등)
    memo = Column(Text, nullable=True, comment="메모")
    # 소프트 삭제
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    # 분류와의 관계
    category = relationship("InventoryCategory", back_populates="items")
    # 수량 조정 이력과의 관계
    adjustments = relationship("InventoryAdjustment", back_populates="item")
    # 발주 품목과의 관계
    order_items = relationship("PurchaseOrderItem", back_populates="item")
    # 데일리 단가 기록과의 관계
    daily_price_records = relationship("DailyPriceRecord", back_populates="item")

    @property
    def is_low_stock(self) -> bool:
        """재고 부족 여부 판단 (현재 수량이 최소 임계값 이하인지 확인)"""
        return self.current_quantity <= self.min_quantity

    @property
    def stock_status(self) -> str:
        """재고 상태 텍스트 반환"""
        if self.current_quantity <= 0:
            return "품절"
        elif self.current_quantity <= self.min_quantity:
            return "부족"
        else:
            return "정상"

    def __repr__(self):
        return f"<InventoryItem(id={self.id}, name={self.name}, qty={self.current_quantity})>"


class InventoryAdjustment(Base):
    """
    재고 수량 조정 이력 테이블.
    입고, 출고, 실사 조정 등 모든 재고 변동 내역을 기록합니다.
    """
    __tablename__ = "inventory_adjustments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 품목 (외래키)
    item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False, comment="품목 ID")
    # 조정 유형: 입고 / 출고 / 실사조정 / 폐기
    adjustment_type = Column(String(20), nullable=False, comment="조정 유형 (입고/출고/실사조정/폐기)")
    # 조정 수량 (양수: 증가, 음수: 감소)
    quantity_change = Column(Float, nullable=False, comment="수량 변동 (양수: 증가, 음수: 감소)")
    # 조정 전 수량
    quantity_before = Column(Float, nullable=False, comment="조정 전 수량")
    # 조정 후 수량
    quantity_after = Column(Float, nullable=False, comment="조정 후 수량")
    # 조정 날짜 (YYYY-MM-DD)
    adjustment_date = Column(String(10), nullable=False, index=True, comment="조정 날짜")
    # 연관 발주서 ID (입고인 경우)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=True, comment="연관 발주서 ID")
    # 단가 (입고 시 실제 매입가)
    unit_price = Column(Float, nullable=True, comment="단가 (원)")
    # 메모 (사유, 특이사항)
    memo = Column(Text, nullable=True, comment="메모")
    # 소프트 삭제
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    # 품목과의 관계
    item = relationship("InventoryItem", back_populates="adjustments")
    # 발주서와의 관계
    purchase_order = relationship("PurchaseOrder", back_populates="adjustments")

    def __repr__(self):
        return f"<InventoryAdjustment(id={self.id}, item_id={self.item_id}, change={self.quantity_change})>"


class PurchaseOrder(Base):
    """
    발주서 테이블.
    거래처에 발주하는 주문서를 관리합니다.
    """
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 발주 번호 (예: PO-20260306-001)
    order_number = Column(String(30), nullable=False, unique=True, comment="발주 번호")
    # 거래처명
    supplier = Column(String(100), nullable=False, comment="거래처명")
    # 발주 날짜 (YYYY-MM-DD)
    order_date = Column(String(10), nullable=False, index=True, comment="발주 날짜")
    # 예상 입고일 (YYYY-MM-DD)
    expected_date = Column(String(10), nullable=True, comment="예상 입고일")
    # 실제 입고일 (YYYY-MM-DD)
    received_date = Column(String(10), nullable=True, comment="실제 입고일")
    # 발주 상태: 발주중 / 입고완료 / 취소
    status = Column(String(20), nullable=False, default="발주중", comment="발주 상태 (발주중/입고완료/취소)")
    # 총 발주 금액 (발주 품목 합계)
    total_amount = Column(Float, default=0, comment="총 발주 금액 (원)")
    # 메모 (특이사항)
    memo = Column(Text, nullable=True, comment="메모")
    # 소프트 삭제
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    # 발주 품목과의 관계
    order_items = relationship("PurchaseOrderItem", back_populates="order", cascade="all, delete-orphan")
    # 수량 조정 이력과의 관계 (입고 처리 시)
    adjustments = relationship("InventoryAdjustment", back_populates="purchase_order")

    def __repr__(self):
        return f"<PurchaseOrder(id={self.id}, number={self.order_number}, status={self.status})>"


class PurchaseOrderItem(Base):
    """
    발주 품목 테이블.
    발주서에 포함된 개별 품목과 수량, 단가를 저장합니다.
    """
    __tablename__ = "purchase_order_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 발주서 (외래키)
    order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=False, comment="발주서 ID")
    # 품목 (외래키)
    item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False, comment="품목 ID")
    # 발주 수량
    quantity = Column(Float, nullable=False, comment="발주 수량")
    # 발주 단가
    unit_price = Column(Float, default=0, comment="발주 단가 (원)")
    # 입고 완료 수량 (실제 입고된 수량, 발주 수량과 다를 수 있음)
    received_quantity = Column(Float, default=0, comment="실제 입고 수량")
    # 메모
    memo = Column(Text, nullable=True, comment="메모")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    # 발주서와의 관계
    order = relationship("PurchaseOrder", back_populates="order_items")
    # 품목과의 관계
    item = relationship("InventoryItem", back_populates="order_items")

    @property
    def subtotal(self) -> float:
        """품목 소계 (수량 × 단가)"""
        return self.quantity * (self.unit_price or 0)

    def __repr__(self):
        return f"<PurchaseOrderItem(id={self.id}, order_id={self.order_id}, item_id={self.item_id})>"


class DailyPriceRecord(Base):
    """
    데일리 단가 기록 테이블.
    수산물 등 시가 품목의 일별 매입 단가와 수량을 추적합니다.
    """
    __tablename__ = "daily_price_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 품목 (외래키)
    item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False, comment="품목 ID")
    # 기록 날짜 (YYYY-MM-DD)
    record_date = Column(String(10), nullable=False, index=True, comment="기록 날짜")
    # 당일 구매 수량
    quantity = Column(Float, default=0, comment="당일 구매 수량")
    # 당일 매입 단가 (원)
    unit_price = Column(Integer, default=0, comment="당일 매입 단가 (원)")
    # 당일 금액 (quantity × unit_price, 서비스 레이어에서 자동 계산)
    amount = Column(Integer, default=0, comment="당일 금액 (원)")
    # 당일 구매처
    vendor = Column(String(100), nullable=True, comment="당일 구매처")
    # 메모
    memo = Column(Text, nullable=True, comment="메모")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    # 품목과의 관계
    item = relationship("InventoryItem", back_populates="daily_price_records")

    def __repr__(self):
        return f"<DailyPriceRecord(id={self.id}, item_id={self.item_id}, date={self.record_date}, price={self.unit_price})>"


class InventorySnapshot(Base):
    """
    월초/월말 재고 스냅샷 테이블.
    월말 재고를 확정하면 다음달 월초재고로 자동 이월됩니다.
    엑셀 8-1.월초재고 / 8-2.월말재고 시트에 해당합니다.
    """
    __tablename__ = "inventory_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 스냅샷 유형: month_start(월초) | month_end(월말)
    snapshot_type = Column(String(20), nullable=False, comment="스냅샷 유형 (month_start/month_end)")
    # 연도 (예: 2026)
    year = Column(Integer, nullable=False, comment="연도")
    # 월 (1~12)
    month = Column(Integer, nullable=False, comment="월")
    # 품목 (외래키 → inventory_items.id)
    item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False, comment="품목 ID")
    # 재고 수량 (소수점 허용: 0.5kg 등)
    quantity = Column(Float, default=0, comment="재고 수량")
    # 매입 단가 (원)
    unit_price = Column(Integer, default=0, comment="매입 단가 (원)")
    # 금액 = quantity × unit_price, 저장 시 자동 계산
    amount = Column(Integer, default=0, comment="금액 (원)")
    # 확정 여부 (0: 미확정, 1: 확정) — 확정 후 수정 불가
    is_confirmed = Column(Integer, default=0, comment="확정 여부 (0: 미확정, 1: 확정)")
    # 확정 처리 일시
    confirmed_at = Column(DateTime, nullable=True, comment="확정 일시")
    # 메모 (이월 출처 등)
    memo = Column(Text, nullable=True, comment="메모")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")

    # 품목과의 관계 (스냅샷 → 품목 조회용)
    item = relationship("InventoryItem")

    def __repr__(self):
        return f"<InventorySnapshot(id={self.id}, type={self.snapshot_type}, {self.year}-{self.month:02d}, item_id={self.item_id})>"
