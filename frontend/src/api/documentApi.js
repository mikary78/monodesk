// ============================================================
// api/documentApi.js — 문서 관리 API 호출 함수
// 지결서·회의록 CRUD 관련 백엔드 API를 호출합니다.
// ============================================================

const BASE = "/api/documents";

// ── 목록 조회 ──────────────────────────────────────────────
/**
 * 문서 목록을 조회합니다. doc_type, status로 필터링 가능합니다.
 * @param {Object} params - { doc_type, status, skip, limit }
 */
export async function fetchDocuments(params = {}) {
  const query = new URLSearchParams();
  if (params.doc_type) query.set("doc_type", params.doc_type);
  if (params.status)   query.set("status",   params.status);
  if (params.skip)     query.set("skip",     params.skip);
  if (params.limit)    query.set("limit",    params.limit);

  const res = await fetch(`${BASE}?${query.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── 단건 조회 ──────────────────────────────────────────────
/**
 * 특정 문서를 조회합니다.
 * @param {number} id - 문서 ID
 */
export async function fetchDocument(id) {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── 생성 ──────────────────────────────────────────────────
/**
 * 새 문서를 생성합니다.
 * @param {Object} data - DocumentCreate 스키마에 맞는 데이터
 */
export async function createDocument(data) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── 수정 ──────────────────────────────────────────────────
/**
 * 문서를 수정합니다.
 * @param {number} id   - 문서 ID
 * @param {Object} data - 수정할 필드
 */
export async function updateDocument(id, data) {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── 삭제 ──────────────────────────────────────────────────
/**
 * 문서를 소프트 삭제합니다.
 * @param {number} id - 문서 ID
 */
export async function deleteDocument(id) {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
