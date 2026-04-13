// ============================================================
// App.jsx — 앱 라우팅 구성
// React Router v6 기반 페이지 라우팅을 정의합니다.
// AuthProvider로 인증 상태를 전역 관리합니다.
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
import OperationsPage from "./pages/OperationsPage";
import DocumentPage from "./pages/DocumentPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import { ToastProvider } from "./contexts/ToastContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

/**
 * 비로그인 시 /login으로 리다이렉트하는 보호 라우트 컴포넌트.
 * 로딩 중에는 빈 화면을 표시합니다.
 * @param {object} props
 * @param {React.ReactNode} props.children - 보호할 컴포넌트
 */
const PrivateRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // 세션 복원 중 — 로딩 화면 표시
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 비로그인 상태 → /login으로 리다이렉트
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

/**
 * 이미 로그인된 상태에서 /login 접근 시 대시보드로 리다이렉트합니다.
 */
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null; // 세션 복원 중

  // 이미 로그인된 경우 대시보드로 이동
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const App = () => {
  return (
    // 전역 Toast 알림 시스템 — 모든 페이지에서 useToast() 사용 가능
    <ToastProvider>
      {/* 전역 인증 상태 — 모든 페이지에서 useAuth() 사용 가능 */}
      <AuthProvider>
        <Routes>
          {/* 로그인 페이지 — 인증 불필요 (이미 로그인 시 대시보드로) */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />

          {/* 보호된 라우트 — 로그인 필수 */}
          <Route
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
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

            {/* 문서 관리 (구현 완료) */}
            <Route path="/documents" element={<DocumentPage />} />

            {/* 설정 — admin: 계정 관리, 기타: 권한 없음 안내 */}
            <Route path="/settings"   element={<SettingsPage />} />

            {/* 404 처리 */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
