// ============================================================
// Sidebar.jsx — 좌측 네비게이션 사이드바 컴포넌트
// 디자인 시스템의 사이드바 스펙(#1E293B, 240px)을 따릅니다.
// 역할(role)에 따라 메뉴 표시/숨김을 제어합니다.
// ============================================================

import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, DollarSign, TrendingUp, Package,
  UtensilsCrossed, Users, Building2, ClipboardList, FileText,
  Settings, LogOut, UserCog,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

// ─────────────────────────────────────────
// 메뉴 목록 — 역할별 권한 키 연결
// requiredPermission: ROLE_PERMISSIONS의 키와 일치해야 접근 허용
// ─────────────────────────────────────────
const NAV_ITEMS = [
  {
    path: "/dashboard",
    label: "대시보드",
    Icon: LayoutDashboard,
    requiredPermission: "dashboard",
  },
  {
    path: "/accounting",
    label: "세무/회계",
    Icon: DollarSign,
    requiredPermission: "accounting",
  },
  {
    path: "/sales",
    label: "매출 분석",
    Icon: TrendingUp,
    requiredPermission: "sales",
  },
  {
    path: "/inventory",
    label: "재고/발주",
    Icon: Package,
    requiredPermission: "inventory",
  },
  {
    path: "/menu",
    label: "메뉴 관리",
    Icon: UtensilsCrossed,
    requiredPermission: "menu",
  },
  {
    path: "/employee",
    label: "직원 관리",
    Icon: Users,
    // admin/manager는 employee 전체, staff는 employee_attendance만 접근
    // 메뉴는 두 역할 모두 표시 (employee_attendance 포함)
    requiredPermission: "employee_attendance",
  },
  {
    path: "/corporate",
    label: "법인 관리",
    Icon: Building2,
    requiredPermission: "corporate",
  },
  {
    path: "/operations",
    label: "운영 관리",
    Icon: ClipboardList,
    requiredPermission: "operations",
  },
  {
    path: "/documents",
    label: "문서 관리",
    Icon: FileText,
    requiredPermission: "document",
  },
];

/**
 * 좌측 고정 사이드바 컴포넌트.
 * 활성 메뉴는 파란 배경으로 강조 표시됩니다.
 * 역할에 따라 접근 가능한 메뉴만 표시됩니다.
 */
const Sidebar = () => {
  const { user, hasPermission, logout } = useAuth();

  /**
   * 로그아웃 버튼 클릭 핸들러.
   * 확인 다이얼로그 없이 즉시 로그아웃합니다.
   */
  const handleLogout = () => {
    logout();
  };

  // 역할 레이블 매핑
  const roleLabel = {
    admin: "관리자",
    manager: "매니저",
    staff: "스태프",
  }[user?.role] || user?.role;

  return (
    <aside className="w-60 min-h-screen bg-slate-800 flex flex-col fixed left-0 top-0 z-20">
      {/* 로고 + 앱명 영역 (64px) */}
      <div className="h-16 flex flex-col justify-center px-5 border-b border-slate-700">
        <span className="text-white font-bold text-lg leading-tight">MonoDesk</span>
        <span className="text-slate-400 text-xs">여남동</span>
      </div>

      {/* 로그인 사용자 정보 */}
      {user && (
        <div className="px-5 py-3 border-b border-slate-700">
          <p className="text-white text-sm font-medium truncate">{user.name}</p>
          <p className="text-slate-400 text-xs">{roleLabel}</p>
        </div>
      )}

      {/* 메뉴 목록 — 역할 기반 필터링 */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV_ITEMS.map(({ path, label, Icon, requiredPermission }) => {
          // 해당 메뉴에 대한 권한이 없으면 표시하지 않음
          if (!hasPermission(requiredPermission)) return null;

          return (
            <NavLink
              key={path}
              to={path}
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
          );
        })}

        {/* 계정 관리 — admin 전용 */}
        {hasPermission("user_management") && (
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-blue-500 text-white font-semibold"
                  : "text-slate-400 hover:text-white hover:bg-slate-700"
              }`
            }
          >
            <UserCog size={20} />
            계정 관리
          </NavLink>
        )}
      </nav>

      {/* 하단 고정: 설정 + 로그아웃 */}
      <div className="border-t border-slate-700">
        {/* 설정 메뉴 */}
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

        {/* 로그아웃 버튼 */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-5 py-3 text-sm text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <LogOut size={20} />
          로그아웃
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
