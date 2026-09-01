import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { QuizQuestion, RoomState } from '../types';

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
  const [studentId, setStudentId] = useState<string>('');
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<{ isCorrect: boolean; explanation: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());

  // Fetch Room status periodically
  const fetchRoomState = async (roomPin: string) => {
    try {
      const res = await fetch(`/api/rooms/${roomPin}`);
      if (res.ok) {
        const data = await res.json();
        setRoomState(data);
      }
    } catch (e) {
      console.warn('Fetch room error', e);
    }
  };

  useEffect(() => {
    if (isJoined && pin) {
      fetchRoomState(pin);
      const interval = setInterval(() => fetchRoomState(pin), 2000);
      return () => clearInterval(interval);
    }
  }, [isJoined, pin]);

  // Reset selected option when question index changes
  const activeQIndex = roomState?.activeQuestionIndex || 0;
  const currentQ: QuizQuestion | undefined = roomState?.questions?.[activeQIndex];

  useEffect(() => {
    if (currentQ) {
      setSelectedOption(null);
      setIsSubmitted(false);
      setSubmissionResult(null);
      setStartTime(Date.now());
    }
  }, [activeQIndex, currentQ?.id]);

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
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsJoined(true);
        setRoomState(data.room);
      } else {
        setErrorMsg(data.error || 'Không thể tham gia phòng.');
      }
    } catch (e) {
      setErrorMsg('Lỗi kết nối máy chủ lớp học.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAnswer = async (optKey: string) => {
    if (!currentQ || isSubmitted) return;
    setSelectedOption(optKey);

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

      const data = await res.json();
      if (res.ok) {
        setIsSubmitted(true);
        setSubmissionResult({
          isCorrect: data.isCorrect,
          explanation: data.explanation,
        });
      }
    } catch (e) {
      console.error('Submit error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 text-slate-800">
        <div className="w-full max-w-md p-8 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 mb-4">
              <Users className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-black text-slate-900">Lớp Học Trực Tuyến</h1>
            <p className="text-slate-500 text-sm">
              Nhập mã PIN hiển thị trên màn hình Tivi 75 inch để tham gia làm bài trắc nghiệm
            </p>
          </div>

          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                MÃ PIN PHÒNG HỌC
              </label>
              <input
                type="text"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Ví dụ: 758899"
                className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-300 text-center font-mono text-2xl font-black text-emerald-600 tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                HỌ VÀ TÊN HỌC SINH
              </label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Ví dụ: Nguyễn Minh Tuấn"
                className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <span>Vào Làm Bài Ngay</span>
              )}
            </button>
          </form>

          {onExitStudentMode && (
            <div className="pt-4 border-t border-slate-200 text-center">
              <button
                onClick={onExitStudentMode}
                className="text-xs text-slate-500 hover:text-indigo-600 underline font-semibold transition-colors"
              >
                ← Quay lại Màn hình Tivi Giáo Viên (75 inch)
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col p-4 md:p-6 text-slate-800">
      {/* Top Mobile Bar */}
      <div className="w-full max-w-lg mx-auto flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 font-bold shadow-xs">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="font-black text-slate-900 text-base leading-tight">{studentName}</div>
            <div className="text-xs text-emerald-600 font-mono font-bold">PIN: {pin}</div>
          </div>
        </div>

        {onExitStudentMode && (
          <button
            onClick={onExitStudentMode}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Màn hình chính</span>
          </button>
        )}
      </div>

      {/* Main Student Question Content */}
      <div className="w-full max-w-lg mx-auto flex-1 flex flex-col justify-between space-y-6">
        {!currentQ ? (
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-md text-center space-y-3">
            <Clock className="w-12 h-12 text-amber-500 mx-auto animate-pulse" />
            <h3 className="text-xl font-bold text-slate-900">Đang Chờ Giáo Viên Mở Câu Hỏi</h3>
            <p className="text-slate-500 text-sm">
              Hãy chú ý quan sát màn hình Tivi 75 inch phía trên bục giảng!
            </p>
          </div>
        ) : (
          <>
            {/* Question Card */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-md space-y-3">
              <div className="text-xs uppercase font-extrabold tracking-widest text-indigo-600">
                CÂU HỎI {activeQIndex + 1}/{roomState?.questions.length || 1}
              </div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-snug">
                {currentQ.question}
              </h2>
            </div>

            {/* 4 Huge Tap Buttons (A, B, C, D) */}
            <div className="grid grid-cols-1 gap-3.5">
              {currentQ.options.map((opt) => {
                const isSelected = selectedOption === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => handleSubmitAnswer(opt.key)}
                    disabled={isSubmitted || isLoading}
                    className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 text-left active:scale-95 shadow-xs ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-[1.02]'
                        : isSubmitted
                        ? 'bg-slate-100 border-slate-200 opacity-60 text-slate-400'
                        : 'bg-white border-slate-200 text-slate-800 hover:border-indigo-500 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xl shrink-0 ${
                        isSelected
                          ? 'bg-white text-indigo-950'
                          : 'bg-slate-100 text-indigo-600 border border-slate-200'
                      }`}
                    >
                      {opt.key}
                    </div>
                    <div className="font-bold text-base md:text-lg flex-1">
                      {opt.text}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Submission Status & Feedback */}
            {isSubmitted && (
              <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-center space-y-2 shadow-sm">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="font-black text-lg text-emerald-950">ĐÃ NỘP BÀI THÀNH CÔNG!</div>
                <div className="text-xs text-emerald-700 font-medium">
                  Bạn đã chọn phương án <span className="font-bold font-mono text-base">{selectedOption}</span>. Hãy nhìn lên màn hình Tivi để xem kết quả toàn lớp!
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
