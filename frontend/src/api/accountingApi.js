// ============================================================
// api/accountingApi.js — 세무/회계 API 호출 함수 모음
// FastAPI 백엔드와 통신하는 모든 API 함수를 정의합니다.
// ============================================================

// 공통 인증 API 클라이언트 (JWT 토큰 자동 삽입 + 401 자동 로그아웃)
import { apiRequest as request, API_BASE } from "./apiClient";

const BASE_URL = `${API_BASE}/api/accounting`;

// ─────────────────────────────────────────
// 지출 분류 API
// ─────────────────────────────────────────

/** 지출 분류 목록 전체 조회 */
export async function fetchCategories() {
  return request(`${BASE_URL}/categories`);
}

/** 지출 분류 생성 */
export async function createCategory(data) {
  return request(`${BASE_URL}/categories`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** 지출 분류 수정 */
export async function updateCategory(categoryId, data) {
  return request(`${BASE_URL}/categories/${categoryId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** 지출 분류 삭제 */
export async function deleteCategory(categoryId) {
  return request(`${BASE_URL}/categories/${categoryId}`, {
    method: "DELETE",
  });
}

// ─────────────────────────────────────────
// 지출 기록 API
// ─────────────────────────────────────────

/**
 * 월별 지출 목록 조회
 * @param {number} year - 연도
 * @param {number} month - 월
 * @param {object} filters - 필터 옵션 (categoryId, skip, limit)
 */
export async function fetchExpenses(year, month, filters = {}) {
  const params = new URLSearchParams({ year, month, ...filters });
  return request(`${BASE_URL}/expenses?${params}`);
}

/** 지출 기록 단건 조회 */
export async function fetchExpenseById(expenseId) {
  return request(`${BASE_URL}/expenses/${expenseId}`);
}

/** 지출 기록 생성 */
export async function createExpense(data) {
  return request(`${BASE_URL}/expenses`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** 지출 기록 수정 */
export async function updateExpense(expenseId, data) {
  return request(`${BASE_URL}/expenses/${expenseId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** 지출 기록 삭제 */
export async function deleteExpense(expenseId) {
  return request(`${BASE_URL}/expenses/${expenseId}`, {
    method: "DELETE",
  });
}

// ─────────────────────────────────────────
// 매출 기록 API
// ─────────────────────────────────────────

/** 월별 매출 목록 조회 */
export async function fetchSales(year, month) {
  const params = new URLSearchParams({ year, month });
  return request(`${BASE_URL}/sales?${params}`);
}

/** 매출 기록 생성 */
export async function createSales(data) {
  return request(`${BASE_URL}/sales`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** 매출 기록 수정 */
export async function updateSales(salesId, data) {
  return request(`${BASE_URL}/sales/${salesId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** 매출 기록 삭제 */
export async function deleteSales(salesId) {
  return request(`${BASE_URL}/sales/${salesId}`, {
    method: "DELETE",
  });
}

// ─────────────────────────────────────────
// 손익 계산 API
// ─────────────────────────────────────────

/**
 * 월별 손익 현황 조회
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export async function fetchProfitLoss(year, month) {
  const params = new URLSearchParams({ year, month });
  return request(`${BASE_URL}/profit-loss?${params}`);
}

/** 기본 지출 분류 초기화 (최초 1회) */
export async function seedCategories() {
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
 * 퍼센트 값을 포맷합니다.
 * 예: 32.5 → "32.5%", 양수이면 "+32.5%"
 * @param {number} value - 퍼센트 값
 * @param {boolean} showSign - 부호 표시 여부
 * @returns {string} 포맷된 퍼센트 문자열
 */
export function formatPercent(value, showSign = false) {
  if (value === null || value === undefined) return "-";
  const formatted = `${Math.abs(value).toFixed(1)}%`;
  if (!showSign) return formatted;
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

/**
 * YYYY-MM-DD 형식의 날짜를 YYYY년 MM월 DD일로 변환합니다.
 * @param {string} dateStr - 날짜 문자열
 * @returns {string} 한국어 날짜 문자열
 */
export function formatDateKo(dateStr) {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${year}년 ${parseInt(month)}월 ${parseInt(day)}일`;
}
