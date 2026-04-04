// ============================================================
// InventorySnapshot.jsx — 월초/월말 재고 스냅샷 컴포넌트
// 엑셀 8-1.월초재고 / 8-2.월말재고 시트 구현
// 월말 확정 시 다음달 월초로 자동 이월됩니다.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, CheckCircle, Clock, RefreshCw, Lock
} from "lucide-react";
import {
  getSnapshot, confirmSnapshot, updateSnapshotItem, generateSnapshot
} from "../../../api/inventoryApi";
import { useToast } from "../../../contexts/ToastContext";
import ConfirmDialog from "../../common/ConfirmDialog";

// 스냅샷 유형 → 한국어 레이블 변환 맵
const TYPE_LABELS = {
  month_start: "월초재고",
  month_end: "월말재고",
};

/**
 * 숫자를 한국식 천 단위 구분 포맷으로 변환합니다.
 * 예: 1234567 → "1,234,567"
 * @param {number} n - 변환할 숫자
 */
const fmt = (n) => (n || 0).toLocaleString("ko-KR");

/**
 * 재고 스냅샷 컴포넌트
 * 월초/월말 재고를 카테고리별 테이블로 표시하고,
 * 인라인 편집 및 확정 기능을 제공합니다.
 *
 * @param {string} snapshotType - "month_start" | "month_end"
 * @param {number} initialYear - 초기 연도 (InventoryPage에서 주입)
 * @param {number} initialMonth - 초기 월 (InventoryPage에서 주입)
 */
