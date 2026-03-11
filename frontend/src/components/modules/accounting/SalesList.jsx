// ============================================================
// SalesList.jsx — 월별 매출 목록 테이블
// 일별 매출 내역을 조회하고 수정/삭제를 지원합니다.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, TrendingUp } from "lucide-react";
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
      total: acc.total + (s.total_sales || 0),
    }),
    { cash: 0, card: 0, delivery: 0, total: 0 }
  );

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

      {/* 월 합계 카드 */}
      {salesList.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: "카드", value: totals.card, color: "text-blue-600" },
            { label: "현금", value: totals.cash, color: "text-green-600" },
            { label: "배달", value: totals.delivery, color: "text-purple-600" },
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2.5 px-3 text-xs font-medium text-slate-500">날짜</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-slate-500">카드</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-slate-500">현금</th>
                <th className="text-right py-2.5 px-3 text-xs font-medium text-slate-500">배달</th>
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
      )}
    </div>
  );
};

export default SalesList;
