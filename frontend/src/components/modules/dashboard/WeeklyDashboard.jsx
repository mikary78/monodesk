// ============================================================
// WeeklyDashboard.jsx — 주별 대시보드 컴포넌트
// 해당 주의 요일별 매출 막대그래프, 주간 KPI, 전주 대비를 제공합니다.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Users, DollarSign } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from "recharts";
import { getWeeklyKpi, formatCurrencyShort, formatGrowthRate } from "../../../api/dashboardApi";
import KpiCard from "./KpiCard";

/**
 * 오늘 날짜를 YYYY-MM-DD 문자열로 반환합니다.
 */
const getTodayStr = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

/**
 * 날짜 문자열에서 N일을 더한 날짜 문자열을 반환합니다.
 */
const addDays = (dateStr, days) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * 날짜 문자열에서 n월 n주차 레이블을 생성합니다.
 * @param {string} weekStartStr - 주 시작 날짜 (YYYY-MM-DD)
 * @returns {string} 예: "4월 2주차"
 */
const getWeekLabel = (weekStartStr) => {
  if (!weekStartStr) return "";
  const d = new Date(weekStartStr + "T00:00:00");
  const month = d.getMonth() + 1;
  // 해당 월 첫 날 기준 주차 계산
  const firstDayOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  const weekNum = Math.ceil((d.getDate() + firstDayOfMonth.getDay()) / 7);
  return `${month}월 ${weekNum}주차`;
};

/**
 * 커스텀 툴팁 컴포넌트 (금액 포맷 적용).
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      <p className="text-blue-600">매출: {formatCurrencyShort(payload[0]?.value)}</p>
      {payload[0]?.payload?.customer_count > 0 && (
        <p className="text-slate-500">고객: {payload[0].payload.customer_count}명</p>
      )}
    </div>
  );
};

/**
 * 주별 대시보드 메인 컴포넌트.
 * 주 네비게이션, 4개 KPI 카드, 요일별 막대 차트, 전주 대비 정보를 포함합니다.
 */
