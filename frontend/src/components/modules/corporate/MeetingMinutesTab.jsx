// ============================================================
// MeetingMinutesTab.jsx — 주주총회 의사록 목록 및 관리 탭
// 의사록 목록 조회, 신규 작성, 수정, 삭제, 배당 기반 초안 자동 생성
// 상법 제373조 — 주주총회 의사록 10년 보관 의무
// ============================================================

import { useState, useEffect } from "react";
import { FileText, Plus, Edit, Trash2, RefreshCw, Wand2 } from "lucide-react";
import {
  fetchMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  generateMeetingDraftFromDividend,
} from "../../../api/corporateApi";
import { fetchPartners } from "../../../api/corporateApi";
import MeetingMinutesModal from "./MeetingMinutesModal";

/**
 * 상태 배지 컴포넌트
 * 초안: 회색 / 확정: 초록
 */
const StatusBadge = ({ status }) => {
  const isConfirmed = status === "확정";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        isConfirmed
          ? "bg-green-100 text-green-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {status}
    </span>
  );
};

/**
 * 회의 유형 배지 컴포넌트
 * 정기총회: 파란색 / 임시총회: 노란색
 */
const TypeBadge = ({ type }) => {
  const isRegular = type === "정기총회";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        isRegular
          ? "bg-blue-50 text-blue-600"
          : "bg-amber-50 text-amber-600"
      }`}
    >
      {type}
    </span>
  );
};

/**
 * 날짜 형식을 한국식으로 변환합니다.
 * "2025-12-01" → "2025년 12월 01일"
 */
const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  return `${y}년 ${m}월 ${d}일`;
};

/**
 * MeetingMinutesTab — 의사록 탭 메인 컴포넌트
 *
 * @param {number} year - CorporatePage에서 전달받는 현재 연도 (배당 초안 자동 생성에 사용)
 */
const MeetingMinutesTab = ({ year }) => {
  // 의사록 목록
  const [meetings, setMeetings] = useState([]);
  // 전체 건수
  const [total, setTotal] = useState(0);
  // 로딩 상태
  const [loading, setLoading] = useState(false);
  // 동업자 목록 (참석자 체크박스용)
  const [partners, setPartners] = useState([]);
  // 모달 표시 여부
  const [showModal, setShowModal] = useState(false);
  // 수정 대상 (null이면 신규)
  const [editTarget, setEditTarget] = useState(null);
  // 상세 보기 대상 (의사록 내용 전체 보기)
  const [detailTarget, setDetailTarget] = useState(null);
  // 오류 메시지
  const [error, setError] = useState(null);
  // 초안 자동 생성 중 여부
  const [generatingDraft, setGeneratingDraft] = useState(false);
  // 삭제 확인 대상
  const [deleteTarget, setDeleteTarget] = useState(null);

  // 마운트 시 목록 및 동업자 불러오기
  useEffect(() => {
    loadMeetings();
    loadPartners();
  }, []);

  /**
   * 의사록 목록 불러오기
   */
  const loadMeetings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMeetings({ limit: 100 });
      setMeetings(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError("의사록 목록을 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * 동업자 목록 불러오기 (참석자 체크박스용)
   */
  const loadPartners = async () => {
    try {
      const data = await fetchPartners();
      setPartners(data || []);
    } catch {
      // 동업자 목록 오류는 치명적이지 않으므로 조용히 처리
    }
  };

  /**
   * 의사록 저장 핸들러 (신규/수정 공통)
   * @param {Object} formData - 폼 데이터
   * @param {number|null} meetingId - 수정 시 ID, 신규 시 null
   */
  const handleSave = async (formData, meetingId) => {
    if (meetingId) {
      // 수정
      await updateMeeting(meetingId, formData);
    } else {
      // 신규 등록
      await createMeeting(formData);
    }
    setShowModal(false);
    setEditTarget(null);
    await loadMeetings();
  };

  /**
   * 의사록 삭제 핸들러
   */
  const handleDelete = async (meeting) => {
    try {
      await deleteMeeting(meeting.id);
      setDeleteTarget(null);
      await loadMeetings();
    } catch (err) {
      setError("의사록 삭제에 실패했습니다.");
    }
  };

  /**
   * 배당 기반 의사록 초안 자동 생성 핸들러
   * 현재 선택된 연도 기준으로 배당 결의 의사록 초안을 생성합니다.
   */
  const handleGenerateDraft = async () => {
    if (!window.confirm(
      `${year}년도 배당 결의를 기준으로 주주총회 의사록 초안을 자동 생성합니다.\n` +
      "배당 정산이 먼저 확정되어 있어야 금액이 정확하게 채워집니다.\n\n계속하시겠습니까?"
    )) return;

    try {
      setGeneratingDraft(true);
      setError(null);
      const newMeeting = await generateMeetingDraftFromDividend(year);
      await loadMeetings();
      // 생성된 초안을 상세 보기로 열기
      setDetailTarget(newMeeting);
    } catch (err) {
      setError(err.message || "의사록 초안 자동 생성에 실패했습니다.");
    } finally {
      setGeneratingDraft(false);
    }
  };

  /**
   * 수정 버튼 클릭 핸들러
   */
  const handleEditClick = (meeting, e) => {
    e.stopPropagation(); // 행 클릭 이벤트 방지
    setEditTarget(meeting);
    setShowModal(true);
  };

  /**
   * 삭제 버튼 클릭 핸들러
   */
  const handleDeleteClick = (meeting, e) => {
    e.stopPropagation(); // 행 클릭 이벤트 방지
    setDeleteTarget(meeting);
  };

  /**
   * attendees_json 파싱하여 참석자 요약 문자열을 반환합니다.
   * 예: "동업자A, 동업자B (2/4명)"
   */
  const getAttendeesSummary = (attendeesJson) => {
    if (!attendeesJson) return "-";
    try {
      const list = JSON.parse(attendeesJson);
      const present = list.filter((a) => a.is_present);
      if (present.length === 0) return "전원 불참";
      return `${present.map((a) => a.name).join(", ")} (${present.length}/${list.length}명)`;
    } catch {
      return "-";
    }
  };

  return (
    <div>
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-blue-500" />
          <h2 className="text-base font-semibold text-slate-900">주주총회 의사록</h2>
          <span className="text-xs text-slate-400 font-normal">
            (상법 제373조 — 10년 보관 의무)
          </span>
          {total > 0 && (
            <span className="text-xs text-slate-400">총 {total}건</span>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2">
          {/* 새로고침 */}
          <button
            onClick={loadMeetings}
            disabled={loading}
            className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-md hover:bg-white disabled:opacity-50 transition-colors"
            title="새로고침"
          >
            <RefreshCw size={15} className={`text-slate-500 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* 배당 기반 초안 자동 생성 */}
          <button
            onClick={handleGenerateDraft}
            disabled={generatingDraft || loading}
            className="h-9 px-3 flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 disabled:opacity-50 transition-colors"
            title={`${year}년 배당 결의 기준 의사록 초안 자동 생성`}
          >
            <Wand2 size={14} />
            {generatingDraft ? "생성 중..." : `${year}년 배당 기반 초안 생성`}
          </button>

          {/* 의사록 신규 작성 */}
          <button
            onClick={() => {
              setEditTarget(null);
              setShowModal(true);
            }}
            className="h-9 px-3 flex items-center gap-1.5 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors"
          >
            <Plus size={15} />
            의사록 작성
          </button>
        </div>
      </div>

      {/* 오류 메시지 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* 의사록 목록 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 w-32">개최일</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 w-24">유형</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">의사록 제목</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 w-40">참석자</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 w-16">상태</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 w-20">관리</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                  불러오는 중...
                </td>
              </tr>
            )}

            {!loading && meetings.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <FileText size={32} className="mx-auto mb-2 text-slate-200" />
                  <p className="text-sm text-slate-400">등록된 의사록이 없습니다.</p>
                  <p className="text-xs text-slate-300 mt-1">
                    "+ 의사록 작성" 버튼으로 첫 의사록을 작성하거나,
                    배당 기반 초안 생성 버튼을 이용하세요.
                  </p>
                </td>
              </tr>
            )}

            {!loading && meetings.map((meeting) => (
              <tr
                key={meeting.id}
                onClick={() => setDetailTarget(meeting)}
                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                {/* 개최일 */}
                <td className="px-4 py-3 text-slate-700 text-xs">
                  {formatDate(meeting.meeting_date)}
                </td>

                {/* 회의 유형 배지 */}
                <td className="px-4 py-3">
                  <TypeBadge type={meeting.meeting_type} />
                </td>

                {/* 제목 */}
                <td className="px-4 py-3 text-slate-800 font-medium">
                  {meeting.title}
                  {meeting.location && (
                    <span className="text-xs text-slate-400 font-normal ml-1.5">
                      @ {meeting.location}
                    </span>
                  )}
                </td>

                {/* 참석자 요약 */}
                <td className="px-4 py-3 text-xs text-slate-500">
                  {getAttendeesSummary(meeting.attendees_json)}
                </td>

                {/* 상태 배지 */}
                <td className="px-4 py-3 text-center">
                  <StatusBadge status={meeting.status} />
                </td>

                {/* 관리 버튼 */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={(e) => handleEditClick(meeting, e)}
                      className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-100 transition-colors"
                      title="수정"
                    >
                      <Edit size={14} className="text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(meeting, e)}
                      className="h-7 w-7 flex items-center justify-center rounded hover:bg-red-50 transition-colors"
                      title="삭제"
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── 의사록 상세 보기 모달 ─── */}
      {detailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

            {/* 상세 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-blue-500" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900">{detailTarget.title}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(detailTarget.meeting_date)} · {detailTarget.meeting_type}
                    {detailTarget.location && ` · ${detailTarget.location}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={detailTarget.status} />
                <button
                  onClick={() => setDetailTarget(null)}
                  className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors"
                >
                  <FileText size={14} className="sr-only" />
                  ✕
                </button>
              </div>
            </div>

            {/* 상세 본문 */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* 참석자 */}
              {detailTarget.attendees_json && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    참석자
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      try {
                        return JSON.parse(detailTarget.attendees_json).map((a) => (
                          <span
                            key={a.partner_id}
                            className={`px-2 py-0.5 rounded text-xs ${
                              a.is_present
                                ? "bg-blue-50 text-blue-700"
                                : "bg-slate-100 text-slate-400 line-through"
                            }`}
                          >
                            {a.name} ({a.equity}%)
                          </span>
                        ));
                      } catch {
                        return <span className="text-xs text-slate-400">-</span>;
                      }
                    })()}
                  </div>
                </div>
              )}

              {/* 안건 목록 */}
              {detailTarget.agenda && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    안건
                  </h3>
                  <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                      {detailTarget.agenda}
                    </pre>
                  </div>
                </div>
              )}

              {/* 결의 사항 */}
              {detailTarget.resolution && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    결의 사항
                  </h3>
                  <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                      {detailTarget.resolution}
                    </pre>
                  </div>
                </div>
              )}

              {/* 작성자 */}
              {detailTarget.created_by && (
                <p className="text-xs text-slate-400">
                  작성자: {detailTarget.created_by}
                </p>
              )}
            </div>

            {/* 상세 푸터 */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 flex-shrink-0">
              <button
                onClick={() => {
                  setEditTarget(detailTarget);
                  setDetailTarget(null);
                  setShowModal(true);
                }}
                className="h-9 px-4 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 flex items-center gap-1.5 transition-colors"
              >
                <Edit size={14} />
                수정
              </button>
              <button
                onClick={() => setDetailTarget(null)}
                className="h-9 px-4 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 삭제 확인 모달 ─── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-2">의사록 삭제</h3>
            <p className="text-sm text-slate-600 mb-1">
              아래 의사록을 삭제하시겠습니까?
            </p>
            <p className="text-sm font-medium text-slate-800 mb-1">
              {deleteTarget.title}
            </p>
            <p className="text-xs text-slate-400 mb-4">
              소프트 삭제 방식으로 처리됩니다 (상법 제373조 보관 의무).
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="h-9 px-4 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="h-9 px-4 text-sm text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 의사록 작성/수정 모달 ─── */}
      <MeetingMinutesModal
        isOpen={showModal}
        meeting={editTarget}
        partners={partners}
        onSave={handleSave}
        onClose={() => {
          setShowModal(false);
          setEditTarget(null);
        }}
      />
    </div>
  );
};

export default MeetingMinutesTab;
