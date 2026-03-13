// ============================================================
// DocumentDetailModal.jsx — 문서 상세 조회 모달
// 읽기 전용으로 문서 내용을 표시하고 수정/삭제/인쇄를 제공합니다.
// 확정 상태의 문서는 수정이 비활성화됩니다.
// ============================================================

import { useEffect } from "react";
import { X, Printer, Edit, Trash2, Lock } from "lucide-react";

// 상태 배지 색상 매핑
const STATUS_STYLE = {
  기안: "bg-slate-100 text-slate-600",
  확정: "bg-green-100 text-green-700",
};

// 금액을 한국 원화 형식으로 포맷
const formatAmount = (v) =>
  v != null ? `${Number(v).toLocaleString("ko-KR")}원` : "-";

const DocumentDetailModal = ({ doc, onClose, onEdit, onDelete }) => {
  // ESC 키로 닫기
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // 인쇄 처리
  const handlePrint = () => window.print();

  const isLocked = doc.status === "확정"; // 확정 시 수정 잠금

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-detail-title"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">

        {/* 헤더 */}
        <div className="flex items-start justify-between p-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-500 font-mono">{doc.doc_number}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[doc.status] ?? "bg-slate-100 text-slate-600"}`}>
                {doc.status}
              </span>
              {isLocked && <Lock size={12} className="text-amber-500" title="확정된 문서는 수정할 수 없습니다" />}
            </div>
            <h2 id="doc-detail-title" className="text-lg font-semibold text-slate-800">
              {doc.title}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {doc.doc_type} · {doc.author} · {doc.doc_date}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors ml-4">
            <X size={20} />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 space-y-6">

          {/* 지결서 전용 정보 */}
          {doc.doc_type === "지결서" && (
            <div className="bg-blue-50 rounded-lg p-4 space-y-2">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">지출 정보</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">지출 금액</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{formatAmount(doc.expense_amount)}</p>
                </div>
                <div>
                  <span className="text-slate-500">지출 분류</span>
                  <p className="font-medium text-slate-800 mt-0.5">{doc.expense_category ?? "-"}</p>
                </div>
                <div>
                  <span className="text-slate-500">거래처</span>
                  <p className="font-medium text-slate-800 mt-0.5">{doc.expense_vendor || "-"}</p>
                </div>
                <div>
                  <span className="text-slate-500">지급 방법</span>
                  <p className="font-medium text-slate-800 mt-0.5">{doc.payment_method ?? "-"}</p>
                </div>
              </div>
            </div>
          )}

          {/* 회의록 전용 정보 */}
          {doc.doc_type === "회의록" && (
            <div className="space-y-4">
              {doc.meeting_location && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">회의 장소</p>
                  <p className="text-sm text-slate-800">{doc.meeting_location}</p>
                </div>
              )}
              {doc.attendees && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">참석자</p>
                  <p className="text-sm text-slate-800 whitespace-pre-line">{doc.attendees}</p>
                </div>
              )}
              {doc.agenda && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">안건</p>
                  <p className="text-sm text-slate-800 whitespace-pre-line">{doc.agenda}</p>
                </div>
              )}
              {doc.decisions && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">결정 사항</p>
                  <p className="text-sm text-slate-800 whitespace-pre-line bg-green-50 p-3 rounded-lg">{doc.decisions}</p>
                </div>
              )}
            </div>
          )}

          {/* 공통 — 본문 */}
          {doc.content && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">본문</p>
              <p className="text-sm text-slate-800 whitespace-pre-line">{doc.content}</p>
            </div>
          )}

          {/* 태그 */}
          {doc.tags && (
            <div className="flex flex-wrap gap-1">
              {doc.tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag) => (
                <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 버튼 */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-xl">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 h-8 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-white transition-colors"
          >
            <Printer size={14} /> 인쇄
          </button>
          <div className="flex gap-2">
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 h-8 text-sm text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} /> 삭제
            </button>
            <button
              onClick={onEdit}
              disabled={isLocked}
              title={isLocked ? "확정된 문서는 수정할 수 없습니다." : ""}
              className="flex items-center gap-1.5 px-3 h-8 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLocked ? <Lock size={14} /> : <Edit size={14} />}
              {isLocked ? "잠김" : "수정"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentDetailModal;
