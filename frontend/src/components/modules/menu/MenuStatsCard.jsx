// ============================================================
// MenuStatsCard.jsx — 메뉴 현황 KPI 카드 컴포넌트
// 전체 메뉴 수, 판매중/중지, 평균 원가율, 경고 메뉴를 표시합니다.
// ============================================================

import { useState, useEffect } from "react";
import { UtensilsCrossed, TrendingDown, AlertTriangle, Star } from "lucide-react";
import { fetchMenuStats, formatCurrency } from "../../../api/menuApi";

const MenuStatsCard = () => {
  // 통계 데이터 상태 관리
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 컴포넌트 마운트 시 통계 데이터 로드
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await fetchMenuStats();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 로딩 중 스켈레톤 UI
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-1/2 mb-3"></div>
            <div className="h-8 bg-slate-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-slate-200 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    );
  }

  // 에러 상태
  if (error || !stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
        통계 데이터를 불러오는 중 오류가 발생했습니다: {error}
      </div>
    );
  }

  // KPI 카드 데이터 정의
  const kpiCards = [
    {
      title: "전체 메뉴",
      value: `${stats.total_items}개`,
      sub: `판매중 ${stats.active_items}개 · 중지 ${stats.inactive_items}개`,
      icon: UtensilsCrossed,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-50",
    },
    {
      title: "평균 원가율",
      value: `${stats.avg_cost_ratio}%`,
      sub: "판매 중인 메뉴 기준",
      icon: TrendingDown,
      // 원가율 수준에 따라 색상 변경
      iconColor: stats.avg_cost_ratio <= 40 ? "text-green-500" : stats.avg_cost_ratio <= 60 ? "text-yellow-500" : "text-red-500",
      bgColor: stats.avg_cost_ratio <= 40 ? "bg-green-50" : stats.avg_cost_ratio <= 60 ? "bg-yellow-50" : "bg-red-50",
    },
    {
      title: "원가율 경고",
      value: `${stats.high_cost_ratio_items.length}개`,
      sub: "원가율 70% 초과 메뉴",
      icon: AlertTriangle,
      iconColor: stats.high_cost_ratio_items.length > 0 ? "text-red-500" : "text-slate-400",
      bgColor: stats.high_cost_ratio_items.length > 0 ? "bg-red-50" : "bg-slate-50",
    },
    {
      title: "대표 메뉴",
      value: `${stats.featured_items}개`,
      sub: "강조 표시 메뉴",
      icon: Star,
      iconColor: "text-yellow-500",
      bgColor: "bg-yellow-50",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {kpiCards.map(({ title, value, sub, icon: Icon, iconColor, bgColor }) => (
        <div key={title} className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">{title}</span>
            <div className={`w-9 h-9 rounded-lg ${bgColor} flex items-center justify-center`}>
              <Icon size={18} className={iconColor} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mb-1">{value}</div>
          <div className="text-xs text-slate-500">{sub}</div>
        </div>
      ))}
    </div>
  );
};

export default MenuStatsCard;
