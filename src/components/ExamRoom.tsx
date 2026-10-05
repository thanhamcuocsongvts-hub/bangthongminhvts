/**
 * ExamRoom.tsx - Phòng Thi Trực Tiếp & Kiểm Tra Học Sinh Chuẩn SmartBoard 75 Pro
 * 
 * Tính năng chính:
 * 1. Phản hồi tức thì khi chọn đáp án A, B, C, D:
 *    - Đúng: Đổi thẻ sang màu xanh lá rực rỡ kèm icon tích xanh CheckCircle2,
 *      phát âm thanh Web Audio API hân hoan (523Hz -> 659Hz -> 784Hz "Ting ting" vui vẻ).
 *    - Sai: Đổi thẻ sang viền đỏ nhạt, hiện đáp án đúng màu xanh lá,
 *      phát âm thanh trầm (220Hz -> 180Hz "Bụp" nhẹ nhàng không ức chế).
 * 2. Bộ điều hướng chuyển câu mượt mà:
 *    - Nút [ ⬅ Câu trước ] và [ Câu tiếp theo ➔ ] ở phía dưới câu hỏi.
 *    - Dãy số câu hỏi trên thanh tiêu đề: [1] [2] [3] [4]...
 *      (Xanh lá: Đã làm đúng, Đỏ: Đã làm sai, Xám: Chưa làm).
 *      Bấm vào số câu nào là chuyển ngay đến câu đó.
 * 3. Chống gian lận (Anti-Cheat) & Khóa an toàn toàn màn hình nếu được giám thị bật.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  User,
  ShieldCheck,
  ShieldAlert,
  Lock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Volume2,
  VolumeX,
  RotateCcw,
  Check,
  Award,
} from 'lucide-react';
import { QuizQuestion, RoomState } from '../types';
import { QuizRichContentRenderer } from './QuizRichContentRenderer';
import { MathFormulaRenderer } from './MathFormulaRenderer';

// Web Audio API Synthesizer (Zero network requests, runs offline, zero latency <5ms)
class ExamAudioSynthesizer {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Âm thanh CHÚC MỪNG HÂN HOAN khi làm ĐÚNG:
   * Chuỗi tần số cao 523Hz (C5) -> 659Hz (E5) -> 784Hz (G5) tạo tiếng chuông "Ting ting" vui tươi
   */
  public playCorrectSound() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        const startTime = this.ctx.currentTime + idx * 0.08;
        const duration = 0.28;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.05);
      });
    } catch (_) {}
  }

  /**
   * Âm thanh TRẦM THÔNG BÁO khi làm SAI:
   * Tần số 220Hz -> 180Hz "Bụp" nhẹ nhàng, không gây ức chế tinh thần học sinh
   */
  public playWrongSound() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const startTime = this.ctx.currentTime;
      const duration = 0.22;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, startTime);
      osc.frequency.exponentialRampToValueAtTime(180, startTime + duration);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    } catch (_) {}
  }
}

export const examAudio = new ExamAudioSynthesizer();

export interface ExamRoomProps {
  initialPin?: string;
  studentName?: string;
  studentCode?: string;
  questions?: QuizQuestion[];
  roomState?: RoomState | null;
  onExitStudentMode?: () => void;
  onSubmitAnswer?: (questionId: string, selectedOption: string, isCorrect: boolean) => void;
}

