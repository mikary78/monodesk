# ============================================================
# models/auth.py — 사용자 인증 SQLAlchemy 모델
# users 테이블 매핑 — 로그인 계정 및 역할 관리
# ============================================================

from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from database import Base


class User(Base):
    """
    사용자 계정 모델.
    역할: admin(전체 권한) / manager(운영 권한) / staff(근태 조회 전용)
    """
    __tablename__ = "users"

    # 기본 키
    id = Column(Integer, primary_key=True, autoincrement=True)

    # 로그인 정보
    username = Column(String, nullable=False, unique=True)   # 로그인 아이디
    password_hash = Column(String, nullable=False)           # bcrypt 해시 비밀번호
    name = Column(String, nullable=False)                    # 표시 이름 (한국어)

    # 권한 및 상태
    role = Column(String, nullable=False, default="staff")   # admin / manager / staff
    is_active = Column(Boolean, default=True)                # 계정 활성화 여부

    # 타임스탬프
    last_login = Column(DateTime, nullable=True)             # 마지막 로그인 시각
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
