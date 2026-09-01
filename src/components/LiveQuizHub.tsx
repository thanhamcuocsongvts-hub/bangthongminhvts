import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  RotateCcw,
  QrCode,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Award,
  ChevronRight,
  TrendingUp,
  BarChart2,
  PlusCircle,
  HelpCircle,
  Zap,
  Volume2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';
import { QuizQuestion, RoomState, StudentSubmission, TextScale } from '../types';

interface LiveQuizHubProps {
  roomState: RoomState | null;
  textScale: TextScale;
  onRefreshRoom: () => void;
  onControlRoom: (activeQuestionIndex: number, isLive: boolean) => void;
  onResetRoom: () => void;
  onCreateAIQuiz: (promptTopic?: string) => Promise<void>;
  isLoadingAIQuiz?: boolean;
}

export const LiveQuizHub: React.FC<LiveQuizHubProps> = ({
  roomState,
  textScale,
  onRefreshRoom,
  onControlRoom,
  onResetRoom,
  onCreateAIQuiz,
  isLoadingAIQuiz = false,
}) => {
  const [showQRModal, setShowQRModal] = useState<boolean>(false);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const timerRef = useRef<any>(null);

  const activeIndex = roomState?.activeQuestionIndex || 0;
  const questions = roomState?.questions || [];
  const currentQ: QuizQuestion | undefined = questions[activeIndex];

  const currentSubmissions: StudentSubmission[] =
    (currentQ && roomState?.submissions[currentQ.id]) || [];

  // Reset timer whenever question changes
  useEffect(() => {
    if (currentQ) {
      setTimeLeft(currentQ.timeLimit || 30);
      setIsRevealed(false);
      setIsTimerRunning(true);
    }
  }, [activeIndex, currentQ]);

  // Timer countdown
  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsTimerRunning(false);
            setIsRevealed(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [isTimerRunning, timeLeft]);

  // Reveal results and trigger confetti if high score
  const handleRevealResults = () => {
    setIsRevealed(true);
    setIsTimerRunning(false);

    if (currentSubmissions.length > 0) {
      const correctCount = currentSubmissions.filter((s) => s.isCorrect).length;
      const accuracy = (correctCount / currentSubmissions.length) * 100;
      if (accuracy >= 65) {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#4ade80', '#38bdf8', '#fbbf24', '#f43f5e', '#a855f7'],
        });
      }
    }
  };

  const handleNextQuestion = () => {
    if (activeIndex < questions.length - 1) {
      onControlRoom(activeIndex + 1, true);
    }
  };

  const handlePrevQuestion = () => {
    if (activeIndex > 0) {
      onControlRoom(activeIndex - 1, true);
    }
  };

  // Calculate statistics for the active question
  const totalSubs = currentSubmissions.length;
  const correctSubs = currentSubmissions.filter((s) => s.isCorrect).length;
  const accuracyPercent = totalSubs > 0 ? Math.round((correctSubs / totalSubs) * 100) : 0;

  // Counts for A, B, C, D
  const optionCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  currentSubmissions.forEach((s) => {
    if (optionCounts[s.selectedOption] !== undefined) {
      optionCounts[s.selectedOption]++;
    }
  });

  // Leaderboard (Fastest correct answers)
  const topStudents = [...currentSubmissions]
    .filter((s) => s.isCorrect)
    .sort((a, b) => a.timeSpentSeconds - b.timeSpentSeconds)
    .slice(0, 4);

  // Student joining URL for local & network sharing
  const joinUrl = `${window.location.origin}/?mode=student&room=${roomState?.pin || '758899'}`;

  // Font scale helper
  const getScale = () => {
    switch (textScale) {
      case 'huge':
        return {
          questionText: 'text-3xl md:text-4xl lg:text-5xl font-black leading-tight',
          optionText: 'text-2xl md:text-3xl font-bold',
          badgeText: 'text-2xl font-bold',
        };
      case 'large':
        return {
          questionText: 'text-2xl md:text-3xl lg:text-4xl font-black leading-tight',
          optionText: 'text-xl md:text-2xl font-bold',
          badgeText: 'text-xl font-bold',
        };
      case 'normal':
      default:
        return {
          questionText: 'text-xl md:text-2xl lg:text-3xl font-black leading-tight',
          optionText: 'text-lg md:text-xl font-bold',
          badgeText: 'text-lg font-bold',
        };
    }
  };

  const scale = getScale();

  // Simulate quick student responses for instant classroom test
  const handleSimulateClassSubmission = async () => {
    if (!currentQ || !roomState) return;

    const sampleNames = [
      'Nguyễn Minh Tuấn', 'Trần Mai Phương', 'Lê Hoàng Nam', 'Phạm Thu Thảo',
      'Vũ Quốc Bảo', 'Đỗ Gia Hân', 'Hoàng Đức Anh', 'Bùi Ngọc Ánh',
      'Đặng Khánh Linh', 'Trịnh Văn Hùng', 'Lê Mỹ Duyên', 'Nguyễn Tiến Đạt'
    ];

    const options = ['A', 'B', 'C', 'D'];
    const correctOpt = currentQ.correctAnswer;

    for (let i = 0; i < sampleNames.length; i++) {
      // 75% pick correct answer
      const isPickCorrect = Math.random() < 0.75;
      const selected = isPickCorrect
        ? correctOpt
        : options.filter((o) => o !== correctOpt)[Math.floor(Math.random() * 3)];
      
      const timeSpent = Math.floor(4 + Math.random() * 15);

      try {
        await fetch(`/api/rooms/${roomState.pin}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: currentQ.id,
            studentId: `sim_${i + 1}`,
            studentName: sampleNames[i],
            selectedOption: selected,
            timeSpentSeconds: timeSpent,
          }),
        });
      } catch (e) {
        console.error('Sim submission error', e);
      }
    }

    onRefreshRoom();
  };

  if (!currentQ) {
    return (
      <div className="w-full h-[calc(100vh-100px)] flex flex-col items-center justify-center p-8 bg-white rounded-3xl border border-slate-200 text-center shadow-md">
        <div className="w-20 h-20 rounded-3xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-6 shadow-xs">
          <HelpCircle className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 mb-3">Chưa có câu hỏi trắc nghiệm nào</h2>
        <p className="text-slate-600 text-lg max-w-md mb-6">
          Bạn có thể để Trí tuệ nhân tạo AI tự động tạo trắc nghiệm từ tài liệu bài giảng hiện tại.
        </p>
        <button
          onClick={() => onCreateAIQuiz()}
          disabled={isLoadingAIQuiz}
          className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg flex items-center gap-3 shadow-md shadow-indigo-600/20 transition-all"
        >
          <Sparkles className="w-6 h-6 text-yellow-300" />
          <span>{isLoadingAIQuiz ? 'AI đang tạo câu hỏi...' : 'Tạo Trắc Nghiệm Tự Động Bằng AI'}</span>
        </button>
      </div>
    );
  }

  return (
    <div id="live-quiz-viewport" className="relative w-full h-[calc(100vh-100px)] flex flex-col bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-md">
      {/* Quiz Top Status Bar on 75" TV */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-b border-slate-200 z-20">
        {/* Left: Question Counter & PIN Badge */}
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-slate-900 font-mono text-base font-bold flex items-center gap-2">
            <span className="text-indigo-600 font-bold">CÂU HỎI</span>
            <span className="text-xl text-indigo-700 font-black">{activeIndex + 1}/{questions.length}</span>
          </div>

          {/* Room PIN for Students to Join */}
          <button
            id="open-qr-modal-btn"
            onClick={() => setShowQRModal(true)}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-base font-bold flex items-center gap-2 transition-all shadow-xs"
            title="Mở mã QR và PIN phòng để học sinh quét điện thoại tham gia"
          >
            <QrCode className="w-5 h-5 text-emerald-600" />
            <span>MÃ PIN:</span>
            <span className="font-mono text-xl text-emerald-600 font-black tracking-widest">{roomState?.pin || '758899'}</span>
          </button>

          {/* Active students count */}
          <div className="hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-semibold shadow-xs">
            <Users className="w-4 h-4 text-indigo-600" />
            <span>Học sinh trong lớp:</span>
            <span className="font-bold text-slate-900 font-mono">{roomState?.activeStudents?.length || 0}</span>
          </div>
        </div>

        {/* Right: Timer & Control Actions */}
        <div className="flex items-center gap-3">
          {/* Live Submissions Tracker */}
          <div className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-base font-bold flex items-center gap-2 shadow-xs">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            <span>Đã nộp:</span>
            <span className="font-mono text-xl text-amber-600 font-black">{totalSubs}</span>
          </div>

          {/* Timer Countdown Badge */}
          <div
            className={`px-4 py-2 rounded-xl font-mono font-black text-xl flex items-center gap-2 border transition-all ${
              timeLeft <= 5
                ? 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse'
                : 'bg-white border-slate-200 text-indigo-700 shadow-xs'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span>{timeLeft}s</span>
          </div>

          {/* Quick Simulation of Class Responses */}
          <button
            id="simulate-class-btn"
            onClick={handleSimulateClassSubmission}
            className="px-3.5 py-2 rounded-xl bg-cyan-50 border border-cyan-200 hover:bg-cyan-100 text-cyan-700 text-sm font-bold flex items-center gap-1.5 transition-all shadow-xs"
            title="Mô phỏng cả lớp nộp bài tức thì (dành cho trải nghiệm giáo viên)"
          >
            <Zap className="w-4 h-4 text-cyan-600" />
            <span className="hidden xl:inline">Giả lập nộp bài</span>
          </button>

          {/* AI Generator Button */}
          <button
            id="ai-add-quiz-btn"
            onClick={() => onCreateAIQuiz()}
            disabled={isLoadingAIQuiz}
            className="px-3.5 py-2 rounded-xl bg-purple-50 border border-purple-200 hover:bg-purple-100 text-purple-700 text-sm font-bold flex items-center gap-1.5 transition-all shadow-xs"
            title="AI tạo thêm câu hỏi trắc nghiệm mới từ bài học"
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            <span className="hidden lg:inline">{isLoadingAIQuiz ? 'Đang tạo...' : '+ Câu hỏi AI'}</span>
          </button>
        </div>
      </div>

      {/* Main Quiz Presentation Area */}
      <div className="flex-1 flex flex-col lg:flex-row p-6 md:p-8 gap-6 overflow-y-auto bg-white">
        {/* Left 65%: Question & Options */}
        <div className="flex-1 flex flex-col justify-between space-y-6">
          {/* Question Prompt Card */}
          <div className="p-8 rounded-3xl bg-slate-50 border-2 border-indigo-200/90 shadow-sm">
            <div className="text-xs uppercase font-extrabold tracking-widest text-indigo-600 mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
              <span>ĐỀ BÀI TRẮC NGHIỆM</span>
              {currentQ.difficulty && (
                <span className="ml-auto px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-medium">
                  Độ khó: {currentQ.difficulty}
                </span>
              )}
            </div>
            <h2 className={`${scale.questionText} text-slate-900`}>
              {currentQ.question}
            </h2>
          </div>

          {/* 4 Large Options (A, B, C, D) Designed for TV Touch and Remote Vision */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            {currentQ.options.map((opt) => {
              const isCorrect = opt.key === currentQ.correctAnswer;
              const count = optionCounts[opt.key] || 0;
              const percent = totalSubs > 0 ? Math.round((count / totalSubs) * 100) : 0;

              let cardStyle = 'bg-white border-slate-200 text-slate-900 hover:border-indigo-400 hover:bg-slate-50/80 shadow-xs';

              if (isRevealed) {
                if (isCorrect) {
                  cardStyle = 'bg-emerald-50 border-emerald-400 text-emerald-950 ring-2 ring-emerald-400/60 shadow-sm';
                } else if (count > 0) {
                  cardStyle = 'bg-slate-50 border-rose-300 text-slate-600';
                }
              }

              return (
                <div
                  key={opt.key}
                  className={`relative p-6 rounded-2xl border-2 transition-all flex flex-col justify-between min-h-[110px] ${cardStyle}`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-2xl shrink-0 ${
                        isRevealed && isCorrect
                          ? 'bg-emerald-600 text-white'
                          : 'bg-indigo-50 border border-indigo-200 text-indigo-700'
                      }`}
                    >
                      {opt.key}
                    </div>
                    <div className={`flex-1 ${scale.optionText} pt-1.5 text-slate-800 font-bold`}>
                      {opt.text}
                    </div>
                  </div>

                  {/* Revealed Distribution Bar */}
                  {isRevealed && (
                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <div className="flex items-center justify-between text-sm font-bold mb-1.5">
                        <span className={isCorrect ? 'text-emerald-700' : 'text-slate-500'}>
                          {count} học sinh ({percent}%)
                        </span>
                        {isCorrect && (
                          <span className="text-emerald-700 flex items-center gap-1 font-extrabold">
                            <CheckCircle2 className="w-4 h-4" /> ĐÁP ÁN ĐÚNG
                          </span>
                        )}
                      </div>
                      <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${percent}%` }}
                          className={`h-full rounded-full transition-all duration-700 ${
                            isCorrect ? 'bg-emerald-600' : 'bg-slate-400'
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Explanation Banner when Revealed */}
          {isRevealed && currentQ.explanation && (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-4 shadow-sm">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs uppercase tracking-widest text-emerald-700 font-black mb-1">
                  GIẢI THÍCH CHI TIẾT ĐÁP ÁN:
                </div>
                <div className="text-lg md:text-xl font-medium leading-relaxed text-slate-800">
                  {currentQ.explanation}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right 35%: Live Class Analytics & Leaderboard Panel */}
        <div className="w-full lg:w-96 flex flex-col gap-4">
          {/* Class Accuracy Meter Card */}
          <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 shadow-sm flex flex-col items-center text-center">
            <div className="text-xs uppercase font-extrabold tracking-widest text-slate-500 mb-3">
              TỈ LỆ TRẢ LỜI ĐÚNG CỦA LỚP
            </div>

            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="14"
                  className="text-slate-200"
                  fill="transparent"
                />
                <circle
                  cx="72"
                  cy="72"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="14"
                  strokeDasharray={364}
                  strokeDashoffset={364 - (364 * accuracyPercent) / 100}
                  strokeLinecap="round"
                  className={`transition-all duration-1000 ${
                    accuracyPercent >= 70 ? 'text-emerald-500' : accuracyPercent >= 50 ? 'text-amber-500' : 'text-rose-500'
                  }`}
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-slate-900 font-mono">{accuracyPercent}%</span>
                <span className="text-xs text-slate-500 font-semibold">{correctSubs}/{totalSubs} đúng</span>
              </div>
            </div>

            {/* Quick Summary Pill */}
            <div className="mt-4 px-4 py-1.5 rounded-full bg-white border border-slate-200 text-sm font-bold text-slate-700 shadow-xs">
              {totalSubs === 0
                ? 'Đang chờ học sinh gửi bài...'
                : accuracyPercent >= 80
                ? '🌟 Lớp hiểu bài xuất sắc!'
                : accuracyPercent >= 50
                ? '👍 Đa số học sinh nắm được bài'
                : '⚠️ Cần giảng lại khái niệm này'}
            </div>
          </div>

          {/* Real-time Fastest Students Leaderboard */}
          <div className="flex-1 p-6 rounded-3xl bg-slate-50 border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-amber-600 font-bold text-base">
                <Award className="w-5 h-5" />
                <span>HỌC SINH NHANH & ĐÚNG</span>
              </div>
              <span className="text-xs text-slate-500">Top tốc độ</span>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto">
              {topStudents.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm text-center py-6">
                  <Clock className="w-8 h-8 mb-2 opacity-50" />
                  <span>Chưa có kết quả ghi nhận</span>
                </div>
              ) : (
                topStudents.map((st, idx) => (
                  <div
                    key={st.studentId || idx}
                    className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                          idx === 0
                            ? 'bg-amber-400 text-slate-950 font-black'
                            : idx === 1
                            ? 'bg-slate-200 text-slate-800 font-black'
                            : idx === 2
                            ? 'bg-amber-100 text-amber-800 font-bold'
                            : 'bg-slate-100 text-slate-600 font-bold'
                        }`}
                      >
                        #{idx + 1}
                      </div>
                      <span className="font-bold text-slate-900 text-base truncate max-w-[140px]">
                        {st.studentName}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-600 font-mono font-bold text-sm">
                        {st.timeSpentSeconds}s
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Footer for Teacher on 75" TV */}
      <div className="px-8 py-4 bg-slate-50/95 border-t border-slate-200 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <button
            id="prev-quiz-question-btn"
            onClick={handlePrevQuestion}
            disabled={activeIndex === 0}
            className="px-5 py-3 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-base disabled:opacity-30 disabled:pointer-events-none transition-all shadow-xs"
          >
            ← Câu trước
          </button>

          <button
            id="reset-quiz-room-btn"
            onClick={onResetRoom}
            className="px-4 py-3 rounded-2xl bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 font-bold text-base flex items-center gap-2 transition-all shadow-xs"
            title="Làm mới lại dữ liệu nộp bài của phòng"
          >
            <RotateCcw className="w-5 h-5" />
            <span className="hidden sm:inline">Làm lại bài</span>
          </button>
        </div>

        {/* Primary Action Button (Reveal / Next) */}
        <div className="flex items-center gap-3">
          {!isRevealed ? (
            <button
              id="reveal-quiz-answer-btn"
              onClick={handleRevealResults}
              className="px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xl flex items-center gap-3 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <CheckCircle2 className="w-7 h-7" />
              <span>Khóa Bài & Công Bố Đáp Án</span>
            </button>
          ) : (
            <button
              id="next-quiz-question-btn"
              onClick={handleNextQuestion}
              disabled={activeIndex >= questions.length - 1}
              className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xl flex items-center gap-3 shadow-md shadow-indigo-600/20 disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-all"
            >
              <span>Chuyển Sang Câu Kế Tiếp</span>
              <ChevronRight className="w-7 h-7" />
            </button>
          )}
        </div>
      </div>

      {/* QR Code Modal for Student Mobile Join */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-8 rounded-3xl bg-white border border-slate-200 shadow-2xl flex flex-col items-center text-center">
            <h3 className="text-2xl font-black text-slate-900 mb-2">QUÉT MÃ ĐỂ VÀO PHÒNG HỌC</h3>
            <p className="text-slate-600 text-base mb-6">
              Học sinh dùng camera điện thoại hoặc máy tính bảng quét mã để làm bài tập trắc nghiệm trực tiếp.
            </p>

            {/* QR Box */}
            <div className="p-5 rounded-2xl bg-white border-2 border-slate-100 shadow-lg mb-6">
              <QRCodeSVG value={joinUrl} size={220} level="H" includeMargin={true} />
            </div>

            <div className="space-y-1 mb-6 w-full">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">MÃ PIN PHÒNG HỌC:</div>
              <div className="text-4xl md:text-5xl font-mono font-black text-emerald-600 tracking-widest bg-slate-50 px-6 py-2 rounded-2xl border border-slate-200">
                {roomState?.pin || '758899'}
              </div>
            </div>

            <div className="flex items-center gap-3 w-full">
              <button
                onClick={() => {
                  window.open(joinUrl, '_blank');
                }}
                className="flex-1 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base transition-all shadow-md shadow-indigo-600/20"
              >
                Mở Giao Diện Học Sinh
              </button>

              <button
                onClick={() => setShowQRModal(false)}
                className="px-6 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-base transition-all border border-slate-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
