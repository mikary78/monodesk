// ============================================================
// DocumentListTab.jsx — 문서 목록 탭 컴포넌트
// 지결서 또는 회의록 목록을 테이블로 표시합니다.
// props: docType ("지결서" | "회의록")
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, FileText, Trash2 } from "lucide-react";
import { fetchDocuments, deleteDocument } from "../../../api/documentApi";
import { useToast } from "../../../contexts/ToastContext";
import ConfirmDialog from "../../common/ConfirmDialog";
import DocumentFormModal from "./DocumentFormModal";
import DocumentDetailModal from "./DocumentDetailModal";

// 상태 배지 스타일
const STATUS_BADGE = {
  기안: "bg-slate-100 text-slate-600",
  확정: "bg-green-100 text-green-700",
};

// 금액 포맷
const formatAmount = (v) =>
  v != null ? `${Number(v).toLocaleString("ko-KR")}원` : "-";

const DocumentListTab = ({ docType }) => {
  const { showToast } = useToast();

  // ── 상태 ──────────────────────────────────────────────────
  const [docs, setDocs]               = useState([]);
  const [loading, setLoading]         = useState(false);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // 모달 상태
  const [showForm, setShowForm]       = useState(false);   // 작성/수정 모달
  const [showDetail, setShowDetail]   = useState(false);   // 상세 모달
  const [editDoc, setEditDoc]         = useState(null);    // 수정 대상 문서
  const [detailDoc, setDetailDoc]     = useState(null);    // 상세 대상 문서
  const [deleteTarget, setDeleteTarget] = useState(null);  // 삭제 확인 대상

  // ── 목록 조회 ──────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDocuments({
        doc_type: docType,
        status:   statusFilter || undefined,
      });
      setDocs(data);
    } catch (err) {
      showToast(`문서 목록 조회 중 오류가 발생했습니다: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [docType, statusFilter, showToast]);

  useEffect(() => { load(); }, [load]);

  // ── 검색 필터 (클라이언트 사이드) ──────────────────────────
  const filtered = docs.filter((d) =>
    !search ||
    d.title.includes(search) ||
    d.author.includes(search) ||
    d.doc_number.includes(search)
  );

  // ── 행 클릭 → 상세 모달 ───────────────────────────────────
  const handleRowClick = (doc) => {
    setDetailDoc(doc);
    setShowDetail(true);
  };

  // ── 수정 버튼 ─────────────────────────────────────────────
  const handleEdit = (doc) => {
    setEditDoc(doc);
    setShowDetail(false);
    setShowForm(true);
  };

  // ── 삭제 처리 ─────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDocument(deleteTarget.id);
      showToast("문서가 삭제되었습니다.", "success");
      setDeleteTarget(null);
      setShowDetail(false);
      load();
    } catch (err) {
      showToast(`삭제 중 오류가 발생했습니다: ${err.message}`, "error");
    }
  };

  return (
    <div>
      {/* 필터 바 */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {/* 검색 */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="제목·작성자·문서번호 검색..."
              className="pl-8 pr-3 h-9 w-56 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {/* 상태 필터 */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">전체 상태</option>
            <option value="기안">기안</option>
            <option value="확정">확정</option>
          </select>
        </div>

        {/* 작성 버튼 */}
        <button
          onClick={() => { setEditDoc(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-4 h-9 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors"
        >
          <Plus size={16} /> {docType} 작성
        </button>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm font-medium">등록된 {docType}이 없습니다.</p>
            <p className="text-slate-400 text-xs mt-1">상단 버튼으로 첫 번째 {docType}을 작성해보세요.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">문서번호</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">제목</th>
                {docType === "지결서" && (
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">지출금액</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">작성자</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">일자</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">상태</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => handleRowClick(doc)}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{doc.doc_number}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{doc.title}</td>
                  {docType === "지결서" && (
                    <td className="px-4 py-3 text-right text-slate-700">{formatAmount(doc.expense_amount)}</td>
                  )}
                  <td className="px-4 py-3 text-slate-600">{doc.author}</td>
                  <td className="px-4 py-3 text-slate-500">{doc.doc_date}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[doc.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {doc.status}
                    </span>
                  </td>
                  {/* 삭제 버튼 — 행 클릭과 독립적으로 동작 */}
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setDeleteTarget(doc)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-2 text-right">총 {filtered.length}건</p>

      {/* 작성/수정 모달 */}
      {showForm && (
        <DocumentFormModal
          doc={editDoc}
          docType={docType}
          onClose={() => { setShowForm(false); setEditDoc(null); }}
          onSaved={() => { setShowForm(false); setEditDoc(null); load(); }}
        />
      )}

      {/* 상세 조회 모달 */}
      {showDetail && detailDoc && (
        <DocumentDetailModal
          doc={detailDoc}
          onClose={() => { setShowDetail(false); setDetailDoc(null); }}
          onEdit={() => handleEdit(detailDoc)}
          onDelete={() => { setDeleteTarget(detailDoc); setShowDetail(false); }}
        />
      )}

      {/* 삭제 확인 다이얼로그 */}
      {deleteTarget && (
        <ConfirmDialog
          title="문서 삭제"
          message={`"${deleteTarget.title}" 문서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          confirmLabel="삭제"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default DocumentListTab;
