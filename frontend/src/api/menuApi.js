// ============================================================
// api/menuApi.js — 메뉴 관리 API 호출 함수 모음
// FastAPI 백엔드(/api/menu)와 통신하는 모든 API 함수를 정의합니다.
// ============================================================

// 공통 인증 API 클라이언트 (JWT 토큰 자동 삽입 + 401 자동 로그아웃)
import { apiRequest as request } from "./apiClient";

// 백엔드 서버 기본 URL (로컬 전용)
const BASE_URL = "http://localhost:8000/api/menu";

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
// 재고 품목 연동 API (메뉴 재료 연결용)
// ─────────────────────────────────────────

/**
 * 재고 품목 목록 조회 — 재료 추가/수정 시 드롭다운에서 사용합니다.
 * 재고 모듈의 /api/inventory/items 엔드포인트를 호출합니다.
 * @returns {Promise<Array>} 재고 품목 배열
 */
export async function fetchInventoryItemsForMenu() {
  const response = await fetch("http://localhost:8000/api/inventory/items", {
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    // 재고 API 호출 실패 시 조용히 빈 배열 반환 (재료 직접 입력으로 대체 가능)
    return [];
  }
  return response.json();
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
