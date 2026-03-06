// ============================================================
// Layout.jsx — 앱 전체 레이아웃 래퍼 컴포넌트
// 사이드바(240px) + 메인 컨텐츠 영역으로 구성됩니다.
// ============================================================

import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

/**
 * 전체 페이지 레이아웃 컴포넌트.
 * React Router의 Outlet으로 각 페이지 컴포넌트를 렌더링합니다.
 */
const Layout = () => {
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* 좌측 사이드바 (240px 고정) */}
      <Sidebar />

      {/* 메인 컨텐츠 영역 (사이드바 너비만큼 왼쪽 여백) */}
      <main className="flex-1 ml-60 min-h-screen overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
