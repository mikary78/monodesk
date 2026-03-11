// ============================================================
// ConfirmDialog.jsx — 공통 확인 다이얼로그 컴포넌트
// window.confirm()을 대체하는 커스텀 모달 다이얼로그입니다.
// 위험 동작(삭제 등)과 일반 동작을 구분하여 버튼 색상을 달리합니다.
// ============================================================

import { useEffect, useRef } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";

/**
 * 확인 다이얼로그 컴포넌트
 *
 * @param {boolean} isOpen - 모달 표시 여부
 * @param {string} title - 다이얼로그 제목
 * @param {string} message - 본문 설명 메시지
 * @param {string} [confirmText="확인"] - 확인 버튼 텍스트
 * @param {string} [cancelText="취소"] - 취소 버튼 텍스트
 * @param {"danger"|"primary"} [variant="danger"] - 버튼 스타일 (danger: 빨강, primary: 파랑)
 * @param {function} onConfirm - 확인 버튼 클릭 콜백
 * @param {function} onCancel - 취소 버튼 클릭 / 닫기 콜백
 */
const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmText = "확인",
  cancelText = "취소",
  variant = "danger",
  onConfirm,
  onCancel,
}) => {
  // 포커스 관리용 ref (모달 열릴 때 취소 버튼에 포커스)
  const cancelBtnRef = useRef(null);

  // Escape 키로 모달 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };

    // 모달 열릴 때 취소 버튼으로 포커스 이동
    cancelBtnRef.current?.focus();

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  // 모달이 닫혀 있으면 렌더링하지 않음
  if (!isOpen) return null;

  // 위험 동작 여부에 따른 확인 버튼 스타일
  const confirmBtnClass =
    variant === "danger"
      ? "h-9 px-5 text-sm font-semibold text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors"
      : "h-9 px-5 text-sm font-semibold text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors";

  // 위험 동작 시 아이콘 (주황색 경고), 일반 시 파란색 물음표
  const DialogIcon =
    variant === "danger" ? (
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
        <AlertTriangle size={24} className="text-red-500" />
      </div>
    ) : (
      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
        <HelpCircle size={24} className="text-blue-500" />
      </div>
    );

  return (
    // 배경 오버레이 — 클릭 시 닫기
    <div
      className="fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4"
      onClick={(e) => {
        // 오버레이 클릭 시만 닫기 (모달 내부 클릭은 무시)
        if (e.target === e.currentTarget) onCancel();
      }}
      role="presentation"
    >
      {/* 모달 본문 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
      >
        {/* 아이콘 + 텍스트 영역 */}
        <div className="flex items-start gap-4 mb-6">
          {DialogIcon}
          <div className="flex-1 pt-1">
            <h2
              id="confirm-dialog-title"
              className="text-base font-semibold text-slate-900 mb-1.5"
            >
              {title}
            </h2>
            <p
              id="confirm-dialog-message"
              className="text-sm text-slate-500 leading-relaxed"
            >
              {message}
            </p>
          </div>
        </div>

        {/* 버튼 영역 */}
        <div className="flex justify-end gap-3">
          {/* 취소 버튼 (기본 포커스) */}
          <button
            ref={cancelBtnRef}
            onClick={onCancel}
            className="h-9 px-5 text-sm font-medium border border-slate-200 rounded-md text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {cancelText}
          </button>
          {/* 확인 버튼 */}
          <button
            onClick={onConfirm}
            className={confirmBtnClass}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
