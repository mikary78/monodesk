// ============================================================
// SalesList.jsx — 월별 매출 목록 테이블
// 일별 매출 내역을 조회하고 수정/삭제를 지원합니다.
// POS 비교 섹션: 수기 매출 vs POS 집계 일별 비교
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, TrendingUp, BarChart2, AlertTriangle, CheckCircle } from "lucide-react";
import { fetchSales, deleteSales, formatCurrency, formatDateKo } from "../../../api/accountingApi";
import SalesForm from "./SalesForm";
import { useToast } from "../../../contexts/ToastContext";
import ConfirmDialog from "../../common/ConfirmDialog";

const SalesList = ({ year, month }) => {
  const toast = useToast();
  const [salesList, setSalesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  // POS 비교 섹션 토글
  const [showPosCompare, setShowPosCompare] = useState(false);
  // 삭제 확인 다이얼로그 상태
  const [confirmState, setConfirmState] = useState({ open: false, targetId: null });

  const loadSales = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSales(year, month);
      setSalesList(data);
    } catch (err) {
      console.error("매출 목록 로드 실패:", err);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  // 삭제 버튼 클릭 → 확인 다이얼로그 열기
  const handleDeleteClick = (id) => {
    setConfirmState({ open: true, targetId: id });
  };

  // 삭제 확인 → 실제 삭제 실행
  const handleDeleteConfirm = async () => {
    const id = confirmState.targetId;
    setConfirmState({ open: false, targetId: null });
    try {
      await deleteSales(id);
      await loadSales();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // 삭제 취소
  const handleDeleteCancel = () => {
    setConfirmState({ open: false, targetId: null });
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setShowForm(false);
  };

  const handleFormSuccess = async () => {
    setShowForm(false);
    setEditingItem(null);
    await loadSales();
  };

  const handleFormCancel = () => {
    setShowForm(false);
    setEditingItem(null);
  };

  // 월 합계 계산
  const totals = salesList.reduce(
    (acc, s) => ({
      cash: acc.cash + (s.cash_amount || 0),
      card: acc.card + (s.card_amount || 0),
      delivery: acc.delivery + (s.delivery_amount || 0),
      catchtable: acc.catchtable + (s.catchtable_amount || 0),
      total: acc.total + (s.total_sales || 0),
    }),
    { cash: 0, card: 0, delivery: 0, catchtable: 0, total: 0 }
  );

  // POS 비교 데이터가 있는 행만 필터 (pos_total > 0)
  const posRows = salesList.filter((s) => (s.pos_total || 0) > 0);
  // 수기 합계 = card + cash + catchtable + transfer (delivery 제외, POS 미포함)
  const manualTotal = (s) =>
    (s.card_amount || 0) + (s.cash_amount || 0) + (s.catchtable_amount || 0) + (s.transfer_amount || 0);
  // 차이 = 수기합계 - pos_total (양수: 수기 > POS, 음수: POS > 수기)
  const posDiff = (s) => manualTotal(s) - (s.pos_total || 0);

  return (
    <div>
      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={confirmState.open}
        title="매출 기록 삭제"
        message="이 매출 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmText="삭제"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
      {/* 신규 입력 폼 */}
      {showForm && (
        <SalesForm onSuccess={handleFormSuccess} onCancel={handleFormCancel} />
      )}
      {/* 수정 폼 */}
      {editingItem && (
        <SalesForm
          initialData={editingItem}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-blue-500" />
          <h3 className="text-base font-semibold text-slate-900">
            {year}년 {month}월 매출 내역
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {/* POS 비교 토글 버튼 (POS 데이터가 있을 때만 표시) */}
          {posRows.length > 0 && !showForm && !editingItem && (
            <button
              onClick={() => setShowPosCompare((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                showPosCompare
                  ? "bg-amber-50 border-amber-300 text-amber-700"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <BarChart2 size={14} />
              POS 비교
            </button>
          )}
          {!showForm && !editingItem && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600"
            >
              <Plus size={15} />
              매출 입력
            </button>
          )}
        </div>
      </div>

      {/* 월 합계 카드 */}
      {salesList.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
          {[
            { label: "카드", value: totals.card, color: "text-blue-600" },
            { label: "현금", value: totals.cash, color: "text-green-600" },
            { label: "배달", value: totals.delivery, color: "text-purple-600" },
            { label: "캐치테이블", value: totals.catchtable, color: "text-orange-600" },
            { label: "합계", value: totals.total, color: "text-slate-900" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className={`text-sm font-semibold ${color}`}>{formatCurrency(value)}</p>
            </div>
          ))}
        </div>
      )}

      {/* 목록 테이블 */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
          ))}
        </div>
      ) : salesList.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <TrendingUp size={36} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">이번 달 매출 기록이 없습니다.</p>
          <p className="text-xs mt-1">위의 &lsquo;매출 입력&rsquo; 버튼을 눌러 추가하세요.</p>
        </div>
      ) : (
        <>
          {/* 매출 목록 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">날짜</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-slate-500">카드</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-slate-500">현금</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-slate-500">배달</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-slate-500">캐치테이블</th>
                  <th className="text-right py-2.5 px-3 text-xs font-medium text-slate-500">합계</th>
                  <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">메모</th>
                  <th className="py-2.5 px-3" />
                </tr>
              </thead>
              <tbody>
                {salesList.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-2.5 px-3 text-slate-700">{formatDateKo(item.sales_date)}</td>
                    <td className="py-2.5 px-3 text-right text-blue-700 font-medium">
                      {formatCurrency(item.card_amount)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-green-700 font-medium">
                      {formatCurrency(item.cash_amount)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-purple-700 font-medium">
                      {formatCurrency(item.delivery_amount)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-orange-600 font-medium">
                      {item.catchtable_amount > 0 ? formatCurrency(item.catchtable_amount) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                      {formatCurrency(item.total_sales)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs">{item.memo || "-"}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1 text-slate-400 hover:text-blue-500 rounded"
                          title="수정"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(item.id)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded"
                          title="삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* POS 비교 섹션 — 토글 시 표시 */}
          {showPosCompare && posRows.length > 0 && (
            <div className="mt-6 border border-amber-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border-b border-amber-200">
                <BarChart2 size={16} className="text-amber-600" />
                <h4 className="text-sm font-semibold text-amber-800">POS 비교 (수기 vs 포스)</h4>
                <span className="ml-auto text-xs text-amber-600">
                  차이 = 수기합계(카드+현금+캐치+이체) - POS 총액
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-amber-100 bg-amber-50/50">
                      <th className="text-left py-2 px-3 font-medium text-slate-500">날짜</th>
                      <th className="text-right py-2 px-3 font-medium text-slate-500">수기 합계</th>
                      <th className="text-right py-2 px-3 font-medium text-slate-500">POS 총액</th>
                      <th className="text-right py-2 px-3 font-medium text-slate-500">POS 카드</th>
                      <th className="text-right py-2 px-3 font-medium text-slate-500">POS 현금</th>
                      <th className="text-right py-2 px-3 font-medium text-slate-500">차이</th>
                      <th className="text-center py-2 px-3 font-medium text-slate-500">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posRows.map((item) => {
                      const manual = manualTotal(item);
                      const diff = posDiff(item);
                      // 캐치페이 금액과 차이가 일치하면 정상 (POS에 캐치가 미반영)
                      const catchAmt = item.catchtable_amount || 0;
                      const isExpected = Math.abs(diff - catchAmt) < 100;
                      const isZero = Math.abs(diff) < 100;
                      return (
                        <tr key={item.id} className="border-b border-amber-50 hover:bg-amber-50/30">
                          <td className="py-2 px-3 text-slate-700">{formatDateKo(item.sales_date)}</td>
                          <td className="py-2 px-3 text-right font-medium text-slate-700">
                            {formatCurrency(manual)}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-blue-600">
                            {formatCurrency(item.pos_total)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-500">
                            {formatCurrency(item.pos_card)}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-500">
                            {formatCurrency(item.pos_cash)}
                          </td>
                          <td className={`py-2 px-3 text-right font-semibold ${
                            isZero ? "text-slate-400"
                            : diff > 0 ? "text-red-500"
                            : "text-green-600"
                          }`}>
                            {diff === 0 ? "-" : `${diff > 0 ? "+" : ""}${formatCurrency(diff)}`}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {isZero ? (
                              <CheckCircle size={13} className="mx-auto text-green-500" title="일치" />
                            ) : isExpected ? (
                              <span className="inline-flex items-center gap-0.5 text-amber-600">
                                <CheckCircle size={12} />
                                <span className="text-xs">캐치</span>
                              </span>
                            ) : (
                              <AlertTriangle size={13} className="mx-auto text-red-400" title="불일치" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 bg-amber-50/30 border-t border-amber-100 text-xs text-slate-500">
                캐치 상태: 차이가 캐치테이블 금액과 일치 (POS 미집계가 예상된 금액)
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SalesList;
