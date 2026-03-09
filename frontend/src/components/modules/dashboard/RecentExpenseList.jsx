// ============================================================
// RecentExpenseList.jsx — 최근 지출 내역 목록 컴포넌트
// 이번 달 최근 5건의 지출 내역을 표시합니다.
// ============================================================

import { Receipt } from "lucide-react";
import { formatCurrency, formatDate } from "../../../api/dashboardApi";

/**
 * 최근 지출 내역 목록 컴포넌트.
 * @param {Array} expenses - 최근 지출 배열
 * @param {boolean} loading - 로딩 상태
 */
const RecentExpenseList = ({ expenses = [], loading = false }) => {
  // 로딩 중 스켈레톤 표시
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="h-5 w-32 bg-slate-200 rounded animate-pulse mb-4" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-slate-100 rounded animate-pulse mb-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <Receipt size={16} className="text-slate-500" />
        <h3 className="text-base font-semibold text-slate-800">최근 지출 내역</h3>
        <span className="ml-auto text-xs text-slate-400">이번 달 최근 5건</span>
      </div>

      {/* 지출 목록 */}
      {expenses.length === 0 ? (
        // 데이터 없음
        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
          <Receipt size={32} className="mb-2 text-slate-300" />
          <p className="text-sm">이번 달 지출 내역이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {/* 분류 색상 인디케이터 */}
                <span
                  className="shrink-0 w-2 h-2 rounded-full"
                  style={{ backgroundColor: expense.category_color || "#64748B" }}
                />

                <div className="min-w-0">
                  {/* 지출 내용 */}
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {expense.description}
                  </p>
                  {/* 날짜 + 분류 */}
                  <p className="text-xs text-slate-400">
                    {formatDate(expense.expense_date)} · {expense.category_name}
                  </p>
                </div>
              </div>

              {/* 금액 */}
              <span className="shrink-0 ml-2 text-sm font-semibold text-slate-800">
                {formatCurrency(expense.total_amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentExpenseList;
