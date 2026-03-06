// DividendSimulation.jsx - 동업자 지분 정산 시뮬레이터
// PRD 1-4: 급여 차감 후 배당 가능 금액 표시
import { useState, useEffect } from "react";
import { Users, RefreshCw } from "lucide-react";
import { fetchProfitLoss, formatCurrency } from "../../../api/accountingApi";

const DEFAULT_PARTNERS = [
  { id: 1, name: "동업자 A", share: 29, salary: 0 },
  { id: 2, name: "동업자 B", share: 29, salary: 0 },
  { id: 3, name: "동업자 C", share: 29, salary: 0 },
  { id: 4, name: "동업자 D", share: 13, salary: 0 },
];

const DividendSimulation = ({ year, month }) => {
  const [profitLoss, setProfitLoss] = useState(null);
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState(DEFAULT_PARTNERS);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try { const data = await fetchProfitLoss(year, month); setProfitLoss(data); }
      catch { setProfitLoss(null); } finally { setLoading(false); }
    }; load();
  }, [year, month]);

  const handleSalaryChange = (id, value) => {
    setPartners((prev) => prev.map((p) => p.id === id ? { ...p, salary: Number(value) || 0 } : p));
  };
  const handleNameChange = (id, value) => {
    setPartners((prev) => prev.map((p) => p.id === id ? { ...p, name: value } : p));
  };
  const resetSalaries = () => setPartners((prev) => prev.map((p) => ({ ...p, salary: 0 })));

  const netProfit = profitLoss ? profitLoss.gross_profit : 0;
  const totalSalary = partners.reduce((sum, p) => sum + p.salary, 0);
  const distributable = Math.max(0, netProfit - totalSalary);
  const partnerResults = partners.map((p) => ({
    ...p,
    dividend: Math.floor(distributable * (p.share / 100)),
    totalIncome: p.salary + Math.floor(distributable * (p.share / 100)),
  }));
  const totalDividend = partnerResults.reduce((sum, p) => sum + p.dividend, 0);
  const isGood = distributable > 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Users size={18} className="text-blue-500" />
        <h3 className="text-base font-semibold text-slate-900">
          {year}년 {month}월 지분 정산 시뮬레이션
        </h3>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <p className="text-xs text-blue-600 mb-1 font-medium">이번 달 순이익</p>
          <p className="text-lg font-bold text-blue-700">
            {loading ? "로딩 중..." : formatCurrency(netProfit)}
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
          <p className="text-xs text-amber-600 mb-1 font-medium">총 급여 지급</p>
          <p className="text-lg font-bold text-amber-700">{formatCurrency(totalSalary)}</p>
        </div>
        <div className={isGood ? "border rounded-lg p-4 bg-green-50 border-green-100" : "border rounded-lg p-4 bg-slate-50 border-slate-200"}>
          <p className={isGood ? "text-xs mb-1 font-medium text-green-600" : "text-xs mb-1 font-medium text-slate-500"}>
            배당 가능 금액
          </p>
          <p className={isGood ? "text-lg font-bold text-green-700" : "text-lg font-bold text-slate-500"}>
            {formatCurrency(distributable)}
          </p>
          {netProfit < 0 && <p className="text-xs text-red-500 mt-0.5">이번 달 순손실</p>}
          {netProfit >= 0 && netProfit < totalSalary && (
            <p className="text-xs text-amber-600 mt-0.5">급여 지급 후 잔액 없음</p>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-slate-700">이번 달 급여 입력</h4>
          <button onClick={resetSalaries} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <RefreshCw size={12} />초기화
          </button>
        </div>
        <div className="space-y-3">
          {partners.map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <input type="text" value={p.name} onChange={(e) => handleNameChange(p.id, e.target.value)}
                className="w-28 px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400" />
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded w-14 text-center">{p.share}%</span>
              <div className="flex-1 flex items-center gap-2">
                <input type="number" value={p.salary || ""} onChange={(e) => handleSalaryChange(p.id, e.target.value)}
                  min="0" step="100000" placeholder="0"
                  className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 text-right" />
                <span className="text-xs text-slate-400 w-4">원</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
          <h4 className="text-sm font-semibold text-slate-700">정산 결과</h4>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">동업자</th>
              <th className="text-center py-3 px-3 text-xs font-medium text-slate-500">지분</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-slate-500">급여</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-slate-500">배당</th>
              <th className="text-right py-3 px-4 text-xs font-medium text-slate-500">합계</th>
            </tr>
          </thead>
          <tbody>
            {partnerResults.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-3 px-4 font-medium text-slate-800">{p.name}</td>
                <td className="py-3 px-3 text-center">
                  <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{p.share}%</span>
                </td>
                <td className="py-3 px-4 text-right text-slate-600">{formatCurrency(p.salary)}</td>
                <td className="py-3 px-4 text-right text-green-600 font-medium">{formatCurrency(p.dividend)}</td>
                <td className="py-3 px-4 text-right font-semibold text-slate-900">{formatCurrency(p.totalIncome)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-slate-200">
              <td className="py-3 px-4 text-xs font-semibold text-slate-600" colSpan={2}>합계</td>
              <td className="py-3 px-4 text-right text-xs font-semibold text-slate-700">{formatCurrency(totalSalary)}</td>
              <td className="py-3 px-4 text-right text-xs font-semibold text-green-700">{formatCurrency(totalDividend)}</td>
              <td className="py-3 px-4 text-right text-xs font-semibold text-slate-900">{formatCurrency(totalSalary + totalDividend)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-3 text-center">
        * 이 시뮬레이션은 참고용이며, 실제 정산은 세무사와 확인 후 진행하세요.
      </p>
    </div>
  );
};

export default DividendSimulation;
