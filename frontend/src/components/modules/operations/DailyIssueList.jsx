// ============================================================
// DailyIssueList.jsx — 일일 특이사항 이슈 트래킹 컴포넌트
// 날짜별 고객/원재료/직원 이슈 등록, 처리내역 입력, 완료 처리
// ============================================================

import { useState, useEffect } from "react";
import { Plus, X, Check, AlertCircle, User, Package, Users } from "lucide-react";
import {
  getIssuesByDate,
  createIssue,
  updateIssue,
  deleteIssue,
} from "../../../api/operationsApi";
import { useToast } from "../../../contexts/ToastContext";
import ConfirmDialog from "../../common/ConfirmDialog";

// 이슈 유형 탭 정의
const ISSUE_TYPES = [
  { id: "all",        label: "전체",    Icon: AlertCircle },
  { id: "customer",   label: "고객",    Icon: User        },
  { id: "ingredient", label: "원재료",  Icon: Package     },
  { id: "employee",   label: "직원",    Icon: Users       },
];

const TYPE_LABELS  = { customer: "고객", ingredient: "원재료", employee: "직원" };
const TYPE_COLORS  = {
  customer:   "bg-blue-50 text-blue-700 border-blue-200",
  ingredient: "bg-orange-50 text-orange-700 border-orange-200",
  employee:   "bg-purple-50 text-purple-700 border-purple-200",
};

// 등록 모달 초기 상태
const EMPTY_MODAL = { issue_type: "customer", content: "", action_taken: "", is_resolved: false };

