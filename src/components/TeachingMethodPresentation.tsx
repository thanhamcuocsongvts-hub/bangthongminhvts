import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpenCheck,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  GraduationCap,
  HelpCircle,
  LayoutTemplate,
  Lightbulb,
  ListChecks,
  Loader2,
  Mic,
  Minimize,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  TeachingMethodExample,
  TeachingMethodExercise,
  TeachingMethodPlan,
  TeachingMethodStep,
} from '../types';
import { MathFormulaRenderer } from './MathFormulaRenderer';
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
import {
  getSavedSlideTransition,
  getSavedSlideTransitionsEnabled,
  getSavedSlideTransitionSpeed,
  getSlideTransitionClass,
  getTransitionOption,
  saveSlideTransition,
  saveSlideTransitionsEnabled,
  saveSlideTransitionSpeed,
  SLIDE_TRANSITION_OPTIONS,
  SLIDE_TRANSITION_SPEED_OPTIONS,
  SlideTransitionMode,
  SlideTransitionSpeed,
} from '../utils/slideTransitions';

interface TeachingMethodPresentationProps {
  plan: TeachingMethodPlan;
  initialSlideIndex?: number;
  fontScale: number;
  onChangeFontScale: (next: number) => void;
  onClose: () => void;
  onOpenCasioCalculator?: () => void;
  onSendToQuizHub?: () => void;
}

type StageThemeId =
  | 'chalkboard'
  | 'olympia'
  | 'blueprint'
  | 'editorial_ivory'
  | 'swiss_minimal'
  | 'sakura_pastel'
  | 'botanical'
  | 'warm_wood';

type StageLayout = 'classic' | 'split_editorial' | 'arena_spotlight' | 'bento_cards';

interface StageTheme {
  id: StageThemeId;
  name: string;
  styleTag: string;
  layoutLabel: string;
  layout: StageLayout;
  bgClass: string;
  isLight: boolean;
  titleFontClass: string;
  topBarClass: string;
  cardClass: string;
  subCardClass: string;
  formulaBoxClass: string;
  highlightNoteClass: string;
  textPrimary: string;
  textMuted: string;
  accentText: string;
  accentBadge: string;
  primaryBtnClass: string;
  btnSecondary: string;
  popoverClass: string;
  frameOrnament: 'chalk' | 'blueprint' | 'arena' | 'editorial' | 'minimal' | 'soft';
  preview: {
    canvasBg: string;
    cardBg: string;
    accentColor: string;
    textColor: string;
    borderColor: string;
  };
}

const STAGE_THEMES: Record<StageThemeId, StageTheme> = {
  chalkboard: {
    id: 'chalkboard',
    name: 'Bảng Xanh Phấn Trắng',
    styleTag: 'Truyền thống lớp học 75"',
    layoutLabel: 'Khung bảng chuẩn',
    layout: 'classic',
    bgClass: 'blackboard-bg',
    isLight: false,
    titleFontClass: 'font-sans',
    topBarClass: 'bg-slate-950/60 border-white/15 text-white',
    cardClass: 'bg-[#08261a]/90 border-amber-300/25 text-white shadow-2xl',
    subCardClass: 'bg-white/[0.06] border-white/15 text-slate-100',
    formulaBoxClass: 'bg-slate-950/65 border-amber-300/40 text-amber-100',
    highlightNoteClass: 'border-amber-400/35 bg-amber-500/12 text-amber-100',
    textPrimary: 'text-white',
    textMuted: 'text-emerald-100/80',
    accentText: 'text-amber-300',
    accentBadge: 'bg-amber-400 text-slate-950',
    primaryBtnClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950',
    btnSecondary: 'bg-white/10 hover:bg-white/20 border-white/20 text-white',
    popoverClass: 'bg-[#0b2e21] border-emerald-300/30 text-white shadow-2xl',
    frameOrnament: 'chalk',
    preview: {
      canvasBg: '#0c3323',
      cardBg: '#08261a',
      accentColor: '#fbbf24',
      textColor: '#ffffff',
      borderColor: 'rgba(252,211,77,0.35)',
    },
  },
  olympia: {
    id: 'olympia',
    name: 'Đấu Trường Olympia',
    styleTag: 'Trường quay sôi động',
    layoutLabel: 'Sân khấu tâm điểm',
    layout: 'arena_spotlight',
    bgClass: 'olympia-arena-bg',
    isLight: false,
    titleFontClass: 'font-sans',
    topBarClass: 'bg-slate-950/75 border-amber-400/20 text-white',
    cardClass: 'bg-[#0c1633]/92 border-amber-400/30 text-white shadow-2xl',
    subCardClass: 'bg-blue-950/55 border-sky-400/25 text-slate-100',
    formulaBoxClass: 'bg-slate-950/80 border-amber-400/45 text-amber-100',
    highlightNoteClass: 'border-sky-400/35 bg-sky-500/15 text-sky-100',
    textPrimary: 'text-white',
    textMuted: 'text-sky-100/80',
    accentText: 'text-amber-400',
    accentBadge: 'bg-amber-400 text-slate-950',
    primaryBtnClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950',
    btnSecondary: 'bg-white/10 hover:bg-white/20 border-sky-300/25 text-white',
    popoverClass: 'bg-[#0c1633] border-amber-400/30 text-white shadow-2xl',
    frameOrnament: 'arena',
    preview: {
      canvasBg: '#091128',
      cardBg: '#0c1633',
      accentColor: '#f59e0b',
      textColor: '#f8fafc',
      borderColor: 'rgba(245,158,11,0.45)',
    },
  },
  blueprint: {
    id: 'blueprint',
    name: 'Kỹ Thuật STEM Blueprint',
    styleTag: 'Chính xác • Khoa học',
    layoutLabel: 'Sân khấu tọa độ',
    layout: 'arena_spotlight',
    bgClass: 'blueprint-stem-bg',
    isLight: false,
    titleFontClass: 'font-sans',
    topBarClass: 'bg-[#051222]/85 border-sky-400/20 text-white',
    cardClass: 'bg-[#09203d]/90 border-sky-400/30 text-white shadow-2xl',
    subCardClass: 'bg-sky-950/55 border-sky-400/20 text-slate-100',
    formulaBoxClass: 'bg-[#04101f]/85 border-cyan-400/45 text-cyan-100',
    highlightNoteClass: 'border-cyan-400/35 bg-cyan-500/12 text-cyan-100',
    textPrimary: 'text-white',
    textMuted: 'text-sky-200/80',
    accentText: 'text-sky-300',
    accentBadge: 'bg-sky-400 text-slate-950',
    primaryBtnClass: 'bg-sky-400 hover:bg-sky-300 text-slate-950',
    btnSecondary: 'bg-sky-400/10 hover:bg-sky-400/20 border-sky-400/25 text-white',
    popoverClass: 'bg-[#081c36] border-sky-400/35 text-white shadow-2xl',
    frameOrnament: 'blueprint',
    preview: {
      canvasBg: '#07192f',
      cardBg: '#09203d',
      accentColor: '#38bdf8',
      textColor: '#f0f9ff',
      borderColor: 'rgba(56,189,248,0.4)',
    },
  },
  editorial_ivory: {
    id: 'editorial_ivory',
    name: 'Tạp Chí Tri Thức',
    styleTag: 'Thanh lịch • Chuyên sâu',
    layoutLabel: 'Bố cục 2 cột báo chí',
    layout: 'split_editorial',
    bgClass: 'editorial-ivory-bg',
    isLight: true,
    titleFontClass: 'font-serif',
    topBarClass: 'bg-[#faf6ef]/95 border-stone-300 text-stone-900',
    cardClass: 'bg-white/95 border-stone-300 text-stone-900 shadow-xl',
    subCardClass: 'bg-[#f8f3ea] border-stone-200 text-stone-800',
    formulaBoxClass: 'bg-amber-50/70 border-amber-300 text-stone-950',
    highlightNoteClass: 'border-amber-300 bg-amber-50/90 text-amber-950',
    textPrimary: 'text-stone-900',
    textMuted: 'text-stone-600',
    accentText: 'text-amber-700',
    accentBadge: 'bg-amber-700 text-white',
    primaryBtnClass: 'bg-amber-700 hover:bg-amber-800 text-white',
    btnSecondary: 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-stone-800',
    popoverClass: 'bg-white border-stone-300 text-stone-900 shadow-2xl',
    frameOrnament: 'editorial',
    preview: {
      canvasBg: '#faf6ef',
      cardBg: '#ffffff',
      accentColor: '#b45309',
      textColor: '#1c1917',
      borderColor: '#d6d3d1',
    },
  },
  swiss_minimal: {
    id: 'swiss_minimal',
    name: 'Tối Giản Thụy Sĩ',
    styleTag: 'Tương phản cao • Rõ nét',
    layoutLabel: 'Bố cục 2 cột số lớn',
    layout: 'split_editorial',
    bgClass: 'swiss-minimal-bg',
    isLight: true,
    titleFontClass: 'font-sans',
    topBarClass: 'bg-white/95 border-slate-200 text-slate-900',
    cardClass: 'bg-white border-slate-300 text-slate-950 shadow-xl',
    subCardClass: 'bg-slate-50 border-slate-200 text-slate-800',
    formulaBoxClass: 'bg-slate-900 border-slate-900 text-white',
    highlightNoteClass: 'border-rose-200 bg-rose-50 text-rose-950',
    textPrimary: 'text-slate-950',
    textMuted: 'text-slate-600',
    accentText: 'text-rose-600',
    accentBadge: 'bg-rose-600 text-white',
    primaryBtnClass: 'bg-rose-600 hover:bg-rose-700 text-white',
    btnSecondary: 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-900',
    popoverClass: 'bg-white border-slate-300 text-slate-900 shadow-2xl',
    frameOrnament: 'minimal',
    preview: {
      canvasBg: '#ffffff',
      cardBg: '#f8fafc',
      accentColor: '#e11d48',
      textColor: '#0f172a',
      borderColor: '#cbd5e1',
    },
  },
  sakura_pastel: {
    id: 'sakura_pastel',
    name: 'Sáng Tạo San Hô',
    styleTag: 'Tươi mới • Gần gũi',
    layoutLabel: 'Thẻ khối Bento',
    layout: 'bento_cards',
    bgClass: 'sakura-pastel-bg',
    isLight: true,
    titleFontClass: 'font-sans',
    topBarClass: 'bg-white/95 border-orange-200/80 text-slate-900',
    cardClass: 'bg-white/95 border-orange-200 text-slate-900 shadow-xl',
    subCardClass: 'bg-orange-50/45 border-orange-200/80 text-slate-800',
    formulaBoxClass: 'bg-teal-50/80 border-teal-200 text-teal-950',
    highlightNoteClass: 'border-amber-200 bg-amber-50/85 text-amber-950',
    textPrimary: 'text-slate-900',
    textMuted: 'text-slate-600',
    accentText: 'text-orange-600',
    accentBadge: 'bg-orange-600 text-white',
    primaryBtnClass: 'bg-teal-600 hover:bg-teal-700 text-white',
    btnSecondary: 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-slate-800',
    popoverClass: 'bg-white border-orange-200 text-slate-900 shadow-2xl',
    frameOrnament: 'soft',
    preview: {
      canvasBg: '#fffaf5',
      cardBg: '#ffffff',
      accentColor: '#ea580c',
      textColor: '#0f172a',
      borderColor: '#fed7aa',
    },
  },
  botanical: {
    id: 'botanical',
    name: 'Khu Vườn Lục Bảo',
    styleTag: 'Dịu mắt suốt tiết học',
    layoutLabel: 'Thẻ khối Bento',
    layout: 'bento_cards',
    bgClass: 'botanical-emerald-bg',
    isLight: true,
    titleFontClass: 'font-sans',
    topBarClass: 'bg-white/95 border-emerald-200 text-emerald-950',
    cardClass: 'bg-white/95 border-emerald-200 text-slate-900 shadow-xl',
    subCardClass: 'bg-emerald-50/55 border-emerald-200/80 text-slate-800',
    formulaBoxClass: 'bg-emerald-900 border-emerald-800 text-white',
    highlightNoteClass: 'border-amber-200 bg-amber-50 text-amber-950',
    textPrimary: 'text-emerald-950',
    textMuted: 'text-slate-600',
    accentText: 'text-emerald-700',
    accentBadge: 'bg-emerald-700 text-white',
    primaryBtnClass: 'bg-emerald-700 hover:bg-emerald-800 text-white',
    btnSecondary: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-900',
    popoverClass: 'bg-white border-emerald-200 text-slate-900 shadow-2xl',
    frameOrnament: 'soft',
    preview: {
      canvasBg: '#eef6f1',
      cardBg: '#ffffff',
      accentColor: '#047857',
      textColor: '#064e3b',
      borderColor: '#a7f3d0',
    },
  },
  warm_wood: {
    id: 'warm_wood',
    name: 'Thư Viện Gỗ Mun',
    styleTag: 'Sang trọng • Sâu lắng',
    layoutLabel: 'Khung bảng cổ điển',
    layout: 'classic',
    bgClass: 'wood-board-bg',
    isLight: false,
    titleFontClass: 'font-serif',
    topBarClass: 'bg-[#1c1008]/85 border-amber-400/20 text-amber-50',
    cardClass: 'bg-[#2a170c]/92 border-amber-400/30 text-amber-50 shadow-2xl',
    subCardClass: 'bg-amber-950/45 border-amber-300/20 text-amber-50',
    formulaBoxClass: 'bg-[#1b0e06]/85 border-amber-400/40 text-amber-100',
    highlightNoteClass: 'border-amber-400/35 bg-amber-500/12 text-amber-100',
    textPrimary: 'text-amber-50',
    textMuted: 'text-amber-200/80',
    accentText: 'text-amber-300',
    accentBadge: 'bg-amber-400 text-slate-950',
    primaryBtnClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950',
    btnSecondary: 'bg-amber-400/10 hover:bg-amber-400/20 border-amber-300/25 text-amber-50',
    popoverClass: 'bg-[#24130a] border-amber-400/30 text-amber-50 shadow-2xl',
    frameOrnament: 'editorial',
    preview: {
      canvasBg: '#29180d',
      cardBg: '#362011',
      accentColor: '#fbbf24',
      textColor: '#fef3c7',
      borderColor: 'rgba(251,191,36,0.35)',
    },
  },
};

