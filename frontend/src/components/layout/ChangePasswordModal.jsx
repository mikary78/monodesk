// ============================================================
// ChangePasswordModal.jsx — 비밀번호 변경 모달
// 모든 역할(admin/manager/staff)이 사용할 수 있습니다.
// ============================================================

import { useState } from "react";
import { Lock, Eye, EyeOff, X } from "lucide-react";
import { API_BASE } from "../../api/apiClient";

/**
 * 비밀번호 변경 모달.
 * @param {Function} onClose - 모달 닫기 콜백
 */
const ChangePasswordModal = ({ onClose }) => {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  /**
   * 비밀번호 변경 요청
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.current.trim()) { setError("현재 비밀번호를 입력해주세요."); return; }
    if (!form.next.trim()) { setError("새 비밀번호를 입력해주세요."); return; }
    if (form.next.length < 4) { setError("새 비밀번호는 4자 이상이어야 합니다."); return; }
    if (form.next !== form.confirm) { setError("새 비밀번호와 확인이 일치하지 않습니다."); return; }
    if (form.current === form.next) { setError("새 비밀번호가 현재 비밀번호와 동일합니다."); return; }

    setIsLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ current_password: form.current, new_password: form.next }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "비밀번호 변경에 실패했습니다.");

      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-slate-600" />
            <h3 className="font-semibold text-slate-800">비밀번호 변경</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {success ? (
          /* 성공 화면 */
          <div className="px-6 py-8 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Lock size={22} className="text-green-600" />
            </div>
            <p className="text-slate-800 font-semibold mb-1">비밀번호가 변경되었습니다.</p>
            <p className="text-slate-500 text-sm mb-6">다음 로그인부터 새 비밀번호를 사용하세요.</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
            >
              확인
            </button>
          </div>
        ) : (
          /* 입력 폼 */
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* 현재 비밀번호 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">현재 비밀번호</label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={form.current}
                  onChange={(e) => setForm({ ...form, current: e.target.value })}
                  placeholder="현재 비밀번호"
                  className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* 새 비밀번호 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">새 비밀번호</label>
              <div className="relative">
                <input
                  type={showNext ? "text" : "password"}
                  value={form.next}
                  onChange={(e) => setForm({ ...form, next: e.target.value })}
                  placeholder="4자 이상"
                  className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNext(!showNext)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNext ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* 새 비밀번호 확인 */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">새 비밀번호 확인</label>
              <input
                type="password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                placeholder="새 비밀번호 재입력"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 에러 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={isLoading}
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 py-2 text-sm font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? "변경 중..." : "변경"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChangePasswordModal;
