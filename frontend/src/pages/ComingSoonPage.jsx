// ============================================================
// ComingSoonPage.jsx — 미구현 모듈 안내 페이지
// 아직 개발되지 않은 모듈 접근 시 표시됩니다.
// ============================================================

import { useLocation } from "react-router-dom";
import { Clock } from "lucide-react";

// 경로별 모듈명 매핑
const MODULE_NAMES = {
  "/sales":      "매출 분석",
  "/inventory":  "재고/발주 관리",
  "/menu":       "메뉴 관리",
  "/employee":   "직원 관리",
  "/corporate":  "법인 관리",
  "/operations": "운영 관리",
  "/settings":   "설정",
};

const ComingSoonPage = () => {
  const { pathname } = useLocation();
  const moduleName = MODULE_NAMES[pathname] || "해당 기능";

  return (
    <div className="p-8 bg-slate-50 min-h-full flex items-center justify-center">
      <div className="text-center">
        <Clock size={48} className="text-slate-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{moduleName}</h1>
        <p className="text-slate-500 text-sm">개발 예정인 기능입니다.</p>
        <p className="text-slate-400 text-xs mt-1">
          DEVPLAN.md의 개발 순서에 따라 순차적으로 구현됩니다.
        </p>
      </div>
    </div>
  );
};

export default ComingSoonPage;
