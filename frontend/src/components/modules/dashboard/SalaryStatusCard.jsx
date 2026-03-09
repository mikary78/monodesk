// ============================================================
// SalaryStatusCard.jsx — 이번 달 급여 현황 카드 컴포넌트
// 재직 중 직원 수, 총 지급액, 지급 완료/미완료 현황을 표시합니다.
// ============================================================

import { Users } from "lucide-react";
import { formatCurrency } from "../../../api/dashboardApi";

/**
 * 이번 달 급여 현황 카드 컴포넌트.
 * @param {object} salaryKpi - 급여 KPI 데이터
 * @param {boolean} loading - 로딩 상태
 */
const SalaryStatusCard = ({ salaryKpi = null, loading = false }) => {
  // 로딩 중 스켈레톤 표시
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
        <div className="h-5 w-32 bg-slate-200 rounded mb-4" />
        <div className="h-8 w-40 bg-slate-200 rounded mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  // 데이터가 없을 때 기본값 처리
  const kpi = salaryKpi || {
    active_employee_count: 0,
    total_salary_paid: 0,
    paid_count: 0,
    unpaid_count: 0,
  };

  // 전체 정산 인원 수 (지급 완료 + 미완료)
  const totalSettled = kpi.paid_count + kpi.unpaid_count;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <Users size={16} className="text-slate-500" />
        <h3 className="text-base font-semibold text-slate-800">이번 달 급여 현황</h3>
      </div>

      {/* 총 지급액 */}
      <div className="mb-4">
        <p className="text-xs text-slate-400 mb-1">지급 완료 총액</p>
        <p className="text-2xl font-bold text-slate-900">
          {formatCurrency(kpi.total_salary_paid)}
        </p>
      </div>

      {/* 3개 통계 박스 */}
      <div className="grid grid-cols-3 gap-3">
        {/* 재직 중 직원 */}
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-xs text-blue-600 font-medium mb-1">재직 중</p>
          <p className="text-xl font-bold text-blue-700">{kpi.active_employee_count}명</p>
        </div>

        {/* 급여 지급 완료 */}
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-xs text-green-600 font-medium mb-1">지급 완료</p>
          <p className="text-xl font-bold text-green-700">{kpi.paid_count}명</p>
        </div>

        {/* 급여 지급 미완료 */}
        <div
          className={`${
            kpi.unpaid_count > 0 ? "bg-amber-50" : "bg-slate-50"
          } rounded-lg p-3 text-center`}
        >
          <p
            className={`text-xs font-medium mb-1 ${
              kpi.unpaid_count > 0 ? "text-amber-600" : "text-slate-400"
            }`}
          >
            미지급
          </p>
          <p
            className={`text-xl font-bold ${
              kpi.unpaid_count > 0 ? "text-amber-700" : "text-slate-400"
            }`}
          >
            {kpi.unpaid_count}명
          </p>
        </div>
      </div>

      {/* 정산 진행률 (정산 기록이 있을 때만 표시) */}
      {totalSettled > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>정산 진행률</span>
            <span>
              {kpi.paid_count} / {totalSettled}명
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all"
              style={{
                width: `${Math.round((kpi.paid_count / totalSettled) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryStatusCard;
