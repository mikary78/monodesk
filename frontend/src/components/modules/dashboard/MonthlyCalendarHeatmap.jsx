// ============================================================
// MonthlyCalendarHeatmap.jsx — 월별 달력 히트맵 컴포넌트
// 해당 월의 일별 매출을 달력 형식으로 시각화합니다.
// 매출이 높을수록 진한 파란색 배경을 적용합니다.
// ============================================================

import { formatCurrencyShort } from "../../../api/dashboardApi";

/**
 * 매출 금액에 따른 배경색 Tailwind 클래스를 반환합니다.
 * 0: 흰색, 낮음~높음: bg-blue-50 ~ bg-blue-600
 *
 * @param {number} sales - 당일 매출
 * @param {number} maxSales - 해당 월 최고 매출
 * @returns {string} Tailwind 배경색 클래스
 */
const getSalesBgClass = (sales, maxSales) => {
  if (!sales || sales === 0 || !maxSales) return "bg-white";
  const ratio = sales / maxSales;
  if (ratio >= 0.85) return "bg-blue-600 text-white";
  if (ratio >= 0.65) return "bg-blue-400 text-white";
  if (ratio >= 0.45) return "bg-blue-300 text-slate-800";
  if (ratio >= 0.25) return "bg-blue-200 text-slate-800";
  return "bg-blue-100 text-slate-700";
};

/**
 * 월별 달력 히트맵 컴포넌트.
 * 일~토 7열 달력에 일별 매출과 고객수를 표시합니다.
 *
 * @param {number} year - 조회 연도
 * @param {number} month - 조회 월
 * @param {Array} dailyTrend - 일별 트렌드 데이터 배열 [{date, sales, customer_count}]
 * @param {boolean} loading - 로딩 상태
 */
const MonthlyCalendarHeatmap = ({ year, month, dailyTrend = [], loading }) => {
  // 요일 헤더 (일~토)
  const DAY_HEADERS = ["일", "월", "화", "수", "목", "금", "토"];

  // 해당 월 1일의 요일 계산 (0=일, 6=토)
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

  // 해당 월 마지막 일 계산
  const daysInMonth = new Date(year, month, 0).getDate();

  // 일별 데이터를 날짜 키로 변환 (빠른 조회)
  const salesMap = {};
  let maxSales = 0;
  dailyTrend.forEach((item) => {
    salesMap[item.date] = item;
    if (item.sales > maxSales) maxSales = item.sales;
  });

  // 달력 셀 배열 생성 (앞쪽 빈 셀 포함)
  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(null); // 빈 셀 (해당 월 시작 전)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ day, dateStr });
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-14 bg-slate-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_HEADERS.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-slate-400 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* 달력 셀 */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => {
          if (!cell) {
            // 빈 셀 (이전 달)
            return <div key={`empty-${idx}`} className="h-14 rounded" />;
          }

          const item = salesMap[cell.dateStr];
          const sales = item?.sales || 0;
          const count = item?.customer_count || 0;
          const bgClass = getSalesBgClass(sales, maxSales);

          return (
            <div
              key={cell.dateStr}
              className={`h-14 rounded p-1 flex flex-col justify-between border border-slate-100 ${bgClass}`}
              title={`${cell.dateStr}: ${formatCurrencyShort(sales)} / ${count}명`}
            >
              {/* 날짜 */}
              <span className="text-xs font-medium leading-none">{cell.day}</span>

              {/* 매출/고객수 */}
              {sales > 0 ? (
                <div className="text-right">
                  <p className="text-xs font-semibold leading-none">
                    {formatCurrencyShort(sales)}
                  </p>
                  {count > 0 && (
                    <p className="text-xs leading-none opacity-75">{count}명</p>
                  )}
                </div>
              ) : (
                <span className="text-xs text-slate-300 self-end">-</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 히트맵 범례 */}
      <div className="flex items-center gap-1 mt-2 justify-end">
        <span className="text-xs text-slate-400">낮음</span>
        {["bg-blue-100", "bg-blue-200", "bg-blue-300", "bg-blue-400", "bg-blue-600"].map((cls) => (
          <div key={cls} className={`w-4 h-4 rounded ${cls}`} />
        ))}
        <span className="text-xs text-slate-400">높음</span>
      </div>
    </div>
  );
};

export default MonthlyCalendarHeatmap;
