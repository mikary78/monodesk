// ============================================================
// DailyKpiRow.jsx — 일별 대시보드 KPI 카드 행 컴포넌트
// 일별 뷰의 핵심 지표 카드 2행을 렌더링합니다.
// ============================================================

import { DollarSign, Target, Users, Receipt, TrendingDown, TrendingUp, Tag, Gift } from "lucide-react";
import KpiCard from "./KpiCard";
import { formatCurrencyShort, formatCurrency } from "../../../api/dashboardApi";

/**
 * 일별 KPI 카드 2행 컴포넌트.
 * 1행: 매출/달성률/고객수/테이블단가
 * 2행: 지출/순이익/할인액/서비스액
 *
 * @param {object} data - 일별 KPI API 응답 데이터
 * @param {boolean} loading - 로딩 상태
 */
const DailyKpiRow = ({ data, loading }) => {
  // 순이익 색상 결정 (양수: 초록, 음수: 빨강)
  const netProfitColor = data?.net_profit >= 0 ? "text-green-600" : "text-red-500";

  // 달성률 색상 결정 (100% 이상: 초록, 70% 이상: 파랑, 미달: 빨강)
  const achievementColor = () => {
    if (!data) return "text-slate-400";
    const rate = data.achievement_rate;
    if (rate >= 100) return "text-green-600";
    if (rate >= 70) return "text-blue-500";
    return "text-red-500";
  };

  return (
    <>
      {/* ─── 1행: 매출 KPI 4개 ─── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        {/* 당일 매출 */}
        <KpiCard
          icon={<DollarSign size={20} className="text-blue-500" />}
          iconBg="bg-blue-50"
          title="당일 매출"
          value={data ? formatCurrencyShort(data.total_sales) : "—"}
          subtext={data ? `목표 ${formatCurrencyShort(data.target_sales)}` : null}
          subtextColor="text-slate-500"
          loading={loading}
        />

        {/* 목표 달성률 */}
        <KpiCard
          icon={<Target size={20} className="text-indigo-500" />}
          iconBg="bg-indigo-50"
          title="목표 달성률"
          value={data ? `${data.achievement_rate.toFixed(1)}%` : "—"}
          subtext={data ? `일 목표 ${formatCurrencyShort(data.target_sales)}` : null}
          subtextColor={achievementColor()}
          loading={loading}
        />

        {/* 고객수 */}
        <KpiCard
          icon={<Users size={20} className="text-teal-500" />}
          iconBg="bg-teal-50"
          title="고객수"
          value={data ? `${data.customer_count.toLocaleString()}명` : "—"}
          subtext={data ? `영수 ${data.receipt_count}건` : null}
          subtextColor="text-slate-500"
          loading={loading}
        />

        {/* 테이블 단가 */}
        <KpiCard
          icon={<Receipt size={20} className="text-purple-500" />}
          iconBg="bg-purple-50"
          title="테이블 단가"
          value={data ? formatCurrencyShort(data.table_average) : "—"}
          subtext={data ? "영수건 당 평균" : null}
          subtextColor="text-slate-500"
          loading={loading}
        />
      </div>

      {/* ─── 2행: 지출/순이익/할인/서비스 ─── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {/* 당일 지출 */}
        <KpiCard
          icon={<TrendingDown size={20} className="text-red-500" />}
          iconBg="bg-red-50"
          title="당일 지출"
          value={data ? formatCurrencyShort(data.total_expense) : "—"}
          loading={loading}
        />

        {/* 당일 순이익 */}
        <KpiCard
          icon={<TrendingUp size={20} className="text-green-500" />}
          iconBg="bg-green-50"
          title="당일 순이익"
          value={data ? formatCurrencyShort(data.net_profit) : "—"}
          subtextColor={netProfitColor}
          loading={loading}
        />

        {/* 할인액 */}
        <KpiCard
          icon={<Tag size={20} className="text-orange-500" />}
          iconBg="bg-orange-50"
          title="할인액"
          value={data ? formatCurrency(data.discount_amount) : "—"}
          loading={loading}
        />

        {/* 서비스액 */}
        <KpiCard
          icon={<Gift size={20} className="text-rose-500" />}
          iconBg="bg-rose-50"
          title="서비스액"
          value={data ? formatCurrency(data.service_amount) : "—"}
          loading={loading}
        />
      </div>
    </>
  );
};

export default DailyKpiRow;
