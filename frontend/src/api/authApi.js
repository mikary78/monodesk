// ============================================================
// api/authApi.js — 인증 및 계정 관리 API 호출 함수 모음
// 로그인, 로그아웃, 계정 CRUD API를 제공합니다.
// ============================================================

// 백엔드 서버 기본 URL (로컬 전용)
const BASE_URL = "http://localhost:8000/api/auth";

/**
 * 인증 헤더가 포함된 API 요청 공통 처리 함수.
 * localStorage의 토큰을 자동으로 헤더에 추가합니다.
 * 401 응답 시 자동 로그아웃 + 로그인 페이지 리다이렉트합니다.
 * @param {string} url - 요청 URL
 * @param {object} options - fetch 옵션
 * @returns {Promise<any>} 응답 데이터
 */
async function request(url, options = {}) {
  // 로컬스토리지에서 JWT 토큰 가져오기
  const token = localStorage.getItem("access_token");

  const defaultHeaders = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  });

  // 401 인증 오류 — 토큰 만료 또는 무효
  if (response.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_user");
    window.location.href = "/login";
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


// ─────────────────────────────────────────
// 로그인 / 인증 API
// ─────────────────────────────────────────

/**
 * 로그인 — JWT 토큰 발급
 * @param {string} username - 로그인 아이디
 * @param {string} password - 비밀번호
 * @returns {Promise<{access_token, token_type, user}>}
 */
export async function login(username, password) {
  const response = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "로그인에 실패했습니다.");
  }

  return response.json();
}

/**
 * 로그아웃 — 서버에 로그아웃 알림 (클라이언트는 토큰을 별도로 삭제)
 * @returns {Promise<{success, message}>}
 */
export async function logout() {
  return request(`${BASE_URL}/logout`, { method: "POST" });
}

/**
 * 현재 로그인한 사용자 정보 조회
 * @returns {Promise<UserResponse>}
 */
export async function getMe() {
  return request(`${BASE_URL}/me`);
}


// ─────────────────────────────────────────
// 계정 관리 API (admin 전용)
// ─────────────────────────────────────────

/**
 * 전체 사용자 계정 목록 조회 — admin 전용
 * @returns {Promise<UserResponse[]>}
 */
export async function getUsers() {
  return request(`${BASE_URL}/users`);
}

/**
 * 새 계정 생성 — admin 전용
 * @param {{username, password, name, role}} data - 계정 생성 데이터
 * @returns {Promise<UserResponse>}
 */
export async function createUser(data) {
  return request(`${BASE_URL}/users`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * 계정 정보 수정 — admin 전용
 * @param {number} id - 수정할 계정 ID
 * @param {{name?, role?, password?, is_active?}} data - 수정할 필드
 * @returns {Promise<UserResponse>}
 */
export async function updateUser(id, data) {
  return request(`${BASE_URL}/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * 계정 비활성화 — admin 전용 (소프트 삭제)
 * @param {number} id - 비활성화할 계정 ID
 * @returns {Promise<{success, message}>}
 */
export async function deleteUser(id) {
  return request(`${BASE_URL}/users/${id}`, { method: "DELETE" });
}
