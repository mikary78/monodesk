// ============================================================
// LeaveTab.jsx — 휴가 관리 탭 컴포넌트
// 직원별 휴가 신청/기록 관리 (연차/반차/대체휴가 등)
// 휴가 등록 시 AttendanceCalendar의 daily_status 자동 반영
// ============================================================

import { useState, useEffect } from "react";
import {
  CalendarDays, Plus, Trash2, ChevronDown, ClipboardList,
} from "lucide-react";
import {
  fetchEmployees,
  fetchLeaveRecords,
  createLeaveRecord,
  deleteLeaveRecord,
  formatLeaveType,
} from "../../../api/employeeApi";
import { useToast } from "../../../contexts/ToastContext";

// 휴가 유형 옵션 목록
const LEAVE_TYPE_OPTIONS = [
  { value: "annual",     label: "연차" },
  { value: "half_am",    label: "반차(오전)" },
  { value: "half_pm",    label: "반차(오후)" },
  { value: "substitute", label: "대체휴가" },
  { value: "petition",   label: "청원휴가" },
  { value: "special",    label: "특별휴가" },
  { value: "day_off",    label: "일반휴무" },
];

// 휴가 유형별 배지 색상
const LEAVE_TYPE_COLORS = {
  annual:     "bg-blue-100 text-blue-700",
  half_am:    "bg-sky-100 text-sky-700",
  half_pm:    "bg-cyan-100 text-cyan-700",
  substitute: "bg-indigo-100 text-indigo-700",
  petition:   "bg-violet-100 text-violet-700",
  special:    "bg-purple-100 text-purple-700",
  day_off:    "bg-slate-100 text-slate-600",
};

/**
 * 휴가 관리 탭 컴포넌트
 * @param {number} year - 조회 연도
 * @param {number} month - 조회 월
 */
