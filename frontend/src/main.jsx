// ============================================================
// main.jsx — React 앱 진입점
// BrowserRouter로 SPA 라우팅을 활성화합니다.
// ============================================================

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "pretendard/dist/web/static/pretendard.css"; // CDN 대신 로컬 패키지 사용
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
