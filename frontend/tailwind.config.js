// tailwind.config.js — Tailwind CSS 설정
// 디자인 시스템(design-system.md)의 색상 및 폰트를 반영합니다.
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      // 디자인 시스템 컬러 토큰
      colors: {
        brand: {
          blue: "#3B82F6",
          green: "#22C55E",
          yellow: "#F59E0B",
          red: "#EF4444",
          purple: "#8B5CF6",
        },
        sidebar: {
          bg: "#1E293B",
          text: "#94A3B8",
          active: "#FFFFFF",
        },
      },
      // 기본 폰트: Pretendard
      fontFamily: {
        sans: ["Pretendard", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
