// ============================================================
// DocumentFormModal.jsx — 문서 작성/수정 모달
// 지결서/회의록 유형에 따라 폼 필드가 동적으로 변경됩니다.
// ============================================================

import { useState, useEffect } from "react";
import { X, FileText, Loader2 } from "lucide-react";
import { createDocument, updateDocument } from "../../../api/documentApi";
import { useToast } from "../../../contexts/ToastContext";

// 지출 분류 선택지 (지결서용)
const EXPENSE_CATEGORIES = ["식재료비", "소모품비", "인건비", "임차료", "공과금", "광고비", "기타"];

// 지급 방법 선택지 (지결서용)
const PAYMENT_METHODS = ["현금", "법인카드", "계좌이체", "미지급"];

const DocumentFormModal = ({ doc, docType, onClose, onSaved }) => {
  const { showToast } = useToast();

  // ── 공통 필드 상태 ──────────────────────────────────────
  const [form, setForm] = useState({
    title:          doc?.title          ?? "",
    author:         doc?.author         ?? "",
    doc_date:       doc?.doc_date       ?? new Date().toISOString().slice(0, 10),
    status:         doc?.status         ?? "기안",
    content:        doc?.content        ?? "",
    tags:           doc?.tags           ?? "",
    // 지결서 전용
    expense_amount:   doc?.expense_amount   ?? "",
    expense_category: doc?.expense_category ?? "식재료비",
    expense_vendor:   doc?.expense_vendor   ?? "",
    payment_method:   doc?.payment_method   ?? "현금",
    // 회의록 전용
    meeting_location: doc?.meeting_location ?? "",
    attendees:        doc?.attendees        ?? "",
    agenda:           doc?.agenda           ?? "",
    decisions:        doc?.decisions        ?? "",
  });

  const [saving, setSaving] = useState(false);

  // 입력값 변경 핸들러
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // 저장 처리
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { showToast("제목을 입력해주세요.", "warning"); return; }
    if (!form.author.trim()) { showToast("작성자를 입력해주세요.", "warning"); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        doc_type: docType,
        expense_amount: form.expense_amount ? Number(form.expense_amount) : null,
      };

      if (doc?.id) {
        await updateDocument(doc.id, payload);
        showToast("문서가 수정되었습니다.", "success");
      } else {
        await createDocument(payload);
        showToast("문서가 저장되었습니다.", "success");
      }
      onSaved();
    } catch (err) {
      showToast(`저장 중 오류가 발생했습니다: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const isEdit = !!doc?.id;
  const title  = isEdit ? `${docType} 수정` : `${docType} 작성`;

  return (
    // 오버레이 클릭으로 닫기
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-form-title"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">

        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-blue-500" />
            <h2 id="doc-form-title" className="text-lg font-semibold text-slate-800">{title}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* 공통 필드 — 제목 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">제목 *</label>
            <input
              name="title" value={form.title} onChange={handleChange}
              placeholder={docType === "지결서" ? "예: 식재료 구매 지출결의서" : "예: 3월 정기 운영 회의"}
              className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 공통 필드 — 작성자 / 일자 / 상태 */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">작성자 *</label>
              <input
                name="author" value={form.author} onChange={handleChange}
                placeholder="이름 입력"
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">문서 일자 *</label>
              <input
                type="date" name="doc_date" value={form.doc_date} onChange={handleChange}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">상태</label>
              <select
                name="status" value={form.status} onChange={handleChange}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="기안">기안</option>
                <option value="확정">확정</option>
              </select>
            </div>
          </div>

          {/* ── 지결서 전용 필드 ─────────────────────────── */}
          {docType === "지결서" && (
            <>
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">지출 정보</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">지출 금액 (원)</label>
                    <input
                      type="number" name="expense_amount" value={form.expense_amount} onChange={handleChange}
                      placeholder="0"
                      className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">지출 분류</label>
                    <select
                      name="expense_category" value={form.expense_category} onChange={handleChange}
                      className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">거래처</label>
                    <input
                      name="expense_vendor" value={form.expense_vendor} onChange={handleChange}
                      placeholder="거래처명 입력"
                      className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">지급 방법</label>
                    <select
                      name="payment_method" value={form.payment_method} onChange={handleChange}
                      className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── 회의록 전용 필드 ─────────────────────────── */}
          {docType === "회의록" && (
            <>
              <div className="border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">회의 정보</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">회의 장소</label>
                    <input
                      name="meeting_location" value={form.meeting_location} onChange={handleChange}
                      placeholder="예: 여남동 매장 내, 화상회의"
                      className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">참석자 (줄바꿈으로 구분)</label>
                    <textarea
                      name="attendees" value={form.attendees} onChange={handleChange}
                      rows={3}
                      placeholder={"홍길동 (대표)\n김철수 (운영)\n이영희 (회계)"}
                      className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">안건</label>
                    <textarea
                      name="agenda" value={form.agenda} onChange={handleChange}
                      rows={3}
                      placeholder={"1. 3월 매출 현황 보고\n2. 식재료 단가 조정 건\n3. 신메뉴 도입 논의"}
                      className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">결정 사항</label>
                    <textarea
                      name="decisions" value={form.decisions} onChange={handleChange}
                      rows={3}
                      placeholder={"1. 식재료 발주처 변경 승인\n2. 다음 회의: 4월 첫째 주"}
                      className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 공통 — 본문 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">본문 / 추가 내용</label>
            <textarea
              name="content" value={form.content} onChange={handleChange}
              rows={4}
              placeholder="추가 내용이나 특이사항을 입력하세요."
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* 공통 — 태그 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">태그 (콤마로 구분)</label>
            <input
              name="tags" value={form.tags} onChange={handleChange}
              placeholder="예: 식재료, 3월, 긴급"
              className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 버튼 영역 */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button
              type="button" onClick={onClose}
              className="px-4 h-9 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit" disabled={saving}
              className="px-4 h-9 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "저장 중..." : isEdit ? "수정 완료" : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DocumentFormModal;
