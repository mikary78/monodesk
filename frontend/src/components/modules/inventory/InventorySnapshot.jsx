// ============================================================
// InventorySnapshot.jsx — 재고 스냅샷 컴포넌트
// 월초/월말 재고 현황을 스냅샷으로 기록하고 확정합니다.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Lock, CheckCircle, RefreshCw, Loader2 } from "lucide-react";
import {
  getSnapshot,
  generateSnapshot,
  updateSnapshotItem,
  confirmSnapshot,
} from "../../../api/inventoryApi";

// ─────────────────────────────────────────
// 인라인 편집 가능한 셀 컴포넌트
// ─────────────────────────────────────────

/**
 * 클릭 시 인라인 편집이 가능한 숫자 셀.
 * @param {object} props
 * @param {number} props.value - 현재 값
 * @param {boolean} props.disabled - 편집 비활성화 여부 (확정 상태)
 * @param {function} props.onSave - 저장 핸들러 (newValue) => void
 * @param {string} props.className - 추가 CSS 클래스
 */
const EditableCell = ({ value, disabled, onSave, className = "" }) => {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(value ?? "");

  /** 편집 시작 */
  const handleClick = () => {
    if (disabled) return;
    setInputVal(value ?? "");
    setEditing(true);
  };

  /** Enter 또는 blur 시 저장 */
  const handleDone = () => {
    setEditing(false);
    const parsed = parseFloat(inputVal);
    if (!isNaN(parsed) && parsed !== value) {
      onSave(parsed);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleDone();
    if (e.key === "Escape") setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        step="0.01"
        min="0"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onBlur={handleDone}
        onKeyDown={handleKeyDown}
        className="w-full border border-blue-400 rounded px-1.5 py-0.5 text-xs text-right focus:outline-none bg-blue-50"
      />
    );
  }

  return (
    <span
      onClick={handleClick}
      className={`cursor-pointer hover:bg-slate-100 rounded px-1 py-0.5 text-xs ${
        disabled ? "cursor-default" : "hover:underline"
      } ${className}`}
      title={disabled ? "확정된 항목은 수정할 수 없습니다." : "클릭하여 편집"}
    >
      {value !== null && value !== undefined ? value.toLocaleString() : "-"}
    </span>
  );
};

// ─────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────

/**
 * 월초 또는 월말 재고 스냅샷 컴포넌트.
 * @param {object} props
 * @param {string} props.snapshotType - "month_start" 또는 "month_end"
 */
