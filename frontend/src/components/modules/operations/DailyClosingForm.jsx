// ============================================================
// DailyClosingForm.jsx — 일일 현금 시재 관리 컴포넌트
// 권종별 수량 입력 → 합계/잔액 자동계산 → 저장
// ============================================================

import { useState, useEffect } from "react";
import { Save, RefreshCw } from "lucide-react";
import { getClosingByDate, saveClosing } from "../../../api/operationsApi";
import { useToast } from "../../../contexts/ToastContext";

// 권종 목록 정의 (이름, 필드명, 단위금액)
const DENOMINATIONS = [
  { label: "십만원권", field: "bill_100000", unit: 100000 },
  { label: "오만원권", field: "bill_50000",  unit: 50000  },
  { label: "만원권",   field: "bill_10000",  unit: 10000  },
  { label: "오천원권", field: "bill_5000",   unit: 5000   },
  { label: "천원권",   field: "bill_1000",   unit: 1000   },
  { label: "오백원",   field: "coin_500",    unit: 500    },
  { label: "백원",     field: "coin_100",    unit: 100    },
];

const EMPTY_FORM = {
  bill_100000: 0,
  bill_50000:  0,
  bill_10000:  0,
  bill_5000:   0,
  bill_1000:   0,
  coin_500:    0,
  coin_100:    0,
  daily_deposit: 0,
  daily_expense: 0,
  memo: "",
};

// 통화 포맷 유틸
const fmt = (v) => (v ?? 0).toLocaleString("ko-KR");

