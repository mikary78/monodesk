// ============================================================
// PosImport.jsx — POS 데이터 가져오기 탭 컴포넌트
// CSV 파일 업로드 및 가져오기 이력 관리 화면입니다.
// ============================================================

import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, CheckCircle, XCircle, Clock, FileText, AlertCircle } from "lucide-react";
import { importPosCsv, fetchImportHistory, deleteImport } from "../../../api/salesAnalysisApi";

// 가져오기 상태별 배지 스타일
const STATUS_BADGE = {
  success: { label: "성공", cls: "bg-green-50 text-green-600" },
  failed:  { label: "실패", cls: "bg-red-50 text-red-600" },
  partial: { label: "부분 성공", cls: "bg-yellow-50 text-yellow-600" },
  processing: { label: "처리 중", cls: "bg-blue-50 text-blue-600" },
};

// POS 가져오기 컴포넌트
const PosImport = ({ onImportSuccess }) => {
  // 가져오기 이력 상태
  const [history, setHistory] = useState([]);
  // 로딩 상태
  const [loading, setLoading] = useState(false);
  // 업로드 진행 상태
  const [uploading, setUploading] = useState(false);
  // 알림 메시지
  const [message, setMessage] = useState(null);
  // 드래그 오버 상태
  const [isDragOver, setIsDragOver] = useState(false);
  // 파일 인풋 ref
  const fileInputRef = useRef(null);

  // 컴포넌트 마운트 시 이력 조회
  useEffect(() => {
    loadHistory();
  }, []);

  // 가져오기 이력 불러오기
  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchImportHistory(20);
      setHistory(data);
    } catch (err) {
      showMessage("error", `이력 조회 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 알림 메시지 표시 (3초 후 자동 숨김)
  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  // 파일 업로드 처리
  const handleFileUpload = async (file) => {
    if (!file) return;

    // 확장자 검사
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["csv", "txt"].includes(ext)) {
      showMessage("error", "CSV 파일만 업로드 가능합니다. (.csv, .txt)");
      return;
    }

    setUploading(true);
    try {
      const result = await importPosCsv(file);
      if (result.duplicate) {
        showMessage("warning", result.message);
      } else if (result.success) {
        showMessage("success", result.message);
        await loadHistory();
        // 부모 컴포넌트에 성공 알림 (차트 데이터 갱신)
        if (onImportSuccess) onImportSuccess();
      } else {
        showMessage("error", result.message);
      }
    } catch (err) {
      showMessage("error", err.message);
    } finally {
      setUploading(false);
      // 파일 인풋 초기화
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // 파일 인풋 변경 이벤트
  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  // 드래그 앤 드롭 이벤트
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  // 가져오기 이력 삭제 확인
  const handleDelete = async (importId, fileName) => {
    if (!window.confirm(`'${fileName}' 데이터를 삭제하시겠습니까?\n연결된 모든 판매 데이터도 함께 삭제됩니다.`)) return;
    try {
      await deleteImport(importId);
      showMessage("success", "데이터가 삭제되었습니다.");
      await loadHistory();
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      showMessage("error", err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* 알림 메시지 */}
      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border-l-4 ${
          message.type === "success" ? "bg-green-50 border-green-500 text-green-700" :
          message.type === "warning" ? "bg-yellow-50 border-yellow-500 text-yellow-700" :
          "bg-red-50 border-red-500 text-red-700"
        }`}>
          {message.type === "success" ? <CheckCircle size={16} /> :
           message.type === "warning" ? <AlertCircle size={16} /> :
           <XCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* 파일 업로드 영역 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-base font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Upload size={18} className="text-blue-500" />
          POS 데이터 파일 업로드
        </h3>

        {/* 드래그 앤 드롭 영역 */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
            isDragOver
              ? "border-blue-400 bg-blue-50"
              : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
          } ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleInputChange}
            className="hidden"
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              {/* 업로드 중 스피너 */}
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500">파일을 처리 중입니다...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
                <Upload size={28} className="text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  CSV 파일을 여기에 드래그하거나 클릭하여 업로드
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  지원 형식: CSV (.csv, .txt) · 최대 10MB · UTF-8 / 한글(EUC-KR) 모두 지원
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 가져오기 안내 */}
        <div className="mt-4 p-3 bg-slate-50 rounded-lg">
          <p className="text-xs font-medium text-slate-600 mb-1">CSV 필수 컬럼 (컬럼명 자동 감지)</p>
          <div className="flex flex-wrap gap-2">
            {["날짜 (판매일, Date)", "메뉴명 (상품명, Item)", "금액 (판매금액, Amount)"].map((col) => (
              <span key={col} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600">
                {col}
              </span>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            선택 컬럼: 시간, 수량, 단가, 결제수단, 주문번호, 취소여부
          </p>
        </div>
      </div>

      {/* 가져오기 이력 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Clock size={18} className="text-slate-500" />
            가져오기 이력
          </h3>
          <button
            onClick={loadHistory}
            className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
          >
            새로고침
          </button>
        </div>

        {loading ? (
          // 스켈레톤 로딩
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          // 빈 상태
          <div className="text-center py-10">
            <FileText size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">아직 가져온 파일이 없습니다.</p>
            <p className="text-xs text-slate-400 mt-1">위 영역에 CSV 파일을 업로드해주세요.</p>
          </div>
        ) : (
          // 이력 테이블
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase">파일명</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase">상태</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500 uppercase">행 수</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase">데이터 기간</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase">가져온 일시</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold text-slate-500 uppercase">관리</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => {
                  const badge = STATUS_BADGE[item.status] || STATUS_BADGE.processing;
                  return (
                    <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-slate-400 flex-shrink-0" />
                          <span className="text-slate-700 truncate max-w-[200px]" title={item.file_name}>
                            {item.file_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600">
                        {item.row_count.toLocaleString()}건
                      </td>
                      <td className="py-3 px-3 text-center text-slate-500 text-xs">
                        {item.date_from && item.date_to
                          ? `${item.date_from} ~ ${item.date_to}`
                          : "-"}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-500 text-xs">
                        {new Date(item.created_at).toLocaleString("ko-KR")}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleDelete(item.id, item.file_name)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="데이터 삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PosImport;
