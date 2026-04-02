// ============================================================
// operationsApi.js — 운영 관리 API 호출 함수 모음
// 공지사항, 위생점검, 영업일 관리, 업무 체크리스트 API 연동
// ============================================================

const BASE_URL = "http://localhost:8000/api/operations";

// ─────────────────────────────────────────
// 공지사항 API
// ─────────────────────────────────────────

/**
 * 공지사항 목록 조회
 * @param {object} params - { noticeType, skip, limit }
 */
export const fetchNotices = async ({ noticeType, skip = 0, limit = 50 } = {}) => {
  const params = new URLSearchParams({ skip, limit });
  if (noticeType) params.append("notice_type", noticeType);

  const res = await fetch(`${BASE_URL}/notices?${params}`);
  if (!res.ok) throw new Error("공지사항 목록을 불러오지 못했습니다.");
  return res.json();
};

/**
 * 공지사항 단건 조회
 * @param {number} noticeId - 공지사항 ID
 */
export const fetchNoticeById = async (noticeId) => {
  const res = await fetch(`${BASE_URL}/notices/${noticeId}`);
  if (!res.ok) throw new Error("공지사항을 불러오지 못했습니다.");
  return res.json();
};

/**
 * 공지사항 생성
 * @param {object} data - { title, content, notice_type, is_pinned, author }
 */
export const createNotice = async (data) => {
  const res = await fetch(`${BASE_URL}/notices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "공지사항 저장에 실패했습니다.");
  }
  return res.json();
};

/**
 * 공지사항 수정
 * @param {number} noticeId - 공지사항 ID
 * @param {object} data - 수정할 필드
 */
export const updateNotice = async (noticeId, data) => {
  const res = await fetch(`${BASE_URL}/notices/${noticeId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "공지사항 수정에 실패했습니다.");
  }
  return res.json();
};

/**
 * 공지사항 삭제 (소프트 삭제)
 * @param {number} noticeId - 공지사항 ID
 */
export const deleteNotice = async (noticeId) => {
  const res = await fetch(`${BASE_URL}/notices/${noticeId}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "공지사항 삭제에 실패했습니다.");
  }
  return res.json();
};


// ─────────────────────────────────────────
// 위생 점검 API
// ─────────────────────────────────────────

/**
 * 위생 점검 항목 목록 조회
 * @param {object} params - { checkType, category }
 */
export const fetchHygieneChecklists = async ({ checkType, category } = {}) => {
  const params = new URLSearchParams();
  if (checkType) params.append("check_type", checkType);
  if (category) params.append("category", category);

  const res = await fetch(`${BASE_URL}/hygiene/checklists?${params}`);
  if (!res.ok) throw new Error("위생 점검 항목을 불러오지 못했습니다.");
  return res.json();
};

/**
 * 위생 점검 항목 생성
 * @param {object} data - { item_name, check_type, category, sort_order }
 */
export const createHygieneChecklist = async (data) => {
  const res = await fetch(`${BASE_URL}/hygiene/checklists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "위생 점검 항목 저장에 실패했습니다.");
  }
  return res.json();
};

/**
 * 위생 점검 항목 수정
 * @param {number} itemId - 항목 ID
 * @param {object} data - 수정할 필드
 */
export const updateHygieneChecklist = async (itemId, data) => {
  const res = await fetch(`${BASE_URL}/hygiene/checklists/${itemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "위생 점검 항목 수정에 실패했습니다.");
  }
  return res.json();
};

/**
 * 위생 점검 항목 삭제 (소프트 삭제)
 * @param {number} itemId - 항목 ID
 */
export const deleteHygieneChecklist = async (itemId) => {
  const res = await fetch(`${BASE_URL}/hygiene/checklists/${itemId}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "위생 점검 항목 삭제에 실패했습니다.");
  }
  return res.json();
};

/**
 * 특정 날짜 위생 점검 기록 조회
 * @param {string} checkDate - YYYY-MM-DD
 */
export const fetchHygieneRecords = async (checkDate) => {
  const res = await fetch(`${BASE_URL}/hygiene/records?check_date=${checkDate}`);
  if (!res.ok) throw new Error("위생 점검 기록을 불러오지 못했습니다.");
  return res.json();
};

/**
 * 위생 점검 결과 저장 (upsert)
 * @param {object} data - { check_date, checklist_id, result, inspector, memo }
 */
