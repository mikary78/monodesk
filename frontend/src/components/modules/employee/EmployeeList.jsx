// ============================================================
// EmployeeList.jsx — 직원 목록 컴포넌트
// 직원 카드 목록, 등록/수정/삭제, 근로계약서 업로드 기능을 제공합니다.
// ============================================================

import { useState, useEffect, useRef } from "react";
import {
  Plus, Edit, Trash2, User, Phone, Briefcase,
  ShieldCheck, ShieldOff, Search, UserX,
  Upload, Download, Trash
} from "lucide-react";
import {
  fetchEmployees, deleteEmployee, uploadContract,
  downloadContract, deleteContract,
  formatEmploymentType, formatSalaryType, formatCurrency, formatDate
} from "../../../api/employeeApi";
import EmployeeFormModal from "./EmployeeFormModal";
import { useToast } from "../../../contexts/ToastContext";
import ConfirmDialog from "../../common/ConfirmDialog";

/**
 * 직원 목록 컴포넌트
 */
const EmployeeList = () => {
  const toast = useToast();
  // 직원 목록 상태
  const [employees, setEmployees] = useState([]);
  // 로딩 상태
  const [loading, setLoading] = useState(true);
  // 에러 메시지
  const [error, setError] = useState(null);
  // 검색어
  const [searchQuery, setSearchQuery] = useState("");
  // 퇴사자 포함 여부
  const [includeResigned, setIncludeResigned] = useState(false);
  // 등록/수정 모달 표시 여부
  const [showModal, setShowModal] = useState(false);
  // 수정할 직원 (null이면 신규 등록)
  const [editingEmployee, setEditingEmployee] = useState(null);
  // 파일 업로드 로딩 (직원 ID → boolean)
  const [uploadingMap, setUploadingMap] = useState({});
  // 숨겨진 파일 input ref (근로계약서 업로드 트리거용)
  const fileInputRef = useRef(null);
  // 현재 계약서 업로드 대상 직원 ID
  const [contractTargetId, setContractTargetId] = useState(null);
  // 직원 삭제 확인 다이얼로그 상태
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, employee: null });
  // 계약서 삭제 확인 다이얼로그 상태
  const [contractDeleteConfirm, setContractDeleteConfirm] = useState({ open: false, employee: null });

  // 마운트 / 퇴사자 포함 변경 시 직원 목록 불러오기
  useEffect(() => {
    loadEmployees();
  }, [includeResigned]);

  /**
   * 직원 목록 데이터 불러오기
   */
  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchEmployees(includeResigned);
      setEmployees(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 직원 삭제 버튼 클릭 → 확인 다이얼로그 열기
   * @param {object} employee - 삭제할 직원 객체
   */
  const handleDeleteClick = (employee) => {
    setDeleteConfirm({ open: true, employee });
  };

  /** 직원 삭제 확인 → 실제 삭제 실행 */
  const handleDeleteConfirm = async () => {
    const employee = deleteConfirm.employee;
    setDeleteConfirm({ open: false, employee: null });
    try {
      await deleteEmployee(employee.id);
      await loadEmployees();
    } catch (err) {
      toast.error(`삭제 중 오류가 발생했습니다: ${err.message}`);
    }
  };

  /**
   * 근로계약서 업로드 버튼 클릭 — 숨겨진 파일 input 트리거
   * @param {number} employeeId - 직원 ID
   */
  const handleContractUploadClick = (employeeId) => {
    setContractTargetId(employeeId);
    fileInputRef.current?.click();
  };

  /**
   * 파일 선택 후 서버로 업로드
   * @param {Event} e - 파일 입력 이벤트
   */
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !contractTargetId) return;

    // 파일 크기 10MB 제한
    if (file.size > 10 * 1024 * 1024) {
      toast.error("파일 크기는 10MB 이하만 업로드 가능합니다.");
      e.target.value = "";
      return;
    }

    try {
      setUploadingMap((prev) => ({ ...prev, [contractTargetId]: true }));
      await uploadContract(contractTargetId, file);
      await loadEmployees();
      toast.success("근로계약서가 업로드되었습니다.");
    } catch (err) {
      toast.error(`업로드 오류: ${err.message}`);
    } finally {
      setUploadingMap((prev) => ({ ...prev, [contractTargetId]: false }));
      setContractTargetId(null);
      e.target.value = "";
    }
  };

  /**
   * 근로계약서 삭제 버튼 클릭 → 확인 다이얼로그 열기
   * @param {object} employee - 직원 객체
   */
  const handleContractDeleteClick = (employee) => {
    setContractDeleteConfirm({ open: true, employee });
  };

  /** 근로계약서 삭제 확인 → 실제 삭제 실행 */
  const handleContractDeleteConfirm = async () => {
    const employee = contractDeleteConfirm.employee;
    setContractDeleteConfirm({ open: false, employee: null });
    try {
      await deleteContract(employee.id);
      await loadEmployees();
    } catch (err) {
      toast.error(`삭제 오류: ${err.message}`);
    }
  };

  // 검색어로 직원 필터링
  const filteredEmployees = employees.filter((emp) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      (emp.position && emp.position.toLowerCase().includes(q)) ||
      (emp.phone && emp.phone.includes(q))
    );
  });

  // 고용 형태별 배지 스타일
  const getEmploymentBadgeStyle = (type) =>
    type === "FULL_TIME"
      ? "bg-blue-100 text-blue-700"
      : "bg-amber-100 text-amber-700";

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-1/4" />
                <div className="h-3 bg-slate-200 rounded w-1/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* 숨겨진 파일 input (근로계약서 업로드용) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleFileChange}
        className="hidden"
        aria-label="근로계약서 파일 선택"
      />

      {/* 상단 필터 + 등록 버튼 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* 검색 입력 */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="이름, 직무, 연락처 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 pr-4 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
            />
          </div>
          {/* 퇴사자 포함 토글 */}
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeResigned}
              onChange={(e) => setIncludeResigned(e.target.checked)}
              className="w-4 h-4 rounded text-blue-500"
            />
            퇴사자 포함
          </label>
        </div>

        {/* 신규 등록 버튼 */}
        <button
          onClick={() => { setEditingEmployee(null); setShowModal(true); }}
          className="flex items-center gap-2 h-9 px-4 bg-blue-500 text-white text-sm font-semibold rounded-md hover:bg-blue-600 transition-colors"
          title="직원 등록"
        >
          <Plus size={16} />
          직원 등록
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 빈 상태 */}
      {filteredEmployees.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm flex flex-col items-center justify-center py-16">
          <UserX size={48} className="text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">
            {searchQuery ? "검색 결과가 없습니다." : "등록된 직원이 없습니다."}
          </p>
          {!searchQuery && (
            <>
              <p className="text-slate-400 text-sm mt-1">직원 등록 버튼을 눌러 첫 직원을 추가해보세요.</p>
              <button
                onClick={() => { setEditingEmployee(null); setShowModal(true); }}
                className="mt-4 flex items-center gap-2 h-9 px-4 bg-blue-500 text-white text-sm font-semibold rounded-md hover:bg-blue-600 transition-colors"
              >
                <Plus size={16} />
                직원 등록하기
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEmployees.map((emp) => (
            <div
              key={emp.id}
              className={`bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow ${
                emp.resign_date ? "opacity-60" : ""
              }`}
            >
              {/* 메인 정보 행 */}
              <div className="flex items-center justify-between p-5">
                {/* 아바타 + 이름 영역 */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User size={20} className="text-slate-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-base">{emp.name}</span>
                      {emp.resign_date && (
                        <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded font-medium">
                          퇴사
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${getEmploymentBadgeStyle(emp.employment_type)}`}>
                        {formatEmploymentType(emp.employment_type)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                      {emp.position && (
                        <span className="flex items-center gap-1">
                          <Briefcase size={12} />
                          {emp.position}
                        </span>
                      )}
                      {emp.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          {emp.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 우측 정보 + 버튼 영역 */}
                <div className="flex items-center gap-4">
                  {/* 급여 정보 */}
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">
                      {emp.salary_type === "HOURLY"
                        ? `${formatCurrency(emp.hourly_wage)} / 시`
                        : formatCurrency(emp.monthly_salary)}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{formatSalaryType(emp.salary_type)}</div>
                  </div>

                  {/* 4대보험 아이콘 */}
                  <div className="flex flex-col items-center">
                    {emp.has_insurance ? (
                      <ShieldCheck size={20} className="text-green-500" title="4대보험 적용" />
                    ) : (
                      <ShieldOff size={20} className="text-slate-300" title="4대보험 미적용" />
                    )}
                    <span className="text-xs text-slate-400 mt-0.5">
                      {emp.has_insurance ? "4대보험" : "미적용"}
                    </span>
                  </div>

                  {/* 입사일 */}
                  <div className="text-right">
                    <div className="text-xs text-slate-400">입사</div>
                    <div className="text-sm font-medium text-slate-600">{formatDate(emp.hire_date) || "-"}</div>
                  </div>

                  {/* 근로계약서 버튼 */}
                  <div className="flex items-center gap-1">
                    {emp.contract_file_path ? (
                      <>
                        {/* 다운로드 버튼 */}
                        <button
                          onClick={() => downloadContract(emp.id)}
                          className="h-8 px-2 flex items-center gap-1 border border-green-200 text-green-600 text-xs rounded hover:bg-green-50 transition-colors"
                          title="근로계약서 다운로드"
                        >
                          <Download size={13} />
                          계약서
                        </button>
                        {/* 계약서 삭제 버튼 */}
                        <button
                          onClick={() => handleContractDeleteClick(emp)}
                          className="h-8 w-8 flex items-center justify-center border border-slate-200 rounded hover:bg-red-50 transition-colors"
                          title="계약서 삭제"
                        >
                          <Trash size={13} className="text-slate-400 hover:text-red-400" />
                        </button>
                      </>
                    ) : (
                      /* 업로드 버튼 */
                      <button
                        onClick={() => handleContractUploadClick(emp.id)}
                        disabled={uploadingMap[emp.id]}
                        className="h-8 px-2 flex items-center gap-1 border border-slate-200 text-slate-500 text-xs rounded hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        title="근로계약서 업로드 (PDF/이미지)"
                      >
                        {uploadingMap[emp.id] ? (
                          <span>업로드 중...</span>
                        ) : (
                          <>
                            <Upload size={13} />
                            계약서
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* 수정 / 삭제 버튼 */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingEmployee(emp); setShowModal(true); }}
                      className="h-8 w-8 flex items-center justify-center border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                      title="직원 정보 수정"
                    >
                      <Edit size={14} className="text-slate-500" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(emp)}
                      className="h-8 w-8 flex items-center justify-center border border-red-200 rounded hover:bg-red-50 transition-colors"
                      title="직원 삭제"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 등록/수정 모달 */}
      {showModal && (
        <EmployeeFormModal
          employee={editingEmployee}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadEmployees(); }}
        />
      )}

      {/* 직원 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        title="직원 삭제"
        message={`"${deleteConfirm.employee?.name}" 직원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm({ open: false, employee: null })}
      />

      {/* 근로계약서 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={contractDeleteConfirm.open}
        title="근로계약서 삭제"
        message={`"${contractDeleteConfirm.employee?.name}"의 근로계약서를 삭제하시겠습니까?`}
        confirmText="삭제"
        variant="danger"
        onConfirm={handleContractDeleteConfirm}
        onCancel={() => setContractDeleteConfirm({ open: false, employee: null })}
      />
    </div>
  );
};

export default EmployeeList;
