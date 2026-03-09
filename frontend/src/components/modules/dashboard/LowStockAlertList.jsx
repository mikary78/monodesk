// ============================================================
// LowStockAlertList.jsx — 재고 부족 경고 목록 컴포넌트
// 재고가 최소 기준 이하인 품목을 경고 형식으로 표시합니다.
// ============================================================

import { Package, AlertTriangle } from "lucide-react";

/**
 * 재고 부족 경고 목록 컴포넌트.
 * @param {Array} alerts - 재고 부족 품목 배열
 * @param {boolean} loading - 로딩 상태
 */
const LowStockAlertList = ({ alerts = [], loading = false }) => {
  // 로딩 중 스켈레톤 표시
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="h-5 w-32 bg-slate-200 rounded animate-pulse mb-4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-slate-100 rounded animate-pulse mb-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle size={16} className="text-amber-500" />
        <h3 className="text-base font-semibold text-slate-800">재고 부족 경고</h3>
        {alerts.length > 0 && (
          <span className="ml-auto text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            {alerts.length}건
          </span>
        )}
      </div>

      {/* 알림 목록 */}
      {alerts.length === 0 ? (
        // 재고 부족 품목 없음
        <div className="flex flex-col items-center justify-center py-8 text-slate-400">
          <Package size={32} className="mb-2 text-slate-300" />
          <p className="text-sm">재고 부족 품목이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.item_id}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-amber-50 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* 상태 배지 */}
                <span
                  className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                    alert.status === "품절"
                      ? "bg-red-100 text-red-600"
                      : "bg-amber-100 text-amber-600"
                  }`}
                >
                  {alert.status}
                </span>

                {/* 품목명 */}
                <span className="text-sm font-medium text-slate-800 truncate">
                  {alert.item_name}
                </span>
              </div>

              {/* 재고 현황 */}
              <div className="shrink-0 text-right ml-2">
                <span className="text-sm font-semibold text-red-600">
                  {alert.current_quantity}
                </span>
                <span className="text-xs text-slate-400">
                  {" "}
                  / {alert.minimum_quantity} {alert.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LowStockAlertList;
