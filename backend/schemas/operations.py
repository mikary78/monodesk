# ============================================================
# schemas/operations.py — 운영 관리 Pydantic V2 스키마
# 공지사항, 위생점검, 영업일 관리, 업무 체크리스트 스키마 정의
# ============================================================

from pydantic import BaseModel, field_validator, ConfigDict
from typing import Optional, List
from datetime import datetime


# ─────────────────────────────────────────
# 공지사항 스키마
# ─────────────────────────────────────────

class NoticeCreate(BaseModel):
    """공지사항 생성 요청 스키마"""
    title: str
    content: str
    notice_type: str = "notice"   # notice / memo / urgent
    is_pinned: int = 0
    author: Optional[str] = None

    @field_validator("notice_type")
    @classmethod
    def validate_notice_type(cls, v: str) -> str:
        """공지 유형 유효성 검사"""
        allowed = {"notice", "memo", "urgent"}
        if v not in allowed:
            raise ValueError(f"공지 유형은 {allowed} 중 하나여야 합니다.")
        return v

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        """제목 공백 검사"""
        if not v.strip():
            raise ValueError("제목을 입력해주세요.")
        return v.strip()

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        """내용 공백 검사"""
        if not v.strip():
            raise ValueError("내용을 입력해주세요.")
        return v.strip()


class NoticeUpdate(BaseModel):
    """공지사항 수정 요청 스키마"""
    title: Optional[str] = None
    content: Optional[str] = None
    notice_type: Optional[str] = None
    is_pinned: Optional[int] = None
    author: Optional[str] = None

    @field_validator("notice_type")
    @classmethod
    def validate_notice_type(cls, v: Optional[str]) -> Optional[str]:
        """공지 유형 유효성 검사"""
        if v is not None:
            allowed = {"notice", "memo", "urgent"}
            if v not in allowed:
                raise ValueError(f"공지 유형은 {allowed} 중 하나여야 합니다.")
        return v


class NoticeResponse(BaseModel):
    """공지사항 응답 스키마"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    notice_type: str
    is_pinned: int
    author: Optional[str]
    is_deleted: int
    created_at: datetime
    updated_at: datetime


# ─────────────────────────────────────────
# 위생 점검 체크리스트 스키마
# ─────────────────────────────────────────

class HygieneChecklistCreate(BaseModel):
    """위생 점검 항목 생성 스키마"""
    item_name: str
    check_type: str = "daily"    # open / close / daily
    category: str = "kitchen"    # kitchen / hall / restroom / equipment
    sort_order: int = 0

    @field_validator("check_type")
    @classmethod
    def validate_check_type(cls, v: str) -> str:
        """점검 구분 유효성 검사"""
        allowed = {"open", "close", "daily"}
        if v not in allowed:
            raise ValueError(f"점검 구분은 {allowed} 중 하나여야 합니다.")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        """카테고리 유효성 검사"""
        allowed = {"kitchen", "hall", "restroom", "equipment"}
        if v not in allowed:
            raise ValueError(f"카테고리는 {allowed} 중 하나여야 합니다.")
        return v

    @field_validator("item_name")
    @classmethod
    def validate_item_name(cls, v: str) -> str:
        """항목명 공백 검사"""
        if not v.strip():
            raise ValueError("점검 항목명을 입력해주세요.")
        return v.strip()


class HygieneChecklistUpdate(BaseModel):
    """위생 점검 항목 수정 스키마"""
    item_name: Optional[str] = None
    check_type: Optional[str] = None
    category: Optional[str] = None
    sort_order: Optional[int] = None


class HygieneChecklistResponse(BaseModel):
    """위생 점검 항목 응답 스키마"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    item_name: str
    check_type: str
    category: str
    sort_order: int
    is_deleted: int
    created_at: datetime
    updated_at: datetime


# ─────────────────────────────────────────
# 위생 점검 기록 스키마
# ─────────────────────────────────────────