function extractConciseStepSummary(rawText: string): string {
  const clean = (rawText || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= 165) return clean;

  let inMath = false;
  let doubleDollar = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '$' && clean[i - 1] !== '\\') {
      if (clean[i + 1] === '$') {
        if (!inMath) {
          inMath = true;
          doubleDollar = true;
        } else if (doubleDollar) {
          inMath = false;
          doubleDollar = false;
        }
        i++;
        continue;
      } else if (!doubleDollar) {
        inMath = !inMath;
        continue;
      }
    }
    if (!inMath && (ch === '.' || ch === '!' || ch === '?')) {
      const nextCh = clean[i + 1];
      if (!nextCh || nextCh === ' ') {
        const sentence = clean.slice(0, i + 1).trim();
        if (sentence.length >= 24) return sentence;
      }
    }
  }
  return clean;
}

type DeckSlide =
  | { id: string; kind: 'overview'; navLabel: string }
  | { id: string; kind: 'steps_summary'; navLabel: string; firstStepSlideIdx: number }
  | { id: string; kind: 'step'; navLabel: string; step: TeachingMethodStep; stepIdx: number; totalSteps: number }
  | { id: string; kind: 'formulas'; navLabel: string }
  | { id: string; kind: 'example'; navLabel: string; example: TeachingMethodExample; exampleIdx: number }
  | {
      id: string;
      kind: 'exercise';
      navLabel: string;
      exercise: TeachingMethodExercise;
      exerciseIdx: number;
      totalExercises: number;
    };

