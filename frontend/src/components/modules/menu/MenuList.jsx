// ============================================================
// MenuList.jsx — 메뉴 목록 탭 컴포넌트
// 메뉴 아이템 조회, 등록, 수정, 삭제, 판매 토글을 처리합니다.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Search, Edit, Trash2, FlaskConical,
  ToggleLeft, ToggleRight, Star, Filter
} from "lucide-react";
import {
  fetchMenuItems,
  fetchMenuCategories,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleMenuActive,
  toggleMenuFeatured,
  formatCurrency,
  getCostRatioBadgeClass,
  seedMenuCategories,
} from "../../../api/menuApi";
import MenuItemModal from "./MenuItemModal";
import IngredientsModal from "./IngredientsModal";
import { useToast } from "../../../contexts/ToastContext";
import ConfirmDialog from "../../common/ConfirmDialog";

const MenuList = () => {
  const toast = useToast();
  // 데이터 상태 관리
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 필터 상태 관리
  const [filterCategory, setFilterCategory] = useState("");
  const [filterActive, setFilterActive] = useState("");
  const [searchText, setSearchText] = useState("");

  // 모달 상태 관리
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [ingModalOpen, setIngModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  // 메뉴 삭제 확인 다이얼로그 상태
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, item: null });

  // 초기 데이터 로드
  useEffect(() => {
    initializeData();
  }, []);

  // 필터 변경 시 목록 재조회
  useEffect(() => {
    loadItems();
  }, [filterCategory, filterActive]);

  // 데이터 초기화 (카테고리 seed 포함)
  const initializeData = async () => {
    try {
      await seedMenuCategories();
    } catch (_) {
      // 이미 초기화된 경우 무시
    }
    await Promise.all([loadCategories(), loadItems()]);
  };

  // 카테고리 목록 로드
  const loadCategories = async () => {
    try {
      const data = await fetchMenuCategories();
      setCategories(data);
    } catch (err) {
      console.error("카테고리 로드 실패:", err.message);
    }
  };

  // 메뉴 목록 로드
  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = {};
      if (filterCategory) filters.categoryId = Number(filterCategory);
      if (filterActive !== "") filters.is_active = Number(filterActive);
      const result = await fetchMenuItems(filters);
      setItems(result.items || []);
      setTotal(result.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterActive]);

  // 검색 필터 적용 (클라이언트 사이드)
  const filteredItems = items.filter((item) =>
    searchText.trim() === "" ||
    item.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // 메뉴 저장 핸들러 (등록/수정) — 생성된 아이템 반환 (신규 등록 후 재료 등록 유도에 사용)
  const handleSaveItem = async (formData) => {
    let result;
    if (editingItem) {
      result = await updateMenuItem(editingItem.id, formData);
    } else {
      result = await createMenuItem(formData);
    }
    await loadItems();
    return result;
  };

  // 메뉴 삭제 버튼 클릭 → 확인 다이얼로그 열기
  const handleDeleteClick = (item) => {
    setDeleteConfirm({ open: true, item });
  };

  // 메뉴 삭제 확인 → 실제 삭제 실행
  const handleDeleteConfirm = async () => {
    const item = deleteConfirm.item;
    setDeleteConfirm({ open: false, item: null });
    try {
      await deleteMenuItem(item.id);
      await loadItems();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // 판매 여부 토글 핸들러
  const handleToggleActive = async (item) => {
    try {
      await toggleMenuActive(item.id);
      await loadItems();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // 대표 메뉴 토글 핸들러
  const handleToggleFeatured = async (item) => {
    try {
      await toggleMenuFeatured(item.id);
      await loadItems();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // 재료 모달 열기
  const handleOpenIngredients = (item) => {
    setSelectedItem(item);
    setIngModalOpen(true);
  };

  // 원가 업데이트 후 목록 갱신
  const handleCostUpdate = async () => {
    await loadItems();
  };

  // 카테고리명으로 색상 클래스 반환
  const getCategoryColor = (categoryId) => {
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.color || "#64748B";
  };

  return (
    <div>
      {/* 필터 바 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* 검색 */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="메뉴 검색..."
            className="w-full h-9 pl-8 pr-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* 카테고리 필터 */}
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:border-blue-500 min-w-[130px]"
        >
          <option value="">전체 카테고리</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        {/* 판매 상태 필터 */}
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          className="h-9 px-3 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:border-blue-500 min-w-[110px]"
        >
          <option value="">전체 상태</option>
          <option value="1">판매중</option>
          <option value="0">판매중지</option>
        </select>

        <span className="text-sm text-slate-500 ml-auto">
          총 {filteredItems.length}개
        </span>

        {/* 메뉴 등록 버튼 */}
        <button
          onClick={() => { setEditingItem(null); setItemModalOpen(true); }}
          className="h-9 px-4 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 flex items-center gap-2"
        >
          <Plus size={14} />
          메뉴 등록
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-red-700 text-sm">
          메뉴 목록 조회 중 오류가 발생했습니다: {error}
        </div>
      )}

      {/* 메뉴 테이블 */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center">
            <div className="text-slate-400 text-sm">메뉴 목록을 불러오는 중...</div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-400 text-sm mb-1">등록된 메뉴가 없습니다.</p>
            <p className="text-slate-400 text-xs">메뉴 등록 버튼을 눌러 첫 번째 메뉴를 추가해보세요.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 uppercase border-b border-slate-200">
                <th className="text-left px-4 py-3">메뉴명</th>
                <th className="text-left px-4 py-3">카테고리</th>
                <th className="text-right px-4 py-3">판매가</th>
                <th className="text-right px-4 py-3">원가</th>
                <th className="text-center px-4 py-3">원가율</th>
                <th className="text-right px-4 py-3">마진</th>
                <th className="text-center px-4 py-3">상태</th>
                <th className="text-center px-4 py-3">관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`border-b border-slate-100 hover:bg-blue-50/30 ${idx % 2 === 1 ? "bg-slate-50/40" : ""}`}
                >
                  {/* 메뉴명 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {item.is_featured === 1 && (
                        <Star size={13} className="text-yellow-500 fill-yellow-400 shrink-0" />
                      )}
                      <span className="font-medium text-slate-800">{item.name}</span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[180px]">{item.description}</p>
                    )}
                  </td>

                  {/* 카테고리 */}
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${getCategoryColor(item.category_id)}18`,
                        color: getCategoryColor(item.category_id),
                      }}
                    >
                      {item.category?.name || "-"}
                    </span>
                  </td>

                  {/* 판매가 */}
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {formatCurrency(item.price)}
                  </td>

                  {/* 원가 */}
                  <td className="px-4 py-3 text-right text-slate-600">
                    {item.cost > 0 ? formatCurrency(item.cost) : <span className="text-slate-300">-</span>}
                  </td>

                  {/* 원가율 */}
                  <td className="px-4 py-3 text-center">
                    {item.cost > 0 ? (
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${getCostRatioBadgeClass(item.cost_ratio)}`}>
                        {item.cost_ratio}%
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">-</span>
                    )}
                  </td>

                  {/* 마진 */}
                  <td className="px-4 py-3 text-right text-slate-600">
                    {item.cost > 0 ? formatCurrency(item.margin) : <span className="text-slate-300">-</span>}
                  </td>

                  {/* 판매 상태 */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleActive(item)}
                      title={item.is_active === 1 ? "클릭하면 판매중지" : "클릭하면 판매재개"}
                      className="inline-flex items-center gap-1"
                    >
                      {item.is_active === 1 ? (
                        <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                          <ToggleRight size={16} className="fill-green-100" /> 판매중
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-400 text-xs font-medium">
                          <ToggleLeft size={16} /> 중지
                        </span>
                      )}
                    </button>
                  </td>

                  {/* 관리 버튼 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {/* 재료 관리 — 아이콘+텍스트 뱃지 형태로 표시하여 가시성 향상 */}
                      <button
                        onClick={() => handleOpenIngredients(item)}
                        className="flex items-center gap-1 px-2 h-7 rounded text-xs font-medium hover:bg-purple-50 text-slate-500 hover:text-purple-600 border border-transparent hover:border-purple-200"
                        title="구성 재료 관리"
                      >
                        <FlaskConical size={12} />
                        재료
                      </button>
                      {/* 대표 메뉴 토글 */}
                      <button
                        onClick={() => handleToggleFeatured(item)}
                        className={`w-7 h-7 flex items-center justify-center rounded ${item.is_featured === 1 ? "text-yellow-500 bg-yellow-50" : "text-slate-300 hover:bg-yellow-50 hover:text-yellow-500"}`}
                        title={item.is_featured === 1 ? "대표 메뉴 해제" : "대표 메뉴 설정"}
                      >
                        <Star size={14} className={item.is_featured === 1 ? "fill-yellow-400" : ""} />
                      </button>
                      {/* 수정 */}
                      <button
                        onClick={() => { setEditingItem(item); setItemModalOpen(true); }}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-blue-50 text-slate-400 hover:text-blue-500"
                        title="수정"
                      >
                        <Edit size={14} />
                      </button>
                      {/* 삭제 */}
                      <button
                        onClick={() => handleDeleteClick(item)}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 메뉴 등록/수정 모달 */}
      <MenuItemModal
        isOpen={itemModalOpen}
        onClose={() => { setItemModalOpen(false); setEditingItem(null); }}
        onSave={handleSaveItem}
        onManageIngredients={handleOpenIngredients}
        item={editingItem}
        categories={categories}
      />

      {/* 구성 재료 관리 모달 */}
      <IngredientsModal
        isOpen={ingModalOpen}
        onClose={() => setIngModalOpen(false)}
        menuItem={selectedItem}
        onCostUpdate={handleCostUpdate}
      />

      {/* 메뉴 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        title="메뉴 삭제"
        message={`"${deleteConfirm.item?.name}" 메뉴를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm({ open: false, item: null })}
      />
    </div>
  );
};

export default MenuList;
