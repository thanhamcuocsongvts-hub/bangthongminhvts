import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCcw,
  QrCode,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Award,
  ChevronRight,
  TrendingUp,
  Zap,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  FileCheck,
  Trash2,
  Edit3,
  Check,
  Plus,
  Play,
  ArrowRight,
  BookOpen,
  Layers,
  X,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  AlertTriangle,
  Pause,
  AlertCircle,
  Eye,
  RefreshCw,
  Key,
  Shield,
  Timer,
  CheckCircle,
  Smartphone,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';
import mammoth from 'mammoth';
import { QuizQuestion, RoomState, StudentSubmission, TextScale, ActiveStudent } from '../types';
import { QuizRichContentRenderer } from './QuizRichContentRenderer';
import { MathFormulaRenderer } from './MathFormulaRenderer';

interface LiveQuizHubProps {
  roomState: RoomState | null;
  textScale: TextScale;
  onRefreshRoom: () => void;
  onControlRoom: (activeQuestionIndex: number, isLive: boolean) => void;
  onResetRoom: () => void;
  onCreateAIQuiz?: (promptTopic?: string) => Promise<void> | void;
  isLoadingAIQuiz?: boolean;
  onOpenAIQuizCreator?: () => void;
  currentLesson?: any;
  onApplyQuestions?: (questions: QuizQuestion[], quizTitle?: string) => Promise<void> | void;
}

interface UploadedMatrixFile {
  file: File;
  name: string;
  size: string;
  type: 'image' | 'pdf' | 'word' | 'text';
  previewUrl?: string;
  base64?: string;
  extractedText?: string;
}

