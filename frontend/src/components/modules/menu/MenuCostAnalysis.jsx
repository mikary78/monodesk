// ============================================================
// MenuCostAnalysis.jsx — 메뉴 원가 분석 탭 컴포넌트
// 원가율 분포 차트, 고마진/저마진 메뉴 순위를 표시합니다.
// ============================================================

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, BarChart3, AlertCircle } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from "recharts";
import { fetchCostAnalysis, formatCurrency, getCostRatioBadgeClass } from "../../../api/menuApi";

// 원가율 구간별 색상 정의
const DISTRIBUTION_COLORS = {
  "0-30%": "#22C55E",   // 초록 (고마진)
  "30-50%": "#3B82F6",  // 파랑 (양호)
  "50-70%": "#F59E0B",  // 노랑 (주의)
  "70%+": "#EF4444",    // 빨강 (경고)
};

// 툴팁 한국어 커스텀 컴포넌트
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-3 text-sm">
      <p className="font-medium text-slate-800 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value}{typeof entry.value === "number" && entry.name.includes("율") ? "%" : "개"}
        </p>
      ))}
    </div>
  );
};

const MenuCostAnalysis = () => {
  // 원가 분석 데이터 상태
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadAnalysis();
  }, []);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      const data = await fetchCostAnalysis();
      setAnalysis(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-48 bg-slate-200 rounded-lg"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-64 bg-slate-200 rounded-lg"></div>
          <div className="h-64 bg-slate-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
        원가 분석 데이터를 불러오는 중 오류가 발생했습니다: {error}
      </div>
    );
  }

  if (!analysis || analysis.top_margin_items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <BarChart3 size={40} className="text-slate-300 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">분석할 메뉴 데이터가 없습니다.</p>
        <p className="text-slate-400 text-xs mt-1">판매 중인 메뉴를 원가와 함께 등록하면 분석이 시작됩니다.</p>
      </div>
    );
  }

  // 파이 차트용 데이터 구성
  const pieData = analysis.cost_ratio_distribution.map((d) => ({
    name: d.range,
    value: d.count,
    color: DISTRIBUTION_COLORS[d.range],
  }));

  return (
    <div className="space-y-6">
      {/* 요약 지표 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-5">
          <p className="text-sm text-slate-500 mb-1">단순 평균 원가율</p>
          <p className={`text-3xl font-bold ${getCostRatioTextColor(analysis.avg_cost_ratio)}`}>
            {analysis.avg_cost_ratio}%
          </p>
          <p className="text-xs text-slate-400 mt-1">판매 중인 전체 메뉴의 원가율 평균</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5">
          <p className="text-sm text-slate-500 mb-1">가중 평균 원가율</p>
          <p className={`text-3xl font-bold ${getCostRatioTextColor(analysis.weighted_avg_cost_ratio)}`}>
            {analysis.weighted_avg_cost_ratio}%
          </p>
          <p className="text-xs text-slate-400 mt-1">판매가 기준으로 가중 평균한 원가율</p>
        </div>
      </div>

      {/* 원가율 구간 분포 + 고마진/저마진 순위 */}
      <div className="grid grid-cols-5 gap-4">
        {/* 파이 차트 */}
        <div className="col-span-2 bg-white rounded-lg shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <BarChart3 size={15} className="text-blue-500" />
            원가율 구간 분포
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                dataKey="value"
                label={({ name, value }) => value > 0 ? `${value}개` : ""}
                labelLine={false}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value}개`, name]}
                contentStyle={{ fontSize: "12px" }}
              />
              <Legend
                iconType="circle"
                iconSize={10}
                formatter={(value) => <span style={{ fontSize: "12px", color: "#64748B" }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 고마진 순위 */}
        <div className="col-span-3 bg-white rounded-lg shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <TrendingUp size={15} className="text-green-500" />
            고마진 메뉴 (원가율 낮은 순)
          </h3>
          <div className="space-y-2">
            {analysis.top_margin_items.slice(0, 5).map((item, idx) => (
              <div key={item.id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-4">{idx + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{item.name}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${getCostRatioBadgeClass(item.cost_ratio)}`}>
                      {item.cost_ratio}%
                    </span>
                  </div>
                  {/* 원가율 바 */}
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-400"
                      style={{ width: `${Math.min(item.cost_ratio, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-slate-400 w-20 text-right">
                  마진 {formatCurrency(item.margin)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 원가 개선 필요 메뉴 */}
      {analysis.high_cost_items.some((item) => item.cost_ratio > 60) && (
        <div className="bg-white rounded-lg shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <AlertCircle size={15} className="text-red-500" />
            원가 개선 검토 필요 (원가율 높은 순)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-100">
                  <th className="text-left pb-2">메뉴명</th>
                  <th className="text-right pb-2">판매가</th>
                  <th className="text-right pb-2">원가</th>
                  <th className="text-center pb-2">원가율</th>
                  <th className="text-right pb-2">마진</th>
                </tr>
              </thead>
              <tbody>
                {analysis.high_cost_items
                  .filter((item) => item.cost_ratio > 60)
                  .map((item) => (
                    <tr key={item.id} className="border-b border-slate-50">
                      <td className="py-2 font-medium text-slate-700">{item.name}</td>
                      <td className="py-2 text-right text-slate-600">{formatCurrency(item.price)}</td>
                      <td className="py-2 text-right text-slate-600">{formatCurrency(item.cost)}</td>
                      <td className="py-2 text-center">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${getCostRatioBadgeClass(item.cost_ratio)}`}>
                          {item.cost_ratio}%
                        </span>
                      </td>
                      <td className="py-2 text-right text-slate-600">{formatCurrency(item.margin)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// 원가율에 따른 텍스트 색상 클래스 반환
function getCostRatioTextColor(ratio) {
  if (ratio <= 30) return "text-green-600";
  if (ratio <= 50) return "text-blue-600";
  if (ratio <= 70) return "text-yellow-600";
  return "text-red-600";
}

export default MenuCostAnalysis;
