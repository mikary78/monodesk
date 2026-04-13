// ============================================================
// components/modules/admin/UserManagement.jsx — 계정 관리 컴포넌트
// admin 전용: 사용자 계정 목록 조회, 생성, 수정, 비활성화
// ============================================================

import { useState, useEffect } from "react";
import { UserPlus, Edit2, UserX, Shield, Briefcase, User } from "lucide-react";
import { getUsers, createUser, updateUser, deleteUser } from "../../../api/authApi";
import { useToast } from "../../../contexts/ToastContext";

// 역할 배지 색상 및 레이블 매핑
const ROLE_CONFIG = {
  admin:   { label: "관리자",  bgColor: "bg-blue-100",  textColor: "text-blue-700",  icon: Shield },
  manager: { label: "매니저",  bgColor: "bg-green-100", textColor: "text-green-700", icon: Briefcase },
  staff:   { label: "스태프",  bgColor: "bg-slate-100", textColor: "text-slate-600", icon: User },
};

/**
 * 역할 배지 컴포넌트.
 * 역할에 따라 색상과 아이콘이 다르게 표시됩니다.
 */
const RoleBadge = ({ role }) => {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.staff;
  const IconComponent = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
      <IconComponent size={11} />
      {config.label}
    </span>
  );
};

/**
 * 계정 추가/수정 모달 컴포넌트.
 * @param {object} props
 * @param {boolean} props.isOpen - 모달 표시 여부
 * @param {object|null} props.editUser - 수정 대상 사용자 (null이면 신규 생성)
 * @param {Function} props.onClose - 모달 닫기 콜백
 * @param {Function} props.onSave - 저장 완료 콜백
 */
const UserModal = ({ isOpen, editUser, onClose, onSave }) => {
  // 폼 상태
  const [form, setForm] = useState({ username: "", password: "", name: "", role: "staff" });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // 수정 모드일 때 기존 데이터로 폼 초기화
  useEffect(() => {
    if (editUser) {
      setForm({ username: editUser.username, password: "", name: editUser.name, role: editUser.role });
    } else {
      setForm({ username: "", password: "", name: "", role: "staff" });
    }
    setErrorMessage("");
  }, [editUser, isOpen]);

  if (!isOpen) return null;

  /**
   * 폼 제출 처리 — 신규 생성 또는 수정
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    // 유효성 검사
    if (!form.name.trim()) { setErrorMessage("이름을 입력해주세요."); return; }
    if (!editUser && !form.username.trim()) { setErrorMessage("아이디를 입력해주세요."); return; }
    if (!editUser && !form.password.trim()) { setErrorMessage("초기 비밀번호를 입력해주세요."); return; }

    setIsLoading(true);
    try {
      if (editUser) {
        // 수정 — 비밀번호는 입력한 경우에만 전송
        const updateData = { name: form.name, role: form.role };
        if (form.password.trim()) updateData.password = form.password;
        await updateUser(editUser.id, updateData);
      } else {
        // 신규 생성
        await createUser({ username: form.username, password: form.password, name: form.name, role: form.role });
      }
      onSave();
      onClose();
    } catch (err) {
      setErrorMessage(err.message || "저장에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // 모달 오버레이
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* 모달 헤더 */}
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 text-lg">
            {editUser ? "계정 수정" : "계정 추가"}
          </h3>
        </div>

        {/* 모달 본문 */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* 아이디 — 신규 생성 시에만 입력 */}
          {!editUser && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">아이디</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="영문/숫자 조합"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">이름</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="한국어 이름"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 역할 선택 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">역할</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="admin">관리자 (admin) — 전체 접근</option>
              <option value="manager">매니저 (manager) — 운영 접근</option>
              <option value="staff">스태프 (staff) — 근무표만</option>
            </select>
          </div>

          {/* 비밀번호 — 신규: 필수 / 수정: 변경 시에만 입력 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              {editUser ? "비밀번호 변경 (선택)" : "초기 비밀번호"}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={editUser ? "변경할 경우에만 입력" : "8자 이상 권장"}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 에러 메시지 */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-red-600 text-sm">{errorMessage}</p>
            </div>
          )}
        </form>

        {/* 모달 하단 버튼 */}
        <div className="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            disabled={isLoading}
          >
            취소
          </button>
          <button
            type="submit"
            form="user-form"
            onClick={(e) => {
              // form 내부 submit 버튼처럼 동작하게 처리
              const form = e.target.closest(".bg-white")?.querySelector("form");
              if (form) form.requestSubmit();
            }}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
};