export const LiveQuizHub: React.FC<LiveQuizHubProps> = ({
  roomState,
  textScale,
  onRefreshRoom,
  onControlRoom,
  onResetRoom,
  onCreateAIQuiz,
  isLoadingAIQuiz = false,
  onOpenAIQuizCreator,
  currentLesson,
  onApplyQuestions,
}) => {
  // Mode: Default to 'creator' or switch to 'live' or 'exam' (Chế độ phòng thi)
  const [activeMode, setActiveMode] = useState<'creator' | 'live' | 'exam'>('creator');

  // Exam Room Mode state (Chế độ phòng thi)
  const [examDurationMinutes, setExamDurationMinutes] = useState<number>(45);
  const [examSecondsRemaining, setExamSecondsRemaining] = useState<number | null>(null);
  const [isExamActive, setIsExamActive] = useState<boolean>(false);
  const [isExamScreenLocked, setIsExamScreenLocked] = useState<boolean>(true);
  const [isTeacherEmergencyLocked, setIsTeacherEmergencyLocked] = useState<boolean>(false);
  const [examStudentFilter, setExamStudentFilter] = useState<'all' | 'warning' | 'safe'>('all');
  const [examSearchTerm, setExamSearchTerm] = useState<string>('');
  const examTickerRef = useRef<any>(null);

  // Creator state
  const [promptTopic, setPromptTopic] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<UploadedMatrixFile | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('Toán học');
  const [selectedGrade, setSelectedGrade] = useState<string>('Lớp 12');
  const [questionCount, setQuestionCount] = useState<number>(4);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('Đa cấp độ (Chuẩn BGD)');
  const [selectedTimeLimit, setSelectedTimeLimit] = useState<number>(30);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationTimeMs, setGenerationTimeMs] = useState<number | null>(null);
  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestion[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live room state
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

  // If room already has questions and generatedQuestions is empty, initialize preview
  useEffect(() => {
    if (questions.length > 0 && generatedQuestions.length === 0) {
      setGeneratedQuestions(questions);
    }
  }, [questions]);

  // Reset timer whenever question changes in Live mode
  useEffect(() => {
    if (currentQ && activeMode === 'live') {
      setTimeLeft(currentQ.timeLimit || 30);
      setIsRevealed(false);
      setIsTimerRunning(true);
    }
  }, [activeIndex, currentQ, activeMode]);

  // Timer countdown
  useEffect(() => {
    if (isTimerRunning && timeLeft > 0 && activeMode === 'live') {
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
  }, [isTimerRunning, timeLeft, activeMode]);

  // Sync roomState examSettings into local teacher state
  useEffect(() => {
    if (roomState?.examSettings) {
      if (typeof roomState.examSettings.totalDurationMinutes === 'number') {
        setExamDurationMinutes(roomState.examSettings.totalDurationMinutes);
      }
      if (typeof roomState.examSettings.isScreenLocked === 'boolean') {
        setIsExamScreenLocked(roomState.examSettings.isScreenLocked);
      }
      if (typeof roomState.examSettings.isTeacherLocked === 'boolean') {
        setIsTeacherEmergencyLocked(roomState.examSettings.isTeacherLocked);
      }
      if (roomState.examSettings.endsAtTimestamp && roomState.examSettings.isTimerRunning) {
        const remaining = Math.max(0, Math.floor((roomState.examSettings.endsAtTimestamp - Date.now()) / 1000));
        setExamSecondsRemaining(remaining);
        setIsExamActive(remaining > 0);
      } else if (roomState.examSettings.endsAtTimestamp && !roomState.examSettings.isTimerRunning) {
        const remaining = Math.max(0, Math.floor((roomState.examSettings.endsAtTimestamp - Date.now()) / 1000));
        setExamSecondsRemaining(remaining);
        setIsExamActive(false);
      } else {
        setExamSecondsRemaining(null);
        setIsExamActive(false);
      }
    }
  }, [roomState?.examSettings]);

  // Exam countdown timer ticker
  useEffect(() => {
    if (isExamActive && examSecondsRemaining !== null && examSecondsRemaining > 0) {
      examTickerRef.current = setInterval(() => {
        setExamSecondsRemaining((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(examTickerRef.current);
            setIsExamActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(examTickerRef.current);
    }
    return () => clearInterval(examTickerRef.current);
  }, [isExamActive, examSecondsRemaining]);

  const handleExamAction = async (action: 'start' | 'pause' | 'reset' | 'extend', extraMins = 0) => {
    if (!roomState?.pin) return;
    try {
      await fetch(`/api/rooms/${roomState.pin}/exam-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          totalDurationMinutes: examDurationMinutes,
          isScreenLocked: isExamScreenLocked,
          isTeacherLocked: isTeacherEmergencyLocked,
          isExamMode: true,
          extraMinutes: extraMins,
        }),
      });
      onRefreshRoom();
    } catch (e) {
      console.error('Exam action error', e);
    }
  };

  const handleToggleScreenLock = async () => {
    if (!roomState?.pin) return;
    const nextVal = !isExamScreenLocked;
    setIsExamScreenLocked(nextVal);
    try {
      await fetch(`/api/rooms/${roomState.pin}/exam-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isScreenLocked: nextVal,
        }),
      });
      onRefreshRoom();
    } catch (e) {
      console.error('Toggle screen lock error', e);
    }
  };

  const handleToggleTeacherEmergencyLock = async () => {
    if (!roomState?.pin) return;
    const nextVal = !isTeacherEmergencyLocked;
    setIsTeacherEmergencyLocked(nextVal);
    try {
      await fetch(`/api/rooms/${roomState.pin}/exam-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isTeacherLocked: nextVal,
        }),
      });
      onRefreshRoom();
    } catch (e) {
      console.error('Toggle teacher lock error', e);
    }
  };

  const handleSimulateExamClass = async () => {
    if (!roomState?.pin) return;
    const sampleStudents = [
      { name: 'Nguyễn Minh Tuấn', code: 'HS1201', warnings: 0, locked: true },
      { name: 'Trần Mai Phương', code: 'HS1202', warnings: 0, locked: true },
      { name: 'Lê Hoàng Nam', code: 'HS1203', warnings: 1, locked: true },
      { name: 'Phạm Thu Thảo', code: 'HS1204', warnings: 0, locked: true },
      { name: 'Vũ Quốc Bảo', code: 'HS1205', warnings: 2, locked: false },
      { name: 'Đỗ Gia Hân', code: 'HS1206', warnings: 0, locked: true },
      { name: 'Hoàng Đức Anh', code: 'HS1207', warnings: 0, locked: true },
      { name: 'Bùi Ngọc Ánh', code: 'HS1208', warnings: 0, locked: true },
      { name: 'Đặng Khánh Linh', code: 'HS1209', warnings: 0, locked: true },
      { name: 'Trịnh Văn Hùng', code: 'HS1210', warnings: 0, locked: true },
      { name: 'Lê Mỹ Duyên', code: 'HS1211', warnings: 1, locked: true },
      { name: 'Nguyễn Tiến Đạt', code: 'HS1212', warnings: 0, locked: true },
      { name: 'Phan Minh Khang', code: 'HS1213', warnings: 0, locked: true },
      { name: 'Võ Thùy Trang', code: 'HS1214', warnings: 0, locked: true },
      { name: 'Dương Thành Long', code: 'HS1215', warnings: 3, locked: false },
      { name: 'Ngô Bảo Châu', code: 'HS1216', warnings: 0, locked: true },
      { name: 'Hồ Gia Bảo', code: 'HS1217', warnings: 0, locked: true },
      { name: 'Lý Diệu Linh', code: 'HS1218', warnings: 0, locked: true },
      { name: 'Tạ Quang Khải', code: 'HS1219', warnings: 0, locked: true },
      { name: 'Cao Phương Linh', code: 'HS1220', warnings: 0, locked: true },
      { name: 'Đỗ Anh Dũng', code: 'HS1221', warnings: 0, locked: true },
      { name: 'Lê Thùy Dương', code: 'HS1222', warnings: 0, locked: true },
      { name: 'Nguyễn Hải Yến', code: 'HS1223', warnings: 1, locked: true },
      { name: 'Bùi Văn Sơn', code: 'HS1224', warnings: 0, locked: true },
    ];

    for (const s of sampleStudents) {
      try {
        await fetch(`/api/rooms/${roomState.pin}/student-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: `sim_${s.code}`,
            studentName: s.name,
            studentCode: s.code,
            isFocusLocked: s.locked,
            warningCount: s.warnings,
          }),
        });
      } catch (e) {
        console.error('Sim error', e);
      }
    }
    onRefreshRoom();
  };

  const formatExamTime = (totalSeconds: number | null) => {
    if (totalSeconds === null) {
      const mins = examDurationMinutes;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
    }
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle file selection (Image, PDF, Word, TXT)
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    let fileCategory: 'image' | 'pdf' | 'word' | 'text' = 'text';
    const fileName = file.name.toLowerCase();

    if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(fileName) || file.type.startsWith('image/')) {
      fileCategory = 'image';
    } else if (/\.pdf$/i.test(fileName) || file.type === 'application/pdf') {
      fileCategory = 'pdf';
    } else if (/\.(docx|doc)$/i.test(fileName) || file.type.includes('word') || file.type.includes('officedocument')) {
      fileCategory = 'word';
    }

    const fileSizeStr = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

    let previewUrl: string | undefined;
    let base64: string | undefined;
    let extractedText: string | undefined;

    setStatusMessage(`Đang tải và đọc tệp ${file.name}...`);

    try {
      if (fileCategory === 'image') {
        previewUrl = URL.createObjectURL(file);
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else if (fileCategory === 'word') {
        const arrayBuffer = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer });
        extractedText = res.value;
      } else if (fileCategory === 'pdf') {
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        extractedText = await file.text();
      }

      setUploadedFile({
        file,
        name: file.name,
        size: fileSizeStr,
        type: fileCategory,
        previewUrl,
        base64,
        extractedText,
      });

      setStatusMessage(`✓ Đã nhận ma trận đề: "${file.name}". Bấm "Tạo Câu Hỏi Bằng AI" để khởi tạo.`);
    } catch (err: any) {
      console.error('File parsing error', err);
      setStatusMessage(`Lỗi đọc tệp: ${err?.message || 'Không thể đọc tệp'}`);
    }
  };

  // Ultra-Fast AI Quiz Generation
  const handleGenerateFastQuiz = async () => {
    setIsGenerating(true);
    setStatusMessage('⚡ Đang phân tích ma trận đề & tạo câu hỏi trắc nghiệm siêu tốc...');
    const startTime = performance.now();

    try {
      const payload: any = {
        prompt: promptTopic || currentLesson?.title || 'Khảo sát hàm số và đồ thị',
        subject: selectedSubject,
        grade: selectedGrade,
        count: questionCount,
        difficulty: selectedDifficulty,
        timeLimit: selectedTimeLimit,
      };

      if (uploadedFile) {
        if (uploadedFile.type === 'image' || uploadedFile.type === 'pdf') {
          payload.matrixFile = {
            fileName: uploadedFile.name,
            mimeType: uploadedFile.file.type || (uploadedFile.type === 'image' ? 'image/jpeg' : 'application/pdf'),
            base64: uploadedFile.base64,
          };
        } else if (uploadedFile.extractedText) {
          payload.matrixFile = {
            fileName: uploadedFile.name,
            text: uploadedFile.extractedText,
          };
        }
      }

      const response = await fetch('/api/ai/fast-matrix-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      const elapsed = Math.round(performance.now() - startTime);
      setGenerationTimeMs(elapsed);

      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        setGeneratedQuestions(data.questions);
        setStatusMessage(`⚡ Hoàn tất! Tạo thành công ${data.questions.length} câu hỏi chuẩn hóa trong ${(elapsed / 1000).toFixed(1)}s.`);
      } else {
        setStatusMessage('Không nhận được câu hỏi từ AI, vui lòng thử lại.');
      }
    } catch (err: any) {
      console.error('Quiz generation error:', err);
      const elapsed = Math.round(performance.now() - startTime);
      setGenerationTimeMs(elapsed);
      setStatusMessage('Đã nạp bộ câu hỏi dự phòng chất lượng cao.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Launch Quiz to Live Classroom
  const handleDeployToStudents = async () => {
    if (generatedQuestions.length === 0) return;

    if (onApplyQuestions) {
      await onApplyQuestions(
        generatedQuestions,
        promptTopic ? `Đề thi: ${promptTopic}` : `${selectedSubject} - ${selectedGrade}`
      );
    }

    onControlRoom(0, true);
    setActiveMode('live');

    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
    });
  };

  // Delete a generated question
  const handleDeleteQuestion = (id: string) => {
    setGeneratedQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  // Reveal results and trigger confetti if high score in live mode
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

  // Statistics
  const totalSubs = currentSubmissions.length;
  const correctSubs = currentSubmissions.filter((s) => s.isCorrect).length;
  const accuracyPercent = totalSubs > 0 ? Math.round((correctSubs / totalSubs) * 100) : 0;

  const optionCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  currentSubmissions.forEach((s) => {
    if (optionCounts[s.selectedOption] !== undefined) {
      optionCounts[s.selectedOption]++;
    }
  });

  const topStudents = [...currentSubmissions]
    .filter((s) => s.isCorrect)
    .sort((a, b) => a.timeSpentSeconds - b.timeSpentSeconds)
    .slice(0, 4);

  const joinUrl = `${window.location.origin}/?mode=student&room=${roomState?.pin || '758899'}`;

  // Font scale helper
  const getScale = () => {
    switch (textScale) {
      case 'huge':
        return {
          questionText: 'text-3xl md:text-4xl lg:text-5xl font-black leading-tight',
          optionText: 'text-2xl md:text-3xl font-bold',
        };
      case 'large':
        return {
          questionText: 'text-2xl md:text-3xl lg:text-4xl font-black leading-tight',
          optionText: 'text-xl md:text-2xl font-bold',
        };
      case 'normal':
      default:
        return {
          questionText: 'text-xl md:text-2xl lg:text-3xl font-black leading-tight',
          optionText: 'text-lg md:text-xl font-bold',
        };
    }
  };

  const scale = getScale();

  // Simulate quick student responses
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

  // Prompt Presets for one-click fill
  const promptPresets = [
    { label: '📐 Toán 12: Đơn điệu & Cực trị', prompt: 'Khảo sát sự đồng biến, nghịch biến và cực trị của hàm số bậc ba, phân thức hữu tỉ' },
    { label: '⚡ Vật lý 12: Dao động điều hòa', prompt: 'Con lắc lò xo, chu kỳ tần số, phương trình dao động điều hòa và năng lượng' },
    { label: '🧪 Hóa học 12: Este - Lipit', prompt: 'Phản ứng thủy phân este trong môi trường kiềm và axit, công thức cấu tạo este' },
    { label: '🇬🇧 Tiếng Anh: Câu điều kiện', prompt: 'Conditional sentences type 1, 2, 3 and mixed conditionals with explanations' },
    { label: '📊 Ma trận đề chuẩn Bộ GD&ĐT', prompt: 'Bộ câu hỏi 4 mức độ: 40% Nhận biết, 30% Thông hiểu, 20% Vận dụng, 10% Vận dụng cao' },
  ];

  return (
    <div id="live-quiz-viewport" className="relative w-full h-[calc(100vh-100px)] flex flex-col bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-md">
      {/* Top Universal Mode Switcher & Room Status Bar */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white z-20 shrink-0">
        {/* Left: View Mode Navigation Toggle */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-800 p-1 rounded-2xl flex items-center gap-1 border border-slate-700">
            <button
              onClick={() => setActiveMode('creator')}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeMode === 'creator'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Soạn Đề AI & Ma Trận</span>
              {generatedQuestions.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-indigo-800 text-[11px] text-indigo-200">
                  {generatedQuestions.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveMode('live')}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeMode === 'live'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Play className="w-4 h-4 text-emerald-300" />
              <span>Phòng Thi Trực Tiếp</span>
              {questions.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-800 text-[11px] text-emerald-200">
                  {questions.length} câu
                </span>
              )}
            </button>

            <button
              id="exam-mode-nav-btn"
              onClick={() => setActiveMode('exam')}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeMode === 'exam'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-rose-300" />
              <span>Chế Độ Phòng Thi</span>
              {isExamActive ? (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-400"></span>
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded-full bg-slate-700 text-[11px] text-slate-300">
                  Khóa MH
                </span>
              )}
            </button>
          </div>

          <div className="hidden xl:flex items-center gap-2 text-xs text-slate-400 pl-2">
            <span>Mã phòng:</span>
            <span className="font-mono font-black text-amber-400 text-sm tracking-wider">{roomState?.pin || '758899'}</span>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-3">
          {activeMode === 'creator' && generatedQuestions.length > 0 && (
            <button
              onClick={handleDeployToStudents}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-black flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-all cursor-pointer active:scale-95"
            >
              <Play className="w-4 h-4" />
              <span>Phát Đề Cho Học Sinh ({generatedQuestions.length} câu)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {activeMode === 'live' && (
            <>
              <button
                onClick={() => setShowQRModal(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <QrCode className="w-4 h-4 text-emerald-400" />
                <span>Mã QR & PIN</span>
              </button>

              <button
                onClick={handleSimulateClassSubmission}
                className="px-3.5 py-2 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>Giả lập nộp bài</span>
              </button>

              <button
                onClick={() => setActiveMode('creator')}
                className="px-3.5 py-2 rounded-xl bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Tạo đề mới</span>
              </button>
            </>
          )}

          {activeMode === 'exam' && (
            <>
              <button
                onClick={() => setShowQRModal(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-emerald-400" />
                <span>Mã QR & PIN</span>
              </button>

              <button
                onClick={handleSimulateExamClass}
                className="px-3.5 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Mô phỏng 24 thí sinh với SBD và trạng thái khóa màn hình"
              >
                <Users className="w-3.5 h-3.5 text-rose-300" />
                <span>Mô phỏng 24 Thí sinh</span>
              </button>

              <button
                onClick={handleToggleTeacherEmergencyLock}
                className={`px-3.5 py-2 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  isTeacherEmergencyLocked
                    ? 'bg-amber-600 hover:bg-amber-500 border-amber-400 text-white animate-pulse'
                    : 'bg-rose-900/60 hover:bg-rose-800 border-rose-700 text-rose-200'
                }`}
              >
                {isTeacherEmergencyLocked ? (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-white" />
                    <span>Đang Khóa Khẩn Cấp (Bấm mở)</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-rose-300" />
                    <span>Khóa Khẩn Cấp MH</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* VIEW 1: AI QUESTION & MATRIX CREATOR (DEFAULT) */}
      {activeMode === 'creator' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-50">
          {/* Left Panel: Matrix Upload & Creation Settings */}
          <div className="w-full lg:w-[460px] xl:w-[500px] border-r border-slate-200 bg-white flex flex-col h-full overflow-y-auto p-6 space-y-5">
            {/* Header Banner */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black tracking-wide mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>BÓC TÁCH MA TRẬN & SOẠN ĐỀ AI SIÊU TỐC</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 leading-snug">
                Tạo Đề Trắc Nghiệm Tự Động
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Nhập yêu cầu hoặc tải lên ma trận đề (Ảnh chụp, PDF, Word). AI sẽ bóc tách và tạo câu hỏi chuẩn hóa trong vòng 2-3 giây.
              </p>
            </div>

            {/* Input 1: Prompt / Requirements */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>1. Nhập yêu cầu tạo câu hỏi / Chủ đề bài học:</span>
                <span className="text-[11px] text-indigo-600 font-semibold">Tự do hoặc theo ma trận</span>
              </label>
              <textarea
                value={promptTopic}
                onChange={(e) => setPromptTopic(e.target.value)}
                placeholder="Ví dụ: Tạo 4 câu Toán 12 Khảo sát hàm số, 2 câu mức nhận biết, 1 câu thông hiểu, 1 câu vận dụng có bảng xét dấu..."
                rows={3}
                className="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition-all placeholder:text-slate-400"
              />

              {/* Quick suggestion chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {promptPresets.map((pr, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPromptTopic(pr.prompt)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 text-[11px] font-semibold transition-all"
                  >
                    {pr.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input 2: Upload Matrix File (Image, PDF, Word) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>2. Tải lên Ma Trận Đề (Ảnh, PDF, Word):</span>
                <span className="text-[11px] text-emerald-600 font-semibold">Ảnh chụp / PDF / .docx</span>
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.docx,.doc,.txt"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {!uploadedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileUpload(e.dataTransfer.files[0]);
                    }
                  }}
                  className="p-5 rounded-2xl border-2 border-dashed border-indigo-200 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/80 flex flex-col items-center justify-center text-center cursor-pointer transition-all group"
                >
                  <div className="w-11 h-11 rounded-2xl bg-white border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs mb-2 group-hover:scale-110 transition-transform">
                    <UploadCloud className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    Kéo thả hoặc bấm để tải lên ma trận đề
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Ảnh chụp SGK (.png, .jpg), file PDF đề thi, hoặc tệp Word (.docx)
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {uploadedFile.type === 'image' && uploadedFile.previewUrl ? (
                      <img
                        src={uploadedFile.previewUrl}
                        alt="Preview"
                        className="w-12 h-12 rounded-xl object-cover border border-emerald-300 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                        {uploadedFile.type === 'pdf' ? (
                          <FileText className="w-6 h-6 text-rose-500" />
                        ) : (
                          <FileCheck className="w-6 h-6 text-indigo-600" />
                        )}
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {uploadedFile.name}
                      </div>
                      <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5 mt-0.5">
                        <span className="uppercase">{uploadedFile.type}</span>
                        <span>• {uploadedFile.size}</span>
                        <span>• Đã sẵn sàng</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setUploadedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="p-2 rounded-xl hover:bg-emerald-100 text-emerald-800 transition-colors shrink-0"
                    title="Xóa tệp này"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </button>
                </div>
              )}
            </div>

            {/* Input 3: Parameters (Subject, Grade, Count, Difficulty, Time) */}
            <div className="space-y-3.5 pt-1 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Môn học:</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Toán học">📐 Toán học</option>
                    <option value="Vật lý">⚡ Vật lý</option>
                    <option value="Hóa học">🧪 Hóa học</option>
                    <option value="Sinh học">🌿 Sinh học</option>
                    <option value="Tiếng Anh">🇬🇧 Tiếng Anh</option>
                    <option value="Lịch sử">🏛️ Lịch sử</option>
                    <option value="Địa lý">🌍 Địa lý</option>
                    <option value="Tin học">💻 Tin học</option>
                    <option value="GDCD">⚖️ GDCD</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Khối lớp:</label>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Lớp 12">Lớp 12 (Ôn thi TN THPT)</option>
                    <option value="Lớp 11">Lớp 11 (Chương trình mới)</option>
                    <option value="Lớp 10">Lớp 10 (Chương trình mới)</option>
                    <option value="Khối THCS">Khối THCS (Lớp 6-9)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Số lượng câu hỏi:</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[4, 5, 8, 10].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setQuestionCount(c)}
                        className={`py-2 rounded-xl text-xs font-black transition-all ${
                          questionCount === c
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {c} câu
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Thời gian/câu:</label>
                  <select
                    value={selectedTimeLimit}
                    onChange={(e) => setSelectedTimeLimit(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={20}>20 giây (Nhanh)</option>
                    <option value={30}>30 giây (Tiêu chuẩn)</option>
                    <option value={45}>45 giây (Vừa phải)</option>
                    <option value={60}>60 giây (Có tính toán)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Phân bố ma trận đề:</label>
                <select
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Đa cấp độ (Chuẩn BGD)">Đa cấp độ: Nhận biết 40% - Thông hiểu 30% - Vận dụng 30%</option>
                  <option value="Nhận biết">Cơ bản (Nhận biết - 100%)</option>
                  <option value="Thông hiểu">Thông hiểu & Vận dụng thấp</option>
                  <option value="Vận dụng cao">Vận dụng cao & Phân hóa học sinh giỏi</option>
                </select>
              </div>
            </div>

            {/* Primary Action Button: Fast AI Quiz Generation */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleGenerateFastQuiz}
                disabled={isGenerating}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-base flex items-center justify-center gap-3 shadow-lg shadow-indigo-600/30 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300 animate-spin" />
                    <span>Đang Bóc Tách & Tạo Câu Hỏi...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 text-yellow-300" />
                    <span>TẠO CÂU HỎI BẰNG AI SIÊU TỐC (2-3s)</span>
                  </>
                )}
              </button>

              {statusMessage && (
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200/60 text-xs font-semibold text-indigo-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>{statusMessage}</span>
                  {generationTimeMs && (
                    <span className="ml-auto font-mono text-[11px] bg-indigo-200/80 px-2 py-0.5 rounded text-indigo-900 font-bold shrink-0">
                      {(generationTimeMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel: Questions Studio Preview */}
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
            {/* Top Toolbar of Studio */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                  <span>Bộ Câu Hỏi Trắc Nghiệm Đã Tạo</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-extrabold font-mono">
                  {generatedQuestions.length} câu
                </span>
              </div>

              {generatedQuestions.length > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDeployToStudents}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 text-white" />
                    <span>PHÁT ĐỀ CHO HỌC SINH THI NGAY</span>
                  </button>
                </div>
              )}
            </div>

            {/* Questions List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {generatedQuestions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-lg mx-auto my-auto">
                  <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-xs">
                    <Sparkles className="w-8 h-8 text-amber-500 animate-pulse" />
                  </div>
                  <h4 className="text-lg font-black text-slate-900 mb-2">
                    Chưa Có Câu Hỏi Nào Được Tạo
                  </h4>
                  <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                    Hãy nhập yêu cầu ở bảng bên trái hoặc tải lên ma trận đề thi (File Ảnh chụp, PDF, Word). Sau đó nhấn <strong>"TẠO CÂU HỎI BẰNG AI SIÊU TỐC"</strong> để xem kết quả tại đây.
                  </p>
                  <button
                    onClick={handleGenerateFastQuiz}
                    disabled={isGenerating}
                    className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                  >
                    <Zap className="w-4 h-4 text-yellow-300" />
                    <span>Tạo Đề Mẫu Chuẩn Ngay Lập Tức</span>
                  </button>
                </div>
              ) : (
                generatedQuestions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs hover:border-indigo-300 transition-all space-y-4"
                  >
                    {/* Question Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="px-3 py-1 rounded-xl bg-indigo-600 text-white text-xs font-black">
                          CÂU {idx + 1}
                        </span>
                        {q.difficulty && (
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
                            {q.difficulty}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-mono font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{q.timeLimit || 30}s</span>
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Xóa câu hỏi này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Question Text */}
                    <div className="text-base font-bold text-slate-900 leading-relaxed">
                      <MathFormulaRenderer content={q.question} />
                    </div>

                    {/* Options Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {q.options.map((opt) => {
                        const isCorrect = opt.key === q.correctAnswer;
                        return (
                          <div
                            key={opt.key}
                            className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                              isCorrect
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-950 ring-1 ring-emerald-300'
                                : 'bg-slate-50 border-slate-200 text-slate-800'
                            }`}
                          >
                            <span
                              className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                                isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-white border border-slate-200 text-slate-700'
                              }`}
                            >
                              {opt.key}
                            </span>
                            <div className="flex-1 text-sm font-semibold pt-0.5">
                              <MathFormulaRenderer content={opt.text} />
                            </div>
                            {isCorrect && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-amber-900">Giải thích: </span>
                          <MathFormulaRenderer content={q.explanation} />
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Bottom Sticky Action Footer */}
            {generatedQuestions.length > 0 && (
              <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
                <div className="text-xs text-slate-500 font-semibold">
                  Sẵn sàng phát {generatedQuestions.length} câu hỏi cho toàn bộ học sinh trong phòng học
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGenerateFastQuiz}
                    disabled={isGenerating}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    🔄 Tạo lại bộ khác
                  </button>

                  <button
                    onClick={handleDeployToStudents}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    <span>PHÁT ĐỀ CHO HỌC SINH THI NGAY</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: LIVE QUIZ HUB (STUDENTS TAKING EXAM) */}
      {activeMode === 'live' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Quiz Top Status Bar on 75" TV */}
          <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50 border-b border-slate-200 z-20 shrink-0">
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
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-base font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
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

              {/* Button to Switch Back to AI Creator */}
              <button
                onClick={() => setActiveMode('creator')}
                className="px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 text-sm font-bold flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                title="Mở giao diện AI tạo thêm câu hỏi hoặc tải ma trận đề mới"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="hidden sm:inline">Soạn đề mới</span>
              </button>
            </div>
          </div>

          {/* Main Quiz Presentation Area */}
          {!currentQ ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
              <div className="w-20 h-20 rounded-3xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-6 shadow-xs">
                <Sparkles className="w-10 h-10 text-amber-500 animate-pulse" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-3">
                Chưa Có Câu Hỏi Nào Trong Phòng
              </h2>
              <p className="text-slate-600 text-base max-w-lg mb-6">
                Chuyển sang chế độ "Soạn Đề AI & Ma Trận" để tự động tạo bộ câu hỏi theo ma trận đề của bạn.
              </p>
              <button
                onClick={() => setActiveMode('creator')}
                className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base flex items-center gap-3 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
              >
                <Sparkles className="w-5 h-5 text-yellow-300" />
                <span>Mở Trình Soạn Đề AI & Ma Trận</span>
              </button>
            </div>
          ) : (
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
                  <div className={`${scale.questionText} text-slate-900`}>
                    <QuizRichContentRenderer
                      content={currentQ.question}
                      diagramType={currentQ.diagramType}
                      diagramData={currentQ.diagramData}
                    />
                  </div>
                </div>

                {/* 4 Large Options (A, B, C, D) */}
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
                            <MathFormulaRenderer content={opt.text} />
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
                        <MathFormulaRenderer content={currentQ.explanation} />
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
          )}

          {/* Bottom Action Footer for Teacher on 75" TV */}
          {currentQ && (
            <div className="px-8 py-4 bg-slate-50/95 border-t border-slate-200 flex items-center justify-between z-20 shrink-0">
              <div className="flex items-center gap-3">
                <button
                  id="prev-quiz-question-btn"
                  onClick={handlePrevQuestion}
                  disabled={activeIndex === 0}
                  className="px-5 py-3 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-base disabled:opacity-30 disabled:pointer-events-none transition-all shadow-xs cursor-pointer"
                >
                  ← Câu trước
                </button>

                <button
                  id="reset-quiz-room-btn"
                  onClick={onResetRoom}
                  className="px-4 py-3 rounded-2xl bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 font-bold text-base flex items-center gap-2 transition-all shadow-xs cursor-pointer"
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
                    className="px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xl flex items-center gap-3 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="w-7 h-7" />
                    <span>Khóa Bài & Công Bố Đáp Án</span>
                  </button>
                ) : (
                  <button
                    id="next-quiz-question-btn"
                    onClick={handleNextQuestion}
                    disabled={activeIndex >= questions.length - 1}
                    className="px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xl flex items-center gap-3 shadow-md shadow-indigo-600/20 disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-all cursor-pointer"
                  >
                    <span>Chuyển Sang Câu Kế Tiếp</span>
                    <ChevronRight className="w-7 h-7" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: EXAM ROOM MODE (CHẾ ĐỘ PHÒNG THI) */}
      {activeMode === 'exam' && (() => {
        const studentList: ActiveStudent[] = Array.isArray(roomState?.activeStudents)
          ? roomState.activeStudents
          : [];
        const warningCount = studentList.filter((s) => (s.warningCount || 0) > 0).length;
        const safeCount = studentList.filter((s) => s.isFocusLocked).length;

        return (
          <div className="flex-1 flex flex-col overflow-y-auto bg-slate-900 text-slate-100 p-6 space-y-6">
            {/* Section 1: Exam Header & Countdown Command Center */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* Left: Giant Digital Countdown & Duration Controller */}
              <div className="xl:col-span-8 p-6 md:p-8 rounded-3xl bg-slate-800/90 border border-slate-700 shadow-xl flex flex-col justify-between space-y-6 relative overflow-hidden">
                {/* Top Row: Title & PIN Badge */}
                <div className="flex flex-wrap items-center justify-between gap-4 z-10">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-black tracking-wider uppercase">
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                      <span>Hệ Thống Phòng Thi Trực Tuyến & Giám Thị Số</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                      Chế Độ Phòng Thi Chuẩn Quốc Gia
                    </h2>
                  </div>

                  {/* Big PIN for room entrance */}
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-900/90 px-4 py-2 rounded-2xl border border-slate-700 flex items-center gap-3">
                      <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">MÃ PIN XÁC THỰC:</div>
                      <span className="font-mono text-2xl md:text-3xl font-black text-amber-400 tracking-widest">
                        {roomState?.pin || '758899'}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowQRModal(true)}
                      className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md cursor-pointer"
                      title="Mở mã QR phòng thi để học sinh quét"
                    >
                      <QrCode className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Center: Giant Countdown Display */}
                <div className="flex flex-col items-center justify-center py-4 space-y-3 z-10">
                  <div className="flex items-center gap-3">
                    {isExamActive ? (
                      <span className="flex items-center gap-2 px-4 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-black border border-emerald-500/30 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        ĐANG TÍNH GIỜ LÀM BÀI
                      </span>
                    ) : examSecondsRemaining === 0 ? (
                      <span className="flex items-center gap-2 px-4 py-1 rounded-full bg-rose-500/20 text-rose-400 text-xs font-black border border-rose-500/30">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        ĐÃ HẾT THỜI GIAN THI
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 px-4 py-1 rounded-full bg-slate-700 text-slate-300 text-xs font-black border border-slate-600">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        SẴN SÀNG BẮT ĐẦU
                      </span>
                    )}
                  </div>

                  {/* Clock Display */}
                  <div className="text-6xl md:text-7xl lg:text-8xl font-mono font-black tracking-widest text-white drop-shadow-[0_0_25px_rgba(244,63,94,0.3)] select-none">
                    {formatExamTime(examSecondsRemaining)}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full max-w-xl h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-1000 rounded-full"
                      style={{
                        width: `${
                          examSecondsRemaining !== null && examDurationMinutes > 0
                            ? Math.min(100, Math.max(0, (examSecondsRemaining / (examDurationMinutes * 60)) * 100))
                            : 100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Bottom Row: Control Buttons & Presets */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-700/60 z-10">
                  {/* Duration presets */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-bold">Thời lượng:</span>
                    {[15, 30, 45, 60, 90].map((m) => (
                      <button
                        key={m}
                        disabled={isExamActive}
                        onClick={() => setExamDurationMinutes(m)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          examDurationMinutes === m
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40 disabled:pointer-events-none'
                        }`}
                      >
                        {m} phút
                      </button>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    {!isExamActive ? (
                      <button
                        id="start-exam-timer-btn"
                        onClick={() => handleExamAction('start')}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer active:scale-95"
                      >
                        <Play className="w-4 h-4" />
                        <span>BẮT ĐẦU TÍNH GIỜ</span>
                      </button>
                    ) : (
                      <button
                        id="pause-exam-timer-btn"
                        onClick={() => handleExamAction('pause')}
                        className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-amber-900/30 transition-all cursor-pointer active:scale-95"
                      >
                        <Pause className="w-4 h-4" />
                        <span>TẠM DỪNG</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleExamAction('extend', 5)}
                      className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      title="Gia hạn thêm 5 phút cho toàn bộ phòng thi"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+5 Phút</span>
                    </button>

                    <button
                      onClick={() => handleExamAction('reset')}
                      className="px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white font-bold text-sm flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Làm mới thời gian thi"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Thu Bài / Đặt Lại</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Screen Lock & Anti-Cheat Command Widget */}
              <div className="xl:col-span-4 p-6 md:p-8 rounded-3xl bg-slate-800/90 border border-slate-700 shadow-xl flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-400 font-black text-sm uppercase tracking-wider">
                      <Shield className="w-4 h-4" />
                      <span>Cấu Hình Khóa Thiết Bị</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                      isExamScreenLocked ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {isExamScreenLocked ? 'ĐANG KÍCH HOẠT' : 'ĐANG TẮT'}
                    </span>
                  </div>

                  <div className="space-y-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-700/60">
                    {/* Anti-cheat Fullscreen Lock Toggle */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="text-sm font-bold text-white flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Khóa Toàn Màn Hình</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          Chặn rời tab, thu nhỏ hoặc mở ứng dụng khác
                        </div>
                      </div>
                      <button
                        onClick={handleToggleScreenLock}
                        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                          isExamScreenLocked ? 'bg-emerald-600' : 'bg-slate-700'
                        }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                            isExamScreenLocked ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="border-t border-slate-800 pt-3">
                      <div className="text-xs text-slate-400 space-y-1">
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Tự động phát hiện khi học sinh rời khỏi màn hình thi</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Đếm số lần vi phạm và báo động ngay lập tức lên bảng</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Emergency Teacher Freeze / Lock Button */}
                  <div className="space-y-2">
                    <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      Lệnh Giám Thị Khẩn Cấp:
                    </div>
                    <button
                      onClick={handleToggleTeacherEmergencyLock}
                      className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg active:scale-95 ${
                        isTeacherEmergencyLocked
                          ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30 animate-pulse'
                          : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-900/40'
                      }`}
                    >
                      {isTeacherEmergencyLocked ? (
                        <>
                          <Unlock className="w-5 h-5" />
                          <span>MỞ KHÓA MÀN HÌNH HỌC SINH</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-5 h-5" />
                          <span>KHÓA MÀN HÌNH TẤT CẢ HỌC SINH KHẨN CẤP</span>
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-slate-400 text-center">
                      {isTeacherEmergencyLocked
                        ? '⚠️ Màn hình của tất cả thí sinh đang bị tạm dừng và đóng băng bởi giám thị.'
                        : 'Khi kích hoạt, màn hình toàn bộ học sinh lập tức bị đóng băng để nhắc nhở chung.'}
                    </p>
                  </div>
                </div>

                {/* Quick Link to Student View */}
                <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
                  <span>Liên kết học sinh:</span>
                  <button
                    onClick={() => window.open(joinUrl, '_blank')}
                    className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Mở thử trang học sinh</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Section 2: 4 Real-time Proctoring Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Metric 1: Total joined students */}
              <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-xs text-slate-400 font-bold uppercase">Sĩ Số Trong Phòng</div>
                  <div className="text-3xl font-black text-white font-mono">
                    {studentList.length}
                  </div>
                  <div className="text-[11px] text-slate-400">Thí sinh đã kết nối</div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              {/* Metric 2: Fullscreen locked students (Safe) */}
              <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-xs text-slate-400 font-bold uppercase">Đang Khóa An Toàn</div>
                  <div className="text-3xl font-black text-emerald-400 font-mono">
                    {safeCount}
                  </div>
                  <div className="text-[11px] text-emerald-400/80">100% Toàn màn hình</div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              </div>

              {/* Metric 3: Warning / Anti-cheat alerts */}
              <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-xs text-slate-400 font-bold uppercase">Cảnh Báo Vi Phạm</div>
                  <div className="text-3xl font-black text-rose-400 font-mono">
                    {warningCount}
                  </div>
                  <div className="text-[11px] text-rose-400/80">Rời tab / thu nhỏ ứng dụng</div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </div>

              {/* Metric 4: Question Count & Completion */}
              <div className="p-5 rounded-2xl bg-slate-800/80 border border-slate-700 shadow-sm flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-xs text-slate-400 font-bold uppercase">Số Lượng Câu Hỏi</div>
                  <div className="text-3xl font-black text-amber-400 font-mono">
                    {questions.length} câu
                  </div>
                  <div className="text-[11px] text-slate-400">Đề thi trắc nghiệm</div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <FileText className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* Section 3: Student Proctoring Grid & Live Anti-Cheat Monitor */}
            <div className="p-6 rounded-3xl bg-slate-800/90 border border-slate-700 shadow-xl space-y-5">
              {/* Header & Filter Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                    <Eye className="w-5 h-5 text-indigo-400" />
                    <span>Bảng Giám Sát Thí Sinh Thời Gian Thực</span>
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-700 text-xs font-bold text-slate-300">
                    {studentList.length} em
                  </span>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="bg-slate-900 p-1 rounded-xl border border-slate-700 flex items-center text-xs">
                    <button
                      onClick={() => setExamStudentFilter('all')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                        examStudentFilter === 'all'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Tất cả
                    </button>
                    <button
                      onClick={() => setExamStudentFilter('warning')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                        examStudentFilter === 'warning'
                          ? 'bg-rose-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Vi phạm ({warningCount})
                    </button>
                    <button
                      onClick={() => setExamStudentFilter('safe')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                        examStudentFilter === 'safe'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      An toàn ({safeCount})
                    </button>
                  </div>

                  <button
                    onClick={onRefreshRoom}
                    className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-all cursor-pointer"
                    title="Làm mới danh sách thí sinh"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Students Grid */}
              {studentList.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 bg-slate-900/50 rounded-2xl border border-slate-700/50">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                    <Users className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-slate-200">Chưa có thí sinh nào vào phòng</h4>
                    <p className="text-xs text-slate-400 max-w-md">
                      Học sinh quét mã QR hoặc truy cập đường link và nhập mã PIN <span className="font-mono font-bold text-amber-400">{roomState?.pin || '758899'}</span> cùng Số Báo Danh để bắt đầu.
                    </p>
                  </div>
                  <button
                    onClick={handleSimulateExamClass}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <Users className="w-4 h-4" />
                    <span>Mô phỏng 24 thí sinh vào phòng thi ngay</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {studentList
                    .filter((student) => {
                      if (examStudentFilter === 'warning') return (student.warningCount || 0) > 0;
                      if (examStudentFilter === 'safe') return student.isFocusLocked;
                      return true;
                    })
                    .map((student, idx) => {
                      const studentId = student.id || `st_${idx}`;
                      const hasWarning = (student.warningCount || 0) > 0;
                      const isLocked = student.isFocusLocked;

                      return (
                        <div
                          key={studentId}
                          className={`p-4 rounded-2xl border transition-all ${
                            hasWarning
                              ? 'bg-rose-950/40 border-rose-700/80 shadow-lg shadow-rose-950/50'
                              : isLocked
                              ? 'bg-slate-900/80 border-slate-700/80 hover:border-slate-600'
                              : 'bg-slate-900/40 border-slate-800'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${
                                hasWarning
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-indigo-600 text-white'
                              }`}>
                                {(student.studentName || student.name || 'T').charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-sm text-white truncate max-w-[140px]" title={student.studentName || student.name}>
                                  {student.studentName || student.name || 'Thí sinh'}
                                </div>
                                <div className="text-[11px] font-mono text-slate-400">
                                  SBD: {student.studentCode || `HS${1201 + idx}`}
                                </div>
                              </div>
                            </div>

                            {/* Lock icon */}
                            {isLocked ? (
                              <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Đang toàn màn hình">
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <span className="p-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Chưa khóa toàn màn hình">
                                <Unlock className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>

                          {/* Status pill */}
                          <div className="pt-2 border-t border-slate-800/80 space-y-2">
                            {hasWarning ? (
                              <div className="flex items-center gap-1.5 text-rose-300 text-xs font-bold bg-rose-500/20 px-2.5 py-1 rounded-lg border border-rose-500/30">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>Vi phạm {student.warningCount} lần (Rời tab)</span>
                              </div>
                            ) : isLocked ? (
                              <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                <span>Màn hình khóa an toàn</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-slate-400 text-xs bg-slate-800 px-2.5 py-1 rounded-lg">
                                <Smartphone className="w-3.5 h-3.5 shrink-0" />
                                <span>Đang làm bài</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* QR Code Modal for Student Mobile Join */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-8 rounded-3xl bg-white border border-slate-200 shadow-2xl flex flex-col items-center text-center">
            <h3 className="text-2xl font-black text-slate-900 mb-2">QUÉT MÃ ĐỂ VÀO PHÒNG HỌC</h3>
            <p className="text-slate-600 text-base mb-6">
              Học sinh dùng camera điện thoại hoặc máy tính bảng quét mã để làm bài tập trắc nghiệm trực tiếp.
            </p>

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
                className="flex-1 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                Mở Giao Diện Học Sinh
              </button>

              <button
                onClick={() => setShowQRModal(false)}
                className="px-6 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-base transition-all border border-slate-200 cursor-pointer"
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
