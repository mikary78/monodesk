// ============================================================
// MonthlyReport.jsx — 월별 리포트 컴포넌트
// 세무사 제출용 월별 손익 요약 리포트를 표시하고 Excel 출력을 지원합니다.
// ============================================================

import { useState, useEffect } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { fetchProfitLoss, fetchExpenses, formatCurrency } from "../../../api/accountingApi";

/**
 * 월별 세무 리포트 컴포넌트.
 * 세무사 제출용 손익 요약과 지출 내역을 표시합니다.
 * @param {number} year - 조회 연도
 * @param {number} month - 조회 월
 */
const MonthlyReport = ({ year, month }) => {
  // 손익 요약 데이터
  const [profitLoss, setProfitLoss] = useState(null);
  // 전체 지출 목록
  const [expenses, setExpenses] = useState([]);
  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false);

  // 연월 변경 시 데이터 불러오기
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        // 손익 요약과 지출 목록을 동시에 불러오기
        const [plData, expData] = await Promise.all([
          fetchProfitLoss(year, month),
          fetchExpenses(year, month, { limit: 200 }),
        ]);
        setProfitLoss(plData);
        setExpenses(expData.items || []);
      } catch (err) {
        console.error("리포트 데이터 불러오기 실패:", err.message);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [year, month]);

  /**
   * Excel 파일로 리포트 내보내기.
   * 실제 Excel 출력은 추후 xlsx 라이브러리 연동 예정.
   * 현재는 CSV 형식으로 다운로드합니다.
   */
  const handleExportCsv = () => {
    if (!expenses.length) {
      alert("내보낼 데이터가 없습니다.");
      return;
    }

    // CSV 헤더
    const headers = ["날짜", "분류", "거래처", "내용", "결제수단", "공급가액", "부가세", "합계"];
    // CSV 데이터 행
    const rows = expenses.map((e) => [
      e.expense_date,
      e.category?.name || "",
      e.vendor || "",
      e.description,
      e.payment_method,
      e.amount,
      e.vat || 0,
      e.total_amount,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    // 파일 다운로드 트리거
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `여남동_지출내역_${year}년${month}월.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="bg-white rounded-lg shadow p-6 h-48 animate-pulse bg-slate-100" />;
  }

  if (!profitLoss) return null;

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 리포트 헤더 */}
      <div className="flex items-center justify-between p-6 border-b border-slate-100">
        <div>
          <h3 className="text-base font-semibold text-slate-900">월별 손익 리포트</h3>
          <p className="text-sm text-slate-400 mt-0.5">
            {year}년 {month}월 — 세무사 제출용
          </p>
        </div>
        {/* Excel 내보내기 버튼 */}
        <button
          onClick={handleExportCsv}
          className="h-9 px-4 border border-slate-200 rounded-md text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
        >
          <FileSpreadsheet size={14} className="text-green-500" />
          CSV 내보내기
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* 손익 요약 테이블 */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 mb-3">손익 요약</h4>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {/* 매출 합계 */}
              <tr className="font-semibold bg-blue-50">
                <td className="py-2 px-3 text-blue-700">총 매출</td>
                <td className="py-2 px-3 text-right text-blue-700">
                  {formatCurrency(profitLoss.total_sales)}
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 pl-6 text-slate-500">└ 카드</td>
                <td className="py-2 px-3 text-right text-slate-600">
                  {formatCurrency(profitLoss.card_sales)}
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 pl-6 text-slate-500">└ 현금</td>
                <td className="py-2 px-3 text-right text-slate-600">
                  {formatCurrency(profitLoss.cash_sales)}
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 pl-6 text-slate-500">└ 배달앱</td>
                <td className="py-2 px-3 text-right text-slate-600">
                  {formatCurrency(profitLoss.delivery_sales)}
                </td>
              </tr>

              {/* 지출 합계 */}
              <tr className="font-semibold bg-red-50">
                <td className="py-2 px-3 text-red-700">총 지출</td>
                <td className="py-2 px-3 text-right text-red-700">
                  {formatCurrency(profitLoss.total_expense)}
                </td>
              </tr>
              {/* 카테고리별 지출 */}
              {profitLoss.expense_by_category
                .filter((cat) => cat.total > 0)
                .map((cat) => (
                  <tr key={cat.category_name}>
                    <td className="py-2 px-3 pl-6 text-slate-500">└ {cat.category_name}</td>
                    <td className="py-2 px-3 text-right text-slate-600">
                      {formatCurrency(cat.total)}
                    </td>
                  </tr>
                ))}

              {/* 순이익 */}
              <tr className={`font-bold text-base ${profitLoss.gross_profit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                <td className={`py-3 px-3 ${profitLoss.gross_profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                  순이익
                </td>
                <td className={`py-3 px-3 text-right ${profitLoss.gross_profit >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {formatCurrency(profitLoss.gross_profit)}
                  <span className="text-sm font-normal ml-2">
                    (이익률 {profitLoss.profit_margin}%)
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 지출 상세 내역 (최근 10건 미리보기) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-slate-700">
              지출 상세 (최근 {Math.min(expenses.length, 10)}건)
            </h4>
            <span className="text-xs text-slate-400">전체 {expenses.length}건</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                <th className="px-3 py-2 text-left">날짜</th>
                <th className="px-3 py-2 text-left">분류</th>
                <th className="px-3 py-2 text-left">내용</th>
                <th className="px-3 py-2 text-right">금액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.slice(0, 10).map((expense) => (
                <tr key={expense.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-500">{expense.expense_date}</td>
                  <td className="px-3 py-2 text-slate-600">{expense.category?.name || "-"}</td>
                  <td className="px-3 py-2 text-slate-900">{expense.description}</td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">
                    {formatCurrency(expense.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {expenses.length > 10 && (
            <p className="text-xs text-slate-400 text-center mt-2">
              전체 내역은 CSV 내보내기로 확인하세요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonthlyReport;