class HygieneRecordCreate(BaseModel):
    """위생 점검 기록 생성 스키마"""
    check_date: str
    checklist_id: int
    result: str = "pass"    # pass / fail / na
    inspector: Optional[str] = None
    memo: Optional[str] = None

    @field_validator("result")
    @classmethod
    def validate_result(cls, v: str) -> str:
        """점검 결과 유효성 검사"""
        allowed = {"pass", "fail", "na"}
        if v not in allowed:
            raise ValueError(f"점검 결과는 {allowed} 중 하나여야 합니다.")
        return v


class HygieneRecordUpdate(BaseModel):
    """위생 점검 기록 수정 스키마"""
    result: Optional[str] = None
    inspector: Optional[str] = None
    memo: Optional[str] = None

    @field_validator("result")
    @classmethod
    def validate_result(cls, v: Optional[str]) -> Optional[str]:
        """점검 결과 유효성 검사"""
        if v is not None:
            allowed = {"pass", "fail", "na"}
            if v not in allowed:
                raise ValueError(f"점검 결과는 {allowed} 중 하나여야 합니다.")
        return v


class HygieneRecordResponse(BaseModel):
    """위생 점검 기록 응답 스키마"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    check_date: str
    checklist_id: int
    result: str
    inspector: Optional[str]
    memo: Optional[str]
    created_at: datetime
    updated_at: datetime


class DailyHygieneSummary(BaseModel):
    """날짜별 위생 점검 요약 응답 스키마"""
    check_date: str
    total: int
    passed: int
    failed: int
    na_count: int
    completion_rate: float
    records: List[dict]


# ─────────────────────────────────────────
# 영업일 관리 스키마
# ─────────────────────────────────────────

class BusinessDayCreate(BaseModel):
    """영업일 생성/수정 스키마"""
    business_date: str
    status: str = "open"    # open / closed / special
    closed_reason: Optional[str] = None
    memo: Optional[str] = None
    target_sales: Optional[float] = None
    weather: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """영업 상태 유효성 검사"""
        allowed = {"open", "closed", "special"}
        if v not in allowed:
            raise ValueError(f"영업 상태는 {allowed} 중 하나여야 합니다.")
        return v

    @field_validator("business_date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        """날짜 형식 유효성 검사 (YYYY-MM-DD)"""
        import re
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("날짜는 YYYY-MM-DD 형식이어야 합니다.")
        return v


class BusinessDayUpdate(BaseModel):
    """영업일 수정 스키마"""
    status: Optional[str] = None
    closed_reason: Optional[str] = None
    memo: Optional[str] = None
    target_sales: Optional[float] = None
    weather: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        """영업 상태 유효성 검사"""
        if v is not None:
            allowed = {"open", "closed", "special"}
            if v not in allowed:
                raise ValueError(f"영업 상태는 {allowed} 중 하나여야 합니다.")
        return v


class BusinessDayResponse(BaseModel):
    """영업일 응답 스키마"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    business_date: str
    status: str
    closed_reason: Optional[str]
    memo: Optional[str]
    target_sales: Optional[float]
    weather: Optional[str]
    created_at: datetime
    updated_at: datetime


# ─────────────────────────────────────────
# 업무 체크리스트 스키마
# ─────────────────────────────────────────

class TaskChecklistCreate(BaseModel):
    """업무 항목 생성 스키마"""
    task_name: str
    task_type: str = "open"   # open / close / weekly / monthly
    role: Optional[str] = None
    sort_order: int = 0

    @field_validator("task_type")
    @classmethod
    def validate_task_type(cls, v: str) -> str:
        """업무 구분 유효성 검사"""
        allowed = {"open", "close", "weekly", "monthly"}
        if v not in allowed:
            raise ValueError(f"업무 구분은 {allowed} 중 하나여야 합니다.")
        return v

    @field_validator("task_name")
    @classmethod
    def validate_task_name(cls, v: str) -> str:
        """업무명 공백 검사"""
        if not v.strip():
            raise ValueError("업무 항목명을 입력해주세요.")
        return v.strip()


class TaskChecklistUpdate(BaseModel):
    """업무 항목 수정 스키마"""
    task_name: Optional[str] = None
    task_type: Optional[str] = None
    role: Optional[str] = None
    sort_order: Optional[int] = None


