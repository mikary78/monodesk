// ============================================================
// AttendanceCalendar.jsx — 주별 근무표 컴포넌트 (전면 재작성)
// 직원(행) × 날짜(열) 주별 그리드로 출근 상태를 표시하고 수정합니다.
// 셀 클릭: 상태 선택 드롭다운 / 우클릭: 메모 입력 팝오버
// ============================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { getWeeklyAttendance, bulkUpdateAttendance } from "../../../api/employeeApi";

// ─────────────────────────────────────────
// 출근 상태 정의 (명세 기준 색상 포함)
// ─────────────────────────────────────────

/** 근태 상태 정의 목록 — 동적 style로 색상 적용 */
const STATUS_LIST = [
  { value: "work",             label: "근무",      bg: "#E8F5E9", color: "#2E7D32" },
  { value: "off",              label: "휴무",      bg: "#F5F5F5", color: "#757575" },
  { value: "annual_leave",     label: "월차",      bg: "#E3F2FD", color: "#1565C0" },
  { value: "half_am",          label: "반차(오전)", bg: "#E1F5FE", color: "#0277BD" },
  { value: "half_pm",          label: "반차(오후)", bg: "#E1F5FE", color: "#0277BD" },
  { value: "absent",           label: "무단결근",  bg: "#FFEBEE", color: "#C62828" },
  { value: "early_leave",      label: "조퇴",      bg: "#FFF3E0", color: "#E65100" },
  { value: "recommended_off",  label: "권장휴무",  bg: "#F3E5F5", color: "#6A1B9A" },
];

/** null 상태(미입력)의 기본 스타일 */
const NULL_STYLE = { bg: "#FFFFFF", color: "#BDBDBD" };

/** 상태 값으로 스타일 객체를 반환합니다. */
function getStatusStyle(value) {
  return STATUS_LIST.find((s) => s.value === value) || null;
}

/** 오늘 날짜 문자열 (YYYY-MM-DD) — 로컬 타임존 기준 */
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Date 객체를 YYYY-MM-DD 문자열로 변환합니다. — 로컬 타임존 기준
 * toISOString()은 UTC 변환으로 UTC+9에서 날짜가 하루 앞당겨지므로 사용 금지.
 */
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD → Date 객체 변환 (시간대 오프셋 방지) */
function parseLocalDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ─────────────────────────────────────────
// 상태 선택 드롭다운 컴포넌트
// ─────────────────────────────────────────