const DailyClosingForm = () => {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [form, setForm] = useState(EMPTY_FORM);
  const [prevDayCash, setPrevDayCash] = useState(0);
  const [savedId, setSavedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // 날짜 변경 시 해당 날짜 시재 조회
  useEffect(() => {
    loadClosing(selectedDate);
  }, [selectedDate]);

  const loadClosing = async (date) => {
    setFetching(true);
    try {
      const data = await getClosingByDate(date);
      setPrevDayCash(data.prev_day_cash ?? 0);
      setSavedId(data.id > 0 ? data.id : null);
      setForm({
        bill_100000:   data.bill_100000   ?? 0,
        bill_50000:    data.bill_50000    ?? 0,
        bill_10000:    data.bill_10000    ?? 0,
        bill_5000:     data.bill_5000     ?? 0,
        bill_1000:     data.bill_1000     ?? 0,
        coin_500:      data.coin_500      ?? 0,
        coin_100:      data.coin_100      ?? 0,
        daily_deposit: data.daily_deposit ?? 0,
        daily_expense: data.daily_expense ?? 0,
        memo:          data.memo          ?? "",
      });
    } catch (err) {
      // 조회 실패 시 빈 폼으로 초기화
      setForm(EMPTY_FORM);
      setPrevDayCash(0);
      setSavedId(null);
    } finally {
      setFetching(false);
    }
  };

  // 권종 수량 변경 핸들러 (음수 방지)
  const handleDenomChange = (field, value) => {
    const num = Math.max(0, parseInt(value, 10) || 0);
    setForm((prev) => ({ ...prev, [field]: num }));
  };

  // 금액 필드 변경 핸들러
  const handleAmountChange = (field, value) => {
    const num = Math.max(0, parseInt(value.replace(/,/g, ""), 10) || 0);
    setForm((prev) => ({ ...prev, [field]: num }));
  };

  // 권종별 합계 계산
  const totalCash = DENOMINATIONS.reduce(
    (sum, d) => sum + (form[d.field] || 0) * d.unit,
    0
  );

  // 잔액 = 전일이월 + 당일입금 - 당일지출
  const balance = prevDayCash + form.daily_deposit - form.daily_expense;

  // 저장 핸들러
  const handleSave = async () => {
    setLoading(true);
    try {
      await saveClosing({
        closing_date: selectedDate,
        ...form,
      });
      toast.success("시재가 저장되었습니다.");
      // 저장 후 재조회하여 ID 갱신
      await loadClosing(selectedDate);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      {/* 날짜 선택 */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm font-medium text-slate-600">마감 날짜</label>
        <input
          type="date"
          value={selectedDate}
          max={today}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
        />
        {fetching && (
          <RefreshCw size={14} className="text-slate-400 animate-spin" />
        )}
        {savedId && (
          <span className="text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
            저장된 기록 있음
          </span>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {/* 권종별 입력 그리드 */}
        <div className="p-5 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">권종별 수량</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs font-medium text-slate-400 px-1 mb-1">
              <span>권종</span>
              <span className="text-center">수량</span>
              <span className="text-right">금액</span>
            </div>
            {DENOMINATIONS.map(({ label, field, unit }) => (
              <div key={field} className="grid grid-cols-3 gap-2 items-center">
                {/* 권종명 */}
                <span className="text-sm text-slate-700">{label}</span>
                {/* 수량 입력 */}
                <input
                  type="number"
                  min="0"
                  value={form[field] || ""}
                  onChange={(e) => handleDenomChange(field, e.target.value)}
                  placeholder="0"
                  className="h-8 px-2 border border-slate-200 rounded text-sm text-center focus:outline-none focus:border-blue-400 w-full"
                />
                {/* 자동계산 금액 */}
                <span className="text-sm text-slate-600 text-right font-medium">
                  {fmt((form[field] || 0) * unit)}원
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 합계 표시 */}
        <div className="px-5 py-3 bg-blue-50 border-b border-slate-200 flex justify-between items-center">
          <span className="text-sm font-semibold text-blue-700">현금 합계</span>
          <span className="text-lg font-bold text-blue-700">{fmt(totalCash)}원</span>
        </div>

        {/* 이월/입금/지출/잔액 섹션 */}
        <div className="p-5 space-y-3">
          {/* 전일 이월 (읽기 전용) */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-slate-600">
              전일 이월
              <span className="ml-1 text-xs text-slate-400">(자동 참조)</span>
            </label>
            <span className="text-sm font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded px-3 py-1.5 min-w-[140px] text-right">
              {fmt(prevDayCash)}원
            </span>
          </div>

          {/* 당일 입금 */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-slate-600">당일 입금</label>
            <input
              type="number"
              min="0"
              value={form.daily_deposit || ""}
              onChange={(e) => handleAmountChange("daily_deposit", e.target.value)}
              placeholder="0"
              className="h-9 px-3 border border-slate-200 rounded text-sm text-right focus:outline-none focus:border-blue-400 min-w-[140px]"
            />
          </div>

          {/* 당일 시재지출 */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-slate-600">당일 시재지출</label>
            <input
              type="number"
              min="0"
              value={form.daily_expense || ""}
              onChange={(e) => handleAmountChange("daily_expense", e.target.value)}
              placeholder="0"
              className="h-9 px-3 border border-slate-200 rounded text-sm text-right focus:outline-none focus:border-blue-400 min-w-[140px]"
            />
          </div>

          {/* 잔액 (자동계산) */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <label className="text-sm font-semibold text-slate-700">
              잔액
              <span className="ml-1 text-xs text-slate-400">(이월+입금-지출)</span>
            </label>
            <span className={`text-base font-bold px-3 py-1.5 rounded min-w-[140px] text-right ${balance >= 0 ? "text-green-700 bg-green-50" : "text-red-600 bg-red-50"}`}>
              {fmt(balance)}원
            </span>
          </div>
        </div>

        {/* 메모 */}
        <div className="px-5 pb-3">
          <label className="block text-xs font-medium text-slate-500 mb-1">메모</label>
          <textarea
            value={form.memo}
            onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))}
            placeholder="특이사항 메모 (선택)"
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded text-sm resize-none focus:outline-none focus:border-blue-400"
          />
        </div>

        {/* 저장 버튼 */}
        <div className="px-5 pb-5">
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full h-10 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-md flex items-center justify-center gap-2"
          >
            <Save size={15} />
            {loading ? "저장 중..." : savedId ? "시재 수정" : "시재 저장"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyClosingForm;
