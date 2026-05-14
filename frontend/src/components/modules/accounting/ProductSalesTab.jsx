// ============================================================
// ProductSalesTab.jsx — 상품별 월간 판매 현황 탭 컴포넌트
// POS 엑셀(상품별매출_YYYYMM.xlsx)에서 가져온 상품 판매 데이터를
// 순위 테이블, 요약 카드, 카테고리별 비율 차트로 표시합니다.
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { Upload, Trash2, Package, ShoppingCart, Trophy } from "lucide-react";
import { fetchProductSales, uploadProductSales, deleteProductSales } from "../../../api/salesAnalysisApi";

// ─────────────────────────────────────────
// 상수 정의
// ─────────────────────────────────────────

// 순위 배지 색상 정의 (1위: 금색, 2위: 은색, 3위: 동색)
const RANK_BADGE = {
  1: { bg: "bg-yellow-100 text-yellow-700 border-yellow-300", label: "1위" },
  2: { bg: "bg-slate-100 text-slate-600 border-slate-300",   label: "2위" },
  3: { bg: "bg-orange-100 text-orange-600 border-orange-300", label: "3위" },
};

// 카테고리별 색상 팔레트 (인덱스 순환)
const CATEGORY_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-orange-500",
  "bg-pink-500",  "bg-cyan-500",   "bg-yellow-500", "bg-red-500",
  "bg-indigo-500","bg-teal-500",
];

// ─────────────────────────────────────────
// 유틸리티 함수
// ─────────────────────────────────────────

/**
 * 숫자를 한국식 천 단위 구분 포맷으로 변환합니다.
 * 예: 1234567 → "1,234,567"
 */
function formatNumber(num) {
  if (num === null || num === undefined) return "0";
  return Number(num).toLocaleString("ko-KR");
}

/**
 * 퍼센트 소수점 1자리 포맷
 * 예: 12.5678 → "12.6%"
 */
function formatPct(val) {
  if (!val && val !== 0) return "-";
  return `${Number(val).toFixed(1)}%`;
}

// ─────────────────────────────────────────
// 요약 카드 서브 컴포넌트
// ─────────────────────────────────────────

/**
 * 상단 KPI 요약 카드 1개를 렌더링합니다.
 * @param {object} props - icon, title, value, subText, iconColor
 */
