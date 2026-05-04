// ============================================================
// CalendarAttendanceTab.jsx — 출퇴근 관리 캘린더 뷰 컴포넌트
// 월별 캘린더에서 날짜별 출근 인원을 확인하고
// 날짜 클릭 시 해당 날짜의 직원별 출퇴근 기록을 패널에서 편집합니다.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  X, Clock, Edit2, Check, ChevronLeft, ChevronRight,
  UserCheck, ClipboardList, Plus,
} from "lucide-react";
import {
  fetchAttendance, fetchEmployees, createAttendance,
  updateAttendance, deleteAttendance,
  calculateWorkHours, formatHours,
} from "../../../api/employeeApi";
import { useToast } from "../../../contexts/ToastContext";
import AttendanceFormModal from "./AttendanceFormModal";

// 요일 레이블 (일~토)
const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// daily_status 한국어 레이블 및 색상
const STATUS_CONFIG = {
  work:            { label: "근무",     color: "bg-blue-100 text-blue-700" },
  off:             { label: "휴무",     color: "bg-slate-100 text-slate-500" },
  annual:          { label: "연차",     color: "bg-green-100 text-green-700" },
  half_am:         { label: "반차(오전)", color: "bg-teal-100 text-teal-700" },
  half_pm:         { label: "반차(오후)", color: "bg-cyan-100 text-cyan-700" },
  absent:          { label: "결근",     color: "bg-red-100 text-red-700" },
  early_leave:     { label: "조퇴",     color: "bg-orange-100 text-orange-700" },
  recommended_off: { label: "권장휴무", color: "bg-yellow-100 text-yellow-700" },
  support:         { label: "지원",     color: "bg-purple-100 text-purple-700" },
};

/**
 * 출퇴근 관리 캘린더 뷰 컴포넌트
 * @param {number} year - 조회 연도
 * @param {number} month - 조회 월
 * @param {boolean} staffOnly - true면 본인 기록만 조회 (staff 역할)
 */
