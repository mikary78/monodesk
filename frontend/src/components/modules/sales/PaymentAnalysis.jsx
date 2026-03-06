// ============================================================
// PaymentAnalysis.jsx — 결제 수단 분석 탭 컴포넌트
// 결제 수단별 비중 파이차트 및 월별 추이 바차트 화면입니다.
// ============================================================

import { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell, Tooltip as PieTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { CreditCard } from "lucide-react";
import { fetchPaymentAnalysis, formatCurrency } from "../../../api/salesAnalysisApi";

// 결제 수단별 색상
const PAYMENT_COLORS = {
  "카드":      "#3b82f6",
  "현금":      "#22c55e",
  "네이버페이": "#10b981",
  "카카오페이": "#f59e0b",
  "간편결제":  "#8b5cf6",
  "기타":      "#94a3b8",
};

// 기본 색상 (정의되지 않은 수단)
const DEFAULT_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ef4444", "#94a3b8"];

// 커스텀 파이 툴팁
const PieCustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length) return null;
  const entry = payload[0];
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-slate-700 mb-1">{entry.name}</p>
      <p style={{ color: entry.payload.fill }}>
        금액: {Number(entry.value).toLocaleString()}원
      </p>
      <p className="text-slate-500">비중: {entry.payload.rate}%</p>
    </div>
  );
};

// 파이차트 중앙 레이블 렌더링
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, rate }) => {
  if (rate < 5) return null; // 5% 미만은 레이블 숨김
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${rate}%`}
    </text>
  );
};

// 결제 수단 분석 컴포넌트
const PaymentAnalysis = ({ year, month }) => {
  // 결제 수단 분석 데이터
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
      const result = await fetchPaymentAnalysis(year, month);
      setData(result);
    } catch (err) {
      console.error("결제 수단 분석 데이터 조회 실패:", err);
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

  const hasData = data && data.items.length > 0;

  if (!hasData) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-16 text-center">
        <CreditCard size={48} className="mx-auto text-slate-200 mb-4" />
        <p className="text-sm text-slate-400">표시할 결제 수단 데이터가 없습니다.</p>
        <p className="text-xs text-slate-300 mt-1">POS 연동 탭에서 데이터를 가져와주세요.</p>
      </div>
    );
  }

  // 파이차트용 데이터 가공
  const pieData = data.items.map((item, index) => ({
    name: item.method,
    value: item.amount,
    count: item.count,
    rate: item.rate,
    fill: PAYMENT_COLORS[item.method] || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
  }));

  // 월별 추이 데이터 가공 (최근 6개월)
  const trendData = (data.monthly_trend || []).map((month) => {
    const { label, ...methods } = month;
    return { label, ...methods };
  });

  // 추이 차트에 사용할 결제 수단 목록 (label 제외)
  const methodKeys = trendData.length > 0
    ? Object.keys(trendData[0]).filter((k) => k !== "label")
    : [];

  return (
    <div className="space-y-6">
      {/* 상단: 파이차트 + 수단별 목록 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 파이차트 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">결제 수단별 비중</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={40}
                dataKey="value"
                labelLine={false}
                label={renderCustomLabel}
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Pie>
              <PieTooltip content={<PieCustomTooltip />} />
              <Legend
                formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                wrapperStyle={{ fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 결제 수단별 상세 목록 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">결제 수단 상세</h3>
          <div className="space-y-3">
            {data.items.map((item, index) => {
              const color = PAYMENT_COLORS[item.method] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
              return (
                <div key={item.method}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-sm font-medium text-slate-700">{item.method}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-slate-900">
                        {formatCurrency(item.amount)}
                      </span>
                      <span className="text-xs text-slate-400 ml-2">{item.count}건</span>
                    </div>
                  </div>
                  {/* 비중 프로그레스 바 */}
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${item.rate}%`, backgroundColor: color }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 text-right">{item.rate}%</p>
                </div>
              );
            })}
          </div>

          {/* 총 합계 */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between">
            <span className="text-sm text-slate-500">총 매출</span>
            <span className="text-sm font-bold text-slate-900">{formatCurrency(data.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* 월별 결제 수단 추이 */}
      {trendData.length > 0 && methodKeys.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-900 mb-4">
            결제 수단 월별 추이 (최근 6개월)
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trendData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`}
              />
              <Tooltip
                formatter={(value, name) => [`${Number(value).toLocaleString()}원`, name]}
                labelStyle={{ color: "#475569", fontWeight: 600 }}
              />
              <Legend
                formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                wrapperStyle={{ fontSize: 12 }}
              />
              {methodKeys.map((method, index) => (
                <Bar
                  key={method}
                  dataKey={method}
                  stackId="payment"
                  fill={PAYMENT_COLORS[method] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                  radius={index === methodKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default PaymentAnalysis;
