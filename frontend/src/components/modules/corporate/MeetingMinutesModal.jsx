// ============================================================
// MeetingMinutesModal.jsx — 주주총회 의사록 작성/수정 모달
// 개최일, 회의 유형, 제목, 장소, 참석자, 안건, 결의 사항, 상태를 입력합니다.
// 상법 제373조 — 주주총회 의사록 10년 보관 의무
// ============================================================

import { useState, useEffect } from "react";
import { X, Save, FileText } from "lucide-react";

// 회의 유형 선택지
const MEETING_TYPES = ["정기총회", "임시총회"];

// 의사록 상태 선택지
const MEETING_STATUSES = ["초안", "확정"];

// 빈 폼 초기값
const EMPTY_FORM = {
  meeting_date: new Date().toISOString().slice(0, 10),
  meeting_type: "정기총회",
  title: "",
  location: "여남동 사무실",
  agenda: "",
  resolution: "",
  status: "초안",
  created_by: "",
};

/**
 * 주주총회 의사록 작성/수정 모달
 *
 * @param {boolean}   isOpen      - 모달 표시 여부
 * @param {Object}    meeting     - 수정 대상 의사록 (null이면 신규)
 * @param {Array}     partners    - 동업자 목록 (참석자 체크박스용)
 * @param {Function}  onSave      - 저장 콜백 (formData, meetingId) => Promise
 * @param {Function}  onClose     - 닫기 콜백
 */
