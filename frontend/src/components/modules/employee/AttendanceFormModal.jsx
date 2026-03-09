// ============================================================
// AttendanceFormModal.jsx — 출퇴근 기록 입력/수정 모달
// 출퇴근 시각 입력 시 근무시간을 자동 계산합니다.
// ============================================================

import { useState, useEffect } from "react";
import { X, Save, Clock, RefreshCw } from "lucide-react";
import { createAttendance, updateAttendance, calculateWorkHours, formatHours } from "../../../api/employeeApi";

/**
 * 출퇴근 기록 입력/수정 모달
 * @param {object|null} record - 수정 시 기존 기록, null이면 신규
 * @param {Array} employees - 직원 목록
 * @param {number} year - 현재 선택된 연도
 * @param {number} month - 현재 선택된 월
 * @param {function} onClose - 닫기 콜백
 * @param {function} onSaved - 저장 완료 콜백
 */
const AttendanceFormModal = ({ record, employees, year, month, onClose, onSaved }) => {
  // 오늘 날짜 (기본값용)
  const today = new Date().toISOString().split("T")[0];

  // 폼 데이터 상태
  const [form, setForm] = useState({
    employee_id: "",
    work_date: today,
    clock_in: "",
    clock_out: "",
    work_hours: "",
    overtime_hours: 0,
    night_hours: 0,
    memo: "",
  });

  // 자동 계산된 근무시간 표시
  const [calculatedHours, setCalculatedHours] = useState(null);
  // 저장 중 상태
  const [saving, setSaving] = useState(false);
  // 에러 메시지
  const [errors, setErrors] = useState({});

  // 수정 모드일 때 기존 데이터로 초기화
  useEffect(() => {
    if (record) {
      setForm({
        employee_id: record.employee_id || "",
        work_date: record.work_date || today,
        clock_in: record.clock_in || "",
        clock_out: record.clock_out || "",
        work_hours: record.work_hours ?? "",
        overtime_hours: record.overtime_hours ?? 0,
        night_hours: record.night_hours ?? 0,
        memo: record.memo || "",
      });
      if (record.work_hours) {
        setCalculatedHours({
          work_hours: record.work_hours,
          overtime_hours: record.overtime_hours || 0,
          night_hours: record.night_hours || 0,
        });
      }
    }
  }, [record]);

  /**
   * 입력 필드 변경 처리
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  /**
   * 출퇴근 시각 기반 근무시간 자동 계산
   */
  const handleCalculate = async () => {
    if (!form.clock_in || !form.clock_out) return;
    try {
      const result = await calculateWorkHours(form.clock_in, form.clock_out);
      if (result.success) {
        setCalculatedHours(result.data);
        setForm((prev) => ({
          ...prev,
          work_hours: result.data.work_hours,
          overtime_hours: result.data.overtime_hours,
          night_hours: result.data.night_hours,
        }));
      }
    } catch (err) {
      alert(`근무시간 계산 오류: ${err.message}`);
    }
  };

  // 출퇴근 시각 변경 시 자동 계산 트리거
  useEffect(() => {
    if (form.clock_in && form.clock_out) {
      handleCalculate();
    }
  }, [form.clock_in, form.clock_out]);

  /**
   * 폼 유효성 검사
   */
  const validate = () => {
    const newErrors = {};
    if (!form.employee_id) newErrors.employee_id = "직원을 선택해주세요.";
    if (!form.work_date) newErrors.work_date = "근무 날짜를 선택해주세요.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * 저장 처리
   */
  const handleSave = async () => {
    if (!validate()) return;

    const submitData = {
      employee_id: Number(form.employee_id),
      work_date: form.work_date,
      clock_in: form.clock_in || null,
      clock_out: form.clock_out || null,
      work_hours: form.work_hours !== "" ? Number(form.work_hours) : null,
      overtime_hours: Number(form.overtime_hours) || 0,
      night_hours: Number(form.night_hours) || 0,
      memo: form.memo || null,
    };

    try {
      setSaving(true);
      if (record) {
        await updateAttendance(record.id, submitData);
      } else {
        await createAttendance(submitData);
      }
      onSaved();
    } catch (err) {
      alert(`저장 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock size={20} className="text-blue-500" />
            <h2 className="text-lg font-semibold text-slate-900">
              {record ? "출퇴근 기록 수정" : "출퇴근 기록 입력"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-slate-100 transition-colors"
            title="닫기"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="p-6 space-y-4">
          {/* 직원 선택 */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              직원 <span className="text-red-500">*</span>
            </label>
            <select
              name="employee_id"
              value={form.employee_id}
              onChange={handleChange}
              className={`w-full h-9 px-3 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                errors.employee_id ? "border-red-400" : "border-slate-200"
              }`}
            >
              <option value="">직원 선택</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.position || "포지션 없음"})</option>
              ))}
            </select>
            {errors.employee_id && <p className="text-xs text-red-500 mt-1">{errors.employee_id}</p>}
          </div>

          {/* 근무 날짜 */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              근무 날짜 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="work_date"
              value={form.work_date}
              onChange={handleChange}
              className={`w-full h-9 px-3 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.work_date ? "border-red-400" : "border-slate-200"
              }`}
            />
            {errors.work_date && <p className="text-xs text-red-500 mt-1">{errors.work_date}</p>}
          </div>

          {/* 출퇴근 시각 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">출근 시각</label>
              <input
                type="time"
                name="clock_in"
                value={form.clock_in}
                onChange={handleChange}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">퇴근 시각</label>
              <input
                type="time"
                name="clock_out"
                value={form.clock_out}
                onChange={handleChange}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 자동 계산 결과 */}
          {calculatedHours && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw size={14} className="text-blue-500" />
                <span className="text-xs font-semibold text-blue-700">자동 계산 결과</span>
                <span className="text-xs text-slate-400">(8시간 초과 시 1시간 휴게 공제)</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="text-center">
                  <div className="text-xs text-slate-500">실 근무시간</div>
                  <div className="font-semibold text-slate-900">{formatHours(calculatedHours.work_hours)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500">연장근로</div>
                  <div className={`font-semibold ${calculatedHours.overtime_hours > 0 ? "text-orange-600" : "text-slate-400"}`}>
                    {calculatedHours.overtime_hours > 0 ? formatHours(calculatedHours.overtime_hours) : "-"}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-slate-500">야간근로</div>
                  <div className={`font-semibold ${calculatedHours.night_hours > 0 ? "text-purple-600" : "text-slate-400"}`}>
                    {calculatedHours.night_hours > 0 ? formatHours(calculatedHours.night_hours) : "-"}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 수동 근무시간 입력 (자동 계산이 없을 때) */}
          {!form.clock_in && !form.clock_out && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                근무시간 (직접 입력)
                <span className="text-slate-400 font-normal ml-1">출퇴근 시각 입력 시 자동 계산됩니다.</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="work_hours"
                  value={form.work_hours}
                  onChange={handleChange}
                  placeholder="8"
                  step="0.5"
                  min="0"
                  max="24"
                  className="w-full h-9 px-3 pr-10 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">시간</span>
              </div>
            </div>
          )}

          {/* 메모 */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">메모</label>
            <input
              type="text"
              name="memo"
              value={form.memo}
              onChange={handleChange}
              placeholder="지각, 조퇴, 결근 사유 등"
              className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

export default AttendanceFormModal;
