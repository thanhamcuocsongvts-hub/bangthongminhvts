import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  BookOpenCheck,
  BookmarkCheck,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Compass,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderHeart,
  GraduationCap,
  HelpCircle,
  Layers,
  Lightbulb,
  ListChecks,
  Loader2,
  Mic,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
} from 'lucide-react';
import { LessonDoc, QuizQuestion, TeacherProfile, TeachingMethodPlan } from '../types';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { TeachingMethodPresentation } from './TeachingMethodPresentation';
import {
  deleteTeachingMethodPlan,
  generateMoreMethodExercisesAI,
  generateTeachingMethodAI,
  loadLocalTeachingMethods,
  pullTeachingMethodsFromCloud,
  saveTeachingMethodPlan,
  subscribeTeachingMethodsCloud,
} from '../utils/teachingMethodService';
import { exportTeachingMethodToDocx } from '../utils/teachingMethodDocx';
import { getKnttLessonsForSubjectGrade } from '../data/knttLessonsCatalog';
import { useDeviceDetection } from '../hooks/useDeviceDetection';
import { gameSounds } from '../utils/gameSoundEffects';
import {
  getSpeechSpeedMultiplier,
  setSpeechSpeedMultiplier,
  speakText,
  stopAllSpeech,
  unlockWebAudio,
  VOICE_TONE_PRESETS,
  VoiceTonePreset,
} from '../utils/aiSpeechService';

interface TeachingMethodHubProps {
  teacher: TeacherProfile | null;
  currentLesson?: LessonDoc | null;
  hasExternalSidePanel?: boolean;
  onSendExercisesToQuiz?: (questions: QuizQuestion[], title: string) => void;
  onOpenCasioCalculator?: () => void;
}

type SectionFilter = 'all' | 'steps' | 'formulas' | 'examples' | 'exercises';

const SUBJECT_OPTIONS = [
  'Toán học',
  'Vật lý',
  'Hóa học',
  'Sinh học',
  'Khoa học tự nhiên',
  'Tin học',
  'Tiếng Anh',
  'Ngữ văn',
];

const GRADE_OPTIONS = [
  'Lớp 12',
  'Lớp 11',
  'Lớp 10',
  'Lớp 9',
  'Lớp 8',
  'Lớp 7',
  'Lớp 6',
  'Ôn thi THPT Quốc gia',
];

const LEVEL_OPTIONS = [
  'Chuẩn SGK (Thông hiểu - Vận dụng)',
  'Cơ bản & Dễ hiểu (Lấy lại gốc)',
  'Vận dụng cao & Luyện thi HSG / ĐGNL',
];

const SUBJECT_SUGGESTIONS: Record<string, string[]> = {
  'Toán học': [
    'Tìm cực trị hàm số chứa dấu giá trị tuyệt đối y = |f(x)| và f(|x|)',
    'Tính thể tích khối chóp có cạnh bên vuông góc với mặt đáy',
    'Viết phương trình mặt phẳng đi qua 3 điểm trong không gian Oxyz',
    'Tìm giá trị lớn nhất, nhỏ nhất của hàm số trên đoạn [a; b]',
    'Giải phương trình mũ và logarit bằng phương pháp đặt ẩn phụ',
  ],
  'Vật lý': [
    'Viết phương trình dao động điều hòa từ đồ thị li độ - thời gian',
    'Giải bài toán mạch điện xoay chiều RLC mắc nối tiếp có cộng hưởng',
    'Tính công suất, nhiệt lượng tỏa ra và định luật Ôm cho toàn mạch',
  ],
  'Hóa học': [
    'Giải bài tập thủy phân este đơn chức tác dụng với dung dịch kiềm NaOH',
    'Cân bằng phản ứng oxi hóa - khử theo phương pháp thăng bằng electron',
    'Tính pH của dung dịch axit mạnh, bazơ mạnh và phản ứng trung hòa',
  ],
  'Sinh học': [
    'Giải bài toán lai hai cặp tính trạng phân li độc lập của Menđen',
    'Tính số nuclêôtit, chiều dài và số liên kết hiđrô của phân tử ADN',
  ],
  'Khoa học tự nhiên': [
    'Giải bài toán tính nồng độ phần trăm và nồng độ mol dung dịch',
    'Tính tốc độ trung bình và vẽ đồ thị quãng đường - thời gian',
  ],
  'Tin học': [
    'Phương pháp thiết kế thuật toán sắp xếp và tìm kiếm nhị phân',
    'Viết câu lệnh truy vấn SQL chọn lọc dữ liệu có điều kiện JOIN',
  ],
  'Tiếng Anh': [
    'Phương pháp làm dạng bài câu điều kiện loại 1, 2, 3 và hỗn hợp',
    'Cách chuyển đổi câu trực tiếp sang câu gián tiếp chính xác',
  ],
  'Ngữ văn': [
    'Phương pháp viết đoạn văn nghị luận xã hội 200 chữ chuẩn cấu trúc',
    'Cách phân tích nhân vật và tình huống truyện ngắn hiện đại',
  ],
};

