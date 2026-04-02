// ============================================================
// FixedCostSettings.jsx — 고정비 항목 마스터 관리
// facility(시설비) / operation(운영비) 섹션으로 구분
// 항목 추가 / 인라인 수정 / 비활성화
// ============================================================

import { useState, useEffect } from "react";
import { Plus, Edit2, Check, X, EyeOff } from "lucide-react";
import {
  getFixedCostItems,
  createFixedCostItem,
  updateFixedCostItem,
  deleteFixedCostItem,
} from "../../../api/operationsApi";
import { useToast } from "../../../contexts/ToastContext";
import ConfirmDialog from "../../common/ConfirmDialog";

const CATEGORY_LABELS = { facility: "시설비 (고정비1)", operation: "운영 고정비 (고정비2)" };
const CATEGORY_COLORS = {
  facility:  "bg-blue-50 text-blue-700 border-blue-200",
  operation: "bg-purple-50 text-purple-700 border-purple-200",
};

const fmt = (v) => (v ?? 0).toLocaleString("ko-KR");

const EMPTY_MODAL = { name: "", category: "facility", vendor_name: "", payment_day: "", default_amount: "" };

const FixedCostSettings = () => {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // 추가 모달
  const [modalOpen, setModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState(EMPTY_MODAL);
  const [modalSaving, setModalSaving] = useState(false);

  // 인라인 수정
  const [editingId, setEditingId]   = useState(null);
  const [editForm, setEditForm]     = useState({});

  // 비활성화 확인
  const [deactivateConfirm, setDeactivateConfirm] = useState({ open: false, item: null });

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await getFixedCostItems();
      setItems(data);
    } catch (err) {
      toast.error("항목 조회 실패: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 카테고리별 그룹핑
  const grouped = items.reduce((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // 항목 추가 저장
  const handleModalSave = async () => {
    if (!modalForm.name.trim()) { toast.error("항목명을 입력해주세요."); return; }
    setModalSaving(true);
    try {
      await createFixedCostItem({
        name: modalForm.name.trim(),
        category: modalForm.category,
        vendor_name: modalForm.vendor_name.trim() || null,
        payment_day: modalForm.payment_day ? parseInt(modalForm.payment_day) : null,
        default_amount: parseInt(modalForm.default_amount.toString().replace(/,/g, "")) || 0,
        sort_order: items.filter(i => i.category === modalForm.category).length + 1,
      });
      toast.success("고정비 항목이 추가되었습니다.");
      setModalOpen(false);
      setModalForm(EMPTY_MODAL);
      await loadItems();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setModalSaving(false);
    }
  };

  // 인라인 수정 시작
  const startEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      vendor_name: item.vendor_name || "",
      payment_day: item.payment_day || "",
      default_amount: item.default_amount || 0,
    });
  };

  // 인라인 수정 저장
  const saveEdit = async (item) => {
    try {
      await updateFixedCostItem(item.id, {
        name: editForm.name.trim(),
        vendor_name: editForm.vendor_name.trim() || null,
        payment_day: editForm.payment_day ? parseInt(editForm.payment_day) : null,
        default_amount: parseInt(editForm.default_amount.toString().replace(/,/g, "")) || 0,
      });
      setEditingId(null);
      await loadItems();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // 비활성화 확인 → 실행
  const handleDeactivateConfirm = async () => {
    const item = deactivateConfirm.item;
    setDeactivateConfirm({ open: false, item: null });
    try {
      await deleteFixedCostItem(item.id);
      toast.success(`"${item.name}" 항목이 비활성화되었습니다.`);
      await loadItems();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <div className="py-12 text-center text-sm text-slate-400">불러오는 중...</div>;

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          매월 반복 지출되는 고정비 항목을 설정합니다. 설정금액은 월별 예산의 기준값이 됩니다.
        </p>
        <button
          onClick={() => { setModalForm(EMPTY_MODAL); setModalOpen(true); }}
          className="h-9 px-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md flex items-center gap-2"
        >
          <Plus size={14} />
          항목 추가
        </button>
      </div>

      {/* 카테고리별 섹션 */}
      {["facility", "operation"].map((cat) => {
        const catItems = grouped[cat] || [];
        return (
          <div key={cat} className="mb-6">
            {/* 섹션 헤더 */}
            <div className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold border mb-2 ${CATEGORY_COLORS[cat]}`}>
              {CATEGORY_LABELS[cat]}
              <span className="ml-1.5 opacity-70">({catItems.length}개)</span>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              {catItems.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400">
                  등록된 항목이 없습니다. 항목 추가 버튼을 눌러 추가하세요.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 border-b border-slate-200">
                      <th className="text-left px-4 py-2.5">항목명</th>
                      <th className="text-left px-4 py-2.5">업체명</th>
                      <th className="text-center px-4 py-2.5">이체일</th>
                      <th className="text-right px-4 py-2.5">설정금액</th>
                      <th className="text-center px-4 py-2.5 w-24">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catItems.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        {editingId === item.id ? (
                          // 인라인 편집 모드
                          <>
                            <td className="px-3 py-2">
                              <input
                                value={editForm.name}
                                onChange={(e) => setEditForm(p => ({...p, name: e.target.value}))}
                                className="w-full h-7 px-2 border border-blue-300 rounded text-sm focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                value={editForm.vendor_name}
                                onChange={(e) => setEditForm(p => ({...p, vendor_name: e.target.value}))}
                                placeholder="업체명"
                                className="w-full h-7 px-2 border border-blue-300 rounded text-sm focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="number"
                                min="1" max="31"
                                value={editForm.payment_day}
                                onChange={(e) => setEditForm(p => ({...p, payment_day: e.target.value}))}
                                placeholder="-"
                                className="w-16 h-7 px-2 border border-blue-300 rounded text-sm text-center focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                value={editForm.default_amount}
                                onChange={(e) => setEditForm(p => ({...p, default_amount: e.target.value}))}
                                className="w-full h-7 px-2 border border-blue-300 rounded text-sm text-right focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex justify-center gap-1">
                                <button onClick={() => saveEdit(item)} className="w-7 h-7 flex items-center justify-center rounded bg-blue-100 text-blue-600 hover:bg-blue-200" title="저장">
                                  <Check size={13} />
                                </button>
                                <button onClick={() => setEditingId(null)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400" title="취소">
                                  <X size={13} />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          // 일반 표시 모드
                          <>
                            <td className="px-4 py-2.5 font-medium text-slate-800">{item.name}</td>
                            <td className="px-4 py-2.5 text-slate-600">{item.vendor_name || <span className="text-slate-300">-</span>}</td>
                            <td className="px-4 py-2.5 text-center text-slate-600">
                              {item.payment_day ? `${item.payment_day}일` : <span className="text-slate-300">-</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                              {item.default_amount > 0 ? `${fmt(item.default_amount)}원` : <span className="text-slate-300">-</span>}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex justify-center gap-1">
                                <button onClick={() => startEdit(item)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-blue-50 text-slate-400 hover:text-blue-500" title="수정">
                                  <Edit2 size={13} />
                                </button>
                                <button onClick={() => setDeactivateConfirm({ open: true, item })} className="w-7 h-7 flex items-center justify-center rounded hover:bg-orange-50 text-slate-400 hover:text-orange-500" title="비활성화">
                                  <EyeOff size={13} />
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      })}

      {/* 항목 추가 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">고정비 항목 추가</h2>
              <button onClick={() => setModalOpen(false)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100">
                <X size={15} className="text-slate-500" />
              </button>
            </div>

            <div className="space-y-3">
              {/* 항목명 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">항목명 <span className="text-red-500">*</span></label>
                <input
                  value={modalForm.name}
                  onChange={(e) => setModalForm(p => ({...p, name: e.target.value}))}
                  placeholder="예: 임대료"
                  className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* 카테고리 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">카테고리 <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  {["facility", "operation"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setModalForm(p => ({...p, category: cat}))}
                      className={`flex-1 h-9 text-sm rounded-md border font-medium ${
                        modalForm.category === cat
                          ? CATEGORY_COLORS[cat] + " border-current"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {CATEGORY_LABELS[cat].split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 업체명 / 이체일 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">업체명</label>
                  <input
                    value={modalForm.vendor_name}
                    onChange={(e) => setModalForm(p => ({...p, vendor_name: e.target.value}))}
                    placeholder="예: ○○부동산"
                    className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">이체일</label>
                  <input
                    type="number" min="1" max="31"
                    value={modalForm.payment_day}
                    onChange={(e) => setModalForm(p => ({...p, payment_day: e.target.value}))}
                    placeholder="예: 25"
                    className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 설정금액 */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">설정금액 (원)</label>
                <input
                  type="number" min="0"
                  value={modalForm.default_amount}
                  onChange={(e) => setModalForm(p => ({...p, default_amount: e.target.value}))}
                  placeholder="예: 3000000"
                  className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500 text-right"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModalOpen(false)} className="h-9 px-4 border border-slate-200 text-slate-600 text-sm rounded-md hover:bg-slate-50">취소</button>
              <button
                onClick={handleModalSave}
                disabled={modalSaving}
                className="h-9 px-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md disabled:opacity-50"
              >
                {modalSaving ? "저장 중..." : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비활성화 확인 */}
      <ConfirmDialog
        isOpen={deactivateConfirm.open}
        title="항목 비활성화"
        message={`"${deactivateConfirm.item?.name}" 항목을 비활성화하시겠습니까?\n비활성화된 항목은 이후 월별 고정비에 포함되지 않습니다.`}
        confirmText="비활성화"
        variant="danger"
        onConfirm={handleDeactivateConfirm}
        onCancel={() => setDeactivateConfirm({ open: false, item: null })}
      />
    </div>
  );
};

export default FixedCostSettings;
