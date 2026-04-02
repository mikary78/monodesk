// ============================================================
// SalesForm.jsx — 일별 매출 입력 폼 (확장판)
// 7개 섹션 구조: 기본매출 / 고객정보 / 추가결제 / 품목별 / 카드취소 / 수수료 / 특이사항
// 수수료 자동계산, 순매출 실시간 표시
// ============================================================

import { useState, useEffect } from "react";
import { X, AlertTriangle } from "lucide-react";
import { createSales, updateSales, formatCurrency } from "../../../api/accountingApi";
import { useToast } from "../../../contexts/ToastContext";

// ─────────────────────────────────────────
// 수수료 자동계산 기준 상수
// ─────────────────────────────────────────
const CARD_FEE_RATE = 0.0192;       // 카드수수료율 1.92%
const DELIVERY_FEE_RATE = 0.213;    // 배달수수료율 21.3%

// 기본 폼 초기값 (모든 확장 필드 포함)
const makeDefaultForm = () => ({
  sales_date: new Date().toISOString().split("T")[0],
  // 기본 매출
  card_amount: "",
  cash_amount: "",
  cash_receipt_amount: "",
  delivery_amount: "",
  discount_amount: "",
  service_amount: "",
  // 고객 정보
  receipt_count: "",
  customer_count: "",
  // 추가 결제수단
  transfer_count: "",
  transfer_amount: "",
  catchtable_count: "",
  catchtable_amount: "",
  // 카드취소
  card_cancel_count: "",
  card_cancel_amount: "",
  card_cancel_reason: "",
  // 수수료 예상
  card_fee_estimated: "",
  delivery_fee_estimated: "",
  // 품목별 매출
  sales_menu: "",
  sales_other_menu: "",
  sales_takeout: "",
  sales_liquor: "",
  sales_other_liquor: "",
  sales_etc: "",
  // 특이사항
  special_note: "",
  memo: "",
});

// editingRecord 데이터를 폼 상태로 변환
const recordToForm = (r) => ({
  sales_date: r.sales_date ?? new Date().toISOString().split("T")[0],
  card_amount: r.card_amount ?? "",
  cash_amount: r.cash_amount ?? "",
  cash_receipt_amount: r.cash_receipt_amount ?? "",
  delivery_amount: r.delivery_amount ?? "",
  discount_amount: r.discount_amount ?? "",
  service_amount: r.service_amount ?? "",
  receipt_count: r.receipt_count ?? "",
  customer_count: r.customer_count ?? "",
  transfer_count: r.transfer_count ?? "",
  transfer_amount: r.transfer_amount ?? "",
  catchtable_count: r.catchtable_count ?? "",
  catchtable_amount: r.catchtable_amount ?? "",
  card_cancel_count: r.card_cancel_count ?? "",
  card_cancel_amount: r.card_cancel_amount ?? "",
  card_cancel_reason: r.card_cancel_reason ?? "",
  card_fee_estimated: r.card_fee_estimated ?? "",
  delivery_fee_estimated: r.delivery_fee_estimated ?? "",
  sales_menu: r.sales_menu ?? "",
  sales_other_menu: r.sales_other_menu ?? "",
  sales_takeout: r.sales_takeout ?? "",
  sales_liquor: r.sales_liquor ?? "",
  sales_other_liquor: r.sales_other_liquor ?? "",
  sales_etc: r.sales_etc ?? "",
  special_note: r.special_note ?? "",
  memo: r.memo ?? "",
});

// ─────────────────────────────────────────
// 공통 입력 필드 컴포넌트
// ─────────────────────────────────────────
const Field = ({ label, name, value, onChange, type = "number", placeholder = "0", required = false, fullWidth = false, isTextarea = false }) => (
  <div className={fullWidth ? "col-span-2" : ""}>
    <label className="block text-xs font-medium text-slate-600 mb-1">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {isTextarea ? (
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={3}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    ) : (
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        min={type === "number" ? "0" : undefined}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    )}
  </div>
);

