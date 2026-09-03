import React, { useState, useEffect, useRef } from 'react';
import {
  Trophy,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Users,
  Timer,
  ChevronRight,
  Flame,
  Award,
  Dice5,
  Volume2,
  VolumeX,
  RefreshCw,
  Eye,
  Star,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QuizQuestion, Student, ClassroomGroup } from '../types';

interface EducationalGamesHubProps {
  classroom?: ClassroomGroup | null;
  questions?: QuizQuestion[];
  onOpenAIQuizCreator?: () => void;
}

type ActiveGame = 'race' | 'wheel' | 'puzzle' | 'millionaire';

const DEFAULT_GAME_QUESTIONS: QuizQuestion[] = [
  {
    id: 'gq1',
    question: 'Hình chóp tam giác đều có bao nhiêu mặt?',
    options: [
      { key: 'A', text: '3 mặt' },
      { key: 'B', text: '4 mặt' },
      { key: 'C', text: '5 mặt' },
      { key: 'D', text: '6 mặt' },
    ],
    correctAnswer: 'B',
    explanation: 'Hình chóp tam giác đều có 1 mặt đáy là tam giác và 3 mặt bên là tam giác cân, tổng cộng có 4 mặt.',
    timeLimit: 30,
  },
  {
    id: 'gq2',
    question: 'Đơn vị đo cường độ dòng điện trong hệ SI là gì?',
    options: [
      { key: 'A', text: 'Vôn (V)' },
      { key: 'B', text: 'Ohm (Ω)' },
      { key: 'C', text: 'Ampe (A)' },
      { key: 'D', text: 'Watt (W)' },
    ],
    correctAnswer: 'C',
    explanation: 'Ampe (ký hiệu A) là đơn vị đo cường độ dòng điện trong hệ đo lường quốc tế SI.',
    timeLimit: 30,
  },
  {
    id: 'gq3',
    question: 'Khí nào chiếm tỉ lệ thể tích lớn nhất trong không khí quyển Trái Đất?',
    options: [
      { key: 'A', text: 'Oxy (O2)' },
      { key: 'B', text: 'Cacbonic (CO2)' },
      { key: 'C', text: 'Nitơ (N2)' },
      { key: 'D', text: 'Argon (Ar)' },
    ],
    correctAnswer: 'C',
    explanation: 'Khí Nitơ (N2) chiếm khoảng 78% thể tích khí quyển, Oxy chiếm khoảng 21%.',
    timeLimit: 30,
  },
  {
    id: 'gq4',
    question: 'Chiến thắng Điện Biên Phủ diễn ra vào năm nào?',
    options: [
      { key: 'A', text: '1945' },
      { key: 'B', text: '1954' },
      { key: 'C', text: '1975' },
      { key: 'D', text: '1968' },
    ],
    correctAnswer: 'B',
    explanation: 'Chiến thắng lịch sử Điện Biên Phủ kết thúc thắng lợi vào ngày 7 tháng 5 năm 1954.',
    timeLimit: 30,
  },
  {
    id: 'gq5',
    question: 'Hành tinh nào gần Mặt Trời nhất trong Hệ Mặt Trời?',
    options: [
      { key: 'A', text: 'Sao Thủy (Mercury)' },
      { key: 'B', text: 'Sao Kim (Venus)' },
      { key: 'C', text: 'Sao Hỏa (Mars)' },
      { key: 'D', text: 'Trái Đất (Earth)' },
    ],
    correctAnswer: 'A',
    explanation: 'Sao Thủy là hành tinh nằm gần Mặt Trời nhất với khoảng cách trung bình khoảng 58 triệu km.',
    timeLimit: 30,
  },
];

