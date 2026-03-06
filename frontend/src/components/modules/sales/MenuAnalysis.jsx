// ============================================================
// MenuAnalysis.jsx — 메뉴 분석 탭 컴포넌트
// 인기/비인기 메뉴 TOP 10, 매출 기여도, 카테고리별 집계 화면입니다.
// ============================================================

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { UtensilsCrossed, TrendingUp, TrendingDown } from "lucide-react";
import { fetchMenuAnalysis, formatCurrency } from "../../../api/salesAnalysisApi";

// 메뉴 순위별 색상
const BAR_COLORS = [
  "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe",
  "#dbeafe", "#eff6ff", "#f0f9ff", "#e0f2fe",
  "#bae6fd", "#7dd3fc",
];

// 커스텀 툴팁
const MenuTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-slate-700 mb-1 truncate max-w-[180px]">{label}</p>
      <p className="text-blue-600">매출: {Number(payload[0]?.value || 0).toLocaleString()}원</p>
      {payload[1] && (
        <p className="text-purple-600">수량: {Number(payload[1]?.value || 0).toLocaleString()}개</p>
      )}
    </div>
  );
};

// 메뉴 분석 컴포넌트
const MenuAnalysis = ({ year, month }) => {
  // 메뉴 분석 데이터
  const [data, setData] = useState(null);
  // 선택된 보기 모드 (top / bottom)
  const [viewMode, setViewMode] = useState("top");
  // 로딩 상태
  const [loading, setLoading] = useState(true);

  // year, month 변경 시 데이터 재조회
  useEffect(() => {
    loadData();
  }, [year, month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchMenuAnalysis(year, month);
      setData(result);
    } catch (err) {
      console.error("메뉴 분석 데이터 조회 실패:", err);
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

  // 현재 보기 모드에 따라 표시할 메뉴 목록
  const displayMenus = viewMode === "top" ? (data?.top_menus || []) : (data?.bottom_menus || []);
  // 차트용 데이터 (메뉴명 축약)
  const chartData = displayMenus.map((m) => ({
    name: m.menu_name.length > 8 ? m.menu_name.slice(0, 8) + "..." : m.menu_name,
    fullName: m.menu_name,
    amount: m.total_amount,
    quantity: m.total_quantity,
    rate: m.contribution_rate,
  }));

  return (
    <div className="space-y-6">
      {/* 카테고리별 요약 */}
      {data?.category_summary && data.category_summary.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">카테고리별 매출 비중</h3>
          <div className="flex gap-3 flex-wrap">
            {data.category_summary.map((cat) => (
              <div key={cat.category} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <span className="text-sm text-slate-700 font-medium">{cat.category}</span>
                <span className="text-xs text-slate-400">{cat.rate}%</span>
                <span className="text-xs text-blue-600">{formatCurrency(cat.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TOP / BOTTOM 전환 버튼 + 차트 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            {viewMode === "top"
              ? <><TrendingUp size={18} className="text-green-500" /> 인기 메뉴 TOP 10</>
              : <><TrendingDown size={18} className="text-red-400" /> 비인기 메뉴 BOTTOM 10</>}
          </h3>
          {/* TOP / BOTTOM 전환 */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("top")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === "top" ? "bg-white text-green-600 shadow-sm" : "text-slate-500"
              }`}
            >
              인기 TOP 10
            </button>
            <button
              onClick={() => setViewMode("bottom")}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                viewMode === "bottom" ? "bg-white text-red-500 shadow-sm" : "text-slate-500"
              }`}
            >
              비인기 BOTTOM 10
            </button>
          </div>
        </div>

        {displayMenus.length === 0 ? (
          // 데이터 없음
          <div className="text-center py-16">
            <UtensilsCrossed size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">표시할 메뉴 데이터가 없습니다.</p>
          </div>
        ) : (
          // 수평 바차트
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "#475569" }}
                width={90}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<MenuTooltip />} />
              <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {chartData.map((_, index) => (
                  <Cell key={index} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 메뉴별 상세 테이블 */}
      {displayMenus.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">메뉴별 상세</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 w-12">순위</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">메뉴명</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500">카테고리</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">판매 수량</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">매출 금액</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">기여도</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">평균 단가</th>
                </tr>
              </thead>
              <tbody>
                {displayMenus.map((menu, idx) => (
                  <tr key={menu.menu_name} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${idx % 2 === 1 ? "bg-slate-50/50" : ""}`}>
                    <td className="py-3 px-3 text-center">
                      {/* 순위 배지 */}
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        menu.rank === 1 ? "bg-yellow-100 text-yellow-600" :
                        menu.rank === 2 ? "bg-slate-100 text-slate-600" :
                        menu.rank === 3 ? "bg-orange-100 text-orange-600" :
                        "text-slate-400"
                      }`}>
                        {menu.rank}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-800 font-medium">{menu.menu_name}</td>
                    <td className="py-3 px-3 text-center">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                        {menu.menu_category || "미분류"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600">
                      {menu.total_quantity.toLocaleString()}개
                    </td>
                    <td className="py-3 px-3 text-right font-semibold text-slate-900">
                      {formatCurrency(menu.total_amount)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* 기여도 바 */}
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full"
                            style={{ width: `${Math.min(menu.contribution_rate, 100)}%` }}
                          />
                        </div>
                        <span className="text-slate-600 text-xs w-10 text-right">
                          {menu.contribution_rate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-500 text-xs">
                      {formatCurrency(menu.avg_unit_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* 합계 행 */}
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={3} className="py-3 px-3 text-xs font-semibold text-slate-500">
                    전체 {data?.total_menu_count || 0}종
                  </td>
                  <td className="py-3 px-3 text-right text-xs font-semibold text-slate-700">
                    {displayMenus.reduce((s, m) => s + m.total_quantity, 0).toLocaleString()}개
                  </td>
                  <td className="py-3 px-3 text-right text-sm font-bold text-slate-900">
                    {formatCurrency(data?.total_amount || 0)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuAnalysis;
