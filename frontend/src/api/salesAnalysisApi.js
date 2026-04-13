// ============================================================
// api/salesAnalysisApi.js — 매출 분석 API 호출 함수 모음
// FastAPI 백엔드 /api/sales-analysis 엔드포인트와 통신합니다.
// ============================================================

// 공통 인증 API 클라이언트 (JWT 토큰 자동 삽입 + 401 자동 로그아웃)
import { apiRequest as request } from "./apiClient";

// 백엔드 서버 기본 URL (로컬 전용)
const BASE_URL = "http://localhost:8000/api/sales-analysis";

// ─────────────────────────────────────────
// POS 데이터 가져오기 API
// ─────────────────────────────────────────

/**
 * CSV 파일을 업로드하여 POS 데이터를 가져옵니다.
 * @param {File} file - 업로드할 CSV 파일
 * @returns {Promise<object>} 가져오기 결과
 */
export async function importPosCsv(file) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${BASE_URL}/import`, {
    method: "POST",
    body: formData,
    // Content-Type은 FormData 사용 시 자동 설정 (boundary 포함)
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.detail || "파일 업로드 중 오류가 발생했습니다.";
    throw new Error(message);
  }
  return response.json();
}

/**
 * POS 파일 가져오기 이력 목록 조회
 * @param {number} limit - 조회 개수 (기본 20)
 */
export async function fetchImportHistory(limit = 20) {
  return request(`${BASE_URL}/imports?limit=${limit}`);
}

/**
 * 특정 가져오기 이력 및 연결 데이터 삭제
 * @param {number} importId - 가져오기 이력 ID
 */
export async function deleteImport(importId) {
  return request(`${BASE_URL}/imports/${importId}`, { method: "DELETE" });
}

// ─────────────────────────────────────────
// 매출 요약 KPI API
// ─────────────────────────────────────────

/**
 * 월별 매출 요약 KPI 조회
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export async function fetchSalesSummary(year, month) {
  const params = new URLSearchParams({ year, month });
  return request(`${BASE_URL}/summary?${params}`);
}

// ─────────────────────────────────────────
// 매출 트렌드 분석 API
// ─────────────────────────────────────────

/**
 * 매출 트렌드 데이터 조회
 * @param {number} year - 연도
 * @param {number} month - 월
 * @param {string} periodType - 'daily' | 'weekly' | 'monthly'
 */
export async function fetchSalesTrend(year, month, periodType = "daily") {
  const params = new URLSearchParams({ year, month, period_type: periodType });
  return request(`${BASE_URL}/trend?${params}`);
}

// ─────────────────────────────────────────
// 메뉴 분석 API
// ─────────────────────────────────────────

/**
 * 메뉴별 판매 분석 데이터 조회
 * @param {number} year - 연도
 * @param {number} month - 월
 * @param {string|null} category - 카테고리 필터 (선택)
 */
export async function fetchMenuAnalysis(year, month, category = null) {
  const params = new URLSearchParams({ year, month });
  if (category) params.append("category", category);
  return request(`${BASE_URL}/menu-analysis?${params}`);
}

// ─────────────────────────────────────────
// 시간대/요일 분석 API
// ─────────────────────────────────────────

/**
 * 시간대별, 요일별 매출 패턴 분석 조회
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export async function fetchTimeAnalysis(year, month) {
  const params = new URLSearchParams({ year, month });
  return request(`${BASE_URL}/time-analysis?${params}`);
}

// ─────────────────────────────────────────
// 결제 수단 분석 API
// ─────────────────────────────────────────

/**
 * 결제 수단별 매출 비중 분석 조회
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export async function fetchPaymentAnalysis(year, month) {
  const params = new URLSearchParams({ year, month });
  return request(`${BASE_URL}/payment-analysis?${params}`);
}

// ─────────────────────────────────────────
// 메뉴 마스터 API
// ─────────────────────────────────────────

/**
 * 메뉴 마스터 목록 조회
 * @param {boolean} activeOnly - 활성 메뉴만 조회 여부
 */
export async function fetchMenuItems(activeOnly = true) {
  return request(`${BASE_URL}/menus?active_only=${activeOnly}`);
}

/**
 * 메뉴 마스터 정보 수정 (원가, 카테고리 등)
 * @param {number} menuId - 메뉴 ID
 * @param {object} data - 수정 데이터
 */
export async function updateMenuItem(menuId, data) {
  return request(`${BASE_URL}/menus/${menuId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ─────────────────────────────────────────
// 목표 매출 API
// ─────────────────────────────────────────

/**
 * 목표 매출 등록 또는 수정
 * @param {object} data - { year, month, target_amount, memo }
 */
export async function upsertSalesTarget(data) {
  return request(`${BASE_URL}/targets`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * 특정 월 목표 매출 조회
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export async function fetchSalesTarget(year, month) {
  return request(`${BASE_URL}/targets/${year}/${month}`);
}

// ─────────────────────────────────────────
// AI 인사이트 API
// ─────────────────────────────────────────

/**
 * AI 경영 인사이트 생성 요청
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export async function generateAiInsight(year, month) {
  return request(`${BASE_URL}/ai-insight`, {
    method: "POST",
    body: JSON.stringify({ year, month }),
  });
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
 * 퍼센트 값을 포맷합니다. 부호 포함 옵션 지원.
 * @param {number} value - 퍼센트 값
 * @param {boolean} showSign - +/- 부호 표시 여부
 */
export function formatPercent(value, showSign = false) {
  if (value === null || value === undefined) return "-";
  const formatted = `${Math.abs(value).toFixed(1)}%`;
  if (!showSign) return formatted;
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

/**
 * 증감률에 따라 텍스트 컬러 클래스를 반환합니다.
 * @param {number} value - 증감률
 * @returns {string} Tailwind 컬러 클래스
 */
export function getChangeColorClass(value) {
  if (value === null || value === undefined) return "text-slate-500";
  return value >= 0 ? "text-green-500" : "text-red-500";
}

/**
 * 요일 인덱스를 한국어 레이블로 변환합니다. (0=월요일)
 * @param {number} weekday - 요일 인덱스
 * @returns {string} 한국어 요일
 */
export function getWeekdayLabel(weekday) {
  const labels = ["월", "화", "수", "목", "금", "토", "일"];
  return labels[weekday] || "";
}
