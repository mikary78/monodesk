// ============================================================
// KpiCard.jsx — 대시보드 KPI 카드 컴포넌트
// 단일 핵심 지표(금액, 증감률)를 카드 형식으로 표시합니다.
// ============================================================

/**
 * KPI 카드 컴포넌트.
 * 아이콘, 제목, 주요 수치, 증감률을 보여주는 대시보드 카드입니다.
 *
 * @param {React.ReactNode} icon - 카드 아이콘 (Lucide 컴포넌트)
 * @param {string} title - 카드 제목
 * @param {string} value - 표시할 주요 수치 (문자열)
 * @param {string|null} subtext - 보조 텍스트 (증감률, 비교값 등)
 * @param {string} subtextColor - 보조 텍스트 색상 Tailwind 클래스
 * @param {string} iconBg - 아이콘 배경색 Tailwind 클래스
 * @param {boolean} loading - 로딩 상태
 */
const KpiCard = ({
  icon,
  title,
  value,
  subtext = null,
  subtextColor = "text-slate-500",
  iconBg = "bg-blue-50",
  loading = false,
}) => {
  // 로딩 중일 때 스켈레톤 UI 표시
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="w-10 h-10 rounded-lg bg-slate-200" />
          <div className="h-4 w-20 bg-slate-200 rounded" />
        </div>
        <div className="h-8 w-32 bg-slate-200 rounded mb-2" />
        <div className="h-4 w-24 bg-slate-200 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* 카드 상단: 아이콘 + 제목 */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center`}>
          {icon}
        </div>
        <span className="text-sm font-medium text-slate-500">{title}</span>
      </div>

      {/* 주요 수치 (KPI 32px Bold) */}
      <div className="text-3xl font-bold text-slate-900 mb-1">{value}</div>

      {/* 보조 텍스트 (증감률 등) */}
      {subtext && (
        <div className={`text-sm font-medium ${subtextColor}`}>{subtext}</div>
      )}
    </div>
  );
};

export default KpiCard;
