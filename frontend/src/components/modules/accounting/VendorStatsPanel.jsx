// ============================================================
// VendorStatsPanel.jsx — 거래처별 지출 현황 패널
// 거래처별 구매 횟수, 총금액, 최근 구매일을 집계하여 표시합니다.
// ============================================================

import { useState, useEffect } from "react";
import { Store, TrendingUp } from "lucide-react";
import { fetchVendorStats, formatCurrency } from "../../../api/accountingApi";

const VendorStatsPanel = ({ year, month }) => {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedYear, setSelectedYear] = useState(year);
  const [selectedMonth, setSelectedMonth] = useState(month);

  useEffect(() => { loadStats(); }, [selectedYear, selectedMonth]); // eslint-disable-line

  // 부모 year/month 변경 시 동기화
  useEffect(() => {
    setSelectedYear(year);
    setSelectedMonth(month);
  }, [year, month]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVendorStats(selectedYear, selectedMonth);
      setStats(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const maxAmount = stats.length > 0
    ? Math.max(...stats.filter(s => s.vendor_name !== "미입력").map(s => s.total_amount), 1)
    : 1;
  const vendorCount = stats.filter(s => s.vendor_name !== "미입력").length;
  const grandTotal = stats.reduce((sum, s) => sum + (s.total_amount || 0), 0);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 2023 }, (_, i) => 2024 + i);
  const monthOptions = [
    { value: null, label: "전체" },
    ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}월` })),
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-5 mb-4">
      {/* 헤더 + 연도/월 필터 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Store size={16} className="text-blue-500" />
          거래처별 지출 현황
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select
            value={selectedMonth ?? ""}
            onChange={(e) => setSelectedMonth(e.target.value === "" ? null : Number(e.target.value))}
            className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-300"
          >
            {monthOptions.map((m) => (
              <option key={m.value ?? "all"} value={m.value ?? ""}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : stats.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <TrendingUp size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">지출 내역이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-center py-2 px-1 text-slate-400 font-medium w-8">순위</th>
                  <th className="text-left py-2 px-2 text-slate-400 font-medium">거래처명</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium w-20">분류</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium w-14">구매횟수</th>
                  <th className="text-right py-2 px-2 text-slate-400 font-medium w-28">총금액</th>
                  <th className="text-center py-2 px-2 text-slate-400 font-medium w-24">최근구매일</th>
                  <th className="text-left py-2 px-2 text-slate-400 font-medium w-32">비율</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((item, idx) => {
                  const isMissing = item.vendor_name === "미입력";
                  const barWidth = isMissing ? 0
                    : Math.round((item.total_amount / maxAmount) * 100);
                  return (
                    <tr key={idx} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${isMissing ? "opacity-40" : ""}`}>
                      <td className="py-2 px-1 text-slate-400 text-center">
                        {isMissing ? "-" : idx + 1}
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          {/* 초록=vendors 등록됨, 회색=미등록 */}
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.vendor_id ? "bg-green-400" : "bg-slate-300"}`}
                            title={item.vendor_id ? "거래처 등록됨" : "미등록"}
                          />
                          <span className="text-slate-700 font-medium truncate max-w-[180px]" title={item.vendor_name}>
                            {item.vendor_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center text-slate-500">
                        {item.categories?.length > 0 ? item.categories[0] : "-"}
                      </td>
                      <td className="py-2 px-2 text-center text-slate-600">{item.purchase_count}회</td>
                      <td className="py-2 px-2 text-right font-semibold text-slate-800">
                        {formatCurrency(item.total_amount)}
                      </td>
                      <td className="py-2 px-2 text-center text-slate-400">
                        {item.last_purchase_date || "-"}
                      </td>
                      <td className="py-2 px-2">
                        {!isMissing && (
                          <div className="flex items-center gap-1">
                            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                              <div
                                className="bg-blue-400 h-1.5 rounded-full"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className="text-slate-400 w-8 text-right">{barWidth}%</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 하단 요약 */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>총 <strong className="text-slate-700">{vendorCount}</strong>개 거래처</span>
            <span>합계 <strong className="text-slate-700">{formatCurrency(grandTotal)}</strong></span>
          </div>
        </>
      )}
    </div>
  );
};

export default VendorStatsPanel;
