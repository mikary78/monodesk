// ============================================================
// EmployeeFormModal.jsx — 직원 등록/수정 모달 컴포넌트
// 신규 등록과 기존 정보 수정을 모두 처리합니다.
// ============================================================

import { useState, useEffect, useRef } from "react";
import { X, Save, User } from "lucide-react";
import { createEmployee, updateEmployee } from "../../../api/employeeApi";
import { useToast } from "../../../contexts/ToastContext";

// 고용 형태 옵션
const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "PART_TIME", label: "아르바이트" },
  { value: "FULL_TIME", label: "정규직" },
];

// 급여 유형 옵션
const SALARY_TYPE_OPTIONS = [
  { value: "HOURLY", label: "시급제" },
  { value: "MONTHLY", label: "월급제" },
];

// 포지션 옵션 (여남동 맞춤)
const POSITION_OPTIONS = ["홀서빙", "주방", "매니저", "바텐더", "배달", "기타"];

// 은행 옵션
const BANK_OPTIONS = [
  "국민은행", "신한은행", "하나은행", "우리은행", "농협은행",
  "카카오뱅크", "토스뱅크", "케이뱅크", "기업은행", "새마을금고", "기타"
];

/**
 * 직원 등록/수정 모달 컴포넌트
 * @param {object|null} employee - 수정 시 직원 데이터, null이면 신규 등록
 * @param {function} onClose - 모달 닫기 콜백
 * @param {function} onSaved - 저장 완료 콜백
 */
