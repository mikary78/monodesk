// ============================================================
// MenuPage.jsx — 메뉴 관리 메인 페이지
// 4개 탭: 메뉴 목록 / 원가 분석 / 카테고리 관리 / 현황 요약
// ============================================================

import { useState } from "react";
import { UtensilsCrossed, List, TrendingDown, Tags, LayoutGrid } from "lucide-react";
import MenuStatsCard from "../components/modules/menu/MenuStatsCard";
import MenuList from "../components/modules/menu/MenuList";
import MenuCostAnalysis from "../components/modules/menu/MenuCostAnalysis";
import MenuCategoryManager from "../components/modules/menu/MenuCategoryManager";

// 탭 메뉴 정의
const TABS = [
  { id: "list",     label: "메뉴 목록",    Icon: List },
  { id: "cost",     label: "원가 분석",    Icon: TrendingDown },
  { id: "category", label: "카테고리 관리", Icon: Tags },
];

const MenuPage = () => {
  // 활성 탭 상태
  const [activeTab, setActiveTab] = useState("list");

  return (
    <div className="p-8 bg-slate-50 min-h-full">
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <UtensilsCrossed size={24} className="text-blue-500" />
        <h1 className="text-2xl font-bold text-slate-900">메뉴 관리</h1>
      </div>

      {/* KPI 요약 카드 (항상 표시) */}
      <MenuStatsCard />

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
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div>
        {/* 메뉴 목록 탭 */}
        {activeTab === "list" && <MenuList />}

        {/* 원가 분석 탭 */}
        {activeTab === "cost" && <MenuCostAnalysis />}

        {/* 카테고리 관리 탭 */}
        {activeTab === "category" && <MenuCategoryManager />}
      </div>
    </div>
  );
};

export default MenuPage;