function SummaryCard({ icon: Icon, title, value, subText, iconColor = "text-blue-500" }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 flex items-start gap-3">
      {/* 아이콘 영역 */}
      <div className={`mt-0.5 ${iconColor}`}>
        <Icon size={20} />
      </div>
      {/* 텍스트 영역 */}
      <div className="min-w-0">
        <p className="text-xs text-slate-500 mb-1">{title}</p>
        <p className="text-xl font-bold text-slate-900 truncate">{value}</p>
        {subText && <p className="text-xs text-slate-400 mt-0.5 truncate">{subText}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────

/**
 * 상품별 월간 판매 현황 탭 컴포넌트.
 * 부모(AccountingPage)에서 year, month, userRole을 props로 받습니다.
 *
 * @param {number} year - 조회 연도
 * @param {number} month - 조회 월
 * @param {string} userRole - 현재 로그인 사용자 역할 (admin/manager/staff)
 */
const ProductSalesTab = ({ year, month, userRole = "staff" }) => {
  // ── 상태 관리 ────────────────────────────────────────────
  // 서버에서 가져온 판매 데이터 전체
  const [data, setData] = useState(null);
  // 선택된 카테고리 필터 ("" = 전체)
  const [selectedCategory, setSelectedCategory] = useState("");
  // 로딩 상태
  const [loading, setLoading] = useState(false);
  // 업로드 진행 상태
  const [uploading, setUploading] = useState(false);
  // 에러 메시지
  const [error, setError] = useState("");
  // 성공 메시지 (업로드 완료 등)
  const [successMsg, setSuccessMsg] = useState("");

  // 파일 인풋 DOM 참조 — 버튼 클릭 시 파일 선택 다이얼로그 열기
  const fileInputRef = useRef(null);

  // 업로드/삭제 권한 — admin 또는 manager만 가능
  const canEdit = userRole === "admin" || userRole === "manager";

  // ── 데이터 조회 ──────────────────────────────────────────

  /**
   * 서버에서 상품 판매 데이터를 가져옵니다.
   * year, month, selectedCategory가 바뀔 때마다 자동 재조회됩니다.
   */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // 카테고리 필터 적용 (빈 문자열이면 null로 전달 → 전체 조회)
      const result = await fetchProductSales(
        year,
        month,
        selectedCategory || null
      );
      setData(result);
    } catch (err) {
      setError(err.message || "데이터를 불러오는 중 오류가 발생했습니다.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, month, selectedCategory]);

  // year, month, selectedCategory 변경 시 자동 재조회
  useEffect(() => {
    loadData();
  }, [loadData]);

  // year/month가 바뀌면 카테고리 필터 초기화
  useEffect(() => {
    setSelectedCategory("");
  }, [year, month]);

  // ── 파일 업로드 처리 ────────────────────────────────────

  /**
   * 파일 인풋 change 이벤트 핸들러.
   * 선택한 xlsx 파일을 서버에 업로드하고 결과를 표시합니다.
   */
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 선택 후 인풋 초기화 (같은 파일 재선택 허용)
    e.target.value = "";

    setUploading(true);
    setError("");
    setSuccessMsg("");

    try {
      const result = await uploadProductSales(file);
      // 업로드 성공 — 성공 메시지 표시 후 데이터 재조회
      setSuccessMsg(result.message || "업로드가 완료되었습니다.");
      await loadData();
    } catch (err) {
      setError(err.message || "파일 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  /**
   * 해당 연/월 데이터 전체 삭제.
   * 실수 방지를 위해 confirm 창으로 한 번 더 확인합니다.
   */
  const handleDelete = async () => {
    if (!window.confirm(`${year}년 ${month}월 상품별 판매 데이터를 모두 삭제하시겠습니까?`)) {
      return;
    }
    setError("");
    setSuccessMsg("");
    try {
      const result = await deleteProductSales(year, month);
      setSuccessMsg(result.message || "삭제되었습니다.");
      // 삭제 후 데이터 재조회 (빈 상태 표시)
      await loadData();
    } catch (err) {
      setError(err.message || "삭제 중 오류가 발생했습니다.");
    }
  };

  // ── 파생 데이터 계산 ────────────────────────────────────

  // 현재 표시 중인 상품 목록 (서버 정렬: 수량 내림차순)
  const items = data?.items || [];

  // 수량 기준 1위 상품명
  const topProduct = items[0]?.product_name || "-";

  // 카테고리별 수량 집계 (하단 비율 차트용)
  // { "메뉴": 350, "주류": 120, ... } 형태로 집계
  const categoryStats = items.reduce((acc, item) => {
    const cat = item.category || "미분류";
    acc[cat] = (acc[cat] || 0) + item.quantity;
    return acc;
  }, {});

  // 카테고리 수량 내림차순 정렬
  const sortedCategories = Object.entries(categoryStats).sort(
    ([, a], [, b]) => b - a
  );

  // 카테고리 전체 수량 합계 (비율 계산용)
  const catTotal = sortedCategories.reduce((sum, [, qty]) => sum + qty, 0);

  // ── 렌더링 ───────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* ─── 상단 컨트롤 바 ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 카테고리 필터 드롭다운 */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          disabled={loading}
        >
          <option value="">전체 분류</option>
          {/* 서버에서 받은 카테고리 목록 (카테고리 필터 미적용 상태 기준) */}
          {(data?.categories || []).map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* 우측 버튼 그룹 (admin/manager만 표시) */}
        {canEdit && (
          <div className="flex items-center gap-2 ml-auto">
            {/* 숨겨진 파일 인풋 — 업로드 버튼 클릭 시 트리거 */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
            {/* xlsx 업로드 버튼 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 h-9 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm font-medium rounded-md transition-colors"
              title="상품별매출_YYYYMM.xlsx 파일을 업로드합니다"
            >
              <Upload size={14} />
              {uploading ? "업로드 중..." : "엑셀 업로드"}
            </button>

            {/* 해당 월 데이터 삭제 버튼 */}
            <button
              onClick={handleDelete}
              disabled={uploading || !data?.total_products}
              className="flex items-center gap-2 h-9 px-3 border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed text-sm rounded-md transition-colors"
              title={`${year}년 ${month}월 데이터 전체 삭제`}
            >
              <Trash2 size={14} />
              삭제
            </button>
          </div>
        )}
      </div>

      {/* ─── 에러 / 성공 메시지 ─────────────────────────── */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
          {successMsg}
        </div>
      )}

      {/* ─── 로딩 스피너 ────────────────────────────────── */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ─── 데이터가 있을 때만 표시 ─────────────────────── */}
      {!loading && data && (
        <>
          {/* ─── 요약 카드 3개 ──────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              icon={Package}
              title="총 상품 수"
              value={`${formatNumber(data.total_products)}개`}
              subText={selectedCategory ? `"${selectedCategory}" 분류 기준` : "전체 분류 합계"}
              iconColor="text-blue-500"
            />
            <SummaryCard
              icon={ShoppingCart}
              title="총 판매 수량"
              value={`${formatNumber(data.total_quantity)}개`}
              subText={`${year}년 ${month}월 누적`}
              iconColor="text-emerald-500"
            />
            <SummaryCard
              icon={Trophy}
              title="수량 기준 1위"
              value={topProduct}
              subText={
                items[0]
                  ? `${formatNumber(items[0].quantity)}개 판매`
                  : undefined
              }
              iconColor="text-yellow-500"
            />
          </div>

          {/* ─── 판매 순위 테이블 ───────────────────────── */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700">판매 순위</h3>
            </div>

            {items.length === 0 ? (
              // 빈 상태 — 엑셀 업로드 안내
              <div className="py-16 text-center text-slate-400 text-sm">
                <Package size={32} className="mx-auto mb-3 opacity-30" />
                데이터 없음 — 엑셀 파일을 업로드해주세요
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs">
                      <th className="py-2.5 px-4 text-left font-medium w-20">순위</th>
                      <th className="py-2.5 px-4 text-left font-medium">상품명</th>
                      <th className="py-2.5 px-4 text-left font-medium w-28">분류</th>
                      <th className="py-2.5 px-4 text-right font-medium w-24">판매 수량</th>
                      <th className="py-2.5 px-4 text-left font-medium min-w-[160px]">수량 비율</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => {
                      const rank = idx + 1; // 1-based 순위
                      const badge = RANK_BADGE[rank]; // 1~3위만 배지, 나머지 undefined
                      // 인라인 바 차트 너비: quantity_ratio 퍼센트 값 사용
                      // 최대 100%로 클램핑
                      const barWidth = Math.min(item.quantity_ratio || 0, 100);

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          {/* 순위 배지 */}
                          <td className="py-2.5 px-4">
                            {badge ? (
                              <span
                                className={`inline-flex items-center justify-center w-12 text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.bg}`}
                              >
                                {badge.label}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs pl-1">{rank}위</span>
                            )}
                          </td>

                          {/* 상품명 */}
                          <td className="py-2.5 px-4">
                            <span className="font-medium text-slate-800">
                              {item.product_name}
                            </span>
                          </td>

                          {/* 분류 배지 */}
                          <td className="py-2.5 px-4">
                            {item.category ? (
                              <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {item.category}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">-</span>
                            )}
                          </td>

                          {/* 판매 수량 */}
                          <td className="py-2.5 px-4 text-right font-medium text-slate-700">
                            {formatNumber(item.quantity)}
                          </td>

                          {/* 인라인 바 차트 + 퍼센트 */}
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              {/* 바 차트 트랙 */}
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              {/* 퍼센트 텍스트 */}
                              <span className="text-xs text-slate-500 w-10 text-right flex-shrink-0">
                                {formatPct(item.quantity_ratio)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ─── 카테고리별 비율 차트 ───────────────────── */}
          {sortedCategories.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">카테고리별 판매 비율</h3>
              <div className="space-y-3">
                {sortedCategories.map(([cat, qty], idx) => {
                  // 전체 수량 대비 해당 카테고리 비율 계산
                  const pct = catTotal > 0 ? (qty / catTotal) * 100 : 0;
                  // 순환 색상 팔레트에서 색상 선택
                  const colorClass = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];

                  return (
                    <div key={cat}>
                      {/* 카테고리명 + 수량 + 비율 헤더 */}
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-slate-700 font-medium">{cat}</span>
                        <span className="text-xs text-slate-500">
                          {formatNumber(qty)}개 ({formatPct(pct)})
                        </span>
                      </div>
                      {/* 수평 바 */}
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colorClass} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── 데이터 없는 초기 상태 ──────────────────────── */}
      {!loading && !data && !error && (
        <div className="bg-white rounded-lg border border-slate-200 py-20 text-center text-slate-400">
          <Package size={40} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm">데이터 없음 — 엑셀 파일을 업로드해주세요</p>
          {canEdit && (
            <p className="text-xs mt-1 text-slate-300">
              상단 "엑셀 업로드" 버튼을 사용하세요
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductSalesTab;
