// ============================================================
// DailyCompareBanner.jsx — 일별 전일/전주 비교 배너 컴포넌트
// 전일 대비, 전주 같은 요일 대비 매출 증감을 시각화합니다.
// ============================================================

import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { formatCurrencyShort } from "../../../api/dashboardApi";

/**
 * 증감 지표 배지 컴포넌트.
 * 양수/음수/0에 따라 색상과 아이콘이 자동 변경됩니다.
 *
 * @param {number} diff - 증감 수치 (금액 또는 %)
 * @param {boolean} isRate - true이면 % 표시, false이면 금액 표시
 * @param {string} label - 배지 좌측 레이블
 */
const DiffBadge = ({ diff, isRate = false, label }) => {
  // 증감 방향에 따른 색상/아이콘 결정
  const isPositive = diff > 0;
  const isZero = diff === 0;

  const colorClass = isZero
    ? "text-slate-500 bg-slate-50 border-slate-200"
    : isPositive
    ? "text-green-600 bg-green-50 border-green-200"
    : "text-red-500 bg-red-50 border-red-200";

  const Icon = isZero ? Minus : isPositive ? ArrowUp : ArrowDown;

  // 표시값 포맷
  const displayValue = isRate
    ? `${diff > 0 ? "+" : ""}${diff.toFixed(1)}%`
    : `${diff > 0 ? "+" : ""}${formatCurrencyShort(Math.abs(diff))}`;

  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${colorClass}`}>
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      <Icon size={16} />
      <span className="font-semibold text-sm">{displayValue}</span>
    </div>
  );
};

/**
 * 일별 비교 배너 컴포넌트.
 * 전일 대비 매출 증감과 전주 같은 요일 대비 증감률을 나란히 표시합니다.
 *
 * @param {object} data - 일별 KPI 데이터
 * @param {boolean} loading - 로딩 상태
 */
const DailyCompareBanner = ({ data, loading }) => {
  // 로딩 중 스켈레톤 표시
  if (loading) {
    return (
      <div className="flex gap-3 mb-6 animate-pulse">
        <div className="flex-1 h-12 bg-slate-200 rounded-lg" />
        <div className="flex-1 h-12 bg-slate-200 rounded-lg" />
      </div>
    );
  }

  if (!data) return null;

  // 전일 대비 금액 차이 계산
  const prevDayDiff = data.total_sales - data.prev_day_sales;

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {/* 전일 대비 */}
      <DiffBadge
        diff={prevDayDiff}
        isRate={false}
        label="전일 대비"
      />

      {/* 전주 같은 요일 대비 */}
      <DiffBadge
        diff={data.prev_week_same_day_diff}
        isRate={true}
        label="전주 동요일 대비"
      />

      {/* 전주 동요일 매출 참고값 */}
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-slate-200 bg-white">
        <span className="text-sm text-slate-400">전주 동요일</span>
        <span className="text-sm font-semibold text-slate-700">
          {formatCurrencyShort(data.prev_week_same_day_sales)}
        </span>
      </div>
    </div>
  );
};

export default DailyCompareBanner;
