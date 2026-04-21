// vite.config.js — Vite 빌드 설정
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  // envDir: Vite가 .env 파일을 찾을 디렉토리를 명시합니다.
  // "." 은 현재 vite.config.js가 있는 디렉토리(frontend/)를 기준으로 합니다.
  // 이를 명시하지 않으면 Render 빌드 환경에서 .env.production을 못 찾을 수 있습니다.
  envDir: ".",

  server: {
    port: 5173,
    // 로컬 개발 시 백엔드 API 프록시 설정 (CORS 없이 API 호출)
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  test: {
    // vitest 환경 설정
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test-setup.js",
  },
});
