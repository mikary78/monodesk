// ============================================================
// HygieneCheck.jsx — 위생 점검 체크리스트 컴포넌트
// 날짜별 위생 점검 현황 조회 및 결과 저장 기능
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, MinusCircle, RefreshCw, Settings, Plus, Trash2 } from "lucide-react";
import {
  fetchHygieneChecklists,
  fetchHygieneRecords,
  saveHygieneRecord,
  seedHygieneChecklists,
  createHygieneChecklist,
  deleteHygieneChecklist,
} from "../../../api/operationsApi";

// 점검 결과 설정
const RESULT_OPTIONS = [
  { value: "pass", label: "양호", Icon: CheckCircle, color: "text-green-500 bg-green-50 border-green-200" },
  { value: "fail", label: "불량", Icon: XCircle,     color: "text-red-500 bg-red-50 border-red-200" },
  { value: "na",   label: "해당없음", Icon: MinusCircle, color: "text-slate-400 bg-slate-50 border-slate-200" },
];

// 점검 구분 탭
const CHECK_TYPES = [
  { value: "open",  label: "개점 점검" },
  { value: "close", label: "마감 점검" },
  { value: "daily", label: "일상 점검" },
];

// 카테고리 라벨
const CATEGORY_LABELS = {
  kitchen: "주방",
  hall: "홀",
  restroom: "화장실",
  equipment: "설비",
};

