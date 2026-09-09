import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Users,
  Award,
  Sparkles,
  RefreshCw,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Maximize2,
  AlertTriangle,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { QuizQuestion, RoomState } from '../types';
import { QuizRichContentRenderer } from './QuizRichContentRenderer';
import { MathFormulaRenderer } from './MathFormulaRenderer';

interface StudentMobilePortalProps {
  initialPin?: string;
  onExitStudentMode?: () => void;
}

export const StudentMobilePortal: React.FC<StudentMobilePortalProps> = ({
  initialPin = '758899',
  onExitStudentMode,
}) => {
  const [pin, setPin] = useState<string>(initialPin);
  const [studentName, setStudentName] = useState<string>('');
  const [studentCode, setStudentCode] = useState<string>('');
  const [studentId, setStudentId] = useState<string>('');
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [currentExamIndex, setCurrentExamIndex] = useState<number>(0);
  const [answersMap, setAnswersMap] = useState<Record<string, string>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());

  // Screen Lock & Anti-Cheat State
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [warningCount, setWarningCount] = useState<number>(0);
  const [showViolationModal, setShowViolationModal] = useState<boolean>(false);
  const [violationMsg, setViolationMsg] = useState<string>('');
  const [overallTimeLeft, setOverallTimeLeft] = useState<number | null>(null);
  const isViolatingRef = useRef<boolean>(false);

  // Fetch Room status periodically
  const fetchRoomState = async (roomPin: string) => {
    try {
      const res = await fetch(`/api/rooms/${roomPin}`);
      if (res.ok) {
        const data: RoomState = await res.json();
        setRoomState(data);
      }
    } catch (e) {
      console.warn('Fetch room error', e);
    }
  };

  useEffect(() => {
    if (isJoined && pin) {
      fetchRoomState(pin);
      const interval = setInterval(() => fetchRoomState(pin), 1800);
      return () => clearInterval(interval);
    }
  }, [isJoined, pin]);

  // Overall Exam Countdown Timer
  useEffect(() => {
    if (!roomState?.examSettings?.endsAtTimestamp || !roomState?.examSettings?.isExamMode) {
      setOverallTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((roomState.examSettings!.endsAtTimestamp! - now) / 1000));
      setOverallTimeLeft(diff);
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [roomState?.examSettings?.endsAtTimestamp, roomState?.examSettings?.isExamMode]);

  // Screen Lock & Anti-Cheat Handlers (Fullscreen & Visibility Change)
  const reportStatus = async (locked: boolean, violationType?: string) => {
    if (!pin || !studentId) return;
    try {
      await fetch(`/api/rooms/${pin}/student-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          isFocusLocked: locked,
          violationType,
        }),
      });
    } catch (e) {
      console.warn('Failed to report status', e);
    }
  };

  const triggerViolation = (reason: string) => {
    if (!roomState?.examSettings?.isScreenLocked) return;
    if (isViolatingRef.current) return;
    isViolatingRef.current = true;

    setWarningCount((prev) => {
      const next = prev + 1;
      setViolationMsg(`Phát hiện rời khỏi giao diện bài thi (${reason}). Lần vi phạm thứ ${next}!`);
      setShowViolationModal(true);
      reportStatus(false, reason);
      return next;
    });

    setTimeout(() => {
      isViolatingRef.current = false;
    }, 1500);
  };

  const requestEnterFullscreen = () => {
    try {
      const docEl = document.documentElement as any;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      }
    } catch (e) {
      console.warn('Fullscreen request failed', e);
    }
  };

  useEffect(() => {
    if (!isJoined || !roomState?.examSettings?.isScreenLocked) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation('Chuyển tab hoặc ẩn trình duyệt');
      } else {
        reportStatus(true);
      }
    };

    const handleBlur = () => {
      triggerViolation('Rời khỏi cửa sổ bài thi');
    };

    const handleFullscreenChange = () => {
      const isFull = Boolean(document.fullscreenElement);
      setIsFullscreen(isFull);
      if (!isFull) {
        triggerViolation('Thoát chế độ toàn màn hình');
      } else {
        reportStatus(true);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent devtools / copy shortcuts
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === 'c' || e.key === 'v' || e.key === 'u' || e.key === 'a')
      ) {
        e.preventDefault();
      }
      if (e.key === 'F12') {
        e.preventDefault();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isJoined, roomState?.examSettings?.isScreenLocked]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || !studentName.trim()) return;

    try {
      setIsLoading(true);
      setErrorMsg(null);

      const sId = 'std_' + Math.random().toString(36).substring(2, 9);
      setStudentId(sId);

      const res = await fetch(`/api/rooms/${pin.trim()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentName.trim(),
          studentId: sId,
          studentCode: studentCode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsJoined(true);
        setRoomState(data.room);
        // Prompt fullscreen if exam mode
        if (data.room?.examSettings?.isScreenLocked) {
          requestEnterFullscreen();
        }
      } else {
        setErrorMsg(data.error || 'Không thể tham gia phòng thi. Vui lòng kiểm tra mã PIN.');
      }
    } catch (e) {
      setErrorMsg('Lỗi kết nối máy chủ lớp học.');
    } finally {
      setIsLoading(false);
    }
  };

  const isExamMode = Boolean(roomState?.examSettings?.isExamMode);
  const questions = roomState?.questions || [];
  const activeQIndex = isExamMode ? currentExamIndex : (roomState?.activeQuestionIndex || 0);
  const currentQ: QuizQuestion | undefined = questions[activeQIndex];
  const selectedOption = currentQ ? (answersMap[currentQ.id] || null) : null;
  const isCurrentSubmitted = currentQ ? Boolean(submittedQuestions[currentQ.id]) : false;

  const handleSubmitAnswer = async (optKey: string) => {
    if (!currentQ) return;
    setAnswersMap((prev) => ({ ...prev, [currentQ.id]: optKey }));

    const timeSpent = Math.max(1, Math.round((Date.now() - startTime) / 1000));

    try {
      setIsLoading(true);
      const res = await fetch(`/api/rooms/${pin}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQ.id,
          studentId,
          studentName,
          selectedOption: optKey,
          timeSpentSeconds: timeSpent,
        }),
      });

      if (res.ok) {
        setSubmittedQuestions((prev) => ({ ...prev, [currentQ.id]: true }));
      }
    } catch (e) {
      console.error('Submit error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Format Overall Timer
  const formatTime = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hours > 0) {
      return `${hours}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // View 1: Join with Room PIN
  if (!isJoined) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-slate-100">
        <div className="w-full max-w-md p-8 rounded-3xl bg-slate-800 border border-slate-700 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 mb-3">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Cổng Phòng Thi Trực Tuyến</h1>
            <p className="text-slate-400 text-sm">
              Nhập mã PIN xác thực phòng thi và thông tin học sinh để vào làm bài
            </p>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-600/50 text-rose-300 text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center justify-between">
                <span>MÃ PIN PHÒNG THI</span>
                <span className="text-[11px] text-emerald-400 font-medium">Bắt buộc</span>
              </label>
              <input
                type="text"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value.trim())}
                placeholder="Ví dụ: 758899"
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-900 border-2 border-emerald-500/60 text-center font-mono text-3xl font-black text-emerald-400 tracking-widest focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/20 shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                HỌ VÀ TÊN HỌC SINH
              </label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Ví dụ: Nguyễn Minh Tuấn"
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-700 text-white font-bold text-base focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5 flex items-center justify-between">
                <span>SỐ BÁO DANH / MÃ HỌC SINH</span>
                <span className="text-[11px] text-slate-500">Tùy chọn</span>
              </label>
              <input
                type="text"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                placeholder="Ví dụ: HS1204 / SBD-08"
                className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-slate-200 font-mono text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-lg shadow-lg shadow-emerald-900/40 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              {isLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>XÁC THỰC VÀO PHÒNG THI</span>
                </>
              )}
            </button>
          </form>

          {onExitStudentMode && (
            <div className="pt-4 border-t border-slate-700/60 text-center">
              <button
                onClick={onExitStudentMode}
                className="text-xs text-slate-400 hover:text-white underline font-semibold transition-colors"
              >
                ← Quay lại Màn hình Tivi Bảng Đen (75 inch)
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Emergency Teacher Lock Overlay
  const isTeacherLocked = Boolean(roomState?.examSettings?.isTeacherLocked);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col p-3 md:p-6 text-slate-100 select-none">
      {/* Teacher Lock Modal */}
      {isTeacherLocked && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-400 mb-6 animate-pulse">
            <Lock className="w-10 h-10" />
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-2">
            GIÁO VIÊN ĐÃ KHÓA MÀN HÌNH BÀI THI
          </h2>
          <p className="text-slate-300 text-base max-w-md">
            Màn hình thiết bị đang bị tạm dừng bởi giám thị. Hãy đặt thiết bị xuống bàn và chú ý lắng nghe hiệu lệnh của giáo viên!
          </p>
        </div>
      )}

      {/* Violation Alert Modal */}
      {showViolationModal && (
        <div className="fixed inset-0 z-50 bg-rose-950/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border-2 border-rose-500 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500 flex items-center justify-center text-rose-400 mb-4">
              <ShieldAlert className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-xl font-black text-rose-400 mb-2">CẢNH BÁO VI PHẠM PHÒNG THI!</h3>
            <p className="text-slate-200 text-sm mb-4 leading-relaxed">{violationMsg}</p>
            <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-amber-300 mb-6">
              Hệ thống đã tự động gửi báo cáo vi phạm tới màn hình Tivi 75 inch của giám thị. Vi phạm quá nhiều lần bài thi sẽ bị hủy kết quả!
            </div>
            <button
              onClick={() => {
                setShowViolationModal(false);
                requestEnterFullscreen();
              }}
              className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-base cursor-pointer"
            >
              Tôi Đã Hiểu - Quay Lại Bài Thi Ngay
            </button>
          </div>
        </div>
      )}

      {/* Top Mobile Bar */}
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 font-bold shadow-xs">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="font-black text-white text-base leading-tight flex items-center gap-2">
              <span>{studentName}</span>
              {studentCode && (
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-indigo-300 text-xs font-mono font-bold">
                  {studentCode}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 font-mono">
              PIN: <span className="text-emerald-400 font-black">{pin}</span>
            </div>
          </div>
        </div>

        {/* Real-time Overall Exam Timer & Screen Lock Status */}
        <div className="flex items-center gap-2">
          {overallTimeLeft !== null && (
            <div
              className={`px-3 py-1.5 rounded-xl font-mono font-black text-sm flex items-center gap-1.5 border ${
                overallTimeLeft <= 300
                  ? 'bg-rose-950/80 border-rose-500 text-rose-400 animate-pulse'
                  : 'bg-slate-800 border-slate-700 text-emerald-400'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{formatTime(overallTimeLeft)}</span>
            </div>
          )}

          {/* Screen Lock / Fullscreen Status Indicator */}
          {roomState?.examSettings?.isScreenLocked && (
            <button
              onClick={requestEnterFullscreen}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border transition-all ${
                isFullscreen
                  ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300'
                  : 'bg-amber-950/80 border-amber-500 text-amber-300 animate-pulse'
              }`}
              title={isFullscreen ? 'Màn hình đang khóa an toàn' : 'Bấm để bật lại toàn màn hình'}
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isFullscreen ? 'Đã khóa' : 'Bật khóa'}</span>
            </button>
          )}

          {onExitStudentMode && (
            <button
              onClick={onExitStudentMode}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Quay lại màn hình Tivi"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Exam Mode Question Navigator Bar (1, 2, 3, 4...) */}
      {isExamMode && questions.length > 0 && (
        <div className="w-full max-w-2xl mx-auto mb-4 p-2.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <span className="text-xs font-bold text-slate-400 uppercase pl-1 shrink-0">Câu:</span>
          {questions.map((q, idx) => {
            const isAnswered = Boolean(answersMap[q.id]);
            const isCurrent = idx === activeQIndex;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentExamIndex(idx)}
                className={`w-8 h-8 rounded-xl font-mono text-xs font-black shrink-0 transition-all ${
                  isCurrent
                    ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-md scale-105'
                    : isAnswered
                    ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-600'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Student Question Content */}
      <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col justify-between space-y-4">
        {!currentQ ? (
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
            <Clock className="w-12 h-12 text-amber-500 mx-auto animate-pulse" />
            <h3 className="text-xl font-bold text-white">Đang Chờ Giám Thị Phát Đề</h3>
            <p className="text-slate-400 text-sm">
              Đề thi sẽ tự động xuất hiện trên màn hình khi giáo viên bắt đầu tính giờ làm bài!
            </p>
          </div>
        ) : (
          <>
            {/* Question Card */}
            <div className="p-5 md:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg space-y-3">
              <div className="flex items-center justify-between text-xs uppercase font-extrabold tracking-widest text-indigo-400">
                <span>CÂU HỎI {activeQIndex + 1}/{questions.length}</span>
                {currentQ.difficulty && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium">
                    {currentQ.difficulty}
                  </span>
                )}
              </div>
              <div className="text-lg md:text-xl font-bold text-white leading-relaxed">
                <QuizRichContentRenderer
                  content={currentQ.question}
                  diagramType={currentQ.diagramType}
                  diagramData={currentQ.diagramData}
                />
              </div>
            </div>

            {/* 4 Large Options (A, B, C, D) */}
            <div className="grid grid-cols-1 gap-3">
              {currentQ.options.map((opt) => {
                const isSelected = selectedOption === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => handleSubmitAnswer(opt.key)}
                    disabled={isLoading || overallTimeLeft === 0}
                    className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-left active:scale-98 shadow-xs cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30'
                        : 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-850'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl shrink-0 ${
                        isSelected
                          ? 'bg-white text-indigo-950'
                          : 'bg-slate-800 text-indigo-400 border border-slate-700'
                      }`}
                    >
                      {opt.key}
                    </div>
                    <div className="font-bold text-base md:text-lg flex-1">
                      <MathFormulaRenderer content={opt.text} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Question Navigation Controls in Exam Mode */}
            {isExamMode && questions.length > 1 && (
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setCurrentExamIndex((prev) => Math.max(0, prev - 1))}
                  disabled={activeQIndex === 0}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-sm font-bold flex items-center gap-1 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Câu trước</span>
                </button>

                <div className="text-xs text-slate-400 font-bold">
                  Đã chọn: <span className="text-emerald-400 font-black">{Object.keys(answersMap).length}/{questions.length}</span> câu
                </div>

                <button
                  onClick={() => setCurrentExamIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  disabled={activeQIndex >= questions.length - 1}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center gap-1 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <span>Câu tiếp</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Time Expired Notice */}
            {overallTimeLeft === 0 && (
              <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-500 text-rose-300 text-center font-bold text-sm">
                Đã hết thời gian làm bài thi! Bài làm của bạn đã được hệ thống tự động ghi nhận và nộp về cho giám thị.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

