// ============================================================
// Layout.jsx — 앱 전체 레이아웃 래퍼 컴포넌트
// 모바일(< md): 상단 헤더바 + 슬라이드 오버레이 사이드바
// 태블릿 이상(md+): 사이드바(240px) 고정 + 메인 컨텐츠
// ============================================================

import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu, LogOut } from "lucide-react";
import Sidebar from "./Sidebar";
import { useAuth } from "../../contexts/AuthContext";

/**
 * 전체 페이지 레이아웃 컴포넌트.
 * React Router의 Outlet으로 각 페이지 컴포넌트를 렌더링합니다.
 * 모바일에서는 상단 헤더바와 오버레이 사이드바를 제공합니다.
 */
const Layout = () => {
  // 모바일 사이드바 열림/닫힘 상태
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { logout } = useAuth();

  /**
   * 사이드바 열기
   */
  const handleOpenSidebar = () => setIsSidebarOpen(true);

  /**
   * 사이드바 닫기 (오버레이 클릭 또는 메뉴 항목 클릭 시 호출)
   */
  const handleCloseSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* ── 모바일 전용 상단 헤더바 (md 미만에서만 표시) ─────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-slate-800 flex items-center justify-between px-4">
        {/* 햄버거 버튼 */}
        <button
          onClick={handleOpenSidebar}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          aria-label="메뉴 열기"
        >
          <Menu size={22} />
        </button>

        {/* 앱 이름 */}
        <span className="text-white font-bold text-lg tracking-tight">MonoDesk</span>

        {/* 로그아웃 버튼 */}
        <button
          onClick={logout}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          aria-label="로그아웃"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* ── 사이드바 ────────────────────────────────────────────
          - 모바일: isOpen prop으로 슬라이드 인/아웃 제어
          - 데스크탑: 항상 고정 표시 (md:block)
      ──────────────────────────────────────────────────────── */}
      <Sidebar isOpen={isSidebarOpen} onClose={handleCloseSidebar} />

      {/* ── 메인 컨텐츠 영역 ────────────────────────────────────
          - 모바일: 사이드바 없음, 상단 헤더 높이(pt-14)만 확보
          - 데스크탑: 사이드바 너비만큼 ml-60 유지
      ──────────────────────────────────────────────────────── */}
      <main className="flex-1 min-h-screen overflow-y-auto pt-14 md:pt-0 md:ml-60">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
