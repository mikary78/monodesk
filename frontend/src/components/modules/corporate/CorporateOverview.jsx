// ============================================================
// CorporateOverview.jsx — 법인 재무 개요 컴포넌트
// 연도별 매출/지출/순이익/동업자 배당 예상액을 종합 표시합니다.
// ============================================================

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Building2, DollarSign, Minus } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { fetchCorporateOverview } from "../../../api/corporateApi";

// 파이 차트 컬러 팔레트
const PIE_COLORS = ["#3B82F6", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444", "#EC4899"];

const CorporateOverview = ({ year }) => {
  // 재무 개요 데이터
  const [overview, setOverview] = useState(null);
  // 로딩 상태
  const [loading, setLoading] = useState(false);
  // 오류 메시지
  const [error, setError] = useState(null);

  // 연도 변경 시 데이터 다시 불러오기
  useEffect(() => {
    loadOverview();
  }, [year]);

  /**
   * 법인 재무 개요 데이터 불러오기
   */
  const loadOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCorporateOverview(year);
      setOverview(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // 금액 포맷 (천 단위 콤마)
  const fmt = (n) => Math.round(n || 0).toLocaleString();

  // 로딩 중
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-slate-100 rounded-lg" />
        ))}
      </div>
    );
  }

  // 오류
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-red-500 text-sm">{error}</p>
        <button onClick={loadOverview} className="mt-2 text-blue-500 text-sm underline">
          다시 시도
        </button>
      </div>
    );
  }

  // 데이터 없음
  if (!overview) return null;

  // 전년 대비 증감 표시 컴포넌트
  const GrowthBadge = ({ value }) => {
    if (value === null || value === undefined) {
      return <span className="text-xs text-slate-400">전년 데이터 없음</span>;
    }
    if (value > 0) return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <TrendingUp size={12} /> 전년 대비 +{value.toFixed(1)}%
      </span>
    );
    if (value < 0) return (
      <span className="flex items-center gap-1 text-xs text-red-500">
        <TrendingDown size={12} /> 전년 대비 {value.toFixed(1)}%
      </span>
    );
    return (
      <span className="flex items-center gap-1 text-xs text-slate-400">
        <Minus size={12} /> 전년 동일
      </span>
    );
  };

  // 파이 차트 데이터 (법인 비용 분류별)
  const pieData = overview.expense_by_category.map((item) => ({
    name: item.category,
    value: item.total,
  }));

  return (
    <div className="space-y-6">
      {/* KPI 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 연간 매출 */}
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <TrendingUp size={16} className="text-green-500" />
            연간 매출
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {fmt(overview.annual_revenue)}
            <span className="text-sm font-normal text-slate-500 ml-1">원</span>
          </div>
        </div>

        {/* 연간 총 지출 */}
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <DollarSign size={16} className="text-red-400" />
            연간 총 지출
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {fmt(overview.annual_total_expense)}
            <span className="text-sm font-normal text-slate-500 ml-1">원</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            운영비 {fmt(overview.annual_operating_expense)}원 + 법인비 {fmt(overview.annual_corporate_expense)}원
          </div>
        </div>

        {/* 연간 순이익 */}
        <div className={`bg-white rounded-lg shadow p-5 ${overview.annual_net_profit < 0 ? "border-l-4 border-red-400" : "border-l-4 border-green-400"}`}>
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <Building2 size={16} className={overview.annual_net_profit >= 0 ? "text-green-500" : "text-red-400"} />
            연간 순이익
          </div>
          <div className={`text-2xl font-bold ${overview.annual_net_profit >= 0 ? "text-green-600" : "text-red-500"}`}>
            {overview.annual_net_profit >= 0 ? "" : "-"}{fmt(Math.abs(overview.annual_net_profit))}
            <span className="text-sm font-normal ml-1">원</span>
          </div>
          <div className="mt-1">
            <GrowthBadge value={overview.yoy_profit_growth} />
          </div>
        </div>

        {/* 순이익률 */}
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
            <TrendingUp size={16} className="text-blue-500" />
            순이익률
          </div>
          <div className={`text-2xl font-bold ${overview.net_profit_margin >= 0 ? "text-blue-600" : "text-red-500"}`}>
            {overview.net_profit_margin.toFixed(1)}
            <span className="text-sm font-normal ml-1">%</span>
          </div>
        </div>
      </div>

      {/* 동업자별 예상 배당금 + 법인 비용 분류별 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 동업자별 예상 배당금 (100% 배당 기준) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            동업자별 예상 배당금
            <span className="text-xs font-normal text-slate-400 ml-2">
              (순이익 100% 배당 기준)
            </span>
          </h3>
          {overview.partner_dividends.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              등록된 동업자가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {overview.partner_dividends.map((item) => (
                <div key={item.partner_id} className="flex items-center gap-3">
                  {/* 지분율 바 */}
                  <div className="w-16 text-right text-sm text-slate-500 shrink-0">
                    {item.equity_ratio.toFixed(1)}%
                  </div>
                  <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full flex items-center pl-2"
                      style={{ width: `${item.equity_ratio}%` }}
                    >
                      <span className="text-xs text-white font-medium truncate">
                        {item.partner_name}
                      </span>
                    </div>
                  </div>
                  <div className="w-32 text-right text-sm font-semibold text-slate-900 shrink-0">
                    {overview.annual_net_profit > 0
                      ? `${fmt(item.dividend_amount)}원`
                      : <span className="text-slate-300">-</span>
                    }
                  </div>
                </div>
              ))}
            </div>
          )}
          {overview.annual_net_profit <= 0 && (
            <p className="mt-4 text-xs text-red-400 text-center">
              순이익이 없어 배당금을 계산할 수 없습니다.
            </p>
          )}
        </div>

        {/* 법인 비용 분류별 파이 차트 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            {year}년 법인 비용 분류별 현황
          </h3>
          {pieData.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              등록된 법인 비용이 없습니다.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${Math.round(value).toLocaleString()}원`, "금액"]}
                />
                <Legend
                  formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 연간 손익 요약 테이블 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">{year}년 법인 손익 요약</h3>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            <tr className="hover:bg-slate-50">
              <td className="py-3 text-slate-600">연간 매출</td>
              <td className="py-3 text-right font-medium text-green-600">
                {fmt(overview.annual_revenue)}원
              </td>
            </tr>
            <tr className="hover:bg-slate-50">
              <td className="py-3 text-slate-600 pl-4">└ 매장 운영비</td>
              <td className="py-3 text-right text-red-400">
                -{fmt(overview.annual_operating_expense)}원
              </td>
            </tr>
            <tr className="hover:bg-slate-50">
              <td className="py-3 text-slate-600 pl-4">└ 법인 비용</td>
              <td className="py-3 text-right text-red-400">
                -{fmt(overview.annual_corporate_expense)}원
              </td>
            </tr>
            <tr className="bg-slate-50 font-semibold">
              <td className="py-3 text-slate-800">연간 순이익</td>
              <td className={`py-3 text-right text-base ${overview.annual_net_profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                {overview.annual_net_profit >= 0 ? "" : "-"}{fmt(Math.abs(overview.annual_net_profit))}원
              </td>
            </tr>
            <tr className="hover:bg-slate-50">
              <td className="py-3 text-slate-600">순이익률</td>
              <td className={`py-3 text-right font-medium ${overview.net_profit_margin >= 0 ? "text-blue-600" : "text-red-500"}`}>
                {overview.net_profit_margin.toFixed(1)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CorporateOverview;