const DailyIssueList = () => {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [activeType, setActiveType]     = useState("all");
  const [issues, setIssues]             = useState([]);
  const [loading, setLoading]           = useState(false);

  // 등록 모달
  const [modalOpen, setModalOpen]   = useState(false);
  const [modalForm, setModalForm]   = useState(EMPTY_MODAL);
  const [modalSaving, setModalSaving] = useState(false);

  // 처리내역 인라인 편집 상태
  const [editingId,    setEditingId]    = useState(null);
  const [editingAction, setEditingAction] = useState("");

  // 삭제 확인
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, issue: null });

  // 날짜/탭 변경 시 목록 조회
  useEffect(() => {
    loadIssues();
  }, [selectedDate]);

  const loadIssues = async () => {
    setLoading(true);
    try {
      const data = await getIssuesByDate(selectedDate);
      setIssues(data);
    } catch (err) {
      toast.error("이슈 목록 조회 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 탭 필터 적용 (클라이언트 사이드)
  const filteredIssues = activeType === "all"
    ? issues
    : issues.filter((i) => i.issue_type === activeType);

  // 이슈 등록 저장
  const handleModalSave = async () => {
    if (!modalForm.content.trim()) {
      toast.error("특이사항 내용을 입력해주세요.");
      return;
    }
    setModalSaving(true);
    try {
      await createIssue({
        issue_date:   selectedDate,
        issue_type:   modalForm.issue_type,
        content:      modalForm.content.trim(),
        action_taken: modalForm.action_taken.trim() || null,
        is_resolved:  modalForm.is_resolved,
      });
      toast.success("이슈가 등록되었습니다.");
      setModalOpen(false);
      setModalForm(EMPTY_MODAL);
      await loadIssues();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setModalSaving(false);
    }
  };

  // 완료 여부 토글
  const handleToggleResolved = async (issue) => {
    try {
      await updateIssue(issue.id, { is_resolved: !issue.is_resolved });
      await loadIssues();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // 처리내역 저장
  const handleSaveAction = async (issue) => {
    try {
      await updateIssue(issue.id, { action_taken: editingAction.trim() || null });
      toast.success("처리내역이 저장되었습니다.");
      setEditingId(null);
      await loadIssues();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // 삭제 확인 → 실행
  const handleDeleteConfirm = async () => {
    const issue = deleteConfirm.issue;
    setDeleteConfirm({ open: false, issue: null });
    try {
      await deleteIssue(issue.id);
      await loadIssues();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      {/* 상단 컨트롤 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
        />
        <span className="text-sm text-slate-500">
          총 {issues.length}건
          {issues.filter((i) => !i.is_resolved).length > 0 && (
            <span className="ml-2 text-orange-600 font-medium">
              미완료 {issues.filter((i) => !i.is_resolved).length}건
            </span>
          )}
        </span>
        <button
          onClick={() => { setModalForm(EMPTY_MODAL); setModalOpen(true); }}
          className="ml-auto h-9 px-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md flex items-center gap-2"
        >
          <Plus size={14} />
          이슈 등록
        </button>
      </div>

      {/* 유형 탭 */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {ISSUE_TYPES.map(({ id, label, Icon }) => {
          const count = id === "all"
            ? issues.length
            : issues.filter((i) => i.issue_type === id).length;
          return (
            <button
              key={id}
              onClick={() => setActiveType(id)}
              className={
                activeType === id
                  ? "flex items-center gap-1.5 h-9 px-4 text-sm font-medium border-b-2 border-blue-500 text-blue-600"
                  : "flex items-center gap-1.5 h-9 px-4 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700"
              }
            >
              <Icon size={14} />
              {label}
              {count > 0 && (
                <span className="text-xs bg-slate-100 text-slate-600 px-1.5 rounded-full">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 이슈 목록 */}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">불러오는 중...</div>
      ) : filteredIssues.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-slate-400 text-sm">등록된 이슈가 없습니다.</p>
          <p className="text-slate-400 text-xs mt-1">"이슈 등록" 버튼을 눌러 추가하세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIssues.map((issue) => (
            <div
              key={issue.id}
              className={`bg-white rounded-lg border shadow-sm p-4 ${issue.is_resolved ? "border-green-200" : "border-orange-200"}`}
            >
              {/* 카드 헤더 */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 유형 배지 */}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border ${TYPE_COLORS[issue.issue_type]}`}>
                    {TYPE_LABELS[issue.issue_type]}
                  </span>
                  {/* 완료 상태 배지 */}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${issue.is_resolved ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
                    {issue.is_resolved ? "처리완료" : "미완료"}
                  </span>
                </div>

                {/* 버튼 영역 */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* 완료 토글 */}
                  <button
                    onClick={() => handleToggleResolved(issue)}
                    title={issue.is_resolved ? "미완료로 변경" : "완료 처리"}
                    className={`w-7 h-7 flex items-center justify-center rounded ${issue.is_resolved ? "text-green-600 bg-green-50 hover:bg-green-100" : "text-slate-400 hover:bg-green-50 hover:text-green-600"}`}
                  >
                    <Check size={14} />
                  </button>
                  {/* 삭제 */}
                  <button
                    onClick={() => setDeleteConfirm({ open: true, issue })}
                    className="w-7 h-7 flex items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-500"
                    title="삭제"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* 특이사항 내용 */}
              <p className="text-sm text-slate-800 mb-3 leading-relaxed">{issue.content}</p>

              {/* 처리내역 */}
              {editingId === issue.id ? (
                <div className="mt-2">
                  <textarea
                    value={editingAction}
                    onChange={(e) => setEditingAction(e.target.value)}
                    placeholder="처리 내역을 입력하세요..."
                    rows={2}
                    className="w-full px-3 py-2 border border-blue-300 rounded text-sm resize-none focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleSaveAction(issue)}
                      className="h-7 px-3 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="h-7 px-3 border border-slate-200 text-slate-600 text-xs rounded hover:bg-slate-50"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => { setEditingId(issue.id); setEditingAction(issue.action_taken || ""); }}
                  className="cursor-pointer text-xs rounded-md px-3 py-2 border border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
                >
                  {issue.action_taken ? (
                    <span className="text-slate-600">{issue.action_taken}</span>
                  ) : (
                    <span className="text-slate-300">처리내역을 클릭하여 입력...</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 이슈 등록 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">이슈 등록</h2>
              <button onClick={() => setModalOpen(false)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100">
                <X size={15} className="text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 이슈 유형 선택 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  이슈 유형 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {ISSUE_TYPES.filter((t) => t.id !== "all").map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setModalForm((p) => ({ ...p, issue_type: id }))}
                      className={`flex-1 h-9 text-sm rounded-md border font-medium transition-colors ${
                        modalForm.issue_type === id
                          ? TYPE_COLORS[id] + " border-current"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 특이사항 내용 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  특이사항 내용 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={modalForm.content}
                  onChange={(e) => setModalForm((p) => ({ ...p, content: e.target.value }))}
                  placeholder="발생한 특이사항을 입력해주세요."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm resize-none focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* 처리내역 (선택) */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  처리내역 <span className="text-slate-400 font-normal">(선택)</span>
                </label>
                <textarea
                  value={modalForm.action_taken}
                  onChange={(e) => setModalForm((p) => ({ ...p, action_taken: e.target.value }))}
                  placeholder="즉시 처리한 내역이 있으면 입력하세요."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm resize-none focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* 처리완료 여부 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modalForm.is_resolved}
                  onChange={(e) => setModalForm((p) => ({ ...p, is_resolved: e.target.checked }))}
                  className="w-4 h-4 rounded accent-green-500"
                />
                <span className="text-sm text-slate-700">즉시 처리완료</span>
              </label>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setModalOpen(false)}
                className="h-9 px-4 border border-slate-200 text-slate-600 text-sm rounded-md hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={handleModalSave}
                disabled={modalSaving}
                className="h-9 px-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md disabled:opacity-50"
              >
                {modalSaving ? "저장 중..." : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        title="이슈 삭제"
        message="이 이슈를 삭제하시겠습니까? 삭제된 이슈는 복구할 수 없습니다."
        confirmText="삭제"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm({ open: false, issue: null })}
      />
    </div>
  );
};

export default DailyIssueList;
