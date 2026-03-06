// ============================================================
// SalesAnalysisPage.jsx — 매출 분석 메인 페이지
// PRD 2: POS 연동, 매출 트렌드, 메뉴 분석, 시간대 분석, 결제 수단 분석
// ============================================================

import { useState } from "react";
import {
  TrendingUp, Upload, UtensilsCrossed, Clock,
  CreditCard, ChevronLeft, ChevronRight, Sparkles,
} from "lucide-react";
import PosImport from "../components/modules/sales/PosImport";
import SalesTrend from "../components/modules/sales/SalesTrend";
import MenuAnalysis from "../components/modules/sales/MenuAnalysis";
import TimeAnalysis from "../components/modules/sales/TimeAnalysis";
import PaymentAnalysis from "../components/modules/sales/PaymentAnalysis";
import AiInsight from "../components/modules/sales/AiInsight";

// 탭 메뉴 정의 (PRD 2-1 ~ 2-6)
const TABS = [
  { id: "import",   label: "POS 연동",    Icon: Upload },
  { id: "trend",    label: "매출 트렌드",  Icon: TrendingUp },
  { id: "menu",     label: "메뉴 분석",    Icon: UtensilsCrossed },
  { id: "time",     label: "시간대 분석",  Icon: Clock },
  { id: "payment",  label: "결제 수단",    Icon: CreditCard },
  { id: "ai",       label: "AI 인사이트",  Icon: Sparkles },
];

// 매출 분석 메인 페이지 컴포넌트
const SalesAnalysisPage = () => {
  const today = new Date();
  // 현재 조회 연월
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  // 활성 탭
  const [activeTab, setActiveTab] = useState("import");
  // POS 가져오기 성공 시 트렌드 탭 갱신 트리거
  const [refreshKey, setRefreshKey] = useState(0);

  // 이전 달로 이동
  const handlePrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  // 다음 달로 이동 (현재 달 이후 불가)
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

  // 현재 달 여부
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  // POS 가져오기 성공 시 데이터 갱신
  const handleImportSuccess = () => {
    setRefreshKey((k) => k + 1);
    // 가져오기 성공 후 트렌드 탭으로 자동 이동
    setActiveTab("trend");
  };

  return (
    <div className="p-8 bg-slate-50 min-h-full">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp size={24} className="text-blue-500" />
          <h1 className="text-2xl font-bold text-slate-900">매출 분석</h1>
        </div>

        {/* 월 선택 컨트롤 */}
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
                : "flex items-center gap-2 h-10 px-4 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700 transition-colors"
            }
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div key={refreshKey}>
        {/* POS 연동 탭 */}
        {activeTab === "import" && (
          <PosImport onImportSuccess={handleImportSuccess} />
        )}

        {/* 매출 트렌드 탭 */}
        {activeTab === "trend" && (
          <SalesTrend year={year} month={month} />
        )}

        {/* 메뉴 분석 탭 */}
        {activeTab === "menu" && (
          <MenuAnalysis year={year} month={month} />
        )}

        {/* 시간대 분석 탭 */}
        {activeTab === "time" && (
          <TimeAnalysis year={year} month={month} />
        )}

        {/* 결제 수단 탭 */}
        {activeTab === "payment" && (
          <PaymentAnalysis year={year} month={month} />
        )}

        {/* AI 인사이트 탭 */}
        {activeTab === "ai" && (
          <AiInsight year={year} month={month} />
        )}
      </div>
    </div>
  );
};

export default SalesAnalysisPage;