const MeetingMinutesModal = ({ isOpen, meeting, partners = [], onSave, onClose }) => {
  // 폼 입력값
  const [form, setForm] = useState(EMPTY_FORM);
  // 참석자 체크박스 상태 (partner_id → is_present)
  const [attendanceMap, setAttendanceMap] = useState({});
  // 저장 중 여부
  const [saving, setSaving] = useState(false);
  // 폼 오류 메시지
  const [formError, setFormError] = useState(null);

  // 모달이 열릴 때 폼 초기화
  useEffect(() => {
    if (!isOpen) return;

    if (meeting) {
      // 수정 모드: 기존 데이터로 폼 채우기
      setForm({
        meeting_date: meeting.meeting_date || new Date().toISOString().slice(0, 10),
        meeting_type: meeting.meeting_type || "정기총회",
        title: meeting.title || "",
        location: meeting.location || "",
        agenda: meeting.agenda || "",
        resolution: meeting.resolution || "",
        status: meeting.status || "초안",
        created_by: meeting.created_by || "",
      });

      // 참석자 JSON 파싱
      const parsedAttendees = parseAttendeesJson(meeting.attendees_json);
      initAttendanceMap(parsedAttendees);
    } else {
      // 신규 모드: 빈 폼으로 초기화
      setForm(EMPTY_FORM);
      // 동업자 전원 참석 상태로 초기화
      const initialMap = {};
      partners.forEach((p) => {
        initialMap[p.id] = true;
      });
      setAttendanceMap(initialMap);
    }

    setFormError(null);
  }, [isOpen, meeting, partners]);

  /**
   * attendees_json 문자열을 파싱하여 반환합니다.
   * 파싱 실패 시 빈 배열 반환.
   */
  const parseAttendeesJson = (jsonStr) => {
    if (!jsonStr) return [];
    try {
      return JSON.parse(jsonStr);
    } catch {
      return [];
    }
  };

  /**
   * 파싱된 참석자 배열로 attendanceMap을 초기화합니다.
   * DB에 저장된 참석자 정보를 기준으로 체크박스 상태를 설정합니다.
   */
  const initAttendanceMap = (parsedAttendees) => {
    const map = {};

    // 현재 동업자 목록을 기준으로 초기화 (삭제된 동업자 반영)
    partners.forEach((p) => {
      // DB에 저장된 참석자 정보에서 해당 partner_id 찾기
      const saved = parsedAttendees.find((a) => a.partner_id === p.id);
      map[p.id] = saved ? saved.is_present : true;
    });

    // DB에만 있고 현재 파트너 목록에 없는 경우 (탈퇴 동업자) 무시
    setAttendanceMap(map);
  };

  /**
   * 폼 필드 변경 핸들러
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormError(null);
  };

  /**
   * 참석자 체크박스 토글 핸들러
   */
  const handleAttendanceToggle = (partnerId) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [partnerId]: !prev[partnerId],
    }));
  };

  /**
   * 저장 핸들러
   * 유효성 검사 → attendees_json 직렬화 → 상위 컴포넌트에 전달
   */
  const handleSave = async () => {
    // 필수 입력값 검증
    if (!form.title.trim()) {
      setFormError("의사록 제목을 입력해주세요.");
      return;
    }
    if (!form.meeting_date) {
      setFormError("개최일을 입력해주세요.");
      return;
    }

    // 참석자 정보를 JSON 문자열로 직렬화
    const attendeesArray = partners.map((p) => ({
      partner_id: p.id,
      name: p.name,
      equity: p.equity_ratio,
      is_present: attendanceMap[p.id] ?? true,
    }));

    const payload = {
      ...form,
      title: form.title.trim(),
      location: form.location.trim() || null,
      agenda: form.agenda.trim() || null,
      resolution: form.resolution.trim() || null,
      created_by: form.created_by.trim() || null,
      attendees_json: JSON.stringify(attendeesArray),
    };

    try {
      setSaving(true);
      await onSave(payload, meeting?.id ?? null);
    } catch (err) {
      setFormError(err.message || "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // 모달이 닫혀 있으면 렌더링하지 않음
  if (!isOpen) return null;

  // 참석 동업자 수 계산
  const presentCount = Object.values(attendanceMap).filter(Boolean).length;
  const totalCount = partners.length;
  // 의결권 충족 여부 (상법 제368조: 과반수 출석 + 출석 과반수 의결)
  const quorumMet = presentCount > totalCount / 2;

  return (
    // 모달 오버레이
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      {/* 모달 컨테이너 */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-blue-500" />
            <h2 className="text-base font-semibold text-slate-900">
              {meeting ? "의사록 수정" : "의사록 작성"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors"
            title="닫기"
          >
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* 모달 본문 (스크롤 가능) */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* 기본 정보 섹션 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 개최일 */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                개최일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="meeting_date"
                value={form.meeting_date}
                onChange={handleChange}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 회의 유형 */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                회의 유형 <span className="text-red-500">*</span>
              </label>
              <select
                name="meeting_type"
                value={form.meeting_type}
                onChange={handleChange}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {MEETING_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 의사록 제목 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              의사록 제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="예: 2025년도 정기주주총회 의사록"
              maxLength={200}
              className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 개최 장소 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              개최 장소
            </label>
            <input
              type="text"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="예: 여남동 사무실"
              maxLength={200}
              className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 참석자 체크박스 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-600">
                참석자
              </label>
              <span className={`text-xs font-medium ${quorumMet ? "text-green-600" : "text-amber-500"}`}>
                {presentCount}/{totalCount}명 참석
                {quorumMet ? " (의결 정족수 충족)" : " (의결 정족수 미달)"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-md border border-slate-200">
              {partners.length === 0 && (
                <p className="text-xs text-slate-400">등록된 동업자가 없습니다.</p>
              )}
              {partners.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-1.5 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={attendanceMap[p.id] ?? true}
                    onChange={() => handleAttendanceToggle(p.id)}
                    className="w-4 h-4 accent-blue-500"
                  />
                  <span className="text-sm text-slate-700">
                    {p.name}
                    <span className="text-xs text-slate-400 ml-1">({p.equity_ratio}%)</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 안건 목록 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              안건 목록
              <span className="text-slate-400 font-normal ml-1">(줄바꿈으로 구분)</span>
            </label>
            <textarea
              name="agenda"
              value={form.agenda}
              onChange={handleChange}
              placeholder={"제1호 의안: 재무제표 승인의 건\n제2호 의안: 배당금 지급 결의의 건"}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* 결의 사항 */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              결의 사항
            </label>
            <textarea
              name="resolution"
              value={form.resolution}
              onChange={handleChange}
              placeholder="위 안건은 출석 주주 전원의 찬성으로 원안대로 가결되었다."
              rows={5}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* 하단 섹션: 상태 + 작성자 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 상태 선택 */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                상태
              </label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {MEETING_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* 작성자 */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                작성자
              </label>
              <input
                type="text"
                name="created_by"
                value={form.created_by}
                onChange={handleChange}
                placeholder="예: 김대표"
                maxLength={50}
                className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* 오류 메시지 */}
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{formError}</p>
            </div>
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-200 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="h-9 px-4 text-sm text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-4 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
          >
            <Save size={14} />
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MeetingMinutesModal;
