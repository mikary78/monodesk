// ============================================================
// MonthlyDashboard.jsx — 월별 대시보드 컴포넌트
// 월간 손익 구조, 달력 히트맵, 주차별 트렌드를 종합적으로 제공합니다.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, DollarSign, TrendingUp, TrendingDown, BarChart2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { getMonthlyKpi, formatCurrencyShort, formatGrowthRate } from "../../../api/dashboardApi";
import KpiCard from "./KpiCard";
import MonthlyCalendarHeatmap from "./MonthlyCalendarHeatmap";

/**
 * 오늘 날짜 기준 연/월을 반환합니다.
 */
const getTodayYearMonth = () => {
  const t = new Date();
  return { year: t.getFullYear(), month: t.getMonth() + 1 };
};

/**
 * 손익 구조 트리 항목 컴포넌트.
 * 비용 항목과 금액, 매출 대비 비율을 표시합니다.
 *
 * @param {string} label - 항목명
 * @param {number} amount - 금액
 * @param {number} rate - 비율 (%)
 * @param {string} color - 색상 클래스 (text-red-500 등)
 * @param {boolean} isLast - 마지막 항목 여부 (선 스타일 다름)
 */
const CostTreeItem = ({ label, amount, rate, color = "text-slate-700", isLast = false }) => (
  <div className={`flex items-center justify-between py-2 ${!isLast ? "border-b border-slate-100" : ""}`}>
    <div className="flex items-center gap-2">
      <span className="text-slate-300 text-sm">{isLast ? "└" : "├"}</span>
      <span className="text-sm text-slate-600">{label}</span>
    </div>
    <div className="flex items-center gap-3">
      {rate !== undefined && (
        <span className={`text-xs font-medium ${color} bg-opacity-10 px-2 py-0.5 rounded`}>
          {rate.toFixed(1)}%
        </span>
      )}
      <span className={`text-sm font-semibold ${color}`}>{formatCurrencyShort(amount)}</span>
    </div>
  </div>
);

/**
 * 커스텀 주차별 바 차트 툴팁.
 */
const WeeklyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}주차</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrencyShort(p.value)}
        </p>
      ))}
    </div>
  );
};

/**
 * 월별 대시보드 메인 컴포넌트.
 * 월 네비게이션, 4개 핵심 KPI, 손익 구조, 달력 히트맵, 주차별 차트를 포함합니다.
 */