const CalendarAttendanceTab = ({ year, month, staffOnly = false }) => {
  const toast = useToast();

  // 전체 직원 목록
  const [employees, setEmployees] = useState([]);
  // 출퇴근 기록 (month 전체, 배열)
  const [allRecords, setAllRecords] = useState([]);
  // 로딩 상태
  const [loading, setLoading] = useState(true);
  // 에러 메시지
  const [error, setError] = useState(null);
  // 선택된 날짜 (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState(null);
  // 날짜별 출퇴근 기록 맵: { "YYYY-MM-DD": [record, ...] }
  const [dateRecordMap, setDateRecordMap] = useState({});
  // 패널에서 인라인 편집 중인 기록 ID
  const [editingId, setEditingId] = useState(null);
  // 인라인 편집 임시 데이터
  const [editingData, setEditingData] = useState({});
  // 신규 등록 모달 (AttendanceFormModal) 표시 여부
  const [showModal, setShowModal] = useState(false);
  // 수정 모달 대상 기록
  const [editingRecord, setEditingRecord] = useState(null);

  // 연도/월 변경 시 데이터 재로드
  useEffect(() => {
    loadData();
    setSelectedDate(null);
    setEditingId(null);
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 직원 목록 + 출퇴근 기록 로드
   */
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [empData, recordData] = await Promise.all([
        fetchEmployees(false),
        fetchAttendance(year, month, null),
      ]);
      setEmployees(empData);
      setAllRecords(recordData);
      // 날짜별 기록 맵으로 변환
      const map = {};
      for (const rec of recordData) {
        if (!map[rec.work_date]) map[rec.work_date] = [];
        map[rec.work_date].push(rec);
      }
      setDateRecordMap(map);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  // ─────────────────────────────────────────
  // 달력 생성 헬퍼
  // ─────────────────────────────────────────

  /**
   * 해당 월의 달력 셀 배열 생성 (6행 × 7열 = 42셀)
   * null: 이전/다음 달 날짜 (빈 셀), string: "YYYY-MM-DD"
   */
  const buildCalendarCells = () => {
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0(일)~6(토)
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells = [];

    // 첫 주 앞 빈 칸
    for (let i = 0; i < firstDay; i++) {
      cells.push(null);
    }

    // 날짜 채우기
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push(dateStr);
    }

    // 마지막 주 뒷 빈 칸 (6행 완성)
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    return cells;
  };

  /**
   * 특정 날짜의 출근 직원 수 반환
   */
  const getWorkCount = (dateStr) => {
    if (!dateStr) return 0;
    const records = dateRecordMap[dateStr] || [];
    return records.filter((r) => r.daily_status === "work" || (!r.daily_status && r.clock_in)).length;
  };

  /**
   * 특정 날짜의 전체 기록 수 반환 (출근 외 상태 포함)
   */
  const getTotalRecordCount = (dateStr) => {
    if (!dateStr) return 0;
    return (dateRecordMap[dateStr] || []).length;
  };

  // ─────────────────────────────────────────
  // 패널 데이터 (선택된 날짜의 직원별 기록)
  // ─────────────────────────────────────────

  /**
   * 패널에 표시할 직원별 기록 목록.
   * 기록이 없는 직원은 "미등록" 상태로 표시합니다.
   */
  const getPanelRows = () => {
    if (!selectedDate) return [];
    const dayRecords = dateRecordMap[selectedDate] || [];

    if (staffOnly) {
      // staff 본인 기록만
      return dayRecords.map((r) => ({
        employee: employees.find((e) => e.id === r.employee_id),
        record: r,
      })).filter((row) => row.employee);
    }

    // 전체 직원 × 기록 매핑
    return employees.map((emp) => ({
      employee: emp,
      record: dayRecords.find((r) => r.employee_id === emp.id) || null,
    }));
  };

  // ─────────────────────────────────────────
  // 인라인 편집 핸들러
  // ─────────────────────────────────────────

  /** 인라인 편집 시작 */
  const startEditing = (record) => {
    setEditingId(record.id);
    setEditingData({
      clock_in: record.clock_in || "",
      clock_out: record.clock_out || "",
      memo: record.memo || "",
    });
  };

  /** 인라인 편집 취소 */
  const cancelEditing = () => {
    setEditingId(null);
    setEditingData({});
  };

  /** 인라인 편집 저장 */
  const saveEditing = async (recordId) => {
    try {
      await updateAttendance(recordId, {
        clock_in: editingData.clock_in || null,
        clock_out: editingData.clock_out || null,
        memo: editingData.memo || null,
      });
      toast.success("출퇴근 기록이 수정되었습니다.");
      setEditingId(null);
      setEditingData({});
      await loadData();
    } catch (err) {
      toast.error(`수정 오류: ${err.message}`);
    }
  };

  /** 출퇴근 기록 삭제 */
  const handleDelete = async (record) => {
    const emp = employees.find((e) => e.id === record.employee_id);
    const name = emp ? emp.name : `직원 #${record.employee_id}`;
    if (!window.confirm(`${name}의 ${record.work_date} 출퇴근 기록을 삭제하시겠습니까?`)) return;
    try {
      await deleteAttendance(record.id);
      toast.success("출퇴근 기록이 삭제되었습니다.");
      await loadData();
    } catch (err) {
      toast.error(`삭제 오류: ${err.message}`);
    }
  };

  // ─────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
            <div className="h-64 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  const cells = buildCalendarCells();
  const panelRows = getPanelRows();
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="flex gap-4">
      {/* ── 달력 영역 ── */}
      <div className={`flex-shrink-0 ${selectedDate ? "w-1/2" : "w-full"}`}>
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* 달력 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-slate-200">
            {DAY_LABELS.map((day, idx) => (
              <div
                key={day}
                className={`py-2 text-center text-xs font-semibold ${
                  idx === 0 ? "text-red-400" : idx === 6 ? "text-blue-400" : "text-slate-500"
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 달력 셀 */}
          <div className="grid grid-cols-7">
            {cells.map((dateStr, cellIdx) => {
              if (!dateStr) {
                // 빈 셀 (이전/다음 달)
                return (
                  <div
                    key={`empty-${cellIdx}`}
                    className="min-h-[80px] border-b border-r border-slate-100 bg-slate-50/50"
                  />
                );
              }

              const dayNum = new Date(dateStr).getDate();
              const dayOfWeek = new Date(dateStr).getDay();
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDate;
              const workCount = getWorkCount(dateStr);
              const totalCount = getTotalRecordCount(dateStr);
              const isSunday = dayOfWeek === 0;
              const isSaturday = dayOfWeek === 6;

              return (
                <div
                  key={dateStr}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`min-h-[80px] border-b border-r border-slate-100 p-1.5 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-50 border-blue-200"
                      : "hover:bg-slate-50"
                  }`}
                >
                  {/* 날짜 숫자 */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? "bg-blue-500 text-white"
                          : isSunday
                          ? "text-red-400"
                          : isSaturday
                          ? "text-blue-400"
                          : "text-slate-700"
                      }`}
                    >
                      {dayNum}
                    </span>
                    {/* 출근 인원 배지 */}
                    {workCount > 0 && (
                      <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full font-medium">
                        {workCount}
                      </span>
                    )}
                  </div>

                  {/* 기타 기록 요약 (비근무 상태) */}
                  {totalCount > workCount && (
                    <div className="flex flex-wrap gap-0.5 mt-1">
                      {(dateRecordMap[dateStr] || [])
                        .filter((r) => r.daily_status && r.daily_status !== "work")
                        .slice(0, 3)
                        .map((r) => {
                          const cfg = STATUS_CONFIG[r.daily_status] || {};
                          return (
                            <span
                              key={r.id}
                              className={`text-[10px] px-1 py-0 rounded ${cfg.color || "bg-slate-100 text-slate-500"}`}
                            >
                              {cfg.label || r.daily_status}
                            </span>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 달력 범례 */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-4 bg-blue-500 text-white rounded-full text-center text-[10px] leading-4">N</span>
            출근 인원수
          </span>
          {Object.entries(STATUS_CONFIG).filter(([k]) => k !== "work").map(([key, cfg]) => (
            <span key={key} className={`px-1.5 py-0.5 rounded ${cfg.color}`}>{cfg.label}</span>
          ))}
        </div>
      </div>

      {/* ── 날짜별 출퇴근 패널 ── */}
      {selectedDate && (
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {/* 패널 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <UserCheck size={16} className="text-blue-500" />
                <span className="text-sm font-semibold text-slate-900">
                  {selectedDate}
                  <span className="ml-1 text-slate-400 font-normal text-xs">
                    ({DAY_LABELS[new Date(selectedDate).getDay()]})
                  </span>
                </span>
                <span className="text-xs text-slate-400">
                  출근 {getWorkCount(selectedDate)}명
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* 신규 출퇴근 등록 버튼 */}
                {!staffOnly && (
                  <button
                    onClick={() => { setEditingRecord(null); setShowModal(true); }}
                    className="flex items-center gap-1 h-7 px-2.5 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                  >
                    <Plus size={12} />
                    출퇴근 입력
                  </button>
                )}
                {/* 패널 닫기 */}
                <button
                  onClick={() => setSelectedDate(null)}
                  className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-200 transition-colors"
                >
                  <X size={15} className="text-slate-500" />
                </button>
              </div>
            </div>

            {/* 직원별 출퇴근 목록 */}
            <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
              {panelRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <ClipboardList size={36} className="text-slate-300 mb-2" />
                  <p className="text-sm text-slate-400">이 날짜의 출퇴근 기록이 없습니다.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="text-left text-xs font-semibold text-slate-400 px-3 py-2 w-20">직원</th>
                      <th className="text-center text-xs font-semibold text-slate-400 px-3 py-2 w-16">출근</th>
                      <th className="text-center text-xs font-semibold text-slate-400 px-3 py-2 w-16">퇴근</th>
                      <th className="text-center text-xs font-semibold text-slate-400 px-3 py-2 w-20">근무시간</th>
                      <th className="text-left text-xs font-semibold text-slate-400 px-3 py-2">상태</th>
                      {!staffOnly && (
                        <th className="text-right text-xs font-semibold text-slate-400 px-3 py-2 w-16">관리</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {panelRows.map(({ employee, record }) => {
                      const isEditing = editingId === record?.id;
                      const statusCfg = record?.daily_status
                        ? STATUS_CONFIG[record.daily_status]
                        : null;

                      return (
                        <tr
                          key={employee?.id}
                          className={`border-b border-slate-100 ${
                            isEditing ? "bg-blue-50" : "hover:bg-slate-50"
                          }`}
                        >
                          {/* 직원명 */}
                          <td className="px-3 py-2 text-sm font-medium text-slate-900">
                            {employee?.name || "-"}
                          </td>

                          {/* 출근 시각 */}
                          <td className="px-3 py-2 text-center">
                            {isEditing ? (
                              <input
                                type="time"
                                value={editingData.clock_in}
                                onChange={(e) =>
                                  setEditingData((prev) => ({ ...prev, clock_in: e.target.value }))
                                }
                                className="w-20 text-xs border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            ) : (
                              <span className="text-xs text-slate-600">
                                {record?.clock_in || "-"}
                              </span>
                            )}
                          </td>

                          {/* 퇴근 시각 */}
                          <td className="px-3 py-2 text-center">
                            {isEditing ? (
                              <input
                                type="time"
                                value={editingData.clock_out}
                                onChange={(e) =>
                                  setEditingData((prev) => ({ ...prev, clock_out: e.target.value }))
                                }
                                className="w-20 text-xs border border-slate-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            ) : (
                              <span className="text-xs text-slate-600">
                                {record?.clock_out || "-"}
                              </span>
                            )}
                          </td>

                          {/* 근무시간 */}
                          <td className="px-3 py-2 text-center text-xs text-slate-600">
                            {record?.work_hours ? formatHours(record.work_hours) : "-"}
                          </td>

                          {/* 상태 배지 */}
                          <td className="px-3 py-2">
                            {record ? (
                              statusCfg ? (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>
                                  {statusCfg.label}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )
                            ) : (
                              <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">
                                미등록
                              </span>
                            )}
                          </td>

                          {/* 관리 버튼 */}
                          {!staffOnly && (
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                {record && isEditing ? (
                                  <>
                                    <button
                                      onClick={() => saveEditing(record.id)}
                                      className="h-6 w-6 flex items-center justify-center bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                                      title="저장"
                                    >
                                      <Check size={11} />
                                    </button>
                                    <button
                                      onClick={cancelEditing}
                                      className="h-6 w-6 flex items-center justify-center border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                                      title="취소"
                                    >
                                      <X size={11} className="text-slate-400" />
                                    </button>
                                  </>
                                ) : record ? (
                                  <>
                                    <button
                                      onClick={() => startEditing(record)}
                                      className="h-6 w-6 flex items-center justify-center border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                                      title="수정"
                                    >
                                      <Edit2 size={11} className="text-slate-500" />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(record)}
                                      className="h-6 w-6 flex items-center justify-center border border-red-200 rounded hover:bg-red-50 transition-colors"
                                      title="삭제"
                                    >
                                      <X size={11} className="text-red-400" />
                                    </button>
                                  </>
                                ) : (
                                  // 기록 없는 직원: 바로 등록 버튼
                                  <button
                                    onClick={() => {
                                      setEditingRecord(null);
                                      setShowModal(true);
                                    }}
                                    className="h-6 px-1.5 flex items-center gap-0.5 text-[10px] text-slate-400 border border-dashed border-slate-200 rounded hover:border-blue-300 hover:text-blue-500 transition-colors"
                                    title="기록 등록"
                                  >
                                    <Plus size={9} />
                                    등록
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 출퇴근 기록 입력/수정 모달 */}
      {showModal && (
        <AttendanceFormModal
          record={editingRecord}
          employees={employees}
          year={year}
          month={month}
          defaultDate={selectedDate}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadData(); }}
        />
      )}
    </div>
  );
};

export default CalendarAttendanceTab;
