// ============================================================
// AttendanceCalendar.jsx — 월별 근무표 달력 컴포넌트
// 직원(행) × 날짜(열) 그리드로 출근 상태를 표시하고 수정합니다.
// ============================================================

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

// 백엔드 직원 API 기본 URL (로컬 전용)
const BASE_URL = "http://localhost:8000/api/employee";

// ─────────────────────────────────────────
// 출근 상태 정의
// ─────────────────────────────────────────

/** 9가지 출근 상태 목록 */
const STATUS_LIST = [
  { value: "work",             label: "출근",    bg: "bg-green-100",  text: "text-green-700"  },
  { value: "off",              label: "휴무",    bg: "bg-slate-100",  text: "text-slate-500"  },
  { value: "annual",           label: "연차",    bg: "bg-blue-100",   text: "text-blue-700"   },
  { value: "half_am",          label: "오전반차", bg: "bg-sky-100",    text: "text-sky-700"    },
  { value: "half_pm",          label: "오후반차", bg: "bg-sky-100",    text: "text-sky-700"    },
  { value: "absent",           label: "결근",    bg: "bg-red-100",    text: "text-red-700"    },
  { value: "early_leave",      label: "조퇴",    bg: "bg-orange-100", text: "text-orange-700" },
  { value: "recommended_off",  label: "권장휴무", bg: "bg-purple-100", text: "text-purple-700" },
  { value: "support",          label: "지원",    bg: "bg-yellow-100", text: "text-yellow-700" },
];

/** 상태 값으로 상태 객체를 조회합니다. */
function getStatusDef(value) {
  return STATUS_LIST.find((s) => s.value === value) || STATUS_LIST[1]; // 기본값: 휴무
}

// ─────────────────────────────────────────
// 셀 드롭다운 컴포넌트
// ─────────────────────────────────────────

/**
 * 셀 클릭 시 표시되는 상태 선택 드롭다운.
 * @param {object} props
 * @param {string} props.currentStatus - 현재 상태 값
 * @param {function} props.onSelect - 상태 선택 핸들러
 * @param {function} props.onClose - 드롭다운 닫기 핸들러
 */
