// ============================================================
// SalaryPanel.jsx — 급여 정산 패널 컴포넌트
// 월별 급여 계산, 미리보기, 정산 저장, 지급 처리를 담당합니다.
// ============================================================

import { useState, useEffect } from "react";
import {
  DollarSign, Calculator, CheckCircle, Circle,
  ChevronDown, AlertTriangle, Info, Wallet, History, X
} from "lucide-react";
import {
  fetchEmployees, fetchSalaryOverview, calculateSalary,
  saveSalary, updateSalaryRecord, fetchSalaryHistory,
  formatCurrency, formatHours, formatEmploymentType, formatSalaryType, formatDate
} from "../../../api/employeeApi";

/**
 * 급여 정산 패널 컴포넌트
 * @param {number} year - 정산 연도
 * @param {number} month - 정산 월
 */
const SalaryPanel = ({ year, month }) => {
  // 직원 목록
  const [employees, setEmployees] = useState([]);
  // 월별 급여 요약
  const [overview, setOverview] = useState(null);
  // 급여 계산 결과 (직원 ID → 계산 결과)
  const [calculations, setCalculations] = useState({});
  // 로딩 상태 (직원별)
  const [loadingMap, setLoadingMap] = useState({});
  // 전체 로딩
  const [loading, setLoading] = useState(true);
  // 에러
  const [error, setError] = useState(null);
  // 상세 보기 확장된 직원 ID
  const [expandedEmployee, setExpandedEmployee] = useState(null);
  // 급여 이력 모달 대상 직원
  const [historyEmployee, setHistoryEmployee] = useState(null);
  // 급여 이력 데이터
  const [historyData, setHistoryData] = useState([]);
  // 이력 로딩
  const [historyLoading, setHistoryLoading] = useState(false);

  // 연도/월 변경 시 데이터 재로드
  useEffect(() => {
    loadData();
  }, [year, month]);

  /**
   * 직원 목록 + 급여 요약 로드
   */
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [empData, overviewData] = await Promise.all([
        fetchEmployees(false),
        fetchSalaryOverview(year, month).catch(() => null),
      ]);
      setEmployees(empData);
      setOverview(overviewData);
      // 탭 변경 시 계산 결과 초기화
      setCalculations({});
      setExpandedEmployee(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 특정 직원의 급여 계산
   * @param {number} employeeId - 직원 ID
   */
  const handleCalculate = async (employeeId) => {
    try {
      setLoadingMap((prev) => ({ ...prev, [employeeId]: true }));
      const result = await calculateSalary(employeeId, year, month);
      setCalculations((prev) => ({ ...prev, [employeeId]: result }));
      // 계산 후 자동으로 상세 펼치기
      setExpandedEmployee(employeeId);
    } catch (err) {
      alert(`급여 계산 오류: ${err.message}`);
    } finally {
      setLoadingMap((prev) => ({ ...prev, [employeeId]: false }));
    }
  };

  /**
   * 특정 직원의 급여를 저장 (정산 확정)
   * @param {number} employeeId - 직원 ID
   * @param {string} employeeName - 직원 이름
   */
  const handleSave = async (employeeId, employeeName) => {
    if (!window.confirm(`"${employeeName}"의 ${year}년 ${month}월 급여를 확정 저장하시겠습니까?`)) return;
    try {
      setLoadingMap((prev) => ({ ...prev, [employeeId]: true }));
      await saveSalary(employeeId, year, month);
      await loadData();
      alert(`${employeeName}의 ${month}월 급여가 저장되었습니다.`);
    } catch (err) {
      alert(`저장 오류: ${err.message}`);
    } finally {
      setLoadingMap((prev) => ({ ...prev, [employeeId]: false }));
    }
  };

  /**
   * 지급 완료 처리 토글
   * @param {number} salaryId - 정산 기록 ID
   * @param {boolean} isPaid - 현재 지급 여부 (반전 처리)
   */
  const handleMarkPaid = async (salaryId, isPaid) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      await updateSalaryRecord(salaryId, {
        is_paid: isPaid,
        paid_date: isPaid ? today : null,
      });
      await loadData();
    } catch (err) {
      alert(`처리 중 오류가 발생했습니다: ${err.message}`);
    }
  };

  /**
   * 전체 직원 일괄 급여 계산
   */
  const handleCalculateAll = async () => {
    if (!window.confirm(`${year}년 ${month}월 전체 직원(${employees.length}명) 급여를 계산하시겠습니까?`)) return;
    for (const emp of employees) {
      await handleCalculate(emp.id);
    }
  };

  /**
   * 급여 지급 이력 모달 열기
   * @param {object} emp - 직원 객체
   */
  const handleShowHistory = async (emp) => {
    setHistoryEmployee(emp);
    setHistoryLoading(true);
    setHistoryData([]);
    try {
      const data = await fetchSalaryHistory(emp.id);
      setHistoryData(data);
    } catch (err) {
      alert(`이력 조회 오류: ${err.message}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg p-5 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
            <div className="h-3 bg-slate-200 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* 월별 급여 요약 KPI 카드 */}
      {overview && overview.total_employees > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="text-xs text-slate-500 mb-1">정산 인원</div>
            <div className="text-2xl font-bold text-slate-900">{overview.total_employees}명</div>
            <div className="text-xs text-slate-400 mt-1">
              지급완료 {overview.paid_count} / 미지급 {overview.unpaid_count}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="text-xs text-slate-500 mb-1">총 지급액</div>
            <div className="text-xl font-bold text-slate-900">{formatCurrency(overview.total_gross_pay)}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="text-xs text-slate-500 mb-1">총 공제액</div>
            <div className="text-xl font-bold text-red-500">{formatCurrency(overview.total_deduction)}</div>
            <div className="text-xs text-slate-400 mt-1">4대보험 합계</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="text-xs text-slate-500 mb-1">총 실수령액</div>
            <div className="text-xl font-bold text-green-600">{formatCurrency(overview.total_net_pay)}</div>
          </div>
        </div>
      )}

      {/* 상단 액션 버튼 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          {employees.length > 0
            ? `현직 직원 ${employees.length}명 · 급여 계산 후 확정 저장하세요.`
            : "직원 목록 탭에서 직원을 먼저 등록해주세요."}
        </p>
        {employees.length > 0 && (
          <button
            onClick={handleCalculateAll}
            className="flex items-center gap-2 h-9 px-4 border border-blue-200 text-blue-600 text-sm font-semibold rounded-md hover:bg-blue-50 transition-colors"
          >
            <Calculator size={16} />
            전체 급여 계산
          </button>
        )}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-sm text-red-600">{error}</div>
      )}

      {/* 직원 없음 빈 상태 */}
      {employees.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm flex flex-col items-center justify-center py-16">
          <Wallet size={48} className="text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">직원을 먼저 등록해주세요.</p>
          <p className="text-slate-400 text-sm mt-1">직원 목록 탭에서 직원을 등록하면 이곳에 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {employees.map((emp) => {
            // 저장된 정산 기록 찾기 (overview에서)
            const savedRecord = overview?.salary_details?.find(
              (d) => d.employee_id === emp.id
            );
            const calc = calculations[emp.id];
            const isLoading = loadingMap[emp.id];
            const isExpanded = expandedEmployee === emp.id;

            return (
              <div key={emp.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                {/* 카드 헤더 */}
                <div className="flex items-center justify-between p-5">
                  {/* 직원 정보 */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{emp.name}</span>
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {emp.position || formatEmploymentType(emp.employment_type)}
                      </span>
                      <span className="text-xs text-slate-400">{formatSalaryType(emp.salary_type)}</span>
                    </div>
                    <div className="text-sm text-slate-500 mt-0.5">
                      {emp.salary_type === "HOURLY"
                        ? `시급 ${formatCurrency(emp.hourly_wage)}`
                        : `월급 ${formatCurrency(emp.monthly_salary)}`}
                      {emp.has_insurance && (
                        <span className="ml-2 text-xs text-green-600">4대보험 적용</span>
                      )}
                    </div>
                  </div>

                  {/* 버튼 영역 */}
                  <div className="flex items-center gap-2">
                    {/* 저장된 급여 요약 */}
                    {savedRecord && (
                      <div className="text-right mr-2">
                        <div className="text-sm font-semibold text-slate-900">
                          실수령 {formatCurrency(savedRecord.net_pay)}
                        </div>
                        <div className="text-xs text-slate-400">
                          지급액 {formatCurrency(savedRecord.gross_pay)}
                        </div>
                      </div>
                    )}

                    {/* 지급 완료 토글 */}
                    {savedRecord && (
                      <button
                        onClick={() => handleMarkPaid(savedRecord.salary_id, !savedRecord.is_paid)}
                        className={`flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md border transition-colors ${
                          savedRecord.is_paid
                            ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                            : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {savedRecord.is_paid
                          ? <CheckCircle size={14} className="text-green-500" />
                          : <Circle size={14} />}
                        {savedRecord.is_paid ? "지급 완료" : "미지급"}
                      </button>
                    )}

                    {/* 이력 보기 */}
                    <button
                      onClick={() => handleShowHistory(emp)}
                      className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-slate-50 border border-slate-200 text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
                      title="급여 지급 이력"
                    >
                      <History size={14} />
                      이력
                    </button>

                    {/* 급여 계산 */}
                    <button
                      onClick={() => handleCalculate(emp.id)}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium bg-blue-50 border border-blue-200 text-blue-600 rounded-md hover:bg-blue-100 disabled:opacity-50 transition-colors"
                    >
                      <Calculator size={14} />
                      {isLoading ? "계산 중..." : "급여 계산"}
                    </button>

                    {/* 상세 펼치기 */}
                    {(calc || savedRecord) && (
                      <button
                        onClick={() => setExpandedEmployee(isExpanded ? null : emp.id)}
                        className="h-8 w-8 flex items-center justify-center border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                        title="상세 보기"
                      >
                        <ChevronDown
                          size={16}
                          className={`text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    )}
                  </div>
                </div>

                {/* 계산 결과 상세 패널 */}
                {isExpanded && calc && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5">
                    {/* 최저임금 경고 */}
                    {!calc.minimum_wage_ok && (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                        <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                        <span>
                          최저임금 미달: 2026년 최저임금은{" "}
                          <strong>{formatCurrency(calc.minimum_wage_per_hour)}/시</strong>입니다.
                          시급을 다시 확인해주세요.
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-6">
                      {/* 근무 집계 */}
                      <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">근무 집계</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">근무일수</span>
                            <span className="font-medium">{calc.work_days}일</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">총 근무시간</span>
                            <span className="font-medium">{formatHours(calc.total_work_hours)}</span>
                          </div>
                          {calc.total_overtime_hours > 0 && (
                            <div className="flex justify-between">
                              <span className="text-orange-500">연장근로</span>
                              <span className="font-medium text-orange-600">{formatHours(calc.total_overtime_hours)}</span>
                            </div>
                          )}
                          {calc.total_night_hours > 0 && (
                            <div className="flex justify-between">
                              <span className="text-purple-500">야간근로</span>
                              <span className="font-medium text-purple-600">{formatHours(calc.total_night_hours)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 급여 항목 */}
                      <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">급여 항목</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">기본급</span>
                            <span className="font-medium">{formatCurrency(calc.base_pay)}</span>
                          </div>
                          {calc.weekly_holiday_pay > 0 && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">주휴수당</span>
                              <span className="font-medium">{formatCurrency(calc.weekly_holiday_pay)}</span>
                            </div>
                          )}
                          {calc.overtime_pay > 0 && (
                            <div className="flex justify-between">
                              <span className="text-orange-500">연장근로수당</span>
                              <span className="font-medium text-orange-600">{formatCurrency(calc.overtime_pay)}</span>
                            </div>
                          )}
                          {calc.night_pay > 0 && (
                            <div className="flex justify-between">
                              <span className="text-purple-500">야간근로수당</span>
                              <span className="font-medium text-purple-600">{formatCurrency(calc.night_pay)}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-slate-200 pt-2">
                            <span className="font-semibold text-slate-700">총 지급액</span>
                            <span className="font-bold text-slate-900">{formatCurrency(calc.gross_pay)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4대보험 공제 상세 */}
                    {calc.total_deduction > 0 && (
                      <div className="mt-4">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3 flex items-center gap-1">
                          <Info size={12} />
                          4대보험 공제 (근로자 부담분)
                        </h4>
                        <div className="grid grid-cols-4 gap-3">
                          {[
                            { label: "국민연금 4.5%", value: calc.deduction_pension },
                            { label: "건강보험 3.545%", value: calc.deduction_health },
                            { label: "장기요양보험", value: calc.deduction_care },
                            { label: "고용보험 0.9%", value: calc.deduction_employment },
                          ].map(({ label, value }) => (
                            <div key={label} className="bg-white rounded-lg p-3 border border-slate-100">
                              <div className="text-xs text-slate-400 mb-1">{label}</div>
                              <div className="text-sm font-medium text-slate-700">{formatCurrency(value)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 실수령액 + 확정 저장 */}
                    <div className="mt-4 flex items-center justify-between bg-white rounded-lg p-4 border border-slate-100">
                      <div>
                        <div className="text-xs text-slate-500">실수령액 (총 지급액 - 공제액)</div>
                        <div className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(calc.net_pay)}</div>
                        {calc.total_deduction > 0 && (
                          <div className="text-xs text-slate-400 mt-1">
                            {formatCurrency(calc.gross_pay)} - {formatCurrency(calc.total_deduction)}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleSave(emp.id, emp.name)}
                        disabled={isLoading}
                        className="flex items-center gap-2 h-10 px-5 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
                      >
                        <DollarSign size={16} />
                        급여 확정 저장
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 급여 지급 이력 모달 */}
      {historyEmployee && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History size={20} className="text-blue-500" />
                <h2 className="text-lg font-semibold text-slate-900">
                  {historyEmployee.name} — 급여 지급 이력
                </h2>
              </div>
              <button
                onClick={() => setHistoryEmployee(null)}
                className="h-8 w-8 flex items-center justify-center rounded hover:bg-slate-100 transition-colors"
                title="닫기"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            {/* 이력 목록 */}
            <div className="overflow-y-auto flex-1">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-slate-400">
                  이력을 불러오는 중...
                </div>
              ) : historyData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <History size={40} className="text-slate-300 mb-3" />
                  <p className="text-slate-500 text-sm">급여 지급 이력이 없습니다.</p>
                  <p className="text-slate-400 text-xs mt-1">급여 정산을 완료하면 이곳에 기록됩니다.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">정산 기간</th>
                      <th className="text-right text-xs font-semibold text-slate-500 px-5 py-3">근무일수</th>
                      <th className="text-right text-xs font-semibold text-slate-500 px-5 py-3">총 지급액</th>
                      <th className="text-right text-xs font-semibold text-slate-500 px-5 py-3">실수령액</th>
                      <th className="text-center text-xs font-semibold text-slate-500 px-5 py-3">지급 여부</th>
                      <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3">지급일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((record, idx) => (
                      <tr
                        key={record.salary_id}
                        className={`border-b border-slate-100 hover:bg-slate-50 ${idx % 2 === 1 ? "bg-slate-50/40" : ""}`}
                      >
                        <td className="px-5 py-3 text-sm font-medium text-slate-900">
                          {record.year}년 {record.month}월
                        </td>
                        <td className="px-5 py-3 text-sm text-right text-slate-600">
                          {record.work_days}일
                        </td>
                        <td className="px-5 py-3 text-sm text-right font-medium text-slate-900">
                          {formatCurrency(record.gross_pay)}
                        </td>
                        <td className="px-5 py-3 text-sm text-right font-semibold text-green-600">
                          {formatCurrency(record.net_pay)}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {record.is_paid ? (
                            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                              <CheckCircle size={11} />
                              완료
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium">
                              <Circle size={11} />
                              미지급
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-500">
                          {formatDate(record.paid_date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setHistoryEmployee(null)}
                className="h-9 px-5 text-sm font-medium border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryPanel;
