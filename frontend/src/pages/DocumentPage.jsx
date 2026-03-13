// ============================================================
// DocumentPage.jsx — 문서 관리 페이지
// 지결서 / 회의록 탭으로 구성된 법인 내부 문서 관리 화면입니다.
// ============================================================

import { useState } from "react";
import { FileText } from "lucide-react";
import DocumentListTab from "../components/modules/document/DocumentListTab";

// 탭 정의
const TABS = [
  { key: "지결서", label: "지결서",  desc: "지출결의서" },
  { key: "회의록", label: "회의록",  desc: "운영·동업자 회의 기록" },
];

const DocumentPage = () => {
  // 현재 활성 탭 상태
  const [activeTab, setActiveTab] = useState("지결서");

  return (
    <div className="p-8 bg-slate-50 min-h-full">

      {/* 페이지 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <FileText size={24} className="text-blue-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">문서 관리</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            지결서(지출결의서)·회의록 등 법인 내부 문서를 관리합니다.
          </p>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-xs ${activeTab === tab.key ? "text-blue-400" : "text-slate-400"}`}>
                {tab.desc}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* 탭 콘텐츠 — 활성 탭에 해당하는 문서 유형의 목록을 표시 */}
      <DocumentListTab key={activeTab} docType={activeTab} />
    </div>
  );
};

export default DocumentPage;