// readOnly: true이면 점검결과 저장·항목관리·초기화 버튼 숨김 (staff 읽기 전용 모드)
const HygieneCheck = ({ readOnly = false }) => {
  // 오늘 날짜 기준으로 초기화
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [activeType, setActiveType] = useState("open");

  // 점검 기록 데이터 (날짜별 요약)
  const [checkData, setCheckData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 항목 관리 모드 여부
  const [manageMode, setManageMode] = useState(false);
  const [checklists, setChecklists] = useState([]);
  // 신규 항목 추가 폼
  const [newItem, setNewItem] = useState({ item_name: "", check_type: "open", category: "kitchen" });
  const [addingItem, setAddingItem] = useState(false);

  // 점검 기록 불러오기
  const loadCheckData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchHygieneRecords(selectedDate);
      setCheckData(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // 항목 관리 목록 불러오기
  const loadChecklists = useCallback(async () => {
    try {
      const data = await fetchHygieneChecklists();
      setChecklists(data);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    loadCheckData();
  }, [loadCheckData]);

  useEffect(() => {
    if (manageMode) loadChecklists();
  }, [manageMode, loadChecklists]);

  // 점검 결과 저장 (클릭 즉시 저장)
  const handleResultChange = async (checklistId, result) => {
    try {
      await saveHygieneRecord({ check_date: selectedDate, checklist_id: checklistId, result });
      // 로컬 상태 즉시 반영
      setCheckData((prev) => {
        if (!prev) return prev;
        const updatedRecords = prev.records.map((r) =>
          r.checklist_id === checklistId ? { ...r, result } : r
        );
        // 통계 재계산
        const passed = updatedRecords.filter((r) => r.result === "pass").length;
        const failed = updatedRecords.filter((r) => r.result === "fail").length;
        const naCount = updatedRecords.filter((r) => r.result === "na").length;
        const checked = updatedRecords.filter((r) => r.result !== null).length;
        return {
          ...prev,
          records: updatedRecords,
          passed,
          failed,
          na_count: naCount,
          completion_rate: prev.total > 0 ? Math.round((checked / prev.total) * 1000) / 10 : 0,
        };
      });
    } catch (e) {
      setError(e.message);
    }
  };

  // 초기 데이터 시드
  const handleSeed = async () => {
    if (!window.confirm("기본 위생 점검 항목을 초기화하겠습니까? 기존 항목이 있으면 건너뜁니다.")) return;
    try {
      await seedHygieneChecklists();
      loadCheckData();
      loadChecklists();
    } catch (e) {
      setError(e.message);
    }
  };

  // 신규 항목 추가
  const handleAddItem = async () => {
    if (!newItem.item_name.trim()) return;
    setAddingItem(true);
    try {
      await createHygieneChecklist(newItem);
      setNewItem({ item_name: "", check_type: "open", category: "kitchen" });
      loadChecklists();
      loadCheckData();
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingItem(false);
    }
  };

  // 항목 삭제
  const handleDeleteItem = async (itemId) => {
    if (!window.confirm("이 점검 항목을 삭제하시겠습니까?")) return;
    try {
      await deleteHygieneChecklist(itemId);
      loadChecklists();
      loadCheckData();
    } catch (e) {
      setError(e.message);
    }
  };

  // 현재 탭 기준으로 항목 필터링
  const filteredRecords = checkData?.records?.filter((r) => r.check_type === activeType) || [];

  return (
    <div>
      {/* 상단 컨트롤 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400 bg-white"
          />
          <button
            onClick={loadCheckData}
            className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white text-slate-500 transition-colors"
            title="새로고침"
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {/* 관리 버튼 — readOnly 모드에서 숨김 */}
        {!readOnly && (
          <div className="flex gap-2">
            <button
              onClick={handleSeed}
              className="h-9 px-3 border border-slate-200 bg-white text-slate-600 text-sm rounded-md hover:bg-slate-50 transition-colors"
            >
              기본 항목 초기화
            </button>
            <button
              onClick={() => setManageMode((m) => !m)}
              className={`flex items-center gap-1.5 h-9 px-3 text-sm rounded-md transition-colors ${
                manageMode
                  ? "bg-blue-500 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Settings size={14} />
              항목 관리
            </button>
          </div>
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 항목 관리 모드 */}
      {manageMode ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">위생 점검 항목 관리</h3>

          {/* 신규 항목 추가 폼 */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newItem.item_name}
              onChange={(e) => setNewItem((n) => ({ ...n, item_name: e.target.value }))}
              placeholder="새 점검 항목명 입력"
              className="flex-1 h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
            />
            <select
              value={newItem.check_type}
              onChange={(e) => setNewItem((n) => ({ ...n, check_type: e.target.value }))}
              className="h-9 px-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400 bg-white"
            >
              <option value="open">개점</option>
              <option value="close">마감</option>
              <option value="daily">일상</option>
            </select>
            <select
              value={newItem.category}
              onChange={(e) => setNewItem((n) => ({ ...n, category: e.target.value }))}
              className="h-9 px-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400 bg-white"
            >
              <option value="kitchen">주방</option>
              <option value="hall">홀</option>
              <option value="restroom">화장실</option>
              <option value="equipment">설비</option>
            </select>
            <button
              onClick={handleAddItem}
              disabled={addingItem || !newItem.item_name.trim()}
              className="flex items-center gap-1 h-9 px-3 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              <Plus size={14} />
              추가
            </button>
          </div>

          {/* 항목 목록 */}
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {checklists.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 px-3 hover:bg-slate-50 rounded">
                <span className="text-sm text-slate-700">{item.item_name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 px-2 py-0.5 bg-slate-100 rounded">
                    {CHECK_TYPES.find((t) => t.value === item.check_type)?.label}
                  </span>
                  <span className="text-xs text-slate-400 px-2 py-0.5 bg-slate-100 rounded">
                    {CATEGORY_LABELS[item.category] || item.category}
                  </span>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                    title="삭제"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* 통계 카드 */}
          {checkData && (
            <div className="grid grid-cols-4 gap-4 mb-5">
              {[
                { label: "전체 항목", value: checkData.total, color: "text-slate-700" },
                { label: "양호", value: checkData.passed, color: "text-green-600" },
                { label: "불량", value: checkData.failed, color: "text-red-500" },
                { label: "완료율", value: `${checkData.completion_rate}%`, color: "text-blue-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-lg shadow-sm border border-slate-100 p-4 text-center">
                  <p className="text-xs text-slate-400 mb-1">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* 점검 구분 탭 */}
          <div className="flex gap-1 mb-4 border-b border-slate-200">
            {CHECK_TYPES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setActiveType(value)}
                className={`h-10 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeType === value
                    ? "border-blue-500 text-blue-500"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {label}
                {checkData && (
                  <span className="ml-1.5 text-xs">
                    ({checkData.records?.filter((r) => r.check_type === value).length || 0})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 점검 항목 목록 */}
          {loading ? (
            <div className="text-center py-12 text-slate-400">불러오는 중...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              점검 항목이 없습니다. 기본 항목 초기화를 실행해보세요.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRecords.map((record) => (
                <div
                  key={record.checklist_id}
                  className="bg-white rounded-lg border border-slate-100 shadow-sm p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{record.item_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {CATEGORY_LABELS[record.category] || record.category}
                    </p>
                  </div>

                  {/* 결과 선택 버튼 — readOnly 모드에서 비활성화 */}
                  <div className="flex gap-2">
                    {RESULT_OPTIONS.map(({ value, label, Icon, color }) => (
                      <button
                        key={value}
                        onClick={() => !readOnly && handleResultChange(record.checklist_id, value)}
                        disabled={readOnly}
                        className={`flex items-center gap-1.5 h-8 px-3 rounded border text-xs font-medium transition-colors ${
                          record.result === value
                            ? color
                            : "border-slate-200 text-slate-400 hover:bg-slate-50"
                        } ${readOnly ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        <Icon size={14} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HygieneCheck;
