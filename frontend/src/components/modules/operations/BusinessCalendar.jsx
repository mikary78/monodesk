// ============================================================
// BusinessCalendar.jsx — 영업일 관리 캘린더 컴포넌트
// 월별 영업 현황 달력 표시 및 날짜별 영업 상태/메모 관리
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Save, Trash2 } from "lucide-react";
import {
  fetchBusinessDays,
  fetchBusinessDay,
  saveBusinessDay,
  deleteBusinessDay,
  fetchBusinessMonthStats,
} from "../../../api/operationsApi";

// 영업 상태 설정
const STATUS_CONFIG = {
  open:    { label: "정상영업", color: "bg-green-100 text-green-700 border-green-200",  dot: "bg-green-500"  },
  closed:  { label: "휴무",     color: "bg-red-100 text-red-600 border-red-200",        dot: "bg-red-500"    },
  special: { label: "특별영업", color: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-500" },
};

// 날씨 옵션
const WEATHER_OPTIONS = ["맑음", "흐림", "비", "눈", "강풍", "안개"];

// 요일 헤더
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const BusinessCalendar = ({ year: propYear, month: propMonth }) => {
  const today = new Date();
  // 부모에서 year/month를 받으면 해당 값 사용, 없으면 오늘 기준
  const [year, setYear]   = useState(propYear  ?? today.getFullYear());
  const [month, setMonth] = useState(propMonth ?? (today.getMonth() + 1));

  // 영업일 데이터 맵 (날짜 문자열 → 기록 객체)
  const [dayMap, setDayMap]     = useState({});
  // 월간 통계
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  // 선택한 날짜 (상세 편집용)
  const [selectedDate, setSelectedDate] = useState(null);
  // 편집 폼
  const [form, setForm]     = useState({ status: "open", closed_reason: "", memo: "", target_sales: "", weather: "" });
  const [saving, setSaving] = useState(false);

  // ─── 데이터 로드 ──────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [days, monthStats] = await Promise.all([
        fetchBusinessDays(year, month),
        fetchBusinessMonthStats(year, month),
      ]);
      // 날짜 → 기록 맵 변환
      const map = {};
      days.forEach((d) => { map[d.business_date] = d; });
      setDayMap(map);
      setStats(monthStats);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 부모에서 year/month props가 바뀌면 동기화
  useEffect(() => {
    if (propYear  !== undefined) setYear(propYear);
    if (propMonth !== undefined) setMonth(propMonth);
  }, [propYear, propMonth]);

  // ─── 캘린더 계산 ──────────────────────────────────────

  // 해당 월의 1일 요일 (0=일)
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  // 해당 월의 마지막 날
  const daysInMonth = new Date(year, month, 0).getDate();
  // 캘린더 그리드 (빈 칸 포함)
  const calendarCells = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  // 날짜 문자열 생성
  const toDateStr = (day) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // ─── 날짜 클릭 → 편집 폼 열기 ────────────────────────

  const handleDayClick = (day) => {
    const dateStr = toDateStr(day);
    setSelectedDate(dateStr);
    const existing = dayMap[dateStr];
    if (existing) {
      setForm({
        status:        existing.status,
        closed_reason: existing.closed_reason || "",
        memo:          existing.memo          || "",
        target_sales:  existing.target_sales  != null ? String(existing.target_sales) : "",
        weather:       existing.weather       || "",
      });
    } else {
      setForm({ status: "open", closed_reason: "", memo: "", target_sales: "", weather: "" });
    }
  };

  // ─── 저장 ─────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await saveBusinessDay({
        business_date:  selectedDate,
        status:         form.status,
        closed_reason:  form.closed_reason || null,
        memo:           form.memo          || null,
        target_sales:   form.target_sales  ? parseFloat(form.target_sales) : null,
        weather:        form.weather       || null,
      });
      setSelectedDate(null);
      loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── 기록 삭제 ────────────────────────────────────────

  const handleDelete = async () => {
    if (!window.confirm("이 날짜의 영업일 기록을 삭제하시겠습니까?")) return;
    try {
      await deleteBusinessDay(selectedDate);
      setSelectedDate(null);
      loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  // 오늘 날짜 문자열
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="flex gap-5">
      {/* ── 좌측: 캘린더 ── */}
      <div className="flex-1">
        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: "정상 영업",  value: stats.open_count,    color: "text-green-600"  },
              { label: "휴무일",     value: stats.closed_count,  color: "text-red-500"    },
              { label: "특별 영업",  value: stats.special_count, color: "text-yellow-600" },
              { label: "기록 완료",  value: `${stats.recorded_count}/${stats.total_days_in_month}일`, color: "text-blue-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-lg shadow-sm border border-slate-100 p-3 text-center">
                <p className="text-xs text-slate-400 mb-1">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
            {error}
          </div>
        )}

        {/* 달력 */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className={`text-center py-2 text-xs font-semibold ${
                  i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-500"
                }`}
              >
                {w}
              </div>
            ))}
          </div>

          {/* 날짜 셀 */}
          {loading ? (
            <div className="text-center py-16 text-slate-400 text-sm">불러오는 중...</div>
          ) : (
            <div className="grid grid-cols-7">
              {calendarCells.map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="h-20 border-b border-r border-slate-50" />;
                }
                const dateStr  = toDateStr(day);
                const record   = dayMap[dateStr];
                const isToday  = dateStr === todayStr;
                const isSel    = dateStr === selectedDate;
                const isWeekend = (idx % 7 === 0) || (idx % 7 === 6);
                const statusCfg = record ? STATUS_CONFIG[record.status] : null;

                return (
                  <div
                    key={dateStr}
                    onClick={() => handleDayClick(day)}
                    className={`h-20 border-b border-r border-slate-50 p-1.5 cursor-pointer transition-colors ${
                      isSel   ? "bg-blue-50 ring-2 ring-inset ring-blue-400" :
                      isToday ? "bg-amber-50" :
                      "hover:bg-slate-50"
                    }`}
                  >
                    {/* 날짜 숫자 */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${
                        isToday  ? "bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs" :
                        isWeekend && idx % 7 === 0 ? "text-red-400" :
                        isWeekend ? "text-blue-400" :
                        "text-slate-700"
                      }`}>
                        {day}
                      </span>
                      {/* 상태 점 */}
                      {statusCfg && (
                        <span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
                      )}
                    </div>

                    {/* 상태 배지 */}
                    {record && (
                      <div className={`text-xs px-1 py-0.5 rounded border truncate ${statusCfg.color}`}>
                        {statusCfg.label}
                      </div>
                    )}

                    {/* 메모 미리보기 */}
                    {record?.memo && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">{record.memo}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 우측: 상세 편집 패널 ── */}
      {selectedDate && (
        <div className="w-72 bg-white rounded-lg shadow-sm border border-slate-100 p-5 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">{selectedDate}</h3>
            <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4">
            {/* 영업 상태 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">영업 상태</label>
              <div className="flex flex-col gap-1.5">
                {Object.entries(STATUS_CONFIG).map(([value, cfg]) => (
                  <button
                    key={value}
                    onClick={() => setForm((f) => ({ ...f, status: value }))}
                    className={`flex items-center gap-2 h-9 px-3 rounded border text-sm font-medium text-left transition-colors ${
                      form.status === value
                        ? cfg.color
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 휴무 사유 (휴무일 때만) */}
            {form.status === "closed" && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">휴무 사유</label>
                <input
                  type="text"
                  value={form.closed_reason}
                  onChange={(e) => setForm((f) => ({ ...f, closed_reason: e.target.value }))}
                  placeholder="정기휴무, 명절 등"
                  className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
            )}

            {/* 매출 목표 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">매출 목표 (원)</label>
              <input
                type="number"
                value={form.target_sales}
                onChange={(e) => setForm((f) => ({ ...f, target_sales: e.target.value }))}
                placeholder="예: 1500000"
                className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
              />
            </div>

            {/* 날씨 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">날씨</label>
              <div className="flex flex-wrap gap-1">
                {WEATHER_OPTIONS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setForm((f) => ({ ...f, weather: f.weather === w ? "" : w }))}
                    className={`h-7 px-2.5 rounded border text-xs font-medium transition-colors ${
                      form.weather === w
                        ? "bg-blue-500 text-white border-blue-500"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">특이사항 메모</label>
              <textarea
                value={form.memo}
                onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                placeholder="당일 특이사항, 행사 등"
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400 resize-none"
              />
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 pt-1">
              {dayMap[selectedDate] && (
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1 h-9 px-3 border border-red-200 text-red-500 text-sm rounded-md hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={13} />
                  삭제
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-blue-500 text-white text-sm font-semibold rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                <Save size={14} />
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessCalendar;
