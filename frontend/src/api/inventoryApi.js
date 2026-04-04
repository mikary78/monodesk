// ============================================================
// api/inventoryApi.js — 재고/발주 API 호출 함수 모음
// FastAPI 백엔드와 통신하는 모든 재고/발주 API 함수를 정의합니다.
// ============================================================

// 백엔드 서버 기본 URL (로컬 전용)
const BASE_URL = "http://localhost:8000/api/inventory";

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
// 재고 스냅샷 API (월초/월말 재고)
// 엑셀 8-1.월초재고 / 8-2.월말재고 시트에 대응합니다.
// ─────────────────────────────────────────

/**
 * 재고 스냅샷 조회.
 * month_start(월초재고)이고 데이터가 없으면 서버에서 직전달 month_end를 자동 복사합니다.
 * @param {string} type - "month_start" | "month_end"
 * @param {number} year - 조회 연도
 * @param {number} month - 조회 월
 * @returns {Promise<object>} SnapshotSummaryResponse (카테고리별 그룹 + 합계)
 */
export async function getSnapshot(type, year, month) {
  return request(`${BASE_URL}/snapshot/${type}/${year}/${month}`);
}

/**
 * 스냅샷 확정 처리.
 * 확정 후에는 수정 불가. month_end 확정 시 다음달 month_start가 자동 생성됩니다.
 * @param {string} type - "month_start" | "month_end"
 * @param {number} year - 연도
 * @param {number} month - 월
 * @returns {Promise<object>} SnapshotSummaryResponse (확정 처리된 스냅샷)
 */
export async function confirmSnapshot(type, year, month) {
  return request(`${BASE_URL}/snapshot/confirm`, {
    method: "POST",
    body: JSON.stringify({ snapshot_type: type, year, month }),
  });
}

/**
 * 스냅샷 항목 수량/단가 수정 (확정 전만 가능).
 * amount(금액)는 서버에서 quantity × unit_price로 자동 재계산됩니다.
 * @param {number} id - 수정할 스냅샷 항목 ID
 * @param {object} data - { quantity, unit_price, memo }
 * @returns {Promise<object>} SnapshotSummaryResponse (수정 후 전체 스냅샷)
 */
export async function updateSnapshotItem(id, data) {
  return request(`${BASE_URL}/snapshot/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * 현재 재고 기준으로 스냅샷 초안 자동 생성.
 * inventory_items.current_quantity 값을 기준으로 스냅샷을 생성합니다.
 * 이미 확정된 스냅샷이 있으면 서버에서 400 에러를 반환합니다.
 * @param {string} type - "month_start" | "month_end"
 * @param {number} year - 연도
 * @param {number} month - 월
 * @returns {Promise<object>} SnapshotSummaryResponse (생성된 초안)
 */
export async function generateSnapshot(type, year, month) {
  return request(`${BASE_URL}/snapshot/generate/${type}/${year}/${month}`, {
    method: "POST",
  });
}
