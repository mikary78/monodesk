// ============================================================
// api/corporateApi.js — 법인 관리 API 호출 함수 모음
// FastAPI /api/corporate 엔드포인트와 통신합니다.
// ============================================================

const BASE_URL = "http://localhost:8000/api/corporate";

// ─────────────────────────────────────────
// 동업자 관리 API
// ─────────────────────────────────────────

/**
 * 동업자 목록 전체 조회
 */
export const fetchPartners = async () => {
  const res = await fetch(`${BASE_URL}/partners`);
  if (!res.ok) throw new Error("동업자 목록을 불러오는 데 실패했습니다.");
  return res.json();
};

/**
 * 동업자 단건 조회
 * @param {number} partnerId
 */
export const fetchPartnerById = async (partnerId) => {
  const res = await fetch(`${BASE_URL}/partners/${partnerId}`);
  if (!res.ok) throw new Error("동업자 정보를 불러오는 데 실패했습니다.");
  return res.json();
};

/**
 * 동업자 등록
 * @param {Object} data - { name, equity_ratio, phone, email, bank_name, bank_account, role, investment_amount, memo }
 */
export const createPartner = async (data) => {
  const res = await fetch(`${BASE_URL}/partners`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "동업자 등록에 실패했습니다.");
  }
  return res.json();
};

/**
 * 동업자 정보 수정
 * @param {number} partnerId
 * @param {Object} data
 */
export const updatePartner = async (partnerId, data) => {
  const res = await fetch(`${BASE_URL}/partners/${partnerId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "동업자 정보 수정에 실패했습니다.");
  }
  return res.json();
};

/**
 * 동업자 삭제
 * @param {number} partnerId
 */
export const deletePartner = async (partnerId) => {
  const res = await fetch(`${BASE_URL}/partners/${partnerId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("동업자 삭제에 실패했습니다.");
  return res.json();
};

/**
 * 기본 동업자 4명 초기 등록 (최초 설정용)
 */
export const seedPartners = async () => {
  const res = await fetch(`${BASE_URL}/partners/seed`, { method: "POST" });
  if (!res.ok) throw new Error("기본 동업자 등록에 실패했습니다.");
  return res.json();
};


// ─────────────────────────────────────────
// 배당 정산 API
// ─────────────────────────────────────────

/**
 * 배당 시뮬레이션 실행 (DB 저장 없음)
 * @param {Object} data - { year, annual_net_profit, distribution_ratio }
 */
export const simulateDividend = async (data) => {
  const res = await fetch(`${BASE_URL}/dividend/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "배당 시뮬레이션에 실패했습니다.");
  }
  return res.json();
};

/**
 * 배당 정산 확정 (DB 저장)
 * @param {Object} data - { year, annual_net_profit, distribution_ratio }
 */
export const confirmDividend = async (data) => {
  const res = await fetch(`${BASE_URL}/dividend/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "배당 확정에 실패했습니다.");
  }
  return res.json();
};

/**
 * 연도별 배당 기록 목록 조회
 * @param {number} year
 */
export const fetchDividendRecords = async (year) => {
  const res = await fetch(`${BASE_URL}/dividend?year=${year}`);
  if (!res.ok) throw new Error("배당 기록을 불러오는 데 실패했습니다.");
  return res.json();
};

/**
 * 배당 기록 지급 상태 수정
 * @param {number} recordId
 * @param {Object} data - { is_paid, paid_date, memo }
 */
export const updateDividendRecord = async (recordId, data) => {
  const res = await fetch(`${BASE_URL}/dividend/${recordId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("배당 기록 수정에 실패했습니다.");
  return res.json();
};

/**
 * 연도별 배당 기록 전체 삭제
 * @param {number} year
 */
export const deleteDividendRecordsByYear = async (year) => {
  const res = await fetch(`${BASE_URL}/dividend/${year}`, { method: "DELETE" });
  if (!res.ok) throw new Error("배당 기록 삭제에 실패했습니다.");
  return res.json();
};


// ─────────────────────────────────────────
// 법인 비용 API
// ─────────────────────────────────────────

/**
 * 법인 비용 목록 조회
 * @param {Object} params - { year, month?, category?, skip?, limit? }
 */
export const fetchCorporateExpenses = async ({ year, month, category, skip = 0, limit = 50 }) => {
  const params = new URLSearchParams({ year, skip, limit });
  if (month) params.append("month", month);
  if (category) params.append("category", category);

  const res = await fetch(`${BASE_URL}/expenses?${params}`);
  if (!res.ok) throw new Error("법인 비용 목록을 불러오는 데 실패했습니다.");
  return res.json();
};

/**
 * 법인 비용 단건 조회
 * @param {number} expenseId
 */
export const fetchCorporateExpenseById = async (expenseId) => {
  const res = await fetch(`${BASE_URL}/expenses/${expenseId}`);
  if (!res.ok) throw new Error("법인 비용을 불러오는 데 실패했습니다.");
  return res.json();
};

/**
 * 법인 비용 등록
 * @param {Object} data - { expense_date, category, description, vendor?, amount, payment_method?, is_recurring?, memo? }
 */
export const createCorporateExpense = async (data) => {
  const res = await fetch(`${BASE_URL}/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "법인 비용 등록에 실패했습니다.");
  }
  return res.json();
};

/**
 * 법인 비용 수정
 * @param {number} expenseId
 * @param {Object} data
 */
export const updateCorporateExpense = async (expenseId, data) => {
  const res = await fetch(`${BASE_URL}/expenses/${expenseId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("법인 비용 수정에 실패했습니다.");
  return res.json();
};

/**
 * 법인 비용 삭제
 * @param {number} expenseId
 */
export const deleteCorporateExpense = async (expenseId) => {
  const res = await fetch(`${BASE_URL}/expenses/${expenseId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("법인 비용 삭제에 실패했습니다.");
  return res.json();
};


// ─────────────────────────────────────────
// 법인 재무 개요 API
// ─────────────────────────────────────────

/**
 * 연도별 법인 재무 개요 조회
 * @param {number} year
 */
export const fetchCorporateOverview = async (year) => {
  const res = await fetch(`${BASE_URL}/overview?year=${year}`);
  if (!res.ok) throw new Error("법인 재무 개요를 불러오는 데 실패했습니다.");
  return res.json();
};
