// ============================================================
// FixedCostMonthly.jsx — 월별 고정비 실적 관리
// 연도/월 선택 → 설정금액 vs 실제금액 비교
// 실제금액 / 납부일 / 메모 인라인 편집
// ============================================================

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import {
  getFixedCostSummary,
  updateFixedCostRecord,
} from "../../../api/operationsApi";
import { useToast } from "../../../contexts/ToastContext";

const CATEGORY_LABELS = { facility: "시설비 (고정비1)", operation: "운영 고정비 (고정비2)" };
const CATEGORY_COLORS = {
  facility:  "text-blue-700 bg-blue-50",
  operation: "text-purple-700 bg-purple-50",
};

const fmt = (v) => (v ?? 0).toLocaleString("ko-KR");

const FixedCostMonthly = () => {
  const toast = useToast();
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  // 인라인 편집 상태
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm]   = useState({});

  useEffect(() => { loadSummary(); }, [year, month]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await getFixedCostSummary(year, month);
      setSummary(data);
    } catch (err) {
      toast.error("고정비 데이터 조회 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 월 이동
  const handlePrev = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else { setMonth(m => m - 1); }
  };
  const handleNext = () => {
    const isCurrent = year === today.getFullYear() && month === today.getMonth() + 1;
    if (isCurrent) return;
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else { setMonth(m => m + 1); }
  };
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  // 인라인 편집 시작
  const startEdit = (record) => {
    setEditingId(record.id);
    setEditForm({
      actual_amount: record.actual_amount || 0,
      payment_date:  record.payment_date  || "",
      memo:          record.memo          || "",
    });
  };

  // 인라인 편집 저장
  const saveEdit = async (record) => {
    try {
      await updateFixedCostRecord(record.id, {
        actual_amount: parseInt(editForm.actual_amount.toString().replace(/,/g, "")) || 0,
        payment_date:  editForm.payment_date || null,
        memo:          editForm.memo.trim() || null,
      });
      setEditingId(null);
      await loadSummary();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // 카테고리별 그룹핑
  const grouped = (summary?.items || []).reduce((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const variance = summary?.variance ?? 0;

  return (
    <div>
      {/* 월 네비게이터 */}
      <div className="flex items-center gap-2 mb-5">
        <button onClick={handlePrev} className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white">
          <ChevronLeft size={15} className="text-slate-500" />
        </button>
        <div className="h-9 px-4 flex items-center border border-slate-200 rounded-md bg-white text-sm font-semibold text-slate-900 min-w-[110px] justify-center">
          {year}년 {month}월
        </div>
        <button onClick={handleNext} disabled={isCurrentMonth} className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed">
          <ChevronRight size={15} className="text-slate-500" />
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-400">불러오는 중...</div>
      ) : summary && (
        <>
          {/* 요약 카드 3개 */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">설정금액 합계</p>
              <p className="text-xl font-bold text-slate-800">{fmt(summary.total_default)}원</p>
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">실제금액 합계</p>
              <p className="text-xl font-bold text-slate-800">{fmt(summary.total_actual)}원</p>
            </div>
            <div className={`rounded-lg border p-4 ${variance > 0 ? "bg-red-50 border-red-200" : variance < 0 ? "bg-green-50 border-green-200" : "bg-slate-50 border-slate-200"}`}>
              <p className="text-xs text-slate-500 mb-1">
                {variance > 0 ? "초과 지출" : variance < 0 ? "절감" : "차이 없음"}
              </p>
              <p className={`text-xl font-bold ${variance > 0 ? "text-red-600" : variance < 0 ? "text-green-600" : "text-slate-500"}`}>
                {variance > 0 ? "+" : ""}{fmt(variance)}원
              </p>
            </div>
          </div>

          {/* 카테고리별 소계 */}
          {summary.category_totals.length > 0 && (
            <div className="flex gap-3 mb-5">
              {summary.category_totals.map((ct) => (
                <div key={ct.category} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm ${CATEGORY_COLORS[ct.category] || "bg-slate-50 text-slate-700"}`}>
                  <span className="font-semibold">{CATEGORY_LABELS[ct.category] || ct.category}</span>
                  <span>설정 {fmt(ct.total_default)}원</span>
                  <span>실제 {fmt(ct.total_actual)}원</span>
                  {ct.variance !== 0 && (
                    <span className={ct.variance > 0 ? "text-red-600" : "text-green-600"}>
                      ({ct.variance > 0 ? "+" : ""}{fmt(ct.variance)})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 카테고리별 테이블 */}
          {["facility", "operation"].map((cat) => {
            const catItems = grouped[cat] || [];
            if (catItems.length === 0) return null;
            return (
              <div key={cat} className="mb-5">
                <div className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold mb-2 ${CATEGORY_COLORS[cat]}`}>
                  {CATEGORY_LABELS[cat]}
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                        <th className="text-left px-4 py-2.5">항목명</th>
                        <th className="text-left px-4 py-2.5">업체명</th>
                        <th className="text-center px-4 py-2.5">이체일</th>
                        <th className="text-right px-4 py-2.5">설정금액</th>
                        <th className="text-right px-4 py-2.5">실제금액</th>
                        <th className="text-center px-4 py-2.5">납부일</th>
                        <th className="text-left px-4 py-2.5">메모</th>
                        <th className="text-center px-4 py-2.5 w-16">저장</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catItems.map((record) => {
                        const isOver = record.actual_amount > record.default_amount && record.default_amount > 0;
                        return (
                          <tr
                            key={record.id}
                            className={`border-b border-slate-100 cursor-pointer ${editingId === record.id ? "bg-blue-50/40" : "hover:bg-slate-50/50"}`}
                            onClick={() => { if (editingId !== record.id) startEdit(record); }}
                          >
                            <td className="px-4 py-2.5 font-medium text-slate-800">{record.item_name}</td>
                            <td className="px-4 py-2.5 text-slate-500 text-xs">{record.vendor_name || <span className="text-slate-300">-</span>}</td>
                            <td className="px-4 py-2.5 text-center text-slate-500 text-xs">
                              {record.payment_day ? `${record.payment_day}일` : <span className="text-slate-300">-</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right text-slate-600">
                              {record.default_amount > 0 ? fmt(record.default_amount) : <span className="text-slate-300">-</span>}
                            </td>

                            {editingId === record.id ? (
                              // 편집 모드
                              <>
                                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="number" min="0"
                                    value={editForm.actual_amount}
                                    onChange={(e) => setEditForm(p => ({...p, actual_amount: e.target.value}))}
                                    className="w-full h-7 px-2 border border-blue-300 rounded text-sm text-right focus:outline-none"
                                    autoFocus
                                  />
                                </td>
                                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="date"
                                    value={editForm.payment_date}
                                    onChange={(e) => setEditForm(p => ({...p, payment_date: e.target.value}))}
                                    className="h-7 px-2 border border-blue-300 rounded text-xs focus:outline-none w-full"
                                  />
                                </td>
                                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    value={editForm.memo}
                                    onChange={(e) => setEditForm(p => ({...p, memo: e.target.value}))}
                                    placeholder="메모"
                                    className="w-full h-7 px-2 border border-blue-300 rounded text-sm focus:outline-none"
                                  />
                                </td>
                                <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex justify-center gap-1">
                                    <button onClick={() => saveEdit(record)} className="w-6 h-6 flex items-center justify-center rounded bg-blue-100 text-blue-600 hover:bg-blue-200" title="저장">
                                      <Check size={12} />
                                    </button>
                                    <button onClick={() => setEditingId(null)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400" title="취소">
                                      <X size={12} />
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              // 표시 모드
                              <>
                                <td className={`px-4 py-2.5 text-right font-medium ${isOver ? "text-red-600" : "text-slate-800"}`}>
                                  {record.actual_amount > 0 ? fmt(record.actual_amount) : <span className="text-slate-300">미입력</span>}
                                </td>
                                <td className="px-4 py-2.5 text-center text-xs text-slate-500">
                                  {record.payment_date || <span className="text-slate-300">-</span>}
                                </td>
                                <td className="px-4 py-2.5 text-xs text-slate-500">
                                  {record.memo || <span className="text-slate-300">-</span>}
                                </td>
                                <td className="px-4 py-2.5 text-center text-xs text-slate-300">클릭</td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default FixedCostMonthly;