class TaskChecklistResponse(BaseModel):
    """업무 항목 응답 스키마"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    task_name: str
    task_type: str
    role: Optional[str]
    sort_order: int
    is_deleted: int
    created_at: datetime
    updated_at: datetime


class TaskRecordCreate(BaseModel):
    """업무 완료 기록 생성 스키마"""
    record_date: str
    task_id: int
    is_done: int = 0
    completed_by: Optional[str] = None
    memo: Optional[str] = None


class TaskRecordUpdate(BaseModel):
    """업무 완료 기록 수정 스키마"""
    is_done: Optional[int] = None
    completed_by: Optional[str] = None
    memo: Optional[str] = None


class TaskRecordResponse(BaseModel):
    """업무 완료 기록 응답 스키마"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    record_date: str
    task_id: int
    is_done: int
    completed_by: Optional[str]
    memo: Optional[str]
    created_at: datetime
    updated_at: datetime


class DailyTaskSummary(BaseModel):
    """날짜별 업무 체크리스트 요약 응답 스키마"""
    record_date: str
    task_type: str
    total: int
    completed: int
    completion_rate: float
    tasks: List[dict]


# ─────────────────────────────────────────
# 거래처 관리 스키마
# ─────────────────────────────────────────

class VendorCreate(BaseModel):
    """거래처 생성 요청 스키마"""
    name: str
    category: str = "기타"         # 식자재 / 주류 / 소모품 / 기타
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    payment_day: Optional[int] = None
    payment_method: str = "계좌이체"  # 카드 / 계좌이체 / 현금
    memo: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """거래처명 공백 검사"""
        if not v.strip():
            raise ValueError("거래처명을 입력해주세요.")
        return v.strip()

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        """카테고리 유효성 검사"""
        allowed = {"식자재", "주류", "소모품", "기타"}
        if v not in allowed:
            raise ValueError(f"카테고리는 {allowed} 중 하나여야 합니다.")
        return v

    @field_validator("payment_method")
    @classmethod
    def validate_payment_method(cls, v: str) -> str:
        """결제방법 유효성 검사"""
        allowed = {"카드", "계좌이체", "현금"}
        if v not in allowed:
            raise ValueError(f"결제방법은 {allowed} 중 하나여야 합니다.")
        return v

    @field_validator("payment_day")
    @classmethod
    def validate_payment_day(cls, v: Optional[int]) -> Optional[int]:
        """결제일 범위 검사 (1~31)"""
        if v is not None and not (1 <= v <= 31):
            raise ValueError("결제일은 1~31 사이의 숫자여야 합니다.")
        return v


class VendorUpdate(BaseModel):
    """거래처 수정 요청 스키마"""
    name: Optional[str] = None
    category: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    payment_day: Optional[int] = None
    payment_method: Optional[str] = None
    memo: Optional[str] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: Optional[str]) -> Optional[str]:
        """카테고리 유효성 검사"""
        if v is not None:
            allowed = {"식자재", "주류", "소모품", "기타"}
            if v not in allowed:
                raise ValueError(f"카테고리는 {allowed} 중 하나여야 합니다.")
        return v

    @field_validator("payment_method")
    @classmethod
    def validate_payment_method(cls, v: Optional[str]) -> Optional[str]:
        """결제방법 유효성 검사"""
        if v is not None:
            allowed = {"카드", "계좌이체", "현금"}
            if v not in allowed:
                raise ValueError(f"결제방법은 {allowed} 중 하나여야 합니다.")
        return v

    @field_validator("payment_day")
    @classmethod
    def validate_payment_day(cls, v: Optional[int]) -> Optional[int]:
        """결제일 범위 검사 (1~31)"""
        if v is not None and not (1 <= v <= 31):
            raise ValueError("결제일은 1~31 사이의 숫자여야 합니다.")
        return v


class VendorResponse(BaseModel):
    """거래처 응답 스키마"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    contact_name: Optional[str]
    phone: Optional[str]
    bank_name: Optional[str]
    account_number: Optional[str]
    payment_day: Optional[int]
    payment_method: str
    memo: Optional[str]
    is_deleted: int
    created_at: datetime
    updated_at: datetime
