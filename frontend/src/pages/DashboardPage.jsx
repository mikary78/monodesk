// ============================================================
// DashboardPage.jsx — 대시보드 메인 페이지
// 일별/주별/월별 뷰 전환을 지원하는 통합 현황판입니다.
// 각 뷰는 독립적인 컴포넌트(DailyDashboard/WeeklyDashboard/MonthlyDashboard)로 구성됩니다.
// ============================================================

import { useState } from "react";
import { LayoutDashboard } from "lucide-react";
import DailyDashboard from "../components/modules/dashboard/DailyDashboard";
import WeeklyDashboard from "../components/modules/dashboard/WeeklyDashboard";
import MonthlyDashboard from "../components/modules/dashboard/MonthlyDashboard";

// 뷰 전환 탭 정의
const VIEW_TABS = [
  { key: "daily", label: "일별" },
  { key: "weekly", label: "주별" },
  { key: "monthly", label: "월별" },
];

/**
 * 대시보드 메인 페이지 컴포넌트.
 * 상단 뷰 토글로 일별/주별/월별 뷰를 전환합니다.
 * 각 뷰 컴포넌트는 자체적으로 날짜/기간 상태를 관리합니다.
 */
const DashboardPage = () => {
  // 현재 선택된 뷰 ('daily' | 'weekly' | 'monthly')
  const [activeView, setActiveView] = useState("daily");

  return (
    <div className="p-8 bg-slate-50 min-h-full">
      {/* ─── 페이지 헤더 ─── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LayoutDashboard size={24} className="text-blue-500" />
          <h1 className="text-2xl font-bold text-slate-900">대시보드</h1>
          <span className="text-sm text-slate-400">여남동 운영 현황</span>
        </div>

        {/* ─── 뷰 전환 토글 ─── */}
        <div className="flex items-center bg-slate-100 rounded-lg p-1">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveView(tab.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeView === tab.key
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 뷰 렌더링 ─── */}
      {activeView === "daily" && <DailyDashboard />}
      {activeView === "weekly" && <WeeklyDashboard />}
      {activeView === "monthly" && <MonthlyDashboard />}
    </div>
  );
};

export default DashboardPage;
