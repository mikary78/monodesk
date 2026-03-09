// ============================================================
// CorporatePage.jsx — 법인 관리 메인 페이지
// MonoBound 법인 관련 동업자, 배당, 법인 비용, 재무 개요를 관리합니다.
// 법인명: MonoBound / 매장명: 여남동
// ============================================================

import { useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Users,
  DollarSign,
  Receipt,
  BarChart2,
} from "lucide-react";
import PartnerList from "../components/modules/corporate/PartnerList";
import DividendPanel from "../components/modules/corporate/DividendPanel";
import CorporateExpenseList from "../components/modules/corporate/CorporateExpenseList";
import CorporateOverview from "../components/modules/corporate/CorporateOverview";

// 탭 메뉴 정의
const TABS = [
  { id: "overview",  label: "재무 개요",   Icon: BarChart2 },
  { id: "partners",  label: "동업자 현황", Icon: Users },
  { id: "dividend",  label: "배당 정산",   Icon: DollarSign },
  { id: "expenses",  label: "법인 비용",   Icon: Receipt },
];

const CorporatePage = () => {
  const today = new Date();
  // 연도 상태 (법인 관리는 연간 단위)
  const [year, setYear] = useState(today.getFullYear());
  // 활성 탭
  const [activeTab, setActiveTab] = useState("overview");

  /**
   * 이전 연도로 이동
   */
  const handlePrevYear = () => setYear((y) => y - 1);

  /**
   * 다음 연도로 이동 (현재 연도 초과 불가)
   */
  const handleNextYear = () => {
    if (year < today.getFullYear()) setYear((y) => y + 1);
  };

  const isCurrentYear = year >= today.getFullYear();

  return (
    <div className="p-8 bg-slate-50 min-h-full">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 size={24} className="text-blue-500" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">법인 관리</h1>
            <p className="text-xs text-slate-400 mt-0.5">MonoBound · 여남동</p>
          </div>
        </div>

        {/* 연도 선택기 */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevYear}
            className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white transition-colors"
            title="이전 연도"
          >
            <ChevronLeft size={16} className="text-slate-500" />
          </button>
          <div className="h-9 px-5 flex items-center border border-slate-200 rounded-md bg-white text-sm font-semibold text-slate-900 min-w-[90px] justify-center">
            {year}년
          </div>
          <button
            onClick={handleNextYear}
            disabled={isCurrentYear}
            className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="다음 연도"
          >
            <ChevronRight size={16} className="text-slate-500" />
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
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

      {/* 탭 콘텐츠 */}
      <div>
        {/* 재무 개요 탭 */}
        {activeTab === "overview" && (
          <CorporateOverview year={year} />
        )}

        {/* 동업자 현황 탭 */}
        {activeTab === "partners" && (
          <PartnerList />
        )}

        {/* 배당 정산 탭 */}
        {activeTab === "dividend" && (
          <DividendPanel year={year} />
        )}

        {/* 법인 비용 탭 */}
        {activeTab === "expenses" && (
          <CorporateExpenseList year={year} />
        )}
      </div>
    </div>
  );
};

export default CorporatePage;
