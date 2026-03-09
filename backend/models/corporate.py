# ============================================================
# models/corporate.py — 법인 관리 SQLAlchemy 데이터 모델
# 동업자 정보, 배당 기록, 법인 비용 테이블을 정의합니다.
# 법인명: MonoBound / 매장명: 여남동 (용산 삼각지 제철해산물 주점)
# ============================================================

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, UniqueConstraint
from sqlalchemy.sql import func
from database import Base


class Partner(Base):
    """
    동업자 정보 테이블.
    MonoBound 법인의 동업자 4명 (29/29/29/13%) 정보를 관리합니다.
    """
    __tablename__ = "partners"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 동업자 이름
    name = Column(String(50), nullable=False, comment="동업자 이름")

    # 지분율 (%) — 4명 합계 100%
    equity_ratio = Column(Float, nullable=False, comment="지분율 (%)")

    # 연락처
    phone = Column(String(20), nullable=True, comment="연락처")

    # 이메일
    email = Column(String(100), nullable=True, comment="이메일")

    # 은행명
    bank_name = Column(String(30), nullable=True, comment="은행명")

    # 계좌번호 (배당금 이체용) — 로그 출력 금지 대상
    bank_account = Column(String(100), nullable=True, comment="배당금 이체 계좌")

    # 역할 (예: 대표이사, 이사, 감사)
    role = Column(String(50), nullable=True, default="이사", comment="법인 내 역할")

    # 출자금 (원, 초기 투자금)
    investment_amount = Column(Float, default=0, comment="출자금 (원)")

    # 메모
    memo = Column(Text, nullable=True, comment="비고/메모")

    # 소프트 삭제
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")

    created_at = Column(DateTime, default=func.now(), comment="생성일시")
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), comment="수정일시")

    def __repr__(self):
        return f"<Partner(id={self.id}, name={self.name}, equity={self.equity_ratio}%)>"


class DividendRecord(Base):
    """
    배당 정산 기록 테이블.
    연도별 순이익 기반 배당금을 계산하고 기록합니다.
    동업자별로 지분율에 따라 배당금이 자동 산정됩니다.
    """
    __tablename__ = "dividend_records"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 정산 연도
    year = Column(Integer, nullable=False, comment="정산 연도")

    # 동업자 ID (직접 저장, 삭제 시에도 이력 보존)
    partner_id = Column(Integer, nullable=False, comment="동업자 ID")

    # 동업자 이름 스냅샷 (이력 보존용)
    partner_name = Column(String(50), nullable=False, comment="동업자 이름 (스냅샷)")

    # 지분율 스냅샷 (정산 시점 지분율 이력 보존)
    equity_ratio_snapshot = Column(Float, nullable=False, comment="정산 시점 지분율 (%)")

    # 연간 순이익 (정산 기준 금액)
    annual_net_profit = Column(Float, default=0, comment="연간 순이익 (원)")

    # 배당 대상 금액 (순이익 중 배당 비율 적용 후)
    distributable_amount = Column(Float, default=0, comment="배당 대상 금액 (원)")

    # 배당금 (배당 대상 금액 × 지분율)
    dividend_amount = Column(Float, default=0, comment="배당금 (원)")

    # 지급 완료 여부
    is_paid = Column(Integer, default=0, comment="지급 완료 여부 (0: 미지급, 1: 지급 완료)")

    # 지급일 (YYYY-MM-DD)
    paid_date = Column(String(10), nullable=True, comment="지급일")

    # 메모
    memo = Column(Text, nullable=True, comment="메모")

    # 소프트 삭제
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")

    created_at = Column(DateTime, default=func.now(), comment="생성일시")
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), comment="수정일시")

    # 연도+동업자 고유 제약 (동일 연도에 동일 동업자 배당은 1건)
    __table_args__ = (
        UniqueConstraint("year", "partner_id", name="uq_dividend_year_partner"),
    )

    def __repr__(self):
        return f"<DividendRecord(id={self.id}, year={self.year}, partner={self.partner_name})>"


class CorporateExpense(Base):
    """
    법인 비용 테이블.
    매장 운영비와 별도로 법인 차원에서 발생하는 비용을 관리합니다.
    예: 세무사비, 법인 보험료, 특허/상표 등록비, 법인 통장 유지비 등
    """
    __tablename__ = "corporate_expenses"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 비용 발생 연도
    year = Column(Integer, nullable=False, comment="발생 연도")

    # 비용 발생 월
    month = Column(Integer, nullable=False, comment="발생 월")

    # 비용 날짜 (YYYY-MM-DD)
    expense_date = Column(String(10), nullable=False, index=True, comment="비용 발생 날짜")

    # 비용 분류
    # 예: 세무사비, 법인보험료, 법인등기비, 상표등록비, 법인통신비, 기타
    category = Column(String(50), nullable=False, comment="비용 분류")

    # 비용 항목 설명
    description = Column(String(200), nullable=False, comment="비용 내용")

    # 거래처
    vendor = Column(String(100), nullable=True, comment="거래처명")

    # 금액 (원)
    amount = Column(Float, nullable=False, comment="금액 (원)")

    # 결제 수단
    payment_method = Column(String(20), default="계좌이체", comment="결제 수단 (카드/현금/계좌이체)")

    # 반복 비용 여부 (매월 고정 비용이면 True)
    is_recurring = Column(Integer, default=0, comment="반복 비용 여부 (0: 일회성, 1: 반복)")

    # 메모
    memo = Column(Text, nullable=True, comment="메모")

    # 소프트 삭제
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")

    created_at = Column(DateTime, default=func.now(), comment="생성일시")
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), comment="수정일시")

    def __repr__(self):
        return f"<CorporateExpense(id={self.id}, date={self.expense_date}, amount={self.amount})>"
