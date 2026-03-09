# ============================================================
# models/operations.py — 운영 관리 SQLAlchemy 데이터 모델
# 공지사항, 위생점검, 영업일 관리, 업무 체크리스트 테이블 정의
# ============================================================

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Notice(Base):
    """
    공지사항 테이블.
    직원 공지, 업무 메모, 중요 안내 등을 관리합니다.
    """
    __tablename__ = "notices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 공지 제목
    title = Column(String(200), nullable=False, comment="공지 제목")
    # 공지 본문
    content = Column(Text, nullable=False, comment="공지 내용")
    # 공지 분류: notice(공지), memo(메모), urgent(긴급)
    notice_type = Column(String(20), default="notice", comment="공지 유형 (notice/memo/urgent)")
    # 고정 공지 여부 (상단 고정)
    is_pinned = Column(Integer, default=0, comment="상단 고정 (0: 일반, 1: 고정)")
    # 작성자
    author = Column(String(50), nullable=True, comment="작성자")
    # 소프트 삭제
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")
    created_at = Column(DateTime, default=func.now(), comment="생성일시")
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), comment="수정일시")

    def __repr__(self):
        return f"<Notice(id={self.id}, title={self.title}, type={self.notice_type})>"


class HygieneChecklist(Base):
    """
    위생 점검 체크리스트 템플릿 테이블.
    점검 항목을 정의합니다 (예: 냉장고 온도, 손 세척 등).
    """
    __tablename__ = "hygiene_checklists"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 점검 항목명
    item_name = Column(String(200), nullable=False, comment="점검 항목명")
    # 점검 구분: open(개점), close(마감), daily(일상)
    check_type = Column(String(20), default="daily", comment="점검 구분 (open/close/daily)")
    # 점검 카테고리: kitchen(주방), hall(홀), restroom(화장실), equipment(설비)
    category = Column(String(50), default="kitchen", comment="점검 카테고리")
    # 정렬 순서
    sort_order = Column(Integer, default=0, comment="정렬 순서")
    # 소프트 삭제
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")
    created_at = Column(DateTime, default=func.now(), comment="생성일시")
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), comment="수정일시")

    # 점검 기록과의 관계
    records = relationship("HygieneRecord", back_populates="checklist_item")

    def __repr__(self):
        return f"<HygieneChecklist(id={self.id}, item={self.item_name})>"


class HygieneRecord(Base):
    """
    위생 점검 기록 테이블.
    날짜별 체크리스트 항목의 점검 결과를 저장합니다.
    """
    __tablename__ = "hygiene_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 점검 날짜 (YYYY-MM-DD)
    check_date = Column(String(10), nullable=False, index=True, comment="점검 날짜")
    # 점검 항목 (외래키)
    checklist_id = Column(Integer, ForeignKey("hygiene_checklists.id"), nullable=False, comment="체크리스트 항목 ID")
    # 점검 결과: pass(양호), fail(불량), na(해당없음)
    result = Column(String(10), default="pass", comment="점검 결과 (pass/fail/na)")
    # 점검자
    inspector = Column(String(50), nullable=True, comment="점검자")
    # 비고/메모
    memo = Column(Text, nullable=True, comment="비고")
    created_at = Column(DateTime, default=func.now(), comment="생성일시")
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), comment="수정일시")

    # 체크리스트 항목과의 관계
    checklist_item = relationship("HygieneChecklist", back_populates="records")

    def __repr__(self):
        return f"<HygieneRecord(id={self.id}, date={self.check_date}, result={self.result})>"


class BusinessDay(Base):
    """
    영업일 관리 테이블.
    영업 여부, 특이사항, 메모를 날짜별로 저장합니다.
    """
    __tablename__ = "business_days"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 날짜 (YYYY-MM-DD), 하루에 하나의 레코드만 존재
    business_date = Column(String(10), nullable=False, unique=True, index=True, comment="영업 날짜")
    # 영업 상태: open(정상영업), closed(휴무), special(특별영업)
    status = Column(String(20), default="open", comment="영업 상태 (open/closed/special)")
    # 휴무 사유 (휴무일 경우)
    closed_reason = Column(String(200), nullable=True, comment="휴무 사유")
    # 특이사항 메모
    memo = Column(Text, nullable=True, comment="특이사항 메모")
    # 예상 매출 목표 (선택)
    target_sales = Column(Float, nullable=True, comment="당일 매출 목표 (원)")
    # 날씨 (선택적 기록)
    weather = Column(String(50), nullable=True, comment="날씨 (맑음/흐림/비/눈 등)")
    created_at = Column(DateTime, default=func.now(), comment="생성일시")
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), comment="수정일시")

    def __repr__(self):
        return f"<BusinessDay(id={self.id}, date={self.business_date}, status={self.status})>"


class TaskChecklist(Base):
    """
    업무 체크리스트 항목 정의 테이블.
    개점/마감 루틴 업무 항목을 관리합니다.
    """
    __tablename__ = "task_checklists"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 업무 항목명
    task_name = Column(String(200), nullable=False, comment="업무 항목명")
    # 업무 구분: open(개점), close(마감), weekly(주간), monthly(월간)
    task_type = Column(String(20), default="open", comment="업무 구분 (open/close/weekly/monthly)")
    # 담당 역할 (예: 주방, 홀, 공통)
    role = Column(String(50), nullable=True, comment="담당 역할")
    # 정렬 순서
    sort_order = Column(Integer, default=0, comment="정렬 순서")
    # 소프트 삭제
    is_deleted = Column(Integer, default=0, comment="소프트 삭제 (0: 정상, 1: 삭제)")
    created_at = Column(DateTime, default=func.now(), comment="생성일시")
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), comment="수정일시")

    # 완료 기록과의 관계
    records = relationship("TaskRecord", back_populates="task_item")

    def __repr__(self):
        return f"<TaskChecklist(id={self.id}, task={self.task_name})>"


class TaskRecord(Base):
    """
    업무 체크리스트 완료 기록 테이블.
    날짜별 업무 완료 여부를 저장합니다.
    """
    __tablename__ = "task_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # 기록 날짜 (YYYY-MM-DD)
    record_date = Column(String(10), nullable=False, index=True, comment="기록 날짜")
    # 업무 항목 (외래키)
    task_id = Column(Integer, ForeignKey("task_checklists.id"), nullable=False, comment="업무 항목 ID")
    # 완료 여부
    is_done = Column(Integer, default=0, comment="완료 여부 (0: 미완료, 1: 완료)")
    # 완료자
    completed_by = Column(String(50), nullable=True, comment="완료자")
    # 비고
    memo = Column(Text, nullable=True, comment="비고")
    created_at = Column(DateTime, default=func.now(), comment="생성일시")
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), comment="수정일시")

    # 업무 항목과의 관계
    task_item = relationship("TaskChecklist", back_populates="records")

    def __repr__(self):
        return f"<TaskRecord(id={self.id}, date={self.record_date}, done={self.is_done})>"
