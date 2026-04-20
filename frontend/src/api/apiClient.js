// ============================================================
// api/apiClient.js — 공통 API 요청 클라이언트
// 모든 API 파일이 공유하는 인증 헤더 자동 삽입 함수입니다.
// 401 응답 시 자동 로그아웃 + /login 리다이렉트를 처리합니다.
// ============================================================

/**
 * 인증 헤더가 포함된 API 요청 공통 처리 함수.
 * 기존 각 API 파일의 request() 함수를 대체합니다.
 *
 * @param {string} url - 요청 URL
 * @param {object} options - fetch 옵션 (method, body, headers 등)
 * @returns {Promise<any>} 응답 데이터 (JSON)
 * @throws {Error} HTTP 오류 또는 서버 오류 시 한국어 메시지 포함 에러
 */
// 백엔드 서버 기본 URL — 배포 시 VITE_API_URL 환경변수로 교체됩니다.
export const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function apiRequest(url, options = {}) {
  // 로컬스토리지에서 JWT 토큰 가져오기
  const token = localStorage.getItem("access_token");

  // Content-Type이 FormData인 경우 자동 설정 (브라우저에 위임)
  const isFormData = options.body instanceof FormData;

  const defaultHeaders = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  });

  // 401 인증 오류 — 토큰 만료 또는 무효 → 자동 로그아웃
  if (response.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_user");
    // 현재 페이지가 /login이 아닌 경우에만 리다이렉트
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new Error("인증이 만료되었습니다. 다시 로그인해 주세요.");
  }

  // 403 권한 오류
  if (response.status === 403) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "접근 권한이 없습니다.");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.detail || "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    throw new Error(message);
  }

  return response.json();
}
