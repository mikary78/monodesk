// ============================================================
// TimeAnalysis.jsx — 시간대/요일 분석 탭 컴포넌트
// 요일별, 시간대별 매출 패턴과 피크 타임 분석 화면입니다.
// ============================================================

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Clock, Calendar, Zap } from "lucide-react";
import { fetchTimeAnalysis, formatCurrency } from "../../../api/salesAnalysisApi";

// 요일별 색상 (주말 강조)
const WEEKDAY_COLORS = [
  "#60a5fa", "#60a5fa", "#60a5fa", "#60a5fa", "#60a5fa", "#f59e0b", "#ef4444",
];

// 시간대 활성도에 따른 색상 그라데이션
function getHourColor(amount, maxAmount) {
  if (maxAmount <= 0 || amount <= 0) return "#f1f5f9";
  const ratio = amount / maxAmount;
  if (ratio >= 0.8) return "#1d4ed8";
  if (ratio >= 0.6) return "#3b82f6";
  if (ratio >= 0.4) return "#60a5fa";
  if (ratio >= 0.2) return "#93c5fd";
  return "#dbeafe";
}

// 커스텀 툴팁
const BarTooltip = ({ active, payload, label, unit = "원" }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      <p className="text-blue-600">매출: {Number(payload[0]?.value || 0).toLocaleString()}{unit}</p>
    </div>
  );
};

// 시간대/요일 분석 컴포넌트
const TimeAnalysis = ({ year, month }) => {
  // 분석 데이터
  const [data, setData] = useState(null);
  // 로딩 상태
  const [loading, setLoading] = useState(true);

  // year, month 변경 시 데이터 재조회
  useEffect(() => {
    loadData();
  }, [year, month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchTimeAnalysis(year, month);
      setData(result);
    } catch (err) {
      console.error("시간대 분석 데이터 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => <div key={i} className="h-48 bg-slate-100 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  // 데이터가 없는 경우 (전체 0)
  const hasData = data && (
    data.weekday_data.some((d) => d.amount > 0) ||
    data.hourly_data.some((d) => d.amount > 0)
  );

  if (!hasData) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-16 text-center">
        <Clock size={48} className="mx-auto text-slate-200 mb-4" />
        <p className="text-sm text-slate-400">표시할 시간대 분석 데이터가 없습니다.</p>
        <p className="text-xs text-slate-300 mt-1">POS 연동 탭에서 데이터를 가져와주세요.</p>
      </div>
    );
  }

  // 최대값 계산 (색상 그라데이션용)
  const maxHourAmount = Math.max(...(data?.hourly_data.map((h) => h.amount) || [0]));

  return (
    <div className="space-y-6">
      {/* 피크 타임 인사이트 카드 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 피크 시간대 */}
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap size={20} className="text-blue-500" />
          </div>
          <div>
            <p className="text-xs text-slate-400">가장 바쁜 시간대</p>
            <p className="text-lg font-bold text-slate-900">
              {data?.peak_hour !== null && data?.peak_hour !== undefined
                ? `${String(data.peak_hour).padStart(2, "0")}:00`
                : "-"}
            </p>
          </div>
        </div>

        {/* 가장 바쁜 요일 */}
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Calendar size={20} className="text-yellow-500" />
          </div>
          <div>
            <p className="text-xs text-slate-400">가장 바쁜 요일</p>
            <p className="text-lg font-bold text-slate-900">
              {data?.peak_weekday !== null && data?.peak_weekday !== undefined
                ? ["월", "화", "수", "목", "금", "토", "일"][data.peak_weekday] + "요일"
                : "-"}
            </p>
          </div>
        </div>

        {/* 한산한 시간대 */}
        <div className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Clock size={20} className="text-slate-400" />
          </div>
          <div>
            <p className="text-xs text-slate-400">한산한 시간대</p>
            <p className="text-lg font-bold text-slate-900">
              {data?.quiet_hour !== null && data?.quiet_hour !== undefined
                ? `${String(data.quiet_hour).padStart(2, "0")}:00`
                : "-"}
            </p>
            <p className="text-xs text-slate-400">프로모션 고려 추천</p>
          </div>
        </div>
      </div>

      {/* 요일별 매출 바차트 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-slate-500" />
          요일별 매출 현황
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart
            data={data?.weekday_data || []}
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: "#475569" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`}
            />
            <Tooltip content={<BarTooltip />} />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {(data?.weekday_data || []).map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.weekday === data?.peak_weekday
                    ? "#f59e0b"
                    : WEEKDAY_COLORS[entry.weekday] || "#60a5fa"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* 요일별 상세 수치 */}
        <div className="mt-4 grid grid-cols-7 gap-1">
          {(data?.weekday_data || []).map((d) => (
            <div key={d.weekday} className="text-center">
              <p className={`text-xs font-medium ${
                d.weekday === 5 ? "text-yellow-500" :
                d.weekday === 6 ? "text-red-500" : "text-slate-500"
              }`}>{d.label}</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {(d.amount / 10000).toFixed(0)}만
              </p>
              <p className="text-xs text-slate-400">{d.count}건</p>
            </div>
          ))}
        </div>
      </div>

      {/* 시간대별 히트맵 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Clock size={18} className="text-slate-500" />
          시간대별 매출 현황
        </h3>

        {/* 시간대 그리드 (히트맵 형태) */}
        <div className="grid grid-cols-8 gap-1.5 mb-4">
          {(data?.hourly_data || []).map((h) => (
            <div
              key={h.hour}
              className="rounded-md p-2 text-center transition-all hover:scale-105 cursor-default"
              style={{ backgroundColor: getHourColor(h.amount, maxHourAmount) }}
              title={`${h.label}: ${h.amount.toLocaleString()}원 (${h.count}건)`}
            >
              <p className={`text-xs font-medium ${
                h.amount > maxHourAmount * 0.4 ? "text-white" : "text-slate-600"
              }`}>
                {h.label}
              </p>
              <p className={`text-xs mt-0.5 ${
                h.amount > maxHourAmount * 0.4 ? "text-blue-100" : "text-slate-400"
              }`}>
                {h.count > 0 ? `${h.count}건` : "-"}
              </p>
            </div>
          ))}
        </div>

        {/* 범례 */}
        <div className="flex items-center gap-2 justify-end">
          <span className="text-xs text-slate-400">낮음</span>
          {["#f1f5f9", "#dbeafe", "#93c5fd", "#60a5fa", "#3b82f6", "#1d4ed8"].map((color) => (
            <div key={color} className="w-6 h-3 rounded-sm" style={{ backgroundColor: color }} />
          ))}
          <span className="text-xs text-slate-400">높음</span>
        </div>

        {/* 시간대별 바차트 */}
        <div className="mt-6">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={data?.hourly_data || []}
              margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fill: "#94a3b8" }}
                interval={1}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`}
              />
              <Tooltip content={<BarTooltip />} />
              <Bar dataKey="amount" radius={[2, 2, 0, 0]}>
                {(data?.hourly_data || []).map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.hour === data?.peak_hour ? "#f59e0b" : "#3b82f6"}
                    opacity={entry.amount > 0 ? 1 : 0.2}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default TimeAnalysis;
