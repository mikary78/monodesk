# ============================================================
# schemas/document.py — 문서 관리 Pydantic V2 스키마
# 요청/응답 데이터 검증 및 직렬화를 담당합니다.
# ============================================================

from pydantic import BaseModel, field_validator, ConfigDict
from typing import Optional
from datetime import datetime


# ── 허용 값 상수 ──
ALLOWED_DOC_TYPES = {"지결서", "회의록"}
ALLOWED_STATUSES  = {"기안", "확정"}


class DocumentCreate(BaseModel):
    """문서 생성 요청 스키마"""
    model_config = ConfigDict(str_strip_whitespace=True)

    doc_type : str           # "지결서" | "회의록"
    title    : str
    author   : str
    doc_date : str           # YYYY-MM-DD
    status   : str = "기안"
    content  : Optional[str] = None

    # 지결서 전용
    expense_amount   : Optional[int] = None
    expense_category : Optional[str] = None
    expense_vendor   : Optional[str] = None
    payment_method   : Optional[str] = None

    # 회의록 전용
    meeting_location : Optional[str] = None
    attendees        : Optional[str] = None
    agenda           : Optional[str] = None
    decisions        : Optional[str] = None

    # 공통
    tags : Optional[str] = None

    @field_validator("doc_type")
    @classmethod
    def validate_doc_type(cls, v: str) -> str:
        """문서 유형은 '지결서' 또는 '회의록'만 허용"""
        if v not in ALLOWED_DOC_TYPES:
            raise ValueError(f"doc_type은 {ALLOWED_DOC_TYPES} 중 하나여야 합니다.")
        return v

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """결재 상태는 '기안' 또는 '확정'만 허용"""
        if v not in ALLOWED_STATUSES:
            raise ValueError(f"status는 {ALLOWED_STATUSES} 중 하나여야 합니다.")
        return v


class DocumentUpdate(BaseModel):
    """문서 수정 요청 스키마 — 모든 필드 선택적"""
    model_config = ConfigDict(str_strip_whitespace=True)

    title   : Optional[str] = None
    author  : Optional[str] = None
    doc_date: Optional[str] = None
    status  : Optional[str] = None
    content : Optional[str] = None

    # 지결서 전용
    expense_amount   : Optional[int] = None
    expense_category : Optional[str] = None
    expense_vendor   : Optional[str] = None
    payment_method   : Optional[str] = None

    # 회의록 전용
    meeting_location : Optional[str] = None
    attendees        : Optional[str] = None
    agenda           : Optional[str] = None
    decisions        : Optional[str] = None

    # 공통
    tags : Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        """결재 상태 유효성 검증"""
        if v is not None and v not in ALLOWED_STATUSES:
            raise ValueError(f"status는 {ALLOWED_STATUSES} 중 하나여야 합니다.")
        return v


class DocumentResponse(BaseModel):
    """문서 응답 스키마"""
    model_config = ConfigDict(from_attributes=True)

    id         : int
    doc_number : str
    doc_type   : str
    title      : str
    author     : str
    doc_date   : str
    status     : str
    content    : Optional[str] = None

    # 지결서 전용
    expense_amount   : Optional[int] = None
    expense_category : Optional[str] = None
    expense_vendor   : Optional[str] = None
    payment_method   : Optional[str] = None

    # 회의록 전용
    meeting_location : Optional[str] = None
    attendees        : Optional[str] = None
    agenda           : Optional[str] = None
    decisions        : Optional[str] = None

    # 공통
    tags       : Optional[str] = None
    created_at : datetime
    updated_at : datetime
