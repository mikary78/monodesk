// ============================================================
// Toast.jsx — 전역 토스트 알림 컴포넌트
// success / error / warning / info 4가지 타입을 지원합니다.
// 우측 하단 고정 위치에 슬라이드 인 애니메이션으로 표시됩니다.
// ============================================================

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

// ─────────────────────────────────────────
// 타입별 스타일 정의
// ─────────────────────────────────────────
const TOAST_STYLES = {
  success: {
    bar: "bg-green-500",
    icon: <CheckCircle size={18} className="text-green-500 shrink-0" />,
    title: "text-green-700",
  },
  error: {
    bar: "bg-red-500",
    icon: <XCircle size={18} className="text-red-500 shrink-0" />,
    title: "text-red-700",
  },
  warning: {
    bar: "bg-yellow-500",
    icon: <AlertTriangle size={18} className="text-yellow-500 shrink-0" />,
    title: "text-yellow-700",
  },
  info: {
    bar: "bg-blue-500",
    icon: <Info size={18} className="text-blue-500 shrink-0" />,
    title: "text-blue-700",
  },
};

// ─────────────────────────────────────────
// 단일 토스트 아이템 컴포넌트
// ─────────────────────────────────────────

/**
 * 단일 토스트 메시지 컴포넌트
 * @param {string} id - 토스트 고유 ID
 * @param {string} message - 표시할 메시지
 * @param {"success"|"error"|"warning"|"info"} type - 토스트 타입
 * @param {function} onRemove - 제거 콜백
 */
const ToastItem = ({ id, message, type = "info", onRemove }) => {
  // 슬라이드 인/아웃 애니메이션 제어
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 마운트 직후 슬라이드 인
    const showTimer = setTimeout(() => setVisible(true), 10);
    // 2.7초 후 슬라이드 아웃 시작 (총 3초 중 0.3초는 아웃 애니메이션)
    const hideTimer = setTimeout(() => setVisible(false), 2700);
    // 0.3초 후 DOM 제거
    const removeTimer = setTimeout(() => onRemove(id), 3000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, [id, onRemove]);

  const style = TOAST_STYLES[type] || TOAST_STYLES.info;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`
        w-80 bg-white rounded-lg shadow-lg border border-slate-100 overflow-hidden
        flex items-stretch
        transition-all duration-300 ease-out
        ${visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}
      `}
    >
      {/* 좌측 컬러 바 (4px) */}
      <div className={`w-1 shrink-0 ${style.bar}`} />

      {/* 아이콘 + 메시지 영역 */}
      <div className="flex items-center gap-3 flex-1 px-4 py-3">
        {style.icon}
        <p className={`text-sm font-medium flex-1 ${style.title}`}>
          {message}
        </p>
      </div>

      {/* 닫기 버튼 */}
      <button
        onClick={() => onRemove(id)}
        aria-label="알림 닫기"
        className="p-2 text-slate-400 hover:text-slate-600 transition-colors self-start mt-1 mr-1"
      >
        <X size={14} />
      </button>
    </div>
  );
};

// ─────────────────────────────────────────
// 토스트 컨테이너 (전역 렌더링 영역)
// ─────────────────────────────────────────

/**
 * 토스트 목록을 렌더링하는 컨테이너.
 * ToastContext 내부에서 사용됩니다.
 * @param {Array} toasts - 표시할 토스트 배열
 * @param {function} removeToast - 토스트 제거 함수
 */
const ToastContainer = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  return (
    // 우측 하단 고정 위치 (z-index 최상위)
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2"
      aria-label="알림 목록"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onRemove={removeToast}
        />
      ))}
    </div>
  );
};

export default ToastContainer;