export const saveHygieneRecord = async (data) => {
  const res = await fetch(`${BASE_URL}/hygiene/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "위생 점검 기록 저장에 실패했습니다.");
  }
  return res.json();
};

/**
 * 월별 위생 점검 현황 요약 조회
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export const fetchHygieneMonthlySummary = async (year, month) => {
  const res = await fetch(`${BASE_URL}/hygiene/monthly-summary?year=${year}&month=${month}`);
  if (!res.ok) throw new Error("위생 점검 월별 현황을 불러오지 못했습니다.");
  return res.json();
};

/**
 * 기본 위생 점검 항목 초기화
 */
export const seedHygieneChecklists = async () => {
  const res = await fetch(`${BASE_URL}/hygiene/seed`, { method: "POST" });
  if (!res.ok) throw new Error("위생 점검 항목 초기화에 실패했습니다.");
  return res.json();
};


// ─────────────────────────────────────────
// 영업일 관리 API
// ─────────────────────────────────────────

/**
 * 월별 영업일 목록 조회
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export const fetchBusinessDays = async (year, month) => {
  const res = await fetch(`${BASE_URL}/business-days?year=${year}&month=${month}`);
  if (!res.ok) throw new Error("영업일 목록을 불러오지 못했습니다.");
  return res.json();
};

/**
 * 특정 날짜 영업일 기록 조회
 * @param {string} date - YYYY-MM-DD
 */
export const fetchBusinessDay = async (date) => {
  const res = await fetch(`${BASE_URL}/business-days/${date}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("영업일 기록을 불러오지 못했습니다.");
  return res.json();
};

/**
 * 영업일 기록 저장 (upsert)
 * @param {object} data - { business_date, status, closed_reason, memo, target_sales, weather }
 */
export const saveBusinessDay = async (data) => {
  const res = await fetch(`${BASE_URL}/business-days`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "영업일 저장에 실패했습니다.");
  }
  return res.json();
};

/**
 * 영업일 기록 삭제
 * @param {string} date - YYYY-MM-DD
 */
export const deleteBusinessDay = async (date) => {
  const res = await fetch(`${BASE_URL}/business-days/${date}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "영업일 기록 삭제에 실패했습니다.");
  }
  return res.json();
};

/**
 * 월별 영업 현황 통계 조회
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export const fetchBusinessMonthStats = async (year, month) => {
  const res = await fetch(`${BASE_URL}/business-days/monthly-stats?year=${year}&month=${month}`);
  if (!res.ok) throw new Error("영업일 통계를 불러오지 못했습니다.");
  return res.json();
};


// ─────────────────────────────────────────
// 업무 체크리스트 API
// ─────────────────────────────────────────

/**
 * 업무 체크리스트 항목 목록 조회
 * @param {string} taskType - open/close/weekly/monthly (선택)
 */
export const fetchTaskChecklists = async (taskType) => {
  const params = taskType ? `?task_type=${taskType}` : "";
  const res = await fetch(`${BASE_URL}/tasks/checklists${params}`);
  if (!res.ok) throw new Error("업무 항목을 불러오지 못했습니다.");
  return res.json();
};

/**
 * 업무 체크리스트 항목 생성
 * @param {object} data - { task_name, task_type, role, sort_order }
 */
export const createTaskChecklist = async (data) => {
  const res = await fetch(`${BASE_URL}/tasks/checklists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "업무 항목 저장에 실패했습니다.");
  }
  return res.json();
};

/**
 * 업무 체크리스트 항목 수정
 * @param {number} taskId - 항목 ID
 * @param {object} data - 수정할 필드
 */
export const updateTaskChecklist = async (taskId, data) => {
  const res = await fetch(`${BASE_URL}/tasks/checklists/${taskId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "업무 항목 수정에 실패했습니다.");
  }
  return res.json();
};

/**
 * 업무 체크리스트 항목 삭제 (소프트 삭제)
 * @param {number} taskId - 항목 ID
 */
export const deleteTaskChecklist = async (taskId) => {
  const res = await fetch(`${BASE_URL}/tasks/checklists/${taskId}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "업무 항목 삭제에 실패했습니다.");
  }
  return res.json();
};

/**
 * 특정 날짜의 업무 체크리스트 완료 현황 조회
 * @param {string} recordDate - YYYY-MM-DD
 * @param {string} taskType - 업무 구분 필터 (선택)
 */
export const fetchTaskRecords = async (recordDate, taskType) => {
  const params = new URLSearchParams({ record_date: recordDate });
  if (taskType) params.append("task_type", taskType);

  const res = await fetch(`${BASE_URL}/tasks/records?${params}`);
  if (!res.ok) throw new Error("업무 기록을 불러오지 못했습니다.");
  return res.json();
};

/**
 * 업무 완료 기록 저장 (upsert)
 * @param {object} data - { record_date, task_id, is_done, completed_by, memo }
 */
export const saveTaskRecord = async (data) => {
  const res = await fetch(`${BASE_URL}/tasks/records`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "업무 기록 저장에 실패했습니다.");
  }
  return res.json();
};

/**
 * 기본 업무 체크리스트 항목 초기화
 */
