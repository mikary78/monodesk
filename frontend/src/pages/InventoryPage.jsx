// ============================================================
// pages/InventoryPage.jsx — 재고/발주 관리 페이지
// 재고 현황 요약 카드 + 3개 탭(재고 품목 / 발주서 / 조정 이력)으로 구성됩니다.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  Package, AlertTriangle, ShoppingCart, Truck,
  RotateCcw
} from "lucide-react";
import { fetchInventorySummary, seedInventoryCategories } from "../api/inventoryApi";
import InventoryItemTab from "../components/modules/inventory/InventoryItemTab";
import PurchaseOrderTab from "../components/modules/inventory/PurchaseOrderTab";
import AdjustmentHistoryTab from "../components/modules/inventory/AdjustmentHistoryTab";

// ─────────────────────────────────────────
// KPI 요약 카드 컴포넌트
// ─────────────────────────────────────────

const SummaryCard = ({ icon: Icon, title, value, valueClass, sub, subClass, color }) => (
  <div className="bg-white rounded-xl p-5 shadow-sm">
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm text-slate-500 font-medium">{title}</span>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
    </div>
    <p className={`text-3xl font-bold ${valueClass || "text-slate-900"}`}>{value}</p>
    {sub && (
      <p className={`text-xs mt-1.5 ${subClass || "text-slate-400"}`}>{sub}</p>
    )}
  </div>
);

// ─────────────────────────────────────────
// 재고 부족 알림 배너
// ─────────────────────────────────────────

const LowStockBanner = ({ items, onDismiss }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
      <AlertTriangle size={18} className="text-yellow-500 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-yellow-800 mb-1">
          재고 부족 알림 — {items.length}개 품목이 최소 임계값 이하입니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium"
            >
              {item.name}
              <span className="text-yellow-500">
                ({item.current_quantity}/{item.min_quantity} {item.unit})
              </span>
            </span>
          ))}
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="text-yellow-400 hover:text-yellow-600 text-lg font-bold shrink-0"
      >
        &times;
      </button>
    </div>
  );
};

// ─────────────────────────────────────────
// 탭 버튼 컴포넌트
// ─────────────────────────────────────────

const TAB_LIST = [
  { id: "items",   label: "재고 품목",   icon: Package },
  { id: "orders",  label: "발주서",      icon: Truck },
  { id: "history", label: "조정 이력",   icon: RotateCcw },
];

// ─────────────────────────────────────────
// 메인 페이지 컴포넌트
// ─────────────────────────────────────────

const InventoryPage = () => {
  // 현재 활성 탭
  const [activeTab, setActiveTab] = useState("items");

  // 재고 현황 요약 데이터
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // 재고 부족 배너 표시 여부
  const [showBanner, setShowBanner] = useState(true);

  // 요약 카드 데이터 로드
  const loadSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const data = await fetchInventorySummary();
      setSummary(data);
      setShowBanner(true); // 새 데이터 로드 시 배너 다시 표시
    } catch {
      // 요약 로드 실패 시 조용히 무시 (하위 탭은 독립 동작)
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  // 초기 분류 데이터 생성 (최초 1회)
  const handleSeedInit = async () => {
    try {
      await seedInventoryCategories();
      loadSummary();
    } catch {
      // 이미 존재하는 경우 무시
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">재고 / 발주 관리</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            식재료, 주류, 소모품 재고를 관리하고 발주서를 생성합니다.
          </p>
        </div>
        <button
          onClick={handleSeedInit}
          className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 rounded-md px-3 py-1.5"
        >
          기본 분류 초기화
        </button>
      </div>

      {/* KPI 요약 카드 4개 */}
      <div className="grid grid-cols-4 gap-4">
        {summaryLoading ? (
          // 스켈레톤 로딩
          [...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm h-28 animate-pulse bg-slate-100" />
          ))
        ) : (
          <>
            <SummaryCard
              icon={Package}
              title="전체 품목"
              value={`${summary?.total_items ?? 0}개`}
              color="bg-blue-500"
              sub="등록된 재고 품목 수"
            />
            <SummaryCard
              icon={AlertTriangle}
              title="재고 부족"
              value={`${summary?.low_stock_count ?? 0}개`}
              valueClass={(summary?.low_stock_count ?? 0) > 0 ? "text-yellow-600" : "text-slate-900"}
              color="bg-yellow-500"
              sub="최소 임계값 이하 품목"
              subClass={(summary?.low_stock_count ?? 0) > 0 ? "text-yellow-500" : "text-slate-400"}
            />
            <SummaryCard
              icon={ShoppingCart}
              title="품절"
              value={`${summary?.out_of_stock_count ?? 0}개`}
              valueClass={(summary?.out_of_stock_count ?? 0) > 0 ? "text-red-600" : "text-slate-900"}
              color="bg-red-500"
              sub="재고 수량 0인 품목"
              subClass={(summary?.out_of_stock_count ?? 0) > 0 ? "text-red-400" : "text-slate-400"}
            />
            <SummaryCard
              icon={Truck}
              title="발주 진행 중"
              value={`${summary?.pending_orders ?? 0}건`}
              valueClass={(summary?.pending_orders ?? 0) > 0 ? "text-blue-600" : "text-slate-900"}
              color="bg-indigo-500"
              sub="입고 대기 중인 발주서"
            />
          </>
        )}
      </div>

      {/* 재고 부족 알림 배너 */}
      {showBanner && summary?.low_stock_items?.length > 0 && (
        <LowStockBanner
          items={summary.low_stock_items}
          onDismiss={() => setShowBanner(false)}
        />
      )}

      {/* 탭 컨테이너 */}
      <div className="bg-white rounded-xl shadow-sm">
        {/* 탭 네비게이션 */}
        <div className="border-b border-slate-100 px-6 pt-4">
          <div className="flex gap-1">
            {TAB_LIST.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  activeTab === id
                    ? "border-blue-500 text-blue-600 bg-blue-50/50"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="p-6">
          {activeTab === "items" && (
            <InventoryItemTab onRefreshSummary={loadSummary} />
          )}
          {activeTab === "orders" && (
            <PurchaseOrderTab onRefreshSummary={loadSummary} />
          )}
          {activeTab === "history" && (
            <AdjustmentHistoryTab />
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryPage;
