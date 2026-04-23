// ============================================================
// IngredientsModal.jsx — 메뉴 구성 재료 관리 모달
// 메뉴 1개의 구성 재료를 추가/수정/삭제하고 원가를 확인합니다.
//
// 변경 이력 (2026-03-12):
//   - 인라인 수정 기능 추가 (연필 아이콘 → 행 편집 모드 전환)
//   - window.confirm → ConfirmDialog 교체
//   - 재고 품목 드롭다운 연동 (단가 자동 채움)
//   - 원가율·마진 실시간 요약 표시 강화
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, Pencil, Check, XCircle, FlaskConical, PackageSearch } from "lucide-react";
import {
  fetchIngredients,
  addIngredient,
  updateIngredient,
  deleteIngredient,
  fetchInventoryItemsForMenu,
  formatCurrency,
  getCostRatioBadgeClass,
} from "../../../api/menuApi";
import ConfirmDialog from "../../common/ConfirmDialog";

// 재료 구분 옵션
const INGREDIENT_TYPE_OPTIONS = ["원재료", "부재료", "양념", "소스", "기타"];

// 재료 구분별 뱃지 스타일 매핑
const INGREDIENT_TYPE_BADGE = {
  원재료: "bg-blue-50 text-blue-600",
  부재료: "bg-green-50 text-green-600",
  양념: "bg-orange-50 text-orange-600",
  소스: "bg-purple-50 text-purple-600",
  기타: "bg-slate-100 text-slate-500",
};

// 신규 재료 입력 폼 초기값
const EMPTY_ING = {
  ingredient_name: "",
  ingredient_type: "원재료",
  quantity: "",
  unit: "g",
  unit_price: "",
  inventory_item_id: null,
};

// 단위 선택 옵션 목록
const UNIT_OPTIONS = ["g", "kg", "ml", "L", "개", "팩", "병", "봉"];

