// ============================================================
// SalesForm.jsx — 일별 매출 입력 폼
// 카드/현금/배달 매출을 날짜별로 입력합니다.
// ============================================================

import { useState } from "react";
import { createSales, updateSales, formatCurrency } from "../../../api/accountingApi";

const defaultForm = {
  sales_date: new Date().toISOString().split("T")[0],
  cash_amount: "",
  card_amount: "",
  delivery_amount: "",
  memo: "",
};

const SalesForm = ({ initialData = null, onSuccess, onCancel }) => {
  const isEdit = !!initialData;

  const [form, setForm] = useState(
    isEdit
      ? {
          sales_date: initialData.sales_date ?? defaultForm.sales_date,
          cash_amount: initialData.cash_amount ?? "",
          card_amount: initialData.card_amount ?? "",
          delivery_amount: initialData.delivery_amount ?? "",
          memo: initialData.memo ?? "",
        }
      : defaultForm
  );
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // 매출 합계 미리보기
  const totalPreview =
    (Number(form.cash_amount) || 0) +
    (Number(form.card_amount) || 0) +
    (Number(form.delivery_amount) || 0);

  const validate = () => {
    const newErrors = {};
    if (!form.sales_date) newErrors.sales_date = "날짜를 입력해주세요.";
    const total = Number(form.cash_amount) + Number(form.card_amount) + Number(form.delivery_amount);
    if (total <= 0) newErrors.card_amount = "매출 금액을 하나 이상 입력해주세요.";
    return newErrors;
  };

  const handleSubmit = async () => {
    const newErrors = validate();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        sales_date: form.sales_date,
        cash_amount: Number(form.cash_amount) || 0,
        card_amount: Number(form.card_amount) || 0,
        delivery_amount: Number(form.delivery_amount) || 0,
        memo: form.memo.trim(),
      };
      if (isEdit) {
        await updateSales(initialData.id, payload);
      } else {
        await createSales(payload);
      }
      onSuccess();
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 mb-4">
      <h3 className="text-base font-semibold text-slate-900 mb-4">
        {isEdit ? "매출 수정" : "매출 입력"}
      </h3>

      {errors.submit && (
        <p className="text-sm text-red-500 mb-3 bg-red-50 p-2 rounded">{errors.submit}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* 날짜 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            날짜 <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="sales_date"
            value={form.sales_date}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.sales_date && (
            <p className="text-xs text-red-500 mt-1">{errors.sales_date}</p>
          )}
        </div>

        {/* 합계 미리보기 */}
        <div className="flex items-end">
          <div className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
            <p className="text-xs text-slate-500 mb-0.5">합계 (자동계산)</p>
            <p className="text-sm font-semibold text-slate-900">{formatCurrency(totalPreview)}</p>
          </div>
        </div>

        {/* 카드 매출 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">카드 매출 (원)</label>
          <input
            type="number"
            name="card_amount"
            value={form.card_amount}
            onChange={handleChange}
            min="0"
            placeholder="0"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.card_amount && (
            <p className="text-xs text-red-500 mt-1">{errors.card_amount}</p>
          )}
        </div>

        {/* 현금 매출 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">현금 매출 (원)</label>
          <input
            type="number"
            name="cash_amount"
            value={form.cash_amount}
            onChange={handleChange}
            min="0"
            placeholder="0"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 배달 매출 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">배달 매출 (원)</label>
          <input
            type="number"
            name="delivery_amount"
            value={form.delivery_amount}
            onChange={handleChange}
            min="0"
            placeholder="0"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 메모 */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">메모</label>
          <input
            type="text"
            name="memo"
            value={form.memo}
            onChange={handleChange}
            placeholder="예: 우천으로 손님 적음"
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-5">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="px-4 py-2 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
};

export default SalesForm;
