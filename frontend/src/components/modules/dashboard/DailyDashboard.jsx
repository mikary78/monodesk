// ============================================================
// DailyDashboard.jsx — 일별 대시보드 메인 컴포넌트
// 특정 날짜의 매출/지출 KPI, 전일·전주 비교, 월 누적 현황,
// 결제수단별 도넛 차트를 제공합니다.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { getDailyKpi, formatCurrencyShort, formatCurrency } from "../../../api/dashboardApi";
import DailyKpiRow from "./DailyKpiRow";
import DailyCompareBanner from "./DailyCompareBanner";

/**
 * 날짜 문자열을 YYYY.MM.DD(요일) 형식으로 변환합니다.
 * @param {string} dateStr - YYYY-MM-DD 형식 날짜
 * @returns {string} 포맷된 날짜 문자열
 */
const formatDateKr = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const dow = days[d.getDay()];
  return `${dateStr.replace(/-/g, ".")}(${dow})`;
};

/**
 * 오늘 날짜를 YYYY-MM-DD 문자열로 반환합니다.
 */
const getTodayStr = () => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
};

/**
 * 날짜 문자열에서 N일을 더한 날짜 문자열을 반환합니다.
 * @param {string} dateStr - YYYY-MM-DD
 * @param {number} days - 더할 일수 (음수 가능)
 */
const addDays = (dateStr, days) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// 결제수단 도넛 차트 색상
const PIE_COLORS = ["#3B82F6", "#10B981", "#F59E0B"];

/**
 * 일별 대시보드 메인 컴포넌트.
 * 날짜 네비게이션, KPI 카드, 비교 배너, 월 누적 박스, 결제 도넛 차트를 포함합니다.
 */
const DailyDashboard = () => {
  const today = getTodayStr();

  // 현재 조회 날짜 상태 (기본값: 오늘)
  const [date, setDate] = useState(today);
  // API 응답 데이터
  const [data, setData] = useState(null);
  // 로딩/에러 상태
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * 일별 KPI 데이터를 불러옵니다.
   */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDailyKpi(date);
      setData(result);
    } catch (err) {
      setError(err.message || "데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  // 날짜 변경 시 재조회
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 이전 날로 이동
  const handlePrevDay = () => setDate((d) => addDays(d, -1));

  // 다음 날로 이동 (오늘 이후 불가)
  const handleNextDay = () => {
    if (date >= today) return;
    setDate((d) => addDays(d, 1));
  };

  // 오늘로 이동
  const handleToday = () => setDate(today);

  // 결제수단별 파이 차트 데이터 생성
  const pieData = data
    ? [
        { name: "카드", value: data.card_sales },
        { name: "현금", value: data.cash_sales },
        { name: "배달", value: data.delivery_sales },
      ].filter((item) => item.value > 0)
    : [];

  // 월 목표 진행 바 비율 계산
  const progressRatio = data
    ? Math.min((data.business_days_passed / data.business_days_total) * 100, 100)
    : 0;

  return (
    <div>
      {/* ─── 날짜 네비게이션 ─── */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={handlePrevDay}
          className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white transition-colors"
        >
          <ChevronLeft size={16} className="text-slate-500" />
        </button>

        <div className="flex items-center gap-2 px-4 h-9 border border-slate-200 rounded-md bg-white min-w-[180px] justify-center">
          <Calendar size={14} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-900">
            {formatDateKr(date)}
          </span>
        </div>

        <button
          onClick={handleNextDay}
          disabled={date >= today}
          className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} className="text-slate-500" />
        </button>

        {/* 오늘 버튼 */}
        {date !== today && (
          <button
            onClick={handleToday}
            className="h-9 px-3 text-sm font-medium text-blue-500 border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
          >
            오늘
          </button>
        )}
      </div>

      {/* ─── 에러 메시지 ─── */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* ─── KPI 카드 2행 ─── */}
      <DailyKpiRow data={data} loading={loading} />

      {/* ─── 전일/전주 비교 배너 ─── */}
      <DailyCompareBanner data={data} loading={loading} />

      {/* ─── 하단: 월 누적 현황 + 결제수단 차트 ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* 월 누적 현황 박스 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            {date.slice(0, 7).replace("-", "년 ")}월 누적 현황
          </h3>

          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-5 bg-slate-200 rounded w-2/3" />
              <div className="h-5 bg-slate-200 rounded w-1/2" />
              <div className="h-3 bg-slate-200 rounded w-full mt-4" />
            </div>
          ) : data ? (
            <>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">월 누적 매출</p>
                  <p className="text-xl font-bold text-slate-900">
                    {formatCurrencyShort(data.monthly_total_sales)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">월 목표 달성률</p>
                  <p className={`text-xl font-bold ${data.monthly_achievement_rate >= 100 ? "text-green-600" : "text-blue-500"}`}>
                    {data.monthly_achievement_rate.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">월 누적 지출</p>
                  <p className="text-lg font-semibold text-slate-700">
                    {formatCurrencyShort(data.monthly_total_expense)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">월 누적 순이익</p>
                  <p className={`text-lg font-semibold ${data.monthly_net_profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {formatCurrencyShort(data.monthly_net_profit)}
                  </p>
                </div>
              </div>

              {/* 영업일 진행 바 */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>영업일 경과</span>
                  <span>{data.business_days_passed} / {data.business_days_total}일</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${progressRatio}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">데이터가 없습니다.</p>
          )}
        </div>

        {/* 결제수단 도넛 차트 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">결제수단 비율</h3>

          {loading ? (
            <div className="animate-pulse flex items-center justify-center h-40">
              <div className="w-32 h-32 rounded-full bg-slate-200" />
            </div>
          ) : pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40">
              <p className="text-sm text-slate-400">매출 데이터가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyDashboard;
