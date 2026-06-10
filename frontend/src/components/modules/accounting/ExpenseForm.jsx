// ============================================================
// ExpenseForm.jsx — 지출 입력/수정 폼 컴포넌트
// 지출 내역을 새로 입력하거나 기존 항목을 수정합니다.
// ============================================================

import { useState, useEffect } from "react";
import { X, Save, Receipt, Plus, Package } from "lucide-react";
import { createExpense, updateExpense, fetchCategories, fetchItemAutocomplete } from "../../../api/accountingApi";

// 결제 수단 옵션 목록
const PAYMENT_METHODS = ["카드", "현금", "계좌이체"];

// 품목 수량 단위 목록
const UNITS = ["kg", "g", "개", "병", "팩", "박스", "봉", "L", "ml", "인분", "마리"];

/**
 * 지출 입력/수정 폼 컴포넌트.
 * @param {object} initialData - 수정 시 초기 데이터 (없으면 신규 입력)
 * @param {function} onSuccess - 저장 성공 시 콜백
 * @param {function} onCancel - 취소 시 콜백
 */
const ExpenseForm = ({ initialData = null, onSuccess, onCancel }) => {
  // 폼 입력 상태
  const [form, setForm] = useState({
    expense_date: initialData?.expense_date || new Date().toISOString().split("T")[0],
    category_id: initialData?.category_id || "",
    vendor: initialData?.vendor || "",
    description: initialData?.description || "",
    amount: initialData?.amount || "",
    vat: initialData?.vat || 0,
    payment_method: initialData?.payment_method || "카드",
    memo: initialData?.memo || "",
    tax_invoice: initialData?.tax_invoice || false,
  });

  // 구매 품목 목록 상태
  const [items, setItems] = useState(
    (initialData?.items || []).map((item) => ({
      item_name: item.item_name || "",
      quantity: item.quantity ?? "",
      unit: item.unit || "",
      amount: item.amount ?? "",
    }))
  );
  // 지출 분류 목록 상태
  const [categories, setCategories] = useState([]);
  // 품목명 자동완성 제안 목록
  const [suggestions, setSuggestions] = useState([]);
  // 저장 중 여부 (버튼 비활성화용)
  const [isLoading, setIsLoading] = useState(false);
  // 에러 메시지 상태
  const [errors, setErrors] = useState({});

  // 컴포넌트 로드 시 지출 분류 + 품목 자동완성 목록 불러오기
  useEffect(() => {
    const loadInit = async () => {
      try {
        const [cats, sugs] = await Promise.all([
          fetchCategories(),
          fetchItemAutocomplete(""),
        ]);
        setCategories(cats);
        setSuggestions(sugs);
        if (!initialData && cats.length > 0) {
          setForm((prev) => ({ ...prev, category_id: cats[0].id }));
        }
      } catch (err) {
        console.error("초기 데이터 불러오기 실패:", err);
      }
    };
    loadInit();
  }, []); // eslint-disable-line

  /** 품목 추가 */
  const handleAddItem = () => {
    setItems((prev) => [...prev, { item_name: "", quantity: "", unit: "", amount: "" }]);
  };

  /** 품목 필드 값 변경 */
  const updateItem = (idx, field, value) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, [field]: value } : item
      )
    );
  };

  /** 품목 행 삭제 */
  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  /** 입력 필드 변경 핸들러 (체크박스 포함) */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    // 에러 메시지 초기화
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  /** 유효성 검사 */
  const validate = () => {
    const newErrors = {};
    if (!form.expense_date) newErrors.expense_date = "날짜를 입력해주세요.";
    if (!form.category_id) newErrors.category_id = "지출 분류를 선택해주세요.";
    if (!form.description.trim()) newErrors.description = "지출 내용을 입력해주세요.";
    if (!form.amount || Number(form.amount) <= 0) {
      newErrors.amount = "올바른 금액을 입력해주세요.";
    }
    if (Number(form.amount) > 99999999) {
      newErrors.amount = "금액은 99,999,999원을 초과할 수 없습니다.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /** 폼 저장 핸들러 */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      // 빈 item_name은 제외하고, 숫자 필드 변환
      const cleanedItems = items
        .filter((item) => item.item_name.trim())
        .map((item) => ({
          item_name: item.item_name.trim(),
          quantity: item.quantity !== "" && item.quantity !== null ? Number(item.quantity) : null,
          unit: item.unit || null,
          amount: item.amount !== "" && item.amount !== null ? Number(item.amount) : null,
        }));

      const payload = {
        ...form,
        amount: Number(form.amount),
        vat: Number(form.vat) || 0,
        category_id: Number(form.category_id),
        items: cleanedItems,
      };

      if (initialData) {
        // 기존 항목 수정
        await updateExpense(initialData.id, payload);
      } else {
        // 신규 항목 생성
        await createExpense(payload);
      }
      onSuccess?.();
    } catch (err) {
      setErrors({ submit: err.message || "저장 중 오류가 발생했습니다." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* 폼 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Receipt size={20} className="text-blue-500" />
          <h3 className="text-base font-semibold text-slate-900">
            {initialData ? "지출 수정" : "지출 입력"}
          </h3>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title="닫기"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* 전체 에러 메시지 */}
      {errors.submit && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {errors.submit}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 날짜 + 분류 (2열) */}
        <div className="grid grid-cols-2 gap-4">
          {/* 지출 날짜 */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">날짜 *</label>
            <input
              type="date"
              name="expense_date"
              value={form.expense_date}
              onChange={handleChange}
              className={`w-full h-9 px-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.expense_date ? "border-red-400" : "border-slate-200"
              }`}
            />
            {errors.expense_date && (
              <p className="text-xs text-red-500 mt-1">{errors.expense_date}</p>
            )}
          </div>

          {/* 지출 분류 */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">분류 *</label>
            <select
              name="category_id"
              value={form.category_id}
              onChange={handleChange}
              className={`w-full h-9 px-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                errors.category_id ? "border-red-400" : "border-slate-200"
              }`}
            >
              <option value="">선택하세요</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.category_id && (
              <p className="text-xs text-red-500 mt-1">{errors.category_id}</p>
            )}
          </div>
        </div>

        {/* 거래처 + 결제수단 (2열) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">거래처</label>
            <input
              type="text"
              name="vendor"
              value={form.vendor}
              onChange={handleChange}
              placeholder="예: 노량진수산시장"
              className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">결제 수단</label>
            <select
              name="payment_method"
              value={form.payment_method}
              onChange={handleChange}
              className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 지출 내용 */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">지출 내용 *</label>
          <input
            type="text"
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="예: 활전복 50kg 구매"
            className={`w-full h-9 px-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.description ? "border-red-400" : "border-slate-200"
            }`}
          />
          {errors.description && (
            <p className="text-xs text-red-500 mt-1">{errors.description}</p>
          )}
        </div>

        {/* 공급가액 + 부가세 (2열) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">공급가액 (원) *</label>
            <input
              type="number"
              name="amount"
              value={form.amount}
              onChange={handleChange}
              placeholder="0"
              min="1"
              max="99999999"
              className={`w-full h-9 px-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right ${
                errors.amount ? "border-red-400" : "border-slate-200"
              }`}
            />
            {errors.amount && (
              <p className="text-xs text-red-500 mt-1">{errors.amount}</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">부가세 (원)</label>
            <input
              type="number"
              name="vat"
              value={form.vat}
              onChange={handleChange}
              placeholder="0"
              min="0"
              className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
            />
          </div>
        </div>

        {/* 메모 */}
        <div>
          <label className="block text-xs text-slate-500 mb-1">메모</label>
          <textarea
            name="memo"
            value={form.memo}
            onChange={handleChange}
            placeholder="특이사항을 입력하세요"
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* 구매 품목 섹션 */}
        <div className="border border-slate-200 rounded-md p-3 bg-slate-50">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
              <Package size={12} className="text-slate-400" />
              구매 품목 <span className="text-slate-400 font-normal">(선택)</span>
            </label>
            <button
              type="button"
              onClick={handleAddItem}
              className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 transition-colors"
            >
              <Plus size={12} />
              품목 추가
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-xs text-slate-400 py-1">
              품목을 추가하면 "무엇을 샀는가"를 더 자세히 기록할 수 있습니다.
            </p>
          ) : (
            <div className="space-y-2">
              {/* 헤더 레이블 */}
              <div className="grid grid-cols-[1fr_64px_72px_88px_24px] gap-1.5 text-xs text-slate-400 px-0.5">
                <span>품목명</span>
                <span className="text-right">수량</span>
                <span className="text-center">단위</span>
                <span className="text-right">금액(원)</span>
                <span />
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_64px_72px_88px_24px] gap-1.5 items-center">
                  <input
                    list="item-name-suggestions"
                    placeholder="예: 활전복"
                    value={item.item_name}
                    onChange={(e) => updateItem(idx, "item_name", e.target.value)}
                    className="h-8 px-2 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="0"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                    min="0"
                    className="h-8 px-2 border border-slate-200 rounded text-sm text-right bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <select
                    value={item.unit}
                    onChange={(e) => updateItem(idx, "unit", e.target.value)}
                    className="h-8 px-1 border border-slate-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">단위</option>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input
                    type="number"
                    placeholder="0"
                    value={item.amount}
                    onChange={(e) => updateItem(idx, "amount", e.target.value)}
                    min="0"
                    className="h-8 px-2 border border-slate-200 rounded text-sm text-right bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 자동완성 datalist */}
          <datalist id="item-name-suggestions">
            {suggestions.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>

        {/* 세금계산서 수취 여부 */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="tax_invoice"
            name="tax_invoice"
            checked={form.tax_invoice}
            onChange={handleChange}
            className="w-4 h-4 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
          />
          <label htmlFor="tax_invoice" className="text-sm text-slate-700">
            세금계산서 수취
          </label>
        </div>

        {/* 버튼 영역 */}
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="h-9 px-4 border border-slate-200 rounded-md text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              취소
            </button>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="h-9 px-4 bg-blue-500 text-white rounded-md text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
          >
            <Save size={14} />
            {isLoading ? "저장 중..." : "저장"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExpenseForm;
