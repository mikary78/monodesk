// ============================================================
// DailyPriceGrid.jsx — 데일리 단가 그리드 컴포넌트
// 추적 중인 식재료 품목의 일별 단가를 그리드로 관리합니다.
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Settings, X, Loader2, Plus } from "lucide-react";
import {
  getDailyPriceGrid,
  saveDailyPrice,
  togglePriceTracking,
  fetchInventoryItems,
} from "../../../api/inventoryApi";

// ─────────────────────────────────────────
// 단가 입력 팝오버 컴포넌트
// ─────────────────────────────────────────

/**
 * 셀 클릭 시 표시되는 단가 입력 팝오버.
 * @param {object} props
 * @param {object} props.cell - { itemId, itemName, unit, date, record }
 * @param {function} props.onSave - 저장 핸들러 (data) => void
 * @param {function} props.onClose - 닫기 핸들러
 */
const PricePopover = ({ cell, onSave, onClose }) => {
  const ref = useRef(null);

  // 입력 폼 상태 (기존 기록이 있으면 초기값으로 설정)
  const [form, setForm] = useState({
    quantity: cell.record?.quantity ?? "",
    unit_price: cell.record?.unit_price ?? "",
    vendor: cell.record?.vendor ?? "",
    memo: cell.record?.memo ?? "",
  });
  const [saving, setSaving] = useState(false);

  // 팝오버 외부 클릭 시 닫기
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  /** 폼 저장 처리 */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.quantity || !form.unit_price) return;
    setSaving(true);
    try {
      await onSave({
        item_id: cell.itemId,
        record_date: cell.date,
        quantity: parseFloat(form.quantity),
        unit_price: parseFloat(form.unit_price),
        vendor: form.vendor || null,
        memo: form.memo || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // 날짜 표시 형식 변환 (YYYY-MM-DD → M/D)
  const displayDate = cell.date
    ? `${parseInt(cell.date.split("-")[1])}/${parseInt(cell.date.split("-")[2])}`
    : "";

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-xl p-3"
    >
      {/* 팝오버 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-700">
          {cell.itemName} — {displayDate}
        </span>
        <button onClick={onClose} className="text-slate-300 hover:text-slate-500">
          <X size={14} />
        </button>
      </div>

      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-[10px] text-slate-400 block mb-0.5">수량 ({cell.unit})</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
              placeholder="0"
              required
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-slate-400 block mb-0.5">단가 (원)</label>
            <input
              type="number"
              step="1"
              min="0"
              value={form.unit_price}
              onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))}
              className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
              placeholder="0"
              required
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-slate-400 block mb-0.5">거래처</label>
          <input
            type="text"
            value={form.vendor}
            onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
            className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
            placeholder="거래처명"
          />
        </div>
        <div>
          <label className="text-[10px] text-slate-400 block mb-0.5">메모</label>
          <input
            type="text"
            value={form.memo}
            onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
            className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
            placeholder="메모"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-medium py-1.5 rounded transition-colors"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </form>
    </div>
  );
};

// ─────────────────────────────────────────
// 추적 품목 설정 모달 컴포넌트
// ─────────────────────────────────────────

/**
 * 데일리 단가 추적 품목을 설정하는 모달.
 * @param {object} props
 * @param {function} props.onClose - 모달 닫기 핸들러
 * @param {function} props.onSaved - 저장 완료 후 콜백
 */
const TrackingModal = ({ onClose, onSaved }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({}); // { itemId: boolean }

  // 전체 재고 품목 로드
  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchInventoryItems({ limit: 1000 });
        setItems(data.items || data);
      } catch {
        // 로드 실패 시 빈 목록 유지
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  /** 추적 여부 토글 처리 */
  const handleToggle = async (item) => {
    setSaving((prev) => ({ ...prev, [item.id]: true }));
    try {
      await togglePriceTracking(item.id, !item.is_daily_price_tracked);
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, is_daily_price_tracked: !i.is_daily_price_tracked } : i
        )
      );
    } catch (err) {
      alert(err.message || "추적 설정 변경에 실패했습니다.");
    } finally {
      setSaving((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">데일리 단가 추적 품목 설정</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {/* 품목 목록 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 size={18} className="animate-spin mr-2" />
              품목 로딩 중...
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">등록된 품목이 없습니다.</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50"
              >
                <div>
                  <span className="text-sm font-medium text-slate-700">{item.name || item.item_name}</span>
                  <span className="text-xs text-slate-400 ml-2">{item.unit}</span>
                </div>
                <button
                  onClick={() => handleToggle(item)}
                  disabled={saving[item.id]}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    item.is_daily_price_tracked ? "bg-blue-500" : "bg-slate-200"
                  } disabled:opacity-50`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      item.is_daily_price_tracked ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            ))
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={() => { onSaved(); onClose(); }}
            className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────

/**
 * 데일리 단가 그리드 컴포넌트.
 * Props 없음 — 내부에서 year/month 상태를 직접 관리합니다.
 */
const DailyPriceGrid = () => {
  const today = new Date();

  // 연/월 상태
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  // 그리드 데이터 상태
  const [gridData, setGridData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 열린 팝오버 셀 정보
  const [openPopover, setOpenPopover] = useState(null); // { itemId, itemName, unit, date, record }

  // 추적 설정 모달 표시 여부
  const [showTrackingModal, setShowTrackingModal] = useState(false);

  // 현재 달 여부 (다음 달 이동 비활성화용)
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  // ─────────────────────────────────────────
  // 데이터 로드
  // ─────────────────────────────────────────

  const loadGrid = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDailyPriceGrid(year, month);
      setGridData(data);
    } catch (err) {
      setError(err.message || "데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  // ─────────────────────────────────────────
  // 월 네비게이터 핸들러
  // ─────────────────────────────────────────

  const handlePrevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };

  const handleNextMonth = () => {
    if (isCurrentMonth) return;
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };

  // ─────────────────────────────────────────
  // 단가 저장 핸들러
  // ─────────────────────────────────────────

  const handleSavePrice = async (data) => {
    await saveDailyPrice(data);
    await loadGrid(); // 저장 후 그리드 새로고침
  };

  // ─────────────────────────────────────────
  // 단가 색상 계산 (전일 대비)
  // ─────────────────────────────────────────

  /**
   * 전일 단가 대비 오늘 단가의 색상 클래스를 반환합니다.
   * @param {Array} records - 품목의 전체 기록 배열 (날짜순 정렬 가정)
   * @param {string} date - 현재 날짜
   * @returns {string} Tailwind text 색상 클래스
   */
  const getPriceColorClass = (records, date, days) => {
    const dayIndex = days.indexOf(date);
    if (dayIndex <= 0) return "text-slate-700"; // 첫날은 기본색

    // 이전 날짜들 중 가장 최근 기록을 찾음
    let prevRecord = null;
    for (let i = dayIndex - 1; i >= 0; i--) {
      const prevRec = records.find((r) => r.date === days[i]);
      if (prevRec && prevRec.unit_price) { prevRecord = prevRec; break; }
    }

    const curRecord = records.find((r) => r.date === date);
    if (!curRecord || !curRecord.unit_price || !prevRecord) return "text-slate-700";

    if (curRecord.unit_price > prevRecord.unit_price) return "text-red-600";
    if (curRecord.unit_price < prevRecord.unit_price) return "text-blue-600";
    return "text-slate-700";
  };

  // ─────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* 상단 헤더: 월 네비게이터 + 추적 설정 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="h-8 w-8 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white"
          >
            <ChevronLeft size={15} className="text-slate-500" />
          </button>
          <div className="h-8 px-4 flex items-center border border-slate-200 rounded-md bg-white text-sm font-semibold text-slate-800 min-w-[110px] justify-center">
            {year}년 {month}월
          </div>
          <button
            onClick={handleNextMonth}
            disabled={isCurrentMonth}
            className="h-8 w-8 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={15} className="text-slate-500" />
          </button>
        </div>

        {/* 추적 품목 설정 버튼 */}
        <button
          onClick={() => setShowTrackingModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white transition-colors"
        >
          <Settings size={13} />
          추적 품목 설정
        </button>
      </div>

      {/* 그리드 컨테이너 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" />
            데이터 로딩 중...
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-500 text-sm">{error}</div>
        ) : !gridData || !gridData.items || gridData.items.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-sm font-medium mb-2">추적 중인 품목이 없습니다.</p>
            <p className="text-xs">상단의 "추적 품목 설정"에서 단가를 추적할 품목을 선택하세요.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {/* 품목명 고정 열 */}
                  <th className="sticky left-0 z-10 bg-slate-50 text-left px-4 py-3 font-semibold text-slate-600 min-w-[130px] border-r border-slate-200">
                    품목 (단위)
                  </th>
                  {/* 날짜 열 */}
                  {gridData.days.map((day) => {
                    const d = new Date(day);
                    const dow = d.getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"];
                    return (
                      <th
                        key={day}
                        className={`text-center px-1 py-2 font-medium min-w-[50px] ${
                          isWeekend ? "text-red-400" : "text-slate-500"
                        }`}
                      >
                        <div>{parseInt(day.split("-")[2])}</div>
                        <div className="text-[10px] opacity-60">{DOW_KR[dow]}</div>
                      </th>
                    );
                  })}
                  {/* 합계 열 */}
                  <th className="text-center px-3 py-3 font-semibold text-slate-600 min-w-[80px] border-l border-slate-200 bg-slate-50">
                    월 합계
                  </th>
                </tr>
              </thead>
              <tbody>
                {gridData.items.map((item) => {
                  // records를 날짜 키로 인덱싱
                  const recordMap = {};
                  item.records.forEach((rec) => { recordMap[rec.date] = rec; });

                  // 월 합계 계산
                  const monthTotal = item.records.reduce(
                    (sum, rec) => sum + (rec.amount || 0), 0
                  );

                  return (
                    <tr key={item.item_id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      {/* 품목명 + 단위 */}
                      <td className="sticky left-0 z-10 bg-white border-r border-slate-100 px-4 py-2 hover:bg-slate-50/50">
                        <div className="font-medium text-slate-700">{item.item_name}</div>
                        <div className="text-[10px] text-slate-400">{item.unit}</div>
                      </td>

                      {/* 날짜별 단가 셀 */}
                      {gridData.days.map((day) => {
                        const rec = recordMap[day] || null;
                        const colorClass = getPriceColorClass(item.records, day, gridData.days);
                        const isOpen =
                          openPopover?.itemId === item.item_id &&
                          openPopover?.date === day;

                        return (
                          <td key={day} className="text-center px-1 py-1.5 relative">
                            <button
                              onClick={() =>
                                setOpenPopover(
                                  isOpen
                                    ? null
                                    : {
                                        itemId: item.item_id,
                                        itemName: item.item_name,
                                        unit: item.unit,
                                        date: day,
                                        record: rec,
                                      }
                                )
                              }
                              className={`w-full rounded px-1 py-1 text-[11px] hover:bg-slate-100 transition-colors min-h-[32px] flex flex-col items-center justify-center ${colorClass}`}
                            >
                              {rec ? (
                                <>
                                  <span className="font-semibold">
                                    {rec.unit_price?.toLocaleString()}
                                  </span>
                                  <span className="text-[9px] text-slate-400">
                                    {rec.quantity}{item.unit}
                                  </span>
                                </>
                              ) : (
                                <span className="text-slate-200">
                                  <Plus size={10} />
                                </span>
                              )}
                            </button>

                            {/* 단가 입력 팝오버 */}
                            {isOpen && (
                              <PricePopover
                                cell={openPopover}
                                onSave={handleSavePrice}
                                onClose={() => setOpenPopover(null)}
                              />
                            )}
                          </td>
                        );
                      })}

                      {/* 품목별 월 합계 */}
                      <td className="text-right px-3 py-2 border-l border-slate-100 font-semibold text-slate-700">
                        {monthTotal > 0 ? monthTotal.toLocaleString() + "원" : "-"}
                      </td>
                    </tr>
                  );
                })}

                {/* 하단: 날짜별 일별 합계 행 */}
                <tr className="bg-slate-50 border-t border-slate-200 font-semibold">
                  <td className="sticky left-0 z-10 bg-slate-50 border-r border-slate-200 px-4 py-2 text-slate-600">
                    일별 합계
                  </td>
                  {gridData.days.map((day) => {
                    // 해당 날짜의 모든 품목 금액 합산
                    const dayTotal = gridData.items.reduce((sum, item) => {
                      const rec = item.records.find((r) => r.date === day);
                      return sum + (rec?.amount || 0);
                    }, 0);
                    return (
                      <td key={day} className="text-center px-1 py-2 text-slate-600 text-[11px]">
                        {dayTotal > 0 ? dayTotal.toLocaleString() : "-"}
                      </td>
                    );
                  })}
                  {/* 전체 합계 */}
                  <td className="text-right px-3 py-2 border-l border-slate-200 text-slate-800">
                    {gridData.items
                      .reduce(
                        (sum, item) =>
                          sum + item.records.reduce((s, r) => s + (r.amount || 0), 0),
                        0
                      )
                      .toLocaleString()}
                    원
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 추적 품목 설정 모달 */}
      {showTrackingModal && (
        <TrackingModal
          onClose={() => setShowTrackingModal(false)}
          onSaved={loadGrid}
        />
      )}
    </div>
  );
};

export default DailyPriceGrid;
