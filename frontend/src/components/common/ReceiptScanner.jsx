// ============================================================
// components/common/ReceiptScanner.jsx — 영수증 OCR 스캐너 공용 컴포넌트
// 지출 관리 탭에서 모달로 열립니다.
// 이미지 업로드 → OCR 분석 → 결과 검토/수정 → 확정 저장
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload, X, Scan, CheckCircle, AlertCircle,
  Loader2, Plus, Trash2, RefreshCw, Camera
} from "lucide-react";
import { scanReceipt, confirmReceipt } from "../../api/ocrApi";
import { fetchCategories } from "../../api/accountingApi";
import { fetchInventoryItems } from "../../api/inventoryApi";
import { useToast } from "../../contexts/ToastContext";

// 오늘 날짜를 YYYY-MM-DD 형식으로 반환
const getTodayString = () => new Date().toISOString().split("T")[0];

// 금액을 쉼표 포맷으로 표시 (예: 1234567 → "1,234,567")
const formatNumber = (num) => {
  if (!num && num !== 0) return "";
  return Number(num).toLocaleString("ko-KR");
};

/**
 * 영수증/거래명세서 OCR 스캐너 컴포넌트.
 *
 * @param {boolean} isOpen - 모달 표시 여부
 * @param {function} onClose - 모달 닫기 콜백
 * @param {function} onSuccess - 확정 저장 성공 콜백 (지출 목록 갱신용)
 */