export const EducationalGamesHub: React.FC<EducationalGamesHubProps> = ({
  classroom,
  questions = [],
  onOpenAIQuizCreator,
}) => {
  const [activeGame, setActiveGame] = useState<ActiveGame>('race');

  const activeQuestions =
    questions && questions.length > 0 ? questions : DEFAULT_GAME_QUESTIONS;

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-white rounded-3xl overflow-hidden shadow-2xl border border-slate-800 select-none">
      {/* Top Game Selection Header Bar */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
            <Trophy className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Đấu Trường Trò Chơi Củng Cố Tri Thức</span>
              <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                Gamification 4-in-1
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Các hình thức ôn tập vui nhộn, hào hứng, kích thích tương tác trên màn hình TV cảm ứng 75&quot;
            </p>
          </div>
        </div>

        {/* Game Mode Tabs */}
        <div className="flex items-center bg-slate-800/90 p-1 rounded-2xl border border-slate-700">
          <button
            onClick={() => setActiveGame('race')}
            className={`px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeGame === 'race'
                ? 'bg-rose-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-300" />
            <span>🏎️ Đua Xe Tri Thức</span>
          </button>

          <button
            onClick={() => setActiveGame('wheel')}
            className={`px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeGame === 'wheel'
                ? 'bg-amber-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Dice5 className="w-4 h-4 text-yellow-300" />
            <span>🎡 Vòng Quay May Mắn</span>
          </button>

          <button
            onClick={() => setActiveGame('puzzle')}
            className={`px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeGame === 'puzzle'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <span>🧩 Mảnh Ghép Bí Ẩn</span>
          </button>

          <button
            onClick={() => setActiveGame('millionaire')}
            className={`px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              activeGame === 'millionaire'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-4 h-4 text-indigo-300" />
            <span>👑 Ai Là Triệu Phú</span>
          </button>
        </div>

        {/* AI Quiz Generator Quick Action */}
        {onOpenAIQuizCreator && (
          <button
            onClick={onOpenAIQuizCreator}
            className="px-4 py-2 rounded-2xl font-bold text-xs bg-linear-to-r from-purple-600 via-indigo-600 to-emerald-600 hover:opacity-95 text-white shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all cursor-pointer border border-white/20 active:scale-95"
            title="Soạn bộ câu hỏi trắc nghiệm trò chơi mới bằng AI theo chủ đề"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>Soạn đề Game bằng AI</span>
          </button>
        )}
      </div>

      {/* Main Game Arena */}
      <div className="flex-1 w-full h-full overflow-y-auto overflow-x-hidden p-4 md:p-6 bg-radial from-slate-900 to-slate-950 flex flex-col custom-scrollbar">
        {activeGame === 'race' && (
          <GrandPrixRacingGame questions={activeQuestions} />
        )}
        {activeGame === 'wheel' && (
          <LuckyWheelGame classroom={classroom} questions={activeQuestions} />
        )}
        {activeGame === 'puzzle' && (
          <MysteryPuzzleGame questions={activeQuestions} />
        )}
        {activeGame === 'millionaire' && (
          <MillionaireGame questions={activeQuestions} />
        )}
      </div>
    </div>
  );
};

/* ========================================================================= */
/* GAME 1: ĐUA XE TRI THỨC (KNOWLEDGE GRAND PRIX TURBO)                      */
/* ========================================================================= */
interface GrandPrixRacingGameProps {
  questions: QuizQuestion[];
}

const TEAMS = [
  { id: 'team_red', name: 'Đội Đỏ (Rồng Lửa)', color: '#ef4444', emoji: '🏎️' },
  { id: 'team_blue', name: 'Đội Lam (Tia Chớp)', color: '#3b82f6', emoji: '🚙' },
  { id: 'team_yellow', name: 'Đội Vàng (Chiến Binh)', color: '#eab308', emoji: '🚖' },
  { id: 'team_green', name: 'Đội Lục (Ngựa Thần)', color: '#10b981', emoji: '🚗' },
];

const GrandPrixRacingGame: React.FC<GrandPrixRacingGameProps> = ({ questions }) => {
  const [teamScores, setTeamScores] = useState<Record<string, number>>({
    team_red: 0,
    team_blue: 0,
    team_yellow: 0,
    team_green: 0,
  });

  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [selectedTeam, setSelectedTeam] = useState<string>('team_red');
  const [revealed, setRevealed] = useState<boolean>(false);
  const [winnerTeam, setWinnerTeam] = useState<string | null>(null);

  const TARGET_GOAL = 5; // 5 steps to reach finish line
  const currentQ = questions[currentQIndex % questions.length] || questions[0];

  const handleAnswerOption = (optKey: string) => {
    if (revealed || winnerTeam) return;
    setRevealed(true);

    const isCorrect = optKey === currentQ.correctAnswer;
    if (isCorrect) {
      const newScore = (teamScores[selectedTeam] || 0) + 1;
      setTeamScores((prev) => ({
        ...prev,
        [selectedTeam]: newScore,
      }));

      if (newScore >= TARGET_GOAL) {
        setWinnerTeam(selectedTeam);
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
        });
      }
    }
  };

  const handleNextQuestion = () => {
    setRevealed(false);
    setCurrentQIndex((prev) => (prev + 1) % questions.length);
    // Cycle team turn
    const teamKeys = TEAMS.map((t) => t.id);
    const currIdx = teamKeys.indexOf(selectedTeam);
    setSelectedTeam(teamKeys[(currIdx + 1) % teamKeys.length]);
  };

  const handleResetGame = () => {
    setTeamScores({
      team_red: 0,
      team_blue: 0,
      team_yellow: 0,
      team_green: 0,
    });
    setWinnerTeam(null);
    setRevealed(false);
    setCurrentQIndex(0);
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6 animate-fade-in">
      {/* Race Track Arena */}
      <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-500 animate-pulse" />
            <span className="font-extrabold text-sm uppercase tracking-wider text-rose-400">
              Đường Đua Siêu Tốc • Đích 5 Điểm
            </span>
          </div>
          <button
            onClick={handleResetGame}
            className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đua Lại Từ Đầu</span>
          </button>
        </div>

        {/* 4 Lanes Track */}
        <div className="space-y-3.5">
          {TEAMS.map((t) => {
            const progress = Math.min(100, ((teamScores[t.id] || 0) / TARGET_GOAL) * 100);
            const isTurn = selectedTeam === t.id && !winnerTeam;

            return (
              <div
                key={t.id}
                onClick={() => setSelectedTeam(t.id)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  isTurn
                    ? 'bg-white/10 border-amber-400/80 ring-2 ring-amber-400/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <div className="flex items-center gap-2">
                    <span style={{ color: t.color }}>{t.name}</span>
                    {isTurn && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black animate-pulse">
                        LƯỢT TRẢ LỜI
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-slate-400">
                    {teamScores[t.id] || 0}/{TARGET_GOAL} chặng
                  </span>
                </div>

                {/* Track lane */}
                <div className="w-full h-8 bg-slate-900 rounded-xl relative border border-slate-800 overflow-hidden flex items-center px-2">
                  {/* Road markings */}
                  <div className="absolute inset-0 flex items-center justify-around opacity-20 pointer-events-none">
                    <div className="w-4 h-1 bg-white" />
                    <div className="w-4 h-1 bg-white" />
                    <div className="w-4 h-1 bg-white" />
                    <div className="w-4 h-1 bg-white" />
                  </div>

                  {/* Finish Line Checkered Pattern */}
                  <div className="absolute right-0 top-0 bottom-0 w-8 bg-repeat flex items-center justify-center font-black text-xs text-amber-300 border-l border-dashed border-amber-400/80">
                    🏁
                  </div>

                  {/* Car */}
                  <div
                    className="absolute text-2xl transition-all duration-700 ease-out z-10 flex items-center"
                    style={{
                      left: `calc(${progress}% * 0.88)`,
                    }}
                  >
                    <span>{t.emoji}</span>
                    {progress > 0 && <span className="text-xs text-amber-400 animate-pulse">🔥</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Winner Banner */}
      {winnerTeam && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-slate-950 text-center font-black shadow-2xl animate-bounce">
          <Trophy className="w-12 h-12 mx-auto mb-2 text-slate-950" />
          <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
            🎉 {TEAMS.find((t) => t.id === winnerTeam)?.name} VỀ ĐÍCH ĐẦU TIÊN!
          </h3>
          <p className="text-sm font-bold opacity-90 mt-1">
            Xuất sắc hoàn thành chặng đua tri thức! Thưởng điểm cộng cho cả đội!
          </p>
          <button
            onClick={handleResetGame}
            className="mt-4 px-6 py-2.5 rounded-2xl bg-slate-950 text-white font-bold text-sm shadow-xl cursor-pointer hover:bg-slate-900"
          >
            Chơi Lại Vòng Mới
          </button>
        </div>
      )}

      {/* Current Question Challenge */}
      {!winnerTeam && (
        <div className="p-6 rounded-3xl bg-slate-900 border-2 border-indigo-500/50 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-indigo-600 text-white font-mono font-bold text-xs">
                CÂU {currentQIndex + 1}/{questions.length}
              </span>
              <span className="text-xs font-bold text-amber-300">
                Lượt của: {TEAMS.find((t) => t.id === selectedTeam)?.name}
              </span>
            </div>

            {revealed && (
              <button
                onClick={handleNextQuestion}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer animate-pulse"
              >
                <span>Câu Tiếp Theo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          <p className="text-base md:text-lg font-bold text-white leading-relaxed">
            {currentQ.question}
          </p>

          {/* 4 Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {currentQ.options.map((opt) => {
              const isCorrect = opt.key === currentQ.correctAnswer;
              return (
                <button
                  key={opt.key}
                  disabled={revealed}
                  onClick={() => handleAnswerOption(opt.key)}
                  className={`p-4 rounded-2xl border text-left font-bold text-sm flex items-center gap-3 transition-all cursor-pointer ${
                    revealed
                      ? isCorrect
                        ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
                        : 'bg-slate-950/40 border-slate-800 text-slate-500'
                      : 'bg-slate-800 hover:bg-indigo-600/30 border-slate-700 hover:border-indigo-400 text-slate-100 active:scale-95'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs font-mono shrink-0 ${
                      revealed && isCorrect
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {opt.key}
                  </span>
                  <span>{opt.text}</span>
                </button>
              );
            })}
          </div>

          {revealed && currentQ.explanation && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
              <span className="font-bold shrink-0">💡 Giải thích:</span>
              <span>{currentQ.explanation}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ========================================================================= */
/* GAME 2: VÒNG QUAY MAY MẮN (LUCKY WHEEL OF FORTUNE)                        */
/* ========================================================================= */
interface LuckyWheelGameProps {
  classroom?: ClassroomGroup | null;
  questions: QuizQuestion[];
}

const DEFAULT_SLICES = [
  '⭐ 100 Điểm',
  '🎯 Trả lời câu hỏi',
  '🔥 Nhân đôi điểm',
  '🎁 Quà may mắn',
  '⚡ Thử thách nhanh',
  '🍀 200 Điểm',
  '🌟 Cơ hội bất ngờ',
  '🏆 500 Điểm',
];

const LuckyWheelGame: React.FC<LuckyWheelGameProps> = ({ classroom, questions }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [wheelMode, setWheelMode] = useState<'students' | 'rewards'>('students');
  const [winnerResult, setWinnerResult] = useState<string | null>(null);
  const [rotationAngle, setRotationAngle] = useState<number>(0);

  // Student list from classroom or fallback names
  const studentNames =
    classroom?.students && classroom.students.length > 0
      ? classroom.students.map((s) => s.name)
      : [
          'Nguyễn Văn An',
          'Trần Thị Bình',
          'Lê Hoàng Cường',
          'Phạm Diệu Dung',
          'Vũ Tuấn Đạt',
          'Đỗ Mai Hương',
          'Bùi Quốc Khánh',
          'Hoàng Thảo Linh',
        ];

  const slices = wheelMode === 'students' ? studentNames : DEFAULT_SLICES;

  // Draw the wheel on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    const numSlices = slices.length;
    const arc = (2 * Math.PI) / numSlices;

    ctx.clearRect(0, 0, width, height);

    // Colors palette
    const sliceColors = [
      '#6366f1',
      '#ec4899',
      '#f59e0b',
      '#10b981',
      '#8b5cf6',
      '#06b6d4',
      '#f97316',
      '#14b8a6',
    ];

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotationAngle * Math.PI) / 180);

    for (let i = 0; i < numSlices; i++) {
      const angle = i * arc;
      ctx.beginPath();
      ctx.fillStyle = sliceColors[i % sliceColors.length];
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, angle, angle + arc);
      ctx.lineTo(0, 0);
      ctx.fill();
      ctx.stroke();

      // Text label
      ctx.save();
      ctx.rotate(angle + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      const text = slices[i].length > 18 ? slices[i].slice(0, 16) + '...' : slices[i];
      ctx.fillText(text, radius - 20, 5);
      ctx.restore();
    }

    ctx.restore();

    // Center pin
    ctx.beginPath();
    ctx.arc(centerX, centerY, 22, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e1b4b';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#facc15';
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('QUAY', centerX, centerY);
  }, [slices, rotationAngle]);

  const handleSpin = () => {
    if (isSpinning) return;
    setIsSpinning(true);
    setWinnerResult(null);

    const randomDegrees = 1440 + Math.floor(Math.random() * 1800); // 4 to 9 full spins
    const finalAngle = rotationAngle + randomDegrees;

    const startTime = performance.now();
    const duration = 4500; // 4.5s smooth decelerating spin

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = rotationAngle + randomDegrees * ease;
      setRotationAngle(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        // Calculate winning slice at top needle (270 deg or 90 deg)
        const normalizedAngle = (360 - (current % 360)) % 360;
        const sliceAngle = 360 / slices.length;
        const winnerIndex = Math.floor(normalizedAngle / sliceAngle) % slices.length;
        const winner = slices[winnerIndex];
        setWinnerResult(winner);

        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
        });
      }
    };

    requestAnimationFrame(animate);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-center gap-8 animate-fade-in p-4">
      {/* Canvas Wheel Area */}
      <div className="relative flex flex-col items-center">
        {/* Top Pointer Needle */}
        <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[28px] border-t-amber-400 drop-shadow-lg z-20 -mb-3" />

        <div className="p-3 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 shadow-2xl border-4 border-slate-900">
          <canvas
            ref={canvasRef}
            width={380}
            height={380}
            className="rounded-full shadow-inner block"
          />
        </div>

        <button
          onClick={handleSpin}
          disabled={isSpinning}
          className="mt-6 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-base shadow-2xl transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
        >
          <Sparkles className="w-5 h-5 text-slate-950" />
          <span>{isSpinning ? 'Đang Quay Vòng...' : 'NHẤN ĐỂ QUAY VÒNG'}</span>
        </button>
      </div>

      {/* Control Panel & Winner Announcement */}
      <div className="flex-1 space-y-5 max-w-md w-full">
        {/* Mode Selector */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <label className="text-xs font-black uppercase text-slate-400">Chọn Kiểu Vòng Quay</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setWheelMode('students')}
              className={`p-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                wheelMode === 'students'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Gọi Tên Học Sinh ({slices.length})</span>
            </button>
            <button
              onClick={() => setWheelMode('rewards')}
              className={`p-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                wheelMode === 'rewards'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Điểm & Thưởng</span>
            </button>
          </div>
        </div>

        {/* Winner Card */}
        {winnerResult && (
          <div className="p-6 rounded-3xl bg-gradient-to-b from-indigo-900/90 to-purple-900/90 border-2 border-amber-400 shadow-2xl text-center space-y-2 animate-fade-in">
            <Trophy className="w-10 h-10 text-amber-400 mx-auto animate-bounce" />
            <span className="text-xs font-black uppercase tracking-widest text-amber-300">
              KẾT QUẢ VÒNG QUAY
            </span>
            <h4 className="text-2xl font-black text-white">{winnerResult}</h4>
            <p className="text-xs text-indigo-200">
              Xin chúc mừng! Hãy mời bạn thực hiện thử thách hoặc nhận điểm thưởng!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ========================================================================= */
/* GAME 3: MẢNH GHÉP BÍ MẬT (MYSTERY PUZZLE REVEAL)                          */
/* ========================================================================= */
interface MysteryPuzzleGameProps {
  questions: QuizQuestion[];
}

const MysteryPuzzleGame: React.FC<MysteryPuzzleGameProps> = ({ questions }) => {
  const [flippedTiles, setFlippedTiles] = useState<number[]>([]);
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const TOTAL_TILES = 6;
  const currentQ = questions[(selectedTile || 0) % questions.length] || questions[0];

  const handleTileClick = (tileIdx: number) => {
    if (flippedTiles.includes(tileIdx)) return;
    setSelectedTile(tileIdx);
    setSelectedOpt(null);
    setFeedback(null);
  };

  const handleCheckAnswer = (optKey: string) => {
    setSelectedOpt(optKey);
    const isCorrect = optKey === currentQ.correctAnswer;

    if (isCorrect) {
      setFeedback('correct');
      if (selectedTile !== null && !flippedTiles.includes(selectedTile)) {
        setFlippedTiles((prev) => [...prev, selectedTile]);
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.7 },
        });
      }
    } else {
      setFeedback('wrong');
    }
  };

  const handleResetPuzzle = () => {
    setFlippedTiles([]);
    setSelectedTile(null);
    setFeedback(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col md:flex-row gap-6 animate-fade-in">
      {/* Puzzle Board (Left) */}
      <div className="flex-1 p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col items-center">
        <div className="w-full flex items-center justify-between mb-4">
          <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            <span>Mảnh Ghép Bí Ẩn • {flippedTiles.length}/{TOTAL_TILES} đã mở</span>
          </span>
          <button
            onClick={handleResetPuzzle}
            className="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold"
          >
            Đóng Lại
          </button>
        </div>

        {/* The 6-tile grid hiding a secret educational illustration / theorem */}
        <div className="relative w-full max-w-md aspect-4/3 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl grid grid-cols-3 grid-rows-2 gap-1 p-1 bg-slate-950">
          {/* Background Secret Picture (Solar system & science) */}
          <div className="absolute inset-0 z-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-indigo-900 via-purple-950 to-slate-950">
            <div className="text-5xl mb-2">🪐 ☀️ 🔬 📐</div>
            <h4 className="text-xl font-black text-amber-300">THẾ GIỚI KHOA HỌC</h4>
            <p className="text-xs text-indigo-200 mt-1">
              &ldquo;Tri thức là sức mạnh vĩ đại nhất của nhân loại&rdquo;
            </p>
          </div>

          {/* 6 Covering Mystery Tiles */}
          {Array.from({ length: TOTAL_TILES }).map((_, idx) => {
            const isFlipped = flippedTiles.includes(idx);
            const isCurrent = selectedTile === idx;

            return (
              <div
                key={idx}
                onClick={() => handleTileClick(idx)}
                className={`relative z-10 rounded-xl flex items-center justify-center transition-all cursor-pointer font-black text-xl select-none ${
                  isFlipped
                    ? 'opacity-0 pointer-events-none'
                    : isCurrent
                    ? 'bg-indigo-600 text-white ring-4 ring-amber-400 scale-95 shadow-2xl'
                    : 'bg-gradient-to-br from-slate-800 to-slate-900 text-amber-400 border border-slate-700 hover:from-indigo-900 hover:to-slate-800'
                }`}
              >
                <span>#{idx + 1}</span>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-slate-400 mt-4 text-center">
          Nhấp vào ô số để trả lời câu hỏi và mở mảnh ghép bí mật!
        </p>
      </div>

      {/* Question Challenge (Right) */}
      <div className="flex-1 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col justify-between space-y-4">
        {selectedTile === null ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <HelpCircle className="w-12 h-12 mb-3 text-indigo-400 opacity-60" />
            <p className="font-bold text-slate-300">Chưa chọn mảnh ghép</p>
            <p className="text-xs text-slate-500 mt-1">Hãy nhấp vào một mảnh ghép (1-6) bên trái</p>
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-xl bg-amber-500 text-slate-950 font-black text-xs font-mono">
                THỬ THÁCH MẢNH GHÉP #{selectedTile + 1}
              </span>
              {feedback === 'correct' && (
                <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  ĐÚNG! ĐÃ MỞ MẢNH GHÉP
                </span>
              )}
            </div>

            <p className="text-base font-bold text-white leading-relaxed">{currentQ.question}</p>

            <div className="space-y-2">
              {currentQ.options.map((opt) => {
                const isSelected = selectedOpt === opt.key;
                const isCorrect = opt.key === currentQ.correctAnswer;

                return (
                  <button
                    key={opt.key}
                    onClick={() => handleCheckAnswer(opt.key)}
                    className={`w-full p-3 rounded-xl border text-left font-bold text-xs flex items-center gap-2.5 transition-all cursor-pointer ${
                      feedback
                        ? isCorrect
                          ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
                          : isSelected
                          ? 'bg-rose-600/30 border-rose-400 text-rose-200'
                          : 'bg-slate-950/40 border-slate-800 text-slate-500'
                        : 'bg-slate-800 hover:bg-indigo-600/30 border-slate-700 hover:border-indigo-400 text-slate-200'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-lg bg-slate-700 text-slate-200 font-mono text-xs flex items-center justify-center font-bold">
                      {opt.key}
                    </span>
                    <span>{opt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ========================================================================= */
/* GAME 4: AI LÀ TRIỆU PHÚ (CLASSROOM MILLIONAIRE ARENA)                     */
/* ========================================================================= */
interface MillionaireGameProps {
  questions: QuizQuestion[];
}

const LADDER = [
  { level: 5, reward: '100.000 Điểm (Về Đích)', safe: true },
  { level: 4, reward: '50.000 Điểm', safe: false },
  { level: 3, reward: '20.000 Điểm (Mốc An Toàn)', safe: true },
  { level: 2, reward: '10.000 Điểm', safe: false },
  { level: 1, reward: '5.000 Điểm', safe: false },
];

const MillionaireGame: React.FC<MillionaireGameProps> = ({ questions }) => {
  const [level, setLevel] = useState<number>(1);
  const [used5050, setUsed5050] = useState<boolean>(false);
  const [usedAudience, setUsedAudience] = useState<boolean>(false);
  const [disabledOptions, setDisabledOptions] = useState<string[]>([]);
  const [audiencePoll, setAudiencePoll] = useState<Record<string, number> | null>(null);
  const [answeredState, setAnsweredState] = useState<'pending' | 'correct' | 'wrong'>('pending');

  const currentQ = questions[(level - 1) % questions.length] || questions[0];

  const handleUse5050 = () => {
    if (used5050) return;
    setUsed5050(true);
    const wrongOptions = currentQ.options
      .filter((o) => o.key !== currentQ.correctAnswer)
      .map((o) => o.key);
    // Hide 2 wrong options
    setDisabledOptions([wrongOptions[0], wrongOptions[1]]);
  };

  const handleUseAudience = () => {
    if (usedAudience) return;
    setUsedAudience(true);
    // Simulate audience vote with correct option weighted high
    const correctKey = currentQ.correctAnswer;
    const poll: Record<string, number> = { A: 10, B: 15, C: 12, D: 8 };
    poll[correctKey] = 65;
    setAudiencePoll(poll);
  };

  const handleSelectOption = (optKey: string) => {
    if (answeredState !== 'pending') return;

    if (optKey === currentQ.correctAnswer) {
      setAnsweredState('correct');
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } else {
      setAnsweredState('wrong');
    }
  };

  const handleAdvance = () => {
    if (level < LADDER.length) {
      setLevel((prev) => prev + 1);
      setDisabledOptions([]);
      setAudiencePoll(null);
      setAnsweredState('pending');
    }
  };

  const handleReset = () => {
    setLevel(1);
    setUsed5050(false);
    setUsedAudience(false);
    setDisabledOptions([]);
    setAudiencePoll(null);
    setAnsweredState('pending');
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col md:flex-row gap-6 animate-fade-in">
      {/* Left: Question Arena & Lifelines */}
      <div className="flex-1 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col justify-between space-y-5">
        {/* Lifelines Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <span className="text-xs font-black uppercase tracking-wider text-indigo-400">
            Quyền Trợ Giúp
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUse5050}
              disabled={used5050}
              className={`px-3 py-1 rounded-xl font-bold text-xs flex items-center gap-1 transition-all ${
                used5050
                  ? 'bg-slate-800 text-slate-600 line-through'
                  : 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/40 cursor-pointer'
              }`}
            >
              <span>50:50</span>
            </button>
            <button
              onClick={handleUseAudience}
              disabled={usedAudience}
              className={`px-3 py-1 rounded-xl font-bold text-xs flex items-center gap-1 transition-all ${
                usedAudience
                  ? 'bg-slate-800 text-slate-600 line-through'
                  : 'bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-slate-950 border border-cyan-500/40 cursor-pointer'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Hỏi Ý Kiến Cả Lớp</span>
            </button>
          </div>
        </div>

        {/* Audience Poll results if used */}
        {audiencePoll && (
          <div className="p-3 rounded-2xl bg-cyan-950/60 border border-cyan-500/40 space-y-1.5 text-xs text-cyan-200">
            <span className="font-bold">📊 Kết quả khảo sát học sinh trong lớp:</span>
            <div className="grid grid-cols-4 gap-2 text-center font-mono font-bold text-[11px]">
              {Object.entries(audiencePoll).map(([key, val]) => (
                <div key={key} className="p-1.5 rounded-lg bg-cyan-900/60">
                  {key}: {val}%
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Question Prompt */}
        <div className="space-y-3">
          <div className="text-xs font-mono font-black text-amber-400">
            CÂU HỎI MỐC SỐ {level} • {LADDER.find((l) => l.level === level)?.reward}
          </div>
          <h3 className="text-lg md:text-xl font-black text-white leading-relaxed">
            {currentQ.question}
          </h3>
        </div>

        {/* 4 Diamond-style options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {currentQ.options.map((opt) => {
            const isDisabled = disabledOptions.includes(opt.key);
            const isCorrect = opt.key === currentQ.correctAnswer;

            return (
              <button
                key={opt.key}
                disabled={isDisabled || answeredState !== 'pending'}
                onClick={() => handleSelectOption(opt.key)}
                className={`p-3.5 rounded-2xl border text-left font-bold text-xs md:text-sm flex items-center gap-2.5 transition-all ${
                  isDisabled
                    ? 'opacity-20 pointer-events-none'
                    : answeredState !== 'pending'
                    ? isCorrect
                      ? 'bg-emerald-600/40 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400'
                      : 'bg-slate-950/50 border-slate-800 text-slate-600'
                    : 'bg-slate-800/90 hover:bg-indigo-600/40 border-slate-700 hover:border-indigo-400 text-slate-100 cursor-pointer active:scale-95'
                }`}
              >
                <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-mono text-xs flex items-center justify-center font-bold shrink-0">
                  {opt.key}
                </span>
                <span>{opt.text}</span>
              </button>
            );
          })}
        </div>

        {/* Controls next/reset */}
        {answeredState !== 'pending' && (
          <div className="pt-2 flex items-center justify-between">
            <span
              className={`font-black text-sm ${
                answeredState === 'correct' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {answeredState === 'correct' ? '🎉 CHÍNH XÁC!' : '❌ RẤT TIẾC, CHƯA CHÍNH XÁC!'}
            </span>
            {answeredState === 'correct' && level < LADDER.length && (
              <button
                onClick={handleAdvance}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <span>Chinh Phục Mốc Tiếp Theo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {answeredState === 'wrong' && (
              <button
                onClick={handleReset}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Thử Lại
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right: The Millionaire Ladder */}
      <div className="w-full md:w-64 p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col justify-between">
        <span className="text-xs font-black uppercase text-amber-400 mb-3 block">
          Thang Điểm Triệu Phú
        </span>

        <div className="space-y-2">
          {LADDER.map((step) => {
            const isCurrent = step.level === level;
            const isPassed = step.level < level;

            return (
              <div
                key={step.level}
                className={`p-2.5 rounded-xl text-xs font-black flex items-center justify-between transition-all ${
                  isCurrent
                    ? 'bg-amber-500 text-slate-950 shadow-lg scale-105'
                    : isPassed
                    ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                    : step.safe
                    ? 'bg-slate-800 text-amber-300 border border-amber-500/30'
                    : 'bg-slate-950/60 text-slate-400'
                }`}
              >
                <span className="font-mono">{step.level}</span>
                <span>{step.reward}</span>
              </div>
            );
          })}
        </div>

        <button
          onClick={handleReset}
          className="mt-6 w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
        >
          Làm Mới Trò Chơi
        </button>
      </div>
    </div>
  );
};
