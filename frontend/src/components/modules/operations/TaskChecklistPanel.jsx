// ============================================================
// TaskChecklistPanel.jsx — 업무 체크리스트 패널 컴포넌트
// 개점/마감/주간/월간 루틴 업무 체크 및 항목 관리
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { CheckSquare, Square, Settings, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import {
  fetchTaskChecklists,
  fetchTaskRecords,
  saveTaskRecord,
  createTaskChecklist,
  deleteTaskChecklist,
  seedTaskChecklists,
} from "../../../api/operationsApi";

// 업무 구분 탭 설정
const TASK_TYPES = [
  { value: "open",    label: "개점 업무",  color: "text-green-600 bg-green-50 border-green-200"  },
  { value: "close",   label: "마감 업무",  color: "text-blue-600 bg-blue-50 border-blue-200"    },
  { value: "weekly",  label: "주간 업무",  color: "text-purple-600 bg-purple-50 border-purple-200" },
  { value: "monthly", label: "월간 업무",  color: "text-orange-600 bg-orange-50 border-orange-200" },
];

// 역할(role) 배지 색상
const ROLE_COLORS = {
  "공통": "bg-slate-100 text-slate-600",
  "주방": "bg-orange-50 text-orange-600",
  "홀":   "bg-blue-50 text-blue-600",
};

const TaskChecklistPanel = () => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [activeType, setActiveType]     = useState("open");

  // 날짜별 완료 현황 데이터
  const [taskData, setTaskData]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  // 항목 관리 모드
  const [manageMode, setManageMode]   = useState(false);
  const [allTasks, setAllTasks]       = useState([]);
  // 항목별 접기/펼치기 (task_type 기준)
  const [collapsed, setCollapsed]     = useState({});

  // 신규 항목 추가 폼
  const [newTask, setNewTask]         = useState({ task_name: "", task_type: "open", role: "공통" });
  const [addingTask, setAddingTask]   = useState(false);

  // ─── 데이터 로드 ──────────────────────────────────────

  const loadTaskData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchTaskRecords(selectedDate, activeType);
      setTaskData(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, activeType]);

  const loadAllTasks = useCallback(async () => {
    try {
      const data = await fetchTaskChecklists();
      setAllTasks(data);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    loadTaskData();
  }, [loadTaskData]);

  useEffect(() => {
    if (manageMode) loadAllTasks();
  }, [manageMode, loadAllTasks]);

  // ─── 완료 토글 ────────────────────────────────────────

  const handleToggle = async (taskId, currentDone) => {
    const newDone = currentDone === 1 ? 0 : 1;
    // 낙관적 UI 업데이트
    setTaskData((prev) => {
      if (!prev) return prev;
      const updatedTasks = prev.tasks.map((t) =>
        t.task_id === taskId ? { ...t, is_done: newDone } : t
      );
      const completed = updatedTasks.filter((t) => t.is_done === 1).length;
      return {
        ...prev,
        tasks: updatedTasks,
        completed,
        completion_rate: prev.total > 0 ? Math.round((completed / prev.total) * 1000) / 10 : 0,
      };
    });
    try {
      await saveTaskRecord({
        record_date: selectedDate,
        task_id: taskId,
        is_done: newDone,
      });
    } catch (e) {
      // 실패 시 원복
      setError(e.message);
      loadTaskData();
    }
  };

  // 전체 완료
  const handleCompleteAll = async () => {
    if (!taskData?.tasks) return;
    const pending = taskData.tasks.filter((t) => t.is_done !== 1);
    if (pending.length === 0) return;
    try {
      await Promise.all(
        pending.map((t) =>
          saveTaskRecord({ record_date: selectedDate, task_id: t.task_id, is_done: 1 })
        )
      );
      loadTaskData();
    } catch (e) {
      setError(e.message);
    }
  };

  // 전체 초기화 (모두 미완료)
  const handleResetAll = async () => {
    if (!taskData?.tasks) return;
    const done = taskData.tasks.filter((t) => t.is_done === 1);
    if (done.length === 0) return;
    if (!window.confirm("모든 완료 항목을 초기화하시겠습니까?")) return;
    try {
      await Promise.all(
        done.map((t) =>
          saveTaskRecord({ record_date: selectedDate, task_id: t.task_id, is_done: 0 })
        )
      );
      loadTaskData();
    } catch (e) {
      setError(e.message);
    }
  };

  // ─── 항목 관리 ────────────────────────────────────────

  const handleAddTask = async () => {
    if (!newTask.task_name.trim()) return;
    setAddingTask(true);
    try {
      await createTaskChecklist(newTask);
      setNewTask({ task_name: "", task_type: "open", role: "공통" });
      loadAllTasks();
      loadTaskData();
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingTask(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("이 업무 항목을 삭제하시겠습니까?")) return;
    try {
      await deleteTaskChecklist(taskId);
      loadAllTasks();
      loadTaskData();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSeed = async () => {
    if (!window.confirm("기본 업무 항목을 초기화하겠습니까? 기존 항목이 있으면 건너뜁니다.")) return;
    try {
      await seedTaskChecklists();
      loadAllTasks();
      loadTaskData();
    } catch (e) {
      setError(e.message);
    }
  };

  // 접기/펼치기 토글
  const toggleCollapse = (type) => {
    setCollapsed((c) => ({ ...c, [type]: !c[type] }));
  };

  // 현재 탭 설정
  const activeTypeConfig = TASK_TYPES.find((t) => t.value === activeType);
  // 완료율 색상
  const rateColor = (rate) =>
    rate >= 100 ? "text-green-600" : rate >= 70 ? "text-blue-600" : rate >= 40 ? "text-yellow-600" : "text-red-500";

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
            onClick={loadTaskData}
            className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white text-slate-500 transition-colors"
            title="새로고침"
          >
            <RefreshCw size={15} />
          </button>
        </div>

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
          <h3 className="text-sm font-semibold text-slate-700 mb-4">업무 체크리스트 항목 관리</h3>

          {/* 신규 항목 추가 */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newTask.task_name}
              onChange={(e) => setNewTask((n) => ({ ...n, task_name: e.target.value }))}
              placeholder="새 업무 항목명 입력"
              className="flex-1 h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
            />
            <select
              value={newTask.task_type}
              onChange={(e) => setNewTask((n) => ({ ...n, task_type: e.target.value }))}
              className="h-9 px-2 border border-slate-200 rounded-md text-sm focus:outline-none bg-white"
            >
              {TASK_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={newTask.role}
              onChange={(e) => setNewTask((n) => ({ ...n, role: e.target.value }))}
              className="h-9 px-2 border border-slate-200 rounded-md text-sm focus:outline-none bg-white"
            >
              <option value="공통">공통</option>
              <option value="주방">주방</option>
              <option value="홀">홀</option>
            </select>
            <button
              onClick={handleAddTask}
              disabled={addingTask || !newTask.task_name.trim()}
              className="flex items-center gap-1 h-9 px-3 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
            >
              <Plus size={14} />
              추가
            </button>
          </div>

          {/* 유형별 그룹 목록 */}
          {TASK_TYPES.map(({ value, label, color }) => {
            const grouped = allTasks.filter((t) => t.task_type === value);
            if (grouped.length === 0) return null;
            return (
              <div key={value} className="mb-4">
                <button
                  onClick={() => toggleCollapse(value)}
                  className="flex items-center justify-between w-full mb-2"
                >
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${color}`}>
                    {label} ({grouped.length})
                  </span>
                  {collapsed[value] ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronUp size={14} className="text-slate-400" />}
                </button>
                {!collapsed[value] && (
                  <div className="space-y-1 pl-1">
                    {grouped.map((task) => (
                      <div key={task.id} className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-50 rounded">
                        <span className="text-sm text-slate-700">{task.task_name}</span>
                        <div className="flex items-center gap-2">
                          {task.role && (
                            <span className={`text-xs px-2 py-0.5 rounded ${ROLE_COLORS[task.role] || "bg-slate-100 text-slate-500"}`}>
                              {task.role}
                            </span>
                          )}
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="h-6 w-6 flex items-center justify-center rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* 업무 구분 탭 */}
          <div className="flex gap-1 mb-4 border-b border-slate-200">
            {TASK_TYPES.map(({ value, label }) => (
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
              </button>
            ))}
          </div>

          {/* 통계 + 액션 바 */}
          {taskData && (
            <div className="flex items-center justify-between mb-4 bg-white rounded-lg border border-slate-100 shadow-sm px-4 py-3">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-xs text-slate-400 mr-2">전체</span>
                  <span className="text-sm font-semibold text-slate-700">{taskData.total}개</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 mr-2">완료</span>
                  <span className="text-sm font-semibold text-green-600">{taskData.completed}개</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 mr-2">완료율</span>
                  <span className={`text-sm font-bold ${rateColor(taskData.completion_rate)}`}>
                    {taskData.completion_rate}%
                  </span>
                </div>
              </div>
              {/* 전체 완료 / 초기화 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={handleResetAll}
                  className="h-7 px-3 border border-slate-200 text-xs text-slate-600 rounded hover:bg-slate-50 transition-colors"
                >
                  전체 초기화
                </button>
                <button
                  onClick={handleCompleteAll}
                  className="h-7 px-3 bg-green-500 text-white text-xs font-semibold rounded hover:bg-green-600 transition-colors"
                >
                  전체 완료
                </button>
              </div>
            </div>
          )}

          {/* 업무 항목 목록 */}
          {loading ? (
            <div className="text-center py-12 text-slate-400">불러오는 중...</div>
          ) : !taskData || taskData.tasks.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <CheckSquare size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">업무 항목이 없습니다.</p>
              <p className="text-xs mt-1">기본 항목 초기화를 실행하거나 항목 관리에서 추가해보세요.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {taskData.tasks.map((task) => {
                const isDone = task.is_done === 1;
                return (
                  <div
                    key={task.task_id}
                    onClick={() => handleToggle(task.task_id, task.is_done)}
                    className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all select-none ${
                      isDone
                        ? "bg-green-50 border-green-200"
                        : "bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm"
                    }`}
                  >
                    {/* 체크박스 아이콘 */}
                    {isDone
                      ? <CheckSquare size={20} className="text-green-500 shrink-0" />
                      : <Square size={20} className="text-slate-300 shrink-0" />
                    }

                    {/* 업무명 */}
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isDone ? "line-through text-slate-400" : "text-slate-800"}`}>
                        {task.task_name}
                      </p>
                      {task.completed_by && (
                        <p className="text-xs text-slate-400 mt-0.5">완료: {task.completed_by}</p>
                      )}
                    </div>

                    {/* 역할 배지 */}
                    {task.role && (
                      <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${ROLE_COLORS[task.role] || "bg-slate-100 text-slate-500"}`}>
                        {task.role}
                      </span>
                    )}

                    {/* 완료 상태 */}
                    {isDone && (
                      <span className="text-xs text-green-600 font-medium shrink-0">완료</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TaskChecklistPanel;