const WeeklyDashboard = () => {
  const today = getTodayStr();

  // 기준 날짜 상태 (이 날짜가 속한 주를 조회)
  const [date, setDate] = useState(today);
  // API 응답 데이터
  const [data, setData] = useState(null);
  // 로딩/에러 상태
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * 주별 KPI 데이터를 불러옵니다.
   */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getWeeklyKpi(date);
      setData(result);
    } catch (err) {
      setError(err.message || "데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 이전 주: 기준 날짜 -7일
  const handlePrevWeek = () => setDate((d) => addDays(d, -7));

  // 다음 주: 기준 날짜 +7일 (이번 주 이후 불가)
  const handleNextWeek = () => {
    const nextWeek = addDays(date, 7);
    if (nextWeek > today) return;
    setDate(nextWeek);
  };

  // 이번 주 여부 판단 (다음 주 버튼 비활성화 기준)
  const isCurrentWeek = addDays(date, 7) > today;

  // 순이익 색상 결정
  const netProfitColor =
    data?.weekly_net_profit >= 0 ? "text-green-600" : "text-red-500";

  // 전주 대비 색상 결정
  const prevWeekDiffColor =
    (data?.prev_week_diff ?? 0) >= 0 ? "text-green-600" : "text-red-500";

  // 막대 차트 데이터 생성
  const chartData = data?.daily_breakdown?.map((b) => ({
    name: b.day_of_week,
    sales: b.total_sales,
    customer_count: b.customer_count,
    is_holiday: b.is_holiday,
  })) || [];

  // 최고 매출 인덱스 (막대 색상 강조용)
  const maxSalesIdx = chartData.reduce(
    (maxIdx, item, idx, arr) =>
      item.sales > arr[maxIdx].sales ? idx : maxIdx,
    0
  );

  return (
    <div>
      {/* ─── 주 네비게이션 ─── */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={handlePrevWeek}
          className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white transition-colors"
        >
          <ChevronLeft size={16} className="text-slate-500" />
        </button>

        <div className="px-4 h-9 flex items-center border border-slate-200 rounded-md bg-white min-w-[140px] justify-center">
          <span className="text-sm font-semibold text-slate-900">
            {data ? getWeekLabel(data.week_start) : "—"}
          </span>
        </div>

        <button
          onClick={handleNextWeek}
          disabled={isCurrentWeek}
          className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} className="text-slate-500" />
        </button>

        {/* 주간 날짜 범위 표시 */}
        {data && (
          <span className="text-sm text-slate-400">
            {data.week_start.replace(/-/g, ".")} ~ {data.week_end.replace(/-/g, ".")}
          </span>
        )}
      </div>

      {/* ─── 에러 메시지 ─── */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* ─── 4개 KPI 카드 ─── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          icon={<DollarSign size={20} className="text-blue-500" />}
          iconBg="bg-blue-50"
          title="주간 매출"
          value={data ? formatCurrencyShort(data.weekly_total_sales) : "—"}
          subtext={data ? `전주 대비 ${formatGrowthRate(data.prev_week_diff)}` : null}
          subtextColor={prevWeekDiffColor}
          loading={loading}
        />
        <KpiCard
          icon={<TrendingDown size={20} className="text-red-500" />}
          iconBg="bg-red-50"
          title="주간 지출"
          value={data ? formatCurrencyShort(data.weekly_total_expense) : "—"}
          loading={loading}
        />
        <KpiCard
          icon={<TrendingUp size={20} className="text-green-500" />}
          iconBg="bg-green-50"
          title="주간 순이익"
          value={data ? formatCurrencyShort(data.weekly_net_profit) : "—"}
          subtextColor={netProfitColor}
          loading={loading}
        />
        <KpiCard
          icon={<Users size={20} className="text-teal-500" />}
          iconBg="bg-teal-50"
          title="주간 고객수"
          value={data ? `${data.weekly_customer_count.toLocaleString()}명` : "—"}
          loading={loading}
        />
      </div>

      {/* ─── 요일별 매출 막대그래프 ─── */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">요일별 매출</h3>

          {/* 베스트/워스트 요일 배지 */}
          {data && (
            <div className="flex gap-2">
              {data.best_day && (
                <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full font-medium">
                  최고: {data.best_day}요일
                </span>
              )}
              {data.worst_day && data.worst_day !== data.best_day && (
                <span className="text-xs px-2 py-1 bg-red-50 text-red-500 rounded-full font-medium">
                  최저: {data.worst_day}요일
                </span>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="animate-pulse h-52 bg-slate-100 rounded" />
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748B" }} />
              <YAxis tickFormatter={(v) => `${Math.round(v / 10000)}만`} tick={{ fontSize: 11, fill: "#94A3B8" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="sales" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.is_holiday
                        ? "#CBD5E1"
                        : index === maxSalesIdx
                        ? "#3B82F6"
                        : "#93C5FD"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-52">
            <p className="text-sm text-slate-400">데이터가 없습니다.</p>
          </div>
        )}

        {/* 범례: 최고/휴무 */}
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span>최고 매출일</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <div className="w-3 h-3 rounded-sm bg-blue-300" />
            <span>영업일</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <div className="w-3 h-3 rounded-sm bg-slate-300" />
            <span>휴무일</span>
          </div>
        </div>
      </div>

      {/* ─── 전주 대비 요약 ─── */}
      {data && (
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-4">
          <span className="text-sm text-slate-500">전주 총 매출</span>
          <span className="font-semibold text-slate-700">{formatCurrencyShort(data.prev_week_total)}</span>
          <span className="text-slate-300">|</span>
          <span className="text-sm text-slate-500">전주 대비</span>
          <span className={`font-semibold ${prevWeekDiffColor}`}>
            {formatGrowthRate(data.prev_week_diff)}
          </span>
        </div>
      )}
    </div>
  );
};

export default WeeklyDashboard;
