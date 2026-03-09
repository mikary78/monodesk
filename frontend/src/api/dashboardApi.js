// ============================================================
// api/dashboardApi.js — 대시보드 API 호출 함수 모음
// FastAPI 백엔드 /api/dashboard 엔드포인트와 통신합니다.
// ============================================================

// 백엔드 서버 기본 URL (로컬 전용)
const BASE_URL = "http://localhost:8000/api/dashboard";

/**
 * API 요청 공통 처리 함수.
 * 에러 메시지를 한국어로 처리합니다.
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
    const message =
      errorData.detail || "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    throw new Error(message);
  }
  return response.json();
}

// ─────────────────────────────────────────
// 대시보드 통합 API
// ─────────────────────────────────────────

/**
 * 대시보드 전체 KPI 데이터 조회.
 * 손익, 트렌드, 재고 경고, 급여 현황, 최근 지출을 한 번에 반환합니다.
 * @param {number} year - 조회 연도
 * @param {number} month - 조회 월
 * @returns {Promise<object>} 대시보드 통합 데이터
 */
export async function fetchDashboardSummary(year, month) {
  const params = new URLSearchParams({ year, month });
  return request(`${BASE_URL}/summary?${params}`);
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
 * 금액을 단위 축약 형식으로 포맷합니다.
 * 예: 12450000 → "1,245만원"
 * @param {number} amount - 금액
 * @returns {string} 축약된 금액 문자열
 */
export function formatCurrencyShort(amount) {
  if (!amount) return "0원";
  const num = Number(amount);
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(1)}억원`;
  }
  if (num >= 10000) {
    return `${Math.round(num / 10000).toLocaleString("ko-KR")}만원`;
  }
  return `${num.toLocaleString("ko-KR")}원`;
}

/**
 * 증감률을 문자열로 포맷합니다.
 * 예: 8.5 → "+8.5%", -3.2 → "-3.2%"
 * @param {number|null} rate - 증감률 (%)
 * @returns {string} 포맷된 증감률 문자열
 */
export function formatGrowthRate(rate) {
  if (rate === null || rate === undefined) return "비교 불가";
  const sign = rate >= 0 ? "+" : "";
  return `${sign}${rate.toFixed(1)}%`;
}

/**
 * YYYY-MM-DD 형식의 날짜를 YYYY.MM.DD로 변환합니다.
 * @param {string} dateStr - 날짜 문자열
 * @returns {string} 포맷된 날짜 문자열
 */
export function formatDate(dateStr) {
  if (!dateStr) return "-";
  return dateStr.replace(/-/g, ".");
}
