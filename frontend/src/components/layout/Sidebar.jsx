// ============================================================
// Sidebar.jsx — 좌측 네비게이션 사이드바 컴포넌트
// 디자인 시스템의 사이드바 스펙(#1E293B, 240px)을 따릅니다.
// ============================================================

import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, DollarSign, TrendingUp, Package,
  UtensilsCrossed, Users, Building2, ClipboardList, FileText, Settings,
} from "lucide-react";

// 사이드바 메뉴 목록 (모듈 개발 우선순위 순서)
const NAV_ITEMS = [
  { path: "/",          label: "대시보드",    Icon: LayoutDashboard },
  { path: "/accounting", label: "세무/회계",   Icon: DollarSign },
  { path: "/sales",     label: "매출 분석",   Icon: TrendingUp },
  { path: "/inventory", label: "재고/발주",   Icon: Package },
  { path: "/menu",      label: "메뉴 관리",   Icon: UtensilsCrossed },
  { path: "/employee",  label: "직원 관리",   Icon: Users },
  { path: "/corporate", label: "법인 관리",   Icon: Building2 },
  { path: "/operations",label: "운영 관리",   Icon: ClipboardList },
  { path: "/documents", label: "문서 관리",   Icon: FileText },
];

/**
 * 좌측 고정 사이드바 컴포넌트.
 * 활성 메뉴는 파란 배경으로 강조 표시됩니다.
 */
const Sidebar = () => {
  return (
    <aside className="w-60 min-h-screen bg-slate-800 flex flex-col fixed left-0 top-0 z-20">
      {/* 로고 + 앱명 영역 (64px) */}
      <div className="h-16 flex flex-col justify-center px-5 border-b border-slate-700">
        <span className="text-white font-bold text-lg leading-tight">MonoDesk</span>
        <span className="text-slate-400 text-xs">여남동</span>
      </div>

      {/* 메뉴 목록 */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV_ITEMS.map(({ path, label, Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-blue-500 text-white font-semibold"
                  : "text-slate-400 hover:text-white hover:bg-slate-700"
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* 하단 고정: 설정 */}
      <div className="border-t border-slate-700">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-5 py-3 text-sm transition-colors ${
              isActive
                ? "bg-blue-500 text-white font-semibold"
                : "text-slate-400 hover:text-white hover:bg-slate-700"
            }`
          }
        >
          <Settings size={20} />
          설정
        </NavLink>
      </div>
    </aside>
  );
};

export default Sidebar;
