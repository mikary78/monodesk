# ============================================================
# models/sales_analysis.py — 매출 분석 SQLAlchemy 데이터 모델
# POS 원본 데이터, 메뉴 마스터, 가져오기 이력 테이블을 정의합니다.
# ============================================================

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean
from datetime import datetime
from database import Base


class PosImport(Base):
    """
    POS 파일 가져오기 이력 테이블.
    동일 파일 중복 가져오기를 방지하기 위해 파일 해시를 저장합니다.
    """
    __tablename__ = "pos_imports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 파일명 (원본)
    file_name = Column(String(255), nullable=False, comment="원본 파일명")
    # 파일 해시 (SHA256, 중복 감지용)
    file_hash = Column(String(64), nullable=False, unique=True, comment="SHA256 파일 해시")
    # 가져온 행 수
    row_count = Column(Integer, default=0, comment="파싱된 데이터 행 수")
    # 가져오기 상태 (success / failed / partial)
    status = Column(String(20), default="success", comment="가져오기 상태")
    # 오류 메시지 (실패 시)
    error_message = Column(Text, nullable=True, comment="오류 메시지")
    # 데이터 시작일 / 종료일
    date_from = Column(String(10), nullable=True, comment="데이터 시작일 (YYYY-MM-DD)")
    date_to = Column(String(10), nullable=True, comment="데이터 종료일 (YYYY-MM-DD)")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    def __repr__(self):
        return f"<PosImport(id={self.id}, file={self.file_name}, rows={self.row_count})>"


class PosSalesRaw(Base):
    """
    POS 원본 판매 데이터 테이블.
    CSV/Excel에서 가져온 개별 주문 행을 저장합니다.
    """
    __tablename__ = "pos_sales_raw"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 연결된 가져오기 이력 ID (참조용, 외래키 제약 없음 - 단순성 유지)
    import_id = Column(Integer, nullable=False, index=True, comment="가져오기 이력 ID")
    # 판매 날짜 (YYYY-MM-DD)
    sale_date = Column(String(10), nullable=False, index=True, comment="판매 날짜")
    # 판매 시간 (HH:MM)
    sale_time = Column(String(5), nullable=True, comment="판매 시간 (HH:MM)")
    # 요일 (0=월요일 ~ 6=일요일)
    weekday = Column(Integer, nullable=True, comment="요일 (0=월요일, 6=일요일)")
    # 시간대 (0~23)
    hour = Column(Integer, nullable=True, comment="시간대 (0~23)")
    # 메뉴명
    menu_name = Column(String(200), nullable=False, comment="메뉴명")
    # 메뉴 카테고리 (POS 제공 또는 자동 분류)
    menu_category = Column(String(100), nullable=True, comment="메뉴 카테고리")
    # 판매 수량
    quantity = Column(Integer, default=1, comment="판매 수량")
    # 단가
    unit_price = Column(Float, default=0, comment="단가 (원)")
    # 총 금액 (단가 × 수량)
    total_price = Column(Float, default=0, comment="총 금액 (원)")
    # 결제 수단 (카드 / 현금 / 네이버페이 / 카카오페이 / 기타)
    payment_method = Column(String(50), nullable=True, comment="결제 수단")
    # 주문 번호 (POS 원본)
    order_no = Column(String(100), nullable=True, comment="POS 주문 번호")
    # 취소 여부
    is_cancelled = Column(Boolean, default=False, comment="취소 여부")
    # 소프트 삭제
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    def __repr__(self):
        return f"<PosSalesRaw(id={self.id}, date={self.sale_date}, menu={self.menu_name}, price={self.total_price})>"


class PosMenuItem(Base):
    """
    POS 메뉴 마스터 테이블.
    POS 데이터에서 자동 생성되거나 수동으로 등록한 메뉴 정보입니다.
    menu.py의 MenuItem(메뉴 관리 모듈)과 구분하기 위해 별도 테이블로 분리합니다.
    """
    __tablename__ = "pos_menu_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 메뉴명 (고유)
    name = Column(String(200), nullable=False, unique=True, comment="메뉴명")
    # 카테고리 (주류 / 해산물 / 안주 / 음료 / 기타)
    category = Column(String(100), default="기타", comment="메뉴 카테고리")
    # 판매 단가
    price = Column(Float, default=0, comment="판매 단가 (원)")
    # 원가 (마진율 계산용)
    cost = Column(Float, default=0, comment="원가 (원)")
    # 계절 메뉴 여부
    is_seasonal = Column(Boolean, default=False, comment="계절 메뉴 여부")
    # 활성 여부 (단종된 메뉴 비활성화)
    is_active = Column(Boolean, default=True, comment="활성 메뉴 여부")
    # 소프트 삭제
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    @property
    def margin_rate(self) -> float:
        """마진율 계산 (마진 ÷ 판매가 × 100)"""
        if self.price <= 0:
            return 0.0
        return round((self.price - self.cost) / self.price * 100, 1)

    def __repr__(self):
        return f"<MenuItem(id={self.id}, name={self.name}, price={self.price})>"


class SalesTarget(Base):
    """
    월별 매출 목표 테이블.
    목표 대비 달성률 계산에 사용합니다.
    """
    __tablename__ = "sales_targets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 연도
    year = Column(Integer, nullable=False, comment="연도")
    # 월
    month = Column(Integer, nullable=False, comment="월 (1~12)")
    # 목표 매출액
    target_amount = Column(Float, nullable=False, comment="목표 매출액 (원)")
    # 메모
    memo = Column(String(200), nullable=True, comment="메모")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정일시")

    def __repr__(self):
        return f"<SalesTarget(year={self.year}, month={self.month}, target={self.target_amount})>"
