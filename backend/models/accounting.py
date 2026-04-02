# ============================================================
# models/accounting.py — 세무/회계 SQLAlchemy 데이터 모델
# 지출 분류, 지출 기록, 매출 기록 테이블을 정의합니다.
# ============================================================

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean, func
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class ExpenseCategory(Base):
    """
    지출 분류 테이블.
    식재료비, 인건비, 임대료 등 지출 카테고리를 관리합니다.
    """
    __tablename__ = "expense_categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True, comment="분류명")
    description = Column(String(200), nullable=True, comment="분류 설명")
    color = Column(String(7), default="#64748B", comment="UI 표시 색상 (HEX)")
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    # 지출 기록과의 관계
    expense_records = relationship("ExpenseRecord", back_populates="category")

    def __repr__(self):
        return f"<ExpenseCategory(id={self.id}, name={self.name})>"


class ExpenseRecord(Base):
    """
    지출 기록 테이블.
    매일 발생하는 지출 내역을 저장합니다.
    """
    __tablename__ = "expense_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 지출 날짜 (YYYY-MM-DD)
    expense_date = Column(String(10), nullable=False, index=True, comment="지출 날짜")
    # 지출 분류 (외래키)
    category_id = Column(Integer, ForeignKey("expense_categories.id"), nullable=False, comment="지출 분류 ID")
    # 거래처명
    vendor = Column(String(100), nullable=True, comment="거래처명")
    # 지출 항목 설명
    description = Column(String(200), nullable=False, comment="지출 내용")
    # 공급가액 (부가세 별도 시 부가세 제외 금액)
    amount = Column(Float, nullable=False, comment="공급가액 (원)")
    # 부가세 금액
    vat = Column(Float, default=0, comment="부가세 (원)")
    # 결제 수단
    payment_method = Column(String(20), default="카드", comment="결제 수단 (카드/현금/계좌이체)")
    # 메모
    memo = Column(Text, nullable=True, comment="메모")
    # 영수증 이미지 경로
    receipt_image_path = Column(String(500), nullable=True, comment="영수증 이미지 파일 경로")
    # 세금계산서 수취 여부
    tax_invoice = Column(Boolean, default=False, comment="세금계산서 수취 여부")
    # 소프트 삭제
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    # 지출 분류와의 관계
    category = relationship("ExpenseCategory", back_populates="expense_records")

    @property
    def total_amount(self) -> float:
        """부가세 포함 총 금액 계산"""
        return self.amount + (self.vat or 0)

    def __repr__(self):
        return f"<ExpenseRecord(id={self.id}, date={self.expense_date}, amount={self.amount})>"


class SalesRecord(Base):
    """
    매출 기록 테이블.
    POS 연동 또는 수동 입력으로 매출을 저장합니다.
    """
    __tablename__ = "sales_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 매출 날짜 (YYYY-MM-DD)
    sales_date = Column(String(10), nullable=False, index=True, comment="매출 날짜")
    # 현금 매출
    cash_amount = Column(Float, default=0, comment="현금 매출 (원)")
    # 카드 매출
    card_amount = Column(Float, default=0, comment="카드 매출 (원)")
    # 배달앱 매출 (배달의민족, 쿠팡이츠 등)
    delivery_amount = Column(Float, default=0, comment="배달앱 매출 (원)")
    # 메모
    memo = Column(Text, nullable=True, comment="메모 (특이사항)")
    # 현금영수증 금액 (원)
    cash_receipt_amount = Column(Float, default=0, comment="현금영수증 금액 (원)")
    # 할인액 (원)
    discount_amount = Column(Float, default=0, comment="할인액 (원)")
    # 서비스액 (원)
    service_amount = Column(Float, default=0, comment="서비스액 (원)")
    # 영수건수 (영수증 발행 건수)
    receipt_count = Column(Integer, default=0, comment="영수건수")
    # 방문 고객 수
    customer_count = Column(Integer, default=0, comment="고객수")
    # 계좌이체 건수
    transfer_count = Column(Integer, default=0, comment="계좌이체 건수")
    # 계좌이체 금액 (원)
    transfer_amount = Column(Float, default=0, comment="계좌이체 금액 (원)")
    # 캐치테이블 영수건수
    catchtable_count = Column(Integer, default=0, comment="캐치테이블 영수건수")
    # 캐치테이블 이체금액 (원)
    catchtable_amount = Column(Float, default=0, comment="캐치테이블 이체금액 (원)")
    # 카드취소 건수
    card_cancel_count = Column(Integer, default=0, comment="카드취소 건수")
    # 카드취소 금액 (원)
    card_cancel_amount = Column(Float, default=0, comment="카드취소 금액 (원)")
    # 카드취소 사유
    card_cancel_reason = Column(Text, nullable=True, comment="카드취소 사유")
    # 카드수수료 예상 (원, 카드매출 × 1.92%)
    card_fee_estimated = Column(Float, default=0, comment="카드수수료 예상 (원)")
    # 배달수수료 예상 (원, 배달매출 × 21.3%)
    delivery_fee_estimated = Column(Float, default=0, comment="배달수수료 예상 (원)")
    # 품목별 매출: 메뉴 (원)
    sales_menu = Column(Float, default=0, comment="메뉴 매출 (원)")
    # 품목별 매출: 기타메뉴 (원)
    sales_other_menu = Column(Float, default=0, comment="기타메뉴 매출 (원)")
    # 품목별 매출: 포장 (원)
    sales_takeout = Column(Float, default=0, comment="포장 매출 (원)")
    # 품목별 매출: 주류 (원)
    sales_liquor = Column(Float, default=0, comment="주류 매출 (원)")
    # 품목별 매출: 기타주류 (원)
    sales_other_liquor = Column(Float, default=0, comment="기타주류 매출 (원)")
    # 품목별 매출: 기타 (원)
    sales_etc = Column(Float, default=0, comment="기타 매출 (원)")
    # 특이사항 메모
    special_note = Column(Text, nullable=True, comment="특이사항")
    # POS 연동 여부 (True: POS 자동 연동, False: 수동 입력)
    is_pos_synced = Column(Integer, default=0, comment="POS 연동 여부 (0: 수동, 1: 자동)")
    # 소프트 삭제
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    @property
    def total_sales(self) -> float:
        """
        순매출 계산.
        카드 + 현금 + 현금영수증 + 배달 + 계좌이체 + 캐치테이블 - 할인 - 서비스
        """
        return (
            (self.cash_amount or 0)
            + (self.card_amount or 0)
            + (self.delivery_amount or 0)
            + (self.cash_receipt_amount or 0)
            + (self.transfer_amount or 0)
            + (self.catchtable_amount or 0)
            - (self.discount_amount or 0)
            - (self.service_amount or 0)
        )

    def __repr__(self):
        return f"<SalesRecord(id={self.id}, date={self.sales_date}, total={self.total_sales})>"
