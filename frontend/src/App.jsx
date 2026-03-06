// ============================================================
// App.jsx — 앱 라우팅 구성
// React Router v6 기반 페이지 라우팅을 정의합니다.
// ============================================================

import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import DashboardPage from "./pages/DashboardPage";
import AccountingPage from "./pages/AccountingPage";
import SalesAnalysisPage from "./pages/SalesAnalysisPage";
import ComingSoonPage from "./pages/ComingSoonPage";

const App = () => {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* 기본 경로 → 대시보드 */}
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* 1순위 — 세무/회계 관리 (구현 완료) */}
        <Route path="/accounting" element={<AccountingPage />} />

        {/* 2순위 — 매출 분석 (구현 완료) */}
        <Route path="/sales"      element={<SalesAnalysisPage />} />
        <Route path="/inventory"  element={<ComingSoonPage />} />
        <Route path="/menu"       element={<ComingSoonPage />} />
        <Route path="/employee"   element={<ComingSoonPage />} />
        <Route path="/corporate"  element={<ComingSoonPage />} />
        <Route path="/operations" element={<ComingSoonPage />} />
        <Route path="/settings"   element={<ComingSoonPage />} />

        {/* 404 처리 */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
};

export default App;
