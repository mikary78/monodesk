// ============================================================
// components/modules/inventory/PurchaseOrderTab.jsx
// 발주서 관리 탭 컴포넌트 (발주 생성, 목록, 입고 처리, 취소)
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Package, Truck, CheckCircle, XCircle,
  Search, ChevronDown, ChevronUp, RefreshCw, X
} from "lucide-react";
import {
  fetchPurchaseOrders, fetchPurchaseOrderById,
  createPurchaseOrder, cancelPurchaseOrder,
  receivePurchaseOrder, deletePurchaseOrder,
  fetchInventoryItems, fetchInventoryCategories,
  formatCurrency, formatDate, getOrderStatusClass
} from "../../../api/inventoryApi";

// ─────────────────────────────────────────
// 발주서 생성 모달
// ─────────────────────────────────────────

const CreateOrderModal = ({ onSave, onClose }) => {
  const today = new Date().toISOString().split("T")[0];

  // 폼 기본 상태
  const [form, setForm] = useState({
    supplier: "",
    order_date: today,
    expected_date: "",
    memo: "",
  });

  // 발주 품목 목록 상태
  const [orderItems, setOrderItems] = useState([
    { item_id: "", quantity: 1, unit_price: 0, memo: "" },
  ]);

  // 전체 품목 목록 (선택용)
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 품목 목록 로드
  useEffect(() => {
    fetchInventoryItems({ limit: 500 })
      .then((res) => setAllItems(res.items || []))
      .catch(() => {});
  }, []);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 발주 품목 행 업데이트
  const handleItemChange = (idx, field, value) => {
    setOrderItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      // 품목 선택 시 기본 발주 수량·단가 자동 채우기
      if (field === "item_id") {
        const found = allItems.find((i) => i.id === parseInt(value));
        if (found) {
          updated[idx].quantity = found.default_order_quantity || 1;
          updated[idx].unit_price = found.unit_price || 0;
        }
      }
      return updated;
    });
  };

  // 발주 품목 행 추가
  const addOrderItem = () => {
    setOrderItems((prev) => [
      ...prev,
      { item_id: "", quantity: 1, unit_price: 0, memo: "" },
    ]);
  };

  // 발주 품목 행 삭제
  const removeOrderItem = (idx) => {
    if (orderItems.length === 1) return;
    setOrderItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // 총 발주 금액 계산
  const totalAmount = orderItems.reduce(
    (sum, row) => sum + (parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0),
    0
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // 유효성 검사
    if (!form.supplier.trim()) { setError("거래처명을 입력해주세요."); return; }
    const validItems = orderItems.filter((row) => row.item_id);
    if (validItems.length === 0) { setError("발주 품목을 1개 이상 선택해주세요."); return; }
    for (const row of validItems) {
      if (!row.quantity || row.quantity <= 0) {
        setError("발주 수량은 0보다 커야 합니다."); return;
      }
    }

    setLoading(true);
    try {
      await onSave({
        ...form,
        expected_date: form.expected_date || null,
        order_items: validItems.map((row) => ({
          item_id: parseInt(row.item_id),
          quantity: parseFloat(row.quantity),
          unit_price: parseFloat(row.unit_price) || 0,
          memo: row.memo || null,
        })),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 py-8 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-2xl p-6 shadow-xl my-auto">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold text-slate-900">발주서 생성</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">거래처명 *</label>
              <input
                name="supplier"
                value={form.supplier}
                onChange={handleFormChange}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
                placeholder="거래처명 입력"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">발주 날짜 *</label>
              <input
                name="order_date"
                type="date"
                value={form.order_date}
                onChange={handleFormChange}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">예상 입고일</label>
              <input
                name="expected_date"
                type="date"
                value={form.expected_date}
                onChange={handleFormChange}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">메모</label>
              <input
                name="memo"
                value={form.memo}
                onChange={handleFormChange}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
                placeholder="특이사항"
              />
            </div>
          </div>

          {/* 발주 품목 목록 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                발주 품목
              </label>
              <button
                type="button"
                onClick={addOrderItem}
                className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus size={12} /> 행 추가
              </button>
            </div>

            {/* 품목 헤더 */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 mb-1 px-1">
              <span className="col-span-5">품목</span>
              <span className="col-span-2 text-right">수량</span>
              <span className="col-span-3 text-right">단가(원)</span>
              <span className="col-span-2 text-right">소계</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {orderItems.map((row, idx) => {
                const found = allItems.find((i) => i.id === parseInt(row.item_id));
                const subtotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0);
                return (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    {/* 품목 선택 */}
                    <select
                      value={row.item_id}
                      onChange={(e) => handleItemChange(idx, "item_id", e.target.value)}
                      className="col-span-5 h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-500"
                    >
                      <option value="">품목 선택</option>
                      {allItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.unit})
                        </option>
                      ))}
                    </select>
                    {/* 수량 */}
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={row.quantity}
                      onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                      className="col-span-2 h-8 px-2 border border-slate-200 rounded text-xs text-right focus:outline-none focus:border-blue-500"
                    />
                    {/* 단가 */}
                    <input
                      type="number"
                      min="0"
                      value={row.unit_price}
                      onChange={(e) => handleItemChange(idx, "unit_price", e.target.value)}
                      className="col-span-3 h-8 px-2 border border-slate-200 rounded text-xs text-right focus:outline-none focus:border-blue-500"
                    />
                    {/* 소계 */}
                    <span className="col-span-1 text-xs text-right text-slate-600 font-medium">
                      {subtotal.toLocaleString("ko-KR")}
                    </span>
                    {/* 삭제 버튼 */}
                    <button
                      type="button"
                      onClick={() => removeOrderItem(idx)}
                      disabled={orderItems.length === 1}
                      className="col-span-1 flex justify-center text-slate-300 hover:text-red-400 disabled:opacity-20"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 합계 */}
            <div className="flex justify-end items-center mt-3 pt-3 border-t border-slate-100">
              <span className="text-sm text-slate-600 mr-3">총 발주 금액</span>
              <span className="text-base font-bold text-slate-900">
                {totalAmount.toLocaleString("ko-KR")}원
              </span>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Truck size={14} />
              {loading ? "생성 중..." : "발주서 생성"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// ─────────────────────────────────────────
// 입고 처리 모달
// ─────────────────────────────────────────

const ReceiveOrderModal = ({ order, onSave, onClose }) => {
  const today = new Date().toISOString().split("T")[0];

  // 각 발주 품목의 실제 입고 수량 상태
  const [receiveItems, setReceiveItems] = useState(
    (order.order_items || []).map((oi) => ({
      order_item_id: oi.id,
      received_quantity: oi.quantity,  // 발주 수량을 기본값으로
      unit_price: oi.unit_price,
      name: oi.item?.name || `품목 #${oi.item_id}`,
      unit: oi.item?.unit || "개",
      ordered_quantity: oi.quantity,
    }))
  );
  const [receivedDate, setReceivedDate] = useState(today);
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleItemChange = (idx, field, value) => {
    setReceiveItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: parseFloat(value) || 0 };
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!receivedDate) { setError("입고일을 입력해주세요."); return; }
    setLoading(true);
    try {
      await onSave(order.id, {
        received_date: receivedDate,
        memo: memo || null,
        items: receiveItems.map((ri) => ({
          order_item_id: ri.order_item_id,
          received_quantity: ri.received_quantity,
          unit_price: ri.unit_price,
        })),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">입고 처리</h2>
            <p className="text-xs text-slate-500 mt-0.5">{order.order_number} — {order.supplier}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">실제 입고일 *</label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">메모</label>
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
                placeholder="특이사항"
              />
            </div>
          </div>

          {/* 품목별 입고 수량 */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              품목별 실제 입고 수량
            </p>
            <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 mb-1 px-1">
              <span className="col-span-5">품목</span>
              <span className="col-span-3 text-right">발주 수량</span>
              <span className="col-span-4 text-right">실제 입고</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {receiveItems.map((ri, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <span className="col-span-5 text-sm text-slate-700 font-medium truncate">{ri.name}</span>
                  <span className="col-span-3 text-right text-xs text-slate-500">
                    {ri.ordered_quantity} {ri.unit}
                  </span>
                  <div className="col-span-4 flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={ri.received_quantity}
                      onChange={(e) => handleItemChange(idx, "received_quantity", e.target.value)}
                      className="w-full h-8 px-2 border border-slate-200 rounded text-xs text-right focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-slate-400 whitespace-nowrap">{ri.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm text-white bg-green-500 rounded-md hover:bg-green-600 disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle size={14} />
              {loading ? "처리 중..." : "입고 완료"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// ─────────────────────────────────────────
// 발주서 상세 행 (접기/펼치기)
// ─────────────────────────────────────────

const OrderRow = ({ order, onReceive, onCancel, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      {/* 발주서 요약 행 */}
      <tr className="border-b border-slate-100 hover:bg-blue-50 transition-colors">
        <td className="px-4 py-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-400 hover:text-slate-700"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </td>
        <td className="px-4 py-3 text-sm font-medium text-slate-800">{order.order_number}</td>
        <td className="px-4 py-3 text-sm text-slate-700">{order.supplier}</td>
        <td className="px-4 py-3 text-sm text-slate-500">{formatDate(order.order_date)}</td>
        <td className="px-4 py-3 text-sm text-slate-500">
          {order.expected_date ? formatDate(order.expected_date) : "-"}
        </td>
        <td className="px-4 py-3 text-sm text-right font-semibold text-slate-800">
          {formatCurrency(order.total_amount)}
        </td>
        <td className="px-4 py-3 text-center">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getOrderStatusClass(order.status)}`}>
            {order.status}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-center gap-1">
            {/* 입고 처리 버튼 (발주중인 경우만) */}
            {order.status === "발주중" && (
              <button
                onClick={() => onReceive(order)}
                title="입고 처리"
                className="px-2 py-1 text-xs text-green-600 bg-green-50 border border-green-200 rounded hover:bg-green-100 font-medium"
              >
                입고
              </button>
            )}
            {/* 취소 버튼 (발주중인 경우만) */}
            {order.status === "발주중" && (
              <button
                onClick={() => onCancel(order)}
                title="발주 취소"
                className="px-2 py-1 text-xs text-red-500 bg-red-50 border border-red-200 rounded hover:bg-red-100 font-medium"
              >
                취소
              </button>
            )}
            {/* 삭제 버튼 */}
            {order.status !== "발주중" && (
              <button
                onClick={() => onDelete(order)}
                title="삭제"
                className="px-2 py-1 text-xs text-slate-400 border border-slate-200 rounded hover:bg-slate-50"
              >
                삭제
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* 발주 품목 상세 (펼쳤을 때) */}
      {expanded && (
        <tr>
          <td colSpan={8} className="px-6 pb-3 bg-slate-50">
            <div className="py-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                발주 품목 상세
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400">
                    <th className="text-left py-1">품목</th>
                    <th className="text-right py-1">발주 수량</th>
                    <th className="text-right py-1">단가</th>
                    <th className="text-right py-1">소계</th>
                    {order.status === "입고완료" && (
                      <th className="text-right py-1">실입고</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(order.order_items || []).map((oi) => (
                    <tr key={oi.id} className="border-t border-slate-200">
                      <td className="py-1.5 text-slate-700 font-medium">
                        {oi.item?.name || `품목 #${oi.item_id}`}
                        <span className="text-slate-400 ml-1">({oi.item?.unit || "-"})</span>
                      </td>
                      <td className="py-1.5 text-right text-slate-600">{oi.quantity}</td>
                      <td className="py-1.5 text-right text-slate-600">
                        {oi.unit_price.toLocaleString("ko-KR")}원
                      </td>
                      <td className="py-1.5 text-right font-semibold text-slate-700">
                        {(oi.subtotal || 0).toLocaleString("ko-KR")}원
                      </td>
                      {order.status === "입고완료" && (
                        <td className="py-1.5 text-right text-green-600">
                          {oi.received_quantity}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {order.memo && (
                <p className="mt-2 text-xs text-slate-500">메모: {order.memo}</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};


// ─────────────────────────────────────────
// 발주서 탭 메인 컴포넌트
// ─────────────────────────────────────────

const PurchaseOrderTab = ({ onRefreshSummary }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 필터 상태
  const [filterStatus, setFilterStatus] = useState("");
  const [searchSupplier, setSearchSupplier] = useState("");

  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [receiveOrder, setReceiveOrder] = useState(null);

  // 토스트
  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 발주서 목록 로드
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchPurchaseOrders({
        status: filterStatus || undefined,
        supplier: searchSupplier || undefined,
        limit: 100,
      });
      setOrders(result.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, searchSupplier]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // 검색어 디바운스
  useEffect(() => {
    const timer = setTimeout(() => loadOrders(), 400);
    return () => clearTimeout(timer);
  }, [searchSupplier]);

  // 발주서 생성
  const handleCreate = async (data) => {
    await createPurchaseOrder(data);
    setShowCreateModal(false);
    showToast("발주서가 생성되었습니다.");
    loadOrders();
    onRefreshSummary?.();
  };

  // 입고 처리
  const handleReceive = async (orderId, data) => {
    await receivePurchaseOrder(orderId, data);
    setReceiveOrder(null);
    showToast("입고 처리가 완료되었습니다.");
    loadOrders();
    onRefreshSummary?.();
  };

  // 발주 취소
  const handleCancel = async (order) => {
    if (!confirm(`발주서 "${order.order_number}"을(를) 취소하시겠습니까?`)) return;
    try {
      await cancelPurchaseOrder(order.id);
      showToast("발주서가 취소되었습니다.");
      loadOrders();
      onRefreshSummary?.();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // 발주서 삭제
  const handleDelete = async (order) => {
    if (!confirm(`발주서 "${order.order_number}"을(를) 삭제하시겠습니까?`)) return;
    try {
      await deletePurchaseOrder(order.id);
      showToast("발주서가 삭제되었습니다.");
      loadOrders();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // 입고 처리 시 최신 발주서 정보 로드 (품목 포함)
  const handleOpenReceive = async (order) => {
    try {
      const detail = await fetchPurchaseOrderById(order.id);
      setReceiveOrder(detail);
    } catch (err) {
      showToast("발주서 정보를 불러오지 못했습니다.", "error");
    }
  };

  return (
    <div>
      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium text-white border-l-4 ${
          toast.type === "error" ? "bg-red-600 border-red-800" : "bg-green-600 border-green-800"
        }`}>
          {toast.message}
        </div>
      )}

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* 거래처 검색 */}
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchSupplier}
            onChange={(e) => setSearchSupplier(e.target.value)}
            className="w-full h-9 pl-8 pr-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
            placeholder="거래처명 검색..."
          />
        </div>

        {/* 상태 필터 */}
        {["", "발주중", "입고완료", "취소"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`h-9 px-4 text-sm rounded-md font-medium border transition-colors ${
              filterStatus === s
                ? "bg-blue-500 text-white border-blue-500"
                : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
            }`}
          >
            {s === "" ? "전체" : s}
          </button>
        ))}

        <button
          onClick={loadOrders}
          className="h-9 px-3 border border-slate-200 rounded-md text-slate-500 hover:bg-slate-50"
          title="새로고침"
        >
          <RefreshCw size={14} />
        </button>

        {/* 발주서 생성 버튼 */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="h-9 px-4 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 flex items-center gap-1.5 font-medium ml-auto"
        >
          <Plus size={14} /> 발주서 생성
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
          {error}
          <button onClick={loadOrders} className="ml-3 underline">다시 시도</button>
        </div>
      )}

      {/* 로딩 */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Truck size={48} className="mb-3 opacity-40" />
          <p className="text-base font-medium">발주서가 없습니다.</p>
          <p className="text-sm mt-1">새 발주서를 생성해보세요.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-4 py-2 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 flex items-center gap-1.5"
          >
            <Plus size={14} /> 발주서 생성
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                <th className="px-4 py-3 w-8"></th>
                <th className="text-left px-4 py-3">발주번호</th>
                <th className="text-left px-4 py-3">거래처</th>
                <th className="text-left px-4 py-3">발주일</th>
                <th className="text-left px-4 py-3">예상 입고일</th>
                <th className="text-right px-4 py-3">금액</th>
                <th className="text-center px-4 py-3">상태</th>
                <th className="text-center px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  onReceive={handleOpenReceive}
                  onCancel={handleCancel}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 발주서 생성 모달 */}
      {showCreateModal && (
        <CreateOrderModal
          onSave={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* 입고 처리 모달 */}
      {receiveOrder && (
        <ReceiveOrderModal
          order={receiveOrder}
          onSave={handleReceive}
          onClose={() => setReceiveOrder(null)}
        />
      )}
    </div>
  );
};

export default PurchaseOrderTab;