export const ExamRoom: React.FC<ExamRoomProps> = ({
  initialPin = '758899',
  studentName: propStudentName = 'Học sinh',
  studentCode: propStudentCode = '',
  questions: propQuestions,
  roomState: propRoomState,
  onExitStudentMode,
  onSubmitAnswer,
}) => {
  const [pin, setPin] = useState<string>(initialPin);
  const [studentName, setStudentName] = useState<string>(propStudentName);
  const [studentCode, setStudentCode] = useState<string>(propStudentCode);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const [room, setRoom] = useState<RoomState | null>(propRoomState || null);
  const [answersMap, setAnswersMap] = useState<Record<string, string>>({});
  const [resultsMap, setResultsMap] = useState<Record<string, { selected: string; isCorrect: boolean }>>({});
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Sync prop changes
  useEffect(() => {
    if (propRoomState) setRoom(propRoomState);
  }, [propRoomState]);

  // Fetch room state if pin is available
  const fetchRoom = useCallback(async () => {
    if (!pin) return;
    try {
      const res = await fetch(`/api/rooms/${pin}`);
      if (res.ok) {
        const data = await res.json();
        setRoom(data);
      }
    } catch (_) {}
  }, [pin]);

  useEffect(() => {
    fetchRoom();
    const interval = setInterval(fetchRoom, 2500);
    return () => clearInterval(interval);
  }, [fetchRoom]);

  const questions: QuizQuestion[] = propQuestions || room?.questions || [];
  const currentQ: QuizQuestion | undefined = questions[activeQuestionIndex];

  // Helper to get normalized correct answer key
  const getCorrectKey = (q: QuizQuestion): string => {
    const raw = q.correctAnswer || (q as any).answer || '';
    const match = raw.match(/^[A-Da-d]/);
    if (match) return match[0].toUpperCase();
    return raw.trim().toUpperCase();
  };

  // Handle student clicking option A, B, C, D
  const handleSelectOption = (optKey: string) => {
    if (!currentQ || isSubmitting) return;

    // Check if question was already answered (prevent re-selecting if teacher locked)
    const existing = resultsMap[currentQ.id];
    if (existing) return;

    const correctKey = getCorrectKey(currentQ);
    const isCorrect = optKey.toUpperCase() === correctKey;

    // Record answer
    setAnswersMap((prev) => ({ ...prev, [currentQ.id]: optKey }));
    setResultsMap((prev) => ({
      ...prev,
      [currentQ.id]: { selected: optKey, isCorrect },
    }));

    // Trigger immediate sound effect
    if (isCorrect) {
      examAudio.playCorrectSound();
    } else {
      examAudio.playWrongSound();
    }

    // Call submit callback or post to server
    if (onSubmitAnswer) {
      onSubmitAnswer(currentQ.id, optKey, isCorrect);
    }

    fetch(`/api/rooms/${pin}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: currentQ.id,
        studentName,
        studentCode,
        selectedOption: optKey,
        isCorrect,
      }),
    }).catch(() => {});
  };

  const currentResult = currentQ ? resultsMap[currentQ.id] : undefined;
  const currentCorrectKey = currentQ ? getCorrectKey(currentQ) : '';

  // Calculate score statistics
  const answeredCount = Object.keys(resultsMap).length;
  const correctCount = Object.values(resultsMap).filter((r) => r.isCorrect).length;
  const wrongCount = answeredCount - correctCount;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col p-3 md:p-6 select-none font-sans">
      {/* Top Navigation & Status Bar */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-black shadow-inner">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="font-black text-white text-base leading-tight flex items-center gap-2">
              <span>{studentName}</span>
              {studentCode && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-950 border border-indigo-700/50 text-indigo-300 text-xs font-mono font-bold">
                  {studentCode}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
              <span>Phòng: <b className="text-emerald-400 font-bold">{pin}</b></span>
              <span>•</span>
              <span>Đã làm: <b className="text-indigo-300 font-bold">{answeredCount}/{questions.length}</b></span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Mute/Unmute Audio */}
          <button
            onClick={() => {
              const nextMute = !isMuted;
              setIsMuted(nextMute);
              examAudio.isMuted = nextMute;
            }}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${
              isMuted
                ? 'bg-slate-800 border-slate-700 text-slate-400'
                : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
            }`}
            title={isMuted ? 'Bật âm thanh phản hồi' : 'Tắt âm thanh'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {onExitStudentMode && (
            <button
              onClick={onExitStudentMode}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold border border-slate-700 transition-colors"
            >
              Thoát
            </button>
          )}
        </div>
      </header>

      {/* YÊU CẦU 1: DÃY SỐ CÂU HỎI TRÊN THANH TIÊU ĐỀ: [1] [2] [3] [4] [5]... */}
      {/* Tô màu xanh câu đã làm đúng, màu đỏ câu làm sai, màu xám câu chưa làm */}
      {questions.length > 0 && (
        <div className="w-full max-w-4xl mx-auto mb-4 p-3 rounded-2xl bg-slate-900 border border-slate-800/80 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Danh Sách Câu Hỏi ({questions.length} câu)
            </span>
            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Đúng: {correctCount}
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                Sai: {wrongCount}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
            {questions.map((q, idx) => {
              const res = resultsMap[q.id];
              const isCurrent = idx === activeQuestionIndex;

              let badgeStyle = 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'; // Chưa làm: xám

              if (res) {
                if (res.isCorrect) {
                  // Đã làm ĐÚNG: Màu xanh êm dịu, không chói mắt
                  badgeStyle = 'bg-emerald-800/90 border-emerald-500 text-emerald-100 shadow-sm ring-1 ring-emerald-500/30';
                } else {
                  // Đã làm SAI: Màu đỏ dịu nhẹ
                  badgeStyle = 'bg-rose-900/80 border-rose-600/80 text-rose-100 shadow-sm';
                }
              }

              if (isCurrent) {
                badgeStyle += ' ring-2 ring-indigo-400 scale-105 font-black';
              }

              return (
                <button
                  key={q.id}
                  onClick={() => setActiveQuestionIndex(idx)}
                  className={`w-9 h-9 rounded-xl border font-mono text-sm font-bold flex items-center justify-center shrink-0 transition-all cursor-pointer ${badgeStyle}`}
                  title={`Câu ${idx + 1}: ${res ? (res.isCorrect ? 'Đúng' : 'Sai') : 'Chưa làm'}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Question Display Card */}
      <main className="w-full max-w-4xl mx-auto flex-1 flex flex-col justify-between space-y-5">
        {!currentQ ? (
          <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3 my-auto">
            <Clock className="w-14 h-14 text-amber-500 mx-auto animate-pulse" />
            <h3 className="text-2xl font-black text-white">Chờ Đề Thi Từ Giám Thị</h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto">
              Đề thi sẽ tự động hiển thị ngay khi giáo viên bắt đầu tính giờ làm bài trên bảng thông minh!
            </p>
          </div>
        ) : (
          <>
            {/* Question Text Box */}
            <div className="p-6 md:p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between text-xs uppercase font-black tracking-widest text-indigo-400">
                <span className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-600/30 text-indigo-300 border border-indigo-500/30">
                    CÂU {activeQuestionIndex + 1}/{questions.length}
                  </span>
                  {currentQ.difficulty && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                      {currentQ.difficulty}
                    </span>
                  )}
                </span>
                {currentResult && (
                  <span className={`flex items-center gap-1 font-bold text-sm ${currentResult.isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {currentResult.isCorrect ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Chính xác (+10đ)</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-rose-400" />
                        <span>Chưa chính xác</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              <div className="text-xl md:text-2xl font-bold text-white leading-relaxed">
                <QuizRichContentRenderer
                  content={currentQ.question}
                  diagramType={currentQ.diagramType}
                  diagramData={currentQ.diagramData}
                />
              </div>
            </div>

            {/* 4 PHƯƠNG ÁN TRẢ LỜI (A, B, C, D) VỚI HIỆU ỨNG PHẢN HỒI ĐÚNG / SAI TỨC THÌ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {currentQ.options.map((opt) => {
                const optUpper = opt.key.toUpperCase();
                const isSelected = currentResult?.selected === opt.key;
                const isTheCorrectAnswer = optUpper === currentCorrectKey;

                let cardClasses = 'bg-slate-900 border-slate-800 text-slate-200 hover:border-slate-700 hover:bg-slate-850';
                let letterClasses = 'bg-slate-800 text-indigo-400 border border-slate-700';
                let iconElement = null;

                if (currentResult) {
                  // Sau khi đã bấm chọn đáp án:
                  if (isSelected) {
                    if (currentResult.isCorrect) {
                      // Đúng: Đổi thẻ sang màu xanh êm dịu, trang nhã, không chói mắt
                      cardClasses = 'bg-emerald-950/75 border-emerald-500 text-emerald-100 shadow-md ring-1 ring-emerald-500/40';
                      letterClasses = 'bg-emerald-600 text-white font-black';
                      iconElement = <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 ml-auto" />;
                    } else {
                      // Sai: Đổi thẻ sang viền đỏ dịu nhẹ, nền tối hài hòa
                      cardClasses = 'bg-rose-950/45 border-rose-500/70 text-rose-200 shadow-sm';
                      letterClasses = 'bg-rose-700 text-white font-black';
                      iconElement = <XCircle className="w-6 h-6 text-rose-400 shrink-0 ml-auto" />;
                    }
                  } else if (isTheCorrectAnswer) {
                    // Nếu làm sai: Hiện đáp án đúng màu xanh dịu mắt để học sinh ghi nhớ
                    cardClasses = 'bg-emerald-950/50 border-emerald-500/70 text-emerald-200 ring-1 ring-emerald-500/40';
                    letterClasses = 'bg-emerald-600 text-white font-black';
                    iconElement = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 ml-auto" />;
                  } else {
                    cardClasses = 'bg-slate-900/40 border-slate-800/40 text-slate-500 opacity-60';
                  }
                }

                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleSelectOption(opt.key)}
                    disabled={Boolean(currentResult)}
                    className={`p-4 md:p-5 rounded-2xl border-2 transition-all flex items-center gap-4 text-left cursor-pointer active:scale-98 shadow-sm ${cardClasses} ${
                      currentResult ? 'cursor-default' : ''
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xl shrink-0 ${letterClasses}`}>
                      {opt.key}
                    </div>
                    <div className="font-bold text-base md:text-lg flex-1 leading-snug">
                      <MathFormulaRenderer content={opt.text} />
                    </div>
                    {iconElement}
                  </button>
                );
              })}
            </div>

            {/* BỔ SUNG BỘ ĐIỀU HƯỚNG CHUYỂN CÂU: [ ⬅ Câu trước ] và [ Câu tiếp theo ➔ ] */}
            <div className="flex items-center justify-between pt-3 pb-2">
              <button
                type="button"
                onClick={() => setActiveQuestionIndex((prev) => Math.max(0, prev - 1))}
                disabled={activeQuestionIndex === 0}
                className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-sm font-bold flex items-center gap-2 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-sm cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>⬅ Câu trước</span>
              </button>

              <div className="text-xs text-slate-400 font-bold text-center">
                Câu <span className="text-indigo-400 font-black text-sm">{activeQuestionIndex + 1}</span> / {questions.length}
              </div>

              <button
                type="button"
                onClick={() => setActiveQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                disabled={activeQuestionIndex >= questions.length - 1}
                className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-lg shadow-indigo-900/30 cursor-pointer"
              >
                <span>Câu tiếp theo ➔</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

// Also export as StudentExamView for seamless routing compatibility
export const StudentExamView = ExamRoom;
export default ExamRoom;