const IngredientsModal = ({ isOpen, onClose, menuItem, onCostUpdate }) => {
  // ─── 재료 목록 상태 ───────────────────────────────────────
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ─── 신규 재료 추가 폼 상태 ──────────────────────────────
  const [newIng, setNewIng] = useState(EMPTY_ING);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);

  // ─── 인라인 수정 상태 ────────────────────────────────────
  // editingId: 현재 수정 중인 재료 id (null이면 수정 모드 아님)
  const [editingId, setEditingId] = useState(null);
  // editForm: 수정 중인 재료의 임시 필드 값
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState(null);

  // ─── 삭제 확인 다이얼로그 상태 ──────────────────────────
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, name }

  // ─── 재고 품목 목록 상태 (드롭다운용) ────────────────────
  const [inventoryItems, setInventoryItems] = useState([]);

  // 모달 열릴 때마다 재료 목록 + 재고 품목 로드
  useEffect(() => {
    if (isOpen && menuItem) {
      loadIngredients();
      loadInventoryItems();
      setNewIng(EMPTY_ING);
      setError(null);
      setAddError(null);
      setEditingId(null);
      setEditForm({});
    }
  }, [isOpen, menuItem]);

  // 재료 목록 불러오기
  const loadIngredients = async () => {
    setLoading(true);
    try {
      const data = await fetchIngredients(menuItem.id);
      setIngredients(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 재고 품목 목록 불러오기 (실패해도 드롭다운 없이 직접 입력으로 대체)
  const loadInventoryItems = async () => {
    try {
      const data = await fetchInventoryItemsForMenu();
      setInventoryItems(Array.isArray(data) ? data : []);
    } catch {
      setInventoryItems([]);
    }
  };

  // ─── 원가 요약 계산 ──────────────────────────────────────
  const totalCost = ingredients.reduce(
    (sum, ing) => sum + (ing.quantity || 0) * (ing.unit_price || 0),
    0
  );
  const costRatio = menuItem?.price > 0
    ? (totalCost / menuItem.price) * 100
    : 0;
  const margin = (menuItem?.price || 0) - totalCost;

  // ─── 신규 재료 추가 ──────────────────────────────────────

  // 신규 재료 입력 필드 변경 핸들러
  const handleNewIngChange = (e) => {
    const { name, value } = e.target;
    setNewIng((prev) => ({ ...prev, [name]: value }));
    if (addError) setAddError(null);
  };

  // 재고 품목 드롭다운 선택 → 재료명 + 단가 자동 채움 (신규 추가 폼)
  const handleInventorySelectForNew = (e) => {
    const itemId = e.target.value;
    if (!itemId) {
      // "직접 입력" 선택 시 연동 해제
      setNewIng((prev) => ({ ...prev, inventory_item_id: null }));
      return;
    }
    const found = inventoryItems.find((i) => String(i.id) === itemId);
    if (found) {
      setNewIng((prev) => ({
        ...prev,
        inventory_item_id: found.id,
        ingredient_name: found.name,
        // 재고 품목의 단가가 있으면 자동 채움
        unit_price: found.unit_price != null ? String(found.unit_price) : prev.unit_price,
        unit: found.unit || prev.unit,
      }));
    }
    if (addError) setAddError(null);
  };

  // 재료 추가 실행
  const handleAddIngredient = async () => {
    // 유효성 검사
    if (!newIng.ingredient_name.trim()) {
      setAddError("재료명을 입력해주세요.");
      return;
    }
    if (!newIng.quantity || Number(newIng.quantity) <= 0) {
      setAddError("수량은 0보다 커야 합니다.");
      return;
    }

    setAddLoading(true);
    try {
      await addIngredient(menuItem.id, {
        ingredient_name: newIng.ingredient_name.trim(),
        ingredient_type: newIng.ingredient_type || "원재료",
        quantity: Number(newIng.quantity),
        unit: newIng.unit || "g",
        unit_price: newIng.unit_price ? Number(newIng.unit_price) : 0,
        inventory_item_id: newIng.inventory_item_id || null,
      });
      setNewIng(EMPTY_ING);
      await loadIngredients();
      // 부모 컴포넌트에 원가 변경 알림
      if (onCostUpdate) onCostUpdate(menuItem.id);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  // ─── 인라인 수정 ─────────────────────────────────────────

  // 수정 모드 진입 — 클릭한 행의 현재 값을 editForm에 복사
  const handleStartEdit = (ing) => {
    setEditingId(ing.id);
    setEditForm({
      ingredient_name: ing.ingredient_name,
      ingredient_type: ing.ingredient_type || "원재료",
      quantity: String(ing.quantity),
      unit: ing.unit || "g",
      unit_price: String(ing.unit_price || ""),
      inventory_item_id: ing.inventory_item_id || null,
    });
    setEditError(null);
  };

  // 수정 모드 취소
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setEditError(null);
  };

  // 수정 폼 필드 변경 핸들러
  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
    if (editError) setEditError(null);
  };

  // 재고 품목 드롭다운 선택 → 재료명 + 단가 자동 채움 (수정 폼)
  const handleInventorySelectForEdit = (e) => {
    const itemId = e.target.value;
    if (!itemId) {
      setEditForm((prev) => ({ ...prev, inventory_item_id: null }));
      return;
    }
    const found = inventoryItems.find((i) => String(i.id) === itemId);
    if (found) {
      setEditForm((prev) => ({
        ...prev,
        inventory_item_id: found.id,
        ingredient_name: found.name,
        unit_price: found.unit_price != null ? String(found.unit_price) : prev.unit_price,
        unit: found.unit || prev.unit,
      }));
    }
  };

  // 수정 저장 실행
  const handleSaveEdit = async (ingredientId) => {
    // 유효성 검사
    if (!editForm.ingredient_name?.trim()) {
      setEditError("재료명을 입력해주세요.");
      return;
    }
    if (!editForm.quantity || Number(editForm.quantity) <= 0) {
      setEditError("수량은 0보다 커야 합니다.");
      return;
    }

    setEditLoading(true);
    try {
      await updateIngredient(ingredientId, {
        ingredient_name: editForm.ingredient_name.trim(),
        ingredient_type: editForm.ingredient_type || "원재료",
        quantity: Number(editForm.quantity),
        unit: editForm.unit || "g",
        unit_price: editForm.unit_price ? Number(editForm.unit_price) : 0,
        inventory_item_id: editForm.inventory_item_id || null,
      });
      setEditingId(null);
      setEditForm({});
      await loadIngredients();
      if (onCostUpdate) onCostUpdate(menuItem.id);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // ─── 삭제 ────────────────────────────────────────────────

  // 삭제 버튼 클릭 → ConfirmDialog 표시
  const handleDeleteClick = (ing) => {
    setDeleteTarget({ id: ing.id, name: ing.ingredient_name });
  };

  // 삭제 확인 → 실제 삭제 실행
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await deleteIngredient(targetId);
      await loadIngredients();
      if (onCostUpdate) onCostUpdate(menuItem.id);
    } catch (err) {
      setError(err.message);
    }
  };

  // 삭제 취소
  const handleDeleteCancel = () => {
    setDeleteTarget(null);
  };

  if (!isOpen || !menuItem) return null;

  return (
    <>
      {/* ─── 메인 모달 ─────────────────────────────────────── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* 오버레이 */}
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        {/* 모달 본문 */}
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[85vh] overflow-y-auto">

          {/* ── 헤더 ────────────────────────────────────────── */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <FlaskConical size={18} className="text-purple-500" />
                구성 재료 관리
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">{menuItem.name}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100"
              title="닫기"
            >
              <X size={16} className="text-slate-500" />
            </button>
          </div>

          {/* ── 원가 요약 ────────────────────────────────────── */}
          <div className="bg-slate-50 rounded-lg p-4 mb-4 grid grid-cols-3 gap-3">
            {/* 재료 원가 합계 */}
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">재료 원가 합계</p>
              <p className="text-base font-bold text-slate-900">{formatCurrency(totalCost)}</p>
            </div>
            {/* 원가율 */}
            <div className="text-center border-x border-slate-200">
              <p className="text-xs text-slate-400 mb-1">원가율</p>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-sm font-semibold ${
                  menuItem.price > 0 ? getCostRatioBadgeClass(costRatio) : "bg-slate-100 text-slate-400"
                }`}
              >
                {menuItem.price > 0 ? `${costRatio.toFixed(1)}%` : "—"}
              </span>
            </div>
            {/* 예상 마진 */}
            <div className="text-center">
              <p className="text-xs text-slate-400 mb-1">예상 마진</p>
              <p className={`text-base font-bold ${margin >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {formatCurrency(margin)}
              </p>
            </div>
          </div>

          {/* ── 재료 목록 ────────────────────────────────────── */}
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md mb-3">{error}</div>
          )}

          {loading ? (
            <div className="py-6 text-center text-slate-500 text-sm">로딩 중...</div>
          ) : ingredients.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-sm">
              등록된 재료가 없습니다. 아래에서 재료를 추가해주세요.
            </div>
          ) : (
            <>
              {/* 수정 오류 메시지 */}
              {editError && (
                <div className="bg-red-50 text-red-600 text-xs p-2 rounded mb-2">{editError}</div>
              )}
              <table className="w-full text-sm mb-4">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                    {/* 재료 구분 열 */}
                    <th className="text-left px-3 py-2 w-20">구분</th>
                    <th className="text-left px-3 py-2">재료명</th>
                    <th className="text-right px-3 py-2">수량</th>
                    <th className="text-left px-2 py-2">단위</th>
                    <th className="text-right px-3 py-2">단가</th>
                    <th className="text-right px-3 py-2">소계</th>
                    {/* 수정·삭제 액션 열 */}
                    <th className="px-2 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ing) =>
                    editingId === ing.id ? (
                      /* ── 편집 모드 행 ──────────────────────────── */
                      <tr key={ing.id} className="border-b border-blue-100 bg-blue-50">
                        {/* 재료 구분 select — 편집 모드 */}
                        <td className="px-2 py-1.5">
                          <select
                            name="ingredient_type"
                            value={editForm.ingredient_type || "원재료"}
                            onChange={handleEditFormChange}
                            className="w-full h-7 px-1 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-400"
                          >
                            {INGREDIENT_TYPE_OPTIONS.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </td>
                        {/* 재료명 — 재고 드롭다운 + 직접 입력 */}
                        <td className="px-2 py-1.5">
                          {inventoryItems.length > 0 && (
                            <select
                              value={editForm.inventory_item_id || ""}
                              onChange={handleInventorySelectForEdit}
                              className="w-full h-7 px-1 border border-slate-200 rounded text-xs bg-white mb-1 focus:outline-none focus:border-blue-400"
                            >
                              <option value="">직접 입력</option>
                              {inventoryItems.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <input
                            type="text"
                            name="ingredient_name"
                            value={editForm.ingredient_name}
                            onChange={handleEditFormChange}
                            className="w-full h-7 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-400"
                            placeholder="재료명"
                          />
                        </td>
                        {/* 수량 */}
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            name="quantity"
                            value={editForm.quantity}
                            onChange={handleEditFormChange}
                            min="0"
                            className="w-full h-7 px-2 border border-slate-200 rounded text-xs text-right focus:outline-none focus:border-blue-400"
                          />
                        </td>
                        {/* 단위 */}
                        <td className="px-2 py-1.5">
                          <select
                            name="unit"
                            value={editForm.unit}
                            onChange={handleEditFormChange}
                            className="w-full h-7 px-1 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-400"
                          >
                            {UNIT_OPTIONS.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </td>
                        {/* 단가 */}
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            name="unit_price"
                            value={editForm.unit_price}
                            onChange={handleEditFormChange}
                            min="0"
                            className="w-full h-7 px-2 border border-slate-200 rounded text-xs text-right focus:outline-none focus:border-blue-400"
                          />
                        </td>
                        {/* 소계 (실시간 미리보기) */}
                        <td className="px-3 py-1.5 text-right text-xs text-slate-500">
                          {editForm.quantity && editForm.unit_price
                            ? formatCurrency(Number(editForm.quantity) * Number(editForm.unit_price))
                            : "—"}
                        </td>
                        {/* 저장/취소 버튼 */}
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleSaveEdit(ing.id)}
                              disabled={editLoading}
                              className="w-6 h-6 flex items-center justify-center rounded hover:bg-blue-100 text-blue-500 disabled:opacity-50"
                              title="저장"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400"
                              title="취소"
                            >
                              <XCircle size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      /* ── 일반 표시 행 ──────────────────────────── */
                      <tr key={ing.id} className="border-b border-slate-100 hover:bg-slate-50">
                        {/* 재료 구분 뱃지 */}
                        <td className="px-3 py-2">
                          <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            INGREDIENT_TYPE_BADGE[ing.ingredient_type] || INGREDIENT_TYPE_BADGE["기타"]
                          }`}>
                            {ing.ingredient_type || "원재료"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {ing.ingredient_name}
                          {/* 재고 연동 표시 뱃지 */}
                          {ing.inventory_item_id && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              <PackageSearch size={10} />
                              재고연동
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-slate-700">{ing.quantity}</td>
                        <td className="px-2 py-2 text-slate-500">{ing.unit}</td>
                        <td className="px-3 py-2 text-right text-slate-700">
                          {ing.unit_price > 0 ? `${ing.unit_price.toLocaleString("ko-KR")}원` : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-800">
                          {ing.unit_price > 0
                            ? `${(ing.quantity * ing.unit_price).toLocaleString("ko-KR")}원`
                            : "-"}
                        </td>
                        {/* 수정·삭제 버튼 */}
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleStartEdit(ing)}
                              className="w-6 h-6 flex items-center justify-center rounded hover:bg-blue-50 text-slate-400 hover:text-blue-500"
                              title="재료 수정"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(ing)}
                              className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                              title="재료 삭제"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </>
          )}

          {/* ── 새 재료 추가 폼 ──────────────────────────────── */}
          <div className="border-t border-slate-200 pt-4">
            <h3 className="text-sm font-medium text-slate-700 mb-2">재료 추가</h3>
            {addError && (
              <div className="bg-red-50 text-red-600 text-xs p-2 rounded mb-2">{addError}</div>
            )}

            {/* 재고 품목 드롭다운 (재고 연동 가능할 때만 표시) */}
            {inventoryItems.length > 0 && (
              <div className="mb-2">
                <label className="block text-xs text-slate-500 mb-1">
                  재고 품목 선택 <span className="text-slate-400">(선택 시 재료명·단가 자동 채움)</span>
                </label>
                <select
                  value={newIng.inventory_item_id || ""}
                  onChange={handleInventorySelectForNew}
                  className="w-full h-8 px-2 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">직접 입력 (재고 연동 안 함)</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} {item.unit_price ? `— ${item.unit_price.toLocaleString("ko-KR")}원/${item.unit || "단위"}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 재료 상세 입력 필드 */}
            <div className="grid grid-cols-12 gap-2 items-end">
              {/* 재료 구분 */}
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">구분</label>
                <select
                  name="ingredient_type"
                  value={newIng.ingredient_type}
                  onChange={handleNewIngChange}
                  className="w-full h-8 px-1 border border-slate-200 rounded text-xs bg-white focus:outline-none focus:border-blue-500"
                >
                  {INGREDIENT_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {/* 재료명 — 구분(2) + 재료명(3) + 수량(2) + 단위(2) + 단가(2) + 버튼(1) = 12 */}
              <div className="col-span-3">
                <label className="block text-xs text-slate-500 mb-1">재료명</label>
                <input
                  type="text"
                  name="ingredient_name"
                  value={newIng.ingredient_name}
                  onChange={handleNewIngChange}
                  placeholder="예: 광어 살"
                  className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              {/* 수량 */}
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">수량</label>
                <input
                  type="number"
                  name="quantity"
                  value={newIng.quantity}
                  onChange={handleNewIngChange}
                  placeholder="100"
                  min="0"
                  className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              {/* 단위 */}
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">단위</label>
                <select
                  name="unit"
                  value={newIng.unit}
                  onChange={handleNewIngChange}
                  className="w-full h-8 px-1 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-500 bg-white"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              {/* 단가 */}
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">단가 (원)</label>
                <input
                  type="number"
                  name="unit_price"
                  value={newIng.unit_price}
                  onChange={handleNewIngChange}
                  placeholder="0"
                  min="0"
                  className="w-full h-8 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              {/* 추가 버튼 */}
              <div className="col-span-1">
                <button
                  onClick={handleAddIngredient}
                  disabled={addLoading}
                  className="w-full h-8 bg-blue-500 text-white rounded flex items-center justify-center hover:bg-blue-600 disabled:opacity-50"
                  title="재료 추가"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* 신규 추가 소계 미리보기 */}
            {newIng.quantity && newIng.unit_price && (
              <p className="text-xs text-slate-400 mt-1.5 text-right">
                소계 미리보기: {formatCurrency(Number(newIng.quantity) * Number(newIng.unit_price))}
              </p>
            )}
          </div>

          {/* ── 닫기 버튼 ────────────────────────────────────── */}
          <div className="flex justify-end mt-4">
            <button
              onClick={onClose}
              className="h-9 px-5 bg-slate-100 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-200"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {/* ─── 삭제 확인 다이얼로그 (window.confirm 대체) ────── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="재료 삭제"
        message={`"${deleteTarget?.name}" 재료를 삭제하시겠습니까? 삭제하면 원가가 재계산됩니다.`}
        confirmText="삭제"
        cancelText="취소"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </>
  );
};

export default IngredientsModal;
