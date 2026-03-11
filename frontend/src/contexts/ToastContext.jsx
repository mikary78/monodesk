// ============================================================
// ToastContext.jsx — 전역 토스트 컨텍스트 및 프로바이더
// useToast 훅을 통해 앱 어디서든 토스트 알림을 표시할 수 있습니다.
// ============================================================

import { createContext, useContext, useState, useCallback } from "react";
import ToastContainer from "../components/common/Toast";

// ─────────────────────────────────────────
// Context 생성
// ─────────────────────────────────────────
const ToastContext = createContext(null);

// ─────────────────────────────────────────
// ToastProvider — 앱 최상단에 감쌉니다
// ─────────────────────────────────────────

/**
 * 전역 Toast 상태를 제공하는 Provider 컴포넌트.
 * App.jsx의 최상위에서 감싸야 합니다.
 * @param {ReactNode} children - 자식 컴포넌트
 */
export const ToastProvider = ({ children }) => {
  // 표시 중인 토스트 목록
  const [toasts, setToasts] = useState([]);

  /**
   * 토스트 추가
   * @param {string} message - 표시 메시지
   * @param {"success"|"error"|"warning"|"info"} type - 토스트 타입
   */
  const addToast = useCallback((message, type = "info") => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  /**
   * 토스트 제거
   * @param {string} id - 제거할 토스트 ID
   */
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── 편의 메서드 ───
  const toast = {
    /** 성공 알림 (초록색) */
    success: (message) => addToast(message, "success"),
    /** 오류 알림 (빨간색) */
    error: (message) => addToast(message, "error"),
    /** 경고 알림 (노란색) */
    warning: (message) => addToast(message, "warning"),
    /** 정보 알림 (파란색) */
    info: (message) => addToast(message, "info"),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* 전역 토스트 컨테이너 — 모든 페이지에 렌더링 */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

// ─────────────────────────────────────────
// useToast 훅 — 컴포넌트에서 사용
// ─────────────────────────────────────────

/**
 * 토스트 알림 훅.
 * @returns {{ success, error, warning, info }} 토스트 메서드 객체
 *
 * @example
 * const toast = useToast();
 * toast.success("저장되었습니다.");
 * toast.error("오류가 발생했습니다.");
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast는 ToastProvider 내부에서만 사용할 수 있습니다.");
  }
  return context;
};

export default ToastContext;
