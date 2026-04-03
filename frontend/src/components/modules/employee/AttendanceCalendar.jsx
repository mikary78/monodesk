// ============================================================
// AttendanceCalendar.jsx — 근무표 달력 컴포넌트
// 전체 직원의 월별 근태를 달력 형태로 표시하고,
// 셀 클릭으로 근무 상태를 빠르게 변경할 수 있습니다.
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import {
  getMonthlyAttendanceCalendar,
  createAttendance,
  updateAttendanceStatus,
} from "../../../api/employeeApi";

// ─────────────────────────────────────────
// 상태별 라벨 / 색상 설정
// ─────────────────────────────────────────
const STATUS_CONFIG = {
  work:            { label: "근무",     bg: "bg-green-100",  text: "text-green-700",  border: "border-green-200" },
  off:             { label: "휴무",     bg: "bg-slate-100",  text: "text-slate-500",  border: "border-slate-200" },
  annual:          { label: "월차",     bg: "bg-blue-100",   text: "text-blue-700",   border: "border-blue-200" },
  half_am:         { label: "반차(오)", bg: "bg-sky-100",    text: "text-sky-700",    border: "border-sky-200" },
  half_pm:         { label: "반차(오)", bg: "bg-sky-100",    text: "text-sky-700",    border: "border-sky-200" },
  absent:          { label: "결근",     bg: "bg-red-100",    text: "text-red-700",    border: "border-red-200" },
  early_leave:     { label: "조퇴",     bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
  recommended_off: { label: "권장휴",   bg: "bg-purple-100", text: "text-purple-600", border: "border-purple-200" },
  support:         { label: "지원",     bg: "bg-yellow-100", text: "text-yellow-700", border: "border-yellow-200" },
};

// 상태 드롭다운 순서
const STATUS_ORDER = [
  "work", "off", "annual", "half_am", "half_pm",
  "absent", "early_leave", "recommended_off", "support",
];

// 요일 레이블
const DAY_OF_WEEK = ["일", "월", "화", "수", "목", "금", "토"];


// ─────────────────────────────────────────
// 유틸리티 함수
// ─────────────────────────────────────────

/**
 * 해당 월의 날짜 배열을 생성합니다.
 * @param {number} year - 연도
 * @param {number} month - 월
 * @returns {Date[]} 날짜 배열
 */
function getDaysInMonth(year, month) {
  const days = [];
  const lastDay = new Date(year, month, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    days.push(new Date(year, month - 1, d));
  }
  return days;
}

/**
 * Date 객체를 YYYY-MM-DD 문자열로 변환합니다.
 * @param {Date} date
 * @returns {string}
 */
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}


// ─────────────────────────────────────────
// 상태 드롭다운 컴포넌트
// ─────────────────────────────────────────

/**
 * 셀 클릭 시 나타나는 상태 선택 드롭다운.
 * 외부 클릭 시 자동으로 닫힙니다.
 */
