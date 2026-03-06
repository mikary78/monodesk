// ============================================================
// ProfitLossCard.jsx — 손익 현황 KPI 카드 컴포넌트
// 월별 매출, 지출, 순이익, 전월 대비 증감률을 표시합니다.
// ============================================================

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { fetchProfitLoss, formatCurrency, formatPercent } from "../../../api/accountingApi";

/**
 * 개별 KPI 카드 컴포넌트
 * @param {string} title - 카드 제목
 * @param {number} value - 표시할 수치
 * @param {string} icon - 아이콘 컴포넌트
 * @param {number|null} growthRate - 전월 대비 증감률 (%)
 * @param {string} color - 금액 표시 색상
 */
const KpiCard = ({ title, value, Icon, growthRate = null, color = "text-slate-900" }) => {
  // 증감률 양수 여부
  const isPositive = growthRate !== null && growthRate >= 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* 카드 제목 + 아이콘 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-500">{title}</span>
        {Icon && <Icon size={20} className="text-slate-300" />}
      </div>

      {/* 핵심 수치 (32px Bold) */}
      <div className={`text-3xl font-bold ${color} mb-2`}>
        {formatCurrency(value)}
      </div>

      {/* 전월 대비 증감률 */}
      {growthRate !== null && (
        <div className={`flex items-center gap-1 text-sm font-medium ${
          isPositive ? "text-green-500" : "text-red-500"
        }`}>
          {isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          <span>지난달 대비 {formatPercent(growthRate, true)}</span>
        </div>
      )}
    </div>
  );
};

/**
 * 손익 현황 카드 그룹 컴포넌트.
 * 매출, 지출, 순이익 KPI 카드와 카테고리별 지출 차트를 표시합니다.
 * @param {number} year - 조회 연도
 * @param {number} month - 조회 월
 */
const ProfitLossCard = ({ year, month }) => {
  // 손익 데이터 상태
  const [data, setData] = useState(null);
  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false);
  // 에러 메시지
  const [error, setError] = useState(null);

  // 연월 변경 시 손익 데이터 다시 불러오기
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchProfitLoss(year, month);
        setData(result);
      } catch (err) {
        setError("손익 데이터를 불러오지 못했습니다.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [year, month]);

  if (isLoading) {
    // 로딩 스켈레톤
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 h-32 animate-pulse bg-slate-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!data) return null;

  // 순이익 색상 결정 (양수: Green, 음수: Red)
  const profitColor = data.gross_profit >= 0 ? "text-green-500" : "text-red-500";

  return (
    <div className="space-y-4">
      {/* KPI 카드 3개 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 총 매출 카드 */}
        <KpiCard
          title="이번 달 매출"
          value={data.total_sales}
          Icon={TrendingUp}
          growthRate={data.sales_growth_rate}
        />
        {/* 총 지출 카드 */}
        <KpiCard
          title="이번 달 지출"
          value={data.total_expense}
          Icon={TrendingDown}
          color="text-slate-900"
        />
        {/* 순이익 카드 */}
        <KpiCard
          title="순이익"
          value={data.gross_profit}
          Icon={DollarSign}
          color={profitColor}
        />
      </div>

      {/* 매출 구성 + 지출 카테고리 분석 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 매출 구성 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-sm font-semibold text-slate-900 mb-4">매출 구성</h4>
          <div className="space-y-3">
            {[
              { label: "카드 매출", value: data.card_sales, color: "#3B82F6" },
              { label: "현금 매출", value: data.cash_sales, color: "#22C55E" },
              { label: "배달앱 매출", value: data.delivery_sales, color: "#F59E0B" },
            ].map(({ label, value, color }) => {
              // 매출 비중 계산
              const ratio = data.total_sales > 0 ? (value / data.total_sales) * 100 : 0;
              return (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{label}</span>
                    <span className="font-medium text-slate-900">{formatCurrency(value)}</span>
                  </div>
                  {/* 비율 바 */}
                  <div className="h-1.5 bg-slate-100 rounded-full">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${ratio}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 지출 카테고리별 분석 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="text-sm font-semibold text-slate-900 mb-4">
            지출 카테고리별
            <span className="ml-2 text-xs font-normal text-slate-400">
              이익률 {data.profit_margin}%
            </span>
          </h4>
          <div className="space-y-2">
            {data.expense_by_category
              .filter((cat) => cat.total > 0)
              .sort((a, b) => b.total - a.total)
              .slice(0, 5)
              .map((cat) => {
                // 지출 비중 계산
                const ratio = data.total_expense > 0 ? (cat.total / data.total_expense) * 100 : 0;
                return (
                  <div key={cat.category_name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">{cat.category_name}</span>
                      <span className="font-medium text-slate-900">{formatCurrency(cat.total)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full">
                      <div
                        className="h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${ratio}%`, backgroundColor: cat.category_color || "#64748B" }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitLossCard;