/**
 * 셀 클릭 시 표시되는 상태 선택 드롭다운.
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
      className="absolute z-50 top-full left-0 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
    >
      {/* 미입력(초기화) 옵션 */}
      <button
        onClick={() => onSelect(null)}
        className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-50 flex items-center gap-2 ${
          currentStatus === null ? "bg-slate-50 font-semibold" : ""
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-slate-200" />
        미입력
      </button>
      {STATUS_LIST.map((s) => (
        <button
          key={s.value}
          onClick={() => onSelect(s.value)}
          className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-50 flex items-center gap-2 ${
            currentStatus === s.value ? "bg-slate-50 font-semibold" : ""
          }`}
        >
          {/* 상태 색상 점 */}
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: s.color }}
          />
          {s.label}
        </button>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────
// 메모 팝오버 컴포넌트
// ─────────────────────────────────────────

/**
 * 우클릭 시 표시되는 메모 입력 팝오버.
 */
const MemoPopover = ({ currentMemo, onSave, onClose }) => {
  const ref = useRef(null);
  const [memo, setMemo] = useState(currentMemo || "");

  // 팝오버 외부 클릭 시 닫기
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
      className="absolute z-50 top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-medium text-slate-600 mb-1.5">메모</p>
      <textarea
        className="w-full text-xs border border-slate-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
        rows={3}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="메모를 입력하세요"
        autoFocus
      />
      <div className="flex justify-end gap-1.5 mt-2">
        <button
          onClick={onClose}
          className="text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-50"
        >
          취소
        </button>
        <button
          onClick={() => onSave(memo)}
          className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          저장
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────

/**
 * 주별 근무표 컴포넌트.
 * @param {object} props
 * @param {number} props.year - 초기 연도 (EmployeePage에서 전달, 현재 주 계산에 활용)
 * @param {number} props.month - 초기 월
 */
const AttendanceCalendar = ({ year, month }) => {
  // 현재 조회 기준 날짜 (이 날짜가 속한 주를 표시)
  const [currentDate, setCurrentDate] = useState(() => {
    // 초기값: 오늘 날짜
    return todayStr();
  });

  // 주별 데이터 상태
  const [weekData, setWeekData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 열려 있는 드롭다운 셀 키 ("empId_date")
  const [openDropdown, setOpenDropdown] = useState(null);

  // 열려 있는 메모 팝오버 셀 키 ("empId_date")
  const [openMemo, setOpenMemo] = useState(null);

  // 저장 중인 셀 키 집합
  const [savingCells, setSavingCells] = useState(new Set());

  // ─────────────────────────────────────────
  // 데이터 로드
  // ─────────────────────────────────────────

  const loadWeekData = useCallback(async (dateStr) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getWeeklyAttendance(dateStr);
      setWeekData(data);
    } catch (err) {
      setError(err.message || "주별 근태 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWeekData(currentDate);
  }, [currentDate, loadWeekData]);

  // ─────────────────────────────────────────
  // 주 네비게이션
  // ─────────────────────────────────────────

  /** 이전 주로 이동 */
  const goToPrevWeek = () => {
    const d = parseLocalDate(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(toDateStr(d));
  };

  /** 다음 주로 이동 */
  const goToNextWeek = () => {
    const d = parseLocalDate(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(toDateStr(d));
  };

  /** 이번 주로 이동 */
  const goToThisWeek = () => {
    setCurrentDate(todayStr());
  };

  // ─────────────────────────────────────────
  // 상태 변경 처리
  // ─────────────────────────────────────────

  /**
   * 특정 직원+날짜 셀의 상태와 메모를 변경하고 bulk API로 저장합니다.
   */
  const handleCellUpdate = async (employeeId, date, newStatus, newMemo) => {
    const cellKey = `${employeeId}_${date}`;
    setOpenDropdown(null);
    setOpenMemo(null);
    setSavingCells((prev) => new Set(prev).add(cellKey));

    // 로컬 상태 즉시 업데이트 (Optimistic UI)
    setWeekData((prev) => {
      if (!prev) return prev;
      const empIdStr = String(employeeId);
      const prevAttendance = prev.attendance[empIdStr] || {};
      const prevCell = prevAttendance[date] || { status: null, memo: null };
      return {
        ...prev,
        attendance: {
          ...prev.attendance,
          [empIdStr]: {
            ...prevAttendance,
            [date]: {
              status: newStatus !== undefined ? newStatus : prevCell.status,
              memo: newMemo !== undefined ? newMemo : prevCell.memo,
            },
          },
        },
      };
    });

    try {
      await bulkUpdateAttendance([
        {
          employee_id: employeeId,
          date: date,
          status: newStatus !== undefined ? newStatus : weekData?.attendance?.[String(employeeId)]?.[date]?.status,
          memo: newMemo !== undefined ? newMemo : weekData?.attendance?.[String(employeeId)]?.[date]?.memo,
        },
      ]);
    } catch (err) {
      alert(`저장 중 오류가 발생했습니다: ${err.message}`);
      // 실패 시 데이터 다시 로드
      loadWeekData(currentDate);
    } finally {
      setSavingCells((prev) => {
        const next = new Set(prev);
        next.delete(cellKey);
        return next;
      });
    }
  };

  // ─────────────────────────────────────────
  // 집계 계산
  // ─────────────────────────────────────────

  /**
   * 직원의 주간 근무일수를 계산합니다.
   * status === 'work'인 날짜 수를 카운트합니다.
   */
  const calcEmployeeWorkDays = (empIdStr, weekDates) => {
    const empData = weekData?.attendance?.[empIdStr] || {};
    return weekDates.filter((d) => empData[d]?.status === "work").length;
  };

  /**
   * 날짜별 근무 인원수를 계산합니다.
   */
  const calcDailyWorkCount = (date) => {
    if (!weekData) return 0;
    return Object.values(weekData.attendance).filter(
      (empData) => empData[date]?.status === "work"
    ).length;
  };

  // ─────────────────────────────────────────
  // 헤더 문자열 계산
  // ─────────────────────────────────────────

  const headerLabel = weekData
    ? `${weekData.year}년 ${weekData.month}월 ${weekData.week_number}주차 (${weekData.week_start.slice(5).replace("-", "/")}~${weekData.week_end.slice(5).replace("-", "/")})`
    : "근무표 불러오는 중...";

  // 요일 레이블
  const DOW_KR = ["월", "화", "수", "목", "금", "토", "일"];

  // 주 날짜 목록 (week_start부터 7일)
  const weekDates = weekData
    ? Array.from({ length: 7 }, (_, i) => {
        const d = parseLocalDate(weekData.week_start);
        d.setDate(d.getDate() + i);
        return toDateStr(d);
      })
    : [];

  // 오늘 날짜 문자열
  const today = todayStr();

  // ─────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        근무표 데이터를 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-500">
        <p className="font-medium">{error}</p>
        <button
          onClick={() => loadWeekData(currentDate)}
          className="mt-3 text-sm text-blue-500 underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!weekData || weekData.employees.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400">
        등록된 직원이 없습니다.
      </div>
    );
  }

  const { employees } = weekData;

  // 직무(role)별 한국어 이름 매핑 및 정렬 순서
  const ROLE_LABEL = {
    kitchen: "주방",
    hall: "홀",
    management: "관리",
    other: "기타",
  };
  const ROLE_ORDER = ["kitchen", "hall", "management", "other"];

  // 직무별로 직원 그룹핑 (정렬 순서 유지)
  const roleGroups = {};
  ROLE_ORDER.forEach((r) => { roleGroups[r] = []; });
  employees.forEach((emp) => {
    const r = emp.role && roleGroups[emp.role] !== undefined ? emp.role : "other";
    roleGroups[r].push(emp);
  });
  // 직원이 없는 그룹 제거
  const activeRoleGroups = Object.entries(roleGroups).filter(([, list]) => list.length > 0);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* ─── 상단 네비게이션 ─── */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {/* 이전 주 */}
          <button
            onClick={goToPrevWeek}
            className="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 transition-colors"
            title="이전 주"
          >
            <ChevronLeft size={16} className="text-slate-600" />
          </button>

          {/* 현재 주차 레이블 */}
          <h2 className="text-sm font-semibold text-slate-700 min-w-[260px] text-center">
            {headerLabel}
          </h2>

          {/* 다음 주 */}
          <button
            onClick={goToNextWeek}
            className="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 transition-colors"
            title="다음 주"
          >
            <ChevronRight size={16} className="text-slate-600" />
          </button>

          {/* 이번 주 */}
          <button
            onClick={goToThisWeek}
            className="h-8 px-3 text-xs font-medium flex items-center gap-1 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors text-slate-600"
          >
            <Calendar size={13} />
            이번 주
          </button>
        </div>

        <p className="text-xs text-slate-400">셀 클릭: 상태 변경 / 우클릭: 메모</p>
      </div>

      {/* ─── 근무표 테이블 ─── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {/* 직원 이름 열 헤더 */}
              <th className="sticky left-0 z-10 bg-slate-50 text-left px-4 py-3 font-semibold text-slate-600 min-w-[120px] border-r border-slate-200">
                직원
              </th>

              {/* 날짜 열 헤더 (월~일) */}
              {weekDates.map((dateStr, idx) => {
                const isToday = dateStr === today;
                // 토(5), 일(6) 색상 구분
                const isWeekend = idx >= 5;
                const dayNum = parseInt(dateStr.split("-")[2]);
                return (
                  <th
                    key={dateStr}
                    className={`text-center px-1 py-2 font-medium min-w-[60px] ${
                      isWeekend ? "text-red-400" : "text-slate-500"
                    } ${isToday ? "bg-blue-50" : ""}`}
                  >
                    <div className={`font-semibold ${isToday ? "text-blue-600" : ""}`}>
                      {dayNum}
                    </div>
                    <div className="text-[10px] opacity-70">{DOW_KR[idx]}</div>
                  </th>
                );
              })}

              {/* 주간 합계 열 헤더 */}
              <th className="text-center px-3 py-3 font-semibold text-slate-600 min-w-[70px] border-l border-slate-200 bg-slate-50">
                합계
              </th>
            </tr>
          </thead>

          <tbody>
            {/* 직무별 섹션 구분 */}
            {activeRoleGroups.map(([role, groupEmployees]) => (
              <>
                {/* 섹션 구분 행 */}
                <tr key={`section-${role}`} className="bg-slate-50/70">
                  <td
                    colSpan={weekDates.length + 2}
                    className="px-4 py-1.5 text-[11px] font-semibold text-slate-500 border-y border-slate-100"
                  >
                    {ROLE_LABEL[role] || role}
                  </td>
                </tr>

                {/* 직원 행 */}
                {groupEmployees.map((emp) => {
                  const empIdStr = String(emp.id);
                  const workDays = calcEmployeeWorkDays(empIdStr, weekDates);

                  return (
                    <tr
                      key={emp.id}
                      className="border-b border-slate-100 hover:bg-slate-50/50"
                    >
                      {/* 직원 이름 + 파트 */}
                      <td className="sticky left-0 z-10 bg-white border-r border-slate-100 px-4 py-2 hover:bg-slate-50/50">
                        <div className="font-medium text-slate-800">{emp.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {emp.role === "hall" ? "홀" : emp.role === "kitchen" ? "주방" : emp.role === "management" ? "관리" : emp.role}
                        </div>
                      </td>

                      {/* 날짜별 상태 셀 */}
                      {weekDates.map((dateStr) => {
                        const cellData = weekData.attendance?.[empIdStr]?.[dateStr] || { status: null, memo: null };
                        const status = cellData.status;
                        const memo = cellData.memo;
                        const cellKey = `${emp.id}_${dateStr}`;
                        const isSaving = savingCells.has(cellKey);
                        const isDropdownOpen = openDropdown === cellKey;
                        const isMemoOpen = openMemo === cellKey;
                        const isToday = dateStr === today;

                        // 상태별 스타일
                        const style = status ? getStatusStyle(status) : null;
                        const bgColor = style ? style.bg : NULL_STYLE.bg;
                        const textColor = style ? style.color : NULL_STYLE.color;
                        const label = style ? style.label : "미입력";

                        return (
                          <td
                            key={dateStr}
                            className={`text-center px-1 py-1.5 relative ${
                              isToday ? "bg-blue-50/50" : ""
                            }`}
                          >
                            {/* 상태 배지 버튼 — 클릭 시 드롭다운 */}
                            <button
                              onClick={() => {
                                setOpenMemo(null);
                                setOpenDropdown(isDropdownOpen ? null : cellKey);
                              }}
                              onContextMenu={(e) => {
                                // 우클릭: 메모 팝오버
                                e.preventDefault();
                                setOpenDropdown(null);
                                setOpenMemo(isMemoOpen ? null : cellKey);
                              }}
                              disabled={isSaving}
                              className="w-full rounded px-1 py-1 text-[10px] font-medium transition-opacity hover:opacity-80"
                              style={{ backgroundColor: bgColor, color: textColor }}
                              title={memo ? `메모: ${memo}` : label}
                            >
                              {isSaving ? "..." : label}
                              {/* 메모 있으면 작은 점 표시 */}
                              {memo && !isSaving && (
                                <span
                                  className="inline-block w-1 h-1 rounded-full ml-0.5 align-middle"
                                  style={{ backgroundColor: textColor }}
                                />
                              )}
                            </button>

                            {/* 상태 선택 드롭다운 */}
                            {isDropdownOpen && (
                              <StatusDropdown
                                currentStatus={status}
                                onSelect={(newStatus) =>
                                  handleCellUpdate(emp.id, dateStr, newStatus, undefined)
                                }
                                onClose={() => setOpenDropdown(null)}
                              />
                            )}

                            {/* 메모 팝오버 */}
                            {isMemoOpen && (
                              <MemoPopover
                                currentMemo={memo}
                                onSave={(newMemo) =>
                                  handleCellUpdate(emp.id, dateStr, undefined, newMemo)
                                }
                                onClose={() => setOpenMemo(null)}
                              />
                            )}
                          </td>
                        );
                      })}

                      {/* 주간 합계 열 (근무일/7일) */}
                      <td className="text-center px-3 py-2 border-l border-slate-100 whitespace-nowrap">
                        <span className="text-green-600 font-semibold">{workDays}</span>
                        <span className="text-slate-400 text-[10px]"> / 7일</span>
                      </td>
                    </tr>
                  );
                })}
              </>
            ))}

            {/* 날짜별 근무 인원 합계 행 */}
            <tr className="border-t-2 border-slate-200 bg-slate-50">
              <td className="sticky left-0 z-10 bg-slate-50 px-4 py-2 font-semibold text-slate-600 border-r border-slate-200">
                근무 인원
              </td>
              {weekDates.map((dateStr) => {
                const count = calcDailyWorkCount(dateStr);
                const isToday = dateStr === today;
                return (
                  <td
                    key={dateStr}
                    className={`text-center px-1 py-2 font-semibold ${
                      isToday ? "bg-blue-50 text-blue-600" : "text-slate-600"
                    }`}
                  >
                    {count > 0 ? count : <span className="text-slate-300">-</span>}
                  </td>
                );
              })}
              <td className="border-l border-slate-200" />
            </tr>
          </tbody>
        </table>
      </div>

      {/* ─── 범례 ─── */}
      <div className="px-6 py-3 border-t border-slate-100 flex flex-wrap gap-3">
        {/* 미입력 범례 */}
        <span className="flex items-center gap-1 text-[11px]">
          <span
            className="w-2.5 h-2.5 rounded-sm border border-slate-200"
            style={{ backgroundColor: NULL_STYLE.bg }}
          />
          <span style={{ color: NULL_STYLE.color }}>미입력</span>
        </span>

        {STATUS_LIST.map((s) => (
          <span key={s.value} className="flex items-center gap-1 text-[11px]">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: s.bg }}
            />
            <span style={{ color: s.color }}>{s.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

export default AttendanceCalendar;
