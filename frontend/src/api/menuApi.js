// ============================================================
// api/menuApi.js — 메뉴 관리 API 호출 함수 모음
// FastAPI 백엔드(/api/menu)와 통신하는 모든 API 함수를 정의합니다.
// ============================================================

// 백엔드 서버 기본 URL (로컬 전용)
const BASE_URL = "http://localhost:8000/api/menu";

/**
 * API 요청 공통 처리 함수.
 * 에러 메시지를 한국어로 변환합니다.
 * @param {string} url - 요청 URL
 * @param {object} options - fetch 옵션
 * @returns {Promise<any>} 응답 데이터
 */
async function request(url, options = {}) {
  const defaultOptions = {
    headers: { "Content-Type": "application/json" },
    ...options,
  };
  const response = await fetch(url, defaultOptions);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.detail || "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    throw new Error(message);
  }
  return response.json();
}

// ─────────────────────────────────────────
// 메뉴 카테고리 API
// ─────────────────────────────────────────

/** 메뉴 카테고리 전체 목록 조회 */
export async function fetchMenuCategories() {
  return request(`${BASE_URL}/categories`);
}

/** 메뉴 카테고리 생성 */
export async function createMenuCategory(data) {
  return request(`${BASE_URL}/categories`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** 메뉴 카테고리 수정 */
export async function updateMenuCategory(categoryId, data) {
  return request(`${BASE_URL}/categories/${categoryId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** 메뉴 카테고리 삭제 */
export async function deleteMenuCategory(categoryId) {
  return request(`${BASE_URL}/categories/${categoryId}`, {
    method: "DELETE",
  });
}

// ─────────────────────────────────────────
// 메뉴 아이템 API
// ─────────────────────────────────────────

/**
 * 메뉴 아이템 목록 조회
 * @param {object} filters - 필터 옵션 (categoryId, is_active, is_featured, skip, limit)
 */
export async function fetchMenuItems(filters = {}) {
  const params = new URLSearchParams();
  if (filters.categoryId != null) params.set("category_id", filters.categoryId);
  if (filters.is_active != null) params.set("is_active", filters.is_active);
  if (filters.is_featured != null) params.set("is_featured", filters.is_featured);
  if (filters.skip != null) params.set("skip", filters.skip);
  if (filters.limit != null) params.set("limit", filters.limit);
  return request(`${BASE_URL}/items?${params}`);
}

/** 메뉴 아이템 단건 조회 */
export async function fetchMenuItemById(itemId) {
  return request(`${BASE_URL}/items/${itemId}`);
}

/** 메뉴 아이템 생성 */
export async function createMenuItem(data) {
  return request(`${BASE_URL}/items`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** 메뉴 아이템 수정 */
export async function updateMenuItem(itemId, data) {
  return request(`${BASE_URL}/items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** 메뉴 아이템 삭제 */
export async function deleteMenuItem(itemId) {
  return request(`${BASE_URL}/items/${itemId}`, {
    method: "DELETE",
  });
}

/** 메뉴 판매 여부 토글 */
export async function toggleMenuActive(itemId) {
  return request(`${BASE_URL}/items/${itemId}/toggle-active`, {
    method: "PATCH",
  });
}

/** 대표 메뉴 토글 */
export async function toggleMenuFeatured(itemId) {
  return request(`${BASE_URL}/items/${itemId}/toggle-featured`, {
    method: "PATCH",
  });
}

// ─────────────────────────────────────────
// 메뉴 구성 재료 API
// ─────────────────────────────────────────

/** 메뉴 구성 재료 전체 조회 */
export async function fetchIngredients(itemId) {
  return request(`${BASE_URL}/items/${itemId}/ingredients`);
}

/** 메뉴 구성 재료 추가 */
export async function addIngredient(itemId, data) {
  return request(`${BASE_URL}/items/${itemId}/ingredients`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** 메뉴 구성 재료 수정 */
export async function updateIngredient(ingredientId, data) {
  return request(`${BASE_URL}/ingredients/${ingredientId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** 메뉴 구성 재료 삭제 */
export async function deleteIngredient(ingredientId) {
  return request(`${BASE_URL}/ingredients/${ingredientId}`, {
    method: "DELETE",
  });
}

// ─────────────────────────────────────────
// 메뉴 통계 / 분석 API
// ─────────────────────────────────────────

/** 메뉴 현황 통계 조회 */
export async function fetchMenuStats() {
  return request(`${BASE_URL}/stats`);
}

/** 메뉴 원가 분석 조회 */
export async function fetchCostAnalysis() {
  return request(`${BASE_URL}/cost-analysis`);
}

/** 기본 메뉴 카테고리 초기화 (최초 1회) */
export async function seedMenuCategories() {
  return request(`${BASE_URL}/seed-categories`, { method: "POST" });
}

// ─────────────────────────────────────────
// 유틸리티 함수
// ─────────────────────────────────────────

/**
 * 금액을 한국 원화 형식으로 포맷합니다.
 * 예: 1234567 → "1,234,567원"
 * @param {number} amount - 금액
 * @returns {string} 포맷된 금액 문자열
 */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined) return "0원";
  return `${Number(amount).toLocaleString("ko-KR")}원`;
}

/**
 * 원가율에 따른 색상 클래스를 반환합니다.
 * 0~30%: 초록(고마진), 30~50%: 파랑(양호), 50~70%: 노랑(주의), 70%+: 빨강(경고)
 * @param {number} ratio - 원가율 (%)
 * @returns {string} Tailwind 색상 클래스
 */
export function getCostRatioColor(ratio) {
  if (ratio <= 30) return "text-green-600";
  if (ratio <= 50) return "text-blue-600";
  if (ratio <= 70) return "text-yellow-600";
  return "text-red-600";
}

/**
 * 원가율에 따른 배지 스타일 클래스를 반환합니다.
 * @param {number} ratio - 원가율 (%)
 * @returns {string} Tailwind 클래스 문자열
 */
export function getCostRatioBadgeClass(ratio) {
  if (ratio <= 30) return "bg-green-50 text-green-700";
  if (ratio <= 50) return "bg-blue-50 text-blue-700";
  if (ratio <= 70) return "bg-yellow-50 text-yellow-700";
  return "bg-red-50 text-red-700";
}
