// ============================================================
// AiInsight.jsx — AI 경영 인사이트 컴포넌트
// Ollama 기반 자연어 분석 리포트 및 이상 감지 화면입니다.
// ============================================================

import { useState } from "react";
import { Sparkles, AlertCircle, Lightbulb, RefreshCw } from "lucide-react";
import { generateAiInsight } from "../../../api/salesAnalysisApi";

// AI 인사이트 컴포넌트
const AiInsight = ({ year, month }) => {
  // 인사이트 데이터
  const [insight, setInsight] = useState(null);
  // 생성 중 상태
  const [loading, setLoading] = useState(false);
  // 오류 메시지
  const [error, setError] = useState(null);

  // AI 인사이트 생성 요청
  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateAiInsight(year, month);
      setInsight(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Sparkles size={18} className="text-purple-500" />
          AI 경영 인사이트
        </h3>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-white bg-purple-500 rounded-md hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          {loading ? "분석 중..." : "인사이트 생성"}
        </button>
      </div>

      {/* 로딩 상태 */}
      {loading && (
        <div className="py-10 text-center">
          <div className="inline-flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-purple-600 font-medium">AI가 데이터를 분석 중입니다...</p>
            <p className="text-xs text-slate-400">Ollama 서비스 상태에 따라 30초 내외 소요됩니다.</p>
          </div>
        </div>
      )}

      {/* 오류 메시지 */}
      {error && !loading && (
        <div className="py-6 text-center">
          <AlertCircle size={32} className="mx-auto text-red-300 mb-2" />
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* 인사이트 결과 */}
      {insight && !loading && (
        <div className="space-y-4">
          {/* 인사이트 본문 */}
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {insight.insight}
            </p>
            <p className="text-xs text-purple-400 mt-3">생성 시각: {insight.generated_at}</p>
          </div>

          {/* 이상 감지 */}
          {insight.anomalies && insight.anomalies.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1 mb-2">
                <AlertCircle size={14} className="text-yellow-500" />
                이상 감지
              </h4>
              <ul className="space-y-1.5">
                {insight.anomalies.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 추천 액션 */}
          {insight.recommendations && insight.recommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1 mb-2">
                <Lightbulb size={14} className="text-blue-500" />
                추천 액션
              </h4>
              <ul className="space-y-1.5">
                {insight.recommendations.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 초기 상태 (생성 전) */}
      {!insight && !loading && !error && (
        <div className="py-10 text-center">
          <Sparkles size={40} className="mx-auto text-purple-200 mb-3" />
          <p className="text-sm text-slate-400">
            "인사이트 생성" 버튼을 클릭하면 AI가 이번 달 매출 데이터를 분석합니다.
          </p>
          <p className="text-xs text-slate-300 mt-1">
            Ollama 미실행 시 기본 텍스트 분석으로 자동 대체됩니다.
          </p>
        </div>
      )}
    </div>
  );
};

export default AiInsight;