/**
 * 계정 관리 메인 컴포넌트.
 * admin 전용 — 전체 사용자 계정 목록과 CRUD 기능을 제공합니다.
 */
const UserManagement = () => {
  const { showToast } = useToast();

  // 상태 관리
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null=신규, 객체=수정

  /**
   * 사용자 목록을 백엔드에서 불러옵니다.
   */
  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      showToast(err.message || "계정 목록 불러오기에 실패했습니다.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // 컴포넌트 마운트 시 사용자 목록 로드
  useEffect(() => {
    loadUsers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 계정 비활성화 처리 (소프트 삭제)
   * @param {object} user - 비활성화할 사용자
   */
  const handleDeactivate = async (user) => {
    if (!window.confirm(`${user.name} 계정을 비활성화하시겠습니까?`)) return;

    try {
      await deleteUser(user.id);
      showToast(`${user.name} 계정이 비활성화되었습니다.`, "success");
      loadUsers();
    } catch (err) {
      showToast(err.message || "비활성화에 실패했습니다.", "error");
    }
  };

  /**
   * 계정 재활성화 처리
   * @param {object} user - 재활성화할 사용자
   */
  const handleReactivate = async (user) => {
    try {
      await updateUser(user.id, { is_active: true });
      showToast(`${user.name} 계정이 활성화되었습니다.`, "success");
      loadUsers();
    } catch (err) {
      showToast(err.message || "활성화에 실패했습니다.", "error");
    }
  };

  /**
   * 마지막 로그인 시각을 한국어 형식으로 변환합니다.
   */
  const formatLastLogin = (dateStr) => {
    if (!dateStr) return "없음";
    try {
      const date = new Date(dateStr);
      return date.toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "없음";
    }
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">계정 관리</h2>
          <p className="text-sm text-slate-500 mt-0.5">시스템 사용자 계정을 관리합니다.</p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <UserPlus size={16} />
          계정 추가
        </button>
      </div>

      {/* 계정 목록 테이블 */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          // 로딩 상태
          <div className="flex items-center justify-center py-16 text-slate-400">
            계정 목록을 불러오는 중...
          </div>
        ) : users.length === 0 ? (
          // 데이터 없음
          <div className="flex items-center justify-center py-16 text-slate-400">
            등록된 계정이 없습니다.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">아이디</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">이름</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">역할</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">마지막 로그인</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">상태</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className={`hover:bg-slate-50 transition-colors ${!user.is_active ? "opacity-60" : ""}`}>
                  {/* 아이디 */}
                  <td className="px-4 py-3 font-mono text-slate-700">{user.username}</td>

                  {/* 이름 */}
                  <td className="px-4 py-3 text-slate-800">{user.name}</td>

                  {/* 역할 배지 */}
                  <td className="px-4 py-3">
                    <RoleBadge role={user.role} />
                  </td>

                  {/* 마지막 로그인 */}
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {formatLastLogin(user.last_login)}
                  </td>

                  {/* 활성화 상태 */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.is_active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-600"
                    }`}>
                      {user.is_active ? "활성" : "비활성"}
                    </span>
                  </td>

                  {/* 관리 버튼 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      {/* 수정 버튼 */}
                      <button
                        onClick={() => { setEditTarget(user); setModalOpen(true); }}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="수정"
                      >
                        <Edit2 size={15} />
                      </button>

                      {/* 활성화/비활성화 토글 버튼 */}
                      {user.is_active ? (
                        <button
                          onClick={() => handleDeactivate(user)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="비활성화"
                        >
                          <UserX size={15} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(user)}
                          className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="활성화"
                        >
                          <UserPlus size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 계정 추가/수정 모달 */}
      <UserModal
        isOpen={modalOpen}
        editUser={editTarget}
        onClose={() => setModalOpen(false)}
        onSave={() => {
          loadUsers();
          showToast(editTarget ? "계정이 수정되었습니다." : "계정이 생성되었습니다.", "success");
        }}
      />
    </div>
  );
};

export default UserManagement;
