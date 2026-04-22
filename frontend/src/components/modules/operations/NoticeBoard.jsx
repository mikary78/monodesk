// ============================================================
// NoticeBoard.jsx — 공지사항/메모 관리 컴포넌트
// 공지사항 목록 조회, 생성, 수정, 삭제 기능 제공
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { Plus, Pin, AlertTriangle, FileText, MessageSquare, Edit, Trash2, X, Save } from "lucide-react";
import { fetchNotices, createNotice, updateNotice, deleteNotice } from "../../../api/operationsApi";

// 공지 유형 설정
const NOTICE_TYPES = [
  { value: "notice", label: "공지",  Icon: FileText,      color: "text-blue-600 bg-blue-50" },
  { value: "memo",   label: "메모",  Icon: MessageSquare, color: "text-slate-600 bg-slate-100" },
  { value: "urgent", label: "긴급",  Icon: AlertTriangle, color: "text-red-600 bg-red-50" },
];

// 빈 폼 초기값
const EMPTY_FORM = { title: "", content: "", notice_type: "notice", is_pinned: 0, author: "" };

// readOnly: true이면 추가/수정/삭제 버튼을 숨김 (staff 읽기 전용 모드)
const NoticeBoard = ({ readOnly = false }) => {
  // 공지사항 목록 상태
  const [notices, setNotices] = useState([]);
  // 필터 상태
  const [filterType, setFilterType] = useState("");
  // 로딩 상태
  const [loading, setLoading] = useState(false);
  // 에러 메시지
  const [error, setError] = useState("");
  // 모달 열림 여부
  const [modalOpen, setModalOpen] = useState(false);
  // 수정 중인 공지 (null이면 신규)
  const [editingNotice, setEditingNotice] = useState(null);
  // 폼 데이터
  const [form, setForm] = useState(EMPTY_FORM);
  // 저장 중 여부
  const [saving, setSaving] = useState(false);

  // 공지사항 목록 불러오기
  const loadNotices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchNotices({ noticeType: filterType || undefined });
      setNotices(data.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    loadNotices();
  }, [loadNotices]);

  // 신규 공지 모달 열기
  const handleOpenCreate = () => {
    setEditingNotice(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  // 수정 모달 열기
  const handleOpenEdit = (notice) => {
    setEditingNotice(notice);
    setForm({
      title: notice.title,
      content: notice.content,
      notice_type: notice.notice_type,
      is_pinned: notice.is_pinned,
      author: notice.author || "",
    });
    setModalOpen(true);
  };

  // 모달 닫기
  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingNotice(null);
    setForm(EMPTY_FORM);
  };

  // 저장 처리 (신규/수정)
  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError("제목과 내용을 입력해주세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editingNotice) {
        await updateNotice(editingNotice.id, form);
      } else {
        await createNotice(form);
      }
      handleCloseModal();
      loadNotices();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // 삭제 처리
  const handleDelete = async (noticeId) => {
    if (!window.confirm("공지사항을 삭제하시겠습니까?")) return;
    try {
      await deleteNotice(noticeId);
      loadNotices();
    } catch (e) {
      setError(e.message);
    }
  };

  // 공지 유형 정보 반환
  const getTypeInfo = (type) => NOTICE_TYPES.find((t) => t.value === type) || NOTICE_TYPES[0];

  // 날짜 포맷 함수
  const formatDate = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <div>
      {/* 상단 툴바 */}
      <div className="flex items-center justify-between mb-4">
        {/* 유형 필터 탭 */}
        <div className="flex gap-1">
          {[{ value: "", label: "전체" }, ...NOTICE_TYPES].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilterType(value)}
              className={`px-3 h-8 rounded text-sm font-medium transition-colors ${
                filterType === value
                  ? "bg-blue-500 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 신규 추가 버튼 — readOnly 모드에서 숨김 */}
        {!readOnly && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 h-9 px-4 bg-blue-500 text-white text-sm font-semibold rounded-md hover:bg-blue-600 transition-colors"
          >
            <Plus size={16} />
            공지 추가
          </button>
        )}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 공지사항 목록 */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">불러오는 중...</div>
      ) : notices.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <FileText size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">공지사항이 없습니다.</p>
          <p className="text-sm mt-1">첫 번째 공지를 추가해보세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((notice) => {
            const typeInfo = getTypeInfo(notice.notice_type);
            const TypeIcon = typeInfo.Icon;
            return (
              <div
                key={notice.id}
                className={`bg-white rounded-lg shadow-sm border p-4 ${
                  notice.notice_type === "urgent" ? "border-red-200" : "border-slate-100"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* 유형 배지 */}
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium shrink-0 mt-0.5 ${typeInfo.color}`}>
                      <TypeIcon size={12} />
                      {typeInfo.label}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {/* 고정 아이콘 */}
                        {notice.is_pinned === 1 && (
                          <Pin size={14} className="text-blue-500 shrink-0" />
                        )}
                        <h3 className="font-semibold text-slate-900 text-sm truncate">
                          {notice.title}
                        </h3>
                      </div>
                      {/* 내용 미리보기 */}
                      <p className="text-slate-600 text-sm mt-1 line-clamp-2">{notice.content}</p>
                      {/* 메타 정보 */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                        {notice.author && <span>{notice.author}</span>}
                        <span>{formatDate(notice.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 액션 버튼 — readOnly 모드에서 숨김 */}
                  {!readOnly && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenEdit(notice)}
                        className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        title="수정"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(notice.id)}
                        className="h-7 w-7 flex items-center justify-center rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 공지 작성/수정 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                {editingNotice ? "공지사항 수정" : "공지사항 추가"}
              </h2>
              <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="px-6 py-4 space-y-4">
              {/* 유형 선택 */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">공지 유형</label>
                <div className="flex gap-2">
                  {NOTICE_TYPES.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setForm((f) => ({ ...f, notice_type: value }))}
                      className={`flex-1 h-9 rounded border text-sm font-medium transition-colors ${
                        form.notice_type === value
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 제목 입력 */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">제목 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="공지 제목을 입력하세요"
                  className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
                />
              </div>

              {/* 내용 입력 */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">내용 *</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="공지 내용을 입력하세요"
                  rows={5}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400 resize-none"
                />
              </div>

              {/* 작성자 + 고정 여부 */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">작성자</label>
                  <input
                    type="text"
                    value={form.author}
                    onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                    placeholder="작성자 (선택)"
                    className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer h-9">
                    <input
                      type="checkbox"
                      checked={form.is_pinned === 1}
                      onChange={(e) => setForm((f) => ({ ...f, is_pinned: e.target.checked ? 1 : 0 }))}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-slate-600">상단 고정</span>
                  </label>
                </div>
              </div>

              {/* 에러 */}
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button
                onClick={handleCloseModal}
                className="h-9 px-4 border border-slate-200 text-slate-600 text-sm font-medium rounded-md hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 h-9 px-4 bg-blue-500 text-white text-sm font-semibold rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                <Save size={14} />
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoticeBoard;
