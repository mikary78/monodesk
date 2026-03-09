// ============================================================
// SalesTrendChart.jsx — 최근 6개월 매출 트렌드 차트
// Recharts ComposedChart로 매출/지출/순이익을 시각화합니다.
// ============================================================

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/**
 * 금액을 차트 Y축 레이블용으로 축약합니다.
 * @param {number} value - 금액
 * @returns {string} 축약된 표시 문자열
 */
const formatYAxis = (value) => {
  if (value >= 10000000) return `${(value / 10000000).toFixed(0)}천만`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(0)}백만`;
  if (value >= 10000) return `${(value / 10000).toFixed(0)}만`;
  return `${value}`;
};

/**
 * 툴팁 커스텀 컴포넌트 (한국어 표시).
 */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-800 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-medium text-slate-900">
            {Number(entry.value).toLocaleString("ko-KR")}원
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * 최근 6개월 매출 트렌드 차트 컴포넌트.
 * @param {Array} data - 월별 트렌드 데이터 배열
 * @param {boolean} loading - 로딩 상태
 */
const SalesTrendChart = ({ data = [], loading = false }) => {
  // 로딩 중 스켈레톤 표시
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="h-5 w-40 bg-slate-200 rounded animate-pulse mb-6" />
        <div className="h-56 bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  // 데이터 없을 때 안내 메시지
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-4">최근 6개월 트렌드</h3>
        <div className="h-56 flex items-center justify-center text-slate-400 text-sm">
          데이터가 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-base font-semibold text-slate-800 mb-4">
        최근 6개월 매출 트렌드
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          {/* 격자선 */}
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />

          {/* X축: 월 레이블 */}
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
          />

          {/* Y축: 금액 (축약) */}
          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 11, fill: "#64748B" }}
            axisLine={false}
            tickLine={false}
            width={56}
          />

          {/* 툴팁 */}
          <Tooltip content={<CustomTooltip />} />

          {/* 범례 */}
          <Legend
            wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
            formatter={(value) => (
              <span style={{ color: "#64748B" }}>{value}</span>
            )}
          />

          {/* 매출 막대 */}
          <Bar
            dataKey="total_sales"
            name="매출"
            fill="#3B82F6"
            radius={[3, 3, 0, 0]}
            maxBarSize={40}
          />

          {/* 지출 막대 */}
          <Bar
            dataKey="total_expense"
            name="지출"
            fill="#E2E8F0"
            radius={[3, 3, 0, 0]}
            maxBarSize={40}
          />

          {/* 순이익 꺾은선 */}
          <Line
            type="monotone"
            dataKey="net_profit"
            name="순이익"
            stroke="#22C55E"
            strokeWidth={2}
            dot={{ r: 4, fill: "#22C55E", strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SalesTrendChart;
