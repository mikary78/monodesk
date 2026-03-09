// ============================================================
// AttendanceList.jsx — 출퇴근 기록 관리 컴포넌트
// 월별 출퇴근 기록 목록, 입력/수정/삭제 기능을 제공합니다.
// ============================================================

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Clock, ChevronDown, ClipboardList } from "lucide-react";
import {
  fetchAttendance, fetchEmployees, createAttendance,
  updateAttendance, deleteAttendance, formatHours
} from "../../../api/employeeApi";
import AttendanceFormModal from "./AttendanceFormModal";

/**
 * 출퇴근 기록 관리 컴포넌트
 * @param {number} year - 조회 연도
 * @param {number} month - 조회 월
 */
const AttendanceList = ({ year, month }) => {
  // 출퇴근 기록 상태
  const [records, setRecords] = useState([]);
  // 직원 목록 (필터용)
  const [employees, setEmployees] = useState([]);
  // 선택된 직원 필터
  const [selectedEmployee, setSelectedEmployee] = useState("");
  // 로딩 상태
  const [loading, setLoading] = useState(true);
  // 에러 메시지
  const [error, setError] = useState(null);
  // 등록/수정 모달 표시 여부
  const [showModal, setShowModal] = useState(false);
  // 수정할 기록 (null이면 신규)
  const [editingRecord, setEditingRecord] = useState(null);

  // 연도/월 변경 시 데이터 다시 불러오기
  useEffect(() => {
    loadData();
  }, [year, month, selectedEmployee]);

  /**
   * 출퇴근 기록 + 직원 목록 로드
   */
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [attendanceData, employeeData] = await Promise.all([
        fetchAttendance(year, month, selectedEmployee || null),
        fetchEmployees(false),
      ]);
      setRecords(attendanceData);
      setEmployees(employeeData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 기록 삭제 처리
   * @param {object} record - 삭제할 기록
   */
  const handleDelete = async (record) => {
    const employee = employees.find((e) => e.id === record.employee_id);
    const name = employee ? employee.name : "직원";
    if (!window.confirm(`${name}의 ${record.work_date} 출퇴근 기록을 삭제하시겠습니까?`)) return;
    try {
      await deleteAttendance(record.id);
      await loadData();
    } catch (err) {
      alert(`삭제 중 오류가 발생했습니다: ${err.message}`);
    }
  };

  /**
   * 직원명 찾기 (employee_id → 이름)
   * @param {number} employeeId - 직원 ID
   * @returns {string} 직원 이름
   */
  const getEmployeeName = (employeeId) => {
    const emp = employees.find((e) => e.id === employeeId);
    return emp ? emp.name : `직원 #${employeeId}`;
  };

  /**
   * 요일 문자열 반환 (YYYY-MM-DD → 요일)
   * @param {string} dateStr - 날짜 문자열
   * @returns {string} 요일
   */
  const getDayOfWeek = (dateStr) => {
    const days = ["일", "월", "화", "수", "목", "금", "토"];
    const date = new Date(dateStr);
    return days[date.getDay()];
  };

  /**
   * 연장/야간 수당 여부 배지
   */
  const renderWorkBadges = (record) => {
    const badges = [];
    if (record.overtime_hours > 0) {
      badges.push(
        <span key="ot" className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded">
          연장 {formatHours(record.overtime_hours)}
        </span>
      );
    }
    if (record.night_hours > 0) {
      badges.push(
        <span key="nt" className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded">
          야간 {formatHours(record.night_hours)}
        </span>
      );
    }
    return badges;
  };

  // 월 근무시간 합계
  const totalWorkHours = records.reduce((sum, r) => sum + (r.work_hours || 0), 0);
  const totalOvertimeHours = records.reduce((sum, r) => sum + (r.overtime_hours || 0), 0);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
            <div className="flex gap-4">
              <div className="w-24 h-4 bg-slate-200 rounded" />
              <div className="w-16 h-4 bg-slate-200 rounded" />
              <div className="flex-1 h-4 bg-slate-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* 상단 필터 + 집계 + 등록 버튼 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* 직원 필터 */}
          <div className="relative">
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="h-9 pl-3 pr-8 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
            >
              <option value="">전체 직원</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* 집계 정보 */}
          {records.length > 0 && (
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Clock size={14} />
                총 근무 {formatHours(totalWorkHours)}
              </span>
              {totalOvertimeHours > 0 && (
                <span className="text-orange-500">연장 {formatHours(totalOvertimeHours)}</span>
              )}
            </div>
          )}
        </div>

        {/* 출퇴근 기록 입력 버튼 */}
        <button
          onClick={() => { setEditingRecord(null); setShowModal(true); }}
          className="flex items-center gap-2 h-9 px-4 bg-blue-500 text-white text-sm font-semibold rounded-md hover:bg-blue-600 transition-colors"
          title="출퇴근 기록 입력"
        >
          <Plus size={16} />
          출퇴근 입력
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 출퇴근 기록 테이블 */}
      {records.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm flex flex-col items-center justify-center py-16">
          <ClipboardList size={48} className="text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">출퇴근 기록이 없습니다.</p>
          <p className="text-slate-400 text-sm mt-1">출퇴근 입력 버튼으로 기록을 추가해보세요.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3 w-32">날짜</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3 w-28">직원</th>
                <th className="text-center text-xs font-semibold text-slate-500 uppercase px-4 py-3 w-24">출근</th>
                <th className="text-center text-xs font-semibold text-slate-500 uppercase px-4 py-3 w-24">퇴근</th>
                <th className="text-center text-xs font-semibold text-slate-500 uppercase px-4 py-3 w-28">근무시간</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">수당</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase px-4 py-3">메모</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase px-4 py-3 w-20">관리</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, idx) => {
                const dayOfWeek = getDayOfWeek(record.work_date);
                const isWeekend = dayOfWeek === "토" || dayOfWeek === "일";
                return (
                  <tr
                    key={record.id}
                    className={`border-b border-slate-100 hover:bg-blue-50/30 transition-colors ${
                      idx % 2 === 0 ? "" : "bg-slate-50/50"
                    }`}
                  >
                    {/* 날짜 */}
                    <td className="px-4 py-3 text-sm">
                      <span className="text-slate-900">{record.work_date}</span>
                      <span className={`ml-1 text-xs font-medium ${
                        isWeekend ? "text-red-400" : "text-slate-400"
                      }`}>
                        ({dayOfWeek})
                      </span>
                    </td>
                    {/* 직원명 */}
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {getEmployeeName(record.employee_id)}
                    </td>
                    {/* 출근 시각 */}
                    <td className="px-4 py-3 text-sm text-center text-slate-600">
                      {record.clock_in || "-"}
                    </td>
                    {/* 퇴근 시각 */}
                    <td className="px-4 py-3 text-sm text-center text-slate-600">
                      {record.clock_out || "-"}
                    </td>
                    {/* 근무시간 */}
                    <td className="px-4 py-3 text-sm text-center font-medium text-slate-900">
                      {record.work_hours ? formatHours(record.work_hours) : "-"}
                    </td>
                    {/* 수당 배지 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {renderWorkBadges(record)}
                      </div>
                    </td>
                    {/* 메모 */}
                    <td className="px-4 py-3 text-sm text-slate-500 max-w-[150px] truncate">
                      {record.memo || ""}
                    </td>
                    {/* 관리 버튼 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditingRecord(record); setShowModal(true); }}
                          className="h-7 w-7 flex items-center justify-center border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                          title="수정"
                        >
                          <Edit size={13} className="text-slate-500" />
                        </button>
                        <button
                          onClick={() => handleDelete(record)}
                          className="h-7 w-7 flex items-center justify-center border border-red-200 rounded hover:bg-red-50 transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={13} className="text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 출퇴근 기록 입력/수정 모달 */}
      {showModal && (
        <AttendanceFormModal
          record={editingRecord}
          employees={employees}
          year={year}
          month={month}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadData(); }}
        />
      )}
    </div>
  );
};

export default AttendanceList;