const InventorySnapshot = ({ snapshotType }) => {
  const today = new Date();

  // 연/월 상태
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  // 스냅샷 데이터 상태
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 생성/확정 버튼 로딩 상태
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // 현재 달 여부 (다음 달 이동 비활성화용)
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  // 스냅샷 타입 한글 레이블
  const typeLabel = snapshotType === "month_start" ? "월초 재고" : "월말 재고";

  // ─────────────────────────────────────────
  // 스냅샷 데이터 로드
  // ─────────────────────────────────────────

  const loadSnapshot = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSnapshot(snapshotType, year, month);
      setSnapshot(data);
    } catch (err) {
      // 스냅샷이 없는 경우 null로 처리 (404 등)
      if (err.message?.includes("404") || err.message?.includes("없")) {
        setSnapshot(null);
      } else {
        setError(err.message || "스냅샷을 불러오지 못했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }, [snapshotType, year, month]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

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
  // 초안 생성 핸들러
  // ─────────────────────────────────────────

  const handleGenerate = async () => {
    if (!window.confirm(`${year}년 ${month}월 ${typeLabel} 초안을 현재 재고 기준으로 생성합니다.\n계속하시겠습니까?`)) return;
    setGenerating(true);
    try {
      await generateSnapshot(snapshotType, year, month);
      await loadSnapshot();
    } catch (err) {
      alert(err.message || "초안 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  // ─────────────────────────────────────────
  // 확정 처리 핸들러
  // ─────────────────────────────────────────

  const handleConfirm = async () => {
    // 타입에 따라 확인 메시지 분기
    const confirmMsg =
      snapshotType === "month_end"
        ? "월말 재고를 확정합니다.\n확정 후에는 수정할 수 없으며, 다음 달 월초 재고에 자동 반영됩니다.\n계속하시겠습니까?"
        : "월초 재고를 확정합니다.\n확정 후에는 수정할 수 없습니다.\n계속하시겠습니까?";

    if (!window.confirm(confirmMsg)) return;
    setConfirming(true);
    try {
      await confirmSnapshot(snapshotType, year, month);
      await loadSnapshot();
    } catch (err) {
      alert(err.message || "확정 처리에 실패했습니다.");
    } finally {
      setConfirming(false);
    }
  };

  // ─────────────────────────────────────────
  // 항목 수정 핸들러
  // ─────────────────────────────────────────

  /**
   * 스냅샷 항목의 수량 또는 단가를 수정하고 로컬 상태를 갱신합니다.
   * @param {number} itemId - 스냅샷 항목 ID
   * @param {string} field - "quantity" 또는 "unit_price"
   * @param {number} newValue - 새 값
   * @param {string} categoryName - 카테고리명 (로컬 상태 업데이트용)
   */
  const handleUpdateItem = async (itemId, field, newValue, categoryName) => {
    // 현재 항목의 다른 필드값을 찾아서 함께 전송
    const category = snapshot.categories.find((c) => c.category === categoryName);
    const item = category?.items.find((i) => i.id === itemId);
    if (!item) return;

    const payload = {
      quantity: field === "quantity" ? newValue : item.quantity,
      unit_price: field === "unit_price" ? newValue : item.unit_price,
    };

    try {
      await updateSnapshotItem(itemId, payload);
      // 로컬 상태 업데이트 (리로드 없이 즉시 반영)
      setSnapshot((prev) => ({
        ...prev,
        categories: prev.categories.map((cat) => {
          if (cat.category !== categoryName) return cat;
          return {
            ...cat,
            items: cat.items.map((i) => {
              if (i.id !== itemId) return i;
              const updated = { ...i, [field]: newValue };
              // amount 재계산
              updated.amount = (updated.quantity || 0) * (updated.unit_price || 0);
              return updated;
            }),
          };
        }),
      }));
    } catch (err) {
      alert(err.message || "항목 수정에 실패했습니다.");
    }
  };

  // ─────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* 상단 헤더: 월 네비게이터 + 액션 버튼 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* 월 네비게이터 */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="h-8 w-8 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white"
          >
            <ChevronLeft size={15} className="text-slate-500" />
          </button>
          <div className="h-8 px-4 flex items-center border border-slate-200 rounded-md bg-white text-sm font-semibold text-slate-800 min-w-[130px] justify-center">
            {year}년 {month}월 {typeLabel}
          </div>
          <button
            onClick={handleNextMonth}
            disabled={isCurrentMonth}
            className="h-8 w-8 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight size={15} className="text-slate-500" />
          </button>
        </div>

        {/* 액션 버튼 그룹 */}
        <div className="flex items-center gap-2">
          {/* 확정 상태 배지 */}
          {snapshot?.is_confirmed && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-lg">
              <CheckCircle size={13} />
              확정됨
            </span>
          )}

          {/* 초안 생성 버튼 (미확정 상태에서만 표시) */}
          {!snapshot?.is_confirmed && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={13} className={generating ? "animate-spin" : ""} />
              {generating ? "생성 중..." : "현재 재고로 초안 생성"}
            </button>
          )}

          {/* 확정 버튼 (스냅샷이 있고 미확정 상태에서만 표시) */}
          {snapshot && !snapshot.is_confirmed && (
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg disabled:opacity-50 transition-colors"
            >
              <Lock size={13} />
              {confirming ? "확정 중..." : "확정"}
            </button>
          )}
        </div>
      </div>

      {/* 스냅샷 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" />
            스냅샷 로딩 중...
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-500 text-sm">{error}</div>
        ) : !snapshot || !snapshot.categories || snapshot.categories.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-sm font-medium mb-2">{year}년 {month}월 {typeLabel} 스냅샷이 없습니다.</p>
            <p className="text-xs">"현재 재고로 초안 생성" 버튼을 클릭하여 시작하세요.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 font-semibold text-slate-600">품목</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600 w-24">단위</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 w-28">
                  수량
                  {!snapshot.is_confirmed && (
                    <span className="text-[10px] font-normal text-blue-400 ml-1">(클릭 편집)</span>
                  )}
                </th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600 w-28">
                  단가 (원)
                  {!snapshot.is_confirmed && (
                    <span className="text-[10px] font-normal text-blue-400 ml-1">(클릭 편집)</span>
                  )}
                </th>
                <th className="text-right px-5 py-3 font-semibold text-slate-600 w-32">금액 (원)</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // 전체 합계 계산용 누적 변수
                let grandTotal = 0;

                // 카테고리별 테이블 행 렌더링
                const rows = snapshot.categories.flatMap((cat) => {
                  const catTotal = cat.items.reduce((sum, item) => sum + (item.amount || 0), 0);
                  grandTotal += catTotal;

                  return [
                    // 카테고리 헤더 행
                    <tr key={`cat_${cat.category}`} className="bg-slate-100 border-y border-slate-200">
                      <td colSpan={4} className="px-5 py-2 font-semibold text-slate-700 text-xs uppercase">
                        {cat.category}
                      </td>
                      <td className="text-right px-5 py-2 font-semibold text-slate-700 text-xs">
                        {catTotal.toLocaleString()}원
                      </td>
                    </tr>,

                    // 품목 행들
                    ...cat.items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-5 py-2.5 text-slate-700">{item.item_name}</td>
                        <td className="text-center px-4 py-2.5 text-slate-400 text-xs">
                          {item.unit || "-"}
                        </td>
                        {/* 수량 — 인라인 편집 가능 */}
                        <td className="text-right px-4 py-2.5">
                          <EditableCell
                            value={item.quantity}
                            disabled={snapshot.is_confirmed}
                            onSave={(v) => handleUpdateItem(item.id, "quantity", v, cat.category)}
                            className="text-slate-700"
                          />
                        </td>
                        {/* 단가 — 인라인 편집 가능 */}
                        <td className="text-right px-4 py-2.5">
                          <EditableCell
                            value={item.unit_price}
                            disabled={snapshot.is_confirmed}
                            onSave={(v) => handleUpdateItem(item.id, "unit_price", v, cat.category)}
                            className="text-slate-700"
                          />
                        </td>
                        {/* 금액 — 자동 계산 */}
                        <td className="text-right px-5 py-2.5 text-slate-700 font-medium">
                          {(item.amount || 0).toLocaleString()}
                        </td>
                      </tr>
                    )),
                  ];
                });

                return (
                  <>
                    {rows}
                    {/* 전체 합계 행 */}
                    <tr className="bg-slate-50 border-t-2 border-slate-300">
                      <td colSpan={4} className="px-5 py-3 font-bold text-slate-800">
                        전체 합계
                      </td>
                      <td className="text-right px-5 py-3 font-bold text-slate-900 text-base">
                        {grandTotal.toLocaleString()}원
                      </td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        )}
      </div>

      {/* month_end 확정 안내 메시지 */}
      {snapshotType === "month_end" && snapshot?.is_confirmed && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
          이 월말 재고는 확정되었으며, 다음 달 월초 재고에 자동 반영됩니다.
        </div>
      )}
    </div>
  );
};

export default InventorySnapshot;