export const seedTaskChecklists = async () => {
  const res = await fetch(`${BASE_URL}/tasks/seed`, { method: "POST" });
  if (!res.ok) throw new Error("업무 체크리스트 초기화에 실패했습니다.");
  return res.json();
};


// ─────────────────────────────────────────
// 거래처 관리 API
// ─────────────────────────────────────────

/**
 * 거래처 목록 조회
 * @param {object} params - { category, search }
 */
export const fetchVendors = async ({ category, search } = {}) => {
  const params = new URLSearchParams();
  if (category) params.append("category", category);
  if (search) params.append("search", search);

  const query = params.toString() ? `?${params}` : "";
  const res = await fetch(`${BASE_URL}/vendors${query}`);
  if (!res.ok) throw new Error("거래처 목록을 불러오지 못했습니다.");
  return res.json();
};

/**
 * 거래처 등록
 * @param {object} data - 거래처 정보
 */
export const createVendor = async (data) => {
  const res = await fetch(`${BASE_URL}/vendors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "거래처 등록에 실패했습니다.");
  }
  return res.json();
};

/**
 * 거래처 수정
 * @param {number} vendorId - 거래처 ID
 * @param {object} data - 수정할 필드
 */
export const updateVendor = async (vendorId, data) => {
  const res = await fetch(`${BASE_URL}/vendors/${vendorId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "거래처 수정에 실패했습니다.");
  }
  return res.json();
};

/**
 * 거래처 삭제 (소프트 삭제)
 * @param {number} vendorId - 거래처 ID
 */
export const deleteVendor = async (vendorId) => {
  const res = await fetch(`${BASE_URL}/vendors/${vendorId}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "거래처 삭제에 실패했습니다.");
  }
  return res.json();
};


// ─────────────────────────────────────────
// 현금 시재 API
// ─────────────────────────────────────────

/**
 * 특정 날짜 시재 조회 (없으면 전일 잔액 포함 빈 데이터 반환)
 * @param {string} date - YYYY-MM-DD
 */
export const getClosingByDate = async (date) => {
  const res = await fetch(`${BASE_URL}/closing/${date}`);
  if (!res.ok) throw new Error("시재 조회에 실패했습니다.");
  return res.json();
};

/**
 * 현금 시재 저장 (upsert — 날짜 기준)
 * @param {object} data - DailyClosingCreate 필드
 */
export const saveClosing = async (data) => {
  const res = await fetch(`${BASE_URL}/closing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "시재 저장에 실패했습니다.");
  }
  return res.json();
};

/**
 * 현금 시재 수정 (ID 기준)
 * @param {number} id - 시재 ID
 * @param {object} data - DailyClosingCreate 필드
 */
export const updateClosing = async (id, data) => {
  const res = await fetch(`${BASE_URL}/closing/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "시재 수정에 실패했습니다.");
  }
  return res.json();
};

/**
 * 월별 시재 목록 조회
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export const getClosingList = async (year, month) => {
  const res = await fetch(`${BASE_URL}/closing/list?year=${year}&month=${month}`);
  if (!res.ok) throw new Error("시재 목록 조회에 실패했습니다.");
  return res.json();
};


// ─────────────────────────────────────────
// 이슈 트래킹 API
// ─────────────────────────────────────────

/**
 * 특정 날짜 이슈 목록 조회
 * @param {string} date - YYYY-MM-DD
 */
export const getIssuesByDate = async (date) => {
  const res = await fetch(`${BASE_URL}/issues?date=${date}`);
  if (!res.ok) throw new Error("이슈 목록 조회에 실패했습니다.");
  return res.json();
};

/**
 * 월별 이슈 목록 조회
 * @param {number} year - 연도
 * @param {number} month - 월
 */
export const getIssuesList = async (year, month) => {
  const res = await fetch(`${BASE_URL}/issues/list?year=${year}&month=${month}`);
  if (!res.ok) throw new Error("이슈 월별 목록 조회에 실패했습니다.");
  return res.json();
};

/**
 * 이슈 등록
 * @param {object} data - { issue_date, issue_type, content, action_taken, is_resolved }
 */
export const createIssue = async (data) => {
  const res = await fetch(`${BASE_URL}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "이슈 등록에 실패했습니다.");
  }
  return res.json();
};

/**
 * 이슈 수정 (처리내역 추가, 완료 처리 등)
 * @param {number} id - 이슈 ID
 * @param {object} data - { issue_type?, content?, action_taken?, is_resolved? }
 */
export const updateIssue = async (id, data) => {
  const res = await fetch(`${BASE_URL}/issues/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "이슈 수정에 실패했습니다.");
  }
  return res.json();
};

/**
 * 이슈 삭제
 * @param {number} id - 이슈 ID
 */
export const deleteIssue = async (id) => {
  const res = await fetch(`${BASE_URL}/issues/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "이슈 삭제에 실패했습니다.");
  }
  return res.json();
};
