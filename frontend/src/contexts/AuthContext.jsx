// ============================================================
// contexts/AuthContext.jsx — 인증 전역 상태 컨텍스트
// 로그인 상태, 토큰 관리, 역할별 권한 확인 기능을 제공합니다.
// ============================================================

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api/apiClient";

// ─────────────────────────────────────────
// 역할별 접근 가능한 기능 목록 (백엔드 auth.py와 동기화)
// ─────────────────────────────────────────
const ROLE_PERMISSIONS = {
  admin: [
    "dashboard",
    "accounting",
    "accounting_dividend",  // 지분 정산 탭 (admin 전용)
    "sales",
    "inventory",
    "menu",
    "employee",
    "employee_attendance",
    "corporate",
    "operations",
    "document",
    "user_management",      // 계정 관리 (admin 전용)
  ],
  manager: [
    "dashboard",
    "accounting",           // 지분 정산 탭 제외
    "sales",
    "inventory",
    "menu",
    "employee_attendance",  // 근태/근무표만 허용
    "operations",
  ],
  staff: [
    "employee_attendance",  // 근무표 조회만 허용
  ],
};

// 컨텍스트 생성
const AuthContext = createContext(null);

/**
 * 인증 컨텍스트 프로바이더.
 * 앱 전체를 감싸서 로그인 상태와 사용자 정보를 공유합니다.
 */
export const AuthProvider = ({ children }) => {
  // 사용자 정보 상태 (id, username, name, role)
  const [user, setUser] = useState(null);
  // JWT 토큰 상태
  const [token, setToken] = useState(() => localStorage.getItem("access_token"));
  // 초기 인증 확인 로딩 상태
  const [isLoading, setIsLoading] = useState(true);

  const navigate = useNavigate();

  /**
   * 앱 시작 시 로컬스토리지의 토큰으로 사용자 정보를 복원합니다.
   * 토큰이 만료되었으면 자동 로그아웃 처리합니다.
   */
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = localStorage.getItem("access_token");
      const savedUser = localStorage.getItem("auth_user");

      if (savedToken && savedUser) {
        try {
          // 저장된 사용자 정보 복원
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
          setToken(savedToken);

          // 토큰 유효성 확인 (백엔드 /me 호출)
          const response = await fetch(`${API_BASE}/api/auth/me`, {
            headers: { Authorization: `Bearer ${savedToken}` },
          });

          if (!response.ok) {
            // 토큰 만료 또는 무효 — 로그아웃 처리
            clearAuthData();
          }
        } catch {
          // 네트워크 오류 시 저장된 정보 유지 (오프라인 대응)
          const parsedUser = JSON.parse(savedUser || "null");
          setUser(parsedUser);
        }
      }

      setIsLoading(false);
    };

    restoreSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 인증 데이터를 모두 초기화합니다.
   * 로그아웃 또는 토큰 만료 시 호출합니다.
   */
  const clearAuthData = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_user");
    setUser(null);
    setToken(null);
  }, []);

  /**
   * 로그인 처리 함수.
   * 백엔드에서 JWT 토큰을 발급받고 로컬스토리지에 저장합니다.
   * @param {string} username - 로그인 아이디
   * @param {string} password - 비밀번호
   * @returns {Promise<void>}
   * @throws {Error} 로그인 실패 시 한국어 메시지를 포함한 에러
   */
  const login = useCallback(async (username, password) => {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "로그인에 실패했습니다.");
    }

    const data = await response.json();

    // 토큰과 사용자 정보를 로컬스토리지에 저장
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("auth_user", JSON.stringify(data.user));

    setToken(data.access_token);
    setUser(data.user);

    // 역할별 초기 페이지로 이동
    if (data.user.role === "staff") {
      navigate("/employee");
    } else {
      navigate("/dashboard");
    }
  }, [navigate]);

  /**
   * 로그아웃 처리 함수.
   * 로컬스토리지의 토큰을 삭제하고 로그인 페이지로 이동합니다.
   */
  const logout = useCallback(async () => {
    try {
      // 서버에 로그아웃 알림 (선택적 — 서버는 Stateless)
      const savedToken = localStorage.getItem("access_token");
      if (savedToken) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${savedToken}` },
        }).catch(() => {}); // 실패해도 클라이언트 로그아웃은 진행
      }
    } finally {
      clearAuthData();
      navigate("/login");
    }
  }, [clearAuthData, navigate]);

  /**
   * 특정 기능에 대한 접근 권한을 확인합니다.
   * @param {string} permission - 확인할 권한 키 (ROLE_PERMISSIONS 참조)
   * @returns {boolean} 접근 가능 여부
   */
  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    const permissions = ROLE_PERMISSIONS[user.role] || [];
    return permissions.includes(permission);
  }, [user]);

  // 현재 로그인 상태 여부
  const isAuthenticated = Boolean(token && user);

  // 컨텍스트로 제공할 값들
  const value = {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    hasPermission,
    ROLE_PERMISSIONS,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * 인증 컨텍스트 사용 훅.
 * AuthProvider 내부에서만 사용 가능합니다.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.");
  }
  return context;
};

export default AuthContext;
