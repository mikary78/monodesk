// ============================================================
// SalesTrend.jsx — 매출 트렌드 분석 탭 컴포넌트
// KPI 카드, 기간 선택, 꺾은선 차트를 포함합니다.
// ============================================================

import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Target, ShoppingCart, DollarSign } from "lucide-react";
import {
  fetchSalesSummary, fetchSalesTrend, upsertSalesTarget,
  formatCurrency, formatPercent, getChangeColorClass,
} from "../../../api/salesAnalysisApi";

// 기간 선택 옵션
const PERIOD_OPTIONS = [
  { value: "daily",   label: "일별" },
  { value: "weekly",  label: "주별" },
  { value: "monthly", label: "월별" },
];

// 커스텀 툴팁 컴포넌트
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
      <p className="text-xs font-semibold text-slate-600 mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
          {entry.name === "amount" ? "매출: " : "건수: "}
          {entry.name === "amount"
            ? `${Number(entry.value).toLocaleString()}원`
            : `${Number(entry.value).toLocaleString()}건`}
        </p>
      ))}
    </div>
  );
};

// 매출 트렌드 컴포넌트
const SalesTrend = ({ year, month }) => {
  // 요약 KPI 데이터
  const [summary, setSummary] = useState(null);
  // 트렌드 차트 데이터
  const [trendData, setTrendData] = useState(null);
  // 선택된 기간 단위
  const [periodType, setPeriodType] = useState("daily");
  // 로딩 상태
  const [loading, setLoading] = useState(true);
  // 목표 매출 입력 모달
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [savingTarget, setSavingTarget] = useState(false);

  // year, month, periodType 변경 시 데이터 재조회
  useEffect(() => {
    loadData();
  }, [year, month, periodType]);

  // 데이터 로드
  const loadData = async () => {
    setLoading(true);
    try {
      const [sum, trend] = await Promise.all([
        fetchSalesSummary(year, month),
        fetchSalesTrend(year, month, periodType),
      ]);
      setSummary(sum);
      setTrendData(trend);
    } catch (err) {
      console.error("매출 트렌드 데이터 조회 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  // 목표 매출 저장
  const handleSaveTarget = async () => {
    const amount = parseFloat(targetInput.replace(/,/g, ""));
    if (!amount || amount <= 0) {
      alert("올바른 금액을 입력해주세요.");
      return;
    }
    setSavingTarget(true);
    try {
      await upsertSalesTarget({ year, month, target_amount: amount });
      setShowTargetModal(false);
      setTargetInput("");
      await loadData();
    } catch (err) {
      alert(`저장 실패: ${err.message}`);
    } finally {
      setSavingTarget(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-40 bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI 카드 3개 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 총 매출 */}
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">이번 달 총 매출</span>
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
              <DollarSign size={18} className="text-blue-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {formatCurrency(summary?.total_amount ?? 0)}
          </p>
          {summary?.growth_rate !== null && summary?.growth_rate !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${getChangeColorClass(summary.growth_rate)}`}>
              {summary.growth_rate >= 0
                ? <TrendingUp size={14} />
                : <TrendingDown size={14} />}
              <span>전월 대비 {formatPercent(summary.growth_rate, true)}</span>
            </div>
          )}
          {summary?.growth_rate === null && (
            <p className="text-xs text-slate-400 mt-2">전월 데이터 없음</p>
          )}
        </div>

        {/* 주문 건수 */}
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">총 주문 건수</span>
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
              <ShoppingCart size={18} className="text-purple-500" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {(summary?.total_count ?? 0).toLocaleString()}건
          </p>
          <p className="text-xs text-slate-400 mt-2">
            평균 {formatCurrency(summary?.avg_order_amount ?? 0)} / 건
          </p>
        </div>

        {/* 목표 달성률 */}
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">목표 달성률</span>
            <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
              <Target size={18} className="text-green-500" />
            </div>
          </div>
          {summary?.target_amount ? (
            <>
              <p className={`text-2xl font-bold ${
                (summary.achievement_rate ?? 0) >= 100 ? "text-green-600" :
                (summary.achievement_rate ?? 0) >= 80 ? "text-yellow-500" : "text-red-500"
              }`}>
                {formatPercent(summary.achievement_rate ?? 0)}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                목표: {formatCurrency(summary.target_amount)}
              </p>
              {/* 달성률 프로그레스 바 */}
              <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    (summary.achievement_rate ?? 0) >= 100 ? "bg-green-500" :
                    (summary.achievement_rate ?? 0) >= 80 ? "bg-yellow-400" : "bg-red-400"
                  }`}
                  style={{ width: `${Math.min(summary.achievement_rate ?? 0, 100)}%` }}
                />
              </div>
            </>
          ) : (
            <div>
              <p className="text-sm text-slate-400 mt-1">목표 미설정</p>
              <button
                onClick={() => setShowTargetModal(true)}
                className="mt-2 text-xs text-blue-500 hover:text-blue-600 transition-colors"
              >
                + 목표 설정
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 트렌드 차트 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900">매출 트렌드</h3>
          {/* 기간 선택 버튼 */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriodType(opt.value)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  periodType === opt.value
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {!trendData || trendData.data.length === 0 ? (
          // 데이터 없음 상태
          <div className="text-center py-16">
            <TrendingUp size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">표시할 데이터가 없습니다.</p>
            <p className="text-xs text-slate-300 mt-1">POS 연동 탭에서 데이터를 가져와주세요.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData.data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => value === "amount" ? "매출" : "건수"}
                wrapperStyle={{ fontSize: 12 }}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3b82f6" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* 요약 수치 */}
        {trendData && trendData.data.length > 0 && (
          <div className="flex justify-end gap-6 mt-4 pt-4 border-t border-slate-100">
            <div className="text-right">
              <p className="text-xs text-slate-400">총 매출</p>
              <p className="text-sm font-semibold text-slate-900">{formatCurrency(trendData.total_amount)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">총 건수</p>
              <p className="text-sm font-semibold text-slate-900">{trendData.total_count.toLocaleString()}건</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">일평균</p>
              <p className="text-sm font-semibold text-slate-900">{formatCurrency(trendData.avg_daily_amount)}</p>
            </div>
          </div>
        )}
      </div>

      {/* 목표 매출 설정 모달 */}
      {showTargetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900 mb-4">
              {year}년 {month}월 목표 매출 설정
            </h3>
            <div className="mb-4">
              <label className="block text-xs text-slate-500 mb-1">목표 매출액 (원)</label>
              <input
                type="text"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                placeholder="예: 15,000,000"
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowTargetModal(false)}
                className="h-9 px-4 text-sm text-slate-500 border border-slate-200 rounded-md hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={handleSaveTarget}
                disabled={savingTarget}
                className="h-9 px-4 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                {savingTarget ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesTrend;
