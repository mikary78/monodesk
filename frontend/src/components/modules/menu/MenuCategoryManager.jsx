// ============================================================
// MenuCategoryManager.jsx — 메뉴 카테고리 관리 탭 컴포넌트
// 카테고리 추가, 수정, 삭제, 정렬 순서 관리를 담당합니다.
// ============================================================

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Save, X, Tags } from "lucide-react";
import {
  fetchMenuCategories,
  createMenuCategory,
  updateMenuCategory,
  deleteMenuCategory,
} from "../../../api/menuApi";

// 기본 색상 팔레트 (카테고리 색상 선택용)
const COLOR_PALETTE = [
  "#3B82F6", "#22C55E", "#F59E0B", "#EF4444",
  "#8B5CF6", "#06B6D4", "#10B981", "#F97316",
  "#64748B", "#EC4899",
];

const MenuCategoryManager = () => {
  // 카테고리 목록 상태
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 신규 카테고리 폼 상태
  const [addForm, setAddForm] = useState({ name: "", description: "", color: "#3B82F6", sort_order: 0 });
  const [addError, setAddError] = useState(null);
  const [addLoading, setAddLoading] = useState(false);

  // 수정 중인 카테고리 상태
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // 컴포넌트 마운트 시 카테고리 로드
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await fetchMenuCategories();
      setCategories(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 새 카테고리 추가 핸들러
  const handleAdd = async () => {
    if (!addForm.name.trim()) {
      setAddError("카테고리명을 입력해주세요.");
      return;
    }
    setAddLoading(true);
    try {
      await createMenuCategory({
        name: addForm.name.trim(),
        description: addForm.description.trim() || null,
        color: addForm.color,
        sort_order: Number(addForm.sort_order) || 0,
      });
      setAddForm({ name: "", description: "", color: "#3B82F6", sort_order: 0 });
      setAddError(null);
      await loadCategories();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  // 수정 모드 시작
  const handleStartEdit = (cat) => {
    setEditingId(cat.id);
    setEditForm({
      name: cat.name,
      description: cat.description || "",
      color: cat.color,
      sort_order: cat.sort_order,
    });
  };

  // 수정 저장 핸들러
  const handleSaveEdit = async (categoryId) => {
    if (!editForm.name.trim()) return;
    try {
      await updateMenuCategory(categoryId, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        color: editForm.color,
        sort_order: Number(editForm.sort_order) || 0,
      });
      setEditingId(null);
      await loadCategories();
    } catch (err) {
      alert(err.message);
    }
  };

  // 삭제 핸들러
  const handleDelete = async (cat) => {
    if (!window.confirm(`"${cat.name}" 카테고리를 삭제하시겠습니까?\n해당 카테고리에 메뉴가 있으면 삭제할 수 없습니다.`)) return;
    try {
      await deleteMenuCategory(cat.id);
      await loadCategories();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse bg-white rounded-lg p-6">
        <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 bg-slate-100 rounded mb-2"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-red-700 text-sm">{error}</div>
      )}

      {/* 카테고리 목록 */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Tags size={15} className="text-blue-500" />
            메뉴 카테고리 목록
          </h3>
        </div>

        {categories.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            카테고리가 없습니다. 아래에서 추가해주세요.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {categories.map((cat) => (
              <div key={cat.id} className="px-5 py-3">
                {editingId === cat.id ? (
                  // 수정 모드
                  <div className="flex items-center gap-3 flex-wrap">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                      className="h-8 px-2 border border-blue-400 rounded text-sm focus:outline-none w-32"
                    />
                    <input
                      type="text"
                      value={editForm.description}
                      onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="설명"
                      className="h-8 px-2 border border-slate-200 rounded text-sm focus:outline-none flex-1 min-w-[100px]"
                    />
                    <input
                      type="number"
                      value={editForm.sort_order}
                      onChange={(e) => setEditForm((p) => ({ ...p, sort_order: e.target.value }))}
                      placeholder="순서"
                      className="h-8 px-2 border border-slate-200 rounded text-sm focus:outline-none w-16"
                    />
                    {/* 색상 팔레트 */}
                    <div className="flex gap-1">
                      {COLOR_PALETTE.map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditForm((p) => ({ ...p, color: c }))}
                          className={`w-5 h-5 rounded-full border-2 ${editForm.color === c ? "border-slate-700 scale-110" : "border-transparent"}`}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => handleSaveEdit(cat.id)}
                      className="h-8 px-3 bg-blue-500 text-white rounded text-xs font-medium hover:bg-blue-600 flex items-center gap-1"
                    >
                      <Save size={12} /> 저장
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="h-8 px-3 border border-slate-200 rounded text-xs text-slate-600 hover:bg-slate-50"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  // 표시 모드
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* 카테고리 색상 점 */}
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-800">{cat.name}</span>
                        {cat.description && (
                          <span className="text-xs text-slate-400 ml-2">{cat.description}</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-300 ml-1">순서: {cat.sort_order}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(cat)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-blue-50 text-slate-400 hover:text-blue-500"
                        title="수정"
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                        title="삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 카테고리 추가 폼 */}
      <div className="bg-white rounded-lg shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <Plus size={15} className="text-blue-500" />
          카테고리 추가
        </h3>

        {addError && (
          <div className="bg-red-50 text-red-600 text-xs p-2 rounded mb-3">{addError}</div>
        )}

        <div className="space-y-3">
          {/* 카테고리명 */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">카테고리명 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={addForm.name}
              onChange={(e) => { setAddForm((p) => ({ ...p, name: e.target.value })); setAddError(null); }}
              placeholder="예: 해산물 요리"
              className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">설명</label>
            <input
              type="text"
              value={addForm.description}
              onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="카테고리 설명 (선택)"
              className="w-full h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 정렬 순서 + 색상 */}
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">정렬 순서</label>
              <input
                type="number"
                value={addForm.sort_order}
                onChange={(e) => setAddForm((p) => ({ ...p, sort_order: e.target.value }))}
                min="0"
                className="w-20 h-9 px-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-500 mb-1">표시 색상</label>
              <div className="flex gap-1.5 flex-wrap">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setAddForm((p) => ({ ...p, color: c }))}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${addForm.color === c ? "border-slate-700 scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={addLoading}
            className="h-9 px-5 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
          >
            <Plus size={14} />
            {addLoading ? "추가 중..." : "카테고리 추가"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MenuCategoryManager;