function StatusDropdown({ onSelect, onClose }) {
  const ref = useRef(null);

  // 외부 클릭 감지 → 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[100px]"
    >
      {STATUS_ORDER.map((key) => {
        const cfg = STATUS_CONFIG[key];
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-50 transition-colors ${cfg.text}`}
          >
            {cfg.label}
          </button>
        );
      })}
    </div>
  );
}


// ─────────────────────────────────────────
// 달력 셀 컴포넌트
// ─────────────────────────────────────────

/**
 * 직원×날짜 교차 셀.
 * 클릭하면 상태 드롭다운이 나타납니다.
 */
function CalendarCell({ employeeId, dateStr, cellData, onStatusChange }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [updating, setUpdating] = useState(false);

  const status = cellData?.status || null;
  const cfg = status ? STATUS_CONFIG[status] : null;

  /**
   * 드롭다운에서 상태 선택 시 처리.
   * record_id가 있으면 PATCH, 없으면 POST
   */
  async function handleSelect(newStatus) {
    setShowDropdown(false);
    setUpdating(true);
    try {
      await onStatusChange(employeeId, dateStr, cellData?.record_id || null, newStatus);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <td className="border border-slate-100 p-0.5 min-w-[52px] max-w-[64px] relative">
      <div className="relative">
        {/* 상태 배지 (클릭 가능) */}
        <button
          onClick={() => setShowDropdown((v) => !v)}
          disabled={updating}
          className={`
            w-full h-7 rounded text-[11px] font-medium border transition-colors
            ${cfg
              ? `${cfg.bg} ${cfg.text} ${cfg.border} hover:opacity-80`
              : "bg-white border-slate-100 text-slate-300 hover:bg-slate-50"
            }
            ${updating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          `}
          title={cfg ? cfg.label : "클릭하여 상태 설정"}
        >
          {updating ? (
            <Loader2 size={10} className="animate-spin mx-auto" />
          ) : (
            cfg ? cfg.label : "·"
          )}
        </button>

        {/* 상태 드롭다운 */}
        {showDropdown && (
          <StatusDropdown
            onSelect={handleSelect}
            onClose={() => setShowDropdown(false)}
          />
        )}
      </div>
    </td>
  );
}


// ─────────────────────────────────────────
// 메인 AttendanceCalendar 컴포넌트
// ─────────────────────────────────────────

/**
 * 근무표 달력 메인 컴포넌트.
 * @param {number} year - 연도 (부모에서 전달)
 * @param {number} month - 월 (부모에서 전달)
 */
const AttendanceCalendar = ({ year, month }) => {
  // 달력 데이터 상태
  const [calendarData, setCalendarData] = useState(null);
  // 로딩 상태
  const [loading, setLoading] = useState(false);
  // 오류 상태
  const [error, setError] = useState(null);

  // 해당 월 날짜 배열
  const days = getDaysInMonth(year, month);

  /**
   * 달력 데이터 로드 함수.
   */
  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMonthlyAttendanceCalendar(year, month);
      setCalendarData(data);
    } catch (err) {
      setError(err.message || "달력 데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  // 연도/월 변경 시 재로드
  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  /**
   * 셀 상태 변경 처리.
   * record_id 있으면 PATCH, 없으면 POST(신규 기록 생성)
   */
  const handleStatusChange = useCallback(async (employeeId, dateStr, recordId, newStatus) => {
    if (recordId) {
      // 기존 기록 → 상태만 수정
      await updateAttendanceStatus(recordId, newStatus);
    } else {
      // 신규 기록 → 날짜+직원+상태만 포함하여 생성
      await createAttendance({
        employee_id: employeeId,
        work_date: dateStr,
        daily_status: newStatus,
      });
    }
    // 성공 후 달력 데이터 리로드
    await loadCalendar();
  }, [loadCalendar]);

  // ─── 집계 함수 ───────────────────────────────────

  /**
   * 직원의 월간 근무 상태 집계.
   * @param {string} empId - 직원 ID (문자열)
   * @returns {{ workDays, offDays, annualDays }}
   */
  function getSummaryForEmployee(empId) {
    const empAttendance = calendarData?.attendance?.[empId] || {};
    let workDays = 0;
    let offDays = 0;
    let annualDays = 0;

    for (const day of days) {
      const dateStr = toDateStr(day);
      const cell = empAttendance[dateStr];
      const status = cell?.status;
      if (!status) continue;
      if (status === "work" || status === "support") workDays++;
      if (status === "off" || status === "recommended_off") offDays++;
      if (status === "annual") annualDays++;
      if (status === "half_am" || status === "half_pm") annualDays += 0.5;
    }

    return { workDays, offDays, annualDays };
  }

  /**
   * 날짜별 근무 인원 수 (work/support 상태인 직원 수).
   * @param {string} dateStr - YYYY-MM-DD
   * @returns {number}
   */
  function getWorkCountForDate(dateStr) {
    if (!calendarData) return 0;
    let count = 0;
    for (const emp of calendarData.employees) {
      const cell = calendarData.attendance?.[String(emp.id)]?.[dateStr];
      if (cell && (cell.status === "work" || cell.status === "support")) count++;
    }
    return count;
  }

  // ─── 직원을 고용 형태별로 그룹화 ────────────────

  const fullTimeEmployees = calendarData?.employees?.filter(
    (e) => e.employment_type === "FULL_TIME"
  ) || [];
  const partTimeEmployees = calendarData?.employees?.filter(
    (e) => e.employment_type !== "FULL_TIME"
  ) || [];


  // ─── 렌더링 ──────────────────────────────────────

  // 로딩 중
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span>달력 데이터를 불러오는 중...</span>
      </div>
    );
  }

  // 오류 발생
  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
        <AlertCircle size={18} />
        <span className="text-sm">{error}</span>
        <button
          onClick={loadCalendar}
          className="ml-auto text-xs underline hover:no-underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  // 직원 없음
  if (!calendarData || calendarData.employees.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        등록된 직원이 없습니다.
      </div>
    );
  }

  // 모든 직원 순서 (정직원 → 아르바이트)
  const allEmployees = [...fullTimeEmployees, ...partTimeEmployees];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* 상단 범례 */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <span className="text-xs font-medium text-slate-500 mr-1">범례</span>
        {STATUS_ORDER.map((key) => {
          const cfg = STATUS_CONFIG[key];
          return (
            <span
              key={key}
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}
            >
              {cfg.label}
            </span>
          );
        })}
        <span className="ml-auto text-[11px] text-slate-400">셀 클릭 → 상태 변경</span>
      </div>

      {/* 달력 테이블 (가로 스크롤 가능) */}
      <div className="overflow-x-auto">
        <table className="border-collapse text-xs w-full">
          <thead>
            <tr className="bg-slate-50">
              {/* 직원명 컬럼 헤더 */}
              <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-[90px]">
                직원
              </th>

              {/* 날짜 헤더 (1일~말일) */}
              {days.map((day) => {
                const dow = day.getDay(); // 0=일, 6=토
                const isSun = dow === 0;
                const isSat = dow === 6;
                return (
                  <th
                    key={toDateStr(day)}
                    className={`border border-slate-200 px-1 py-1 text-center font-medium min-w-[52px] ${
                      isSun ? "text-red-500 bg-red-50" :
                      isSat ? "text-blue-500 bg-blue-50" :
                      "text-slate-600"
                    }`}
                  >
                    <div>{day.getDate()}</div>
                    <div className="text-[10px] font-normal">{DAY_OF_WEEK[dow]}</div>
                  </th>
                );
              })}

              {/* 우측 집계 헤더 */}
              <th className="border border-slate-200 px-2 py-2 text-center font-semibold text-slate-600 min-w-[44px] bg-slate-50">
                근무
              </th>
              <th className="border border-slate-200 px-2 py-2 text-center font-semibold text-slate-600 min-w-[44px] bg-slate-50">
                휴무
              </th>
              <th className="border border-slate-200 px-2 py-2 text-center font-semibold text-slate-600 min-w-[44px] bg-slate-50">
                월차
              </th>
            </tr>
          </thead>

          <tbody>
            {/* 정직원 섹션 */}
            {fullTimeEmployees.length > 0 && (
              <tr>
                <td
                  colSpan={days.length + 4}
                  className="px-3 py-1 bg-blue-50 text-[11px] font-semibold text-blue-600 border border-slate-200"
                >
                  정직원
                </td>
              </tr>
            )}

            {fullTimeEmployees.map((emp) => {
              const summary = getSummaryForEmployee(String(emp.id));
              return (
                <tr key={emp.id} className="hover:bg-slate-50">
                  {/* 직원 이름 (좌측 고정) */}
                  <td className="border border-slate-200 px-3 py-1 font-medium text-slate-700 sticky left-0 bg-white z-10 whitespace-nowrap">
                    <div>{emp.name}</div>
                    {emp.position && (
                      <div className="text-[10px] text-slate-400">{emp.position}</div>
                    )}
                  </td>

                  {/* 날짜별 상태 셀 */}
                  {days.map((day) => {
                    const dateStr = toDateStr(day);
                    const cellData = calendarData.attendance?.[String(emp.id)]?.[dateStr] || null;
                    return (
                      <CalendarCell
                        key={dateStr}
                        employeeId={emp.id}
                        dateStr={dateStr}
                        cellData={cellData}
                        onStatusChange={handleStatusChange}
                      />
                    );
                  })}

                  {/* 우측 집계 */}
                  <td className="border border-slate-200 px-2 py-1 text-center font-semibold text-green-700 bg-green-50">
                    {summary.workDays}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center font-semibold text-slate-500 bg-slate-50">
                    {summary.offDays}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center font-semibold text-blue-600 bg-blue-50">
                    {summary.annualDays}
                  </td>
                </tr>
              );
            })}

            {/* 아르바이트/3.3% 섹션 */}
            {partTimeEmployees.length > 0 && (
              <tr>
                <td
                  colSpan={days.length + 4}
                  className="px-3 py-1 bg-amber-50 text-[11px] font-semibold text-amber-600 border border-slate-200"
                >
                  아르바이트 / 3.3%
                </td>
              </tr>
            )}

            {partTimeEmployees.map((emp) => {
              const summary = getSummaryForEmployee(String(emp.id));
              return (
                <tr key={emp.id} className="hover:bg-slate-50">
                  {/* 직원 이름 (좌측 고정) */}
                  <td className="border border-slate-200 px-3 py-1 font-medium text-slate-700 sticky left-0 bg-white z-10 whitespace-nowrap">
                    <div>{emp.name}</div>
                    {emp.position && (
                      <div className="text-[10px] text-slate-400">{emp.position}</div>
                    )}
                  </td>

                  {/* 날짜별 상태 셀 */}
                  {days.map((day) => {
                    const dateStr = toDateStr(day);
                    const cellData = calendarData.attendance?.[String(emp.id)]?.[dateStr] || null;
                    return (
                      <CalendarCell
                        key={dateStr}
                        employeeId={emp.id}
                        dateStr={dateStr}
                        cellData={cellData}
                        onStatusChange={handleStatusChange}
                      />
                    );
                  })}

                  {/* 우측 집계 */}
                  <td className="border border-slate-200 px-2 py-1 text-center font-semibold text-green-700 bg-green-50">
                    {summary.workDays}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center font-semibold text-slate-500 bg-slate-50">
                    {summary.offDays}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center font-semibold text-blue-600 bg-blue-50">
                    {summary.annualDays}
                  </td>
                </tr>
              );
            })}

            {/* 하단 합계 행: 날짜별 근무 인원 수 */}
            <tr className="bg-slate-50 font-semibold">
              <td className="border border-slate-200 px-3 py-1 text-slate-600 sticky left-0 bg-slate-50 z-10">
                근무 인원
              </td>
              {days.map((day) => {
                const dateStr = toDateStr(day);
                const count = getWorkCountForDate(dateStr);
                return (
                  <td
                    key={dateStr}
                    className="border border-slate-200 px-1 py-1 text-center text-slate-700"
                  >
                    {count > 0 ? (
                      <span className="font-bold text-green-700">{count}</span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                );
              })}
              {/* 우측 집계 셀 (합계 행에서는 비워둠) */}
              <td className="border border-slate-200" />
              <td className="border border-slate-200" />
              <td className="border border-slate-200" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceCalendar;
