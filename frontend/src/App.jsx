// ============================================================
// App.jsx — 앱 라우팅 구성
// React Router v6 기반 페이지 라우팅을 정의합니다.
// ToastProvider로 전역 토스트 알림 시스템을 제공합니다.
// ============================================================

import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import DashboardPage from "./pages/DashboardPage";
import AccountingPage from "./pages/AccountingPage";
import SalesAnalysisPage from "./pages/SalesAnalysisPage";
import InventoryPage from "./pages/InventoryPage";
import MenuPage from "./pages/MenuPage";
import EmployeePage from "./pages/EmployeePage";
import CorporatePage from "./pages/CorporatePage";
import ComingSoonPage from "./pages/ComingSoonPage";
import OperationsPage from "./pages/OperationsPage";
import { ToastProvider } from "./contexts/ToastContext";

const App = () => {
  return (
    // 전역 Toast 알림 시스템 — 모든 페이지에서 useToast() 사용 가능
    <ToastProvider>
      <Routes>
        <Route element={<Layout />}>
          {/* 기본 경로 → 대시보드 */}
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* 1순위 — 세무/회계 관리 (구현 완료) */}
          <Route path="/accounting" element={<AccountingPage />} />

          {/* 2순위 — 매출 분석 (구현 완료) */}
          <Route path="/sales"      element={<SalesAnalysisPage />} />

          {/* 3순위 — 재고/발주 관리 (구현 완료) */}
          <Route path="/inventory"  element={<InventoryPage />} />

          {/* 4순위 — 메뉴 관리 (구현 완료) */}
          <Route path="/menu"       element={<MenuPage />} />

          {/* 5순위 — 직원 관리 (구현 완료) */}
          <Route path="/employee"   element={<EmployeePage />} />

          {/* 7순위 — 법인 관리 (구현 완료) */}
          <Route path="/corporate"  element={<CorporatePage />} />

          {/* 8순위 — 운영 관리 (구현 완료) */}
          <Route path="/operations" element={<OperationsPage />} />

          {/* 설정 (미구현) */}
          <Route path="/settings"   element={<ComingSoonPage />} />

          {/* 404 처리 */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </ToastProvider>
  );
};

export default App;
