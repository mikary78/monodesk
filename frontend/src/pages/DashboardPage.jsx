// ============================================================
// DashboardPage.jsx — 대시보드 페이지 (플레이스홀더)
// Step 7에서 완성 예정. 현재는 안내 화면만 표시합니다.
// ============================================================

import { LayoutDashboard } from "lucide-react";

/**
 * 대시보드 페이지.
 * 현재는 준비 중 안내를 표시하고, Step 7에서 완성됩니다.
 */
const DashboardPage = () => {
  return (
    <div className="p-8 bg-slate-50 min-h-full flex items-center justify-center">
      <div className="text-center">
        <LayoutDashboard size={48} className="text-slate-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">대시보드</h1>
        <p className="text-slate-500 text-sm">
          모든 핵심 모듈 완성 후 Step 7에서 구현됩니다.
        </p>
        <p className="text-slate-400 text-xs mt-1">
          현재 진행: 세무/회계 모듈 ← 왼쪽 메뉴에서 이동하세요.
        </p>
      </div>
    </div>
  );
};

export default DashboardPage;