const StatusDropdown = ({ currentStatus, onSelect, onClose }) => {
  const ref = useRef(null);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
    >
      {STATUS_LIST.map((s) => (
        <button
          key={s.value}
          onClick={() => onSelect(s.value)}
          className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-50 flex items-center gap-2 ${
            currentStatus === s.value ? "bg-slate-50 font-semibold" : ""
          }`}
        >
          {/* 상태 색상 점 */}
          <span className={`w-2 h-2 rounded-full ${s.bg.replace("bg-", "bg-").replace("-100", "-400")}`} />
          {s.label}
        </button>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────

/**
 * 월별 근무표 달력 컴포넌트.
 * @param {object} props
 * @param {number} props.year - 조회 연도 (EmployeePage에서 전달)
 * @param {number} props.month - 조회 월 (EmployeePage에서 전달)
 */
const AttendanceCalendar = ({ year, month }) => {
  // 달력 데이터 상태
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 현재 열려 있는 드롭다운 셀 위치 (employeeId + date 조합)
  const [openCell, setOpenCell] = useState(null); // { employeeId, date }

  // 상태 변경 중인 셀 (로딩 표시용)
  const [updatingCell, setUpdatingCell] = useState(null); // "empId_date"

  // ─────────────────────────────────────────
  // 달력 데이터 로드
  // ─────────────────────────────────────────

  useEffect(() => {
    const loadCalendar = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `${BASE_URL}/attendance/monthly-calendar?year=${year}&month=${month}`
        );
        if (!res.ok) throw new Error("달력 데이터를 불러오지 못했습니다.");
        const data = await res.json();
        setCalendarData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadCalendar();
  }, [year, month]);

  // ─────────────────────────────────────────
  // 상태 변경 처리
  // ─────────────────────────────────────────

  /**
   * 특정 직원의 특정 날짜 출근 상태를 변경합니다.
   * @param {number} recordId - 출퇴근 기록 ID
   * @param {number} employeeId - 직원 ID
   * @param {string} date - 날짜 (YYYY-MM-DD)
   * @param {string} newStatus - 새 상태 값
   */
  const handleStatusChange = async (recordId, employeeId, date, newStatus) => {
    const cellKey = `${employeeId}_${date}`;
    setOpenCell(null);
    setUpdatingCell(cellKey);

    try {
      const res = await fetch(`${BASE_URL}/attendance/${recordId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_status: newStatus }),
      });
      if (!res.ok) throw new Error("상태 변경에 실패했습니다.");

      // 로컬 상태 업데이트 (리로드 없이)
      setCalendarData((prev) => ({
        ...prev,
        employees: prev.employees.map((emp) => {
          if (emp.id !== employeeId) return emp;
          return {
            ...emp,
            records: emp.records.map((rec) =>
              rec.date === date ? { ...rec, status: newStatus } : rec
            ),
          };
        }),
      }));
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdatingCell(null);
    }
  };

  // ─────────────────────────────────────────
  // 월별 집계 계산
  // ─────────────────────────────────────────

  /**
   * 직원의 월별 상태 집계를 계산합니다.
   * @param {Array} records - 출퇴근 기록 배열
   * @returns {{ work: number, off: number, annual: number }}
   */
  const calcSummary = (records) => {
    return records.reduce(
      (acc, rec) => {
        if (rec.status === "work") acc.work++;
        else if (rec.status === "off") acc.off++;
        else if (rec.status === "annual") acc.annual++;
        return acc;
      },
      { work: 0, off: 0, annual: 0 }
    );
  };

  // ─────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        달력 데이터를 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-500">
        <p className="font-medium">{error}</p>
      </div>
    );
  }

  if (!calendarData || calendarData.employees.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400">
        등록된 직원이 없습니다.
      </div>
    );
  }

  const { days, employees } = calendarData;

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* 상단 안내 */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">
          {year}년 {month}월 근무표
        </h2>
        <p className="text-xs text-slate-400">셀을 클릭하여 상태를 변경하세요.</p>
      </div>

      {/* 가로 스크롤 가능한 그리드 */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {/* 직원 이름 열 헤더 */}
              <th className="sticky left-0 z-10 bg-slate-50 text-left px-4 py-3 font-semibold text-slate-600 min-w-[120px] border-r border-slate-200">
                직원
              </th>
              {/* 날짜 열 헤더 */}
              {days.map((day) => {
                // 요일 계산 (0=일, 6=토)
                const d = new Date(day);
                const dow = d.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"];
                return (
                  <th
                    key={day}
                    className={`text-center px-1 py-2 font-medium min-w-[44px] ${
                      isWeekend ? "text-red-400" : "text-slate-500"
                    }`}
                  >
                    <div>{parseInt(day.split("-")[2])}</div>
                    <div className="text-[10px] opacity-70">{DOW_KR[dow]}</div>
                  </th>
                );
              })}
              {/* 집계 열 헤더 */}
              <th className="text-center px-3 py-3 font-semibold text-slate-600 min-w-[90px] border-l border-slate-200 bg-slate-50">
                출근/휴무/연차
              </th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              // records를 날짜 키로 인덱싱
              const recordMap = {};
              emp.records.forEach((rec) => {
                recordMap[rec.date] = rec;
              });

              // 월별 집계
              const summary = calcSummary(emp.records);

              return (
                <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  {/* 직원 이름 + 파트 */}
                  <td className="sticky left-0 z-10 bg-white border-r border-slate-100 px-4 py-2 hover:bg-slate-50/50">
                    <div className="font-medium text-slate-800">{emp.name}</div>
                    <div className="text-[10px] text-slate-400">{emp.work_part}</div>
                  </td>

                  {/* 날짜별 상태 셀 */}
                  {days.map((day) => {
                    const rec = recordMap[day];
                    const status = rec?.status || "off";
                    const statusDef = getStatusDef(status);
                    const cellKey = `${emp.id}_${day}`;
                    const isUpdating = updatingCell === cellKey;
                    const isOpen =
                      openCell?.employeeId === emp.id && openCell?.date === day;

                    return (
                      <td key={day} className="text-center px-1 py-1.5 relative">
                        {/* 상태 배지 버튼 */}
                        <button
                          onClick={() => {
                            if (!rec) return; // 기록 없으면 클릭 불가
                            setOpenCell(isOpen ? null : { employeeId: emp.id, date: day });
                          }}
                          disabled={isUpdating || !rec}
                          className={`w-full rounded px-1 py-1 text-[10px] font-medium transition-opacity ${
                            statusDef.bg
                          } ${statusDef.text} ${
                            rec ? "cursor-pointer hover:opacity-80" : "cursor-default opacity-30"
                          } ${isUpdating ? "opacity-50" : ""}`}
                          title={rec ? statusDef.label : "기록 없음"}
                        >
                          {isUpdating ? "..." : statusDef.label}
                        </button>

                        {/* 상태 선택 드롭다운 */}
                        {isOpen && (
                          <StatusDropdown
                            currentStatus={status}
                            onSelect={(newStatus) =>
                              handleStatusChange(rec.id, emp.id, day, newStatus)
                            }
                            onClose={() => setOpenCell(null)}
                          />
                        )}
                      </td>
                    );
                  })}

                  {/* 월별 집계 열 */}
                  <td className="text-center px-3 py-2 border-l border-slate-100 whitespace-nowrap">
                    <span className="text-green-600 font-semibold">{summary.work}</span>
                    <span className="text-slate-300 mx-1">/</span>
                    <span className="text-slate-500">{summary.off}</span>
                    <span className="text-slate-300 mx-1">/</span>
                    <span className="text-blue-600">{summary.annual}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 범례 */}
      <div className="px-6 py-3 border-t border-slate-100 flex flex-wrap gap-3">
        {STATUS_LIST.map((s) => (
          <span key={s.value} className="flex items-center gap-1 text-[11px]">
            <span className={`w-2.5 h-2.5 rounded-sm ${s.bg}`} />
            <span className={s.text}>{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

export default AttendanceCalendar;
