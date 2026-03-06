// ============================================================
// ExpenseForm.jsx — 지출 입력/수정 폼 컴포넌트
// 지출 내역을 새로 입력하거나 기존 항목을 수정합니다.
// ============================================================

import { useState, useEffect } from "react";
import { X, Save, Receipt } from "lucide-react";
import { createExpense, updateExpense, fetchCategories } from "../../../api/accountingApi";

// 결제 수단 옵션 목록
const PAYMENT_METHODS = ["카드", "현금", "계좌이체"];

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

  // 지출 분류 목록 상태
  const [categories, setCategories] = useState([]);
  // 저장 중 여부 (버튼 비활성화용)
  const [isLoading, setIsLoading] = useState(false);
  // 에러 메시지 상태
  const [errors, setErrors] = useState({});

  // 컴포넌트 로드 시 지출 분류 불러오기
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await fetchCategories();
        setCategories(data);
        // 신규 입력 시 첫 번째 분류를 기본값으로 설정
        if (!initialData && data.length > 0) {
          setForm((prev) => ({ ...prev, category_id: data[0].id }));
        }
      } catch (err) {
        console.error("지출 분류 불러오기 실패:", err);
      }
    };
    loadCategories();
  }, []);

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
      const payload = {
        ...form,
        amount: Number(form.amount),
        vat: Number(form.vat) || 0,
        category_id: Number(form.category_id),
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
