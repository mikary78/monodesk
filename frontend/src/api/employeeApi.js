// ============================================================
// api/employeeApi.js — 직원 관리 API 호출 함수 모음
// FastAPI 백엔드 /api/employee 엔드포인트와 통신합니다.
// ============================================================

// 백엔드 서버 기본 URL (로컬 전용)
const BASE_URL = "http://localhost:8000/api/employee";

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
    const message = errorData.detail || "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    throw new Error(message);
  }
  return response.json();
}

// ─────────────────────────────────────────
// 직원 정보 API
// ─────────────────────────────────────────

/**
 * 직원 목록 조회
 * @param {boolean} includeResigned - 퇴사자 포함 여부
 */
export async function fetchEmployees(includeResigned = false) {
  const params = new URLSearchParams({ include_resigned: includeResigned });
  return request(`${BASE_URL}/employees?${params}`);
}

/**
 * 직원 단건 조회
 * @param {number} employeeId - 직원 ID
 */
export async function fetchEmployeeById(employeeId) {
  return request(`${BASE_URL}/employees/${employeeId}`);
}

/**
 * 직원 등록
 * @param {object} data - 직원 정보
 */
export async function createEmployee(data) {
  return request(`${BASE_URL}/employees`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * 직원 정보 수정
 * @param {number} employeeId - 직원 ID
 * @param {object} data - 수정할 정보
 */
export async function updateEmployee(employeeId, data) {
  return request(`${BASE_URL}/employees/${employeeId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * 직원 삭제 (소프트 삭제)
 * @param {number} employeeId - 직원 ID
 */
export async function deleteEmployee(employeeId) {
  return request(`${BASE_URL}/employees/${employeeId}`, {
    method: "DELETE",
  });
}

// ─────────────────────────────────────────
// 근로계약서 파일 API
// ─────────────────────────────────────────

/**
 * 근로계약서 파일 업로드
 * @param {number} employeeId - 직원 ID
 * @param {File} file - 업로드할 파일 (PDF/이미지)
 */
export async function uploadContract(employeeId, file) {
  const formData = new FormData();
  formData.append("file", file);
  // Content-Type은 FormData 사용 시 브라우저가 자동으로 multipart/form-data로 설정
  const response = await fetch(`${BASE_URL}/employees/${employeeId}/contract`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "파일 업로드 중 오류가 발생했습니다.");
  }
  return response.json();
}

/**
 * 근로계약서 파일 다운로드 (새 탭에서 열기)
 * @param {number} employeeId - 직원 ID
 */
export function downloadContract(employeeId) {
  window.open(`${BASE_URL}/employees/${employeeId}/contract`, "_blank");
}

/**
 * 근로계약서 파일 삭제
 * @param {number} employeeId - 직원 ID
 */
export async function deleteContract(employeeId) {
  return request(`${BASE_URL}/employees/${employeeId}/contract`, {
    method: "DELETE",
  });
}

// ─────────────────────────────────────────
// 출퇴근 기록 API
// ─────────────────────────────────────────

/**
 * 월별 출퇴근 기록 조회
 * @param {number} year - 연도
 * @param {number} month - 월
 * @param {number|null} employeeId - 직원 필터 (null이면 전체)
 */
export async function fetchAttendance(year, month, employeeId = null) {
  const params = new URLSearchParams({ year, month });
  if (employeeId) params.append("employee_id", employeeId);
  return request(`${BASE_URL}/attendance?${params}`);
}

/**
 * 출퇴근 시각으로 근무시간 미리 계산 (GET 방식)
 * @param {string} clockIn - 출근 시각 (HH:MM)
 * @param {string} clockOut - 퇴근 시각 (HH:MM)
 */
export async function calculateWorkHours(clockIn, clockOut) {
  const params = new URLSearchParams({ clock_in: clockIn, clock_out: clockOut });
  // 백엔드가 GET /attendance/calculate-hours 로 정의되어 있음
  return request(`${BASE_URL}/attendance/calculate-hours?${params}`);
}

/**
 * 출퇴근 기록 입력
 * @param {object} data - 출퇴근 기록 데이터
 */
export async function createAttendance(data) {
  return request(`${BASE_URL}/attendance`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * 출퇴근 기록 수정
 * @param {number} attendanceId - 기록 ID
 * @param {object} data - 수정할 데이터
 */
export async function updateAttendance(attendanceId, data) {
  return request(`${BASE_URL}/attendance/${attendanceId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * 출퇴근 기록 삭제
 * @param {number} attendanceId - 기록 ID
 */
export async function deleteAttendance(attendanceId) {
  return request(`${BASE_URL}/attendance/${attendanceId}`, {
    method: "DELETE",
  });
}

// ─────────────────────────────────────────
// 급여 정산 API
// ─────────────────────────────────────────

/**
 * 월별 급여 현황 요약 조회
 * 엔드포인트: GET /salary/overview
 * (FastAPI 라우터 경로 충돌 방지: summary 대신 overview 사용)
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export async function fetchSalaryOverview(year, month) {
  const params = new URLSearchParams({ year, month });
  return request(`${BASE_URL}/salary/overview?${params}`);
}

/**
 * 직원 급여 계산 (저장 없이 미리보기)
 * @param {number} employeeId - 직원 ID
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export async function calculateSalary(employeeId, year, month) {
  return request(`${BASE_URL}/salary/calculate`, {
    method: "POST",
    body: JSON.stringify({ employee_id: employeeId, year, month }),
  });
}

/**
 * 계산된 급여를 DB에 저장 (정산 확정)
 * @param {number} employeeId - 직원 ID
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export async function saveSalary(employeeId, year, month) {
  return request(`${BASE_URL}/salary/save`, {
    method: "POST",
    body: JSON.stringify({ employee_id: employeeId, year, month }),
  });
}

/**
 * 월별 급여 정산 기록 조회
 * @param {number} year - 연도
 * @param {number} month - 월
 * @param {number|null} employeeId - 직원 필터
 */
export async function fetchSalaryRecords(year, month, employeeId = null) {
  const params = new URLSearchParams({ year, month });
  if (employeeId) params.append("employee_id", employeeId);
  return request(`${BASE_URL}/salary?${params}`);
}

/**
 * 급여 정산 수정 (지급 완료 처리 등)
 * @param {number} salaryId - 정산 기록 ID
 * @param {object} data - 수정 데이터 { is_paid, paid_date, memo }
 */
export async function updateSalaryRecord(salaryId, data) {
  return request(`${BASE_URL}/salary/${salaryId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * 직원의 전체 급여 지급 이력 조회
 * @param {number} employeeId - 직원 ID
 */
export async function fetchSalaryHistory(employeeId) {
  const params = new URLSearchParams({ employee_id: employeeId });
  return request(`${BASE_URL}/salary/history?${params}`);
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
 * 소수 시간을 "X시간 Y분" 형식으로 변환합니다.
 * 예: 8.5 → "8시간 30분"
 * @param {number} hours - 시간 (소수)
 * @returns {string} 포맷된 시간 문자열
 */
export function formatHours(hours) {
  if (!hours || hours === 0) return "0시간";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/**
 * 고용 형태 코드를 한국어로 변환합니다.
 * @param {string} type - 고용 형태 코드
 * @returns {string} 한국어 레이블
 */
export function formatEmploymentType(type) {
  const map = { FULL_TIME: "정규직", PART_TIME: "아르바이트" };
  return map[type] || type;
}

/**
 * 급여 유형 코드를 한국어로 변환합니다.
 * @param {string} type - 급여 유형 코드
 * @returns {string} 한국어 레이블
 */
export function formatSalaryType(type) {
  const map = { HOURLY: "시급제", MONTHLY: "월급제" };
  return map[type] || type;
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

/**
 * 계약형태 코드를 축약 한국어 레이블로 변환합니다.
 * 목록 뷰의 배지 표시에 사용됩니다.
 * @param {string} type - 계약형태 코드 (4대보험 / 3.3% / 시급알바)
 * @returns {string} 변환된 레이블
 */
export function formatContractType(type) {
  const map = { "4대보험": "정규직", "3.3%": "계약직", "시급알바": "알바" };
  return map[type] || type;
}
