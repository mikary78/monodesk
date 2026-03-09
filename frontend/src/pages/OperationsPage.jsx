// ============================================================
// OperationsPage.jsx — 운영 관리 메인 페이지 (Step 8, 마지막 모듈)
// 4개 탭: 공지사항 / 위생점검 / 영업일 관리 / 업무 체크리스트
// ============================================================

import { useState } from "react";
import {
  ClipboardList,
  Bell,
  ShieldCheck,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import NoticeBoard          from "../components/modules/operations/NoticeBoard";
import HygieneCheck         from "../components/modules/operations/HygieneCheck";
import BusinessCalendar     from "../components/modules/operations/BusinessCalendar";
import TaskChecklistPanel   from "../components/modules/operations/TaskChecklistPanel";

// 4개 탭 정의
const TABS = [
  { id: "notices",   label: "공지사항",       Icon: Bell         },
  { id: "hygiene",   label: "위생 점검",       Icon: ShieldCheck  },
  { id: "calendar",  label: "영업일 관리",      Icon: CalendarDays },
  { id: "tasks",     label: "업무 체크리스트",  Icon: CheckSquare  },
];

const OperationsPage = () => {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [activeTab, setActiveTab] = useState("notices");

  // 이전 달 이동
  const handlePrevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else { setMonth((m) => m - 1); }
  };

  // 다음 달 이동 (현재 달 이후 불가)
  const handleNextMonth = () => {
    const isCurrent = year === today.getFullYear() && month === today.getMonth() + 1;
    if (isCurrent) return;
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else { setMonth((m) => m + 1); }
  };

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  // 영업일 탭에서만 월 네비게이터가 의미 있음
  const showMonthNav = activeTab === "calendar";

  return (
    <div className="p-8 bg-slate-50 min-h-full">
      {/* ── 페이지 헤더 ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList size={24} className="text-blue-500" />
          <h1 className="text-2xl font-bold text-slate-900">운영 관리</h1>
        </div>

        {/* 월 네비게이터 — 영업일 탭에서만 활성 */}
        {showMonthNav && (
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

      {/* ── 탭 네비게이션 ── */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map(({ id, label, Icon }) => (
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

      {/* ── 탭 콘텐츠 ── */}
      <div>
        {/* 공지사항 탭 */}
        {activeTab === "notices" && (
          <NoticeBoard />
        )}

        {/* 위생 점검 탭 */}
        {activeTab === "hygiene" && (
          <HygieneCheck />
        )}

        {/* 영업일 관리 탭 */}
        {activeTab === "calendar" && (
          <BusinessCalendar year={year} month={month} />
        )}

        {/* 업무 체크리스트 탭 */}
        {activeTab === "tasks" && (
          <TaskChecklistPanel />
        )}
      </div>
    </div>
  );
};

export default OperationsPage;
