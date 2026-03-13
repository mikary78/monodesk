# ============================================================
# routers/document.py — 문서 관리 API 라우터
# 지결서/회의록 CRUD 엔드포인트를 제공합니다.
# prefix: /api/documents
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from schemas.document import DocumentCreate, DocumentUpdate, DocumentResponse
import services.document_service as doc_svc

router = APIRouter()


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    doc_type: Optional[str] = Query(None, description="문서 유형 필터 (지결서|회의록)"),
    status  : Optional[str] = Query(None, description="결재 상태 필터 (기안|확정)"),
    skip    : int           = Query(0,   ge=0),
    limit   : int           = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """문서 목록을 반환합니다. doc_type, status로 필터링 가능합니다."""
    return doc_svc.get_documents(db, doc_type=doc_type, status=status, skip=skip, limit=limit)


@router.get("/{doc_id}", response_model=DocumentResponse)
def get_document(doc_id: int, db: Session = Depends(get_db)):
    """단일 문서 상세 정보를 반환합니다."""
    doc = doc_svc.get_document(db, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
    return doc


@router.post("", response_model=DocumentResponse, status_code=201)
def create_document(data: DocumentCreate, db: Session = Depends(get_db)):
    """새 문서를 생성합니다. 문서번호가 자동 채번됩니다."""
    return doc_svc.create_document(db, data)


@router.put("/{doc_id}", response_model=DocumentResponse)
def update_document(doc_id: int, data: DocumentUpdate, db: Session = Depends(get_db)):
    """문서를 수정합니다. 확정 상태의 문서는 수정할 수 없습니다."""
    try:
        doc = doc_svc.update_document(db, doc_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if doc is None:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
    return doc


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    """문서를 소프트 삭제합니다."""
    deleted = doc_svc.delete_document(db, doc_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
