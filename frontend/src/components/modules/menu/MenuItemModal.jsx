// ============================================================
// MenuItemModal.jsx — 메뉴 등록/수정 모달 컴포넌트
// 메뉴 기본 정보 입력 폼을 제공합니다.
// ============================================================

import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";

// 초기 폼 상태 정의
const INITIAL_FORM = {
  name: "",
  category_id: "",
  price: "",
  cost: "",
  description: "",
  allergens: "",
  is_active: 1,
  is_featured: 0,
};

const MenuItemModal = ({ isOpen, onClose, onSave, item, categories }) => {
  // 폼 데이터 상태 관리
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // 수정 모드일 때 기존 데이터로 폼 초기화
  useEffect(() => {
    if (item) {
      setForm({
        name: item.name || "",
        category_id: item.category_id || "",
        price: item.price || "",
        cost: item.cost || "",
        description: item.description || "",
        allergens: item.allergens || "",
        is_active: item.is_active ?? 1,
        is_featured: item.is_featured ?? 0,
      });
    } else {
      setForm(INITIAL_FORM);
    }
    setErrors({});
  }, [item, isOpen]);

  // 폼 필드 변경 핸들러
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (checked ? 1 : 0) : value,
    }));
    // 해당 필드 에러 초기화
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  // 폼 유효성 검사
  const validate = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = "메뉴명을 입력해주세요.";
    if (!form.category_id) newErrors.category_id = "카테고리를 선택해주세요.";
    if (!form.price || Number(form.price) < 100) newErrors.price = "판매가는 100원 이상이어야 합니다.";
    if (form.cost !== "" && Number(form.cost) < 0) newErrors.cost = "원가는 0원 이상이어야 합니다.";
    return newErrors;
  };

  // 저장 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setLoading(true);
    try {
      await onSave({
        ...form,
        category_id: Number(form.category_id),
        price: Number(form.price),
        cost: form.cost !== "" ? Number(form.cost) : 0,
      });
      onClose();
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  };

  // 모달이 닫혀 있으면 렌더링하지 않음
  if (!isOpen) return null;

  const isEditMode = !!item;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 모달 본문 */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEditMode ? "메뉴 수정" : "메뉴 등록"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100"
            title="닫기"
          >
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 전체 오류 메시지 */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              {errors.submit}
            </div>
          )}

          {/* 메뉴명 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              메뉴명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="예: 광어회 소 (1인분)"
              className={`w-full h-9 px-3 border rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ${errors.name ? "border-red-400" : "border-slate-200"}`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              카테고리 <span className="text-red-500">*</span>
            </label>
            <select
              name="category_id"
              value={form.category_id}
              onChange={handleChange}
              className={`w-full h-9 px-3 border rounded-md text-sm focus:outline-none focus:border-blue-500 bg-white ${errors.category_id ? "border-red-400" : "border-slate-200"}`}
            >
              <option value="">카테고리 선택</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            {errors.category_id && <p className="mt-1 text-xs text-red-500">{errors.category_id}</p>}
          </div>

          {/* 판매가 / 원가 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                판매가 (원) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="price"
                value={form.price}
                onChange={handleChange}
                placeholder="예: 25000"
                min="100"
                step="100"
                className={`w-full h-9 px-3 border rounded-md text-sm focus:outline-none focus:border-blue-500 ${errors.price ? "border-red-400" : "border-slate-200"}`}
              />
              {errors.price && <p className="mt-1 text-xs text-red-500">{errors.price}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                원가 (원)
                <span className="ml-1 text-slate-400 font-normal">(선택)</span>
              </label>
              <input
                type="number"
                name="cost"
                value={form.cost}
                onChange={handleChange}
                placeholder="예: 8000"
                min="0"
                step="100"
                className={`w-full h-9 px-3 border rounded-md text-sm focus:outline-none focus:border-blue-500 ${errors.cost ? "border-red-400" : "border-slate-200"}`}
              />
              {errors.cost && <p className="mt-1 text-xs text-red-500">{errors.cost}</p>}
            </div>
          </div>

          {/* 원가율 실시간 미리보기 */}
          {form.price && Number(form.price) > 0 && (
            <div className="bg-slate-50 rounded-md px-3 py-2 text-sm flex gap-4">
              <span className="text-slate-500">원가율:</span>
              <span className="font-semibold text-slate-800">
                {form.cost ? `${((Number(form.cost) / Number(form.price)) * 100).toFixed(1)}%` : "-"}
              </span>
              <span className="text-slate-500">마진:</span>
              <span className="font-semibold text-slate-800">
                {form.cost ? `${(Number(form.price) - Number(form.cost)).toLocaleString("ko-KR")}원` : "-"}
              </span>
            </div>
          )}

          {/* 메뉴 설명 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">메뉴 설명</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="메뉴 설명을 입력해주세요."
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* 알레르기 정보 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">알레르기 정보</label>
            <input
              type="text"
              name="allergens"
              value={form.allergens}
              onChange={handleChange}
              placeholder="예: 갑각류, 생선"
              className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 판매 여부 / 대표 메뉴 */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                checked={form.is_active === 1}
                onChange={handleChange}
                className="w-4 h-4 rounded accent-blue-500"
              />
              <span className="text-sm text-slate-700">판매중</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="is_featured"
                checked={form.is_featured === 1}
                onChange={handleChange}
                className="w-4 h-4 rounded accent-yellow-500"
              />
              <span className="text-sm text-slate-700">대표 메뉴</span>
            </label>
          </div>

          {/* 하단 버튼 */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 border border-slate-200 rounded-md text-sm text-slate-700 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="h-9 px-4 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={14} />
              {loading ? "저장 중..." : isEditMode ? "수정하기" : "등록하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MenuItemModal;
