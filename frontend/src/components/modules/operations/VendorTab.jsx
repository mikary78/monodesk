// ============================================================
// VendorTab.jsx — 거래처 관리 탭 컴포넌트
// 식자재/주류 등 납품업체 정보를 등록·수정·삭제합니다.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Search, Edit, Trash2, X, Save,
  Phone, CreditCard, Calendar, Store
} from "lucide-react";
import {
  fetchVendors,
  createVendor,
  updateVendor,
  deleteVendor,
} from "../../../api/operationsApi";
import { useToast } from "../../../contexts/ToastContext";
import ConfirmDialog from "../../common/ConfirmDialog";

// 카테고리 목록 정의
const CATEGORIES = ["전체", "식자재", "주류", "소모품", "기타"];

// 결제방법 목록 정의
const PAYMENT_METHODS = ["카드", "계좌이체", "현금"];

// 카테고리별 뱃지 색상 클래스 반환
const getCategoryBadgeClass = (category) => {
  switch (category) {
    case "식자재": return "bg-green-100 text-green-700";
    case "주류":   return "bg-purple-100 text-purple-700";
    case "소모품": return "bg-orange-100 text-orange-700";
    default:       return "bg-slate-100 text-slate-600";
  }
};

// 초기 폼 상태 정의
const INITIAL_FORM = {
  name: "",
  category: "기타",
  contact_name: "",
  phone: "",
  bank_name: "",
  account_number: "",
  payment_day: "",
  payment_method: "계좌이체",
  memo: "",
};

