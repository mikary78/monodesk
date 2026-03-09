// ============================================================
// IngredientsModal.jsx — 메뉴 구성 재료 관리 모달
// 메뉴 1개의 구성 재료를 추가/수정/삭제하고 원가를 확인합니다.
// ============================================================

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Save, FlaskConical } from "lucide-react";
import {
  fetchIngredients,
  addIngredient,
  updateIngredient,
  deleteIngredient,
  formatCurrency,
} from "../../../api/menuApi";

// 신규 재료 초기 폼 상태
const EMPTY_ING = { ingredient_name: "", quantity: "", unit: "g", unit_price: "" };

const IngredientsModal = ({ isOpen, onClose, menuItem, onCostUpdate }) => {
  // 재료 목록 상태
  const [ingredients, setIngredients] = useState([]);
  // 새 재료 입력 폼 상태
  const [newIng, setNewIng] = useState(EMPTY_ING);
  const [loading, setLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addError, setAddError] = useState(null);

  // 모달 열릴 때마다 재료 목록 로드
  useEffect(() => {
    if (isOpen && menuItem) {
      loadIngredients();
      setNewIng(EMPTY_ING);
      setError(null);
      setAddError(null);
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

  // 새 재료 입력 필드 변경 핸들러
  const handleNewIngChange = (e) => {
    const { name, value } = e.target;
    setNewIng((prev) => ({ ...prev, [name]: value }));
    if (addError) setAddError(null);
  };

  // 재료 추가 핸들러
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
        quantity: Number(newIng.quantity),
        unit: newIng.unit || "g",
        unit_price: newIng.unit_price ? Number(newIng.unit_price) : 0,
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

  // 재료 삭제 핸들러
  const handleDeleteIngredient = async (ingredientId) => {
    if (!window.confirm("이 재료를 삭제하시겠습니까?")) return;
    try {
      await deleteIngredient(ingredientId);
      await loadIngredients();
      if (onCostUpdate) onCostUpdate(menuItem.id);
    } catch (err) {
      setError(err.message);
    }
  };

  // 총 원가 계산
  const totalCost = ingredients.reduce(
    (sum, ing) => sum + (ing.quantity || 0) * (ing.unit_price || 0),
    0
  );

  if (!isOpen || !menuItem) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 모달 본문 */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-xl mx-4 p-6 max-h-[80vh] overflow-y-auto">
        {/* 헤더 */}
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

        {/* 원가 합계 요약 */}
        <div className="bg-slate-50 rounded-lg p-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-slate-500">재료 기반 원가 합계</span>
          <div className="text-right">
            <span className="text-lg font-bold text-slate-900">{formatCurrency(totalCost)}</span>
            {menuItem.price > 0 && (
              <span className="ml-2 text-sm text-slate-400">
                (원가율 {((totalCost / menuItem.price) * 100).toFixed(1)}%)
              </span>
            )}
          </div>
        </div>

        {/* 재료 목록 */}
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
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                <th className="text-left px-3 py-2">재료명</th>
                <th className="text-right px-3 py-2">수량</th>
                <th className="text-left px-2 py-2">단위</th>
                <th className="text-right px-3 py-2">단가</th>
                <th className="text-right px-3 py-2">소계</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing) => (
                <tr key={ing.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{ing.ingredient_name}</td>
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
                  <td className="px-2 py-2">
                    <button
                      onClick={() => handleDeleteIngredient(ing.id)}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                      title="재료 삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 새 재료 추가 폼 */}
        <div className="border-t border-slate-200 pt-4">
          <h3 className="text-sm font-medium text-slate-700 mb-2">재료 추가</h3>
          {addError && (
            <div className="bg-red-50 text-red-600 text-xs p-2 rounded mb-2">{addError}</div>
          )}
          <div className="grid grid-cols-12 gap-2 items-end">
            {/* 재료명 */}
            <div className="col-span-4">
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
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="ml">ml</option>
                <option value="L">L</option>
                <option value="개">개</option>
                <option value="팩">팩</option>
                <option value="병">병</option>
                <option value="봉">봉</option>
              </select>
            </div>
            {/* 단가 */}
            <div className="col-span-3">
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
        </div>

        {/* 닫기 버튼 */}
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
  );
};

export default IngredientsModal;
