// ============================================================
// DashboardPage.jsx — 대시보드 메인 페이지 (Step 6)
// 모든 모듈의 핵심 지표를 한 눈에 볼 수 있는 통합 현황판입니다.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Minus,
  Package,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  fetchDashboardSummary,
  formatCurrencyShort,
  formatCurrency,
  formatGrowthRate,
} from "../api/dashboardApi";
import KpiCard from "../components/modules/dashboard/KpiCard";
import SalesTrendChart from "../components/modules/dashboard/SalesTrendChart";
import LowStockAlertList from "../components/modules/dashboard/LowStockAlertList";
import RecentExpenseList from "../components/modules/dashboard/RecentExpenseList";
import SalaryStatusCard from "../components/modules/dashboard/SalaryStatusCard";

/**
 * 대시보드 페이지.
 * 월을 선택하면 해당 월 기준 KPI를 자동으로 불러옵니다.
 */
const DashboardPage = () => {
  const today = new Date();

  // 조회 연월 상태 (기본값: 이번 달)
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  // 대시보드 데이터 상태
  const [data, setData] = useState(null);

  // 로딩 및 에러 상태
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * 대시보드 데이터 불러오기.
   * 연월이 변경될 때마다 재요청합니다.
   */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDashboardSummary(year, month);
      setData(result);
    } catch (err) {
      setError(err.message || "데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  // 연월 변경 시 데이터 재조회
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * 이전 달로 이동합니다.
   */
  const handlePrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  /**
   * 다음 달로 이동합니다. 이번 달 이후로는 이동 불가합니다.
   */
  const handleNextMonth = () => {
    const isCurrentMonth =
      year === today.getFullYear() && month === today.getMonth() + 1;
    if (isCurrentMonth) return;
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // 이번 달 여부 (다음 달 버튼 비활성화 판단용)
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth() + 1;

  // ─────────────────────────────────────────
  // KPI 데이터 파생 (증감률 색상 등)
  // ─────────────────────────────────────────

  // 매출 증감률 컬러 결정
  const salesGrowthColor = () => {
    if (!data?.profit_loss?.sales_growth_rate) return "text-slate-400";
    return data.profit_loss.sales_growth_rate >= 0
      ? "text-green-600"
      : "text-red-500";
  };

  // 매출 증감률 아이콘 결정
  const SalesGrowthIcon = () => {
    if (!data?.profit_loss?.sales_growth_rate) return <Minus size={14} />;
    return data.profit_loss.sales_growth_rate >= 0 ? (
      <TrendingUp size={14} />
    ) : (
      <TrendingDown size={14} />
    );
  };

  // 순이익 색상 결정
  const netProfitColor = () => {
    if (!data) return "text-slate-900";
    return data.profit_loss.net_profit >= 0 ? "text-green-600" : "text-red-500";
  };

  return (
    <div className="p-8 bg-slate-50 min-h-full">
      {/* ─── 페이지 헤더 ─── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LayoutDashboard size={24} className="text-blue-500" />
          <h1 className="text-2xl font-bold text-slate-900">대시보드</h1>
          <span className="text-sm text-slate-400">여남동 운영 현황</span>
        </div>

        {/* 월 선택 컨트롤 */}
        <div className="flex items-center gap-2">
          {/* 새로고침 버튼 */}
          <button
            onClick={loadData}
            disabled={loading}
            className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white transition-colors disabled:opacity-40"
            title="새로고침"
          >
            <RefreshCw
              size={15}
              className={`text-slate-500 ${loading ? "animate-spin" : ""}`}
            />
          </button>

          {/* 이전 달 버튼 */}
          <button
            onClick={handlePrevMonth}
            className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white transition-colors"
            title="이전 달"
          >
            <ChevronLeft size={16} className="text-slate-500" />
          </button>

          {/* 현재 연월 표시 */}
          <div className="h-9 px-4 flex items-center border border-slate-200 rounded-md bg-white text-sm font-semibold text-slate-900 min-w-[120px] justify-center">
            {year}년 {month}월
          </div>

          {/* 다음 달 버튼 (이번 달이면 비활성) */}
          <button
            onClick={handleNextMonth}
            disabled={isCurrentMonth}
            className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="다음 달"
          >
            <ChevronRight size={16} className="text-slate-500" />
          </button>
        </div>
      </div>

      {/* ─── 에러 메시지 ─── */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <span className="text-red-600 text-sm">{error}</span>
          <button
            onClick={loadData}
            className="ml-auto text-sm text-red-600 font-medium underline hover:no-underline"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* ─── 1행: KPI 카드 4개 — 반응형: 1열→2열→4열 ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {/* 이번 달 매출 */}
        <KpiCard
          icon={<DollarSign size={20} className="text-blue-500" />}
          iconBg="bg-blue-50"
          title="이번 달 매출"
          value={
            data ? formatCurrencyShort(data.profit_loss.total_sales) : "—"
          }
          subtext={
            data
              ? `전월 대비 ${formatGrowthRate(data.profit_loss.sales_growth_rate)}`
              : null
          }
          subtextColor={salesGrowthColor()}
          loading={loading}
        />

        {/* 이번 달 지출 */}
        <KpiCard
          icon={<TrendingDown size={20} className="text-red-500" />}
          iconBg="bg-red-50"
          title="이번 달 지출"
          value={
            data ? formatCurrencyShort(data.profit_loss.total_expense) : "—"
          }
          loading={loading}
        />

        {/* 순이익 */}
        <KpiCard
          icon={<TrendingUp size={20} className="text-green-500" />}
          iconBg="bg-green-50"
          title="순이익"
          value={
            data ? formatCurrencyShort(data.profit_loss.net_profit) : "—"
          }
          subtext={
            data
              ? `이익률 ${data.profit_loss.profit_margin.toFixed(1)}%`
              : null
          }
          subtextColor={netProfitColor()}
          loading={loading}
        />

        {/* 발주 현황 */}
        <KpiCard
          icon={<Package size={20} className="text-amber-500" />}
          iconBg="bg-amber-50"
          title="발주 진행 중"
          value={data ? `${data.order_status.pending_orders}건` : "—"}
          subtext={
            data && data.order_status.expected_today > 0
              ? `오늘 입고 예정 ${data.order_status.expected_today}건`
              : data
              ? "오늘 입고 예정 없음"
              : null
          }
          subtextColor={
            data && data.order_status.expected_today > 0
              ? "text-amber-600"
              : "text-slate-400"
          }
          loading={loading}
        />
      </div>

      {/* ─── 2행: 매출 트렌드 차트 + 재고 경고 ─── */}
      <div className="grid grid-cols-5 gap-4 mb-4">
        {/* 매출 트렌드 차트 (60%) */}
        <div className="col-span-3">
          <SalesTrendChart
            data={data?.monthly_trend || []}
            loading={loading}
          />
        </div>

        {/* 재고 부족 경고 (40%) */}
        <div className="col-span-2">
          <LowStockAlertList
            alerts={data?.low_stock_alerts || []}
            loading={loading}
          />
        </div>
      </div>

      {/* ─── 3행: 최근 지출 내역 + 급여 현황 ─── */}
      <div className="grid grid-cols-2 gap-4">
        {/* 최근 지출 5건 */}
        <RecentExpenseList
          expenses={data?.recent_expenses || []}
          loading={loading}
        />

        {/* 이번 달 급여 현황 */}
        <SalaryStatusCard
          salaryKpi={data?.salary_kpi || null}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default DashboardPage;
