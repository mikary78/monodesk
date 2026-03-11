// ============================================================
// ExpenseList.jsx — 지출 목록 테이블 컴포넌트
// 월별 지출 내역을 테이블 형식으로 표시합니다.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { Pencil, Trash2, Plus, Search } from "lucide-react";
import { fetchExpenses, deleteExpense, fetchCategories, formatCurrency } from "../../../api/accountingApi";
import ExpenseForm from "./ExpenseForm";
import { useToast } from "../../../contexts/ToastContext";
import ConfirmDialog from "../../common/ConfirmDialog";

/**
 * 지출 목록 테이블 컴포넌트.
 * @param {number} year - 조회 연도
 * @param {number} month - 조회 월
 */
const ExpenseList = ({ year, month }) => {
  const toast = useToast();
  // 지출 목록 데이터
  const [expenses, setExpenses] = useState([]);
  // 전체 건수
  const [total, setTotal] = useState(0);
  // 지출 분류 목록 (필터용)
  const [categories, setCategories] = useState([]);
  // 선택된 분류 필터
  const [selectedCategory, setSelectedCategory] = useState("");
  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false);
  // 수정 중인 지출 항목
  const [editingExpense, setEditingExpense] = useState(null);
  // 신규 입력 폼 표시 여부
  const [showForm, setShowForm] = useState(false);
  // 삭제 확인 다이얼로그 상태
  const [confirmState, setConfirmState] = useState({ open: false, targetId: null, targetName: "" });

  /** 지출 목록 데이터 불러오기 */
  const loadExpenses = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters = {};
      if (selectedCategory) filters.category_id = selectedCategory;
      const result = await fetchExpenses(year, month, filters);
      setExpenses(result.items || []);
      setTotal(result.total || 0);
    } catch (err) {
      console.error("지출 목록 불러오기 실패:", err.message);
    } finally {
      setIsLoading(false);
    }
  }, [year, month, selectedCategory]);

  // 연월 또는 필터 변경 시 데이터 다시 불러오기
  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // 컴포넌트 초기 로드 시 분류 목록 불러오기
  useEffect(() => {
    fetchCategories().then(setCategories).catch(console.error);
  }, []);

  /** 삭제 버튼 클릭 → 확인 다이얼로그 열기 */
  const handleDeleteClick = (expenseId, description) => {
    setConfirmState({ open: true, targetId: expenseId, targetName: description });
  };

  /** 삭제 확인 → 실제 삭제 실행 */
  const handleDeleteConfirm = async () => {
    const id = confirmState.targetId;
    setConfirmState({ open: false, targetId: null, targetName: "" });
    try {
      await deleteExpense(id);
      await loadExpenses();
    } catch (err) {
      toast.error(err.message || "삭제 중 오류가 발생했습니다.");
    }
  };

  /** 삭제 취소 */
  const handleDeleteCancel = () => {
    setConfirmState({ open: false, targetId: null, targetName: "" });
  };

  /** 저장 성공 후 처리 */
  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingExpense(null);
    loadExpenses();
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={confirmState.open}
        title="지출 항목 삭제"
        message={`"${confirmState.targetName}" 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
      {/* 헤더 영역 */}
      <div className="flex items-center justify-between p-6 border-b border-slate-100">
        <h3 className="text-base font-semibold text-slate-900">
          지출 내역
          <span className="ml-2 text-sm font-normal text-slate-400">총 {total}건</span>
        </h3>
        <button
          onClick={() => { setShowForm(true); setEditingExpense(null); }}
          className="h-9 px-4 bg-blue-500 text-white rounded-md text-sm font-semibold hover:bg-blue-600 flex items-center gap-1 transition-colors"
        >
          <Plus size={14} />
          지출 입력
        </button>
      </div>

      {/* 신규 입력 또는 수정 폼 */}
      {(showForm || editingExpense) && (
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <ExpenseForm
            initialData={editingExpense}
            onSuccess={handleFormSuccess}
            onCancel={() => { setShowForm(false); setEditingExpense(null); }}
          />
        </div>
      )}

      {/* 필터 바 */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-100">
        <Search size={16} className="text-slate-400" />
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="h-8 px-3 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체 분류</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* 데이터 테이블 */}
      <div className="overflow-x-auto">
        {isLoading ? (
          // 로딩 스켈레톤
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : expenses.length === 0 ? (
          // 빈 상태
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <p className="text-sm">데이터가 없습니다.</p>
            <p className="text-xs mt-1">지출 입력 버튼을 눌러 첫 항목을 추가해보세요.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3 text-left">날짜</th>
                <th className="px-4 py-3 text-left">분류</th>
                <th className="px-4 py-3 text-left">거래처</th>
                <th className="px-4 py-3 text-left">내용</th>
                <th className="px-4 py-3 text-left">결제</th>
                <th className="px-4 py-3 text-right">공급가액</th>
                <th className="px-4 py-3 text-right">합계</th>
                <th className="px-4 py-3 text-center">관리</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense, idx) => (
                <tr
                  key={expense.id}
                  className={`border-b border-slate-100 hover:bg-blue-50 transition-colors ${
                    idx % 2 === 1 ? "bg-slate-50/50" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-sm text-slate-600">{expense.expense_date}</td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${expense.category?.color}20`,
                        color: expense.category?.color,
                      }}
                    >
                      {expense.category?.name || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{expense.vendor || "-"}</td>
                  <td className="px-4 py-3 text-sm text-slate-900">{expense.description}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{expense.payment_method}</td>
                  {/* 금액은 오른쪽 정렬 */}
                  <td className="px-4 py-3 text-sm text-right text-slate-900">
                    {formatCurrency(expense.amount)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-slate-900">
                    {formatCurrency(expense.total_amount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      {/* 수정 버튼 */}
                      <button
                        onClick={() => { setEditingExpense(expense); setShowForm(false); }}
                        className="text-slate-400 hover:text-blue-500 transition-colors"
                        title="수정"
                      >
                        <Pencil size={16} />
                      </button>
                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => handleDeleteClick(expense.id, expense.description)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ExpenseList;