const InventorySnapshot = ({ snapshotType, initialYear, initialMonth }) => {
  const toast = useToast();

  // ─ 연도/월 상태 (props로 받은 초기값 사용, 이후 자체 관리)
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  // ─ 스냅샷 데이터 상태
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // ─ 인라인 편집 상태: 현재 편집 중인 스냅샷 항목 ID
  const [editingId, setEditingId] = useState(null);
  // ─ 편집 폼 값: {quantity, unit_price}
  const [editForm, setEditForm] = useState({ quantity: "", unit_price: "" });

  // ─ 확정 확인 다이얼로그 열림 여부
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ─ 저장/생성/확정 처리 중 상태 (버튼 비활성화용)
  const [saving, setSaving] = useState(false);

  // ─────────────────────────────────────────
  // 데이터 로드 함수
  // ─────────────────────────────────────────

  /**
   * 서버에서 스냅샷 데이터를 가져옵니다.
   * month_start이고 데이터가 없으면 서버에서 직전달 month_end를 자동 이월합니다.
   */
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getSnapshot(snapshotType, year, month);
      setData(result);
    } catch (err) {
      toast.error(`데이터 로드 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [snapshotType, year, month]);

  // year, month, snapshotType이 변경될 때마다 데이터 재로드
  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─────────────────────────────────────────
  // 월 네비게이션 핸들러
  // ─────────────────────────────────────────

  /** 이전 달로 이동 */
  const handlePrevMonth = () => {
    if (month === 1) {
      setYear(y => y - 1);
      setMonth(12);
    } else {
      setMonth(m => m - 1);
    }
    // 편집 중인 항목 초기화
    setEditingId(null);
  };

  /** 다음 달로 이동 */
  const handleNextMonth = () => {
    if (month === 12) {
      setYear(y => y + 1);
      setMonth(1);
    } else {
      setMonth(m => m + 1);
    }
    // 편집 중인 항목 초기화
    setEditingId(null);
  };

  // ─────────────────────────────────────────
  // 초안 생성 핸들러
  // ─────────────────────────────────────────

  /**
   * "현재 재고로 초안 생성" 버튼 클릭 시 실행.
   * 서버의 inventory_items.current_quantity 기준으로 스냅샷 초안을 생성합니다.
   */
  const handleGenerate = async () => {
    try {
      setSaving(true);
      const result = await generateSnapshot(snapshotType, year, month);
      setData(result);
      toast.success("현재 재고 기준으로 초안이 생성되었습니다.");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────
  // 확정 처리 핸들러
  // ─────────────────────────────────────────

  /**
   * 확정 다이얼로그에서 "확정" 버튼 클릭 시 실행.
   * month_end 확정 시 다음달 month_start가 서버에서 자동 생성됩니다.
   */
  const handleConfirm = async () => {
    setConfirmOpen(false);
    try {
      setSaving(true);
      const result = await confirmSnapshot(snapshotType, year, month);
      setData(result);
      toast.success(
        snapshotType === "month_end"
          ? "월말재고가 확정되었습니다. 다음달 월초재고가 자동 생성됩니다."
          : "월초재고가 확정되었습니다."
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────
  // 인라인 편집 핸들러
  // ─────────────────────────────────────────

  /**
   * 테이블 행 클릭 시 인라인 편집 모드로 전환합니다.
   * 확정된 스냅샷은 편집 불가.
   * @param {object} snap - 스냅샷 항목 데이터
   */
  const handleEditStart = (snap) => {
    // 확정된 경우 편집 불가
    if (data?.is_confirmed) return;
    setEditingId(snap.id);
    // 현재 값으로 편집 폼 초기화
    setEditForm({ quantity: snap.quantity, unit_price: snap.unit_price });
  };

  /**
   * 편집 저장 버튼 클릭 시 서버에 수정 요청을 보냅니다.
   * 저장 후 스냅샷 전체를 다시 로드합니다.
   * @param {number} snapId - 저장할 스냅샷 항목 ID
   */
  const handleEditSave = async (snapId) => {
    try {
      await updateSnapshotItem(snapId, {
        quantity: parseFloat(editForm.quantity) || 0,
        unit_price: parseInt(editForm.unit_price) || 0,
      });
      // 편집 모드 종료 후 전체 데이터 갱신
      setEditingId(null);
      await loadData();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ─────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────

  // 로딩 중 표시
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-slate-400 text-sm">불러오는 중...</div>
      </div>
    );
  }

  // 파생 상태값
  const isEmpty = !data || data.categories.length === 0;
  const isConfirmed = data?.is_confirmed;
  const typeLabel = TYPE_LABELS[snapshotType];

  return (
    <div className="space-y-4">
      {/* ── 상단 컨트롤 바: 연월 네비게이션 + 상태 배지 + 버튼 ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">

        {/* 좌측: 연월 네비게이터 + 상태 배지 */}
        <div className="flex items-center gap-3">
          {/* 이전 달 버튼 */}
          <button
            onClick={handlePrevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 text-slate-500"
          >
            <ChevronLeft size={15} />
          </button>

          {/* 연월 표시 */}
          <h3 className="text-sm font-semibold text-slate-700 min-w-[100px] text-center">
            {year}년 {month}월 {typeLabel}
          </h3>

          {/* 다음 달 버튼 */}
          <button
            onClick={handleNextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 hover:bg-slate-50 text-slate-500"
          >
            <ChevronRight size={15} />
          </button>

          {/* 확정 상태 배지 */}
          {isConfirmed ? (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              <CheckCircle size={12} />
              확정완료
              {data.confirmed_at && (
                <span className="text-green-500">
                  · {data.confirmed_at.substring(0, 10)}
                </span>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
              <Clock size={12} />
              미확정
            </span>
          )}
        </div>

        {/* 우측: 액션 버튼 그룹 */}
        <div className="flex items-center gap-2">
          {/* 초안 생성 버튼 — 미확정 상태에서만 표시 */}
          {!isConfirmed && (
            <button
              onClick={handleGenerate}
              disabled={saving}
              className="flex items-center gap-1.5 h-8 px-3 text-xs border border-slate-200 rounded-md hover:bg-white text-slate-600 disabled:opacity-50 bg-slate-50"
            >
              <RefreshCw size={13} />
              현재 재고로 초안 생성
            </button>
          )}

          {/* 확정 버튼 — 데이터가 있고 미확정 상태에서만 표시 */}
          {!isConfirmed && !isEmpty && (
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={saving}
              className="flex items-center gap-1.5 h-8 px-3 text-xs bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              <CheckCircle size={13} />
              확정
            </button>
          )}

          {/* 확정 잠금 표시 — 확정된 경우 표시 */}
          {isConfirmed && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Lock size={13} />
              수정 잠금
            </span>
          )}
        </div>
      </div>

      {/* ── 빈 상태 안내 ── */}
      {isEmpty && (
        <div className="bg-slate-50 rounded-lg p-10 text-center">
          <p className="text-slate-500 text-sm mb-1">
            {typeLabel} 데이터가 없습니다.
          </p>
          <p className="text-slate-400 text-xs">
            "현재 재고로 초안 생성" 버튼을 눌러 시작하세요.
          </p>
        </div>
      )}

      {/* ── 카테고리별 테이블 ── */}
      {!isEmpty && data.categories.map((cat) => (
        <div key={cat.category_id} className="rounded-lg border border-slate-200 overflow-hidden">

          {/* 카테고리 헤더: 색상 dot + 이름 + 품목 수 + 소계 */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              {/* 카테고리 색상 dot — 동적 값이므로 인라인 style 허용 */}
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: cat.category_color }}
              />
              <span className="text-sm font-semibold text-slate-700">
                {cat.category_name}
              </span>
              <span className="text-xs text-slate-400">{cat.items.length}개</span>
            </div>
            {/* 카테고리 소계 */}
            <span className="text-sm font-bold text-slate-800">
              {fmt(cat.subtotal)}원
            </span>
          </div>

          {/* 품목 테이블 */}
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/50 text-xs text-slate-500 border-b border-slate-100">
                <th className="text-left px-4 py-2 font-medium">품목명</th>
                <th className="text-center px-3 py-2 font-medium w-16">단위</th>
                <th className="text-right px-3 py-2 font-medium w-24">수량</th>
                <th className="text-right px-3 py-2 font-medium w-28">매입단가</th>
                <th className="text-right px-4 py-2 font-medium w-28">금액</th>
              </tr>
            </thead>
            <tbody>
              {cat.items.map((item) => {
                const isEditing = editingId === item.id;
                // 편집 중인 경우 실시간 금액 미리보기 계산
                const editQty = parseFloat(editForm.quantity) || 0;
                const editPrice = parseInt(editForm.unit_price) || 0;
                const editAmount = Math.round(editQty * editPrice);

                return (
                  <tr
                    key={item.id}
                    className={`border-b border-slate-100 last:border-b-0 transition-colors ${
                      !isConfirmed ? "cursor-pointer hover:bg-blue-50/30" : ""
                    } ${isEditing ? "bg-blue-50/50" : ""}`}
                    // 행 클릭 시 편집 모드 진입 (확정 전만)
                    onClick={() => !isEditing && handleEditStart(item)}
                  >
                    {/* 품목명 */}
                    <td className="px-4 py-2.5 text-slate-800 font-medium">
                      {item.item_name}
                    </td>

                    {/* 단위 */}
                    <td className="px-3 py-2.5 text-center text-slate-500">
                      {item.unit}
                    </td>

                    {/* 수량 — 편집 중이면 input, 아니면 텍스트 */}
                    <td className="px-3 py-2.5 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editForm.quantity}
                          onChange={e =>
                            setEditForm(p => ({ ...p, quantity: e.target.value }))
                          }
                          // 행 클릭 이벤트가 버블링되지 않도록 차단
                          onClick={e => e.stopPropagation()}
                          className="w-20 h-7 px-2 text-xs text-right border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                      ) : (
                        <span className="text-slate-700">{item.quantity}</span>
                      )}
                    </td>

                    {/* 매입단가 — 편집 중이면 input, 아니면 텍스트 */}
                    <td className="px-3 py-2.5 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editForm.unit_price}
                          onChange={e =>
                            setEditForm(p => ({ ...p, unit_price: e.target.value }))
                          }
                          onClick={e => e.stopPropagation()}
                          className="w-24 h-7 px-2 text-xs text-right border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="text-slate-700">
                          {item.unit_price > 0 ? `${fmt(item.unit_price)}원` : "-"}
                        </span>
                      )}
                    </td>

                    {/* 금액 — 편집 중이면 미리보기 + 저장/취소 버튼 */}
                    <td className="px-4 py-2.5 text-right">
                      {isEditing ? (
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={e => e.stopPropagation()}
                        >
                          {/* 실시간 금액 미리보기 */}
                          <span className="text-xs text-slate-500">
                            {fmt(editAmount)}원
                          </span>
                          {/* 저장 버튼 */}
                          <button
                            onClick={() => handleEditSave(item.id)}
                            className="h-6 px-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            저장
                          </button>
                          {/* 취소 버튼 */}
                          <button
                            onClick={() => setEditingId(null)}
                            className="h-6 px-2 text-xs border border-slate-200 rounded hover:bg-slate-50 text-slate-600"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <span className="font-medium text-slate-800">
                          {item.amount > 0 ? `${fmt(item.amount)}원` : "-"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {/* ── 전체 합계 푸터 ── */}
      {!isEmpty && (
        <div className="flex justify-end">
          <div className="bg-slate-900 text-white rounded-lg px-6 py-3 text-sm font-semibold">
            전체 합계: {fmt(data.grand_total)}원
          </div>
        </div>
      )}

      {/* ── 확정 확인 다이얼로그 ── */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title={`${typeLabel} 확정`}
        message={
          snapshotType === "month_end"
            ? `${year}년 ${month}월 월말재고를 확정하시겠습니까?\n확정 후에는 수정할 수 없으며, 다음달 월초재고가 자동 생성됩니다.`
            : `${year}년 ${month}월 월초재고를 확정하시겠습니까?\n확정 후에는 수정할 수 없습니다.`
        }
        confirmText="확정"
        variant="primary"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};

export default InventorySnapshot;