const LeaveTab = ({ year, month }) => {
  const toast = useToast();

  // 직원 목록
  const [employees, setEmployees] = useState([]);
  // 휴가 기록 목록
  const [leaveRecords, setLeaveRecords] = useState([]);
  // 선택된 직원 필터
  const [selectedEmployee, setSelectedEmployee] = useState("");
  // 로딩 상태
  const [loading, setLoading] = useState(true);
  // 에러 메시지
  const [error, setError] = useState(null);
  // 등록 폼 표시 여부
  const [showForm, setShowForm] = useState(false);
  // 폼 제출 중 로딩
  const [submitting, setSubmitting] = useState(false);

  // 신규 휴가 등록 폼 상태
  const [form, setForm] = useState({
    employee_id: "",
    leave_date: `${year}-${String(month).padStart(2, "0")}-01`,
    leave_type: "annual",
    leave_reason: "",
    approved_by: "",
  });

  // 연도/월 변경 시 데이터 재로드
  useEffect(() => {
    loadData();
  }, [year, month, selectedEmployee]); // eslint-disable-line react-hooks/exhaustive-deps

  // 연도/월 변경 시 폼 기본 날짜도 업데이트
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      leave_date: `${year}-${String(month).padStart(2, "0")}-01`,
    }));
  }, [year, month]);

  /**
   * 직원 목록 + 휴가 기록 로드
   */
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [empData, leaveData] = await Promise.all([
        fetchEmployees(false),
        fetchLeaveRecords({
          employeeId: selectedEmployee || null,
          year,
          month,
        }),
      ]);
      setEmployees(empData);
      setLeaveRecords(leaveData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 직원명 반환 헬퍼
   * @param {number} employeeId
   */
  const getEmployeeName = (employeeId) => {
    const emp = employees.find((e) => e.id === employeeId);
    return emp ? emp.name : `직원 #${employeeId}`;
  };

  /**
   * 폼 입력값 변경 핸들러
   */
  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  /**
   * 휴가 등록 제출
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.employee_id) {
      toast.error("직원을 선택해주세요.");
      return;
    }
    if (!form.leave_date) {
      toast.error("휴가 날짜를 입력해주세요.");
      return;
    }

    try {
      setSubmitting(true);
      await createLeaveRecord({
        employee_id: Number(form.employee_id),
        leave_date: form.leave_date,
        leave_type: form.leave_type,
        leave_reason: form.leave_reason || null,
        approved_by: form.approved_by || null,
        is_approved: 1,
      });
      toast.success("휴가가 등록되었습니다. 근무표 달력에 자동 반영됩니다.");
      // 폼 초기화 후 목록 갱신
      setForm((prev) => ({
        ...prev,
        employee_id: "",
        leave_reason: "",
        approved_by: "",
      }));
      setShowForm(false);
      await loadData();
    } catch (err) {
      toast.error(`등록 오류: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 휴가 기록 삭제
   * @param {object} record - 삭제할 휴가 기록
   */
  const handleDelete = async (record) => {
    const empName = getEmployeeName(record.employee_id);
    const typeLabel = formatLeaveType(record.leave_type);
    if (!window.confirm(`${empName}의 ${record.leave_date} ${typeLabel}을 삭제하시겠습니까?\n근무표 달력의 상태도 함께 변경됩니다.`)) return;
    try {
      await deleteLeaveRecord(record.id);
      toast.success("휴가 기록이 삭제되었습니다.");
      await loadData();
    } catch (err) {
      toast.error(`삭제 오류: ${err.message}`);
    }
  };

  /**
   * 요일 반환 헬퍼
   */
  const getDayOfWeek = (dateStr) => {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const d = new Date(dateStr);
    return days[d.getDay()];
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
            <div className="flex gap-4">
              <div className="w-28 h-4 bg-slate-200 rounded" />
              <div className="w-20 h-4 bg-slate-200 rounded" />
              <div className="flex-1 h-4 bg-slate-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* 상단 필터 + 등록 버튼 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* 직원 필터 */}
          <div className="relative">
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="h-9 pl-3 pr-8 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
            >
              <option value="">전체 직원</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* 집계 */}
          {leaveRecords.length > 0 && (
            <span className="text-sm text-slate-500">
              {year}년 {month}월 · 총 {leaveRecords.length}건
            </span>
          )}
        </div>

        {/* 휴가 등록 버튼 */}
        <button
          onClick={() => setShowForm((v) => !v)}
          className={`flex items-center gap-2 h-9 px-4 text-sm font-semibold rounded-md transition-colors ${
            showForm
              ? "bg-slate-100 border border-slate-200 text-slate-600"
              : "bg-blue-500 text-white hover:bg-blue-600"
          }`}
        >
          <Plus size={16} />
          {showForm ? "취소" : "휴가 등록"}
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 휴가 등록 폼 */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg shadow-sm border border-blue-100 p-5 mb-4"
        >
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <CalendarDays size={16} className="text-blue-500" />
            휴가 등록
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* 직원 선택 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">직원 선택 *</label>
              <div className="relative">
                <select
                  value={form.employee_id}
                  onChange={(e) => handleFormChange("employee_id", e.target.value)}
                  required
                  className="w-full h-9 pl-3 pr-8 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                >
                  <option value="">직원을 선택하세요</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* 휴가 날짜 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">휴가 날짜 *</label>
              <input
                type="date"
                value={form.leave_date}
                onChange={(e) => handleFormChange("leave_date", e.target.value)}
                required
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 휴가 유형 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">휴가 유형 *</label>
              <div className="relative">
                <select
                  value={form.leave_type}
                  onChange={(e) => handleFormChange("leave_type", e.target.value)}
                  required
                  className="w-full h-9 pl-3 pr-8 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                >
                  {LEAVE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* 승인자 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">승인자</label>
              <input
                type="text"
                value={form.approved_by}
                onChange={(e) => handleFormChange("approved_by", e.target.value)}
                placeholder="승인자 이름 (선택)"
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 휴가 사유 */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 mb-1">휴가 사유</label>
            <textarea
              value={form.leave_reason}
              onChange={(e) => handleFormChange("leave_reason", e.target.value)}
              placeholder="휴가 사유를 입력하세요 (선택)"
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* 안내 문구 */}
          <p className="text-xs text-slate-400 mb-4">
            휴가 등록 시 근무표 달력의 해당 날짜 상태가 자동으로 변경됩니다.
          </p>

          {/* 제출 버튼 */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="h-9 px-4 text-sm font-medium border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 h-9 px-5 bg-blue-500 text-white text-sm font-semibold rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              <CalendarDays size={15} />
              {submitting ? "등록 중..." : "휴가 등록"}
            </button>
          </div>
        </form>
      )}

      {/* 휴가 기록 테이블 */}
      {leaveRecords.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm flex flex-col items-center justify-center py-16">
          <ClipboardList size={48} className="text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">{year}년 {month}월 휴가 기록이 없습니다.</p>
          <p className="text-slate-400 text-sm mt-1">위 버튼으로 휴가를 등록하면 근무표 달력에 자동 반영됩니다.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3 w-36">날짜</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3 w-24">직원</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3 w-28">휴가 유형</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">사유</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3 w-24">승인자</th>
                <th className="text-center text-xs font-semibold text-slate-500 uppercase px-4 py-3 w-16">승인</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase px-4 py-3 w-16">관리</th>
              </tr>
            </thead>
            <tbody>
              {leaveRecords.map((record, idx) => {
                const dayOfWeek = getDayOfWeek(record.leave_date);
                const isWeekend = dayOfWeek === "토" || dayOfWeek === "일";
                const colorClass = LEAVE_TYPE_COLORS[record.leave_type] || "bg-slate-100 text-slate-600";

                return (
                  <tr
                    key={record.id}
                    className={`border-b border-slate-100 hover:bg-blue-50/30 transition-colors ${
                      idx % 2 === 0 ? "" : "bg-slate-50/50"
                    }`}
                  >
                    {/* 날짜 */}
                    <td className="px-4 py-3 text-sm">
                      <span className="text-slate-900">{record.leave_date}</span>
                      <span className={`ml-1 text-xs font-medium ${isWeekend ? "text-red-400" : "text-slate-400"}`}>
                        ({dayOfWeek})
                      </span>
                    </td>
                    {/* 직원명 */}
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {getEmployeeName(record.employee_id)}
                    </td>
                    {/* 휴가 유형 배지 */}
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full ${colorClass}`}>
                        {formatLeaveType(record.leave_type)}
                      </span>
                    </td>
                    {/* 사유 */}
                    <td className="px-4 py-3 text-sm text-slate-500 max-w-[200px] truncate">
                      {record.leave_reason || "-"}
                    </td>
                    {/* 승인자 */}
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {record.approved_by || "-"}
                    </td>
                    {/* 승인 여부 */}
                    <td className="px-4 py-3 text-center">
                      {record.is_approved ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">승인</span>
                      ) : (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-medium">대기</span>
                      )}
                    </td>
                    {/* 삭제 버튼 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => handleDelete(record)}
                          className="h-7 w-7 flex items-center justify-center border border-red-200 rounded hover:bg-red-50 transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={13} className="text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LeaveTab;