// ── 거래처 등록/수정 모달 컴포넌트 ──────────────────────────
const VendorModal = ({ isOpen, onClose, onSave, vendor }) => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // 수정 모드일 때 기존 데이터로 폼 초기화
  useEffect(() => {
    if (vendor) {
      setForm({
        name: vendor.name || "",
        category: vendor.category || "기타",
        contact_name: vendor.contact_name || "",
        phone: vendor.phone || "",
        bank_name: vendor.bank_name || "",
        account_number: vendor.account_number || "",
        payment_day: vendor.payment_day ?? "",
        payment_method: vendor.payment_method || "계좌이체",
        memo: vendor.memo || "",
      });
    } else {
      setForm(INITIAL_FORM);
    }
    setErrors({});
  }, [vendor, isOpen]);

  // 폼 필드 변경 핸들러
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  // 폼 유효성 검사
  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "거래처명을 입력해주세요.";
    if (form.payment_day !== "" && (isNaN(Number(form.payment_day)) || Number(form.payment_day) < 1 || Number(form.payment_day) > 31)) {
      errs.payment_day = "결제일은 1~31 사이의 숫자여야 합니다.";
    }
    return errs;
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
        payment_day: form.payment_day !== "" ? Number(form.payment_day) : null,
        // 빈 문자열 필드는 null로 변환
        contact_name: form.contact_name.trim() || null,
        phone: form.phone.trim() || null,
        bank_name: form.bank_name.trim() || null,
        account_number: form.account_number.trim() || null,
        memo: form.memo.trim() || null,
      });
      onClose();
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  const isEditMode = !!vendor;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* 모달 본문 */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEditMode ? "거래처 수정" : "거래처 등록"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100"
          >
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 전체 오류 */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
              {errors.submit}
            </div>
          )}

          {/* 거래처명 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              거래처명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="예: 삼다수 수산"
              className={`w-full h-9 px-3 border rounded-md text-sm focus:outline-none focus:border-blue-500 ${errors.name ? "border-red-400" : "border-slate-200"}`}
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* 카테고리 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">카테고리</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:border-blue-500"
            >
              {CATEGORIES.filter((c) => c !== "전체").map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* 담당자명 / 연락처 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">담당자명</label>
              <input
                type="text"
                name="contact_name"
                value={form.contact_name}
                onChange={handleChange}
                placeholder="예: 홍길동"
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">연락처</label>
              <input
                type="text"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="예: 010-1234-5678"
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* 은행명 / 계좌번호 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">은행명</label>
              <input
                type="text"
                name="bank_name"
                value={form.bank_name}
                onChange={handleChange}
                placeholder="예: 국민은행"
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">계좌번호</label>
              <input
                type="text"
                name="account_number"
                value={form.account_number}
                onChange={handleChange}
                placeholder="예: 123-456-789012"
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* 결제일 / 결제방법 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">결제일 (매월)</label>
              <input
                type="number"
                name="payment_day"
                value={form.payment_day}
                onChange={handleChange}
                placeholder="예: 15"
                min="1"
                max="31"
                className={`w-full h-9 px-3 border rounded-md text-sm focus:outline-none focus:border-blue-500 ${errors.payment_day ? "border-red-400" : "border-slate-200"}`}
              />
              {errors.payment_day && <p className="mt-1 text-xs text-red-500">{errors.payment_day}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">결제방법</label>
              <select
                name="payment_method"
                value={form.payment_method}
                onChange={handleChange}
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:border-blue-500"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">메모</label>
            <textarea
              name="memo"
              value={form.memo}
              onChange={handleChange}
              placeholder="특이사항, 주의사항 등 자유롭게 입력"
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 resize-none"
            />
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


// ── 메인 VendorTab 컴포넌트 ─────────────────────────────────
// readOnly: true이면 등록·수정·삭제 버튼 숨김 (staff 읽기 전용 모드)
const VendorTab = ({ readOnly = false }) => {
  const toast = useToast();

  // 데이터 상태
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 필터 상태
  const [filterCategory, setFilterCategory] = useState("전체");
  const [searchText, setSearchText] = useState("");

  // 모달 상태
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);

  // 삭제 확인 다이얼로그 상태
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, vendor: null });

  // 거래처 목록 로드
  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filterCategory !== "전체") params.category = filterCategory;
      if (searchText.trim()) params.search = searchText.trim();
      const data = await fetchVendors(params);
      setVendors(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, searchText]);

  // 필터 변경 시 목록 재조회
  useEffect(() => {
    const timer = setTimeout(() => loadVendors(), 300);
    return () => clearTimeout(timer);
  }, [filterCategory, searchText]);

  // 초기 로드
  useEffect(() => {
    loadVendors();
  }, []);

  // 거래처 저장 핸들러
  const handleSave = async (formData) => {
    if (editingVendor) {
      await updateVendor(editingVendor.id, formData);
      toast.success("거래처 정보가 수정되었습니다.");
    } else {
      await createVendor(formData);
      toast.success("거래처가 등록되었습니다.");
    }
    await loadVendors();
  };

  // 삭제 버튼 클릭
  const handleDeleteClick = (vendor) => {
    setDeleteConfirm({ open: true, vendor });
  };

  // 삭제 확인
  const handleDeleteConfirm = async () => {
    const vendor = deleteConfirm.vendor;
    setDeleteConfirm({ open: false, vendor: null });
    try {
      await deleteVendor(vendor.id);
      toast.success("거래처가 삭제되었습니다.");
      await loadVendors();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // 등록 버튼 클릭
  const handleAddClick = () => {
    setEditingVendor(null);
    setModalOpen(true);
  };

  // 수정 버튼 클릭
  const handleEditClick = (vendor) => {
    setEditingVendor(vendor);
    setModalOpen(true);
  };

  return (
    <div>
      {/* ── 필터 바 ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* 검색 */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="거래처명 또는 담당자 검색..."
            className="w-full h-9 pl-8 pr-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 카테고리 필터 탭 */}
        <div className="flex gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`h-9 px-3 rounded-md text-xs font-medium border transition-colors ${
                filterCategory === cat
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <span className="text-sm text-slate-500 ml-auto">
          총 {vendors.length}개
        </span>

        {/* 등록 버튼 — readOnly 모드에서 숨김 */}
        {!readOnly && (
          <button
            onClick={handleAddClick}
            className="h-9 px-4 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 flex items-center gap-2"
          >
            <Plus size={14} />
            거래처 등록
          </button>
        )}
      </div>

      {/* ── 에러 메시지 ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-red-700 text-sm">
          거래처 목록 조회 중 오류가 발생했습니다: {error}
        </div>
      )}

      {/* ── 거래처 카드 목록 ── */}
      {loading ? (
        <div className="py-12 text-center">
          <div className="text-slate-400 text-sm">거래처 목록을 불러오는 중...</div>
        </div>
      ) : vendors.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-lg shadow-sm">
          <Store size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm mb-1">등록된 거래처가 없습니다.</p>
          <p className="text-slate-400 text-xs">
            {filterCategory !== "전체" || searchText
              ? "검색 조건을 변경해 보세요."
              : "거래처 등록 버튼을 눌러 첫 번째 거래처를 추가해보세요."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {vendors.map((vendor) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}

      {/* ── 거래처 등록/수정 모달 ── */}
      <VendorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        vendor={editingVendor}
      />

      {/* ── 삭제 확인 다이얼로그 ── */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        title="거래처 삭제"
        message={`"${deleteConfirm.vendor?.name}" 거래처를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm({ open: false, vendor: null })}
      />
    </div>
  );
};


// ── 거래처 카드 서브 컴포넌트 ────────────────────────────────
// readOnly: true이면 수정·삭제 버튼 숨김
const VendorCard = ({ vendor, onEdit, onDelete, readOnly = false }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-4 hover:shadow-md transition-shadow">
      {/* 카드 헤더: 거래처명 + 카테고리 뱃지 + 버튼 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">{vendor.name}</span>
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getCategoryBadgeClass(vendor.category)}`}>
              {vendor.category}
            </span>
          </div>
          {vendor.contact_name && (
            <p className="text-xs text-slate-500 mt-0.5">담당: {vendor.contact_name}</p>
          )}
        </div>
        {/* 수정/삭제 버튼 — readOnly 모드에서 숨김 */}
        {!readOnly && (
          <div className="flex items-center gap-1 ml-2 shrink-0">
            <button
              onClick={() => onEdit(vendor)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-blue-50 text-slate-400 hover:text-blue-500"
              title="수정"
            >
              <Edit size={14} />
            </button>
            <button
              onClick={() => onDelete(vendor)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
              title="삭제"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* 카드 본문: 연락처, 계좌, 결제일 정보 */}
      <div className="space-y-1.5">
        {/* 연락처 */}
        {vendor.phone && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Phone size={12} className="text-slate-400 shrink-0" />
            <span>{vendor.phone}</span>
          </div>
        )}

        {/* 계좌정보 */}
        {(vendor.bank_name || vendor.account_number) && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <CreditCard size={12} className="text-slate-400 shrink-0" />
            <span className="truncate">
              {[vendor.bank_name, vendor.account_number].filter(Boolean).join(" ")}
            </span>
          </div>
        )}

        {/* 결제일 */}
        {vendor.payment_day && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Calendar size={12} className="text-slate-400 shrink-0" />
            <span>매월 {vendor.payment_day}일 · {vendor.payment_method}</span>
          </div>
        )}

        {/* 결제방법만 있는 경우 (결제일 없음) */}
        {!vendor.payment_day && vendor.payment_method && (
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Calendar size={12} className="text-slate-400 shrink-0" />
            <span>{vendor.payment_method}</span>
          </div>
        )}

        {/* 메모 */}
        {vendor.memo && (
          <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">
            {vendor.memo}
          </p>
        )}
      </div>

      {/* 정보가 아무것도 없는 경우 안내 */}
      {!vendor.phone && !vendor.bank_name && !vendor.account_number && !vendor.payment_day && !vendor.memo && (
        <p className="text-xs text-slate-300 italic">상세 정보가 없습니다.</p>
      )}
    </div>
  );
};

export default VendorTab;
