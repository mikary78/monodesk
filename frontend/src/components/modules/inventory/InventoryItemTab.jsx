// ============================================================
// components/modules/inventory/InventoryItemTab.jsx
// 재고 품목 목록 탭 컴포넌트 (조회, 등록, 수정, 삭제, 수량 조정)
// ============================================================

import { useState, useEffect } from "react";
import {
  Plus, Edit, Trash2, Package, AlertTriangle, Search,
  TrendingDown, TrendingUp, RefreshCw
} from "lucide-react";
import {
  fetchInventoryItems, fetchInventoryCategories,
  createInventoryItem, updateInventoryItem, deleteInventoryItem,
  adjustInventoryQuantity, seedInventoryCategories,
  formatCurrency, formatQuantity, getStockStatusClass
} from "../../../api/inventoryApi";

// ─────────────────────────────────────────
// 재고 품목 등록/수정 모달 컴포넌트
// ─────────────────────────────────────────

const ItemFormModal = ({ item, categories, onSave, onClose }) => {
  // 폼 상태 초기화
  const [form, setForm] = useState({
    name: item?.name || "",
    category_id: item?.category_id || (categories[0]?.id || ""),
    unit: item?.unit || "개",
    current_quantity: item?.current_quantity ?? 0,
    min_quantity: item?.min_quantity ?? 0,
    default_order_quantity: item?.default_order_quantity ?? 1,
    unit_price: item?.unit_price ?? 0,
    supplier: item?.supplier || "",
    memo: item?.memo || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 폼 필드 변경 핸들러
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    }));
  };

  // 저장 처리
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("품목명을 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-xl">
        {/* 모달 헤더 */}
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            {item ? "재고 품목 수정" : "재고 품목 등록"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">
            &times;
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 품목명 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">품목명 *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="예: 킹크랩, 소주 (참이슬)"
            />
          </div>

          {/* 분류 및 단위 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">분류 *</label>
              <select
                name="category_id"
                value={form.category_id}
                onChange={handleChange}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">단위 *</label>
              <select
                name="unit"
                value={form.unit}
                onChange={handleChange}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
              >
                {["개", "kg", "g", "L", "mL", "병", "박스", "봉지", "캔", "팩", "장"].map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 현재 재고 및 최소 임계값 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                현재 재고 수량 {item && <span className="text-slate-400">(수량 조정 탭 이용)</span>}
              </label>
              <input
                name="current_quantity"
                type="number"
                min="0"
                step="0.1"
                value={form.current_quantity}
                onChange={handleChange}
                disabled={!!item}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">최소 재고 임계값</label>
              <input
                name="min_quantity"
                type="number"
                min="0"
                step="0.1"
                value={form.min_quantity}
                onChange={handleChange}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* 기본 발주 수량 및 단가 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">기본 발주 수량</label>
              <input
                name="default_order_quantity"
                type="number"
                min="0.1"
                step="0.1"
                value={form.default_order_quantity}
                onChange={handleChange}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">단가 (원)</label>
              <input
                name="unit_price"
                type="number"
                min="0"
                value={form.unit_price}
                onChange={handleChange}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* 거래처 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">주 거래처</label>
            <input
              name="supplier"
              value={form.supplier}
              onChange={handleChange}
              className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
              placeholder="거래처명"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">메모</label>
            <textarea
              name="memo"
              value={form.memo}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 resize-none"
              placeholder="보관 방법, 특이사항 등"
            />
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-2 pt-2">
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
              className="px-4 py-2 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// ─────────────────────────────────────────
// 수량 조정 모달 컴포넌트
// ─────────────────────────────────────────

const AdjustmentModal = ({ item, onSave, onClose }) => {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    adjustment_type: "입고",
    quantity_change: "",
    adjustment_date: today,
    unit_price: "",
    memo: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const qty = parseFloat(form.quantity_change);
    if (!qty || qty === 0) {
      setError("조정 수량을 입력해주세요.");
      return;
    }
    // 출고/폐기인 경우 음수로 변환
    const finalChange =
      ["출고", "폐기"].includes(form.adjustment_type) ? -Math.abs(qty) : Math.abs(qty);

    setLoading(true);
    try {
      await onSave({
        item_id: item.id,
        adjustment_type: form.adjustment_type,
        quantity_change: finalChange,
        adjustment_date: form.adjustment_date,
        unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
        memo: form.memo || null,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-xl">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold text-slate-900">수량 조정</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">
            &times;
          </button>
        </div>

        {/* 품목 정보 표시 */}
        <div className="mb-4 p-3 bg-slate-50 rounded-lg">
          <p className="text-sm font-medium text-slate-700">{item.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            현재 재고: <span className="font-semibold text-slate-700">
              {formatQuantity(item.current_quantity, item.unit)}
            </span>
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 조정 유형 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">조정 유형 *</label>
            <div className="grid grid-cols-4 gap-2">
              {["입고", "출고", "실사조정", "폐기"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, adjustment_type: type }))}
                  className={`py-2 text-xs rounded-md font-medium border transition-colors ${
                    form.adjustment_type === type
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* 수량 및 날짜 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                수량 ({item.unit}) *
              </label>
              <input
                name="quantity_change"
                type="number"
                min="0.1"
                step="0.1"
                value={form.quantity_change}
                onChange={handleChange}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">조정 날짜 *</label>
              <input
                name="adjustment_date"
                type="date"
                value={form.adjustment_date}
                onChange={handleChange}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* 단가 (입고 시) */}
          {form.adjustment_type === "입고" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">단가 (원)</label>
              <input
                name="unit_price"
                type="number"
                min="0"
                value={form.unit_price}
                onChange={handleChange}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
                placeholder="0"
              />
            </div>
          )}

          {/* 메모 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">사유/메모</label>
            <input
              name="memo"
              value={form.memo}
              onChange={handleChange}
              className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
              placeholder="조정 사유를 입력해주세요"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
              className="px-4 py-2 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? "처리 중..." : "적용"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// ─────────────────────────────────────────
// 재고 품목 탭 메인 컴포넌트
// ─────────────────────────────────────────

const InventoryItemTab = ({ onRefreshSummary }) => {
  // 상태 관리
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 필터 상태
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [searchText, setSearchText] = useState("");

  // 모달 상태
  const [showItemModal, setShowItemModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [adjustItem, setAdjustItem] = useState(null);

  // 토스트 메시지 상태
  const [toast, setToast] = useState(null);

  // 토스트 메시지 표시
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 데이터 로드
  const loadData = async () => {
    try {
      setLoading(true);
      const [itemsResult, catsResult] = await Promise.all([
        fetchInventoryItems({
          categoryId: filterCategory || undefined,
          lowStockOnly: filterLowStock,
          search: searchText || undefined,
        }),
        fetchInventoryCategories(),
      ]);
      setItems(itemsResult.items || []);
      setCategories(catsResult);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 필터 변경 시 재로드
  useEffect(() => {
    loadData();
  }, [filterCategory, filterLowStock]);

  // 검색어 디바운스 처리
  useEffect(() => {
    const timer = setTimeout(() => loadData(), 400);
    return () => clearTimeout(timer);
  }, [searchText]);

  // 품목 저장 (등록/수정)
  const handleSaveItem = async (formData) => {
    if (editItem) {
      await updateInventoryItem(editItem.id, formData);
      showToast("재고 품목이 수정되었습니다.");
    } else {
      await createInventoryItem(formData);
      showToast("재고 품목이 등록되었습니다.");
    }
    setShowItemModal(false);
    setEditItem(null);
    loadData();
    onRefreshSummary?.();
  };

  // 품목 삭제
  const handleDeleteItem = async (item) => {
    if (!confirm(`"${item.name}"을(를) 삭제하시겠습니까?`)) return;
    try {
      await deleteInventoryItem(item.id);
      showToast("재고 품목이 삭제되었습니다.");
      loadData();
      onRefreshSummary?.();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  // 수량 조정 처리
  const handleAdjust = async (adjustData) => {
    await adjustInventoryQuantity(adjustData);
    showToast("재고 수량이 조정되었습니다.");
    setAdjustItem(null);
    loadData();
    onRefreshSummary?.();
  };

  // 초기 분류 데이터 생성
  const handleSeedCategories = async () => {
    try {
      await seedInventoryCategories();
      showToast("기본 재고 분류가 생성되었습니다.");
      loadData();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  return (
    <div>
      {/* 토스트 알림 */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-lg shadow-lg text-sm font-medium text-white
          border-l-4 ${toast.type === "error"
            ? "bg-red-600 border-red-800"
            : "bg-green-600 border-green-800"
          }`}>
          {toast.message}
        </div>
      )}

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* 검색 */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full h-9 pl-8 pr-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
            placeholder="품목명 검색..."
          />
        </div>

        {/* 분류 필터 */}
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">전체 분류</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        {/* 재고 부족 필터 */}
        <button
          onClick={() => setFilterLowStock(!filterLowStock)}
          className={`h-9 px-4 text-sm rounded-md font-medium border transition-colors flex items-center gap-1.5 ${
            filterLowStock
              ? "bg-yellow-500 text-white border-yellow-500"
              : "bg-white text-slate-600 border-slate-200 hover:border-yellow-400"
          }`}
        >
          <AlertTriangle size={14} />
          재고 부족
        </button>

        <button
          onClick={loadData}
          className="h-9 px-3 border border-slate-200 rounded-md text-slate-500 hover:bg-slate-50"
          title="새로고침"
        >
          <RefreshCw size={14} />
        </button>

        {/* 품목 등록 버튼 */}
        <button
          onClick={() => { setEditItem(null); setShowItemModal(true); }}
          className="h-9 px-4 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 flex items-center gap-1.5 font-medium ml-auto"
        >
          <Plus size={14} />
          품목 등록
        </button>
      </div>

      {/* 에러 상태 */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
          {error}
          <button onClick={loadData} className="ml-3 underline">다시 시도</button>
        </div>
      )}

      {/* 로딩 스켈레톤 */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        /* 빈 상태 */
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Package size={48} className="mb-3 opacity-40" />
          <p className="text-base font-medium">등록된 재고 품목이 없습니다.</p>
          <p className="text-sm mt-1">품목을 등록하거나 기본 분류를 먼저 생성해보세요.</p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSeedCategories}
              className="px-4 py-2 text-sm border border-slate-200 rounded-md hover:bg-slate-50"
            >
              기본 분류 생성
            </button>
            <button
              onClick={() => { setEditItem(null); setShowItemModal(true); }}
              className="px-4 py-2 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 flex items-center gap-1.5"
            >
              <Plus size={14} /> 품목 등록
            </button>
          </div>
        </div>
      ) : (
        /* 품목 테이블 */
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                <th className="text-left px-4 py-3">품목명</th>
                <th className="text-left px-4 py-3">분류</th>
                <th className="text-right px-4 py-3">현재 재고</th>
                <th className="text-right px-4 py-3">최소 임계값</th>
                <th className="text-left px-4 py-3">거래처</th>
                <th className="text-right px-4 py-3">단가</th>
                <th className="text-center px-4 py-3">상태</th>
                <th className="text-center px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`border-b border-slate-100 hover:bg-blue-50 transition-colors ${
                    idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                  <td className="px-4 py-3 text-slate-600">{item.category?.name || "-"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {formatQuantity(item.current_quantity, item.unit)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    {formatQuantity(item.min_quantity, item.unit)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{item.supplier || "-"}</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStockStatusClass(item.stock_status)}`}>
                      {item.stock_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {/* 수량 조정 버튼 */}
                      <button
                        onClick={() => setAdjustItem(item)}
                        title="수량 조정"
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                      >
                        <RefreshCw size={14} />
                      </button>
                      {/* 수정 버튼 */}
                      <button
                        onClick={() => { setEditItem(item); setShowItemModal(true); }}
                        title="수정"
                        className="p-1.5 text-slate-500 hover:bg-slate-100 rounded"
                      >
                        <Edit size={14} />
                      </button>
                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => handleDeleteItem(item)}
                        title="삭제"
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 품목 등록/수정 모달 */}
      {showItemModal && (
        <ItemFormModal
          item={editItem}
          categories={categories}
          onSave={handleSaveItem}
          onClose={() => { setShowItemModal(false); setEditItem(null); }}
        />
      )}

      {/* 수량 조정 모달 */}
      {adjustItem && (
        <AdjustmentModal
          item={adjustItem}
          onSave={handleAdjust}
          onClose={() => setAdjustItem(null)}
        />
      )}
    </div>
  );
};

export default InventoryItemTab;
