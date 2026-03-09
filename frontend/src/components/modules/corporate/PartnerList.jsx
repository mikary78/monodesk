// ============================================================
// PartnerList.jsx — 동업자 목록 및 관리 컴포넌트
// 동업자 4명의 지분율, 역할, 연락처 등을 관리합니다.
// ============================================================

import { useState, useEffect } from "react";
import { Users, Plus, Edit, Trash2, Building2 } from "lucide-react";
import {
  fetchPartners,
  createPartner,
  updatePartner,
  deletePartner,
  seedPartners,
} from "../../../api/corporateApi";

// 법인 내 역할 목록
const ROLE_OPTIONS = ["대표이사", "이사", "감사", "주주"];

// 빈 폼 초기값
const EMPTY_FORM = {
  name: "",
  equity_ratio: "",
  phone: "",
  email: "",
  bank_name: "",
  bank_account: "",
  role: "이사",
  investment_amount: "",
  memo: "",
};

const PartnerList = () => {
  // 동업자 목록 상태
  const [partners, setPartners] = useState([]);
  // 로딩 상태
  const [loading, setLoading] = useState(true);
  // 오류 메시지
  const [error, setError] = useState(null);
  // 모달 표시 여부
  const [showModal, setShowModal] = useState(false);
  // 수정 대상 동업자 (null이면 신규 등록)
  const [editTarget, setEditTarget] = useState(null);
  // 폼 입력값
  const [form, setForm] = useState(EMPTY_FORM);
  // 저장 중 상태
  const [saving, setSaving] = useState(false);
  // 저장/삭제 오류 메시지
  const [formError, setFormError] = useState(null);

  // 컴포넌트 마운트 시 동업자 목록 불러오기
  useEffect(() => {
    loadPartners();
  }, []);

  /**
   * 동업자 목록 불러오기
   */
  const loadPartners = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPartners();
      setPartners(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 신규 등록 모달 열기
   */
  const handleOpenCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  };

  /**
   * 수정 모달 열기
   */
  const handleOpenEdit = (partner) => {
    setEditTarget(partner);
    setForm({
      name: partner.name,
      equity_ratio: partner.equity_ratio,
      phone: partner.phone || "",
      email: partner.email || "",
      bank_name: partner.bank_name || "",
      bank_account: partner.bank_account || "",
      role: partner.role || "이사",
      investment_amount: partner.investment_amount || "",
      memo: partner.memo || "",
    });
    setFormError(null);
    setShowModal(true);
  };

  /**
   * 폼 저장 처리 (신규 or 수정)
   */
  const handleSave = async () => {
    if (!form.name.trim()) { setFormError("이름을 입력해주세요."); return; }
    if (!form.equity_ratio || isNaN(Number(form.equity_ratio))) {
      setFormError("지분율을 숫자로 입력해주세요."); return;
    }

    try {
      setSaving(true);
      setFormError(null);
      const payload = {
        ...form,
        equity_ratio: parseFloat(form.equity_ratio),
        investment_amount: form.investment_amount ? parseFloat(form.investment_amount) : 0,
      };

      if (editTarget) {
        await updatePartner(editTarget.id, payload);
      } else {
        await createPartner(payload);
      }
      setShowModal(false);
      await loadPartners();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * 동업자 삭제 처리
   */
  const handleDelete = async (partner) => {
    if (!window.confirm(`"${partner.name}" 동업자를 삭제하시겠습니까?`)) return;
    try {
      await deletePartner(partner.id);
      await loadPartners();
    } catch (e) {
      alert(e.message);
    }
  };

  /**
   * 기본 동업자 4명 초기 등록 처리
   */
  const handleSeed = async () => {
    if (!window.confirm("기본 동업자 4명을 초기 등록하시겠습니까? (이미 동업자가 있으면 건너뜁니다)")) return;
    try {
      await seedPartners();
      await loadPartners();
    } catch (e) {
      alert(e.message);
    }
  };

  // 전체 지분율 합계 계산
  const totalEquity = partners.reduce((sum, p) => sum + p.equity_ratio, 0);

  // 로딩 중 표시
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-slate-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  // 오류 표시
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-red-500 text-sm">{error}</p>
        <button onClick={loadPartners} className="mt-2 text-blue-500 text-sm underline">
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 상단 헤더 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Users size={20} className="text-blue-500" />
            <h2 className="text-lg font-semibold text-slate-900">동업자 현황</h2>
            <span className="text-sm text-slate-400">
              지분율 합계: {totalEquity.toFixed(1)}%
            </span>
            {Math.abs(totalEquity - 100) > 0.1 && (
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                합계 불일치
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {partners.length === 0 && (
              <button
                onClick={handleSeed}
                className="h-9 px-4 text-sm font-medium border border-slate-200 rounded-md hover:bg-slate-50 text-slate-600 transition-colors"
              >
                기본값 초기화
              </button>
            )}
            <button
              onClick={handleOpenCreate}
              className="h-9 px-4 flex items-center gap-2 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              <Plus size={16} />
              동업자 추가
            </button>
          </div>
        </div>

        {/* 동업자 없음 상태 */}
        {partners.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Building2 size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">등록된 동업자가 없습니다.</p>
            <p className="text-xs mt-1">동업자를 추가하거나 기본값을 초기화하세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {partners.map((partner) => (
              <div
                key={partner.id}
                className="border border-slate-100 rounded-lg p-5 hover:border-blue-200 transition-colors"
              >
                {/* 동업자 카드 헤더 */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-slate-900">
                        {partner.name}
                      </span>
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                        {partner.role || "이사"}
                      </span>
                    </div>
                    <div className="mt-1 text-2xl font-bold text-blue-600">
                      {partner.equity_ratio.toFixed(1)}%
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenEdit(partner)}
                      className="p-1.5 text-slate-400 hover:text-blue-500 rounded transition-colors"
                      title="수정"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(partner)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* 동업자 상세 정보 */}
                <div className="space-y-1 text-sm text-slate-500">
                  {partner.investment_amount > 0 && (
                    <div className="flex justify-between">
                      <span>출자금</span>
                      <span className="font-medium text-slate-700">
                        {partner.investment_amount.toLocaleString()}원
                      </span>
                    </div>
                  )}
                  {partner.phone && (
                    <div className="flex justify-between">
                      <span>연락처</span>
                      <span>{partner.phone}</span>
                    </div>
                  )}
                  {partner.bank_name && (
                    <div className="flex justify-between">
                      <span>은행</span>
                      <span>{partner.bank_name}</span>
                    </div>
                  )}
                </div>

                {/* 지분율 시각화 바 */}
                <div className="mt-3">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full"
                      style={{ width: `${partner.equity_ratio}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 동업자 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            {/* 모달 헤더 */}
            <h3 className="text-lg font-semibold text-slate-900 mb-5">
              {editTarget ? "동업자 정보 수정" : "동업자 추가"}
            </h3>

            {/* 폼 */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* 이름 */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    이름 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
                    placeholder="홍길동"
                  />
                </div>
                {/* 지분율 */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    지분율 (%) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    max="100"
                    step="0.1"
                    value={form.equity_ratio}
                    onChange={(e) => setForm({ ...form, equity_ratio: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
                    placeholder="29.0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* 역할 */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">역할</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400 bg-white"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                {/* 출자금 */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">출자금 (원)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.investment_amount}
                    onChange={(e) => setForm({ ...form, investment_amount: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* 연락처 */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">연락처</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
                    placeholder="010-0000-0000"
                  />
                </div>
                {/* 이메일 */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">이메일</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
                    placeholder="example@email.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* 은행명 */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">은행명</label>
                  <input
                    type="text"
                    value={form.bank_name}
                    onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
                    placeholder="국민은행"
                  />
                </div>
                {/* 계좌번호 */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">계좌번호</label>
                  <input
                    type="text"
                    value={form.bank_account}
                    onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                    className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400"
                    placeholder="000000-00-000000"
                  />
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">메모</label>
                <textarea
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-400 resize-none"
                  placeholder="비고 사항"
                />
              </div>

              {/* 오류 메시지 */}
              {formError && (
                <p className="text-red-500 text-xs">{formError}</p>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="h-9 px-4 text-sm font-medium border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-9 px-4 text-sm font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PartnerList;
