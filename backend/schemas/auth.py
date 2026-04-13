# ============================================================
# schemas/auth.py — 인증 관련 Pydantic 스키마 정의
# 요청/응답 데이터 유효성 검사 및 직렬화
# ============================================================

from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional
from datetime import datetime


# ─────────────────────────────────────────
# 로그인 요청/응답 스키마
# ─────────────────────────────────────────

class LoginRequest(BaseModel):
    """로그인 요청 — 아이디와 비밀번호"""
    username: str
    password: str


class TokenResponse(BaseModel):
    """JWT 토큰 발급 응답"""
    access_token: str
    token_type: str = "bearer"
    user: "UserBrief"


class UserBrief(BaseModel):
    """토큰 응답에 포함되는 간략한 사용자 정보"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    name: str
    role: str


# ─────────────────────────────────────────
# 사용자 계정 CRUD 스키마
# ─────────────────────────────────────────

class UserCreate(BaseModel):
    """계정 생성 요청 — admin 전용"""
    username: str
    password: str
    name: str
    role: str = "staff"

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        """역할 값 유효성 검사 (admin / manager / staff 만 허용)"""
        allowed = {"admin", "manager", "staff"}
        if v not in allowed:
            raise ValueError(f"역할은 {allowed} 중 하나여야 합니다.")
        return v


class UserUpdate(BaseModel):
    """계정 수정 요청 — admin 전용"""
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None   # 비밀번호 변경 시에만 포함
    is_active: Optional[bool] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        """역할 값 유효성 검사"""
        if v is None:
            return v
        allowed = {"admin", "manager", "staff"}
        if v not in allowed:
            raise ValueError(f"역할은 {allowed} 중 하나여야 합니다.")
        return v


class UserResponse(BaseModel):
    """사용자 계정 응답"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    name: str
    role: str
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


# 순환 참조 해결 (TokenResponse 내 UserBrief)
TokenResponse.model_rebuild()
