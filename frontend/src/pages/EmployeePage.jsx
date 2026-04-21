// ============================================================
// EmployeePage.jsx — 직원 관리 메인 페이지
// 4개 탭: 직원 목록 / 출퇴근 관리 / 급여 정산 / 근무표 달력
// staff 역할: 근무표 달력 탭만 표시 (초기 탭도 calendar)
// admin/manager: 4개 탭 모두 표시 (초기 탭 employees)
// ============================================================

import { useState } from "react";
import { Users, ChevronLeft, ChevronRight, UserCheck, Clock, DollarSign, Calendar } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import EmployeeList from "../components/modules/employee/EmployeeList";
import AttendanceList from "../components/modules/employee/AttendanceList";
import SalaryPanel from "../components/modules/employee/SalaryPanel";
import AttendanceCalendar from "../components/modules/employee/AttendanceCalendar";

// 탭 메뉴 정의
const TABS = [
  { id: "employees",  label: "직원 목록",   Icon: UserCheck },
  { id: "attendance", label: "출퇴근 관리", Icon: Clock },
  { id: "salary",     label: "급여 정산",   Icon: DollarSign },
  { id: "calendar",   label: "근무표 달력", Icon: Calendar },
];

const EmployeePage = () => {
  const today = new Date();
  const { user } = useAuth();

  // staff 역할 여부 — 근무표 달력 탭만 접근 가능
  const isStaff = user?.role === "staff";

  // 현재 선택된 연도/월 상태
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  // 현재 활성 탭 — staff면 calendar, 그 외는 employees
  const [activeTab, setActiveTab] = useState(isStaff ? "calendar" : "employees");

  // 표시할 탭 목록 — staff는 근무표 달력만, 그 외는 전체
  const visibleTabs = isStaff
    ? TABS.filter((t) => t.id === "calendar")
    : TABS;

  /**
   * 이전 달로 이동
   */
  const handlePrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  /**
   * 다음 달로 이동 (당월 이후 불가)
   */
  const handleNextMonth = () => {
    const isCurrent = year === today.getFullYear() && month === today.getMonth() + 1;
    if (isCurrent) return;
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // 현재 달 여부 (다음 달 이동 비활성화용)
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  // 직원 목록 탭은 월 선택 불필요
  const showMonthSelector = activeTab !== "employees";

  return (
    <div className="p-8 bg-slate-50 min-h-full">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users size={24} className="text-blue-500" />
          <h1 className="text-2xl font-bold text-slate-900">직원 관리</h1>
        </div>

        {/* 연도/월 선택기 (출퇴근/급여 탭에서만 표시) */}
        {showMonthSelector && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white transition-colors"
              title="이전 달"
            >
              <ChevronLeft size={16} className="text-slate-500" />
            </button>
            <div className="h-9 px-4 flex items-center border border-slate-200 rounded-md bg-white text-sm font-semibold text-slate-900 min-w-[120px] justify-center">
              {year}년 {month}월
            </div>
            <button
              onClick={handleNextMonth}
              disabled={isCurrentMonth}
              className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="다음 달"
            >
              <ChevronRight size={16} className="text-slate-500" />
            </button>
          </div>
        )}
      </div>

      {/* 탭 네비게이션 — staff는 근무표 달력 탭만 렌더링 */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {visibleTabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={
              activeTab === id
                ? "flex items-center gap-2 h-10 px-4 text-sm font-medium border-b-2 border-blue-500 text-blue-500"
                : "flex items-center gap-2 h-10 px-4 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700"
            }
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div>
        {/* 직원 목록 탭 */}
        {activeTab === "employees" && <EmployeeList />}

        {/* 출퇴근 관리 탭 */}
        {activeTab === "attendance" && (
          <AttendanceList year={year} month={month} />
        )}

        {/* 급여 정산 탭 */}
        {activeTab === "salary" && (
          <SalaryPanel year={year} month={month} />
        )}

        {/* 근무표 달력 탭 */}
        {activeTab === "calendar" && (
          <AttendanceCalendar year={year} month={month} />
        )}
      </div>
    </div>
  );
};

export default EmployeePage;
