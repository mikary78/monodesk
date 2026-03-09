// ============================================================
// components/modules/inventory/AdjustmentHistoryTab.jsx
// 재고 수량 조정 이력 탭 컴포넌트 (조회·필터)
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, ClipboardList } from "lucide-react";
import {
  fetchAdjustmentHistory,
  fetchInventoryItems,
  formatDate,
  formatQuantity,
} from "../../../api/inventoryApi";

// 조정 유형별 배지 색상
const ADJUSTMENT_TYPE_CLASS = {
  입고: "bg-green-100 text-green-700",
  출고: "bg-blue-100 text-blue-700",
  실사조정: "bg-yellow-100 text-yellow-700",
  폐기: "bg-red-100 text-red-700",
};

const AdjustmentHistoryTab = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // 전체 품목 목록 (필터용)
  const [allItems, setAllItems] = useState([]);

  // 필터 상태
  const [filterItemId, setFilterItemId] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  // 품목 목록 로드 (필터 드롭다운용)
  useEffect(() => {
    fetchInventoryItems({ limit: 500 })
      .then((res) => setAllItems(res.items || []))
      .catch(() => {});
  }, []);

  // 이력 데이터 로드
  const loadHistory = useCallback(async (currentPage = 0) => {
    try {
      setLoading(true);
      const result = await fetchAdjustmentHistory({
        itemId: filterItemId || undefined,
        adjustmentType: filterType || undefined,
        startDate: filterStart || undefined,
        endDate: filterEnd || undefined,
        skip: currentPage * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setRecords(result.items || []);
      setTotal(result.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterItemId, filterType, filterStart, filterEnd]);

  // 필터 변경 시 첫 페이지로 리셋 후 로드
  useEffect(() => {
    setPage(0);
    loadHistory(0);
  }, [filterItemId, filterType, filterStart, filterEnd]);

  // 페이지 변경
  const handlePageChange = (newPage) => {
    setPage(newPage);
    loadHistory(newPage);
  };

  // 필터 초기화
  const resetFilters = () => {
    setFilterItemId("");
    setFilterType("");
    setFilterStart("");
    setFilterEnd("");
    setPage(0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* 품목 필터 */}
        <select
          value={filterItemId}
          onChange={(e) => setFilterItemId(e.target.value)}
          className="h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">전체 품목</option>
          {allItems.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>

        {/* 조정 유형 필터 */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">전체 유형</option>
          {["입고", "출고", "실사조정", "폐기"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* 날짜 범위 */}
        <input
          type="date"
          value={filterStart}
          onChange={(e) => setFilterStart(e.target.value)}
          className="h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
          placeholder="시작일"
        />
        <span className="text-slate-400 text-sm">~</span>
        <input
          type="date"
          value={filterEnd}
          onChange={(e) => setFilterEnd(e.target.value)}
          className="h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
          placeholder="종료일"
        />

        {/* 필터 초기화 */}
        {(filterItemId || filterType || filterStart || filterEnd) && (
          <button
            onClick={resetFilters}
            className="h-9 px-3 text-sm text-slate-500 border border-slate-200 rounded-md hover:bg-slate-50"
          >
            초기화
          </button>
        )}

        {/* 새로고침 */}
        <button
          onClick={() => loadHistory(page)}
          className="h-9 px-3 border border-slate-200 rounded-md text-slate-500 hover:bg-slate-50"
          title="새로고침"
        >
          <RefreshCw size={14} />
        </button>

        {/* 결과 수 */}
        <span className="ml-auto text-xs text-slate-400">
          총 {total.toLocaleString("ko-KR")}건
        </span>
      </div>

      {/* 에러 */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
          {error}
          <button onClick={() => loadHistory(page)} className="ml-3 underline">다시 시도</button>
        </div>
      )}

      {/* 로딩 스켈레톤 */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-11 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : records.length === 0 ? (
        /* 빈 상태 */
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <ClipboardList size={48} className="mb-3 opacity-40" />
          <p className="text-base font-medium">조정 이력이 없습니다.</p>
          <p className="text-sm mt-1">재고 품목에서 수량을 조정하면 여기에 기록됩니다.</p>
        </div>
      ) : (
        <>
          {/* 이력 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                  <th className="text-left px-4 py-3">날짜</th>
                  <th className="text-left px-4 py-3">품목</th>
                  <th className="text-center px-4 py-3">유형</th>
                  <th className="text-right px-4 py-3">조정 전</th>
                  <th className="text-right px-4 py-3">변동량</th>
                  <th className="text-right px-4 py-3">조정 후</th>
                  <th className="text-right px-4 py-3">단가</th>
                  <th className="text-left px-4 py-3">메모</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec, idx) => {
                  // 변동량 양수·음수에 따라 색상 구분
                  const isPositive = rec.quantity_change > 0;
                  const changeClass = isPositive ? "text-green-600" : "text-red-500";
                  const changePrefix = isPositive ? "+" : "";
                  const unit = rec.item?.unit || "";

                  return (
                    <tr
                      key={rec.id}
                      className={`border-b border-slate-100 hover:bg-blue-50 transition-colors ${
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                      }`}
                    >
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {formatDate(rec.adjustment_date)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {rec.item?.name || `품목 #${rec.item_id}`}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          ADJUSTMENT_TYPE_CLASS[rec.adjustment_type] || "bg-slate-100 text-slate-600"
                        }`}>
                          {rec.adjustment_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {rec.quantity_before} {unit}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${changeClass}`}>
                        {changePrefix}{rec.quantity_change} {unit}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {rec.quantity_after} {unit}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {rec.unit_price != null
                          ? `${rec.unit_price.toLocaleString("ko-KR")}원`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                        {rec.memo || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <button
                disabled={page === 0}
                onClick={() => handlePageChange(page - 1)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-md disabled:opacity-40 hover:bg-slate-50"
              >
                이전
              </button>
              <span className="text-sm text-slate-500">
                {page + 1} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => handlePageChange(page + 1)}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-md disabled:opacity-40 hover:bg-slate-50"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdjustmentHistoryTab;