export const TeachingMethodHub: React.FC<TeachingMethodHubProps> = ({
  teacher,
  currentLesson,
  hasExternalSidePanel = false,
  onSendExercisesToQuiz,
  onOpenCasioCalculator,
}) => {
  const { isMobile } = useDeviceDetection();
  const teacherId = teacher?.id || 'guest';

  const defaultSubject = useMemo(() => {
    if (teacher?.subject && SUBJECT_OPTIONS.includes(teacher.subject)) {
      return teacher.subject;
    }
    return 'Toán học';
  }, [teacher?.subject]);

  const [methodMode, setMethodMode] = useState<'by_type' | 'by_textbook'>('by_type');
  const [promptInput, setPromptInput] = useState<string>('');
  const [subject, setSubject] = useState<string>(defaultSubject);
  const [grade, setGrade] = useState<string>('Lớp 12');
  const [targetLevel, setTargetLevel] = useState<string>(LEVEL_OPTIONS[0]);
  const [exerciseCount, setExerciseCount] = useState<number>(4);

  const knttChapters = useMemo(() => getKnttLessonsForSubjectGrade(subject, grade), [subject, grade]);
  const allKnttLessons = useMemo(() => knttChapters.flatMap((c) => c.lessons), [knttChapters]);
  const [selectedKnttLesson, setSelectedKnttLesson] = useState<string>(
    () => getKnttLessonsForSubjectGrade(defaultSubject, 'Lớp 12').flatMap((c) => c.lessons)[0] || ''
  );
  const [customKnttLesson, setCustomKnttLesson] = useState<string>('');

  const [activePlan, setActivePlan] = useState<TeachingMethodPlan | null>(null);
  const [savedPlans, setSavedPlans] = useState<TeachingMethodPlan[]>(() =>
    loadLocalTeachingMethods(teacherId)
  );
  const [showSavedDrawer, setShowSavedDrawer] = useState<boolean>(false);
  const [savedSearchQuery, setSavedSearchQuery] = useState<string>('');

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isGeneratingMoreEx, setIsGeneratingMoreEx] = useState<boolean>(false);
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [statusNotice, setStatusNotice] = useState<string>('');

  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all');
  const [fontScale, setFontScale] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [presentationStartSlide, setPresentationStartSlide] = useState<number>(0);
  const [showComposerOnStage, setShowComposerOnStage] = useState<boolean>(true);

  // Shared AI Voice State (synced across app modules)
  const [selectedVoice, setSelectedVoice] = useState<VoiceTonePreset>(() => {
    try {
      const savedVoiceId = localStorage.getItem('smartboard_ai_voice_preset');
      if (savedVoiceId) {
        const found = VOICE_TONE_PRESETS.find((v) => v.id === savedVoiceId);
        if (found) return found;
      }
    } catch (_) {}
    return VOICE_TONE_PRESETS[0];
  });
  const [speechSpeed, setSpeechSpeed] = useState<number>(() => getSpeechSpeedMultiplier());
  const [showVoiceMenu, setShowVoiceMenu] = useState<boolean>(false);
  const [speechState, setSpeechState] = useState<'idle' | 'calling' | 'speaking'>('idle');
  const [activeSpeechKey, setActiveSpeechKey] = useState<string>('');
  const speechStateRef = useRef(speechState);
  speechStateRef.current = speechState;
  const speechWatchdogRef = useRef<any>(null);

  useEffect(() => {
    if (allKnttLessons.length > 0) {
      setSelectedKnttLesson((prev) => (prev && allKnttLessons.includes(prev) ? prev : allKnttLessons[0]));
    } else {
      setSelectedKnttLesson('');
    }
  }, [allKnttLessons]);

  // Interactive Classroom Reveal States
  const [progressiveStepsMode, setProgressiveStepsMode] = useState<boolean>(false);
  const [revealedStepCount, setRevealedStepCount] = useState<number>(1);
  const [revealedExampleSteps, setRevealedExampleSteps] = useState<Record<number, number>>({});
  const [visibleHints, setVisibleHints] = useState<Record<string, boolean>>({});
  const [visibleSolutions, setVisibleSolutions] = useState<Record<string, boolean>>({});

  // Sync saved teaching methods across devices (PC <-> Phone <-> 75" TV)
  useEffect(() => {
    setSavedPlans(loadLocalTeachingMethods(teacherId));
    pullTeachingMethodsFromCloud(teacherId).then((items) => {
      if (items.length > 0) setSavedPlans(items);
    });
    const unsub = subscribeTeachingMethodsCloud(teacherId, (items) => {
      setSavedPlans(items);
    });
    return () => unsub();
  }, [teacherId]);

  const stopHubSpeech = useCallback(() => {
    if (speechWatchdogRef.current) {
      clearTimeout(speechWatchdogRef.current);
      speechWatchdogRef.current = null;
    }
    stopAllSpeech();
    setSpeechState('idle');
    setActiveSpeechKey('');
  }, []);

  // Listen to fullscreen exit via Esc (when not inside TeachingMethodPresentation which has its own Esc handler)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        window.dispatchEvent(new CustomEvent('set-feature-fullscreen', { detail: { active: false } }));
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isFullscreen]);

  // Ensure app fullscreen & speech reset if tab unmounts
  useEffect(() => {
    return () => {
      stopAllSpeech();
      if (speechWatchdogRef.current) clearTimeout(speechWatchdogRef.current);
      window.dispatchEvent(new CustomEvent('set-feature-fullscreen', { detail: { active: false } }));
    };
  }, []);

  const openPresentationAt = (slideIndex = 0) => {
    if (!activePlan) return;
    stopHubSpeech();
    unlockWebAudio();
    setPresentationStartSlide(slideIndex);
    setIsFullscreen(true);
    setShowComposerOnStage(false);
    window.dispatchEvent(new CustomEvent('set-feature-fullscreen', { detail: { active: true } }));
  };

  const closePresentation = () => {
    setIsFullscreen(false);
    window.dispatchEvent(new CustomEvent('set-feature-fullscreen', { detail: { active: false } }));
  };

  const toggleFullscreen = () => {
    if (isFullscreen) {
      closePresentation();
    } else {
      openPresentationAt(0);
    }
  };

  const handleToggleSpeakBlock = (key: string, textToSpeak: string) => {
    if (speechState !== 'idle' && activeSpeechKey === key) {
      stopHubSpeech();
      return;
    }
    const clean = textToSpeak.trim();
    if (!clean) return;
    unlockWebAudio();
    if (speechWatchdogRef.current) {
      clearTimeout(speechWatchdogRef.current);
      speechWatchdogRef.current = null;
    }
    setActiveSpeechKey(key);
    setSpeechState('calling');
    speechWatchdogRef.current = setTimeout(() => {
      if (speechStateRef.current === 'calling') {
        setSpeechState('idle');
        setActiveSpeechKey('');
      }
    }, 12000);

    speakText(clean, {
      preset: selectedVoice,
      subject: activePlan?.subject || subject,
      onStart: () => {
        if (speechWatchdogRef.current) {
          clearTimeout(speechWatchdogRef.current);
          speechWatchdogRef.current = null;
        }
        setSpeechState('speaking');
      },
      onEnd: () => {
        if (speechWatchdogRef.current) {
          clearTimeout(speechWatchdogRef.current);
          speechWatchdogRef.current = null;
        }
        setSpeechState('idle');
        setActiveSpeechKey('');
      },
      onError: () => {
        if (speechWatchdogRef.current) {
          clearTimeout(speechWatchdogRef.current);
          speechWatchdogRef.current = null;
        }
        setSpeechState('idle');
        setActiveSpeechKey('');
      },
    });
  };

  const resetRevealStates = (plan: TeachingMethodPlan) => {
    setProgressiveStepsMode(false);
    setRevealedStepCount(plan.steps.length || 1);
    const exDefaults: Record<number, number> = {};
    plan.examples.forEach((ex, idx) => {
      exDefaults[idx] = ex.stepByStepSolution.length;
    });
    setRevealedExampleSteps(exDefaults);
    setVisibleHints({});
    setVisibleSolutions({});
    setSectionFilter('all');
  };

  const handleGenerate = async (
    overridePrompt?: string,
    overrideMode?: 'by_type' | 'by_textbook',
    overrideLesson?: string
  ) => {
    const activeMode = overrideMode ?? methodMode;
    const lessonName = (overrideLesson ?? (customKnttLesson.trim() || selectedKnttLesson)).trim();
    const extraPrompt = (overridePrompt ?? promptInput).trim();

    if (activeMode === 'by_textbook') {
      if (!lessonName && !extraPrompt) {
        setErrorMsg('Vui lòng chọn hoặc nhập tên bài học trong SGK Kết nối tri thức (GDPT 2018).');
        return;
      }
    } else if (!extraPrompt) {
      setErrorMsg('Vui lòng nhập yêu cầu, tên dạng toán hoặc dán bài toán cần lập phương pháp giảng dạy.');
      return;
    }

    setErrorMsg('');
    setStatusNotice('');
    setIsGenerating(true);

    try {
      const plan = await generateTeachingMethodAI({
        prompt: extraPrompt || lessonName,
        subject,
        grade,
        targetLevel,
        exerciseCount,
        methodMode: activeMode,
        textbookLesson: activeMode === 'by_textbook' ? lessonName : '',
      });
      setActivePlan(plan);
      resetRevealStates(plan);

      // Auto-save to teacher's cloud library so switching between PC / Phone / 75" TV preserves it immediately
      const updatedList = await saveTeachingMethodPlan(teacherId, plan);
      setSavedPlans(updatedList);
      setStatusNotice('Đã tạo phương pháp giảng dạy & đồng bộ lên Kho Cloud.');
      if (isMobile) {
        setShowComposerOnStage(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không thể tạo phương pháp giảng dạy lúc này. Vui lòng thử lại.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateMoreExercises = async () => {
    if (!activePlan || isGeneratingMoreEx) return;
    setErrorMsg('');
    setStatusNotice('');
    setIsGeneratingMoreEx(true);
    try {
      const extraExercises = await generateMoreMethodExercisesAI({
        existingMethod: activePlan,
        count: 3,
      });
      const updatedPlan: TeachingMethodPlan = {
        ...activePlan,
        exercises: [...activePlan.exercises, ...extraExercises],
        updatedAt: new Date().toISOString(),
      };
      setActivePlan(updatedPlan);
      const updatedList = await saveTeachingMethodPlan(teacherId, updatedPlan);
      setSavedPlans(updatedList);
      setStatusNotice(`Đã bổ sung thêm ${extraExercises.length} bài tập tương tự mới.`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Chưa tạo thêm được bài tập tương tự.');
    } finally {
      setIsGeneratingMoreEx(false);
    }
  };

  const handleSaveManual = async () => {
    if (!activePlan) return;
    const updatedList = await saveTeachingMethodPlan(teacherId, activePlan);
    setSavedPlans(updatedList);
    setStatusNotice('Đã lưu vào Kho Phương Pháp & đồng bộ đa thiết bị.');
  };

  const handleDeleteSaved = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = await deleteTeachingMethodPlan(teacherId, id);
    setSavedPlans(updated);
    if (activePlan?.id === id) {
      setActivePlan(null);
    }
  };

  const handleSelectSaved = (plan: TeachingMethodPlan) => {
    setActivePlan(plan);
    setPromptInput(plan.prompt || plan.title);
    setSubject(plan.subject);
    setGrade(plan.grade);
    resetRevealStates(plan);
    setShowSavedDrawer(false);
    setErrorMsg('');
    setStatusNotice('');
  };

  const handleExportWord = async () => {
    if (!activePlan || isExportingDocx) return;
    setIsExportingDocx(true);
    try {
      await exportTeachingMethodToDocx(activePlan);
      setStatusNotice('Đã xuất file Word (.docx) kèm công thức chuẩn.');
    } catch (err: any) {
      setErrorMsg('Không thể xuất file Word lúc này.');
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleImportFromCurrentLesson = () => {
    if (!currentLesson || currentLesson.id === 'empty_lesson') return;
    const firstQuiz = currentLesson.quizzes?.[0]?.question || '';
    const snippet = (firstQuiz || currentLesson.rawText || currentLesson.title || '').trim().slice(0, 500);
    if (snippet) {
      setPromptInput(`Xây dựng phương pháp giải chi tiết cho nội dung bài "${currentLesson.title}": ${snippet}`);
      if (currentLesson.subject && SUBJECT_OPTIONS.includes(currentLesson.subject)) {
        setSubject(currentLesson.subject);
      }
      if (currentLesson.grade && GRADE_OPTIONS.includes(currentLesson.grade)) {
        setGrade(currentLesson.grade);
      }
      setShowComposerOnStage(true);
    }
  };

  const handleSendToQuizHub = () => {
    if (!activePlan || !onSendExercisesToQuiz || activePlan.exercises.length === 0) return;
    const converted: QuizQuestion[] = activePlan.exercises.map((ex, i) => ({
      id: `method_q_${Date.now()}_${i + 1}`,
      question: ex.problem,
      partType: 'part_3_short_answer',
      partLabel: 'Bài tập tự luyện theo phương pháp',
      options: [],
      shortAnswerKey: ex.shortAnswer,
      correctAnswer: ex.shortAnswer,
      explanation: ex.solutionSteps,
      timeLimit: 60,
      subject: activePlan.subject as any,
      difficulty: ex.level,
    }));
    onSendExercisesToQuiz(converted, `Luyện tập: ${activePlan.title}`);
  };

  const isSavedInCloud = Boolean(activePlan && savedPlans.some((p) => p.id === activePlan.id));
  const suggestions = SUBJECT_SUGGESTIONS[subject] || SUBJECT_SUGGESTIONS['Toán học'];

  const filteredSavedPlans = useMemo(() => {
    const q = savedSearchQuery.trim().toLowerCase();
    if (!q) return savedPlans;
    return savedPlans.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.subject.toLowerCase().includes(q) ||
        p.grade.toLowerCase().includes(q) ||
        p.prompt.toLowerCase().includes(q)
    );
  }, [savedPlans, savedSearchQuery]);

  const proseStyle: React.CSSProperties = {
    fontSize: `${Math.round(16 * fontScale)}px`,
    lineHeight: 1.65,
  };

  const useCompactColumns = isMobile || hasExternalSidePanel;

  if (isFullscreen && activePlan) {
    return (
      <TeachingMethodPresentation
        plan={activePlan}
        initialSlideIndex={presentationStartSlide}
        fontScale={fontScale}
        onChangeFontScale={setFontScale}
        onClose={closePresentation}
        onOpenCasioCalculator={onOpenCasioCalculator}
        onSendToQuizHub={onSendExercisesToQuiz ? handleSendToQuizHub : undefined}
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#F8FAFC] text-slate-900 rounded-2xl border border-slate-200 overflow-hidden relative">
      {/* TOP BAR / COMMAND STRIP */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">
              Phương Pháp Giảng Dạy & Giải Bài Toán
            </h2>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
              <span>Trình tự các bước</span>
              <span aria-hidden="true">·</span>
              <span>Công thức</span>
              <span aria-hidden="true">·</span>
              <span>Ví dụ minh họa</span>
              <span aria-hidden="true">·</span>
              <span>Bài tập tương tự</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {activePlan && (
            <button
              type="button"
              onClick={() => setShowComposerOnStage((prev) => !prev)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>{showComposerOnStage ? 'Ẩn ô nhập' : 'Nhập yêu cầu mới'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowSavedDrawer(true)}
            className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderHeart className="w-4 h-4 text-indigo-600" />
            <span>Kho Đã Lưu ({savedPlans.length})</span>
          </button>

          {/* AI Voice Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowVoiceMenu((v) => !v)}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title={`Chọn giọng đọc AI (${selectedVoice.name})`}
            >
              <Mic className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="hidden xl:inline max-w-[130px] truncate">{selectedVoice.label}</span>
              <span className="xl:hidden">Giọng AI</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-70" />
            </button>

            {showVoiceMenu && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl p-3 z-50 space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-800">Chọn Giọng Đọc AI Sư Phạm</span>
                  <button
                    type="button"
                    onClick={() => setShowVoiceMenu(false)}
                    className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                  {VOICE_TONE_PRESETS.slice(0, 8).map((preset) => {
                    const isSel = selectedVoice.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setSelectedVoice(preset);
                          setShowVoiceMenu(false);
                          try {
                            localStorage.setItem('smartboard_ai_voice_preset', preset.id);
                          } catch (_) {}
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                          isSel
                            ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                            : 'bg-slate-50 hover:bg-emerald-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold truncate">{preset.label}</div>
                          <div className={`text-[11px] truncate ${isSel ? 'text-slate-800' : 'text-slate-500'}`}>
                            {preset.sub}
                          </div>
                        </div>
                        {isSel && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-600">Tốc độ:</span>
                  <div className="flex items-center gap-1">
                    {[
                      { val: 0.9, label: 'Chậm' },
                      { val: 1.0, label: 'Chuẩn' },
                      { val: 1.15, label: 'Nhanh' },
                      { val: 1.3, label: 'Rất nhanh' },
                    ].map((sp) => {
                      const active = Math.abs(speechSpeed - sp.val) < 0.04;
                      return (
                        <button
                          key={sp.val}
                          type="button"
                          onClick={() => setSpeechSpeed(setSpeechSpeedMultiplier(sp.val))}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                            active
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {sp.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {activePlan && (
            <>
              <div className="hidden sm:flex items-center border border-slate-200 rounded-xl bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setFontScale((s) => Math.max(0.85, Number((s - 0.1).toFixed(2))))}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-white text-slate-600 cursor-pointer"
                  title="Thu nhỏ chữ"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="px-1.5 text-xs font-semibold tabular-nums text-slate-700">
                  {Math.round(fontScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setFontScale((s) => Math.min(1.6, Number((s + 0.1).toFixed(2))))}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-white text-slate-600 cursor-pointer"
                  title="Phóng to chữ trình chiếu 75 inch"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleExportWord}
                disabled={isExportingDocx}
                className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-sky-600" />
                <span>{isExportingDocx ? 'Đang xuất...' : 'Xuất Word'}</span>
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
                title="Mở sân khấu trình chiếu từng bước trên Tivi 75 inch có hiệu ứng & âm thanh"
              >
                <Play className="w-4 h-4" />
                <span>Trình chiếu từng bước</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* MAIN SCROLLABLE WORKSPACE */}
      <div className="flex-1 min-h-0 overflow-y-auto smooth-touch-scroll p-3 sm:p-5 space-y-5">
        {/* PROMPT COMPOSER CARD */}
        {(showComposerOnStage || !activePlan) && (
          <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900">
                  Thiết lập nội dung phương pháp giảng dạy
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Chọn tạo theo từng dạng bài cụ thể hoặc bám sát bài học trong SGK Kết nối tri thức với cuộc sống (GDPT 2018).
                </p>
              </div>
              {currentLesson && currentLesson.id !== 'empty_lesson' && (
                <button
                  type="button"
                  onClick={handleImportFromCurrentLesson}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Lấy từ bài đang mở</span>
                </button>
              )}
            </div>

            {/* 2-Mode Switcher: By Problem Type vs By KNTT 2018 Textbook Lesson */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setMethodMode('by_type');
                  setErrorMsg('');
                }}
                className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  methodMode === 'by_type'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Compass className="w-4 h-4 shrink-0" />
                <span>Theo từng dạng bài cụ thể</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMethodMode('by_textbook');
                  setErrorMsg('');
                }}
                className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  methodMode === 'by_textbook'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span>Theo bài học SGK Kết nối tri thức (2018)</span>
              </button>
            </div>

            {/* Config Controls */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Môn học</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  {SUBJECT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Khối lớp</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  {GRADE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Mức độ bài giảng</label>
                <select
                  value={targetLevel}
                  onChange={(e) => setTargetLevel(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  {LEVEL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Số bài tập tương tự</label>
                <select
                  value={exerciseCount}
                  onChange={(e) => setExerciseCount(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                >
                  <option value={3}>3 bài tự luyện</option>
                  <option value={4}>4 bài tự luyện</option>
                  <option value={5}>5 bài tự luyện</option>
                  <option value={6}>6 bài tự luyện</option>
                </select>
              </div>
            </div>

            {methodMode === 'by_textbook' ? (
              <div className="space-y-3 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200">
                {knttChapters.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      Chọn bài học trong SGK Kết nối tri thức với cuộc sống ({subject} - {grade})
                    </label>
                    <select
                      value={selectedKnttLesson}
                      onChange={(e) => {
                        setSelectedKnttLesson(e.target.value);
                        setCustomKnttLesson('');
                      }}
                      className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    >
                      {knttChapters.map((group) => (
                        <optgroup key={group.chapter} label={group.chapter}>
                          {group.lessons.map((lesson) => (
                            <option key={lesson} value={lesson}>
                              {lesson}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>

                    {/* Quick 1-tap lesson buttons for SmartBoard 75" & mobile */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-xs font-semibold text-slate-500 mr-1">Chọn nhanh:</span>
                      {allKnttLessons.slice(0, 5).map((lesson) => {
                        const isPicked = !customKnttLesson.trim() && selectedKnttLesson === lesson;
                        return (
                          <button
                            key={lesson}
                            type="button"
                            onClick={() => {
                              setSelectedKnttLesson(lesson);
                              setCustomKnttLesson('');
                            }}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors text-left cursor-pointer ${
                              isPicked
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-700'
                            }`}
                          >
                            {lesson.length > 44 ? `${lesson.slice(0, 44)}...` : lesson}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {knttChapters.length > 0
                      ? 'Hoặc nhập tên bài học SGK khác nếu muốn tự chọn:'
                      : `Nhập tên bài học SGK Kết nối tri thức (${subject} - ${grade}):`}
                  </label>
                  <input
                    type="text"
                    value={customKnttLesson}
                    onChange={(e) => setCustomKnttLesson(e.target.value)}
                    placeholder="Ví dụ: Bài 14: Phương trình mặt phẳng (hoặc tên bài bất kỳ trong SGK Kết nối tri thức)..."
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Trọng tâm cần nhấn mạnh thêm khi giảng (tùy chọn):
                  </label>
                  <textarea
                    rows={2}
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                    placeholder="Ví dụ: Nhấn mạnh các dạng bài chứa tham số m và cách bấm máy Casio 580 kiểm tra nhanh..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 resize-y min-h-[68px]"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => handleGenerate()}
                    disabled={isGenerating}
                    className="w-full sm:w-auto min-h-[46px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 shadow-sm"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Đang biên soạn theo SGK KNTT...</span>
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-4 h-4" />
                        <span>Tạo Phương Pháp Theo Bài Học SGK</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Request Textarea for Specific Problem Type */}
                <div className="relative">
                  <textarea
                    rows={3}
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                    placeholder="Nhập yêu cầu theo từng dạng bài cụ thể (Ví dụ: Phương pháp tìm cực trị hàm số chứa dấu giá trị tuyệt đối, hoặc dán đề bài cụ thể để phân tích từng bước)..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-10 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600 resize-y min-h-[92px]"
                  />
                  {promptInput && (
                    <button
                      type="button"
                      onClick={() => setPromptInput('')}
                      className="absolute right-3 top-3 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                      title="Xóa nội dung"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Quick Suggestion Prompts + Primary Submit CTA */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500 mr-1">Gợi ý nhanh:</span>
                    {suggestions.slice(0, 3).map((sug, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setPromptInput(sug);
                          handleGenerate(sug, 'by_type');
                        }}
                        disabled={isGenerating}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 text-xs font-medium transition-colors text-left cursor-pointer disabled:opacity-50"
                      >
                        {sug.length > 48 ? `${sug.slice(0, 48)}...` : sug}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleGenerate()}
                    disabled={isGenerating}
                    className="min-h-[46px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 shadow-sm"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Đang biên soạn phương pháp...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Tạo Phương Pháp Giảng Dạy</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {/* STATUS / ERROR BANNERS */}
        {errorMsg && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-rose-500 hover:text-rose-800 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {statusNotice && !errorMsg && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs sm:text-sm font-medium text-emerald-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusNotice}</span>
            </div>
            <button onClick={() => setStatusNotice('')} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* LOADING SKELETON */}
        {isGenerating && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
            </div>
            <div className="text-base font-bold text-slate-900">
              AI đang tổng hợp trình tự giải, công thức, ví dụ minh họa và bài tập tương tự...
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-lg">
              Mọi phép tính đang được kiểm chứng từng bước và chuẩn hóa công thức LaTeX SGK để giáo viên sử dụng trực tiếp trên lớp.
            </p>
          </div>
        )}

        {/* EMPTY STATE WHEN NO PLAN YET */}
        {!isGenerating && !activePlan && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
            <div className="max-w-3xl mx-auto text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-emerald-700">
                <GraduationCap className="w-7 h-7" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                Sẵn sàng thiết kế quy trình giảng dạy chuẩn mực cho từng chuyên đề
              </h3>
              <p className="text-sm text-slate-600">
                Giáo viên chỉ cần nhập tên dạng toán, chuyên đề vật lý/hóa học hoặc dán một bài tập mẫu ở khung phía trên. Ứng dụng sẽ tự động lập thành 4 phần trình chiếu chuẩn:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-left pt-2">
                {[
                  { num: '01', title: 'Trình tự các bước giải', desc: 'Từng bước rõ ràng, có chế độ giảng mở từng bước trên TV 75".' },
                  { num: '02', title: 'Công thức trọng tâm', desc: 'Hiển thị công thức toán học chuẩn KaTeX kèm điều kiện áp dụng.' },
                  { num: '03', title: 'Ví dụ minh họa', desc: 'Giải mẫu chi tiết từng bước khớp với quy trình vừa nêu.' },
                  { num: '04', title: 'Bài tập tương tự', desc: 'Tự động đổi số liệu kèm gợi ý, lời giải ẩn/hiện và xuất Word.' },
                ].map((item) => (
                  <div key={item.num} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                    <div className="text-xs font-bold text-emerald-700 tabular-nums mb-1">{item.num}</div>
                    <div className="text-sm font-bold text-slate-900 mb-1">{item.title}</div>
                    <div className="text-xs text-slate-600 leading-relaxed">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* GENERATED TEACHING METHOD STAGE */}
        {!isGenerating && activePlan && (
          <div className="space-y-5 pb-6">
            {/* PLAN HEADER & SECTION FILTER TABS */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium flex-wrap">
                    <span className="text-emerald-700 font-semibold">{activePlan.subject}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activePlan.grade}</span>
                    <span aria-hidden="true">·</span>
                    <span>{activePlan.targetLevel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{activePlan.steps.length} bước giải</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{activePlan.exercises.length} bài tương tự</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 text-balance">
                    <MathFormulaRenderer content={activePlan.title} />
                  </h1>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      handleToggleSpeakBlock(
                        'plan_overview',
                        `Phương pháp: ${activePlan.title}. ${activePlan.recognitionSigns}. ${activePlan.steps
                          .map((s, i) => `Bước ${s.stepNumber || i + 1}: ${s.title}. ${s.actionGuide}`)
                          .join(' ')}`
                      )
                    }
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      activeSpeechKey === 'plan_overview' && speechState === 'calling'
                        ? 'bg-amber-100 border-amber-300 text-amber-800'
                        : activeSpeechKey === 'plan_overview' && speechState === 'speaking'
                        ? 'bg-rose-600 border-rose-600 text-white'
                        : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                    }`}
                    title="AI đọc tổng quan và trình tự các bước giải"
                  >
                    {activeSpeechKey === 'plan_overview' && speechState === 'calling' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang gọi AI...</span>
                      </>
                    ) : activeSpeechKey === 'plan_overview' && speechState === 'speaking' ? (
                      <>
                        <VolumeX className="w-4 h-4" />
                        <span>Dừng đọc</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4" />
                        <span>Đọc AI</span>
                      </>
                    )}
                  </button>

                  {onOpenCasioCalculator && (
                    <button
                      type="button"
                      onClick={onOpenCasioCalculator}
                      className="min-h-[40px] px-3 py-1.5 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Calculator className="w-4 h-4" />
                      <span>Mở Casio 580</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveManual}
                    className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                      isSavedInCloud
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <BookmarkCheck className="w-4 h-4" />
                    <span>{isSavedInCloud ? 'Đã lưu Cloud' : 'Lưu vào Kho'}</span>
                  </button>
                </div>
              </div>

              {/* Section Navigation Segmented Tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto scrollbar-none">
                {[
                  { id: 'all' as SectionFilter, label: 'Xem tất cả' },
                  { id: 'steps' as SectionFilter, label: `I. Trình tự (${activePlan.steps.length})` },
                  { id: 'formulas' as SectionFilter, label: `II. Công thức (${activePlan.formulas.length})` },
                  { id: 'examples' as SectionFilter, label: `III. Ví dụ (${activePlan.examples.length})` },
                  { id: 'exercises' as SectionFilter, label: `IV. Bài tập tương tự (${activePlan.exercises.length})` },
                ].map((tab) => {
                  const active = sectionFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSectionFilter(tab.id)}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-white text-emerald-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* OVERVIEW: RECOGNITION, OBJECTIVE & COMMON MISTAKES */}
            {(sectionFilter === 'all' || sectionFilter === 'steps') &&
              (activePlan.recognitionSigns || activePlan.learningObjective || activePlan.commonMistakes.length > 0) && (
                <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4">
                  <div className={`grid gap-4 ${useCompactColumns ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                    {activePlan.recognitionSigns && (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                        <div className="text-xs font-bold text-emerald-700">Dấu hiệu nhận biết dạng bài</div>
                        <div className="text-slate-800 select-text" style={proseStyle}>
                          <MathFormulaRenderer content={activePlan.recognitionSigns} />
                        </div>
                      </div>
                    )}
                    {activePlan.learningObjective && (
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                        <div className="text-xs font-bold text-indigo-700">Mục tiêu phương pháp</div>
                        <div className="text-slate-800 select-text" style={proseStyle}>
                          <MathFormulaRenderer content={activePlan.learningObjective} />
                        </div>
                      </div>
                    )}
                  </div>

                  {activePlan.commonMistakes.length > 0 && (
                    <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/90 space-y-2">
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Những lỗi sai học sinh thường gặp cần nhắc nhở</span>
                      </div>
                      <ul className="space-y-1.5 text-slate-800 list-disc pl-5 select-text" style={proseStyle}>
                        {activePlan.commonMistakes.map((mistake, idx) => (
                          <li key={idx}>
                            <MathFormulaRenderer content={mistake} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

            {/* PART I: STEP-BY-STEP PROCEDURE */}
            {(sectionFilter === 'all' || sectionFilter === 'steps') && (
              <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                      <ListChecks className="w-4 h-4" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">
                      Phần I. Trình tự các bước giải bài toán
                    </h3>
                  </div>

                  {activePlan.steps.length > 1 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openPresentationAt(1)}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                        title="Trình chiếu slide tóm tắt toàn bộ các bước"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Chiếu tóm tắt bước</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (!progressiveStepsMode) {
                            setProgressiveStepsMode(true);
                            setRevealedStepCount(1);
                          } else {
                            setProgressiveStepsMode(false);
                            setRevealedStepCount(activePlan.steps.length);
                          }
                        }}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                          progressiveStepsMode
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {progressiveStepsMode ? <Eye className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                        <span>{progressiveStepsMode ? 'Đang giảng từng bước' : 'Chế độ mở từng bước'}</span>
                      </button>

                      {progressiveStepsMode && revealedStepCount < activePlan.steps.length && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = Math.min(activePlan.steps.length, revealedStepCount + 1);
                            setRevealedStepCount(next);
                            gameSounds.playStepPop(next - 1);
                          }}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <span>Hiện Bước {revealedStepCount + 1}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Compact Steps Summary Strip before detailed steps */}
                {activePlan.steps.length > 0 && (
                  <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-50/55 border border-emerald-200/80 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-emerald-800">
                        Tóm tắt quy trình {activePlan.steps.length} bước thực hiện:
                      </span>
                      <span className="text-xs text-slate-500">Nắm lộ trình chung trước khi đi vào từng bước chi tiết</span>
                    </div>
                    <div className={`grid gap-2 ${useCompactColumns ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                      {activePlan.steps.map((s, idx) => (
                        <button
                          key={`summary_${idx}`}
                          type="button"
                          onClick={() => openPresentationAt(idx + 2)}
                          className="text-left px-3 py-2 rounded-lg bg-white border border-emerald-200/70 hover:border-emerald-400 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <span className="w-6 h-6 rounded-md bg-emerald-600 text-white text-xs font-bold tabular-nums flex items-center justify-center shrink-0">
                            {s.stepNumber || idx + 1}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate flex-1">
                            <MathFormulaRenderer content={s.title} />
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3.5">
                  {activePlan.steps
                    .slice(0, progressiveStepsMode ? revealedStepCount : activePlan.steps.length)
                    .map((step, idx) => {
                      const stepSpeechId = `step_${idx}`;
                      const isThisSpeaking = activeSpeechKey === stepSpeechId && speechState !== 'idle';
                      return (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5 animate-method-step-reveal"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold text-sm tabular-nums flex items-center justify-center shrink-0 mt-0.5">
                            {step.stepNumber || idx + 1}
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <h4
                                className="font-bold text-slate-900 select-text"
                                style={{ fontSize: `${Math.round(17 * fontScale)}px` }}
                              >
                                <MathFormulaRenderer content={step.title} />
                              </h4>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleSpeakBlock(
                                      stepSpeechId,
                                      `Bước ${step.stepNumber || idx + 1}: ${step.title}. ${step.actionGuide}. ${step.formula || ''} ${step.keyNote || ''}`
                                    )
                                  }
                                  className={`px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                                    isThisSpeaking
                                      ? 'bg-rose-600 border-rose-600 text-white'
                                      : 'bg-white border-slate-200 hover:bg-indigo-50 text-indigo-700'
                                  }`}
                                  title="AI đọc bước này"
                                >
                                  {isThisSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                  <span>{isThisSpeaking ? 'Dừng' : 'Đọc AI'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openPresentationAt(idx + (activePlan.steps.length > 0 ? 2 : 1))}
                                  className="px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                  title="Chiếu toàn màn hình bước này"
                                >
                                  <Play className="w-3 h-3" />
                                  <span>Chiếu bước này</span>
                                </button>
                              </div>
                            </div>
                            <div className="text-slate-700 select-text" style={proseStyle}>
                              <MathFormulaRenderer content={step.actionGuide} />
                            </div>
                            {step.formula && (
                              <div className="p-3 rounded-xl bg-white border border-indigo-200/80 text-indigo-950 overflow-x-auto select-text">
                                <div className="text-xs font-semibold text-indigo-700 mb-1">Công thức áp dụng:</div>
                                <div style={{ fontSize: `${Math.round(17 * fontScale)}px` }}>
                                  <MathFormulaRenderer content={step.formula} isBlock={step.formula.includes('$$')} />
                                </div>
                              </div>
                            )}
                            {step.keyNote && (
                              <div className="flex items-start gap-2 text-xs sm:text-sm text-amber-800 bg-amber-50/80 border border-amber-200/70 rounded-lg px-3 py-2">
                                <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div className="select-text">
                                  <span className="font-semibold">Lưu ý: </span>
                                  <MathFormulaRenderer content={step.keyNote} />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      );
                    })}
                </div>
              </section>
            )}

            {/* PART II: CORE FORMULAS */}
            {(sectionFilter === 'all' || sectionFilter === 'formulas') && activePlan.formulas.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                    <BookOpenCheck className="w-4 h-4" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Phần II. Hệ thống công thức trọng tâm
                  </h3>
                </div>

                <div className={`grid gap-3.5 ${useCompactColumns ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                  {activePlan.formulas.map((f, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-2.5"
                    >
                      <div className="text-sm font-bold text-slate-900">
                        {idx + 1}. <MathFormulaRenderer content={f.name} />
                      </div>
                      <div
                        className="p-3 rounded-lg bg-white border border-slate-200 text-indigo-950 overflow-x-auto text-center select-text"
                        style={{ fontSize: `${Math.round(17 * fontScale)}px` }}
                      >
                        <MathFormulaRenderer content={f.expression} />
                      </div>
                      {f.condition && (
                        <div className="text-xs sm:text-sm text-slate-600 select-text">
                          <MathFormulaRenderer content={f.condition} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* PART III: ILLUSTRATIVE EXAMPLES */}
            {(sectionFilter === 'all' || sectionFilter === 'examples') && activePlan.examples.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 text-sky-700 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Phần III. Ví dụ minh họa có lời giải từng bước
                  </h3>
                </div>

                <div className="space-y-5">
                  {activePlan.examples.map((ex, exIdx) => {
                    const totalSteps = ex.stepByStepSolution.length;
                    const shownCount = revealedExampleSteps[exIdx] ?? totalSteps;
                    const exampleSlideIdx =
                      1 +
                      (activePlan.steps.length > 0 ? 1 : 0) +
                      activePlan.steps.length +
                      (activePlan.formulas.length > 0 ? 1 : 0) +
                      exIdx;
                    const exSpeechId = `example_${exIdx}`;
                    const isExSpeaking = activeSpeechKey === exSpeechId && speechState !== 'idle';

                    return (
                      <div key={exIdx} className="rounded-xl border border-slate-200 bg-slate-50/40 overflow-hidden">
                        {/* Example Problem Header */}
                        <div className="p-4 sm:p-5 bg-white border-b border-slate-200 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs sm:text-sm font-bold text-sky-700">
                              <MathFormulaRenderer content={ex.title || `Ví dụ ${exIdx + 1}`} />
                            </span>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleSpeakBlock(
                                    exSpeechId,
                                    `${ex.title}. Đề bài: ${ex.problem}. ${ex.stepByStepSolution
                                      .map((st) => `${st.stepLabel}: ${st.content}`)
                                      .join(' ')} ${ex.finalAnswer ? `Kết luận: ${ex.finalAnswer}` : ''}`
                                  )
                                }
                                className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                                  isExSpeaking
                                    ? 'bg-rose-600 border-rose-600 text-white'
                                    : 'bg-white border-slate-200 hover:bg-indigo-50 text-indigo-700'
                                }`}
                              >
                                {isExSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                <span>{isExSpeaking ? 'Dừng' : 'Đọc AI'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => openPresentationAt(exampleSlideIdx)}
                                className="min-h-[34px] px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                <Play className="w-3 h-3" />
                                <span>Chiếu ví dụ</span>
                              </button>

                              {totalSteps > 1 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRevealedExampleSteps((prev) => ({
                                        ...prev,
                                        [exIdx]: shownCount >= totalSteps ? 0 : totalSteps,
                                      }))
                                    }
                                    className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                                  >
                                    {shownCount >= totalSteps ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    <span>{shownCount >= totalSteps ? 'Ẩn lời giải' : 'Hiện toàn bộ'}</span>
                                  </button>

                                  {shownCount < totalSteps && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = Math.min(totalSteps, (revealedExampleSteps[exIdx] ?? 0) + 1);
                                        setRevealedExampleSteps((prev) => ({
                                          ...prev,
                                          [exIdx]: next,
                                        }));
                                        gameSounds.playStepPop(next - 1);
                                      }}
                                      className="min-h-[34px] px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                                    >
                                      <span>Giải bước {shownCount + 1}/{totalSteps}</span>
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          <div className="text-slate-900 font-medium select-text" style={proseStyle}>
                            <MathFormulaRenderer content={ex.problem} />
                          </div>
                        </div>

                        {/* Revealed Solution Steps */}
                        {shownCount > 0 && (
                          <div className="p-4 sm:p-5 space-y-3">
                            {ex.stepByStepSolution.slice(0, shownCount).map((st, sIdx) => (
                              <div
                                key={sIdx}
                                className="p-3.5 rounded-xl bg-white border border-slate-200/90 space-y-1.5"
                              >
                                <div className="text-xs sm:text-sm font-bold text-emerald-700">
                                  <MathFormulaRenderer content={st.stepLabel} />
                                </div>
                                <div className="text-slate-800 select-text" style={proseStyle}>
                                  <MathFormulaRenderer content={st.content} />
                                </div>
                                {st.resultFormula && (
                                  <div className="pt-1 text-indigo-900 font-medium overflow-x-auto select-text" style={proseStyle}>
                                    <MathFormulaRenderer content={st.resultFormula} />
                                  </div>
                                )}
                              </div>
                            ))}

                            {shownCount >= totalSteps && ex.finalAnswer && (
                              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 font-semibold select-text" style={proseStyle}>
                                <span className="text-emerald-700 font-bold mr-1.5">Kết luận:</span>
                                <MathFormulaRenderer content={ex.finalAnswer} />
                              </div>
                            )}

                            {shownCount >= totalSteps && ex.teacherTip && (
                              <div className="p-3 rounded-xl bg-sky-50/70 border border-sky-200 text-xs sm:text-sm text-sky-900 flex items-start gap-2 select-text">
                                <Calculator className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-semibold">Mẹo giảng / Kiểm tra nhanh: </span>
                                  <MathFormulaRenderer content={ex.teacherTip} />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* PART IV: SIMILAR PRACTICE EXERCISES */}
            {(sectionFilter === 'all' || sectionFilter === 'exercises') && activePlan.exercises.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">
                      Phần IV. Bài tập tương tự cho học sinh tự luyện
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const allShown = activePlan.exercises.every((e) => visibleSolutions[e.id]);
                        const next: Record<string, boolean> = {};
                        activePlan.exercises.forEach((e) => {
                          next[e.id] = !allShown;
                        });
                        setVisibleSolutions(next);
                      }}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>
                        {activePlan.exercises.every((e) => visibleSolutions[e.id])
                          ? 'Ẩn tất cả đáp án'
                          : 'Hiện tất cả đáp án'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleGenerateMoreExercises}
                      disabled={isGeneratingMoreEx}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isGeneratingMoreEx ? 'animate-spin' : ''}`} />
                      <span>{isGeneratingMoreEx ? 'Đang tạo thêm...' : 'Tạo thêm 3 bài tương tự'}</span>
                    </button>

                    {onSendExercisesToQuiz && (
                      <button
                        type="button"
                        onClick={handleSendToQuizHub}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        title="Đưa bộ bài tập tương tự này sang mục Tạo Đề để giao online hoặc thi trực tiếp"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Chuyển sang Tạo Đề</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3.5">
                  {activePlan.exercises.map((ex, idx) => {
                    const showHint = Boolean(visibleHints[ex.id]);
                    const showSol = Boolean(visibleSolutions[ex.id]);
                    const exerciseSlideIdx =
                      1 +
                      (activePlan.steps.length > 0 ? 1 : 0) +
                      activePlan.steps.length +
                      (activePlan.formulas.length > 0 ? 1 : 0) +
                      activePlan.examples.length +
                      idx;
                    const qSpeechId = `exercise_${ex.id}`;
                    const isQSpeaking = activeSpeechKey === qSpeechId && speechState !== 'idle';

                    return (
                      <div key={ex.id} className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600">
                            <span className="text-slate-900 font-bold tabular-nums">Bài {ex.index || idx + 1}</span>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-700">{ex.level}</span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleSpeakBlock(
                                  qSpeechId,
                                  `Bài tập ${ex.index || idx + 1}: ${ex.problem}`
                                )
                              }
                              className={`min-h-[36px] px-2.5 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                                isQSpeaking
                                  ? 'bg-rose-600 border-rose-600 text-white'
                                  : 'border-slate-200 bg-white hover:bg-indigo-50 text-indigo-700'
                              }`}
                            >
                              {isQSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                              <span>{isQSpeaking ? 'Dừng' : 'Đọc AI'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openPresentationAt(exerciseSlideIdx)}
                              className="min-h-[36px] px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Play className="w-3 h-3" />
                              <span>Chiếu bài</span>
                            </button>

                            {ex.hint && (
                              <button
                                type="button"
                                onClick={() =>
                                  setVisibleHints((prev) => ({ ...prev, [ex.id]: !prev[ex.id] }))
                                }
                                className={`min-h-[36px] px-3 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                                  showHint
                                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <HelpCircle className="w-3.5 h-3.5" />
                                <span>{showHint ? 'Ẩn gợi ý' : 'Gợi ý'}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                const next = !showSol;
                                setVisibleSolutions((prev) => ({ ...prev, [ex.id]: next }));
                                if (next) gameSounds.playCorrectChime();
                              }}
                              className={`min-h-[36px] px-3 py-1 rounded-lg border text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                                showSol
                                  ? 'border-emerald-600 bg-emerald-600 text-white'
                                  : 'border-slate-200 bg-white hover:bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {showSol ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              <span>{showSol ? 'Ẩn lời giải' : 'Xem đáp án & giải'}</span>
                            </button>
                          </div>
                        </div>

                        <div className="text-slate-900 select-text" style={proseStyle}>
                          <MathFormulaRenderer content={ex.problem} />
                        </div>

                        {showHint && ex.hint && (
                          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-xs sm:text-sm text-amber-900 flex items-start gap-2 select-text">
                            <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-semibold">Gợi ý hướng làm: </span>
                              <MathFormulaRenderer content={ex.hint} />
                            </div>
                          </div>
                        )}

                        {showSol && (
                          <div className="p-4 rounded-xl bg-white border border-emerald-200 space-y-2.5 select-text">
                            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-700">
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span>Đáp số: <MathFormulaRenderer content={ex.shortAnswer} /></span>
                            </div>
                            <div className="text-slate-800 pt-1 border-t border-slate-100" style={proseStyle}>
                              <MathFormulaRenderer content={ex.solutionSteps} />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* SAVED TEACHING METHODS DRAWER (CROSS-DEVICE CLOUD LIBRARY) */}
      {showSavedDrawer && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex justify-end"
          onClick={() => setShowSavedDrawer(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">Kho Phương Pháp Đã Lưu</h3>
                <p className="text-xs text-slate-500">Tự động đồng bộ giữa máy tính, điện thoại & Tivi 75"</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSavedDrawer(false)}
                className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-100">
              <input
                type="text"
                value={savedSearchQuery}
                onChange={(e) => setSavedSearchQuery(e.target.value)}
                placeholder="Tìm theo tên chuyên đề, môn học..."
                className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {filteredSavedPlans.length === 0 ? (
                <div className="py-12 text-center text-sm text-slate-500">
                  Chưa có phương pháp nào được lưu trong kho.
                </div>
              ) : (
                filteredSavedPlans.map((item) => {
                  const isSelected = activePlan?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectSaved(item)}
                      className={`p-3.5 rounded-xl border transition-colors cursor-pointer space-y-1.5 ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-sm text-slate-900 line-clamp-2">
                          <MathFormulaRenderer content={item.title} />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSaved(item.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 shrink-0 cursor-pointer"
                          title="Xóa phương pháp này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap">
                        <span className="text-emerald-700 font-semibold">{item.subject}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.grade}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.steps.length} bước</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.exercises.length} bài tập</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(item.updatedAt).toLocaleString('vi-VN')}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