const ReceiptScanner = ({ isOpen, onClose, onSuccess }) => {
  const toast = useToast();

  // ── 상태 정의 ──────────────────────────────────────────────

  // 단계: "upload" → "scanning" → "review" → "saving" → "done"
  const [step, setStep] = useState("upload");
  // 선택된 이미지 파일
  const [selectedFile, setSelectedFile] = useState(null);
  // 미리보기 이미지 URL
  const [previewUrl, setPreviewUrl] = useState(null);
  // OCR 스캔 결과 (백엔드 응답)
  const [scanResult, setScanResult] = useState(null);
  // 사용자 수정 가능한 폼 데이터
  const [formData, setFormData] = useState({
    date: getTodayString(),
    vendor: "",
    total_amount: 0,
    vat: 0,
    payment_method: "카드",
    expense_category_id: "",
    memo: "",
  });
  // 품목 목록 (인라인 수정 가능)
  const [items, setItems] = useState([]);
  // 지출 분류 목록 (드롭다운용)
  const [expenseCategories, setExpenseCategories] = useState([]);
  // 재고 품목 목록 (매칭 드롭다운용)
  const [inventoryItems, setInventoryItems] = useState([]);
  // 드래그 오버 상태
  const [isDragOver, setIsDragOver] = useState(false);

  // 카메라 촬영 전용 input ref (capture="environment" → 모바일 후면 카메라 직접 실행)
  const cameraInputRef = useRef(null);
  // 갤러리/파일 선택 전용 input ref (데스크톱 파일 탐색기 또는 모바일 갤러리)
  const fileInputRef = useRef(null);

  // ── 초기 데이터 로드 ──────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    // 지출 분류 로드
    fetchCategories()
      .then(setExpenseCategories)
      .catch(() => toast.error("지출 분류 목록을 불러오지 못했습니다."));
    // 재고 품목 전체 로드 (매칭 드롭다운용)
    fetchInventoryItems({ limit: 500 })
      .then((res) => setInventoryItems(res.items || []))
      .catch(() => {}); // 재고 매칭 실패는 무시 가능
  }, [isOpen]);

  // 모달 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setStep("upload");
      setSelectedFile(null);
      setPreviewUrl(null);
      setScanResult(null);
      setItems([]);
      setFormData({
        date: getTodayString(),
        vendor: "",
        total_amount: 0,
        vat: 0,
        payment_method: "카드",
        expense_category_id: "",
        memo: "",
      });
    }
  }, [isOpen]);

  // ── 파일 선택 처리 ──────────────────────────────────────

  const handleFileSelect = useCallback((file) => {
    if (!file) return;

    // 이미지 파일 타입 검증
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드 가능합니다. (JPG, PNG 등)");
      return;
    }
    // 파일 크기 검증 (20MB 이하)
    if (file.size > 20 * 1024 * 1024) {
      toast.error("파일 크기가 20MB를 초과합니다.");
      return;
    }

    setSelectedFile(file);
    // 미리보기 URL 생성
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  }, [toast]);

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  // ── 드래그 앤 드롭 처리 ──────────────────────────────────

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  };

  // ── OCR 스캔 실행 ──────────────────────────────────────

  const handleScan = async () => {
    if (!selectedFile) {
      toast.error("분석할 이미지를 먼저 선택해주세요.");
      return;
    }

    setStep("scanning");

    try {
      const result = await scanReceipt(selectedFile);
      setScanResult(result);

      // OCR 결과로 폼 데이터 초기화 (인식 실패 항목은 기본값 유지)
      setFormData((prev) => ({
        ...prev,
        date: result.date || getTodayString(),
        vendor: result.vendor || "",
        total_amount: result.total_amount || 0,
        // 지출 분류는 식재료비를 기본값으로 (ID는 로드 후 찾아야 함)
        expense_category_id: prev.expense_category_id,
      }));

      // 품목 목록 초기화
      setItems(
        (result.items || []).map((item, idx) => ({
          _key: idx, // 리스트 키용
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          unit_price: item.unit_price,
          amount: item.amount,
          matched_inventory_id: item.matched_inventory_id,
          apply_to_inventory: item.apply_to_inventory,
        }))
      );

      if (!result.success && result.error_message) {
        toast.warning(`OCR 인식 오류: ${result.error_message} 수동으로 입력해주세요.`);
      } else {
        toast.success("OCR 분석이 완료되었습니다. 내용을 확인하고 수정해주세요.");
      }

      setStep("review");
    } catch (err) {
      toast.error(err.message || "OCR 처리 중 오류가 발생했습니다.");
      setStep("upload");
    }
  };

  // ── 품목 수정 ──────────────────────────────────────

  const handleItemChange = (idx, field, value) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      // 수량이나 단가가 바뀌면 소계 자동 재계산
      if (field === "quantity" || field === "unit_price") {
        const qty = field === "quantity" ? parseFloat(value) || 0 : parseFloat(updated[idx].quantity) || 0;
        const price = field === "unit_price" ? parseFloat(value) || 0 : parseFloat(updated[idx].unit_price) || 0;
        updated[idx].amount = qty * price;
      }
      return updated;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        _key: Date.now(),
        name: "",
        quantity: 1,
        unit: "개",
        unit_price: 0,
        amount: 0,
        matched_inventory_id: null,
        apply_to_inventory: false,
      },
    ]);
  };

  const handleRemoveItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // 전체 재고 반영 토글
  const handleToggleAllInventory = (checked) => {
    setItems((prev) =>
      prev.map((item) => ({ ...item, apply_to_inventory: checked }))
    );
  };

  const allInventoryChecked = items.length > 0 && items.every((item) => item.apply_to_inventory);
  const someInventoryChecked = items.some((item) => item.apply_to_inventory);

  // ── 확정 저장 ──────────────────────────────────────

  const handleConfirm = async () => {
    // 필수 값 검증
    if (!formData.date) {
      toast.error("지출 날짜를 입력해주세요.");
      return;
    }
    if (!formData.total_amount || formData.total_amount <= 0) {
      toast.error("합계 금액을 입력해주세요.");
      return;
    }
    if (!formData.expense_category_id) {
      toast.error("지출 분류를 선택해주세요.");
      return;
    }

    // 재고 반영 체크된 품목 중 재고 미매칭 항목 경고
    const uncheckedItems = items.filter(
      (item) => item.apply_to_inventory && !item.matched_inventory_id
    );
    if (uncheckedItems.length > 0) {
      toast.warning(`${uncheckedItems.length}개 품목이 재고 품목과 매칭되지 않아 재고 반영에서 제외됩니다.`);
    }

    setStep("saving");

    try {
      const payload = {
        image_path: scanResult?.image_path || null,
        date: formData.date,
        vendor: formData.vendor || null,
        total_amount: parseFloat(formData.total_amount),
        vat: parseFloat(formData.vat) || 0,
        payment_method: formData.payment_method,
        expense_category_id: parseInt(formData.expense_category_id),
        memo: formData.memo || null,
        items: items.map((item) => ({
          name: item.name,
          quantity: parseFloat(item.quantity) || 1,
          unit: item.unit || "개",
          unit_price: parseFloat(item.unit_price) || 0,
          amount: parseFloat(item.amount) || 0,
          matched_inventory_id: item.apply_to_inventory ? item.matched_inventory_id : null,
          apply_to_inventory: item.apply_to_inventory && !!item.matched_inventory_id,
        })),
      };

      const result = await confirmReceipt(payload);
      toast.success(result.message || "저장이 완료되었습니다.");
      setStep("done");

      // 부모 컴포넌트에 성공 알림 (지출 목록 갱신)
      if (onSuccess) onSuccess();

      // 1초 후 자동 닫기
      setTimeout(() => onClose(), 1000);
    } catch (err) {
      toast.error(err.message || "저장 중 오류가 발생했습니다.");
      setStep("review");
    }
  };

  // ── 렌더링 ──────────────────────────────────────

  if (!isOpen) return null;

  return (
    // 배경 오버레이
    <div
      className="fixed inset-0 bg-black/60 z-[9000] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* 모달 본문 */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <Scan size={20} className="text-blue-500" />
            <h2 className="text-base font-semibold text-slate-900">영수증 OCR 스캔</h2>
            {/* 단계 표시 배지 */}
            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
              step === "upload"   ? "bg-slate-100 text-slate-500" :
              step === "scanning" ? "bg-yellow-100 text-yellow-700" :
              step === "review"   ? "bg-blue-100 text-blue-700" :
              step === "saving"   ? "bg-purple-100 text-purple-700" :
              "bg-green-100 text-green-700"
            }`}>
              {step === "upload"   && "이미지 선택"}
              {step === "scanning" && "AI 분석 중..."}
              {step === "review"   && "검토 및 수정"}
              {step === "saving"   && "저장 중..."}
              {step === "done"     && "저장 완료"}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* 모달 바디 (스크롤 영역) */}
        <div className="flex-1 overflow-y-auto">

          {/* ── STEP 1: 이미지 업로드 ── */}
          {(step === "upload") && (
            <div className="p-6 space-y-4">

              {/* 이미지 선택 후: 미리보기 표시 */}
              {previewUrl ? (
                <div className="text-center space-y-3">
                  <img
                    src={previewUrl}
                    alt="영수증 미리보기"
                    className="max-h-72 mx-auto rounded-xl shadow-md border border-slate-200"
                  />
                  <p className="text-sm text-slate-500">{selectedFile?.name}</p>
                  {/* 다시 선택 버튼 */}
                  <button
                    onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                    className="text-xs text-blue-500 hover:underline"
                  >
                    다시 선택
                  </button>
                </div>
              ) : (
                /* 이미지 미선택 시: 드래그&드롭 영역 (데스크톱 전용) */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    isDragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400"
                  }`}
                >
                  <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-3">
                    <Upload size={28} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">이미지를 드래그하거나 아래 버튼으로 선택</p>
                  <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP 지원 / 최대 20MB</p>
                </div>
              )}

              {/* 버튼 2개: 카메라 촬영 + 파일 선택 */}
              <div className="grid grid-cols-2 gap-3">

                {/* 카메라 촬영 버튼 (모바일: capture="environment"로 후면 카메라 직접 실행) */}
                <div>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full h-11 flex items-center justify-center gap-2 border-2 border-blue-300 rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Camera size={18} />
                    카메라로 촬영
                  </button>
                </div>

                {/* 갤러리/파일 선택 버튼 (데스크톱 파일 탐색기 또는 모바일 갤러리) */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-11 flex items-center justify-center gap-2 border-2 border-slate-300 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Upload size={18} />
                    이미지 선택
                  </button>
                </div>
              </div>

              {/* Claude AI OCR 안내 문구 */}
              <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700 space-y-1">
                <p className="font-medium">✨ Claude AI OCR 분석</p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-600 text-xs">
                  <li>Claude AI가 영수증을 직접 이해해 정확하게 인식합니다.</li>
                  <li>인식된 정보는 저장 전 반드시 확인/수정하세요.</li>
                  <li>모바일에서 카메라로 바로 촬영해 사용하세요.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── STEP 2: 스캔 중 ── */}
          {step === "scanning" && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 size={48} className="text-blue-500 animate-spin" />
              <div className="text-center">
                {/* Claude Vision API 사용에 맞게 메시지 업데이트 */}
                <p className="text-base font-medium text-slate-700">Claude AI가 영수증을 분석하고 있습니다...</p>
                <p className="text-sm text-slate-400 mt-1">이미지 인식 → 텍스트 추출 → 데이터 구조화</p>
              </div>
            </div>
          )}

          {/* ── STEP 3: 검토 및 수정 ── */}
          {step === "review" && (
            <div className="p-6 space-y-6">
              {/* OCR 실패 경고 */}
              {scanResult && !scanResult.success && (
                <div className="flex items-start gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <AlertCircle size={18} className="text-yellow-500 shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-700">
                    <p className="font-medium">OCR 인식이 완전하지 않습니다.</p>
                    <p className="mt-0.5 text-xs">{scanResult.error_message}</p>
                    <p className="mt-1 text-xs">아래 항목을 직접 입력해주세요.</p>
                  </div>
                </div>
              )}

              {/* 기본 정보 영역 */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">기본 정보</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* 날짜 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">지출 날짜 *</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                      className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {/* 거래처 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">거래처명</label>
                    <input
                      type="text"
                      value={formData.vendor}
                      onChange={(e) => setFormData((p) => ({ ...p, vendor: e.target.value }))}
                      placeholder="거래처명 입력"
                      className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {/* 합계 금액 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">합계 금액 (원) *</label>
                    <input
                      type="number"
                      value={formData.total_amount}
                      onChange={(e) => setFormData((p) => ({ ...p, total_amount: e.target.value }))}
                      placeholder="0"
                      min="0"
                      className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {/* 부가세 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">부가세 (원)</label>
                    <input
                      type="number"
                      value={formData.vat}
                      onChange={(e) => setFormData((p) => ({ ...p, vat: e.target.value }))}
                      placeholder="0"
                      min="0"
                      className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {/* 결제 수단 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">결제 수단</label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData((p) => ({ ...p, payment_method: e.target.value }))}
                      className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="카드">카드</option>
                      <option value="현금">현금</option>
                      <option value="계좌이체">계좌이체</option>
                    </select>
                  </div>
                  {/* 지출 분류 */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">지출 분류 *</label>
                    <select
                      value={formData.expense_category_id}
                      onChange={(e) => setFormData((p) => ({ ...p, expense_category_id: e.target.value }))}
                      className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">분류 선택</option>
                      {expenseCategories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* 메모 */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">메모</label>
                    <input
                      type="text"
                      value={formData.memo}
                      onChange={(e) => setFormData((p) => ({ ...p, memo: e.target.value }))}
                      placeholder="추가 메모 (선택)"
                      className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 품목 목록 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-700">품목 목록</h3>
                  <div className="flex items-center gap-3">
                    {/* 전체 재고 반영 체크박스 */}
                    <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allInventoryChecked}
                        ref={(el) => {
                          if (el) el.indeterminate = someInventoryChecked && !allInventoryChecked;
                        }}
                        onChange={(e) => handleToggleAllInventory(e.target.checked)}
                        className="w-3.5 h-3.5 accent-blue-500"
                      />
                      전체 재고 반영
                    </label>
                    {/* 품목 추가 버튼 */}
                    <button
                      onClick={handleAddItem}
                      className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
                    >
                      <Plus size={13} />
                      품목 추가
                    </button>
                  </div>
                </div>

                {items.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
                    <p>인식된 품목이 없습니다.</p>
                    <p className="text-xs mt-1">품목 추가 버튼으로 직접 입력해주세요.</p>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    {/* 테이블 헤더 */}
                    <div className="grid grid-cols-[1fr_80px_60px_100px_100px_160px_60px_40px] bg-slate-50 text-xs font-semibold text-slate-500 px-3 py-2 gap-2">
                      <span>품목명</span>
                      <span className="text-right">수량</span>
                      <span className="text-center">단위</span>
                      <span className="text-right">단가</span>
                      <span className="text-right">소계</span>
                      <span className="text-center">재고 매칭</span>
                      <span className="text-center">반영</span>
                      <span></span>
                    </div>

                    {/* 품목 행 */}
                    {items.map((item, idx) => (
                      <div
                        key={item._key ?? idx}
                        className="grid grid-cols-[1fr_80px_60px_100px_100px_160px_60px_40px] px-3 py-1.5 gap-2 border-t border-slate-100 hover:bg-slate-50/50 items-center"
                      >
                        {/* 품목명 */}
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                          placeholder="품목명"
                          className="h-7 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 w-full"
                        />
                        {/* 수량 */}
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                          min="0"
                          step="0.1"
                          className="h-7 px-2 border border-slate-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400 w-full"
                        />
                        {/* 단위 */}
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                          placeholder="단위"
                          className="h-7 px-2 border border-slate-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400 w-full"
                        />
                        {/* 단가 */}
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(idx, "unit_price", e.target.value)}
                          min="0"
                          className="h-7 px-2 border border-slate-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400 w-full"
                        />
                        {/* 소계 */}
                        <input
                          type="number"
                          value={item.amount}
                          onChange={(e) => handleItemChange(idx, "amount", e.target.value)}
                          min="0"
                          className="h-7 px-2 border border-slate-200 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400 w-full"
                        />
                        {/* 재고 매칭 드롭다운 */}
                        <select
                          value={item.matched_inventory_id ?? ""}
                          onChange={(e) =>
                            handleItemChange(
                              idx,
                              "matched_inventory_id",
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                          className="h-7 px-2 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-full"
                        >
                          <option value="">-- 신규 품목 --</option>
                          {inventoryItems.map((inv) => (
                            <option key={inv.id} value={inv.id}>
                              {inv.name}
                            </option>
                          ))}
                        </select>
                        {/* 재고 반영 체크박스 */}
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={item.apply_to_inventory}
                            onChange={(e) => handleItemChange(idx, "apply_to_inventory", e.target.checked)}
                            disabled={!item.matched_inventory_id}
                            title={!item.matched_inventory_id ? "재고 품목을 먼저 매칭해주세요" : "재고 반영 여부"}
                            className="w-4 h-4 accent-blue-500 disabled:opacity-30 cursor-pointer"
                          />
                        </div>
                        {/* 삭제 버튼 */}
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-300 hover:text-red-400 transition-colors flex justify-center"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 재고 반영 안내 */}
                <p className="text-xs text-slate-400 mt-2">
                  재고 반영: 체크한 품목만 재고에 입고 처리됩니다. 재고 품목과 매칭되지 않은 품목은 자동으로 제외됩니다.
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 저장중/완료 ── */}
          {(step === "saving" || step === "done") && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              {step === "saving" ? (
                <>
                  <Loader2 size={48} className="text-blue-500 animate-spin" />
                  <p className="text-base font-medium text-slate-700">저장 중입니다...</p>
                </>
              ) : (
                <>
                  <CheckCircle size={48} className="text-green-500" />
                  <div className="text-center">
                    <p className="text-base font-medium text-slate-700">저장이 완료되었습니다!</p>
                    <p className="text-sm text-slate-400 mt-1">지출 기록 및 재고가 업데이트되었습니다.</p>
                  </div>
                </>
              )}
            </div>
          )}

        </div>

        {/* 모달 푸터 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50">
          <div className="text-xs text-slate-400">
            {step === "review" && scanResult?.image_path && (
              <span>저장된 이미지: {scanResult.image_path}</span>
            )}
          </div>
          <div className="flex gap-3">
            {/* 취소 버튼 */}
            <button
              onClick={onClose}
              disabled={step === "scanning" || step === "saving"}
              className="h-9 px-5 text-sm font-medium border border-slate-200 rounded-md text-slate-600 hover:bg-white disabled:opacity-30 transition-colors"
            >
              취소
            </button>

            {/* 단계별 주요 버튼 */}
            {step === "upload" && (
              <button
                onClick={handleScan}
                disabled={!selectedFile}
                className="h-9 px-5 bg-blue-500 text-white text-sm font-semibold rounded-md hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                <Scan size={15} />
                AI 분석 시작
              </button>
            )}

            {step === "review" && (
              <>
                {/* 다시 스캔 버튼 */}
                <button
                  onClick={() => setStep("upload")}
                  className="h-9 px-4 text-sm font-medium border border-slate-200 rounded-md text-slate-600 hover:bg-white flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw size={13} />
                  다시 스캔
                </button>
                {/* 확정 저장 버튼 */}
                <button
                  onClick={handleConfirm}
                  className="h-9 px-5 bg-green-500 text-white text-sm font-semibold rounded-md hover:bg-green-600 flex items-center gap-2 transition-colors"
                >
                  <CheckCircle size={15} />
                  지출 + 재고 등록 확정
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptScanner;
