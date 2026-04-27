// ============================================================
// ClockWidget.jsx — 출퇴근 체크 버튼 위젯
// 헤더(모바일 컴팩트 모드)와 사이드바(데스크탑 풀 모드)에서 사용합니다.
// 직원 미연결(employee_id 없음) 시 숨김 처리합니다.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { LogIn, LogOut, Clock } from "lucide-react";
import { fetchTodayAttendanceStatus, clockIn, clockOut } from "../../api/employeeApi";

/**
 * 출퇴근 버튼 위젯.
 * @param {boolean} compact - true면 모바일 헤더용 컴팩트 모드
 */
const ClockWidget = ({ compact = false }) => {
  // 오늘 출퇴근 상태
  const [status, setStatus] = useState(null);
  // 처리 중 로딩 상태
  const [loading, setLoading] = useState(false);
  // 오류 메시지
  const [error, setError] = useState(null);

  /**
   * 오늘 출퇴근 상태를 서버에서 불러옵니다.
   */
  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchTodayAttendanceStatus();
      setStatus(data);
      setError(null);
    } catch {
      setStatus({ linked: false });
    }
  }, []);

  // 마운트 시 상태 조회
  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  /**
   * 출근 처리
   */
  const handleClockIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await clockIn();
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 퇴근 처리
   */
  const handleClockOut = async () => {
    setLoading(true);
    setError(null);
    try {
      await clockOut();
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 상태 로딩 중이거나 직원 미연결이면 숨김
  if (!status || !status.linked) return null;

  // ── 출퇴근 완료 상태 ─────────────────────────────
  if (status.clocked_in && status.clocked_out) {
    if (compact) {
      return (
        <div className="flex items-center gap-1 text-green-400 text-xs font-medium">
          <Clock size={12} />
          <span>{status.clock_in}~{status.clock_out}</span>
        </div>
      );
    }
    return (
      <div className="px-5 py-3 border-b border-slate-700">
        <p className="text-slate-400 text-xs mb-0.5">오늘 근무 완료</p>
        <p className="text-green-400 text-sm font-semibold">
          {status.clock_in} ~ {status.clock_out}
        </p>
      </div>
    );
  }

  // ── 출근 완료, 퇴근 미처리 ───────────────────────
  if (status.clocked_in && !status.clocked_out) {
    if (compact) {
      return (
        <button
          onClick={handleClockOut}
          disabled={loading}
          className="flex items-center gap-1 text-xs bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          <LogOut size={12} />
          퇴근
        </button>
      );
    }
    return (
      <div className="px-5 py-3 border-b border-slate-700">
        <p className="text-slate-400 text-xs mb-1.5">출근 {status.clock_in}</p>
        {error && <p className="text-red-400 text-xs mb-1">{error}</p>}
        <button
          onClick={handleClockOut}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 h-8 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
        >
          <LogOut size={14} />
          {loading ? "처리 중..." : "퇴근"}
        </button>
      </div>
    );
  }

  // ── 출근 미처리 ──────────────────────────────────
  if (compact) {
    return (
      <button
        onClick={handleClockIn}
        disabled={loading}
        className="flex items-center gap-1 text-xs bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        <LogIn size={12} />
        출근
      </button>
    );
  }
  return (
    <div className="px-5 py-3 border-b border-slate-700">
      {error && <p className="text-red-400 text-xs mb-1">{error}</p>}
      <button
        onClick={handleClockIn}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 h-8 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-50"
      >
        <LogIn size={14} />
        {loading ? "처리 중..." : "출근"}
      </button>
    </div>
  );
};

export default ClockWidget;
