// ============================================================
// api/inventoryApi.js — 재고/발주 API 호출 함수 모음
// FastAPI 백엔드와 통신하는 모든 재고/발주 API 함수를 정의합니다.
// ============================================================

// 공통 인증 API 클라이언트 (JWT 토큰 자동 삽입 + 401 자동 로그아웃)
import { apiRequest as request } from "./apiClient";

// 백엔드 서버 기본 URL (로컬 전용)
const BASE_URL = "http://localhost:8000/api/inventory";

// ─────────────────────────────────────────
// 재고 현황 요약 API
// ─────────────────────────────────────────

/** 재고 현황 요약 정보 조회 (전체 품목 수, 재고 부족/품절 수, 발주 진행 중) */
export async function fetchInventorySummary() {
  return request(`${BASE_URL}/summary`);
}

// ─────────────────────────────────────────
// 재고 분류 API
// ─────────────────────────────────────────

/** 재고 분류 목록 전체 조회 */
export async function fetchInventoryCategories() {
  return request(`${BASE_URL}/categories`);
}

/** 재고 분류 생성 */
export async function createInventoryCategory(data) {
  return request(`${BASE_URL}/categories`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** 재고 분류 수정 */
export async function updateInventoryCategory(categoryId, data) {
  return request(`${BASE_URL}/categories/${categoryId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** 재고 분류 삭제 */
export async function deleteInventoryCategory(categoryId) {
  return request(`${BASE_URL}/categories/${categoryId}`, {
    method: "DELETE",
  });
}

// ─────────────────────────────────────────
// 재고 품목 API
// ─────────────────────────────────────────

/**
 * 재고 품목 목록 조회
 * @param {object} filters - 필터 옵션 (categoryId, lowStockOnly, search, skip, limit)
 */
export async function fetchInventoryItems(filters = {}) {
  const params = new URLSearchParams();
  if (filters.categoryId) params.set("category_id", filters.categoryId);
  if (filters.lowStockOnly) params.set("low_stock_only", "true");
  if (filters.search) params.set("search", filters.search);
  if (filters.skip !== undefined) params.set("skip", filters.skip);
  if (filters.limit !== undefined) params.set("limit", filters.limit);
  return request(`${BASE_URL}/items?${params}`);
}

/** 재고 품목 단건 조회 */
export async function fetchInventoryItemById(itemId) {
  return request(`${BASE_URL}/items/${itemId}`);
}

/** 재고 품목 등록 */
export async function createInventoryItem(data) {
  return request(`${BASE_URL}/items`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** 재고 품목 수정 */
export async function updateInventoryItem(itemId, data) {
  return request(`${BASE_URL}/items/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** 재고 품목 삭제 */
export async function deleteInventoryItem(itemId) {
  return request(`${BASE_URL}/items/${itemId}`, {
    method: "DELETE",
  });
}

// ─────────────────────────────────────────
// 재고 수량 조정 API
// ─────────────────────────────────────────

/**
 * 재고 수량 조정 (입고/출고/실사조정/폐기)
 * @param {object} data - 조정 데이터 (item_id, adjustment_type, quantity_change, adjustment_date, ...)
 */
export async function adjustInventoryQuantity(data) {
  return request(`${BASE_URL}/adjustments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * 재고 수량 조정 이력 조회
 * @param {object} filters - 필터 옵션 (itemId, startDate, endDate, adjustmentType, skip, limit)
 */
export async function fetchAdjustmentHistory(filters = {}) {
  const params = new URLSearchParams();
  if (filters.itemId) params.set("item_id", filters.itemId);
  if (filters.startDate) params.set("start_date", filters.startDate);
  if (filters.endDate) params.set("end_date", filters.endDate);
  if (filters.adjustmentType) params.set("adjustment_type", filters.adjustmentType);
  if (filters.skip !== undefined) params.set("skip", filters.skip);
  if (filters.limit !== undefined) params.set("limit", filters.limit);
  return request(`${BASE_URL}/adjustments?${params}`);
}

// ─────────────────────────────────────────
// 발주서 API
// ─────────────────────────────────────────

/**
 * 발주서 목록 조회
 * @param {object} filters - 필터 옵션 (status, supplier, startDate, endDate, skip, limit)
 */
export async function fetchPurchaseOrders(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.supplier) params.set("supplier", filters.supplier);
  if (filters.startDate) params.set("start_date", filters.startDate);
  if (filters.endDate) params.set("end_date", filters.endDate);
  if (filters.skip !== undefined) params.set("skip", filters.skip);
  if (filters.limit !== undefined) params.set("limit", filters.limit);
  return request(`${BASE_URL}/orders?${params}`);
}

/** 발주서 단건 조회 (품목 포함) */
export async function fetchPurchaseOrderById(orderId) {
  return request(`${BASE_URL}/orders/${orderId}`);
}

/** 발주서 생성 */
export async function createPurchaseOrder(data) {
  return request(`${BASE_URL}/orders`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** 발주서 수정 */
export async function updatePurchaseOrder(orderId, data) {
  return request(`${BASE_URL}/orders/${orderId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** 발주서 취소 */
export async function cancelPurchaseOrder(orderId) {
  return request(`${BASE_URL}/orders/${orderId}/cancel`, {
    method: "POST",
  });
}

/**
 * 발주서 입고 처리
 * @param {number} orderId - 발주서 ID
 * @param {object} data - 입고 데이터 (received_date, items: [{order_item_id, received_quantity, unit_price}])
 */
export async function receivePurchaseOrder(orderId, data) {
  return request(`${BASE_URL}/orders/${orderId}/receive`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** 발주서 삭제 */
export async function deletePurchaseOrder(orderId) {
  return request(`${BASE_URL}/orders/${orderId}`, {
    method: "DELETE",
  });
}

/** 기본 재고 분류 초기화 (최초 1회) */
export async function seedInventoryCategories() {
  return request(`${BASE_URL}/seed-categories`, { method: "POST" });
}

// ─────────────────────────────────────────
// 매입 출처별 집계 API
// 엑셀 3.원·부재료 시트의 본사구매/현장구매 구분별 월 합계를 조회합니다.
// ─────────────────────────────────────────

/**
 * 월별 매입 출처별 집계 조회.
 * 본사구매/현장구매(법카/시재)/기타별 입고 금액 합계를 반환합니다.
 * 엑셀 ★보고서의 원재료 지출 집계와 동일한 데이터를 제공합니다.
 *
 * @param {number} year - 조회 연도 (예: 2026)
 * @param {number} month - 조회 월 (예: 4)
 * @returns {Promise<PurchaseSummaryResponse>} 출처별 집계 결과
 *   - grand_total: 전체 합계
 *   - sources: [{source, source_label, total_amount, count}, ...]
 */
export async function getPurchaseSummary(year, month) {
  return request(`${BASE_URL}/purchases/summary/${year}/${month}`);
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
 * 재고 수량을 단위와 함께 포맷합니다.
 * 예: (5.5, "kg") → "5.5 kg"
 * @param {number} quantity - 수량
 * @param {string} unit - 단위
 * @returns {string} 포맷된 수량 문자열
 */
export function formatQuantity(quantity, unit) {
  if (quantity === null || quantity === undefined) return `0 ${unit}`;
  const formatted = Number.isInteger(quantity)
    ? quantity.toString()
    : quantity.toFixed(1);
  return `${formatted} ${unit}`;
}

/**
 * 재고 상태에 따른 배지 색상 클래스를 반환합니다.
 * @param {string} status - 재고 상태 (정상/부족/품절)
 * @returns {string} Tailwind CSS 클래스
 */
export function getStockStatusClass(status) {
  switch (status) {
    case "정상":
      return "bg-green-100 text-green-700";
    case "부족":
      return "bg-yellow-100 text-yellow-700";
    case "품절":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

/**
 * 발주 상태에 따른 배지 색상 클래스를 반환합니다.
 * @param {string} status - 발주 상태 (발주중/입고완료/취소)
 * @returns {string} Tailwind CSS 클래스
 */
export function getOrderStatusClass(status) {
  switch (status) {
    case "발주중":
      return "bg-blue-100 text-blue-700";
    case "입고완료":
      return "bg-green-100 text-green-700";
    case "취소":
      return "bg-gray-100 text-gray-500";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

/**
 * YYYY-MM-DD 형식의 날짜를 YYYY.MM.DD 형식으로 변환합니다.
 * @param {string} dateStr - 날짜 문자열
 * @returns {string} 변환된 날짜 문자열
 */
export function formatDate(dateStr) {
  if (!dateStr) return "-";
  return dateStr.replace(/-/g, ".");
}

// ─────────────────────────────────────────
// 데일리 단가 API
// 일별 식재료 단가 기록을 관리합니다.
// ─────────────────────────────────────────

/**
 * 월별 데일리 단가 그리드 조회.
 * 추적 중인 품목의 일별 단가 기록을 그리드 형태로 반환합니다.
 * @param {number} year - 조회 연도
 * @param {number} month - 조회 월
 */
export async function getDailyPriceGrid(year, month) {
  return request(`${BASE_URL}/daily-price/${year}/${month}`);
}

/**
 * 데일리 단가 저장 (upsert).
 * @param {object} data - { item_id, record_date, quantity, unit_price, vendor, memo }
 */
export async function saveDailyPrice(data) {
  return request(`${BASE_URL}/daily-price`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * 월별 데일리 단가 요약 조회.
 * @param {number} year - 조회 연도
 * @param {number} month - 조회 월
 */
export async function getDailyPriceSummary(year, month) {
  return request(`${BASE_URL}/daily-price/summary/${year}/${month}`);
}

/**
 * 품목 데일리 단가 추적 여부 토글.
 * @param {number} itemId - 재고 품목 ID
 * @param {boolean} isTracked - 추적 여부
 */
export async function togglePriceTracking(itemId, isTracked) {
  return request(`${BASE_URL}/items/${itemId}/track`, {
    method: "PATCH",
    body: JSON.stringify({ is_daily_price_tracked: isTracked }),
  });
}

// ─────────────────────────────────────────
// 재고 스냅샷 API
// 월초/월말 재고 스냅샷을 관리합니다.
// ─────────────────────────────────────────

/**
 * 재고 스냅샷 조회.
 * @param {string} type - "month_start" 또는 "month_end"
 * @param {number} year - 조회 연도
 * @param {number} month - 조회 월
 */
export async function getSnapshot(type, year, month) {
  return request(`${BASE_URL}/snapshot/${type}/${year}/${month}`);
}

/**
 * 현재 재고 기반 스냅샷 초안 자동 생성.
 * @param {string} type - "month_start" 또는 "month_end"
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export async function generateSnapshot(type, year, month) {
  return request(`${BASE_URL}/snapshot/generate/${type}/${year}/${month}`, {
    method: "POST",
  });
}

/**
 * 스냅샷 단건 항목 수정.
 * @param {number} id - 스냅샷 항목 ID
 * @param {object} data - { quantity, unit_price }
 */
export async function updateSnapshotItem(id, data) {
  return request(`${BASE_URL}/snapshot/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * 스냅샷 확정 처리.
 * 확정 후에는 편집이 불가합니다.
 * month_end 확정 시 다음 달 month_start에 자동 반영됩니다.
 * @param {string} type - "month_start" 또는 "month_end"
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export async function confirmSnapshot(type, year, month) {
  return request(`${BASE_URL}/snapshot/confirm`, {
    method: "POST",
    body: JSON.stringify({ snapshot_type: type, year, month }),
  });
}
