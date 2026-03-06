// vite.config.js — Vite 빌드 설정
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // 백엔드 API 프록시 설정 (CORS 없이 API 호출)
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