// ─────────────────────────────────────────
// 메인 폼 컴포넌트
// props: initialData(수정 시), onSuccess, onCancel
// ─────────────────────────────────────────
const SalesForm = ({ initialData = null, onSuccess, onCancel }) => {
  const toast = useToast();
  const isEdit = !!initialData;

  // 폼 데이터 상태
  const [form, setForm] = useState(isEdit ? recordToForm(initialData) : makeDefaultForm());
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // 수수료 자동계산 활성화 여부
  const [autoCalcCard, setAutoCalcCard] = useState(true);
  const [autoCalcDelivery, setAutoCalcDelivery] = useState(true);

  // 수정 모드 진입 시 자동계산 여부 판단
  useEffect(() => {
    if (isEdit && initialData) {
      const card = Number(initialData.card_amount) || 0;
      const cardFee = Number(initialData.card_fee_estimated) || 0;
      const delivery = Number(initialData.delivery_amount) || 0;
      const deliveryFee = Number(initialData.delivery_fee_estimated) || 0;

      // 저장된 값이 자동계산 결과와 같으면 자동계산 켜진 상태로 판단
      setAutoCalcCard(Math.abs(cardFee - card * CARD_FEE_RATE) < 1);
      setAutoCalcDelivery(Math.abs(deliveryFee - delivery * DELIVERY_FEE_RATE) < 1);
    }
  }, [isEdit, initialData]);

  // 카드/배달 매출 변경 시 수수료 자동업데이트
  useEffect(() => {
    if (autoCalcCard) {
      const cardAmt = Number(form.card_amount) || 0;
      setForm((prev) => ({
        ...prev,
        card_fee_estimated: cardAmt > 0 ? Math.round(cardAmt * CARD_FEE_RATE).toString() : "",
      }));
    }
  }, [form.card_amount, autoCalcCard]);

  useEffect(() => {
    if (autoCalcDelivery) {
      const delAmt = Number(form.delivery_amount) || 0;
      setForm((prev) => ({
        ...prev,
        delivery_fee_estimated: delAmt > 0 ? Math.round(delAmt * DELIVERY_FEE_RATE).toString() : "",
      }));
    }
  }, [form.delivery_amount, autoCalcDelivery]);

  // 필드 값 변경 처리
  const handleChange = (e) => {
    const { name, value } = e.target;

    // 수수료 필드를 수동 수정하면 자동계산 해제
    if (name === "card_fee_estimated") setAutoCalcCard(false);
    if (name === "delivery_fee_estimated") setAutoCalcDelivery(false);

    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // ─── 실시간 계산값 ───
  const n = (v) => Number(v) || 0; // 빈값을 0으로 변환하는 헬퍼

  // 순매출 = 카드 + 현금 + 현금영수증 + 배달 + 계좌이체 + 캐치테이블 - 할인 - 서비스
  const netSales =
    n(form.card_amount) + n(form.cash_amount) + n(form.cash_receipt_amount) +
    n(form.delivery_amount) + n(form.transfer_amount) + n(form.catchtable_amount) -
    n(form.discount_amount) - n(form.service_amount);

  // 품목별 합계
  const itemSalesTotal =
    n(form.sales_menu) + n(form.sales_other_menu) + n(form.sales_takeout) +
    n(form.sales_liquor) + n(form.sales_other_liquor) + n(form.sales_etc);

  // 순매출과 품목별 합계 차이 (경고 표시 기준)
  const salesDiff = Math.abs(netSales - itemSalesTotal);
  const showDiffWarning = itemSalesTotal > 0 && salesDiff > 100;

  // 카드취소 입력 여부 (시각적 강조용)
  const hasCancelData = n(form.card_cancel_count) > 0 || n(form.card_cancel_amount) > 0;

  // 폼 유효성 검증
  const validate = () => {
    const newErrors = {};
    if (!form.sales_date) newErrors.sales_date = "날짜를 입력해주세요.";
    if (netSales <= 0) newErrors.net_sales = "순매출이 0원 이하입니다. 매출 금액을 확인해주세요.";
    return newErrors;
  };

  // 저장 처리
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
        card_amount: n(form.card_amount),
        cash_amount: n(form.cash_amount),
        cash_receipt_amount: n(form.cash_receipt_amount),
        delivery_amount: n(form.delivery_amount),
        discount_amount: n(form.discount_amount),
        service_amount: n(form.service_amount),
        receipt_count: n(form.receipt_count),
        customer_count: n(form.customer_count),
        transfer_count: n(form.transfer_count),
        transfer_amount: n(form.transfer_amount),
        catchtable_count: n(form.catchtable_count),
        catchtable_amount: n(form.catchtable_amount),
        card_cancel_count: n(form.card_cancel_count),
        card_cancel_amount: n(form.card_cancel_amount),
        card_cancel_reason: form.card_cancel_reason.trim() || null,
        card_fee_estimated: n(form.card_fee_estimated),
        delivery_fee_estimated: n(form.delivery_fee_estimated),
        sales_menu: n(form.sales_menu),
        sales_other_menu: n(form.sales_other_menu),
        sales_takeout: n(form.sales_takeout),
        sales_liquor: n(form.sales_liquor),
        sales_other_liquor: n(form.sales_other_liquor),
        sales_etc: n(form.sales_etc),
        special_note: form.special_note.trim() || null,
        memo: form.memo.trim() || null,
      };

      if (isEdit) {
        await updateSales(initialData.id, payload);
        toast.success("매출 기록이 수정되었습니다.");
      } else {
        await createSales(payload);
        toast.success("매출 기록이 저장되었습니다.");
      }
      onSuccess();
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────
  // 섹션 레이블 컴포넌트
  // ─────────────────────────────────────────
  const SectionHeader = ({ title, colorClass = "bg-slate-50 border-slate-200" }) => (
    <div className={`rounded-t-lg px-4 py-2.5 border-b ${colorClass}`}>
      <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{title}</h4>
    </div>
  );

  return (
    // 모달 오버레이
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-6">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col">

        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            {isEdit ? "매출 수정" : "매출 입력"}
          </h2>
          <button
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
            title="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* 오류 메시지 */}
        {errors.submit && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {errors.submit}
          </div>
        )}
        {errors.net_sales && (
          <div className="mx-6 mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700 flex items-center gap-2">
            <AlertTriangle size={15} />
            {errors.net_sales}
          </div>
        )}

        {/* 폼 본문 — 스크롤 가능 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* ── 섹션 1: 기본 매출 ── */}
          <div className="border border-blue-200 rounded-lg overflow-hidden">
            <SectionHeader title="기본 매출" colorClass="bg-blue-50 border-blue-200" />
            <div className="p-4 grid grid-cols-2 gap-3">
              {/* 날짜 — 전체 너비 */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  영업일자<span className="text-red-500 ml-0.5">*</span>
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
              {/* 2×2 그리드: 카드/현금/현금영수증/배달 */}
              <Field label="카드매출 (원)" name="card_amount" value={form.card_amount} onChange={handleChange} />
              <Field label="현금매출 (원)" name="cash_amount" value={form.cash_amount} onChange={handleChange} />
              <Field label="현금영수증 (원)" name="cash_receipt_amount" value={form.cash_receipt_amount} onChange={handleChange} />
              <Field label="배달매출 (원)" name="delivery_amount" value={form.delivery_amount} onChange={handleChange} />
              {/* 할인/서비스 */}
              <Field label="할인액 (원)" name="discount_amount" value={form.discount_amount} onChange={handleChange} />
              <Field label="서비스액 (원)" name="service_amount" value={form.service_amount} onChange={handleChange} />
            </div>
          </div>

          {/* ── 섹션 2: 고객 정보 ── */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <SectionHeader title="고객 정보" />
            <div className="p-4 grid grid-cols-2 gap-3">
              <Field label="영수건수 (건)" name="receipt_count" value={form.receipt_count} onChange={handleChange} placeholder="0" />
              <Field label="고객수 (명)" name="customer_count" value={form.customer_count} onChange={handleChange} placeholder="0" />
            </div>
          </div>

          {/* ── 섹션 3: 추가 결제수단 ── */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <SectionHeader title="추가 결제수단" />
            <div className="p-4 grid grid-cols-2 gap-3">
              <Field label="계좌이체 건수 (건)" name="transfer_count" value={form.transfer_count} onChange={handleChange} placeholder="0" />
              <Field label="계좌이체 금액 (원)" name="transfer_amount" value={form.transfer_amount} onChange={handleChange} />
              <Field label="캐치테이블 건수 (건)" name="catchtable_count" value={form.catchtable_count} onChange={handleChange} placeholder="0" />
              <Field label="캐치테이블 금액 (원)" name="catchtable_amount" value={form.catchtable_amount} onChange={handleChange} />
            </div>
          </div>

          {/* ── 섹션 4: 품목별 매출 ── */}
          <div className="border border-green-200 rounded-lg overflow-hidden">
            <SectionHeader title="품목별 매출" colorClass="bg-green-50 border-green-200" />
            <div className="p-4 grid grid-cols-3 gap-3">
              <Field label="메뉴 (원)" name="sales_menu" value={form.sales_menu} onChange={handleChange} />
              <Field label="기타메뉴 (원)" name="sales_other_menu" value={form.sales_other_menu} onChange={handleChange} />
              <Field label="포장 (원)" name="sales_takeout" value={form.sales_takeout} onChange={handleChange} />
              <Field label="주류 (원)" name="sales_liquor" value={form.sales_liquor} onChange={handleChange} />
              <Field label="기타주류 (원)" name="sales_other_liquor" value={form.sales_other_liquor} onChange={handleChange} />
              <Field label="기타 (원)" name="sales_etc" value={form.sales_etc} onChange={handleChange} />
            </div>
            {/* 품목별 내부 합계 실시간 표시 */}
            <div className="px-4 pb-3">
              <div className="bg-green-50 rounded-md px-3 py-2 flex justify-between items-center">
                <span className="text-xs text-green-700 font-medium">품목별 합계</span>
                <span className="text-sm font-semibold text-green-800">
                  {formatCurrency(itemSalesTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* ── 섹션 5: 카드취소 ── */}
          <div className={`border rounded-lg overflow-hidden ${hasCancelData ? "border-red-200" : "border-slate-200"}`}>
            <SectionHeader
              title="카드취소"
              colorClass={hasCancelData ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}
            />
            <div className="p-4 grid grid-cols-2 gap-3">
              <Field label="취소건수 (건)" name="card_cancel_count" value={form.card_cancel_count} onChange={handleChange} placeholder="0" />
              <Field label="취소금액 (원)" name="card_cancel_amount" value={form.card_cancel_amount} onChange={handleChange} />
              {/* 취소사유 — 전체 너비 텍스트 */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">취소사유</label>
                <input
                  type="text"
                  name="card_cancel_reason"
                  value={form.card_cancel_reason}
                  onChange={handleChange}
                  placeholder="예: 고객 단순변심"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* ── 섹션 6: 수수료 예상 ── */}
          <div className="border border-yellow-200 rounded-lg overflow-hidden">
            <SectionHeader title="수수료 예상" colorClass="bg-yellow-50 border-yellow-200" />
            <div className="p-4 grid grid-cols-2 gap-3">
              {/* 카드수수료 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600">카드수수료 예상 (원)</label>
                  {autoCalcCard && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                      자동계산
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  name="card_fee_estimated"
                  value={form.card_fee_estimated}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-0.5">카드매출 × 1.92%</p>
              </div>
              {/* 배달수수료 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-600">배달수수료 예상 (원)</label>
                  {autoCalcDelivery && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                      자동계산
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  name="delivery_fee_estimated"
                  value={form.delivery_fee_estimated}
                  onChange={handleChange}
                  min="0"
                  placeholder="0"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 mt-0.5">배달매출 × 21.3%</p>
              </div>
            </div>
          </div>

          {/* ── 섹션 7: 특이사항 ── */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <SectionHeader title="특이사항" />
            <div className="p-4">
              <textarea
                name="special_note"
                value={form.special_note}
                onChange={handleChange}
                rows={3}
                placeholder="예: 우천으로 손님 적음, 주방 기기 점검 등"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* ── 하단 총계 요약 카드 (sticky) ── */}
        <div className="px-6 py-4 bg-slate-900 rounded-b-xl">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">순매출 (결제수단 합계 기준)</p>
              <p className="text-xl font-bold text-white">{formatCurrency(netSales)}</p>
              {itemSalesTotal > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  품목별 합계: {formatCurrency(itemSalesTotal)}
                </p>
              )}
            </div>
            {/* 순매출 ↔ 품목별 차이 경고 */}
            {showDiffWarning && (
              <div className="flex items-center gap-1.5 bg-yellow-500/20 border border-yellow-500/40 rounded-lg px-3 py-2">
                <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-yellow-300 font-medium">금액 불일치</p>
                  <p className="text-xs text-yellow-400">
                    차이: {formatCurrency(salesDiff)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 저장/취소 버튼 */}
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              {loading ? "저장 중..." : isEdit ? "수정 완료" : "저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesForm;
