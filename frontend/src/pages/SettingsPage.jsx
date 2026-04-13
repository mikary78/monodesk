// ============================================================
// pages/SettingsPage.jsx — 설정 페이지
// admin은 계정 관리, 일반 사용자는 접근 불가 안내를 표시합니다.
// ============================================================

import UserManagement from "../components/modules/admin/UserManagement";
import { useAuth } from "../contexts/AuthContext";
import { ShieldOff } from "lucide-react";

/**
 * 설정 페이지 컴포넌트.
 * admin 역할: 계정 관리 화면 표시
 * 기타 역할: 권한 없음 안내 표시
 */
const SettingsPage = () => {
  const { hasPermission } = useAuth();

  // admin 전용 계정 관리 화면
  if (hasPermission("user_management")) {
    return (
      <div className="p-6">
        {/* 페이지 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">설정</h1>
          <p className="text-slate-500 text-sm mt-1">시스템 설정 및 계정 관리</p>
        </div>

        {/* 계정 관리 섹션 */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <UserManagement />
        </div>
      </div>
    );
  }

  // 권한 없는 사용자 안내
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
      <ShieldOff size={48} className="text-slate-300 mb-4" />
      <h2 className="text-lg font-semibold text-slate-600">접근 권한이 없습니다</h2>
      <p className="text-slate-400 text-sm mt-2">이 페이지는 관리자(admin)만 접근할 수 있습니다.</p>
    </div>
  );
};

export default SettingsPage;