const EmployeeFormModal = ({ employee, onClose, onSaved }) => {
  const toast = useToast();
  // 첫 번째 입력 필드 포커스용 ref
  const firstInputRef = useRef(null);

  // Escape 키로 모달 닫기
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    // 모달 열릴 때 첫 번째 입력 필드로 포커스 이동
    firstInputRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // 폼 데이터 상태
  const [form, setForm] = useState({
    name: "",
    phone: "",
    employment_type: "PART_TIME",
    salary_type: "HOURLY",
    hourly_wage: "",
    monthly_salary: "",
    has_insurance: false,
    hire_date: "",
    resign_date: "",
    position: "",
    bank_account: "",
    bank_name: "",
    memo: "",
  });

  // 저장 중 상태
  const [saving, setSaving] = useState(false);
  // 에러 메시지
  const [errors, setErrors] = useState({});

  // 수정 모드일 때 기존 데이터로 초기화
  useEffect(() => {
    if (employee) {
      setForm({
        name: employee.name || "",
        phone: employee.phone || "",
        employment_type: employee.employment_type || "PART_TIME",
        salary_type: employee.salary_type || "HOURLY",
        hourly_wage: employee.hourly_wage ?? "",
        monthly_salary: employee.monthly_salary ?? "",
        has_insurance: employee.has_insurance ?? false,
        hire_date: employee.hire_date || "",
        resign_date: employee.resign_date || "",
        position: employee.position || "",
        bank_account: employee.bank_account || "",
        bank_name: employee.bank_name || "",
        memo: employee.memo || "",
      });
    }
  }, [employee]);

  /**
   * 입력 필드 변경 처리
   * @param {Event} e - 입력 이벤트
   */
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    // 에러 메시지 초기화
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  /**
   * 폼 유효성 검사
   * @returns {boolean} 유효 여부
   */
  const validate = () => {
    const newErrors = {};

    if (!form.name.trim()) {
      newErrors.name = "이름을 입력해주세요.";
    }

    if (form.salary_type === "HOURLY") {
      if (!form.hourly_wage || Number(form.hourly_wage) <= 0) {
        newErrors.hourly_wage = "시급을 입력해주세요.";
      } else if (Number(form.hourly_wage) < 10030) {
        newErrors.hourly_wage = "2026년 최저임금(10,030원)보다 높게 설정해주세요.";
      }
    } else {
      if (!form.monthly_salary || Number(form.monthly_salary) <= 0) {
        newErrors.monthly_salary = "월급을 입력해주세요.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * 저장 처리
   */
  const handleSave = async () => {
    if (!validate()) return;

    // API 전송용 데이터 준비 (빈 문자열은 null로 변환)
    const submitData = {
      ...form,
      hourly_wage: form.salary_type === "HOURLY" && form.hourly_wage !== "" ? Number(form.hourly_wage) : null,
      monthly_salary: form.salary_type === "MONTHLY" && form.monthly_salary !== "" ? Number(form.monthly_salary) : null,
      phone: form.phone || null,
      hire_date: form.hire_date || null,
      resign_date: form.resign_date || null,
      position: form.position || null,
      bank_account: form.bank_account || null,
      bank_name: form.bank_name || null,
      memo: form.memo || null,
    };

    try {
      setSaving(true);
      if (employee) {
        await updateEmployee(employee.id, submitData);
      } else {
        await createEmployee(submitData);
      }
      onSaved();
    } catch (err) {
      toast.error(`저장 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    // 모달 오버레이 — 배경 클릭 시 닫기
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      {/* 모달 본문 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-form-modal-title"
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <User size={20} className="text-blue-500" />
            <h2 id="employee-form-modal-title" className="text-lg font-semibold text-slate-900">
              {employee ? "직원 정보 수정" : "직원 등록"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-slate-100 transition-colors"
            aria-label="닫기"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="p-6 space-y-5">
          {/* 이름 + 연락처 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                ref={firstInputRef}
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="직원 이름"
                className={`w-full h-9 px-3 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.name ? "border-red-400" : "border-slate-200"
                }`}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">연락처</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="010-0000-0000"
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 직무 + 고용 형태 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">직무/포지션</label>
              <select
                name="position"
                value={form.position}
                onChange={handleChange}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">선택 안 함</option>
                {POSITION_OPTIONS.map((pos) => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">고용 형태</label>
              <select
                name="employment_type"
                value={form.employment_type}
                onChange={handleChange}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 급여 유형 + 금액 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">급여 유형</label>
              <select
                name="salary_type"
                value={form.salary_type}
                onChange={handleChange}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {SALARY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              {form.salary_type === "HOURLY" ? (
                <>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    시급 <span className="text-red-500">*</span>
                    <span className="text-slate-400 font-normal ml-1">(최저 10,030원)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="hourly_wage"
                      value={form.hourly_wage}
                      onChange={handleChange}
                      placeholder="10030"
                      min={10030}
                      className={`w-full h-9 px-3 pr-8 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.hourly_wage ? "border-red-400" : "border-slate-200"
                      }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">원</span>
                  </div>
                  {errors.hourly_wage && <p className="text-xs text-red-500 mt-1">{errors.hourly_wage}</p>}
                </>
              ) : (
                <>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    월급 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="monthly_salary"
                      value={form.monthly_salary}
                      onChange={handleChange}
                      placeholder="2000000"
                      className={`w-full h-9 px-3 pr-8 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.monthly_salary ? "border-red-400" : "border-slate-200"
                      }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">원</span>
                  </div>
                  {errors.monthly_salary && <p className="text-xs text-red-500 mt-1">{errors.monthly_salary}</p>}
                </>
              )}
            </div>
          </div>

          {/* 4대보험 */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="has_insurance"
                checked={form.has_insurance}
                onChange={handleChange}
                className="w-4 h-4 rounded text-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">4대보험 적용</span>
                <span className="text-xs text-slate-400 ml-2">
                  (국민연금 4.5% · 건강보험 3.545% · 장기요양 · 고용보험 0.9%)
                </span>
              </div>
            </label>
          </div>

          {/* 입사일 + 퇴사일 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">입사일</label>
              <input
                type="date"
                name="hire_date"
                value={form.hire_date}
                onChange={handleChange}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                퇴사일 <span className="text-slate-400 font-normal">(재직 중이면 비워두기)</span>
              </label>
              <input
                type="date"
                name="resign_date"
                value={form.resign_date}
                onChange={handleChange}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 은행 + 계좌번호 */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">은행</label>
              <select
                name="bank_name"
                value={form.bank_name}
                onChange={handleChange}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">선택</option>
                {BANK_OPTIONS.map((bank) => (
                  <option key={bank} value={bank}>{bank}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">계좌번호</label>
              <input
                type="text"
                name="bank_account"
                value={form.bank_account}
                onChange={handleChange}
                placeholder="000-000-000000"
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 메모 */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">메모</label>
            <textarea
              name="memo"
              value={form.memo}
              onChange={handleChange}
              placeholder="특이사항이나 메모를 입력하세요."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="flex justify-end gap-3 p-6 border-t border-slate-100">
          <button
            onClick={onClose}
            className="h-9 px-5 text-sm font-medium border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 h-9 px-5 bg-blue-500 text-white text-sm font-semibold rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={16} />
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmployeeFormModal;
