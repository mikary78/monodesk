# ============================================================
# models/document.py — 문서 관리 SQLAlchemy 모델
# 지결서(지출결의서), 회의록 등 법인 내부 문서를 저장합니다.
# ============================================================

from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime
from database import Base


class Document(Base):
    """문서 관리 — 지결서, 회의록 등 법인 내부 문서"""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 문서 공통 식별 정보
    doc_number = Column(String(30), unique=True, nullable=False, comment="문서번호 (예: 지결-2026-001)")
    doc_type   = Column(String(20), nullable=False, comment="지결서|회의록")
    title      = Column(String(200), nullable=False, comment="문서 제목")
    author     = Column(String(50), nullable=False, comment="작성자")
    doc_date   = Column(String(10), nullable=False, comment="문서 일자 YYYY-MM-DD")
    status     = Column(String(20), default="기안", comment="기안|확정")
    content    = Column(Text, nullable=True, comment="본문 내용")

    # ── 지결서 전용 필드 ──
    expense_amount   = Column(Integer, nullable=True, comment="지출 금액 (지결서용)")
    expense_category = Column(String(50), nullable=True, comment="지출 분류 (지결서용)")
    expense_vendor   = Column(String(100), nullable=True, comment="거래처 (지결서용)")
    payment_method   = Column(String(30), nullable=True, comment="지급 방법 (지결서용)")

    # ── 회의록 전용 필드 ──
    meeting_location = Column(String(100), nullable=True, comment="회의 장소 (회의록용)")
    attendees        = Column(Text, nullable=True, comment="참석자 목록 (줄바꿈 구분, 회의록용)")
    agenda           = Column(Text, nullable=True, comment="안건 (회의록용)")
    decisions        = Column(Text, nullable=True, comment="결정 사항 (회의록용)")

    # ── 공통 메타 ──
    tags       = Column(String(200), nullable=True, comment="태그 (콤마 구분)")
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")
    created_at = Column(DateTime, default=datetime.utcnow, comment="생성 일시")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="수정 일시")
