// ============================================================
// api/ocrApi.js — OCR 영수증 스캔 API 호출 함수 모음
// FastAPI 백엔드 /api/ocr/* 엔드포인트와 통신합니다.
// ============================================================

// 공통 인증 API 클라이언트 (JWT 토큰 자동 삽입 + 401 자동 로그아웃)
import { apiRequest, API_BASE } from "./apiClient";

const BASE_URL = `${API_BASE}/api/ocr`;

/**
 * OCR 스캔 결과의 기본 데이터 구조입니다.
 * 백엔드 OcrScanResponse 스키마와 일치합니다.
 *
 * @typedef {Object} OcrScanResult
 * @property {boolean} success - OCR 처리 성공 여부
 * @property {string|null} image_path - 저장된 영수증 이미지 경로
 * @property {string|null} date - 인식된 날짜 (YYYY-MM-DD)
 * @property {string|null} vendor - 인식된 거래처명
 * @property {number} total_amount - 인식된 합계 금액
 * @property {OcrItemResult[]} items - 인식된 품목 목록
 * @property {string|null} raw_text - OCR 원본 텍스트
 * @property {string|null} error_message - 오류 메시지
 */

/**
 * 개별 품목 OCR 결과 구조입니다.
 *
 * @typedef {Object} OcrItemResult
 * @property {string} name - 품목명
 * @property {number} quantity - 수량
 * @property {string} unit - 단위
 * @property {number} unit_price - 단가
 * @property {number} amount - 소계
 * @property {number|null} matched_inventory_id - 매칭된 재고 품목 ID
 * @property {string|null} matched_inventory_name - 매칭된 재고 품목명
 * @property {number|null} match_score - 매칭 유사도 (0~1)
 * @property {boolean} apply_to_inventory - 재고 반영 여부
 */

// ─────────────────────────────────────────
// 영수증 스캔 (OCR 처리)
// ─────────────────────────────────────────

/**
 * 영수증/거래명세서 이미지를 업로드하여 OCR 처리합니다.
 * multipart/form-data로 파일을 전송합니다.
 * Content-Type 헤더를 생략하여 브라우저가 boundary를 자동 설정하게 합니다.
 *
 * @param {File} imageFile - 업로드할 이미지 파일 (File 객체)
 * @returns {Promise<OcrScanResult>} OCR 파싱 결과 (사용자 검토용)
 */
export async function scanReceipt(imageFile) {
  const formData = new FormData();
  formData.append("file", imageFile);

  // apiRequest가 FormData를 감지하여 Content-Type을 자동으로 생략합니다.
  // (브라우저가 multipart boundary를 자동으로 설정)
  return apiRequest(`${BASE_URL}/scan-receipt`, {
    method: "POST",
    body: formData,
  });
}


// ─────────────────────────────────────────
// 영수증 확정 저장
// ─────────────────────────────────────────

/**
 * 사용자가 검토/수정한 영수증 데이터를 확정하여 저장합니다.
 * 지출 기록과 재고 입고 기록이 동시에 생성됩니다.
 *
 * @param {Object} data - 확정 저장 요청 데이터
 * @param {string} data.date - 지출 날짜 (YYYY-MM-DD)
 * @param {string|null} data.vendor - 거래처명
 * @param {number} data.total_amount - 합계 금액
 * @param {number} data.vat - 부가세
 * @param {string} data.payment_method - 결제 수단
 * @param {number} data.expense_category_id - 지출 분류 ID
 * @param {string|null} data.image_path - 영수증 이미지 경로
 * @param {string|null} data.memo - 메모
 * @param {OcrItemResult[]} data.items - 품목 목록
 * @returns {Promise<{success: boolean, expense_id: number, purchase_order_id: number|null, inventory_updated_count: number, message: string}>}
 */
export async function confirmReceipt(data) {
  return apiRequest(`${BASE_URL}/confirm-receipt`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}
