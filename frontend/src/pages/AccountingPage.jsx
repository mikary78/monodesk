// ============================================================
// AccountingPage.jsx - 세무/회계 관리 메인 페이지
// 8개 탭 - 매출/지출/손익/지분/리포트 + 일일마감/고정비설정/월별고정비
// ※ 일일마감·고정비 탭은 운영관리(OperationsPage)에서 이동됨
// ============================================================

import { useState } from "react";
import { DollarSign, ChevronLeft, ChevronRight, TrendingUp, List, BarChart2, Users, FileText, Wallet, Settings } from "lucide-react";
import ProfitLossCard    from "../components/modules/accounting/ProfitLossCard";
import SalesList         from "../components/modules/accounting/SalesList";
import ExpenseList       from "../components/modules/accounting/ExpenseList";
import DividendSimulation from "../components/modules/accounting/DividendSimulation";
import MonthlyReport     from "../components/modules/accounting/MonthlyReport";
import DailyClosingForm  from "../components/modules/operations/DailyClosingForm";
import FixedCostSettings from "../components/modules/operations/FixedCostSettings";
import FixedCostMonthly  from "../components/modules/operations/FixedCostMonthly";

// 8개 탭 메뉴 정의 (기존 5개 + 운영관리에서 이동한 3개)
const TABS = [
  { id: "sales",         label: "매출 관리",   Icon: TrendingUp },
  { id: "expenses",      label: "지출 관리",   Icon: List       },
  { id: "overview",      label: "손익 현황",   Icon: BarChart2  },
  { id: "dividend",      label: "지분 정산",   Icon: Users      },
  { id: "report",        label: "리포트 출력", Icon: FileText   },
  { id: "closing",       label: "일일마감",    Icon: Wallet     },
  { id: "fixed-setup",   label: "고정비 설정", Icon: Settings   },
  { id: "fixed-monthly", label: "월별 고정비", Icon: BarChart2  },
];

const AccountingPage = () => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [activeTab, setActiveTab] = useState("sales");

  const handlePrevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else { setMonth((m) => m - 1); }
  };

  const handleNextMonth = () => {
    const isCurrent = year === today.getFullYear() && month === today.getMonth() + 1;
    if (isCurrent) return;
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else { setMonth((m) => m + 1); }
  };

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  return (
    <div className="p-8 bg-slate-50 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <DollarSign size={24} className="text-blue-500" />
          <h1 className="text-2xl font-bold text-slate-900">세무/회계 관리</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrevMonth}
            className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white transition-colors"
            title="이전 달">
            <ChevronLeft size={16} className="text-slate-500" />
          </button>
          <div className="h-9 px-4 flex items-center border border-slate-200 rounded-md bg-white text-sm font-semibold text-slate-900 min-w-[120px] justify-center">
            {year}년 {month}월
          </div>
          <button onClick={handleNextMonth} disabled={isCurrentMonth}
            className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="다음 달">
            <ChevronRight size={16} className="text-slate-500" />
          </button>
        </div>
      </div>

      {/* 5개 탭 네비게이션 */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={activeTab === id ? "flex items-center gap-2 h-10 px-4 text-sm font-medium border-b-2 border-blue-500 text-blue-500" : "flex items-center gap-2 h-10 px-4 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700"}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div>
        {/* 매출 관리 탭 */}
        {activeTab === "sales" && (
          <SalesList year={year} month={month} />
        )}

        {/* 지출 관리 탭 */}
        {activeTab === "expenses" && (
          <ExpenseList year={year} month={month} />
        )}

        {/* 손익 현황 탭 */}
        {activeTab === "overview" && (
          <ProfitLossCard year={year} month={month} />
        )}

        {/* 지분 정산 탭 */}
        {activeTab === "dividend" && (
          <DividendSimulation year={year} month={month} />
        )}

        {/* 리포트 출력 탭 */}
        {activeTab === "report" && (
          <MonthlyReport year={year} month={month} />
        )}

        {/* 일일마감 탭 — 운영관리에서 이동 */}
        {activeTab === "closing" && (
          <DailyClosingForm />
        )}

        {/* 고정비 설정 탭 — 운영관리에서 이동 */}
        {activeTab === "fixed-setup" && (
          <FixedCostSettings />
        )}

        {/* 월별 고정비 탭 — 운영관리에서 이동 */}
        {activeTab === "fixed-monthly" && (
          <FixedCostMonthly year={year} month={month} />
        )}
      </div>
    </div>
  );
};

export default AccountingPage;