const MonthlyDashboard = () => {
  const { year: initYear, month: initMonth } = getTodayYearMonth();

  // 조회 연/월 상태
  const [year, setYear] = useState(initYear);
  const [month, setMonth] = useState(initMonth);
  // API 응답 데이터
  const [data, setData] = useState(null);
  // 로딩/에러 상태
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * 월별 KPI 데이터를 불러옵니다.
   */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMonthlyKpi(year, month);
      setData(result);
    } catch (err) {
      setError(err.message || "데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 이전 달로 이동
  const handlePrevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };

  // 다음 달로 이동 (이번 달 이후 불가)
  const handleNextMonth = () => {
    const isCurrentMonth = year === initYear && month === initMonth;
    if (isCurrentMonth) return;
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };

  const isCurrentMonth = year === initYear && month === initMonth;

  // 전월 대비 색상
  const growthColor =
    (data?.sales_growth_rate ?? 0) >= 0 ? "text-green-600" : "text-red-500";

  // 주차별 차트 데이터
  const weeklyChartData = data?.weekly_trend?.map((w) => ({
    name: `${w.week}주`,
    매출: w.sales,
    지출: w.expense,
  })) || [];

  return (
    <div>
      {/* ─── 월 네비게이션 ─── */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={handlePrevMonth}
          className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white transition-colors"
        >
          <ChevronLeft size={16} className="text-slate-500" />
        </button>

        <div className="px-4 h-9 flex items-center border border-slate-200 rounded-md bg-white min-w-[130px] justify-center">
          <span className="text-sm font-semibold text-slate-900">
            {year}년 {month}월
          </span>
        </div>

        <button
          onClick={handleNextMonth}
          disabled={isCurrentMonth}
          className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} className="text-slate-500" />
        </button>
      </div>

      {/* ─── 에러 메시지 ─── */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* ─── 4개 핵심 KPI 카드 ─── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<DollarSign size={20} className="text-blue-500" />}
          iconBg="bg-blue-50"
          title="월 매출"
          value={data ? formatCurrencyShort(data.total_sales) : "—"}
          subtext={data ? `전월 대비 ${formatGrowthRate(data.sales_growth_rate)}` : null}
          subtextColor={growthColor}
          loading={loading}
        />
        <KpiCard
          icon={<TrendingUp size={20} className="text-green-500" />}
          iconBg="bg-green-50"
          title="월 순이익"
          value={data ? formatCurrencyShort(data.net_profit) : "—"}
          subtext={data ? `이익률 ${data.profit_margin.toFixed(1)}%` : null}
          subtextColor={data?.net_profit >= 0 ? "text-green-600" : "text-red-500"}
          loading={loading}
        />
        <KpiCard
          icon={<TrendingDown size={20} className="text-purple-500" />}
          iconBg="bg-purple-50"
          title="이익률"
          value={data ? `${data.profit_margin.toFixed(1)}%` : "—"}
          loading={loading}
        />
        <KpiCard
          icon={<BarChart2 size={20} className="text-amber-500" />}
          iconBg="bg-amber-50"
          title="일 평균 매출"
          value={data ? formatCurrencyShort(data.avg_daily_sales) : "—"}
          loading={loading}
        />
      </div>

      {/* ─── 하단 2열 레이아웃: 손익 구조 + 달력 히트맵 ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
        {/* 손익 구조 트리 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">손익 구조</h3>

          {loading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 bg-slate-100 rounded" />
              ))}
            </div>
          ) : data ? (
            <div>
              {/* 매출 총액 */}
              <div className="flex justify-between items-center py-2 border-b border-slate-200 mb-2">
                <span className="text-sm font-semibold text-slate-800">매출</span>
                <span className="text-sm font-bold text-blue-600">
                  {formatCurrencyShort(data.total_sales)}
                </span>
              </div>

              {/* 비용 항목들 */}
              <CostTreeItem
                label="원재료비"
                amount={data.food_cost_total}
                rate={data.food_cost_rate}
                color="text-orange-500"
              />
              <CostTreeItem
                label="인건비"
                amount={data.labor_cost_total}
                rate={data.labor_cost_rate}
                color="text-red-500"
              />
              <CostTreeItem
                label="고정비"
                amount={data.fixed_cost_total}
                color="text-purple-500"
              />

              {/* 순이익 */}
              <CostTreeItem
                label="순이익"
                amount={data.net_profit}
                color={data.net_profit >= 0 ? "text-green-600" : "text-red-500"}
                isLast
              />

              {/* 매출 최고일 */}
              {data.top_sales_day && (
                <p className="text-xs text-slate-400 mt-3">
                  최고 매출일: {data.top_sales_day.replace(/-/g, ".")}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">데이터가 없습니다.</p>
          )}
        </div>

        {/* 달력 히트맵 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">일별 매출 현황</h3>
          <MonthlyCalendarHeatmap
            year={year}
            month={month}
            dailyTrend={data?.daily_trend || []}
            loading={loading}
          />
        </div>
      </div>

      {/* ─── 주차별 트렌드 바 차트 ─── */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">주차별 매출/지출</h3>

        {loading ? (
          <div className="animate-pulse h-48 bg-slate-100 rounded" />
        ) : weeklyChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyChartData} barGap={4} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748B" }} />
              <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}만`} tick={{ fontSize: 11, fill: "#94A3B8" }} />
              <Tooltip content={<WeeklyTooltip />} />
              <Legend />
              <Bar dataKey="매출" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="지출" fill="#F87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm text-slate-400">데이터가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyDashboard;
