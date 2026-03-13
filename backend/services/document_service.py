# ============================================================
# services/document_service.py — 문서 관리 비즈니스 로직
# 지결서/회의록 CRUD 및 문서번호 자동 채번을 처리합니다.
# ============================================================

from sqlalchemy.orm import Session
from sqlalchemy import select, func
from datetime import datetime
from models.document import Document
from schemas.document import DocumentCreate, DocumentUpdate


# ── 문서 유형별 번호 접두사 매핑 ──
DOC_TYPE_PREFIX = {
    "지결서": "지결",
    "회의록": "회의",
}


def _generate_doc_number(db: Session, doc_type: str, year: int) -> str:
    """
    연도별 문서 유형 시퀀스 번호를 자동 채번합니다.
    형식: 지결-YYYY-NNN  /  회의-YYYY-NNN
    """
    prefix = DOC_TYPE_PREFIX.get(doc_type, "문서")
    # 같은 연도·유형의 기존 문서 수를 세어 다음 번호 결정
    year_prefix_pattern = f"{prefix}-{year}-%"
    stmt = (
        select(func.count(Document.id))
        .where(Document.doc_number.like(year_prefix_pattern))
        .where(Document.is_deleted == 0)
    )
    count = db.execute(stmt).scalar() or 0
    seq = count + 1
    return f"{prefix}-{year}-{seq:03d}"


def get_documents(
    db: Session,
    doc_type: str = None,
    status: str = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Document]:
    """
    문서 목록 조회.
    doc_type, status 필터를 선택적으로 적용합니다.
    최신 문서 순(created_at DESC)으로 반환합니다.
    """
    stmt = (
        select(Document)
        .where(Document.is_deleted == 0)
        .order_by(Document.created_at.desc())
    )
    if doc_type:
        stmt = stmt.where(Document.doc_type == doc_type)
    if status:
        stmt = stmt.where(Document.status == status)
    stmt = stmt.offset(skip).limit(limit)
    return list(db.execute(stmt).scalars().all())


def get_document(db: Session, doc_id: int) -> Document | None:
    """ID로 단일 문서 조회. 삭제된 문서는 반환하지 않습니다."""
    stmt = (
        select(Document)
        .where(Document.id == doc_id)
        .where(Document.is_deleted == 0)
    )
    return db.execute(stmt).scalar_one_or_none()


def create_document(db: Session, data: DocumentCreate) -> Document:
    """
    문서를 생성합니다.
    문서번호는 연도+유형 기준으로 자동 채번됩니다.
    """
    year = datetime.now().year
    doc_number = _generate_doc_number(db, data.doc_type, year)

    doc = Document(
        doc_number=doc_number,
        **data.model_dump(),
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def update_document(db: Session, doc_id: int, data: DocumentUpdate) -> Document | None:
    """
    문서를 수정합니다.
    확정 상태의 문서는 수정이 불가합니다.
    전달된 필드만 선택적으로 업데이트합니다.
    """
    doc = get_document(db, doc_id)
    if doc is None:
        return None

    # 확정 문서는 수정 금지
    if doc.status == "확정":
        raise ValueError("확정된 문서는 수정할 수 없습니다.")

    # 변경된 필드만 업데이트 (None 제외)
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(doc, field, value)

    doc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(doc)
    return doc


def delete_document(db: Session, doc_id: int) -> bool:
    """
    문서를 소프트 삭제합니다.
    is_deleted = 1 로 마킹하며 실제 데이터는 보존됩니다.
    """
    doc = get_document(db, doc_id)
    if doc is None:
        return False

    doc.is_deleted = 1
    doc.updated_at = datetime.utcnow()
    db.commit()
    return True
