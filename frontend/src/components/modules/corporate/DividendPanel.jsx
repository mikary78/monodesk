// ============================================================
// DividendPanel.jsx — 배당 정산 패널 컴포넌트
// 연간 순이익 기반 동업자별 배당금 시뮬레이션 및 확정 기능을 제공합니다.
// ============================================================

import { useState, useEffect } from "react";
import { DollarSign, Calculator, CheckCircle, Clock, Trash2 } from "lucide-react";
import {
  simulateDividend,
  confirmDividend,
  fetchDividendRecords,
  updateDividendRecord,
  deleteDividendRecordsByYear,
} from "../../../api/corporateApi";

const DividendPanel = ({ year }) => {
  // 배당 기록 목록
  const [records, setRecords] = useState([]);
  // 로딩 상태
  const [loading, setLoading] = useState(false);
  // 시뮬레이션 결과
  const [simResult, setSimResult] = useState(null);
  // 시뮬레이션 입력값
  const [netProfit, setNetProfit] = useState("");
  const [distRatio, setDistRatio] = useState("100");
  // 처리 중 상태
  const [processing, setProcessing] = useState(false);
  // 오류 메시지
  const [error, setError] = useState(null);

  // 연도 변경 시 배당 기록 다시 불러오기
  useEffect(() => {
    loadRecords();
    // 시뮬레이션 결과 초기화
    setSimResult(null);
  }, [year]);

  /**
   * 해당 연도의 배당 기록 불러오기
   */
  const loadRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDividendRecords(year);
      setRecords(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 배당 시뮬레이션 실행 (DB 저장 없음)
   */
  const handleSimulate = async () => {
    if (!netProfit || isNaN(Number(netProfit))) {
      setError("연간 순이익을 숫자로 입력해주세요."); return;
    }
    try {
      setProcessing(true);
      setError(null);
      const result = await simulateDividend({
        year,
        annual_net_profit: parseFloat(netProfit),
        distribution_ratio: parseFloat(distRatio),
      });
      setSimResult(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  /**
   * 배당 정산 확정 처리 (DB 저장)
   */
  const handleConfirm = async () => {
    if (!simResult) return;
    if (!window.confirm(`${year}년 배당 정산을 확정하시겠습니까?\n이미 기록이 있으면 덮어씁니다.`)) return;
    try {
      setProcessing(true);
      setError(null);
      await confirmDividend({
        year,
        annual_net_profit: simResult.annual_net_profit,
        distribution_ratio: simResult.distribution_ratio,
      });
      setSimResult(null);
      await loadRecords();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  /**
   * 배당 지급 상태 토글 (미지급 ↔ 지급 완료)
   */
  const handleTogglePaid = async (record) => {
    const newStatus = record.is_paid === 1 ? 0 : 1;
    const today = new Date().toISOString().slice(0, 10);
    try {
      await updateDividendRecord(record.id, {
        is_paid: newStatus,
        paid_date: newStatus === 1 ? today : null,
      });
      await loadRecords();
    } catch (e) {
      alert(e.message);
    }
  };

  /**
   * 연도별 배당 기록 전체 삭제
   */
  const handleDeleteAll = async () => {
    if (!window.confirm(`${year}년 배당 기록을 모두 삭제하시겠습니까?`)) return;
    try {
      await deleteDividendRecordsByYear(year);
      await loadRecords();
    } catch (e) {
      alert(e.message);
    }
  };

  // 금액 포맷 (천 단위 콤마)
  const fmt = (n) => Math.round(n).toLocaleString();

  return (
    <div className="space-y-6">
      {/* 배당 시뮬레이션 입력 카드 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 mb-5">
          <Calculator size={18} className="text-blue-500" />
          <h2 className="text-base font-semibold text-slate-900">{year}년 배당 시뮬레이션</h2>
        </div>

        <div className="flex gap-4 items-end flex-wrap">
          {/* 연간 순이익 입력 */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              연간 순이익 (원) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={netProfit}
              onChange={(e) => setNetProfit(e.target.value)}
              className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
              placeholder="예: 50000000"
            />
          </div>
          {/* 배당 비율 입력 */}
          <div className="w-32">
            <label className="block text-xs font-medium text-slate-500 mb-1">배당 비율 (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={distRatio}
              onChange={(e) => setDistRatio(e.target.value)}
              className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          {/* 시뮬레이션 실행 버튼 */}
          <button
            onClick={handleSimulate}
            disabled={processing}
            className="h-9 px-5 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {processing ? "계산 중..." : "계산하기"}
          </button>
        </div>

        {/* 시뮬레이션 결과 */}
        {simResult && (
          <div className="mt-6 border border-blue-100 rounded-lg p-5 bg-blue-50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-slate-600">
                  순이익 <span className="font-semibold text-slate-900">{fmt(simResult.annual_net_profit)}원</span>의{" "}
                  <span className="font-semibold text-slate-900">{simResult.distribution_ratio}%</span> 배당
                </p>
                <p className="text-lg font-bold text-blue-700 mt-0.5">
                  배당 대상 금액: {fmt(simResult.distributable_amount)}원
                </p>
              </div>
              <button
                onClick={handleConfirm}
                disabled={processing}
                className="h-9 px-4 text-sm font-medium bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                정산 확정
              </button>
            </div>
            {/* 동업자별 배당금 테이블 */}
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-blue-100 text-slate-600">
                  <th className="text-left px-3 py-2 rounded-l font-semibold">동업자</th>
                  <th className="text-center px-3 py-2 font-semibold">지분율</th>
                  <th className="text-right px-3 py-2 rounded-r font-semibold">배당금</th>
                </tr>
              </thead>
              <tbody>
                {simResult.items.map((item) => (
                  <tr key={item.partner_id} className="border-b border-blue-100">
                    <td className="px-3 py-2 font-medium text-slate-900">{item.partner_name}</td>
                    <td className="px-3 py-2 text-center text-slate-500">{item.equity_ratio.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right font-semibold text-blue-700">
                      {fmt(item.dividend_amount)}원
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-100">
                  <td colSpan={2} className="px-3 py-2 font-semibold text-slate-700 rounded-l">합계</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-800 rounded-r">
                    {fmt(simResult.total_dividend)}원
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 오류 메시지 */}
        {error && <p className="mt-3 text-red-500 text-xs">{error}</p>}
      </div>

      {/* 확정된 배당 기록 목록 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign size={18} className="text-green-500" />
            <h2 className="text-base font-semibold text-slate-900">{year}년 배당 확정 기록</h2>
          </div>
          {records.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="h-8 px-3 flex items-center gap-1.5 text-xs text-red-500 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} />
              전체 삭제
            </button>
          )}
        </div>

        {loading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded" />)}
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <DollarSign size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">{year}년 배당 기록이 없습니다.</p>
            <p className="text-xs mt-1">위에서 시뮬레이션 후 정산을 확정하세요.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase">
                <th className="text-left px-4 py-3">동업자</th>
                <th className="text-center px-4 py-3">지분율</th>
                <th className="text-right px-4 py-3">배당금</th>
                <th className="text-center px-4 py-3">상태</th>
                <th className="text-center px-4 py-3">지급일</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{record.partner_name}</td>
                  <td className="px-4 py-3 text-center text-slate-500">
                    {record.equity_ratio_snapshot.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {fmt(record.dividend_amount)}원
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleTogglePaid(record)}
                      className={
                        record.is_paid === 1
                          ? "flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-50 text-green-600 mx-auto"
                          : "flex items-center gap-1 text-xs px-2 py-1 rounded bg-yellow-50 text-yellow-600 mx-auto"
                      }
                    >
                      {record.is_paid === 1 ? (
                        <><CheckCircle size={12} /> 지급 완료</>
                      ) : (
                        <><Clock size={12} /> 미지급</>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-400">
                    {record.paid_date || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={2} className="px-4 py-3 text-slate-700">합계</td>
                <td className="px-4 py-3 text-right text-slate-900">
                  {fmt(records.reduce((s, r) => s + r.dividend_amount, 0))}원
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
};

export default DividendPanel;
