// ============================================================
// pages/LoginPage.jsx — 로그인 페이지
// MonoDesk 인증 진입점. JWT 기반 로그인 폼을 제공합니다.
// 디자인 시스템: 중앙 카드, slate 계열 컬러, Tailwind CSS
// ============================================================

import { useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

/**
 * 로그인 페이지 컴포넌트.
 * 아이디/비밀번호 입력 후 JWT 토큰을 발급받아 인증 상태를 설정합니다.
 */
const LoginPage = () => {
  // 폼 입력 상태
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // 비밀번호 표시/숨기기 토글 상태
  const [showPassword, setShowPassword] = useState(false);

  // 로딩 및 에러 상태
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // AuthContext에서 로그인 함수 가져오기
  const { login } = useAuth();

  /**
   * 로그인 폼 제출 핸들러.
   * 유효성 검사 후 백엔드 API에 인증 요청을 보냅니다.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    // 입력값 유효성 검사
    if (!username.trim()) {
      setErrorMessage("아이디를 입력해주세요.");
      return;
    }
    if (!password.trim()) {
      setErrorMessage("비밀번호를 입력해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      // AuthContext의 login 함수 호출 (성공 시 자동 리다이렉트)
      await login(username.trim(), password);
    } catch (err) {
      setErrorMessage(err.message || "로그인에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // 전체 화면 중앙 정렬 배경
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      {/* 로그인 카드 */}
      <div className="w-full max-w-md">

        {/* 로고 및 타이틀 영역 */}
        <div className="text-center mb-8">
          {/* MonoDesk 로고 */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-2xl mb-4 shadow-lg">
            <span className="text-white font-bold text-2xl">M</span>
          </div>
          <h1 className="text-white font-bold text-3xl mb-1">MonoDesk</h1>
          <p className="text-slate-400 text-sm">여남동 통합 관리 시스템</p>
        </div>

        {/* 카드 본문 */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-slate-800 font-semibold text-xl mb-6 text-center">
            로그인
          </h2>

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* 아이디 입력 */}
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                아이디
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="아이디를 입력하세요"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm
                           text-slate-800 placeholder-slate-400
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-colors"
                autoComplete="username"
                disabled={isLoading}
              />
            </div>

            {/* 비밀번호 입력 (보기/숨기기 토글) */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                비밀번호
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full px-4 py-2.5 pr-11 border border-slate-300 rounded-lg text-sm
                             text-slate-800 placeholder-slate-400
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             transition-colors"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                {/* 비밀번호 표시/숨기기 버튼 */}
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2
                             text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* 에러 메시지 표시 */}
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-red-600 text-sm">{errorMessage}</p>
              </div>
            )}

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-500 hover:bg-blue-600 active:bg-blue-700
                         disabled:bg-blue-300 disabled:cursor-not-allowed
                         text-white font-semibold py-2.5 px-4 rounded-lg
                         flex items-center justify-center gap-2
                         transition-colors duration-200
                         mt-2"
            >
              {isLoading ? (
                <>
                  {/* 로딩 스피너 */}
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  로그인 중...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  로그인
                </>
              )}
            </button>
          </form>
        </div>

        {/* 하단 안내 */}
        <p className="text-center text-slate-500 text-xs mt-6">
          MonoBound 법인 내부 전용 시스템
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
