// ============================================================
// CorporateExpenseList.jsx — 법인 비용 목록 및 관리 컴포넌트
// 세무사비, 법인 보험료 등 법인 차원의 비용을 관리합니다.
// ============================================================

import { useState, useEffect } from "react";
import { Receipt, Plus, Edit, Trash2, RefreshCw } from "lucide-react";
import {
  fetchCorporateExpenses,
  createCorporateExpense,
  updateCorporateExpense,
  deleteCorporateExpense,
} from "../../../api/corporateApi";

// 법인 비용 분류 목록
const EXPENSE_CATEGORIES = [
  "세무사비",
  "법인보험료",
  "법인등기비",
  "상표/특허비",
  "법인통신비",
  "법인차량비",
  "임원급여",
  "기타",
];

// 결제 수단 목록
const PAYMENT_METHODS = ["계좌이체", "카드", "현금"];

// 빈 폼 초기값
const EMPTY_FORM = {
  expense_date: new Date().toISOString().slice(0, 10),
  category: "세무사비",
  description: "",
  vendor: "",
  amount: "",
  payment_method: "계좌이체",
  is_recurring: 0,
  memo: "",
};

const CorporateExpenseList = ({ year }) => {
  // 법인 비용 목록
  const [items, setItems] = useState([]);
  // 전체 건수
  const [total, setTotal] = useState(0);
  // 로딩 상태
  const [loading, setLoading] = useState(false);
  // 필터: 월 (0 = 전체)
  const [filterMonth, setFilterMonth] = useState(0);
  // 필터: 분류
  const [filterCategory, setFilterCategory] = useState("");
  // 모달 표시 여부
  const [showModal, setShowModal] = useState(false);
  // 수정 대상 (null이면 신규)
  const [editTarget, setEditTarget] = useState(null);
  // 폼 입력값
  const [form, setForm] = useState(EMPTY_FORM);
  // 저장 중
  const [saving, setSaving] = useState(false);
  // 오류
  const [formError, setFormError] = useState(null);

  // 연도/필터 변경 시 목록 다시 불러오기
  useEffect(() => {
    loadExpenses();
  }, [year, filterMonth, filterCategory]);

  /**
   * 법인 비용 목록 불러오기
   */
  const loadExpenses = async () => {
    try {
      setLoading(true);
      const params = {
        year,
        month: filterMonth > 0 ? filterMonth : undefined,
        category: filterCategory || undefined,
        limit: 100,
      };
      const data = await fetchCorporateExpenses(params);
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 신규 등록 모달 열기
   */
  const handleOpenCreate = () => {
    setEditTarget(null);
    setForm({
      ...EMPTY_FORM,
      expense_date: `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`,
    });
    setFormError(null);
    setShowModal(true);
  };

  /**
   * 수정 모달 열기
   */
  const handleOpenEdit = (item) => {
    setEditTarget(item);
    setForm({
      expense_date: item.expense_date,
      category: item.category,
      description: item.description,
      vendor: item.vendor || "",
      amount: item.amount,
      payment_method: item.payment_method,
      is_recurring: item.is_recurring,
      memo: item.memo || "",
    });
    setFormError(null);
    setShowModal(true);
  };

  /**
   * 폼 저장 처리
   */
  const handleSave = async () => {
    if (!form.description.trim()) { setFormError("내용을 입력해주세요."); return; }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      setFormError("금액을 올바르게 입력해주세요."); return;
    }

    try {
      setSaving(true);
      setFormError(null);
      const payload = {
        ...form,
        amount: parseFloat(form.amount),
        is_recurring: Number(form.is_recurring),
      };

      if (editTarget) {
        await updateCorporateExpense(editTarget.id, payload);
      } else {
        await createCorporateExpense(payload);
      }
      setShowModal(false);
      await loadExpenses();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * 법인 비용 삭제
   */
  const handleDelete = async (item) => {
    if (!window.confirm(`"${item.description}" 항목을 삭제하시겠습니까?`)) return;
    try {
      await deleteCorporateExpense(item.id);
      await loadExpenses();
    } catch (e) {
      alert(e.message);
    }
  };

  // 금액 합계 계산
  const totalAmount = items.reduce((s, i) => s + i.amount, 0);

  // 금액 포맷
  const fmt = (n) => Math.round(n).toLocaleString();

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 헤더 */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-blue-500" />
            <h2 className="text-base font-semibold text-slate-900">법인 비용 관리</h2>
            <span className="text-xs text-slate-400">{total}건</span>
          </div>
          <button
            onClick={handleOpenCreate}
            className="h-9 px-4 flex items-center gap-2 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            <Plus size={16} />
            비용 추가
          </button>
        </div>

        {/* 필터 바 */}
        <div className="flex gap-3 flex-wrap">
          {/* 월 필터 */}
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(Number(e.target.value))}
            className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:border-blue-400"
          >
            <option value={0}>전체 월</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
          {/* 분류 필터 */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:border-blue-400"
          >
            <option value="">전체 분류</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="p-6 animate-pulse space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center text-slate-400">
          <Receipt size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">법인 비용이 없습니다.</p>
        </div>
      ) : (
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="text-left px-4 py-3">날짜</th>
                <th className="text-left px-4 py-3">분류</th>
                <th className="text-left px-4 py-3">내용</th>
                <th className="text-left px-4 py-3">거래처</th>
                <th className="text-right px-4 py-3">금액</th>
                <th className="text-center px-4 py-3">결제</th>
                <th className="text-center px-4 py-3">반복</th>
                <th className="text-center px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{item.expense_date}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-900 font-medium">{item.description}</td>
                  <td className="px-4 py-3 text-slate-500">{item.vendor || "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {fmt(item.amount)}원
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">{item.payment_method}</td>
                  <td className="px-4 py-3 text-center">
                    {item.is_recurring === 1 ? (
                      <span className="flex items-center justify-center gap-1 text-xs text-blue-500">
                        <RefreshCw size={11} /> 반복
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1 text-slate-400 hover:text-blue-500 rounded transition-colors"
                        title="수정"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={4} className="px-4 py-3 text-slate-700">합계 ({total}건)</td>
                <td className="px-4 py-3 text-right text-slate-900">{fmt(totalAmount)}원</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* 법인 비용 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-5">
              {editTarget ? "법인 비용 수정" : "법인 비용 추가"}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* 날짜 */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    날짜 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.expense_date}
                    onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                {/* 분류 */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    분류 <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400 bg-white"
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 내용 */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  내용 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
                  placeholder="예: 3월 세무기장료"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* 거래처 */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">거래처</label>
                  <input
                    type="text"
                    value={form.vendor}
                    onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
                    placeholder="○○세무사무소"
                  />
                </div>
                {/* 금액 */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    금액 (원) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
                    placeholder="330000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* 결제 수단 */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">결제 수단</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400 bg-white"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                {/* 반복 비용 여부 */}
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_recurring === 1}
                      onChange={(e) => setForm({ ...form, is_recurring: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 accent-blue-500"
                    />
                    <span className="text-sm text-slate-600">매월 반복 비용</span>
                  </label>
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">메모</label>
                <textarea
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400 resize-none"
                  placeholder="비고"
                />
              </div>

              {/* 오류 메시지 */}
              {formError && <p className="text-red-500 text-xs">{formError}</p>}
            </div>

            {/* 모달 푸터 */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="h-9 px-4 text-sm font-medium border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-9 px-4 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorporateExpenseList;