export const TeachingMethodPresentation: React.FC<TeachingMethodPresentationProps> = ({
  plan,
  initialSlideIndex = 0,
  fontScale,
  onChangeFontScale,
  onClose,
  onOpenCasioCalculator,
  onSendToQuizHub,
}) => {
  const slides = useMemo<DeckSlide[]>(() => {
    const list: DeckSlide[] = [{ id: 'overview', kind: 'overview', navLabel: 'Tổng quan' }];
    if (plan.steps.length > 0) {
      const firstStepSlideIdx = list.length + 1;
      list.push({
        id: 'steps_summary',
        kind: 'steps_summary',
        navLabel: 'Tóm tắt bước',
        firstStepSlideIdx,
      });
    }
    plan.steps.forEach((step, idx) => {
      list.push({
        id: `step_${idx}`,
        kind: 'step',
        navLabel: `Bước ${step.stepNumber || idx + 1}`,
        step,
        stepIdx: idx,
        totalSteps: plan.steps.length,
      });
    });
    if (plan.formulas.length > 0) {
      list.push({ id: 'formulas', kind: 'formulas', navLabel: 'Công thức' });
    }
    plan.examples.forEach((ex, idx) => {
      list.push({
        id: `example_${idx}`,
        kind: 'example',
        navLabel: plan.examples.length > 1 ? `Ví dụ ${idx + 1}` : 'Ví dụ mẫu',
        example: ex,
        exampleIdx: idx,
      });
    });
    plan.exercises.forEach((ex, idx) => {
      list.push({
        id: `exercise_${idx}`,
        kind: 'exercise',
        navLabel: `Bài ${ex.index || idx + 1}`,
        exercise: ex,
        exerciseIdx: idx,
        totalExercises: plan.exercises.length,
      });
    });
    return list;
  }, [plan]);

  const [slideIdx, setSlideIdx] = useState<number>(() =>
    Math.min(Math.max(0, initialSlideIndex), Math.max(0, slides.length - 1))
  );
  const [navDirection, setNavDirection] = useState<'right' | 'left'>('right');

  // Template & Transition Mode
  const [themeId, setThemeId] = useState<StageThemeId>(() => {
    try {
      const saved = localStorage.getItem('smartboard_method_stage_theme') as StageThemeId | null;
      if (saved && STAGE_THEMES[saved]) return saved;
    } catch (_) {}
    return 'chalkboard';
  });
  const [transitionMode, setTransitionMode] = useState<SlideTransitionMode>(() =>
    getSavedSlideTransition('smartboard_method_slide_transition', 'slide')
  );
  const [transitionSpeed, setTransitionSpeed] = useState<SlideTransitionSpeed>(() =>
    getSavedSlideTransitionSpeed('smooth')
  );
  const [transitionsEnabled, setTransitionsEnabled] = useState<boolean>(() =>
    getSavedSlideTransitionsEnabled(true)
  );
  const [showTransitionMenu, setShowTransitionMenu] = useState<boolean>(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Progressive Reveal states per slide
  const [showOverviewMistakes, setShowOverviewMistakes] = useState<boolean>(false);
  const [stepDetailVisible, setStepDetailVisible] = useState<boolean>(true);
  const [formulaRevealCount, setFormulaRevealCount] = useState<number>(1);
  const [exampleStepCount, setExampleStepCount] = useState<Record<number, number>>({});
  const [exerciseHintOpen, setExerciseHintOpen] = useState<Record<string, boolean>>({});
  const [exerciseAnswerOpen, setExerciseAnswerOpen] = useState<Record<string, boolean>>({});

  // Exercise Quick Countdown Timer
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  // AI Voice state
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
  const [autoSpeakOnSlide, setAutoSpeakOnSlide] = useState<boolean>(false);
  const [speechState, setSpeechState] = useState<'idle' | 'calling' | 'speaking'>('idle');
  const speechStateRef = useRef(speechState);
  speechStateRef.current = speechState;
  const speechWatchdogRef = useRef<any>(null);

  const theme = STAGE_THEMES[themeId];
  const currentSlide = slides[slideIdx] || slides[0];

  useEffect(() => {
    const syncSpeed = (e: Event) => {
      const next = (e as CustomEvent<SlideTransitionSpeed>).detail;
      if (next) setTransitionSpeed(next);
    };
    const syncEnabled = (e: Event) => {
      const next = (e as CustomEvent<boolean>).detail;
      if (typeof next === 'boolean') setTransitionsEnabled(next);
    };
    window.addEventListener('smartboard_slide_speed_changed', syncSpeed);
    window.addEventListener('smartboard_slide_enabled_changed', syncEnabled);
    return () => {
      window.removeEventListener('smartboard_slide_speed_changed', syncSpeed);
      window.removeEventListener('smartboard_slide_enabled_changed', syncEnabled);
    };
  }, []);

  useEffect(() => {
    if (soundEnabled) {
      gameSounds.playStageIntro();
    }
    return () => {
      stopAllSpeech();
      if (speechWatchdogRef.current) clearTimeout(speechWatchdogRef.current);
    };
  }, []);

  useEffect(() => {
    if (!timerRunning) return;
    if (timerSeconds <= 0) {
      setTimerRunning(false);
      if (soundEnabled) gameSounds.playCorrectChime();
      return;
    }
    const id = setTimeout(() => {
      if (soundEnabled && timerSeconds <= 4 && timerSeconds > 1) {
        gameSounds.playWheelTick();
      }
      setTimerSeconds((s) => s - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [timerRunning, timerSeconds, soundEnabled]);

  const stopSpeechNow = useCallback(() => {
    if (speechWatchdogRef.current) {
      clearTimeout(speechWatchdogRef.current);
      speechWatchdogRef.current = null;
    }
    stopAllSpeech();
    setSpeechState('idle');
  }, []);

  const speakVietnameseScript = useCallback(
    (rawScript: string) => {
      const text = rawScript.trim();
      if (!text) return;
      unlockWebAudio();
      if (speechWatchdogRef.current) {
        clearTimeout(speechWatchdogRef.current);
        speechWatchdogRef.current = null;
      }
      setSpeechState('calling');
      speechWatchdogRef.current = setTimeout(() => {
        if (speechStateRef.current === 'calling') {
          setSpeechState('idle');
        }
      }, 12000);

      speakText(text, {
        preset: selectedVoice,
        subject: plan.subject,
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
        },
        onError: () => {
          if (speechWatchdogRef.current) {
            clearTimeout(speechWatchdogRef.current);
            speechWatchdogRef.current = null;
          }
          setSpeechState('idle');
        },
      });
    },
    [selectedVoice, plan.subject]
  );

  const buildSlideSpeechScript = useCallback(
    (slide: DeckSlide): string => {
      if (!slide) return '';
      if (slide.kind === 'overview') {
        return `Phương pháp giải: ${plan.title}. Dấu hiệu nhận biết: ${plan.recognitionSigns}. Mục tiêu: ${plan.learningObjective}.`;
      }
      if (slide.kind === 'steps_summary') {
        return `Tóm tắt quy trình giải bài toán ${plan.title} gồm ${plan.steps.length} bước. ${plan.steps
          .map((s, idx) => `Bước ${s.stepNumber || idx + 1}: ${s.title}. ${extractConciseStepSummary(s.actionGuide)}`)
          .join(' ')}`;
      }
      if (slide.kind === 'step') {
        const s = slide.step;
        return `Bước ${s.stepNumber || slide.stepIdx + 1}: ${s.title}. ${s.actionGuide}. ${
          s.formula ? `Công thức áp dụng: ${s.formula}.` : ''
        } ${s.keyNote ? `Lưu ý: ${s.keyNote}.` : ''}`;
      }
      if (slide.kind === 'formulas') {
        const visibleFormulas = plan.formulas.slice(0, Math.max(1, formulaRevealCount));
        return `Hệ thống công thức trọng tâm của bài ${plan.title}. ${visibleFormulas
          .map((f, i) => `Công thức ${i + 1}: ${f.name}: ${f.expression}. ${f.condition || ''}`)
          .join(' ')}`;
      }
      if (slide.kind === 'example') {
        const ex = slide.example;
        const shown = exampleStepCount[slide.exampleIdx] ?? 0;
        if (shown === 0) {
          return `${ex.title}. Đề bài: ${ex.problem}.`;
        }
        const st = ex.stepByStepSolution[shown - 1];
        if (shown >= ex.stepByStepSolution.length && ex.finalAnswer) {
          return `${st ? `${st.stepLabel}: ${st.content}.` : ''} Kết luận đáp số: ${ex.finalAnswer}.`;
        }
        return st ? `${st.stepLabel}: ${st.content}. ${st.resultFormula || ''}` : ex.problem;
      }
      if (slide.kind === 'exercise') {
        const ex = slide.exercise;
        if (exerciseAnswerOpen[ex.id]) {
          return `Lời giải Bài ${ex.index || slide.exerciseIdx + 1}. Đáp số: ${ex.shortAnswer}. ${ex.solutionSteps}`;
        }
        return `Bài tập tương tự số ${ex.index || slide.exerciseIdx + 1}, mức độ ${ex.level}. Đề bài: ${ex.problem}.`;
      }
      return '';
    },
    [plan, formulaRevealCount, exampleStepCount, exerciseAnswerOpen]
  );

  const handleToggleSpeakCurrentSlide = () => {
    if (speechState !== 'idle') {
      stopSpeechNow();
      return;
    }
    speakVietnameseScript(buildSlideSpeechScript(currentSlide));
  };

  const jumpToSlide = useCallback(
    (targetIdx: number, directionHint?: 'left' | 'right') => {
      const clamped = Math.min(Math.max(0, targetIdx), slides.length - 1);
      if (clamped === slideIdx) return;
      stopSpeechNow();
      setTimerRunning(false);
      setTimerSeconds(0);
      setNavDirection(directionHint || (clamped > slideIdx ? 'right' : 'left'));
      setSlideIdx(clamped);

      const nextSlide = slides[clamped];
      if (nextSlide?.kind === 'step') {
        setStepDetailVisible(true);
      } else if (nextSlide?.kind === 'formulas') {
        setFormulaRevealCount(1);
      }

      if (soundEnabled) {
        gameSounds.playSlideTransition();
      }
      if (autoSpeakOnSlide && nextSlide) {
        setTimeout(() => {
          speakVietnameseScript(buildSlideSpeechScript(nextSlide));
        }, 160);
      }
    },
    [slideIdx, slides, soundEnabled, autoSpeakOnSlide, stopSpeechNow, speakVietnameseScript, buildSlideSpeechScript]
  );

  const handleAdvanceAction = useCallback(() => {
    if (!currentSlide) return;

    if (currentSlide.kind === 'formulas' && formulaRevealCount < plan.formulas.length) {
      const nextCount = formulaRevealCount + 1;
      setFormulaRevealCount(nextCount);
      if (soundEnabled) gameSounds.playStepPop(nextCount - 1);
      if (autoSpeakOnSlide) {
        const f = plan.formulas[nextCount - 1];
        if (f) speakVietnameseScript(`Công thức ${nextCount}: ${f.name}: ${f.expression}.`);
      }
      return;
    }

    if (currentSlide.kind === 'example') {
      const ex = currentSlide.example;
      const shown = exampleStepCount[currentSlide.exampleIdx] ?? 0;
      if (shown < ex.stepByStepSolution.length) {
        const nextShown = shown + 1;
        setExampleStepCount((prev) => ({ ...prev, [currentSlide.exampleIdx]: nextShown }));
        if (soundEnabled) {
          if (nextShown === ex.stepByStepSolution.length) {
            gameSounds.playCorrectChime();
          } else {
            gameSounds.playStepPop(nextShown - 1);
          }
        }
        if (autoSpeakOnSlide) {
          const st = ex.stepByStepSolution[nextShown - 1];
          const suffix =
            nextShown === ex.stepByStepSolution.length && ex.finalAnswer
              ? ` Kết luận: ${ex.finalAnswer}.`
              : '';
          if (st) speakVietnameseScript(`${st.stepLabel}: ${st.content}.${suffix}`);
        }
        return;
      }
    }

    if (slideIdx < slides.length - 1) {
      jumpToSlide(slideIdx + 1, 'right');
    }
  }, [
    currentSlide,
    formulaRevealCount,
    plan.formulas,
    exampleStepCount,
    slideIdx,
    slides.length,
    soundEnabled,
    autoSpeakOnSlide,
    speakVietnameseScript,
    jumpToSlide,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        if (showTemplateGallery) {
          setShowTemplateGallery(false);
          return;
        }
        stopSpeechNow();
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        handleAdvanceAction();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        if (slideIdx > 0) jumpToSlide(slideIdx - 1, 'left');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleAdvanceAction, slideIdx, jumpToSlide, stopSpeechNow, onClose, showTemplateGallery]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    gameSounds.setMuted(!next);
    if (next) {
      unlockWebAudio();
      gameSounds.playStepPop(2);
    }
  };

  const handleSelectTheme = (id: StageThemeId) => {
    setThemeId(id);
    if (soundEnabled) {
      unlockWebAudio();
      gameSounds.playStepPop(3);
    }
    try {
      localStorage.setItem('smartboard_method_stage_theme', id);
    } catch (_) {}
  };

  const handleSelectTransition = (mode: SlideTransitionMode) => {
    setTransitionMode(mode);
    if (!transitionsEnabled) {
      setTransitionsEnabled(true);
      saveSlideTransitionsEnabled(true);
    }
    setShowTransitionMenu(false);
    if (soundEnabled) gameSounds.playSlideTransition();
    saveSlideTransition('smartboard_method_slide_transition', mode);
  };

  const handleSelectTransitionSpeed = (speed: SlideTransitionSpeed) => {
    setTransitionSpeed(speed);
    if (!transitionsEnabled) {
      setTransitionsEnabled(true);
      saveSlideTransitionsEnabled(true);
    }
    saveSlideTransitionSpeed(speed);
  };

  const handleToggleTransitionsEnabled = (nextEnabled?: boolean) => {
    const target = typeof nextEnabled === 'boolean' ? nextEnabled : !transitionsEnabled;
    setTransitionsEnabled(target);
    saveSlideTransitionsEnabled(target);
  };

  const handleSelectVoice = (preset: VoiceTonePreset) => {
    setSelectedVoice(preset);
    setShowVoiceMenu(false);
    try {
      localStorage.setItem('smartboard_ai_voice_preset', preset.id);
    } catch (_) {}
  };

  const proseStyle: React.CSSProperties = {
    fontSize: `${Math.round(20 * fontScale)}px`,
    lineHeight: 1.65,
  };

  const slideAnimClass = getSlideTransitionClass(
    transitionMode,
    navDirection === 'right' ? 'next' : 'prev',
    transitionsEnabled
  );

  const canAdvanceSubStep =
    (currentSlide.kind === 'formulas' && formulaRevealCount < plan.formulas.length) ||
    (currentSlide.kind === 'example' &&
      (exampleStepCount[currentSlide.exampleIdx] ?? 0) < currentSlide.example.stepByStepSolution.length);

  const stepDisplayNumber = (num: number) => String(num).padStart(2, '0');

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden ${theme.bgClass} transition-colors duration-300 relative`}>
      {/* TOP STAGE COMMAND BAR */}
      <header
        className={`shrink-0 border-b px-3 sm:px-5 py-2 flex items-center justify-between gap-2 backdrop-blur-md z-30 ${theme.topBarClass}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`px-2.5 py-1 rounded-lg text-xs font-extrabold tabular-nums shrink-0 ${theme.accentBadge}`}>
            {slideIdx + 1}/{slides.length}
          </div>
          <div className="min-w-0">
            <div className={`text-xs sm:text-sm font-bold truncate max-w-[160px] sm:max-w-[260px] xl:max-w-[380px] ${theme.titleFontClass}`}>
              <MathFormulaRenderer content={plan.title} />
            </div>
            <div className="text-[11px] opacity-75 flex items-center gap-1.5 truncate">
              <span>{plan.subject}</span>
              <span aria-hidden="true">·</span>
              <span>{plan.grade}</span>
              <span aria-hidden="true">·</span>
              <span>{currentSlide.navLabel}</span>
            </div>
          </div>
        </div>

        {/* STAGE CONTROLS (SINGLE COMPACT LINE ON DESKTOP) */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {/* AI Voice Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowVoiceMenu((v) => !v);
                setShowTemplateGallery(false);
                setShowTransitionMenu(false);
              }}
              className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${theme.btnSecondary}`}
              title={`Chọn giọng đọc AI (${selectedVoice.name})`}
            >
              <Mic className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden 2xl:inline max-w-[120px] truncate">{selectedVoice.label}</span>
              <span className="2xl:hidden">Giọng AI</span>
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>

            {showVoiceMenu && (
              <div className={`absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border p-3 z-50 space-y-2 ${theme.popoverClass}`}>
                <div className="flex items-center justify-between pb-1.5 border-b border-current/15">
                  <span className="text-xs font-bold">Chọn Giọng Đọc AI Sư Phạm</span>
                  <button
                    type="button"
                    onClick={() => setShowVoiceMenu(false)}
                    className="p-1 rounded-lg hover:bg-black/15 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                  {VOICE_TONE_PRESETS.slice(0, 8).map((preset) => {
                    const isSel = selectedVoice.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectVoice(preset)}
                        className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                          isSel
                            ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                            : theme.isLight
                            ? 'bg-slate-50 hover:bg-emerald-50 border-slate-200 text-slate-800'
                            : 'bg-white/5 hover:bg-white/15 border-white/10 text-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold truncate">{preset.label}</div>
                          <div className={`text-[11px] truncate ${isSel ? 'text-slate-800' : 'opacity-75'}`}>
                            {preset.sub}
                          </div>
                        </div>
                        {isSel && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <div className="pt-2 border-t border-current/15 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold opacity-80">Tốc độ:</span>
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
                              ? theme.primaryBtnClass
                              : theme.btnSecondary
                          }`}
                        >
                          {sp.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <label className="pt-1.5 border-t border-current/15 flex items-center justify-between gap-2 cursor-pointer text-xs font-semibold">
                  <span>Tự động đọc AI khi sang bước mới</span>
                  <input
                    type="checkbox"
                    checked={autoSpeakOnSlide}
                    onChange={(e) => setAutoSpeakOnSlide(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Primary Read Slide AI Button */}
          <button
            type="button"
            onClick={handleToggleSpeakCurrentSlide}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              speechState === 'calling'
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : speechState === 'speaking'
                ? 'bg-rose-600 text-white border-rose-400'
                : theme.primaryBtnClass
            }`}
          >
            {speechState === 'calling' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang gọi AI...</span>
              </>
            ) : speechState === 'speaking' ? (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Dừng đọc</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Đọc AI</span>
              </>
            )}
          </button>

          {/* Classroom Sound FX & Applause */}
          <button
            type="button"
            onClick={handleToggleSound}
            className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${theme.btnSecondary}`}
            title={soundEnabled ? 'Tắt hiệu ứng âm thanh' : 'Bật hiệu ứng âm thanh sôi động'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 opacity-60" />}
            <span className="hidden xl:inline">{soundEnabled ? 'Âm thanh' : 'Tắt tiếng'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              unlockWebAudio();
              gameSounds.setMuted(false);
              setSoundEnabled(true);
              gameSounds.playApplause();
            }}
            className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${theme.btnSecondary}`}
            title="Phát tiếng vỗ tay cổ vũ cả lớp"
          >
            <Award className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline">Vỗ tay</span>
          </button>

          {/* Quick Slide Transition Effect Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowTransitionMenu((v) => !v);
                setShowVoiceMenu(false);
                setShowTemplateGallery(false);
              }}
              className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${theme.btnSecondary}`}
              title={
                transitionsEnabled
                  ? `Hiệu ứng chuyển tiếp slide: ${getTransitionOption(transitionMode).label}`
                  : 'Hiệu ứng chuyển slide đang tắt (chuyển tức thì)'
              }
            >
              <Sparkles className={`w-3.5 h-3.5 shrink-0 ${transitionsEnabled ? 'text-amber-400' : 'opacity-45'}`} />
              <span className="hidden lg:inline">
                {transitionsEnabled ? getTransitionOption(transitionMode).shortLabel : 'Tắt hiệu ứng'}
              </span>
              <ChevronDown className="w-3 h-3 opacity-80" />
            </button>

            {showTransitionMenu && (
              <div className={`absolute right-0 mt-2 w-72 rounded-2xl border p-3 z-50 space-y-2 ${theme.popoverClass}`}>
                <div className="flex items-center justify-between pb-1.5 border-b border-current/15">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Hiệu ứng chuyển slide</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTransitionMenu(false)}
                    className="p-1 rounded-lg hover:bg-black/15 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* On / Off Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleTransitionsEnabled()}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    transitionsEnabled
                      ? theme.isLight
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                      : theme.btnSecondary
                  }`}
                >
                  <span>{transitionsEnabled ? 'Đang bật hiệu ứng' : 'Đã tắt hiệu ứng (êm mắt)'}</span>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold ${
                      transitionsEnabled ? 'bg-emerald-500 text-white' : 'bg-slate-600 text-white'
                    }`}
                  >
                    {transitionsEnabled ? 'BẬT' : 'TẮT'}
                  </span>
                </button>

                <div className={`space-y-1.5 ${!transitionsEnabled ? 'opacity-55' : ''}`}>
                  {SLIDE_TRANSITION_OPTIONS.map((eff) => {
                    const active = transitionsEnabled && transitionMode === eff.id;
                    return (
                      <button
                        key={eff.id}
                        type="button"
                        onClick={() => handleSelectTransition(eff.id)}
                        className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                          active
                            ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                            : theme.isLight
                            ? 'bg-slate-50 hover:bg-amber-50 border-slate-200 text-slate-800'
                            : 'bg-white/5 hover:bg-white/15 border-white/10 text-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-bold truncate">{eff.label}</div>
                          <div className={`text-[11px] truncate ${active ? 'text-slate-800' : 'opacity-75'}`}>
                            {eff.description}
                          </div>
                        </div>
                        {active && <Check className="w-4 h-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <div className={`pt-2 border-t border-current/15 space-y-1.5 ${!transitionsEnabled ? 'opacity-55' : ''}`}>
                  <div className="text-[11px] font-bold opacity-80">Tốc độ chuyển cảnh:</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {SLIDE_TRANSITION_SPEED_OPTIONS.map((sp) => {
                      const active = transitionSpeed === sp.id;
                      return (
                        <button
                          key={sp.id}
                          type="button"
                          onClick={() => handleSelectTransitionSpeed(sp.id)}
                          className={`px-2 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-colors ${
                            active ? theme.primaryBtnClass : theme.btnSecondary
                          }`}
                          title={sp.label}
                        >
                          {sp.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Visual Template Gallery Button */}
          <button
            type="button"
            onClick={() => {
              setShowTemplateGallery((v) => !v);
              setShowVoiceMenu(false);
              setShowTransitionMenu(false);
            }}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${theme.btnSecondary}`}
            title="Chọn trong 8 mẫu template trình chiếu & hiệu ứng chuyển slide"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="hidden md:inline max-w-[140px] truncate">{theme.name}</span>
            <span className="md:hidden">Mẫu (8)</span>
          </button>

          {/* Font Scale */}
          <div className={`hidden sm:flex items-center rounded-xl border overflow-hidden ${theme.btnSecondary}`}>
            <button
              type="button"
              onClick={() => onChangeFontScale(Math.max(0.85, Number((fontScale - 0.1).toFixed(2))))}
              className="px-2 py-2 hover:bg-black/15 cursor-pointer"
              title="Thu nhỏ chữ"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-xs font-bold tabular-nums">{Math.round(fontScale * 100)}%</span>
            <button
              type="button"
              onClick={() => onChangeFontScale(Math.min(1.6, Number((fontScale + 0.1).toFixed(2))))}
              className="px-2 py-2 hover:bg-black/15 cursor-pointer"
              title="Phóng to chữ 75 inch"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {onOpenCasioCalculator && (
            <button
              type="button"
              onClick={onOpenCasioCalculator}
              className={`min-h-[38px] px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${theme.btnSecondary}`}
            >
              <Calculator className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden 2xl:inline">Casio 580</span>
            </button>
          )}

          {/* Exit Fullscreen Presentation */}
          <button
            type="button"
            onClick={() => {
              stopSpeechNow();
              onClose();
            }}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Minimize className="w-3.5 h-3.5" />
            <span>Thoát</span>
          </button>
        </div>
      </header>

      {/* CENTRAL PRESENTATION STAGE */}
      <main className="flex-1 min-h-0 overflow-y-auto smooth-touch-scroll p-3 sm:p-6 md:p-8 flex items-start sm:items-center justify-center relative">
        <div
          key={`${currentSlide.id}_${themeId}_${transitionMode}`}
          className={`w-full max-w-6xl rounded-3xl border p-5 sm:p-8 md:p-10 space-y-6 relative overflow-hidden ${theme.cardClass} ${slideAnimClass}`}
        >
          {/* Architectural / Geometric Stage Accents (tailored to template) */}
          {theme.frameOrnament === 'blueprint' && (
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-4 w-24 h-24 text-sky-400/20"
              viewBox="0 0 100 100"
              fill="none"
            >
              <circle cx="70" cy="30" r="24" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3" />
              <path d="M40 30H96M70 4V60" stroke="currentColor" strokeWidth="1" />
              <rect x="54" y="14" width="32" height="32" stroke="currentColor" strokeWidth="0.9" />
            </svg>
          )}
          {theme.frameOrnament === 'editorial' && (
            <div
              aria-hidden="true"
              className={`pointer-events-none h-[2px] w-full ${theme.isLight ? 'bg-amber-700/25' : 'bg-amber-400/35'}`}
            />
          )}
          {theme.frameOrnament === 'arena' && (
            <div
              aria-hidden="true"
              className="pointer-events-none flex items-center justify-between gap-2 pb-1 opacity-75"
            >
              <div className="h-1 flex-1 rounded-full bg-amber-400/35" />
              <div className="text-[11px] font-bold tracking-wider uppercase text-amber-400">
                Đấu trường Tri thức · {currentSlide.navLabel}
              </div>
              <div className="h-1 flex-1 rounded-full bg-sky-400/35" />
            </div>
          )}

          {/* SLIDE 1: OVERVIEW */}
          {currentSlide.kind === 'overview' && (
            <div className={theme.layout === 'split_editorial' ? 'grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start' : 'space-y-6'}>
              {/* Left / Header Block */}
              <div className={theme.layout === 'split_editorial' ? 'lg:col-span-5 space-y-4 lg:pr-4' : 'space-y-2'}>
                <div className={`text-xs sm:text-sm font-bold flex items-center gap-2 flex-wrap ${theme.textMuted}`}>
                  <span className={theme.accentText}>{plan.subject}</span>
                  <span aria-hidden="true">·</span>
                  <span>{plan.grade}</span>
                  <span aria-hidden="true">·</span>
                  <span>{plan.targetLevel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{plan.steps.length} bước trọng tâm</span>
                </div>
                <h1
                  className={`font-extrabold tracking-tight text-balance ${theme.titleFontClass}`}
                  style={{ fontSize: `${Math.round((theme.layout === 'split_editorial' ? 32 : 30) * fontScale)}px`, lineHeight: 1.25 }}
                >
                  <MathFormulaRenderer content={plan.title} />
                </h1>

                {theme.layout === 'split_editorial' && plan.steps.length > 0 && (
                  <div className={`p-4 rounded-2xl border space-y-2 ${theme.subCardClass}`}>
                    <div className={`text-xs font-extrabold ${theme.accentText}`}>Lộ trình trình chiếu</div>
                    <ol className="space-y-1.5 text-sm">
                      {plan.steps.map((s, idx) => (
                        <li key={idx} className="flex items-baseline gap-2">
                          <span className={`font-mono text-xs font-bold tabular-nums ${theme.accentText}`}>
                            {stepDisplayNumber(s.stepNumber || idx + 1)}.
                          </span>
                          <span className="font-medium truncate">
                            <MathFormulaRenderer content={s.title} />
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              {/* Right / Content Blocks */}
              <div className={theme.layout === 'split_editorial' ? 'lg:col-span-7 space-y-4' : 'space-y-5'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                  {plan.recognitionSigns && (
                    <div className={`p-5 rounded-2xl border space-y-2 animate-method-step-reveal ${theme.subCardClass}`}>
                      <div className={`text-xs sm:text-sm font-extrabold flex items-center gap-2 ${theme.accentText}`}>
                        <Sparkles className="w-4 h-4 shrink-0" />
                        <span>Dấu hiệu nhận biết dạng bài</span>
                      </div>
                      <div className="select-text" style={proseStyle}>
                        <MathFormulaRenderer content={plan.recognitionSigns} />
                      </div>
                    </div>
                  )}

                  {plan.learningObjective && (
                    <div
                      className={`p-5 rounded-2xl border space-y-2 animate-method-step-reveal ${theme.subCardClass}`}
                      style={{ animationDelay: '90ms' }}
                    >
                      <div className={`text-xs sm:text-sm font-extrabold flex items-center gap-2 ${theme.isLight ? 'text-sky-700' : 'text-sky-300'}`}>
                        <GraduationCap className="w-4 h-4 shrink-0" />
                        <span>Mục tiêu kiến thức &amp; kỹ năng</span>
                      </div>
                      <div className="select-text" style={proseStyle}>
                        <MathFormulaRenderer content={plan.learningObjective} />
                      </div>
                    </div>
                  )}
                </div>

                {plan.commonMistakes.length > 0 && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !showOverviewMistakes;
                        setShowOverviewMistakes(next);
                        if (next && soundEnabled) gameSounds.playStepPop(1);
                      }}
                      className={`min-h-[42px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-2 cursor-pointer transition-colors ${
                        showOverviewMistakes ? theme.primaryBtnClass : theme.btnSecondary
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>
                        {showOverviewMistakes
                          ? 'Ẩn cảnh báo lỗi sai thường gặp'
                          : `Mở cảnh báo ${plan.commonMistakes.length} lỗi sai học sinh hay mắc`}
                      </span>
                    </button>

                    {showOverviewMistakes && (
                      <div className={`p-5 rounded-2xl border space-y-2.5 animate-method-step-reveal ${theme.highlightNoteClass}`}>
                        <ul className="space-y-2 list-disc pl-5 select-text" style={proseStyle}>
                          {plan.commonMistakes.map((m, i) => (
                            <li key={i}>
                              <MathFormulaRenderer content={m} />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SLIDE 2: STEPS SUMMARY ROADMAP (ALL STEPS ON ONE SLIDE BEFORE DETAILS) */}
          {currentSlide.kind === 'steps_summary' && (
            theme.layout === 'split_editorial' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                <div className="lg:col-span-4 space-y-4">
                  <div className={`text-5xl sm:text-6xl font-black tabular-nums leading-none ${theme.accentText}`}>
                    {stepDisplayNumber(plan.steps.length)}
                  </div>
                  <div className={`text-xs sm:text-sm font-bold ${theme.textMuted}`}>
                    Phần I · Sơ đồ tổng hợp quy trình
                  </div>
                  <h2
                    className={`font-extrabold text-balance ${theme.titleFontClass}`}
                    style={{ fontSize: `${Math.round(28 * fontScale)}px`, lineHeight: 1.25 }}
                  >
                    Tóm tắt các bước thực hiện
                  </h2>
                  <p className={`text-sm sm:text-base leading-relaxed ${theme.textMuted}`}>
                    Học sinh nắm toàn bộ {plan.steps.length} bước cốt lõi trước khi đi sâu vào hướng dẫn chi tiết từng bước.
                  </p>
                  <button
                    type="button"
                    onClick={() => jumpToSlide(currentSlide.firstStepSlideIdx, 'right')}
                    className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 cursor-pointer shadow-md ${theme.primaryBtnClass}`}
                  >
                    <span>Vào chi tiết Bước 1</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="lg:col-span-8 space-y-3">
                  {plan.steps.map((s, idx) => {
                    const summary = extractConciseStepSummary(s.actionGuide);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => jumpToSlide(currentSlide.firstStepSlideIdx + idx, 'right')}
                        style={{ animationDelay: `${idx * 70}ms` }}
                        className={`w-full text-left p-4 sm:p-5 rounded-2xl border flex items-start gap-4 transition-all cursor-pointer hover:scale-[1.01] animate-method-step-reveal ${theme.subCardClass}`}
                      >
                        <div className={`w-10 h-10 rounded-xl font-black text-base tabular-nums flex items-center justify-center shrink-0 mt-0.5 ${theme.accentBadge}`}>
                          {stepDisplayNumber(s.stepNumber || idx + 1)}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className={`font-extrabold text-base sm:text-lg ${theme.titleFontClass}`}>
                            <MathFormulaRenderer content={s.title} />
                          </div>
                          {summary && (
                            <div className={`text-sm sm:text-base leading-relaxed ${theme.textMuted}`}>
                              <MathFormulaRenderer content={summary} />
                            </div>
                          )}
                        </div>
                        <ChevronRight className={`w-5 h-5 shrink-0 mt-2 opacity-60 ${theme.accentText}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${theme.accentBadge}`}>
                      <ListChecks className="w-6 h-6" />
                    </div>
                    <div>
                      <div className={`text-xs sm:text-sm font-bold flex items-center gap-2 ${theme.textMuted}`}>
                        <span>Phần I</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{plan.steps.length} bước thực hiện</span>
                        <span aria-hidden="true">·</span>
                        <span className={theme.accentText}>Tổng hợp trên 1 trang</span>
                      </div>
                      <h2
                        className={`font-extrabold text-balance ${theme.titleFontClass}`}
                        style={{ fontSize: `${Math.round(28 * fontScale)}px`, lineHeight: 1.28 }}
                      >
                        Tóm tắt các bước thực hiện
                      </h2>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => jumpToSlide(currentSlide.firstStepSlideIdx, 'right')}
                    className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md whitespace-nowrap shrink-0 ${theme.primaryBtnClass}`}
                  >
                    <span>Vào chi tiết Bước 1</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div
                  className={
                    theme.layout === 'bento_cards'
                      ? 'grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch'
                      : 'space-y-3'
                  }
                >
                  {plan.steps.map((s, idx) => {
                    const summary = extractConciseStepSummary(s.actionGuide);
                    const isOddLastBento =
                      theme.layout === 'bento_cards' &&
                      plan.steps.length % 2 === 1 &&
                      idx === plan.steps.length - 1;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => jumpToSlide(currentSlide.firstStepSlideIdx + idx, 'right')}
                        style={{ animationDelay: `${idx * 70}ms` }}
                        className={`w-full text-left p-4 sm:p-5 rounded-2xl border flex items-start gap-3.5 transition-all cursor-pointer hover:scale-[1.01] animate-method-step-reveal ${theme.subCardClass} ${
                          isOddLastBento ? 'md:col-span-2' : ''
                        }`}
                      >
                        <div className={`w-11 h-11 rounded-xl font-black text-lg tabular-nums flex items-center justify-center shrink-0 mt-0.5 ${theme.accentBadge}`}>
                          {s.stepNumber || idx + 1}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <h3
                              className={`font-extrabold ${theme.titleFontClass}`}
                              style={{ fontSize: `${Math.round(20 * fontScale)}px`, lineHeight: 1.35 }}
                            >
                              <MathFormulaRenderer content={s.title} />
                            </h3>
                            <span className={`text-xs font-bold whitespace-nowrap shrink-0 flex items-center gap-0.5 ${theme.accentText}`}>
                              <span>Chi tiết</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                          {summary && (
                            <div
                              className={`select-text ${theme.textMuted}`}
                              style={{ fontSize: `${Math.round(17 * fontScale)}px`, lineHeight: 1.55 }}
                            >
                              <MathFormulaRenderer content={summary} />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          )}

          {/* SLIDE: INDIVIDUAL METHOD STEP */}
          {currentSlide.kind === 'step' && (
            theme.layout === 'split_editorial' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                {/* Editorial Left Pillar */}
                <div className="lg:col-span-4 space-y-3">
                  <div className={`text-6xl sm:text-7xl font-black tabular-nums leading-none ${theme.accentText}`}>
                    {stepDisplayNumber(currentSlide.step.stepNumber || currentSlide.stepIdx + 1)}
                  </div>
                  <div className={`text-xs sm:text-sm font-bold ${theme.textMuted}`}>
                    Phần I · Bước {currentSlide.stepIdx + 1} trên {currentSlide.totalSteps}
                  </div>
                  <h2
                    className={`font-extrabold text-balance ${theme.titleFontClass}`}
                    style={{ fontSize: `${Math.round(28 * fontScale)}px`, lineHeight: 1.28 }}
                  >
                    <MathFormulaRenderer content={currentSlide.step.title} />
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !stepDetailVisible;
                      setStepDetailVisible(next);
                      if (next && soundEnabled) gameSounds.playStepPop(currentSlide.stepIdx);
                    }}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${theme.btnSecondary}`}
                  >
                    {stepDetailVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{stepDetailVisible ? 'Thu gọn công thức' : 'Hiện công thức & lưu ý'}</span>
                  </button>
                </div>

                {/* Editorial Right Main Reading Column */}
                <div className="lg:col-span-8 space-y-4">
                  <div className={`p-5 sm:p-6 rounded-2xl border select-text animate-method-step-reveal ${theme.subCardClass}`} style={proseStyle}>
                    <MathFormulaRenderer content={currentSlide.step.actionGuide} />
                  </div>

                  {stepDetailVisible && currentSlide.step.formula && (
                    <div
                      className={`p-5 sm:p-6 rounded-2xl border text-center overflow-x-auto select-text animate-method-step-reveal ${theme.formulaBoxClass}`}
                      style={{ animationDelay: '90ms' }}
                    >
                      <div className="text-xs font-extrabold uppercase tracking-wider opacity-80 mb-2">
                        Công thức áp dụng
                      </div>
                      <div style={{ fontSize: `${Math.round(24 * fontScale)}px` }}>
                        <MathFormulaRenderer
                          content={currentSlide.step.formula}
                          isBlock={currentSlide.step.formula.includes('$$')}
                        />
                      </div>
                    </div>
                  )}

                  {stepDetailVisible && currentSlide.step.keyNote && (
                    <div
                      className={`p-4 sm:p-5 rounded-2xl border flex items-start gap-3 animate-method-step-reveal select-text ${theme.highlightNoteClass}`}
                      style={{ animationDelay: '160ms', fontSize: `${Math.round(17 * fontScale)}px` }}
                    >
                      <Lightbulb className={`w-5 h-5 shrink-0 mt-1 ${theme.accentText}`} />
                      <div>
                        <span className="font-bold">Lưu ý sư phạm: </span>
                        <MathFormulaRenderer content={currentSlide.step.keyNote} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-14 h-14 rounded-2xl font-black text-2xl tabular-nums flex items-center justify-center shrink-0 ${theme.accentBadge}`}>
                      {currentSlide.step.stepNumber || currentSlide.stepIdx + 1}
                    </div>
                    <div>
                      <div className={`text-xs sm:text-sm font-bold ${theme.textMuted}`}>
                        Phần I · Trình tự các bước giải ({currentSlide.stepIdx + 1}/{currentSlide.totalSteps})
                      </div>
                      <h2
                        className={`font-extrabold text-balance ${theme.titleFontClass}`}
                        style={{ fontSize: `${Math.round(28 * fontScale)}px`, lineHeight: 1.3 }}
                      >
                        <MathFormulaRenderer content={currentSlide.step.title} />
                      </h2>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const next = !stepDetailVisible;
                      setStepDetailVisible(next);
                      if (next && soundEnabled) gameSounds.playStepPop(currentSlide.stepIdx);
                    }}
                    className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${theme.btnSecondary}`}
                  >
                    {stepDetailVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{stepDetailVisible ? 'Thu gọn công thức' : 'Hiện công thức & lưu ý'}</span>
                  </button>
                </div>

                <div className={`p-5 sm:p-6 rounded-2xl border select-text animate-method-step-reveal ${theme.subCardClass}`} style={proseStyle}>
                  <MathFormulaRenderer content={currentSlide.step.actionGuide} />
                </div>

                {stepDetailVisible && (
                  <div className={theme.layout === 'bento_cards' || theme.layout === 'arena_spotlight' ? 'grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch' : 'space-y-4'}>
                    {currentSlide.step.formula && (
                      <div
                        className={`p-5 sm:p-6 rounded-2xl border text-center flex flex-col justify-center overflow-x-auto select-text animate-method-step-reveal ${theme.formulaBoxClass}`}
                        style={{ animationDelay: '90ms' }}
                      >
                        <div className="text-xs font-extrabold uppercase tracking-wider opacity-80 mb-2">
                          Công thức áp dụng
                        </div>
                        <div style={{ fontSize: `${Math.round(23 * fontScale)}px` }}>
                          <MathFormulaRenderer
                            content={currentSlide.step.formula}
                            isBlock={currentSlide.step.formula.includes('$$')}
                          />
                        </div>
                      </div>
                    )}

                    {currentSlide.step.keyNote && (
                      <div
                        className={`p-4 sm:p-5 rounded-2xl border flex items-start gap-3 animate-method-step-reveal select-text ${theme.highlightNoteClass}`}
                        style={{ animationDelay: '160ms', fontSize: `${Math.round(17 * fontScale)}px` }}
                      >
                        <Lightbulb className={`w-5 h-5 shrink-0 mt-1 ${theme.accentText}`} />
                        <div>
                          <span className="font-bold">Lưu ý sư phạm: </span>
                          <MathFormulaRenderer content={currentSlide.step.keyNote} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          )}

          {/* SLIDE: CORE FORMULAS (PROGRESSIVE REVEAL) */}
          {currentSlide.kind === 'formulas' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${theme.accentBadge}`}>
                    <BookOpenCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className={`text-xs sm:text-sm font-bold ${theme.textMuted}`}>
                      Phần II · Hệ thống ghi nhớ nhanh ({Math.min(formulaRevealCount, plan.formulas.length)}/{plan.formulas.length})
                    </div>
                    <h2 className={`text-xl sm:text-2xl font-extrabold ${theme.titleFontClass}`}>
                      Công thức trọng tâm cần nhớ
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {formulaRevealCount < plan.formulas.length && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = formulaRevealCount + 1;
                        setFormulaRevealCount(next);
                        if (soundEnabled) gameSounds.playStepPop(next - 1);
                      }}
                      className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer ${theme.primaryBtnClass}`}
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Mở công thức {formulaRevealCount + 1}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const showAll = formulaRevealCount < plan.formulas.length;
                      setFormulaRevealCount(showAll ? plan.formulas.length : 1);
                      if (soundEnabled) gameSounds.playStepPop(2);
                    }}
                    className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer ${theme.btnSecondary}`}
                  >
                    {formulaRevealCount < plan.formulas.length ? 'Hiện tất cả' : 'Mở lại từng công thức'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plan.formulas.slice(0, formulaRevealCount).map((f, idx) => (
                  <div
                    key={idx}
                    className={`p-5 rounded-2xl border flex flex-col justify-between gap-3 animate-method-step-reveal ${theme.subCardClass}`}
                  >
                    <div className="font-bold text-sm sm:text-base flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-xs font-extrabold tabular-nums ${theme.accentBadge}`}>
                        {idx + 1}
                      </span>
                      <MathFormulaRenderer content={f.name} />
                    </div>
                    <div
                      className={`p-4 rounded-xl border text-center overflow-x-auto select-text ${theme.formulaBoxClass}`}
                      style={{ fontSize: `${Math.round(21 * fontScale)}px` }}
                    >
                      <MathFormulaRenderer content={f.expression} />
                    </div>
                    {f.condition && (
                      <div className={`text-xs sm:text-sm select-text ${theme.textMuted}`}>
                        <MathFormulaRenderer content={f.condition} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SLIDE: STEP-BY-STEP ILLUSTRATIVE EXAMPLE */}
          {currentSlide.kind === 'example' && (() => {
            const ex = currentSlide.example;
            const total = ex.stepByStepSolution.length;
            const shown = exampleStepCount[currentSlide.exampleIdx] ?? 0;

            return (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className={`text-xs sm:text-sm font-bold ${theme.textMuted}`}>
                      Phần III · Ví dụ minh họa ({shown}/{total} bước đã mở)
                    </div>
                    <h2 className={`text-xl sm:text-2xl font-extrabold ${theme.accentText} ${theme.titleFontClass}`}>
                      <MathFormulaRenderer content={ex.title} />
                    </h2>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {shown > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExampleStepCount((prev) => ({ ...prev, [currentSlide.exampleIdx]: 0 }))
                        }
                        className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${theme.btnSecondary}`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Giảng lại từ đầu</span>
                      </button>
                    )}

                    {shown < total && (
                      <button
                        type="button"
                        onClick={handleAdvanceAction}
                        className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer shadow-lg ${theme.primaryBtnClass}`}
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Mở Bước {shown + 1}/{total}</span>
                      </button>
                    )}

                    {shown < total && (
                      <button
                        type="button"
                        onClick={() => {
                          setExampleStepCount((prev) => ({ ...prev, [currentSlide.exampleIdx]: total }));
                          if (soundEnabled) gameSounds.playCorrectChime();
                        }}
                        className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${theme.btnSecondary}`}
                      >
                        Hiện hết lời giải
                      </button>
                    )}
                  </div>
                </div>

                {/* Problem Statement Box */}
                <div className={`p-5 rounded-2xl border select-text ${theme.subCardClass}`} style={proseStyle}>
                  <div className={`text-xs font-extrabold uppercase tracking-wider mb-1.5 ${theme.accentText}`}>
                    Đề bài ví dụ
                  </div>
                  <MathFormulaRenderer content={ex.problem} />
                </div>

                {/* Revealed Solution Steps */}
                {shown === 0 ? (
                  <div className="py-8 text-center space-y-3 border border-dashed border-current/25 rounded-2xl">
                    <p className={`text-sm sm:text-base font-medium ${theme.textMuted}`}>
                      Sẵn sàng phân tích cho học sinh — bấm <strong>Mở Bước 1/{total}</strong> hoặc nhấn phím <strong>Space / →</strong> để trình chiếu từng bước giải.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {ex.stepByStepSolution.slice(0, shown).map((st, sIdx) => (
                      <div
                        key={sIdx}
                        className={`p-4 sm:p-5 rounded-2xl border space-y-2 animate-method-step-reveal ${theme.subCardClass}`}
                      >
                        <div className={`text-xs sm:text-sm font-extrabold ${theme.accentText}`}>
                          <MathFormulaRenderer content={st.stepLabel} />
                        </div>
                        <div className="select-text" style={proseStyle}>
                          <MathFormulaRenderer content={st.content} />
                        </div>
                        {st.resultFormula && (
                          <div className={`p-3 rounded-xl border overflow-x-auto select-text ${theme.formulaBoxClass}`} style={proseStyle}>
                            <MathFormulaRenderer content={st.resultFormula} />
                          </div>
                        )}
                      </div>
                    ))}

                    {shown >= total && ex.finalAnswer && (
                      <div
                        className={`p-4 sm:p-5 rounded-2xl border font-bold select-text animate-method-step-reveal ${
                          theme.isLight
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                            : 'border-emerald-400/50 bg-emerald-500/20 text-white'
                        }`}
                        style={proseStyle}
                      >
                        <span className={theme.isLight ? 'text-emerald-700 mr-2' : 'text-emerald-300 mr-2'}>
                          Kết luận đáp số:
                        </span>
                        <MathFormulaRenderer content={ex.finalAnswer} />
                      </div>
                    )}

                    {shown >= total && ex.teacherTip && (
                      <div className={`p-4 rounded-2xl border flex items-start gap-2.5 animate-method-step-reveal select-text ${theme.highlightNoteClass}`}>
                        <Calculator className={`w-5 h-5 shrink-0 mt-0.5 ${theme.accentText}`} />
                        <div className="text-sm sm:text-base">
                          <span className="font-bold">Mẹo giảng / Kiểm tra Casio: </span>
                          <MathFormulaRenderer content={ex.teacherTip} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* SLIDE: PRACTICE EXERCISE */}
          {currentSlide.kind === 'exercise' && (() => {
            const ex = currentSlide.exercise;
            const hintOpen = Boolean(exerciseHintOpen[ex.id]);
            const ansOpen = Boolean(exerciseAnswerOpen[ex.id]);

            return (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className={`text-xs sm:text-sm font-bold flex items-center gap-2 ${theme.textMuted}`}>
                      <span>Phần IV · Luyện tập trên lớp</span>
                      <span aria-hidden="true">·</span>
                      <span className={theme.accentText}>{ex.level}</span>
                    </div>
                    <h2 className={`text-xl sm:text-2xl font-extrabold ${theme.titleFontClass}`}>
                      Bài tập tương tự {ex.index || currentSlide.exerciseIdx + 1} / {currentSlide.totalExercises}
                    </h2>
                  </div>

                  {/* Interactive Classroom Action Controls */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        unlockWebAudio();
                        if (timerRunning) {
                          setTimerRunning(false);
                        } else {
                          setTimerSeconds(45);
                          setTimerRunning(true);
                          if (soundEnabled) gameSounds.playQuestionStinger();
                        }
                      }}
                      className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer tabular-nums ${
                        timerRunning ? 'bg-rose-500 text-white border-rose-400' : theme.btnSecondary
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{timerRunning ? `Đang đếm: ${timerSeconds}s` : 'Đếm giờ 45s'}</span>
                    </button>

                    {ex.hint && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = !hintOpen;
                          setExerciseHintOpen((prev) => ({ ...prev, [ex.id]: next }));
                          if (next && soundEnabled) gameSounds.playStepPop(1);
                        }}
                        className={`min-h-[40px] px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                          hintOpen ? theme.primaryBtnClass : theme.btnSecondary
                        }`}
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>{hintOpen ? 'Ẩn gợi ý' : 'Gợi ý hướng làm'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const next = !ansOpen;
                        setExerciseAnswerOpen((prev) => ({ ...prev, [ex.id]: next }));
                        setTimerRunning(false);
                        if (next && soundEnabled) {
                          gameSounds.playLockInAnswer();
                          setTimeout(() => gameSounds.playCorrectChime(), 160);
                        }
                      }}
                      className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer ${
                        ansOpen
                          ? 'bg-emerald-500 text-slate-950'
                          : theme.primaryBtnClass
                      }`}
                    >
                      {ansOpen ? <EyeOff className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>{ansOpen ? 'Ẩn lời giải' : 'Chốt & Hiện Đáp Án'}</span>
                    </button>
                  </div>
                </div>

                {/* Exercise Statement */}
                <div className={`p-5 sm:p-7 rounded-2xl border select-text ${theme.subCardClass}`} style={{ fontSize: `${Math.round(22 * fontScale)}px`, lineHeight: 1.65 }}>
                  <MathFormulaRenderer content={ex.problem} />
                </div>

                {hintOpen && ex.hint && (
                  <div className={`p-4 sm:p-5 rounded-2xl border flex items-start gap-3 animate-method-step-reveal select-text ${theme.highlightNoteClass}`} style={proseStyle}>
                    <Lightbulb className={`w-5 h-5 shrink-0 mt-1 ${theme.accentText}`} />
                    <div>
                      <span className="font-bold">Gợi ý: </span>
                      <MathFormulaRenderer content={ex.hint} />
                    </div>
                  </div>
                )}

                {ansOpen && (
                  <div
                    className={`p-5 sm:p-6 rounded-2xl border space-y-3 animate-method-step-reveal select-text ${
                      theme.isLight
                        ? 'border-emerald-300 bg-emerald-50/90 text-slate-900'
                        : 'border-emerald-400/45 bg-emerald-500/15 text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className={`text-base sm:text-xl font-extrabold flex items-center gap-2 ${theme.isLight ? 'text-emerald-800' : 'text-emerald-300'}`}>
                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                        <span>Đáp số: <MathFormulaRenderer content={ex.shortAnswer} /></span>
                      </div>
                      {onSendToQuizHub && (
                        <button
                          type="button"
                          onClick={onSendToQuizHub}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-extrabold hover:bg-slate-800 cursor-pointer"
                        >
                          Mở thi trực tiếp bộ đề này
                        </button>
                      )}
                    </div>
                    <div className={`pt-2 border-t ${theme.isLight ? 'border-emerald-200' : 'border-white/15'}`} style={proseStyle}>
                      <MathFormulaRenderer content={ex.solutionSteps} />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* VISUAL TEMPLATE GALLERY MODAL */}
        {showTemplateGallery && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
            onClick={() => setShowTemplateGallery(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-4xl max-h-[90vh] rounded-3xl border overflow-hidden flex flex-col ${theme.popoverClass}`}
            >
              <div className="px-5 py-4 border-b border-current/15 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
                    <LayoutTemplate className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Kho Mẫu Template &amp; Hiệu Ứng Trình Chiếu</span>
                  </h3>
                  <p className="text-xs opacity-75 mt-0.5">
                    Chọn phong cách phù hợp môn học &amp; ánh sáng phòng học để bài giảng cuốn hút hơn.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTemplateGallery(false)}
                  className="min-w-[40px] min-h-[40px] rounded-xl hover:bg-black/15 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
                {/* 8 Template Preview Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {(Object.values(STAGE_THEMES) as StageTheme[]).map((t) => {
                    const isSelected = themeId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelectTheme(t.id)}
                        className={`text-left rounded-2xl border p-2.5 transition-all cursor-pointer flex flex-col gap-2.5 ${
                          isSelected
                            ? 'ring-2 ring-amber-400 border-amber-400 scale-[1.01]'
                            : 'border-current/15 hover:border-amber-400/60'
                        }`}
                      >
                        {/* Live Miniature Slide Preview Thumbnail */}
                        <div
                          className="w-full h-24 rounded-xl p-2.5 flex flex-col justify-between border overflow-hidden relative"
                          style={{
                            backgroundColor: t.preview.canvasBg,
                            borderColor: t.preview.borderColor,
                          }}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className="h-2 w-12 rounded-full"
                              style={{ backgroundColor: t.preview.accentColor }}
                            />
                            {isSelected && (
                              <span
                                className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black"
                                style={{
                                  backgroundColor: t.preview.accentColor,
                                  color: t.isLight ? '#ffffff' : '#0f172a',
                                }}
                              >
                                ✓
                              </span>
                            )}
                          </div>

                          {t.layout === 'split_editorial' ? (
                            <div className="grid grid-cols-3 gap-1.5 items-center flex-1 pt-1.5">
                              <div
                                className="text-lg font-black leading-none"
                                style={{ color: t.preview.accentColor }}
                              >
                                01
                              </div>
                              <div
                                className="col-span-2 h-11 rounded-md p-1.5 flex flex-col justify-center gap-1"
                                style={{
                                  backgroundColor: t.preview.cardBg,
                                  border: `1px solid ${t.preview.borderColor}`,
                                }}
                              >
                                <div className="h-1.5 w-3/4 rounded-full opacity-80" style={{ backgroundColor: t.preview.textColor }} />
                                <div className="h-1.5 w-1/2 rounded-full opacity-45" style={{ backgroundColor: t.preview.textColor }} />
                              </div>
                            </div>
                          ) : t.layout === 'bento_cards' ? (
                            <div className="grid grid-cols-2 gap-1.5 flex-1 pt-1.5">
                              <div
                                className="rounded-md p-1.5"
                                style={{ backgroundColor: t.preview.cardBg, border: `1px solid ${t.preview.borderColor}` }}
                              >
                                <div className="h-1.5 w-8 rounded-full" style={{ backgroundColor: t.preview.accentColor }} />
                              </div>
                              <div
                                className="rounded-md p-1.5"
                                style={{ backgroundColor: t.preview.cardBg, border: `1px solid ${t.preview.borderColor}` }}
                              >
                                <div className="h-1.5 w-10 rounded-full opacity-60" style={{ backgroundColor: t.preview.textColor }} />
                              </div>
                            </div>
                          ) : (
                            <div
                              className="rounded-md p-2 flex-1 mt-1.5 flex flex-col justify-center gap-1"
                              style={{ backgroundColor: t.preview.cardBg, border: `1px solid ${t.preview.borderColor}` }}
                            >
                              <div className="h-1.5 w-2/3 rounded-full" style={{ backgroundColor: t.preview.accentColor }} />
                              <div className="h-1.5 w-full rounded-full opacity-55" style={{ backgroundColor: t.preview.textColor }} />
                            </div>
                          )}
                        </div>

                        <div className="px-0.5 space-y-0.5">
                          <div className="text-xs font-extrabold truncate">{t.name}</div>
                          <div className="text-[11px] opacity-75 truncate">{t.styleTag}</div>
                          <div className="text-[10px] font-semibold opacity-65 truncate">{t.layoutLabel}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Slide Transition Effect Picker & Speed */}
                <div className="pt-3 border-t border-current/15 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-bold">Hiệu ứng chuyển slide:</span>
                      <button
                        type="button"
                        onClick={() => handleToggleTransitionsEnabled()}
                        className={`px-3 py-1 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                          transitionsEnabled
                            ? 'bg-emerald-500 text-white border-emerald-400'
                            : theme.btnSecondary
                        }`}
                      >
                        {transitionsEnabled ? 'Đang bật' : 'Đang tắt'}
                      </button>
                    </div>
                    <div className={`flex items-center gap-2 flex-wrap ${!transitionsEnabled ? 'opacity-55' : ''}`}>
                      {SLIDE_TRANSITION_OPTIONS.map((eff) => {
                        const active = transitionsEnabled && transitionMode === eff.id;
                        return (
                          <button
                            key={eff.id}
                            type="button"
                            onClick={() => handleSelectTransition(eff.id)}
                            className={`min-h-[36px] px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${
                              active ? theme.primaryBtnClass : theme.btnSecondary
                            }`}
                            title={eff.description}
                          >
                            {eff.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className={`flex flex-wrap items-center justify-between gap-3 ${!transitionsEnabled ? 'opacity-55' : ''}`}>
                    <div className="text-xs font-bold">Tốc độ hiệu ứng (chống mỏi mắt):</div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {SLIDE_TRANSITION_SPEED_OPTIONS.map((sp) => {
                        const active = transitionSpeed === sp.id;
                        return (
                          <button
                            key={sp.id}
                            type="button"
                            onClick={() => handleSelectTransitionSpeed(sp.id)}
                            className={`min-h-[34px] px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer ${
                              active ? theme.primaryBtnClass : theme.btnSecondary
                            }`}
                          >
                            {sp.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM STEPPER TIMELINE & NAVIGATION FOOTER */}
      <footer className={`shrink-0 border-t px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 backdrop-blur-md ${theme.topBarClass}`}>
        <button
          type="button"
          onClick={() => jumpToSlide(slideIdx - 1, 'left')}
          disabled={slideIdx === 0}
          className={`min-h-[44px] px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-35 ${theme.btnSecondary}`}
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Bước trước</span>
        </button>

        {/* Interactive Step Timeline */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto scrollbar-none px-1">
          {slides.map((s, idx) => {
            const active = idx === slideIdx;
            const visited = idx < slideIdx;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => jumpToSlide(idx)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-all flex items-center gap-1.5 ${
                  active
                    ? 'bg-amber-400 text-slate-950 shadow-md scale-[1.03]'
                    : visited
                    ? theme.isLight
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/35 hover:bg-emerald-500/35'
                    : theme.btnSecondary
                }`}
              >
                {s.kind === 'step' && <ListChecks className="w-3.5 h-3.5 shrink-0" />}
                <span>{s.navLabel}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleAdvanceAction}
          disabled={!canAdvanceSubStep && slideIdx >= slides.length - 1}
          className={`min-h-[44px] px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-35 shadow-md ${theme.primaryBtnClass}`}
        >
          <span>
            {canAdvanceSubStep
              ? 'Mở tiếp ý'
              : slideIdx >= slides.length - 1
              ? 'Đã hoàn tất'
              : `Sang ${slides[slideIdx + 1]?.navLabel || 'tiếp theo'}`}
          </span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
};
