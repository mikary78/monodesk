// ============================================================
// components/modules/inventory/DailyPriceGrid.jsx
// 데일리 단가 그리드 컴포넌트
// 엑셀과 유사한 행(품목)×열(날짜) 그리드로 일별 단가를 입력/조회합니다.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Settings, X, Save } from "lucide-react";
import {
  getDailyPriceGrid,
  saveDailyPrice,
  togglePriceTracking,
  fetchInventoryItems,
} from "../../../api/inventoryApi";
import { useToast } from "../../../contexts/ToastContext";

// 요일 레이블 (0: 일요일 ~ 6: 토요일)
const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 금액을 천 단위 구분 문자열로 포맷합니다.
 * 0이거나 falsy이면 빈 문자열을 반환합니다.
 * @param {number} n - 금액
 * @returns {string} 포맷된 금액 문자열
 */
const formatAmount = (n) => {
  if (!n || n === 0) return "";
  return Number(n).toLocaleString("ko-KR");
};

// ─────────────────────────────────────────
// DailyPriceGrid 메인 컴포넌트
// ─────────────────────────────────────────

const DailyPriceGrid = () => {
  const toast = useToast();
  const today = new Date();

  // 연도/월 네비게이션 상태
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  // 그리드 데이터 (백엔드 응답 전체)
  const [gridData, setGridData] = useState(null);
  const [loading, setLoading] = useState(true);

  // 팝오버 상태 — 클릭된 셀 정보 { itemId, dateStr }
  const [popover, setPopover] = useState(null);

  // 팝오버 내 입력값
  const [popInput, setPopInput] = useState({ quantity: "", unit_price: "", vendor: "" });

  // 저장 처리 중 여부
  const [saving, setSaving] = useState(false);

  // 추적 품목 설정 모달 표시 여부
  const [showTrackModal, setShowTrackModal] = useState(false);

  // 추적 설정 모달에서 사용할 전체 품목 목록
  const [allItems, setAllItems] = useState([]);
  const [trackLoading, setTrackLoading] = useState(false);

  // ─── 그리드 데이터 로드 ───────────────────

  const loadGrid = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getDailyPriceGrid(year, month);
      setGridData(data);
    } catch (err) {
      toast.error(`데이터 로드 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  // ─── 월 네비게이션 ────────────────────────

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    // 현재 월 이후로는 이동 불가
    const isCurrentMonth =
      year === today.getFullYear() && month === today.getMonth() + 1;
    if (isCurrentMonth) return;
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // ─── 셀 클릭 → 팝오버 열기 ───────────────

  const handleCellClick = (itemId, dateStr, existingRecord) => {
    setPopover({ itemId, dateStr });
    setPopInput({
      quantity: existingRecord?.quantity ?? "",
      unit_price: existingRecord?.unit_price ?? "",
      vendor: existingRecord?.vendor ?? "",
    });
  };

  // ─── 팝오버 저장 ─────────────────────────

  const handlePopoverSave = async () => {
    if (!popover) return;
    try {
      setSaving(true);
      await saveDailyPrice({
        item_id: popover.itemId,
        record_date: popover.dateStr,
        quantity: parseFloat(popInput.quantity) || 0,
        unit_price: parseInt(popInput.unit_price) || 0,
        vendor: popInput.vendor || null,
      });
      setPopover(null);
      await loadGrid();
    } catch (err) {
      toast.error(`저장 실패: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ─── 추적 품목 설정 모달 열기 ─────────────

  const handleOpenTrackModal = async () => {
    setShowTrackModal(true);
    setTrackLoading(true);
    try {
      // inventoryApi.fetchInventoryItems는 filters 객체를 받습니다
      const data = await fetchInventoryItems({ limit: 200 });
      setAllItems(data.items || []);
    } catch (err) {
      toast.error("품목 목록 로드 실패");
    } finally {
      setTrackLoading(false);
    }
  };

  // ─── 추적 토글 ───────────────────────────

  const handleToggleTrack = async (itemId) => {
    try {
      await togglePriceTracking(itemId);
      // 모달 목록 갱신
      const data = await fetchInventoryItems({ limit: 200 });
      setAllItems(data.items || []);
      // 그리드도 갱신
      await loadGrid();
    } catch (err) {
      toast.error("토글 실패");
    }
  };

  // ─── 단가 등락 색상 계산 ──────────────────

  /**
   * 해당 셀의 unit_price와 직전 기록의 unit_price를 비교하여 색상 클래스를 반환합니다.
   * 직전 기록: 현재 날짜 이전에서 가장 가까운 날짜의 기록을 탐색합니다.
   * @param {object} item - 그리드 품목 행 데이터
   * @param {string} dateStr - 현재 셀 날짜 (YYYY-MM-DD)
   * @param {number} currentPrice - 현재 단가
   * @returns {string} Tailwind 색상 클래스
   */
  const getPriceChangeColor = (item, dateStr, currentPrice) => {
    if (!currentPrice || !gridData) return "text-slate-700";
    const yearMonth = `${year.toString().padStart(4, "0")}-${month
      .toString()
      .padStart(2, "0")}`;
    const day = parseInt(dateStr.split("-")[2]);
    // 현재 날짜 이전 날짜들을 역순으로 탐색하여 직전 기록 찾기
    for (let d = day - 1; d >= 1; d--) {
      const prevDate = `${yearMonth}-${d.toString().padStart(2, "0")}`;
      const prevRecord = item.records[prevDate];
      if (prevRecord && prevRecord.unit_price > 0) {
        if (currentPrice > prevRecord.unit_price) return "text-red-500";   // 상승
        if (currentPrice < prevRecord.unit_price) return "text-blue-500";  // 하락
        return "text-slate-700";                                            // 동일
      }
    }
    return "text-slate-700"; // 직전 기록 없으면 기본 색상
  };

  // ─── 로딩 상태 ───────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-400 text-sm">데이터를 불러오는 중...</div>
      </div>
    );
  }

  const daysInMonth = gridData?.days_in_month || 30;
  // 1일부터 말일까지 날짜 배열 생성
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth() + 1;

  // ─── 렌더링 ──────────────────────────────

  return (
    <div className="space-y-4">

      {/* 헤더: 월 선택 네비게이터 + 추적 품목 설정 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* 이전 달 버튼 */}
          <button
            onClick={handlePrevMonth}
            className="h-8 w-8 flex items-center justify-center border border-slate-200 rounded hover:bg-white"
          >
            <ChevronLeft size={15} className="text-slate-500" />
          </button>

          {/* 연도/월 표시 */}
          <div className="h-8 px-4 flex items-center border border-slate-200 rounded bg-white text-sm font-semibold text-slate-900 min-w-[110px] justify-center">
            {year}년 {month}월
          </div>

          {/* 다음 달 버튼 (현재 월이면 비활성화) */}
          <button
            onClick={handleNextMonth}
            disabled={isCurrentMonth}
            className="h-8 w-8 flex items-center justify-center border border-slate-200 rounded hover:bg-white disabled:opacity-30"
          >
            <ChevronRight size={15} className="text-slate-500" />
          </button>
        </div>

        {/* 추적 품목 설정 버튼 */}
        <button
          onClick={handleOpenTrackModal}
          className="flex items-center gap-2 h-8 px-3 text-sm border border-slate-200 rounded hover:bg-white text-slate-600"
        >
          <Settings size={14} />
          추적 품목 설정
        </button>
      </div>

      {/* 추적 품목이 없을 때 안내 메시지 */}
      {(!gridData?.items || gridData.items.length === 0) && (
        <div className="bg-slate-50 rounded-lg p-8 text-center">
          <p className="text-slate-500 text-sm mb-2">추적 대상 품목이 없습니다.</p>
          <p className="text-slate-400 text-xs">
            오른쪽 상단 "추적 품목 설정" 버튼으로 단가를 추적할 품목을 추가해주세요.
          </p>
        </div>
      )}

      {/* 그리드 테이블 — 가로 스크롤 지원 */}
      {gridData?.items && gridData.items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table
            className="text-xs border-collapse"
            style={{ minWidth: `${80 + daysInMonth * 64 + 80}px` }}
          >
            <thead>
              {/* 날짜 헤더 행 */}
              <tr className="bg-slate-50">
                {/* 품목 컬럼 헤더 (왼쪽 고정) */}
                <th className="sticky left-0 z-10 bg-slate-50 border-b border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-700 w-20">
                  품목
                </th>

                {/* 날짜별 헤더 셀 */}
                {days.map((d) => {
                  const dateStr = `${year.toString().padStart(4, "0")}-${month
                    .toString()
                    .padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
                  const dow = new Date(year, month - 1, d).getDay();
                  return (
                    <th
                      key={d}
                      className={`border-b border-r border-slate-200 px-1 py-1.5 text-center w-16 font-medium ${
                        dow === 0
                          ? "text-red-400"    // 일요일 = 빨강
                          : dow === 6
                          ? "text-blue-400"   // 토요일 = 파랑
                          : "text-slate-600"  // 평일 = 기본
                      }`}
                    >
                      <div>{d}</div>
                      <div className="text-slate-400 font-normal">{DAY_LABELS[dow]}</div>
                    </th>
                  );
                })}

                {/* 월합계 컬럼 헤더 */}
                <th className="border-b border-slate-200 px-3 py-2 text-center font-semibold text-slate-700 w-20">
                  월합계
                </th>
              </tr>
            </thead>

            <tbody>
              {/* 품목별 데이터 행 */}
              {gridData.items.map((item) => (
                <tr key={item.item_id} className="hover:bg-slate-50/50">
                  {/* 품목명 (왼쪽 고정, 단위 포함) */}
                  <td className="sticky left-0 z-10 bg-white border-b border-r border-slate-200 px-3 py-2 font-medium text-slate-800">
                    <div>{item.item_name}</div>
                    <div className="text-slate-400 font-normal">{item.unit}</div>
                  </td>

                  {/* 날짜별 데이터 셀 */}
                  {days.map((d) => {
                    const dateStr = `${year.toString().padStart(4, "0")}-${month
                      .toString()
                      .padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
                    const rec = item.records[dateStr];
                    const isOpen =
                      popover?.itemId === item.item_id &&
                      popover?.dateStr === dateStr;
                    const priceColor =
                      rec?.unit_price
                        ? getPriceChangeColor(item, dateStr, rec.unit_price)
                        : "";

                    return (
                      <td
                        key={d}
                        className={`border-b border-r border-slate-200 px-1 py-1 text-center cursor-pointer relative ${
                          isOpen
                            ? "bg-blue-50"            // 팝오버 열린 셀
                            : rec
                            ? "bg-green-50/30 hover:bg-green-50"  // 기록 있는 셀
                            : "hover:bg-slate-50"     // 빈 셀
                        }`}
                        onClick={() => handleCellClick(item.item_id, dateStr, rec)}
                      >
                        {rec ? (
                          // 기록 있는 셀: 단가 + 수량 표시
                          <div>
                            <div className={`font-semibold ${priceColor}`}>
                              {formatAmount(rec.unit_price)}
                            </div>
                            {rec.quantity > 0 && (
                              <div className="text-slate-400">{rec.quantity}</div>
                            )}
                          </div>
                        ) : (
                          // 기록 없는 셀: 회색 대시 표시
                          <div className="text-slate-200">-</div>
                        )}
                      </td>
                    );
                  })}

                  {/* 월합계 셀 */}
                  <td className="border-b border-slate-200 px-3 py-2 text-right font-semibold text-slate-800">
                    {formatAmount(item.monthly_total)}
                  </td>
                </tr>
              ))}

              {/* 하단 일계(날짜별 합계) 행 */}
              <tr className="bg-slate-50 font-semibold">
                <td className="sticky left-0 z-10 bg-slate-50 border-t border-r border-slate-200 px-3 py-2 text-slate-700">
                  일계
                </td>
                {days.map((d) => {
                  const dateStr = `${year.toString().padStart(4, "0")}-${month
                    .toString()
                    .padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
                  const total = gridData.daily_totals[dateStr] || 0;
                  return (
                    <td
                      key={d}
                      className="border-t border-r border-slate-200 px-1 py-2 text-center text-slate-700"
                    >
                      {total > 0 ? formatAmount(total) : ""}
                    </td>
                  );
                })}
                {/* 월 전체 합계 */}
                <td className="border-t border-slate-200 px-3 py-2 text-right text-slate-900">
                  {formatAmount(
                    Object.values(gridData.daily_totals).reduce(
                      (a, b) => a + b,
                      0
                    )
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ─── 단가 입력 팝오버 ─────────────────────────────────── */}
      {popover && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/20"
          onClick={() => setPopover(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-5 w-72 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 팝오버 헤더 */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">
                단가 입력 — {popover.dateStr}
              </h3>
              <button
                onClick={() => setPopover(null)}
                className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100"
              >
                <X size={15} className="text-slate-400" />
              </button>
            </div>

            {/* 수량 입력 */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">수량</label>
              <input
                type="number"
                step="0.1"
                value={popInput.quantity}
                onChange={(e) =>
                  setPopInput((p) => ({ ...p, quantity: e.target.value }))
                }
                placeholder="0"
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 단가 입력 */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">단가 (원)</label>
              <input
                type="number"
                value={popInput.unit_price}
                onChange={(e) =>
                  setPopInput((p) => ({ ...p, unit_price: e.target.value }))
                }
                placeholder="0"
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 금액 자동 계산 표시 */}
            {popInput.quantity && popInput.unit_price && (
              <div className="text-xs text-slate-500 text-right">
                금액:{" "}
                <strong>
                  {formatAmount(
                    Math.round(
                      parseFloat(popInput.quantity || 0) *
                        parseInt(popInput.unit_price || 0)
                    )
                  )}
                  원
                </strong>
              </div>
            )}

            {/* 구매처 입력 (선택) */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">구매처</label>
              <input
                type="text"
                value={popInput.vendor}
                onChange={(e) =>
                  setPopInput((p) => ({ ...p, vendor: e.target.value }))
                }
                placeholder="거래처명 (선택)"
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 취소 / 저장 버튼 */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setPopover(null)}
                className="flex-1 h-9 text-sm border border-slate-200 rounded-md hover:bg-slate-50"
              >
                취소
              </button>
              <button
                onClick={handlePopoverSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-blue-500 text-white text-sm font-semibold rounded-md hover:bg-blue-600 disabled:opacity-50"
              >
                <Save size={14} />
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 추적 품목 설정 모달 ────────────────────────────────── */}
      {showTrackModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/30"
          onClick={() => setShowTrackModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">
                데일리 단가 추적 품목 설정
              </h3>
              <button
                onClick={() => setShowTrackModal(false)}
                className="h-8 w-8 flex items-center justify-center rounded hover:bg-slate-100"
              >
                <X size={16} className="text-slate-400" />
              </button>
            </div>

            {/* 모달 콘텐츠 — 스크롤 가능 */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {trackLoading ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  불러오는 중...
                </div>
              ) : allItems.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  등록된 품목이 없습니다.
                </div>
              ) : (
                allItems
                  .filter((i) => !i.is_deleted)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50"
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-800">
                          {item.name}
                        </div>
                        <div className="text-xs text-slate-400">{item.unit}</div>
                      </div>
                      {/* 추적 토글 버튼 */}
                      <button
                        onClick={() => handleToggleTrack(item.id)}
                        className={`h-7 px-3 text-xs font-medium rounded-full border transition-colors ${
                          item.is_daily_price_tracked
                            ? "bg-blue-500 text-white border-blue-500 hover:bg-blue-600"
                            : "bg-white text-slate-500 border-slate-300 hover:border-blue-400 hover:text-blue-500"
                        }`}
                      >
                        {item.is_daily_price_tracked ? "추적 중" : "추적 안함"}
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyPriceGrid;
