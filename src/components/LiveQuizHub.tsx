import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  RotateCcw,
  QrCode,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Bot,
  Loader2,
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
  BarChart3,
  Volume2,
  VolumeX,
  Square,
  Tv,
  Dice5,
  PartyPopper,
  Trophy,
  ChevronLeft,
  Save,
  FolderOpen,
  Search,
  Maximize2,
  Minimize2,
  Palette,
  Mic,
  Type,
  Minus,
  LayoutTemplate,
  Sun,
  Moon,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QRCodeSVG } from 'qrcode.react';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import { extractCleanPdfText } from '../utils/pdfTextExtractor';
import { exportExamToWordDocx } from '../utils/docxExportService';
import { QuizQuestion, RoomState, StudentSubmission, TextScale, ActiveStudent, ClassRoom } from '../types';
import { QuizRichContentRenderer } from './QuizRichContentRenderer';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { directFastMatrixQuiz, getGeminiApiKey, saveGeminiApiKey, isGeminiConfigured } from '../utils/geminiClient';
import {
  getSpeechSpeedMultiplier,
  prefetchQuestionSpeech,
  setSpeechSpeedMultiplier,
  speakQuestionContent,
  speakStudentCalling,
  speakText,
  stopAllSpeech,
  unlockWebAudio,
  VOICE_TONE_PRESETS,
  VoiceTonePreset,
} from '../utils/aiSpeechService';
import { gameSounds } from '../utils/gameSoundEffects';
import { db } from '../lib/firebase';

// Helper to retrieve the current logged-in teacher's active classes from props, active session or localStorage
const getActiveTeacherClasses = (currentTeacher?: any, currentClassroom?: any): ClassRoom[] => {
  // 1. Direct check on teacher prop
  if (currentTeacher?.classes && Array.isArray(currentTeacher.classes) && currentTeacher.classes.length > 0) {
    return currentTeacher.classes;
  }

  // 2. Read from localStorage for the active logged-in teacher
  try {
    const saved = localStorage.getItem('smartboard_teachers');
    if (saved) {
      const teachers = JSON.parse(saved);
      if (Array.isArray(teachers) && teachers.length > 0) {
        const activeId = localStorage.getItem('smartboard_active_teacher') || localStorage.getItem('smartboard_active_teacher_id') || currentTeacher?.id;
        const activeT = teachers.find((t: any) => t.id === activeId);
        if (activeT?.classes && Array.isArray(activeT.classes) && activeT.classes.length > 0) {
          return activeT.classes;
        }
        // Fallback to first teacher with configured classes
        const teacherWithClasses = teachers.find((t: any) => t.classes && Array.isArray(t.classes) && t.classes.length > 0);
        if (teacherWithClasses?.classes && teacherWithClasses.classes.length > 0) {
          return teacherWithClasses.classes;
        }
      }
    }
  } catch (_) {}

  // 3. Read from smartboard_active_classroom_list or smartboard_classrooms
  try {
    const savedList = localStorage.getItem('smartboard_active_classroom_list') || localStorage.getItem('smartboard_classrooms');
    if (savedList) {
      const parsed = JSON.parse(savedList);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (_) {}

  // 4. Fallback to currentClassroom prop if available
  if (currentClassroom) {
    return [currentClassroom];
  }

  return [];
};
import { doc } from 'firebase/firestore';
import { safeSetDoc } from '../utils/firebaseSafe';
import {
  getSavedEducationalItems,
  saveEducationalItem,
  deleteEducationalItem,
  pullSavedQuizzesFromCloud,
  initSavedQuizzesRealtimeSync,
  SavedEducationalItem,
} from '../utils/savedQuizzesService';

if (typeof window !== 'undefined' && 'Worker' in window && pdfjsLib) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
  } catch (_) {}
}

interface PresentationFontOption {
  id: string;
  name: string;
  subtitle: string;
  cssFamily: string;
  badgeText: string;
}

const PRESENTATION_FONTS: PresentationFontOption[] = [
  {
    id: 'be_vietnam',
    name: 'Be Vietnam Pro',
    subtitle: 'Chuẩn PowerPoint Việt hiện đại',
    cssFamily: "'Be Vietnam Pro', 'Plus Jakarta Sans', sans-serif",
    badgeText: 'Khuyên dùng',
  },
  {
    id: 'lexend',
    name: 'Lexend',
    subtitle: 'Khoảng chữ rộng, siêu rõ Tivi 75"',
    cssFamily: "'Lexend', sans-serif",
    badgeText: 'Tivi 75"',
  },
  {
    id: 'jakarta',
    name: 'Plus Jakarta Sans',
    subtitle: 'Thanh lịch, cân đối từng dấu tiếng Việt',
    cssFamily: "'Plus Jakarta Sans', sans-serif",
    badgeText: 'Thanh lịch',
  },
  {
    id: 'montserrat',
    name: 'Montserrat',
    subtitle: 'Nét khỏe khoắn, nổi bật tiêu đề Slide',
    cssFamily: "'Montserrat', sans-serif",
    badgeText: 'Slide Đậm',
  },
  {
    id: 'nunito',
    name: 'Nunito',
    subtitle: 'Nét tròn thân thiện, dễ đọc cho lớp học',
    cssFamily: "'Nunito', sans-serif",
    badgeText: 'Thân thiện',
  },
  {
    id: 'lora',
    name: 'Lora (Có chân)',
    subtitle: 'Phong cách Keynote học thuật & văn học',
    cssFamily: "'Lora', Georgia, serif",
    badgeText: 'Học thuật',
  },
  {
    id: 'times',
    name: 'Times New Roman',
    subtitle: 'Chuẩn mực đề thi & sách giáo khoa',
    cssFamily: "'Times New Roman', Times, serif",
    badgeText: 'Chuẩn SGK',
  },
];

type PresentationLayoutMode = 'classic' | 'split' | 'focus';

interface PresentationTheme {
  id: string;
  name: string;
  styleLabel: string;
  category: 'light' | 'dark';
  isLight: boolean;
  swatchGradient: string;
  accentSwatch: string;
  masterStripBackground: string;
  decorPatternBackground?: string;
  decorPatternSize?: string;
  miniCardBg: string;
  miniOptionBg: string;
  canvasBackground: string;
  sheenBackground: string;
  topBarClass: string;
  counterPillClass: string;
  counterLabelClass: string;
  counterValueClass: string;
  studentBadgeClass: string;
  studentPlaceholderClass: string;
  secondaryBtnClass: string;
  questionCardClass: string;
  questionDividerClass: string;
  questionBadgeClass: string;
  questionMetaClass: string;
  questionTextClass: string;
  optionDefaultClass: string;
  optionBadgeClass: string;
  optionTextClass: string;
  optionDimmedClass: string;
  optionDimmedBadgeClass: string;
  aiBannerClass: string;
  aiBannerIconBgClass: string;
  aiBannerTitleClass: string;
  aiBannerStopClass: string;
  explanationCardClass: string;
  explanationDividerClass: string;
  explanationTitleClass: string;
  explanationTextClass: string;
  bottomBarClass: string;
  prevBtnClass: string;
  pageActiveClass: string;
  pageInactiveClass: string;
  nextBtnClass: string;
  popoverClass: string;
}

const PRESENTATION_THEMES: PresentationTheme[] = [
  {
    id: 'ppt_swiss_cobalt',
    name: 'Thụy Sĩ Cobalt',
    styleLabel: 'PowerPoint Doanh nghiệp · Sáng sắc nét',
    category: 'light',
    isLight: true,
    swatchGradient: 'linear-gradient(135deg, #ffffff 0%, #dbeafe 100%)',
    accentSwatch: '#1d4ed8',
    masterStripBackground: 'linear-gradient(90deg, #1d4ed8 0%, #0284c7 60%, #38bdf8 100%)',
    decorPatternBackground: 'radial-gradient(rgba(29, 78, 216, 0.08) 1px, transparent 1px)',
    decorPatternSize: '24px 24px',
    miniCardBg: '#ffffff',
    miniOptionBg: '#eff6ff',
    canvasBackground: 'linear-gradient(155deg, #f8fafc 0%, #eff6ff 55%, #e2e8f0 100%)',
    sheenBackground:
      'linear-gradient(125deg, rgba(37, 99, 235, 0.07) 0%, transparent 45%), radial-gradient(circle at 92% 10%, rgba(14, 165, 233, 0.10) 0%, transparent 38%)',
    topBarClass: 'bg-white/95 border-slate-200 text-slate-900 shadow-sm backdrop-blur-md',
    counterPillClass: 'bg-blue-50 border-blue-200 text-blue-950',
    counterLabelClass: 'text-blue-700',
    counterValueClass: 'text-blue-700',
    studentBadgeClass: 'bg-amber-50 border-amber-300 text-slate-900',
    studentPlaceholderClass: 'bg-slate-100 border-slate-200 text-slate-700',
    secondaryBtnClass: 'bg-slate-100 hover:bg-blue-50 border-slate-300 text-slate-800',
    questionCardClass: 'bg-white border-blue-200/90 shadow-[0_18px_45px_rgba(15,23,42,0.08)]',
    questionDividerClass: 'border-slate-200',
    questionBadgeClass: 'bg-blue-700 text-white',
    questionMetaClass: 'text-slate-600',
    questionTextClass: 'text-slate-900',
    optionDefaultClass:
      'bg-white border-slate-200 text-slate-900 hover:bg-blue-50/90 hover:border-blue-500 shadow-[0_6px_18px_rgba(15,23,42,0.06)] hover:-translate-y-0.5',
    optionBadgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    optionTextClass: 'text-slate-900',
    optionDimmedClass: 'bg-slate-100/80 border-slate-200 text-slate-400 opacity-75',
    optionDimmedBadgeClass: 'bg-slate-200 text-slate-500 border-slate-300',
    aiBannerClass: 'bg-blue-50 border-blue-300 text-slate-900',
    aiBannerIconBgClass: 'bg-blue-950',
    aiBannerTitleClass: 'text-slate-900',
    aiBannerStopClass: 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500',
    explanationCardClass: 'bg-white border-emerald-300 text-slate-800',
    explanationDividerClass: 'border-slate-200',
    explanationTitleClass: 'text-emerald-700',
    explanationTextClass: 'text-slate-800',
    bottomBarClass: 'border-slate-300/80',
    prevBtnClass: 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300',
    pageActiveClass: 'bg-blue-700 text-white border-blue-600 ring-blue-300',
    pageInactiveClass: 'bg-white text-slate-700 hover:bg-blue-50 border-slate-300',
    nextBtnClass: 'bg-blue-700 hover:bg-blue-800 text-white shadow-blue-900/20',
    popoverClass: 'bg-white border-slate-200 text-slate-900 shadow-2xl',
  },
  {
    id: 'ppt_warm_editorial',
    name: 'Giấy Ngà Học Thuật',
    styleLabel: 'Keynote Cổ điển · Kem ngà & Xanh thông',
    category: 'light',
    isLight: true,
    swatchGradient: 'linear-gradient(135deg, #faf8f5 0%, #ede4d3 100%)',
    accentSwatch: '#0f5132',
    masterStripBackground: 'linear-gradient(90deg, #0f5132 0%, #b45309 100%)',
    decorPatternBackground: 'linear-gradient(to right, rgba(15, 81, 50, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(15, 81, 50, 0.04) 1px, transparent 1px)',
    decorPatternSize: '42px 42px',
    miniCardBg: '#fffdf9',
    miniOptionBg: '#f3efe6',
    canvasBackground: 'linear-gradient(145deg, #fbf9f5 0%, #f5efe3 55%, #ebe1ce 100%)',
    sheenBackground:
      'radial-gradient(circle at 15% 15%, rgba(180, 83, 9, 0.07) 0%, transparent 45%), radial-gradient(circle at 88% 85%, rgba(15, 81, 50, 0.08) 0%, transparent 48%)',
    topBarClass: 'bg-[#fffdf9]/95 border-[#dfd5c3] text-stone-900 shadow-sm',
    counterPillClass: 'bg-[#e6f2ec] border-[#b7dcc9] text-[#0f5132]',
    counterLabelClass: 'text-[#146c43]',
    counterValueClass: 'text-[#0a3622]',
    studentBadgeClass: 'bg-amber-50 border-amber-300 text-stone-900',
    studentPlaceholderClass: 'bg-[#f4eee3] border-[#dfd5c3] text-stone-700',
    secondaryBtnClass: 'bg-[#f4eee3] hover:bg-[#eae0cf] border-[#d6c9b2] text-stone-800',
    questionCardClass: 'bg-[#fffdf9] border-[#d8ccb8] shadow-[0_18px_45px_rgba(68,52,29,0.08)]',
    questionDividerClass: 'border-[#e8dfd0]',
    questionBadgeClass: 'bg-[#0f5132] text-amber-50',
    questionMetaClass: 'text-stone-600',
    questionTextClass: 'text-stone-900',
    optionDefaultClass:
      'bg-[#fffdf9] border-[#d8ccb8] text-stone-900 hover:bg-[#f1f8f4] hover:border-[#0f5132] shadow-[0_6px_18px_rgba(68,52,29,0.06)] hover:-translate-y-0.5',
    optionBadgeClass: 'bg-[#e6f2ec] text-[#0f5132] border-[#b7dcc9]',
    optionTextClass: 'text-stone-900',
    optionDimmedClass: 'bg-[#f4efe6]/80 border-[#e2d9c8] text-stone-400 opacity-75',
    optionDimmedBadgeClass: 'bg-[#e8e0d2] text-stone-500 border-[#d6ccb9]',
    aiBannerClass: 'bg-amber-50 border-amber-300 text-stone-900',
    aiBannerIconBgClass: 'bg-[#0f5132]',
    aiBannerTitleClass: 'text-stone-900',
    aiBannerStopClass: 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500',
    explanationCardClass: 'bg-[#fffdf9] border-emerald-400 text-stone-800',
    explanationDividerClass: 'border-[#e8dfd0]',
    explanationTitleClass: 'text-[#0f5132]',
    explanationTextClass: 'text-stone-800',
    bottomBarClass: 'border-[#d6c9b2]',
    prevBtnClass: 'bg-[#fffdf9] hover:bg-[#f4eee3] text-stone-800 border-[#d6c9b2]',
    pageActiveClass: 'bg-[#0f5132] text-white border-[#0a3622] ring-emerald-200',
    pageInactiveClass: 'bg-[#fffdf9] text-stone-700 hover:bg-[#f1f8f4] border-[#d6c9b2]',
    nextBtnClass: 'bg-[#0f5132] hover:bg-[#0b3d25] text-white shadow-emerald-950/15',
    popoverClass: 'bg-[#fffdf9] border-[#d8ccb8] text-stone-900 shadow-2xl',
  },
  {
    id: 'ppt_sky_studio',
    name: 'Studio Xanh Dương',
    styleLabel: 'PowerPoint Tươi sáng · Góc hình học',
    category: 'light',
    isLight: true,
    swatchGradient: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
    accentSwatch: '#0284c7',
    masterStripBackground: 'linear-gradient(90deg, #0284c7 0%, #2563eb 100%)',
    decorPatternBackground: 'radial-gradient(rgba(2, 132, 199, 0.12) 1.5px, transparent 1.5px)',
    decorPatternSize: '28px 28px',
    miniCardBg: '#ffffff',
    miniOptionBg: '#f0f9ff',
    canvasBackground: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 52%, #bae6fd 100%)',
    sheenBackground:
      'radial-gradient(circle at 12% 18%, rgba(14, 165, 233, 0.18) 0%, transparent 45%), radial-gradient(circle at 90% 85%, rgba(59, 130, 246, 0.16) 0%, transparent 48%)',
    topBarClass: 'bg-white/95 border-sky-200 text-slate-900 shadow-sm',
    counterPillClass: 'bg-sky-100 border-sky-300 text-sky-950',
    counterLabelClass: 'text-sky-700',
    counterValueClass: 'text-sky-800',
    studentBadgeClass: 'bg-amber-50 border-amber-300 text-slate-900',
    studentPlaceholderClass: 'bg-sky-50 border-sky-200 text-sky-900',
    secondaryBtnClass: 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-950',
    questionCardClass: 'bg-white/98 border-sky-200 shadow-[0_20px_50px_rgba(2,132,199,0.12)]',
    questionDividerClass: 'border-sky-100',
    questionBadgeClass: 'bg-sky-600 text-white',
    questionMetaClass: 'text-slate-600',
    questionTextClass: 'text-slate-900',
    optionDefaultClass:
      'bg-white border-sky-200 text-slate-900 hover:bg-sky-50 hover:border-sky-500 shadow-[0_6px_18px_rgba(2,132,199,0.08)] hover:-translate-y-0.5',
    optionBadgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
    optionTextClass: 'text-slate-900',
    optionDimmedClass: 'bg-slate-100/80 border-slate-200 text-slate-400 opacity-75',
    optionDimmedBadgeClass: 'bg-slate-200 text-slate-500 border-slate-300',
    aiBannerClass: 'bg-sky-50 border-sky-300 text-slate-900',
    aiBannerIconBgClass: 'bg-sky-900',
    aiBannerTitleClass: 'text-slate-900',
    aiBannerStopClass: 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500',
    explanationCardClass: 'bg-white border-emerald-300 text-slate-800',
    explanationDividerClass: 'border-sky-100',
    explanationTitleClass: 'text-emerald-700',
    explanationTextClass: 'text-slate-800',
    bottomBarClass: 'border-sky-200',
    prevBtnClass: 'bg-white hover:bg-sky-50 text-slate-800 border-sky-200',
    pageActiveClass: 'bg-sky-600 text-white border-sky-500 ring-sky-300',
    pageInactiveClass: 'bg-white text-slate-700 hover:bg-sky-50 border-sky-200',
    nextBtnClass: 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-900/15',
    popoverClass: 'bg-white border-sky-200 text-slate-900 shadow-2xl',
  },
  {
    id: 'ppt_mint_classroom',
    name: 'Bạc Hà Tươi Mới',
    styleLabel: 'PowerPoint Dịu mắt · Bạc hà & Lục bảo',
    category: 'light',
    isLight: true,
    swatchGradient: 'linear-gradient(135deg, #ecfdf5 0%, #a7f3d0 100%)',
    accentSwatch: '#059669',
    masterStripBackground: 'linear-gradient(90deg, #059669 0%, #0d9488 100%)',
    decorPatternBackground: 'radial-gradient(rgba(5, 150, 105, 0.11) 1.5px, transparent 1.5px)',
    decorPatternSize: '26px 26px',
    miniCardBg: '#ffffff',
    miniOptionBg: '#ecfdf5',
    canvasBackground: 'linear-gradient(140deg, #f0fdf9 0%, #d1fae5 52%, #ccfbf1 100%)',
    sheenBackground:
      'radial-gradient(circle at 18% 12%, rgba(16, 185, 129, 0.15) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(20, 184, 166, 0.14) 0%, transparent 48%)',
    topBarClass: 'bg-white/95 border-emerald-200 text-slate-900 shadow-sm',
    counterPillClass: 'bg-emerald-100 border-emerald-300 text-emerald-950',
    counterLabelClass: 'text-emerald-800',
    counterValueClass: 'text-emerald-800',
    studentBadgeClass: 'bg-amber-50 border-amber-300 text-slate-900',
    studentPlaceholderClass: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    secondaryBtnClass: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-950',
    questionCardClass: 'bg-white border-emerald-200 shadow-[0_20px_50px_rgba(5,150,105,0.10)]',
    questionDividerClass: 'border-emerald-100',
    questionBadgeClass: 'bg-emerald-700 text-white',
    questionMetaClass: 'text-slate-600',
    questionTextClass: 'text-slate-900',
    optionDefaultClass:
      'bg-white border-emerald-200 text-slate-900 hover:bg-emerald-50 hover:border-emerald-500 shadow-[0_6px_18px_rgba(5,150,105,0.07)] hover:-translate-y-0.5',
    optionBadgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    optionTextClass: 'text-slate-900',
    optionDimmedClass: 'bg-slate-100/80 border-slate-200 text-slate-400 opacity-75',
    optionDimmedBadgeClass: 'bg-slate-200 text-slate-500 border-slate-300',
    aiBannerClass: 'bg-emerald-50 border-emerald-300 text-slate-900',
    aiBannerIconBgClass: 'bg-emerald-900',
    aiBannerTitleClass: 'text-slate-900',
    aiBannerStopClass: 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500',
    explanationCardClass: 'bg-white border-teal-400 text-slate-800',
    explanationDividerClass: 'border-emerald-100',
    explanationTitleClass: 'text-teal-700',
    explanationTextClass: 'text-slate-800',
    bottomBarClass: 'border-emerald-200',
    prevBtnClass: 'bg-white hover:bg-emerald-50 text-slate-800 border-emerald-200',
    pageActiveClass: 'bg-emerald-700 text-white border-emerald-600 ring-emerald-300',
    pageInactiveClass: 'bg-white text-slate-700 hover:bg-emerald-50 border-emerald-200',
    nextBtnClass: 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-emerald-900/15',
    popoverClass: 'bg-white border-emerald-200 text-slate-900 shadow-2xl',
  },
  {
    id: 'ppt_sunset_coral',
    name: 'San Hô Ấm Áp',
    styleLabel: 'PowerPoint Sáng tạo · Kem đào năng động',
    category: 'light',
    isLight: true,
    swatchGradient: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
    accentSwatch: '#e11d48',
    masterStripBackground: 'linear-gradient(90deg, #ea580c 0%, #e11d48 100%)',
    decorPatternBackground: 'radial-gradient(rgba(234, 88, 12, 0.09) 1.5px, transparent 1.5px)',
    decorPatternSize: '26px 26px',
    miniCardBg: '#ffffff',
    miniOptionBg: '#fff7ed',
    canvasBackground: 'linear-gradient(140deg, #fffaf5 0%, #ffedd5 55%, #ffe4e6 100%)',
    sheenBackground:
      'radial-gradient(circle at 18% 15%, rgba(249, 115, 22, 0.14) 0%, transparent 45%), radial-gradient(circle at 86% 85%, rgba(244, 63, 94, 0.12) 0%, transparent 48%)',
    topBarClass: 'bg-white/95 border-orange-200 text-slate-900 shadow-sm',
    counterPillClass: 'bg-orange-100 border-orange-300 text-orange-950',
    counterLabelClass: 'text-orange-800',
    counterValueClass: 'text-rose-700',
    studentBadgeClass: 'bg-amber-100 border-amber-300 text-slate-900',
    studentPlaceholderClass: 'bg-orange-50 border-orange-200 text-orange-950',
    secondaryBtnClass: 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-950',
    questionCardClass: 'bg-white border-orange-200 shadow-[0_20px_50px_rgba(234,88,12,0.10)]',
    questionDividerClass: 'border-orange-100',
    questionBadgeClass: 'bg-gradient-to-r from-orange-600 to-rose-600 text-white',
    questionMetaClass: 'text-slate-600',
    questionTextClass: 'text-slate-900',
    optionDefaultClass:
      'bg-white border-orange-200 text-slate-900 hover:bg-orange-50 hover:border-orange-500 shadow-[0_6px_18px_rgba(234,88,12,0.07)] hover:-translate-y-0.5',
    optionBadgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
    optionTextClass: 'text-slate-900',
    optionDimmedClass: 'bg-slate-100/80 border-slate-200 text-slate-400 opacity-75',
    optionDimmedBadgeClass: 'bg-slate-200 text-slate-500 border-slate-300',
    aiBannerClass: 'bg-orange-50 border-orange-300 text-slate-900',
    aiBannerIconBgClass: 'bg-rose-900',
    aiBannerTitleClass: 'text-slate-900',
    aiBannerStopClass: 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500',
    explanationCardClass: 'bg-white border-emerald-400 text-slate-800',
    explanationDividerClass: 'border-orange-100',
    explanationTitleClass: 'text-emerald-700',
    explanationTextClass: 'text-slate-800',
    bottomBarClass: 'border-orange-200',
    prevBtnClass: 'bg-white hover:bg-orange-50 text-slate-800 border-orange-200',
    pageActiveClass: 'bg-rose-600 text-white border-rose-500 ring-rose-300',
    pageInactiveClass: 'bg-white text-slate-700 hover:bg-orange-50 border-orange-200',
    nextBtnClass: 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-900/15',
    popoverClass: 'bg-white border-orange-200 text-slate-900 shadow-2xl',
  },
  {
    id: 'daylight_minimal',
    name: 'Trắng Tối Giản',
    styleLabel: 'Phòng nhiều ánh sáng · Tương phản cao',
    category: 'light',
    isLight: true,
    swatchGradient: 'linear-gradient(135deg, #f8fafc 0%, #e0e7ff 100%)',
    accentSwatch: '#4f46e5',
    masterStripBackground: 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)',
    decorPatternBackground: 'radial-gradient(rgba(79, 70, 229, 0.08) 1px, transparent 1px)',
    decorPatternSize: '24px 24px',
    miniCardBg: '#ffffff',
    miniOptionBg: '#eef2ff',
    canvasBackground: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #e2e8f0 100%)',
    sheenBackground:
      'radial-gradient(circle at 18% 12%, rgba(99, 102, 241, 0.12) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(56, 189, 248, 0.12) 0%, transparent 48%)',
    topBarClass: 'bg-white/95 border-slate-200 text-slate-900 shadow-sm',
    counterPillClass: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    counterLabelClass: 'text-indigo-700',
    counterValueClass: 'text-indigo-700',
    studentBadgeClass: 'bg-amber-50 border-amber-300 text-slate-900',
    studentPlaceholderClass: 'bg-slate-100 border-slate-200 text-slate-600',
    secondaryBtnClass: 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800',
    questionCardClass: 'bg-white border-indigo-200/90 shadow-[0_16px_40px_rgba(15,23,42,0.08)]',
    questionDividerClass: 'border-slate-200',
    questionBadgeClass: 'bg-indigo-600 text-white',
    questionMetaClass: 'text-slate-600',
    questionTextClass: 'text-slate-900',
    optionDefaultClass:
      'bg-white border-slate-200 text-slate-900 hover:bg-indigo-50 hover:border-indigo-400 shadow-[0_6px_18px_rgba(15,23,42,0.06)] hover:-translate-y-0.5',
    optionBadgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    optionTextClass: 'text-slate-900',
    optionDimmedClass: 'bg-slate-100/80 border-slate-200 text-slate-400 opacity-75',
    optionDimmedBadgeClass: 'bg-slate-200 text-slate-500 border-slate-300',
    aiBannerClass: 'bg-amber-50 border-amber-300 text-slate-900',
    aiBannerIconBgClass: 'bg-slate-900',
    aiBannerTitleClass: 'text-slate-900',
    aiBannerStopClass: 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500',
    explanationCardClass: 'bg-white border-emerald-300 text-slate-800',
    explanationDividerClass: 'border-slate-200',
    explanationTitleClass: 'text-emerald-700',
    explanationTextClass: 'text-slate-800',
    bottomBarClass: 'border-slate-300',
    prevBtnClass: 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300',
    pageActiveClass: 'bg-indigo-600 text-white border-indigo-500 ring-indigo-300',
    pageInactiveClass: 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300',
    nextBtnClass: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-900/15',
    popoverClass: 'bg-white border-slate-200 text-slate-900 shadow-2xl',
  },
  {
    id: 'midnight_gold',
    name: 'Olympia Gold',
    styleLabel: 'Sân khấu Gameshow · Hải quân & Vàng Kim',
    category: 'dark',
    isLight: false,
    swatchGradient: 'linear-gradient(135deg, #090d16 0%, #1e293b 100%)',
    accentSwatch: '#f59e0b',
    masterStripBackground: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 55%, #38bdf8 100%)',
    decorPatternBackground: 'radial-gradient(rgba(251, 191, 36, 0.14) 1px, transparent 1px)',
    decorPatternSize: '30px 30px',
    miniCardBg: '#111827',
    miniOptionBg: '#1e293b',
    canvasBackground: 'linear-gradient(135deg, #070b14 0%, #0f172a 50%, #1e293b 100%)',
    sheenBackground:
      'radial-gradient(circle at 20% 15%, rgba(251, 191, 36, 0.16) 0%, transparent 45%), radial-gradient(circle at 82% 85%, rgba(99, 102, 241, 0.18) 0%, transparent 48%)',
    topBarClass: 'bg-[#070a12]/95 border-amber-300/25 text-white',
    counterPillClass: 'bg-slate-800 border-amber-400/40 text-slate-100',
    counterLabelClass: 'text-slate-300',
    counterValueClass: 'text-amber-400',
    studentBadgeClass: 'bg-slate-800 border-amber-400/40 text-white',
    studentPlaceholderClass: 'bg-slate-900/90 border-slate-600/60 text-slate-300',
    secondaryBtnClass: 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-100',
    questionCardClass: 'bg-[#111827]/95 border-amber-300/35 shadow-[0_20px_50px_rgba(0,0,0,0.5)]',
    questionDividerClass: 'border-slate-700',
    questionBadgeClass: 'bg-amber-400 text-slate-950',
    questionMetaClass: 'text-slate-300',
    questionTextClass: 'text-white',
    optionDefaultClass:
      'bg-slate-800/95 border-slate-600/80 text-white hover:bg-slate-700 hover:border-amber-400 shadow-[0_10px_28px_rgba(0,0,0,0.35)] hover:-translate-y-0.5',
    optionBadgeClass: 'bg-slate-700 text-amber-300 border-amber-300/30',
    optionTextClass: 'text-white',
    optionDimmedClass: 'bg-slate-900/60 border-slate-800 text-slate-400 opacity-65',
    optionDimmedBadgeClass: 'bg-slate-800 text-slate-500 border-slate-700',
    aiBannerClass: 'bg-slate-900/95 border-amber-400/40 text-white',
    aiBannerIconBgClass: 'bg-slate-950',
    aiBannerTitleClass: 'text-white',
    aiBannerStopClass: 'bg-rose-500/25 hover:bg-rose-500/40 text-rose-100 border-rose-300/40',
    explanationCardClass: 'bg-[#111827]/95 border-amber-400/35 text-slate-100',
    explanationDividerClass: 'border-slate-700',
    explanationTitleClass: 'text-amber-300',
    explanationTextClass: 'text-white',
    bottomBarClass: 'border-slate-700/70',
    prevBtnClass: 'bg-slate-800 hover:bg-slate-700 text-white border-slate-600',
    pageActiveClass: 'bg-amber-400 text-slate-950 border-amber-200 ring-amber-300/50',
    pageInactiveClass: 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-600',
    nextBtnClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-black/40',
    popoverClass: 'bg-slate-900 border-slate-700 text-white shadow-2xl',
  },
  {
    id: 'ppt_blueprint_stem',
    name: 'Kỹ Thuật Blueprint',
    styleLabel: 'PowerPoint STEM · Lưới ô ly Toán-Lý-Tin',
    category: 'dark',
    isLight: false,
    swatchGradient: 'linear-gradient(135deg, #061830 0%, #0f3b70 100%)',
    accentSwatch: '#38bdf8',
    masterStripBackground: 'linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%)',
    decorPatternBackground:
      'linear-gradient(to right, rgba(56, 189, 248, 0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(56, 189, 248, 0.09) 1px, transparent 1px)',
    decorPatternSize: '32px 32px',
    miniCardBg: '#092446',
    miniOptionBg: '#0f3666',
    canvasBackground: 'linear-gradient(145deg, #05162d 0%, #09264d 50%, #0f3b73 100%)',
    sheenBackground:
      'radial-gradient(circle at 20% 15%, rgba(56, 189, 248, 0.16) 0%, transparent 45%), radial-gradient(circle at 82% 85%, rgba(34, 211, 238, 0.14) 0%, transparent 48%)',
    topBarClass: 'bg-[#041124]/95 border-cyan-400/25 text-white',
    counterPillClass: 'bg-[#0d3363] border-cyan-300/40 text-cyan-50',
    counterLabelClass: 'text-cyan-200',
    counterValueClass: 'text-amber-300',
    studentBadgeClass: 'bg-[#12407a] border-cyan-300/40 text-white',
    studentPlaceholderClass: 'bg-[#09274d]/90 border-cyan-300/25 text-cyan-100/90',
    secondaryBtnClass: 'bg-[#0f386b] hover:bg-[#164a8a] border-cyan-300/35 text-cyan-50',
    questionCardClass: 'bg-[#072040]/95 border-cyan-300/35 shadow-[0_20px_50px_rgba(2,12,27,0.5)]',
    questionDividerClass: 'border-cyan-300/20',
    questionBadgeClass: 'bg-cyan-400 text-slate-950',
    questionMetaClass: 'text-cyan-100/90',
    questionTextClass: 'text-white',
    optionDefaultClass:
      'bg-[#0c2f5c]/95 border-cyan-300/30 text-white hover:bg-[#13417a] hover:border-cyan-300 shadow-[0_10px_28px_rgba(2,12,27,0.32)] hover:-translate-y-0.5',
    optionBadgeClass: 'bg-[#154987] text-cyan-200 border-cyan-200/40',
    optionTextClass: 'text-white',
    optionDimmedClass: 'bg-[#072040]/60 border-cyan-300/15 text-cyan-200/60 opacity-70',
    optionDimmedBadgeClass: 'bg-[#0c2e59] text-cyan-200/70 border-cyan-300/20',
    aiBannerClass: 'bg-[#061c38]/95 border-cyan-300/40 text-white',
    aiBannerIconBgClass: 'bg-[#031021]',
    aiBannerTitleClass: 'text-white',
    aiBannerStopClass: 'bg-rose-500/25 hover:bg-rose-500/40 text-rose-100 border-rose-300/40',
    explanationCardClass: 'bg-[#072040]/95 border-cyan-300/35 text-cyan-50',
    explanationDividerClass: 'border-cyan-300/20',
    explanationTitleClass: 'text-cyan-300',
    explanationTextClass: 'text-white',
    bottomBarClass: 'border-cyan-300/25',
    prevBtnClass: 'bg-[#0f386b] hover:bg-[#164a8a] text-white border-cyan-300/35',
    pageActiveClass: 'bg-cyan-400 text-slate-950 border-cyan-200 ring-cyan-300/50',
    pageInactiveClass: 'bg-[#0f386b] text-cyan-100 hover:bg-[#164a8a] border-cyan-300/30',
    nextBtnClass: 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-cyan-950/30',
    popoverClass: 'bg-[#051833] border-cyan-300/40 text-white shadow-2xl',
  },
  {
    id: 'chalkboard_classic',
    name: 'Bảng Phấn Xanh',
    styleLabel: 'Lớp học truyền thống · Lưới phấn nhẹ',
    category: 'dark',
    isLight: false,
    swatchGradient: 'linear-gradient(135deg, #072a1e 0%, #16553e 100%)',
    accentSwatch: '#fde047',
    masterStripBackground: 'linear-gradient(90deg, #fbbf24 0%, #34d399 100%)',
    decorPatternBackground:
      'linear-gradient(to right, rgba(167, 243, 208, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(167, 243, 208, 0.05) 1px, transparent 1px)',
    decorPatternSize: '44px 44px',
    miniCardBg: '#093224',
    miniOptionBg: '#0f4532',
    canvasBackground: 'linear-gradient(135deg, #06251b 0%, #0d3c2b 50%, #14533c 100%)',
    sheenBackground:
      'radial-gradient(circle at 20% 15%, rgba(110, 231, 183, 0.14) 0%, transparent 45%), radial-gradient(circle at 82% 85%, rgba(52, 211, 153, 0.12) 0%, transparent 48%)',
    topBarClass: 'bg-[#041d15]/95 border-emerald-400/25 text-white',
    counterPillClass: 'bg-[#0e4431] border-emerald-300/40 text-emerald-50',
    counterLabelClass: 'text-emerald-200',
    counterValueClass: 'text-amber-300',
    studentBadgeClass: 'bg-[#12513a] border-emerald-300/40 text-emerald-50',
    studentPlaceholderClass: 'bg-[#0b3828]/90 border-emerald-300/25 text-emerald-100/90',
    secondaryBtnClass: 'bg-[#114834] hover:bg-[#175e44] border-emerald-300/35 text-emerald-50',
    questionCardClass: 'bg-[#093224]/95 border-emerald-300/30 shadow-[0_20px_50px_rgba(2,20,14,0.45)]',
    questionDividerClass: 'border-emerald-300/25',
    questionBadgeClass: 'bg-amber-300 text-slate-950',
    questionMetaClass: 'text-emerald-100/90',
    questionTextClass: 'text-white',
    optionDefaultClass:
      'bg-[#0f4532]/95 border-emerald-300/30 text-white hover:bg-[#155941] hover:border-amber-300 shadow-[0_10px_28px_rgba(2,20,14,0.3)] hover:-translate-y-0.5',
    optionBadgeClass: 'bg-[#176349] text-amber-200 border-emerald-200/35',
    optionTextClass: 'text-white',
    optionDimmedClass: 'bg-[#093022]/60 border-emerald-300/15 text-emerald-200/60 opacity-70',
    optionDimmedBadgeClass: 'bg-[#0e4230] text-emerald-200/70 border-emerald-300/20',
    aiBannerClass: 'bg-[#082c20]/95 border-emerald-300/40 text-white',
    aiBannerIconBgClass: 'bg-[#041d15]',
    aiBannerTitleClass: 'text-white',
    aiBannerStopClass: 'bg-rose-500/25 hover:bg-rose-500/40 text-rose-100 border-rose-300/40',
    explanationCardClass: 'bg-[#093224]/95 border-emerald-300/35 text-emerald-50',
    explanationDividerClass: 'border-emerald-300/25',
    explanationTitleClass: 'text-amber-300',
    explanationTextClass: 'text-white',
    bottomBarClass: 'border-emerald-300/25',
    prevBtnClass: 'bg-[#114834] hover:bg-[#175e44] text-white border-emerald-300/35',
    pageActiveClass: 'bg-amber-300 text-slate-950 border-amber-200 ring-amber-300/50',
    pageInactiveClass: 'bg-[#114834] text-emerald-100 hover:bg-[#175e44] border-emerald-300/30',
    nextBtnClass: 'bg-amber-300 hover:bg-amber-200 text-slate-950 shadow-emerald-950/30',
    popoverClass: 'bg-[#06251b] border-emerald-300/35 text-white shadow-2xl',
  },
  {
    id: 'sapphire_tech',
    name: 'Xanh Lam Ngọc',
    styleLabel: 'Hiện đại & sắc nét · Tương phản cao',
    category: 'dark',
    isLight: false,
    swatchGradient: 'linear-gradient(135deg, #071e3d 0%, #134e94 100%)',
    accentSwatch: '#38bdf8',
    masterStripBackground: 'linear-gradient(90deg, #38bdf8 0%, #fbbf24 100%)',
    decorPatternBackground: 'radial-gradient(rgba(125, 211, 252, 0.10) 1px, transparent 1px)',
    decorPatternSize: '26px 26px',
    miniCardBg: '#092952',
    miniOptionBg: '#103b73',
    canvasBackground: 'linear-gradient(135deg, #071e3d 0%, #0c356a 50%, #14539c 100%)',
    sheenBackground:
      'radial-gradient(circle at 18% 12%, rgba(56, 189, 248, 0.20) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(96, 165, 250, 0.18) 0%, transparent 48%)',
    topBarClass: 'bg-[#05162e]/95 border-sky-300/25 text-white',
    counterPillClass: 'bg-[#0f3f7a] border-sky-300/40 text-sky-50',
    counterLabelClass: 'text-sky-200',
    counterValueClass: 'text-amber-300',
    studentBadgeClass: 'bg-[#144c91] border-sky-300/40 text-sky-50',
    studentPlaceholderClass: 'bg-[#0b3161]/90 border-sky-300/25 text-sky-100/90',
    secondaryBtnClass: 'bg-[#124380] hover:bg-[#1956a3] border-sky-300/35 text-sky-50',
    questionCardClass: 'bg-[#092952]/95 border-sky-300/35 shadow-[0_20px_50px_rgba(3,14,34,0.45)]',
    questionDividerClass: 'border-sky-300/25',
    questionBadgeClass: 'bg-amber-400 text-slate-950',
    questionMetaClass: 'text-sky-100/90',
    questionTextClass: 'text-white',
    optionDefaultClass:
      'bg-[#103b73]/95 border-sky-300/35 text-white hover:bg-[#174d94] hover:border-amber-300 shadow-[0_10px_28px_rgba(3,14,34,0.3)] hover:-translate-y-0.5',
    optionBadgeClass: 'bg-[#1a56a3] text-amber-200 border-sky-200/40',
    optionTextClass: 'text-white',
    optionDimmedClass: 'bg-[#09274f]/60 border-sky-300/15 text-sky-200/60 opacity-70',
    optionDimmedBadgeClass: 'bg-[#0f386e] text-sky-200/70 border-sky-300/20',
    aiBannerClass: 'bg-[#072347]/95 border-sky-300/40 text-white',
    aiBannerIconBgClass: 'bg-[#04152b]',
    aiBannerTitleClass: 'text-white',
    aiBannerStopClass: 'bg-rose-500/25 hover:bg-rose-500/40 text-rose-100 border-rose-300/40',
    explanationCardClass: 'bg-[#092952]/95 border-sky-300/35 text-sky-50',
    explanationDividerClass: 'border-sky-300/25',
    explanationTitleClass: 'text-amber-300',
    explanationTextClass: 'text-white',
    bottomBarClass: 'border-sky-300/25',
    prevBtnClass: 'bg-[#124380] hover:bg-[#1956a3] text-white border-sky-300/35',
    pageActiveClass: 'bg-amber-400 text-slate-950 border-amber-200 ring-amber-300/50',
    pageInactiveClass: 'bg-[#124380] text-sky-100 hover:bg-[#1956a3] border-sky-300/30',
    nextBtnClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sky-950/30',
    popoverClass: 'bg-[#061d3d] border-sky-300/40 text-white shadow-2xl',
  },
  {
    id: 'lilac_violet',
    name: 'Tím Hoa Cà',
    styleLabel: 'Sư phạm truyền cảm · Thanh lịch',
    category: 'dark',
    isLight: false,
    swatchGradient: 'linear-gradient(135deg, #2d1250 0%, #6838a6 100%)',
    accentSwatch: '#fbbf24',
    masterStripBackground: 'linear-gradient(90deg, #fbbf24 0%, #c084fc 100%)',
    decorPatternBackground: 'radial-gradient(rgba(216, 180, 254, 0.12) 1px, transparent 1px)',
    decorPatternSize: '28px 28px',
    miniCardBg: '#381863',
    miniOptionBg: '#48227a',
    canvasBackground: 'linear-gradient(135deg, #2d1250 0%, #4b237d 48%, #6838a6 100%)',
    sheenBackground:
      'radial-gradient(circle at 18% 12%, rgba(216, 180, 254, 0.22) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(192, 132, 252, 0.20) 0%, transparent 48%)',
    topBarClass: 'bg-[#230c40]/95 border-purple-300/25 text-white',
    counterPillClass: 'bg-[#49217a] border-purple-300/45 text-purple-100',
    counterLabelClass: 'text-purple-200',
    counterValueClass: 'text-amber-300',
    studentBadgeClass: 'bg-[#54268c] border-purple-200/45 text-purple-50',
    studentPlaceholderClass: 'bg-[#3b1966]/90 border-purple-300/25 text-purple-100/90',
    secondaryBtnClass: 'bg-[#4f2485] hover:bg-[#602e9e] border-purple-300/35 text-purple-50',
    questionCardClass: 'bg-[#381863]/95 border-purple-300/35 shadow-[0_20px_50px_rgba(16,4,36,0.42)]',
    questionDividerClass: 'border-purple-300/25',
    questionBadgeClass: 'bg-amber-400 text-slate-950',
    questionMetaClass: 'text-purple-100/90',
    questionTextClass: 'text-white',
    optionDefaultClass:
      'bg-[#48227a]/95 border-purple-300/35 text-white hover:bg-[#582b94] hover:border-amber-300 shadow-[0_10px_28px_rgba(16,4,36,0.3)] hover:-translate-y-0.5',
    optionBadgeClass: 'bg-[#6737ab] text-amber-200 border-purple-200/40',
    optionTextClass: 'text-white',
    optionDimmedClass: 'bg-[#36175e]/60 border-purple-300/20 text-purple-200/60 opacity-70',
    optionDimmedBadgeClass: 'bg-[#462178] text-purple-300/70 border-purple-300/20',
    aiBannerClass: 'bg-[#34145e]/95 border-purple-300/45 text-white',
    aiBannerIconBgClass: 'bg-[#240d42]',
    aiBannerTitleClass: 'text-white',
    aiBannerStopClass: 'bg-rose-500/25 hover:bg-rose-500/40 text-rose-100 border-rose-300/40',
    explanationCardClass: 'bg-[#381863]/95 border-purple-300/40 text-purple-50',
    explanationDividerClass: 'border-purple-300/25',
    explanationTitleClass: 'text-amber-200',
    explanationTextClass: 'text-white',
    bottomBarClass: 'border-purple-300/25',
    prevBtnClass: 'bg-[#4c2482] hover:bg-[#5e2fa0] text-white border-purple-300/35',
    pageActiveClass: 'bg-amber-400 text-slate-950 border-amber-200 ring-amber-300/50',
    pageInactiveClass: 'bg-[#4c2482] text-purple-100 hover:bg-[#6030a3] border-purple-300/30',
    nextBtnClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-purple-950/30',
    popoverClass: 'bg-[#2a104a] border-purple-300/40 text-white shadow-2xl',
  },
  {
    id: 'emerald_forest',
    name: 'Ngọc Lục Bảo',
    styleLabel: 'Dịu mắt tiết học dài · Cực quang',
    category: 'dark',
    isLight: false,
    swatchGradient: 'linear-gradient(135deg, #042926 0%, #106059 100%)',
    accentSwatch: '#5eead4',
    masterStripBackground: 'linear-gradient(90deg, #5eead4 0%, #fcd34d 100%)',
    decorPatternBackground: 'radial-gradient(rgba(94, 234, 212, 0.10) 1px, transparent 1px)',
    decorPatternSize: '28px 28px',
    miniCardBg: '#063833',
    miniOptionBg: '#0c4f49',
    canvasBackground: 'linear-gradient(135deg, #042926 0%, #0a4641 50%, #106059 100%)',
    sheenBackground:
      'radial-gradient(circle at 18% 12%, rgba(94, 234, 212, 0.16) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(45, 212, 191, 0.14) 0%, transparent 48%)',
    topBarClass: 'bg-[#031f1c]/95 border-teal-300/25 text-white',
    counterPillClass: 'bg-[#0c524c] border-teal-300/40 text-teal-50',
    counterLabelClass: 'text-teal-200',
    counterValueClass: 'text-amber-300',
    studentBadgeClass: 'bg-[#0f615a] border-teal-200/40 text-teal-50',
    studentPlaceholderClass: 'bg-[#08403b]/90 border-teal-300/25 text-teal-100/90',
    secondaryBtnClass: 'bg-[#0d5750] hover:bg-[#126e65] border-teal-300/35 text-teal-50',
    questionCardClass: 'bg-[#063833]/95 border-teal-300/35 shadow-[0_20px_50px_rgba(2,22,20,0.45)]',
    questionDividerClass: 'border-teal-300/25',
    questionBadgeClass: 'bg-amber-300 text-slate-950',
    questionMetaClass: 'text-teal-100/90',
    questionTextClass: 'text-white',
    optionDefaultClass:
      'bg-[#0c4f49]/95 border-teal-300/35 text-white hover:bg-[#11665e] hover:border-amber-300 shadow-[0_10px_28px_rgba(2,22,20,0.3)] hover:-translate-y-0.5',
    optionBadgeClass: 'bg-[#147068] text-amber-200 border-teal-200/40',
    optionTextClass: 'text-white',
    optionDimmedClass: 'bg-[#06332f]/60 border-teal-300/15 text-teal-200/60 opacity-70',
    optionDimmedBadgeClass: 'bg-[#0b4742] text-teal-200/70 border-teal-300/20',
    aiBannerClass: 'bg-[#052e2a]/95 border-teal-300/40 text-white',
    aiBannerIconBgClass: 'bg-[#031c1a]',
    aiBannerTitleClass: 'text-white',
    aiBannerStopClass: 'bg-rose-500/25 hover:bg-rose-500/40 text-rose-100 border-rose-300/40',
    explanationCardClass: 'bg-[#063833]/95 border-teal-300/35 text-teal-50',
    explanationDividerClass: 'border-teal-300/25',
    explanationTitleClass: 'text-amber-300',
    explanationTextClass: 'text-white',
    bottomBarClass: 'border-teal-300/25',
    prevBtnClass: 'bg-[#0d5750] hover:bg-[#126e65] text-white border-teal-300/35',
    pageActiveClass: 'bg-amber-300 text-slate-950 border-amber-200 ring-amber-300/50',
    pageInactiveClass: 'bg-[#0d5750] text-teal-100 hover:bg-[#126e65] border-teal-300/30',
    nextBtnClass: 'bg-amber-300 hover:bg-amber-200 text-slate-950 shadow-teal-950/30',
    popoverClass: 'bg-[#042421] border-teal-300/40 text-white shadow-2xl',
  },
  {
    id: 'crimson_sunset',
    name: 'Hoàng Hôn Đỏ Đô',
    styleLabel: 'Thi đua sôi nổi · Vàng đồng & Ruby',
    category: 'dark',
    isLight: false,
    swatchGradient: 'linear-gradient(135deg, #3b0a22 0%, #881b49 100%)',
    accentSwatch: '#fcd34d',
    masterStripBackground: 'linear-gradient(90deg, #fcd34d 0%, #fb7185 100%)',
    decorPatternBackground: 'radial-gradient(rgba(253, 164, 175, 0.11) 1px, transparent 1px)',
    decorPatternSize: '28px 28px',
    miniCardBg: '#450c27',
    miniOptionBg: '#5e1234',
    canvasBackground: 'linear-gradient(135deg, #3b0a22 0%, #631237 50%, #881b49 100%)',
    sheenBackground:
      'radial-gradient(circle at 18% 12%, rgba(251, 113, 133, 0.22) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(251, 191, 36, 0.16) 0%, transparent 48%)',
    topBarClass: 'bg-[#2b0718]/95 border-rose-300/25 text-white',
    counterPillClass: 'bg-[#5c1134] border-rose-300/40 text-rose-50',
    counterLabelClass: 'text-rose-200',
    counterValueClass: 'text-amber-300',
    studentBadgeClass: 'bg-[#6e153e] border-rose-200/40 text-rose-50',
    studentPlaceholderClass: 'bg-[#4a0d29]/90 border-rose-300/25 text-rose-100/90',
    secondaryBtnClass: 'bg-[#661439] hover:bg-[#7d1946] border-rose-300/35 text-rose-50',
    questionCardClass: 'bg-[#450c27]/95 border-rose-300/35 shadow-[0_20px_50px_rgba(32,4,18,0.45)]',
    questionDividerClass: 'border-rose-300/25',
    questionBadgeClass: 'bg-amber-300 text-slate-950',
    questionMetaClass: 'text-rose-100/90',
    questionTextClass: 'text-white',
    optionDefaultClass:
      'bg-[#5e1234]/95 border-rose-300/35 text-white hover:bg-[#751842] hover:border-amber-300 shadow-[0_10px_28px_rgba(32,4,18,0.3)] hover:-translate-y-0.5',
    optionBadgeClass: 'bg-[#821b49] text-amber-200 border-rose-200/40',
    optionTextClass: 'text-white',
    optionDimmedClass: 'bg-[#3d0b22]/60 border-rose-300/15 text-rose-200/60 opacity-70',
    optionDimmedBadgeClass: 'bg-[#54102f] text-rose-200/70 border-rose-300/20',
    aiBannerClass: 'bg-[#3d0a22]/95 border-rose-300/40 text-white',
    aiBannerIconBgClass: 'bg-[#290616]',
    aiBannerTitleClass: 'text-white',
    aiBannerStopClass: 'bg-rose-500/30 hover:bg-rose-500/45 text-rose-100 border-rose-300/40',
    explanationCardClass: 'bg-[#450c27]/95 border-rose-300/35 text-rose-50',
    explanationDividerClass: 'border-rose-300/25',
    explanationTitleClass: 'text-amber-200',
    explanationTextClass: 'text-white',
    bottomBarClass: 'border-rose-300/25',
    prevBtnClass: 'bg-[#661439] hover:bg-[#7d1946] text-white border-rose-300/35',
    pageActiveClass: 'bg-amber-300 text-slate-950 border-amber-200 ring-amber-300/50',
    pageInactiveClass: 'bg-[#661439] text-rose-100 hover:bg-[#7d1946] border-rose-300/30',
    nextBtnClass: 'bg-amber-300 hover:bg-amber-200 text-slate-950 shadow-rose-950/30',
    popoverClass: 'bg-[#36091f] border-rose-300/40 text-white shadow-2xl',
  },
];

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
  onOpenExportModal?: () => void;
  classroom?: any;
  teacher?: any;
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
  onOpenExportModal,
  classroom,
  teacher,
}) => {
  // Mode: Default to 'creator' or switch to 'live', 'presentation', 'exam', or 'analytics' (Biểu đồ phân tích)
  const [activeMode, setActiveMode] = useState<'creator' | 'live' | 'presentation' | 'exam' | 'analytics'>('creator');

  // Presentation Mode & Gọi học sinh lên bảng State
  const [boardSelectedStudent, setBoardSelectedStudent] = useState<string>('');
  const [boardSelectedOption, setBoardSelectedOption] = useState<string | null>(null);
  const [boardAnswerResult, setBoardAnswerResult] = useState<'correct' | 'wrong' | null>(null);
  const [boardTfSelections, setBoardTfSelections] = useState<Record<number, boolean | null>>({});
  const [boardTfRevealed, setBoardTfRevealed] = useState<boolean>(false);
  const [boardShortAnswerRevealed, setBoardShortAnswerRevealed] = useState<boolean>(false);
  const [showCallStudentModal, setShowCallStudentModal] = useState<boolean>(false);
  const [studentCallManualInput, setStudentCallManualInput] = useState<string>('');
  const [congratsMessage, setCongratsMessage] = useState<string>('');
  const [isReadingBoardQuestion, setIsReadingBoardQuestion] = useState<boolean>(false);
  const [boardAiSpeechState, setBoardAiSpeechState] = useState<'idle' | 'calling' | 'speaking'>('idle');
  const [isPresentationFullScreen, setIsPresentationFullScreen] = useState<boolean>(false);
  const liveQuizViewportRef = useRef<HTMLDivElement>(null);
  const wasNativePresentationFsRef = useRef<boolean>(false);
  const [boardThemeId, setBoardThemeId] = useState<string>(() => {
    try {
      return localStorage.getItem('smartboard_presentation_theme') || 'ppt_swiss_cobalt';
    } catch {
      return 'ppt_swiss_cobalt';
    }
  });
  const [boardFontId, setBoardFontId] = useState<string>(() => {
    try {
      return localStorage.getItem('smartboard_presentation_font_id') || 'be_vietnam';
    } catch {
      return 'be_vietnam';
    }
  });
  const [boardFontSize, setBoardFontSize] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('smartboard_presentation_font_size'));
      if (Number.isFinite(saved) && saved >= 18 && saved <= 44) return saved;
      return 26;
    } catch {
      return 26;
    }
  });
  const [boardLayout, setBoardLayout] = useState<PresentationLayoutMode>(() => {
    try {
      const saved = localStorage.getItem('smartboard_presentation_layout');
      if (saved === 'split' || saved === 'focus' || saved === 'classic') return saved;
      return 'classic';
    } catch {
      return 'classic';
    }
  });
  const [showBoardThemeMenu, setShowBoardThemeMenu] = useState<boolean>(false);
  const [showBoardFontMenu, setShowBoardFontMenu] = useState<boolean>(false);
  const [showBoardVoiceMenu, setShowBoardVoiceMenu] = useState<boolean>(false);
  const [activeQuizTitle, setActiveQuizTitle] = useState<string>(() => {
    try {
      return localStorage.getItem('smartboard_live_exam_title') || '';
    } catch {
      return '';
    }
  });
  const currentBoardTheme = useMemo(
    () => PRESENTATION_THEMES.find((t) => t.id === boardThemeId) || PRESENTATION_THEMES[0],
    [boardThemeId]
  );
  const currentBoardFont = useMemo(
    () => PRESENTATION_FONTS.find((f) => f.id === boardFontId) || PRESENTATION_FONTS[0],
    [boardFontId]
  );
  const boardOptionFontSize = Math.max(16, Math.round(boardFontSize * 0.78));
  const boardExplanationFontSize = Math.max(16, Math.round(boardFontSize * 0.76));
  const boardShortAnswerFontSize = Math.max(22, Math.round(boardFontSize * 0.96));

  const handleSelectBoardTheme = (themeId: string) => {
    setBoardThemeId(themeId);
    setShowBoardThemeMenu(false);
    try {
      localStorage.setItem('smartboard_presentation_theme', themeId);
    } catch (_) {}
  };
  const handleSelectBoardFont = (fontId: string) => {
    setBoardFontId(fontId);
    try {
      localStorage.setItem('smartboard_presentation_font_id', fontId);
    } catch (_) {}
  };
  const handleChangeBoardFontSize = (nextSize: number) => {
    const clamped = Math.min(44, Math.max(18, Math.round(nextSize)));
    setBoardFontSize(clamped);
    try {
      localStorage.setItem('smartboard_presentation_font_size', String(clamped));
    } catch (_) {}
  };
  const handleSelectBoardLayout = (layout: PresentationLayoutMode) => {
    setBoardLayout(layout);
    try {
      localStorage.setItem('smartboard_presentation_layout', layout);
    } catch (_) {}
  };
  const aiCallingTimerRef = useRef<any>(null);
  const lastManualQuizLaunchAtRef = useRef<number>(0);
  const boardAiSpeechStateRef = useRef<'idle' | 'calling' | 'speaking'>('idle');
  useEffect(() => {
    boardAiSpeechStateRef.current = boardAiSpeechState;
  }, [boardAiSpeechState]);

  // Dynamic Teacher Classes synchronized with tab "Lớp Học" and logged-in teacher profile
  const [teacherClasses, setTeacherClasses] = useState<ClassRoom[]>(() =>
    getActiveTeacherClasses(teacher, classroom)
  );

  const [selectedCallingClassId, setSelectedCallingClassId] = useState<string>(() => {
    const savedActiveId = localStorage.getItem('smartboard_active_class_id');
    const classes = getActiveTeacherClasses(teacher, classroom);
    if (savedActiveId && classes.some((c) => c.id === savedActiveId)) {
      return savedActiveId;
    }
    return classes[0]?.id || '';
  });

  // Re-sync when teacher or classroom prop changes
  useEffect(() => {
    const classes = getActiveTeacherClasses(teacher, classroom);
    if (classes.length > 0) {
      setTeacherClasses(classes);
      if (!selectedCallingClassId || !classes.some((c) => c.id === selectedCallingClassId)) {
        const savedActiveId = localStorage.getItem('smartboard_active_class_id');
        if (savedActiveId && classes.some((c) => c.id === savedActiveId)) {
          setSelectedCallingClassId(savedActiveId);
        } else {
          setSelectedCallingClassId(classes[0].id);
        }
      }
    }
  }, [teacher, classroom]);

  // Listen to real-time events when classes are created or uploaded in tab "Lớp Học"
  useEffect(() => {
    const handleClassesUpdated = (e: any) => {
      let updatedList: ClassRoom[] = [];
      if (e?.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        updatedList = e.detail;
      } else {
        updatedList = getActiveTeacherClasses(teacher, classroom);
      }
      if (updatedList.length > 0) {
        setTeacherClasses(updatedList);
        const savedActiveId = localStorage.getItem('smartboard_active_class_id');
        if (savedActiveId && updatedList.some((c) => c.id === savedActiveId)) {
          setSelectedCallingClassId(savedActiveId);
        } else if (!updatedList.some((c) => c.id === selectedCallingClassId)) {
          setSelectedCallingClassId(updatedList[0].id);
        }
      }
    };

    window.addEventListener('smartboard_classes_updated', handleClassesUpdated);
    window.addEventListener('storage', handleClassesUpdated);
    return () => {
      window.removeEventListener('smartboard_classes_updated', handleClassesUpdated);
      window.removeEventListener('storage', handleClassesUpdated);
    };
  }, [teacher, classroom, selectedCallingClassId]);

  // Current active calling classroom and its actual student roster
  const currentClassroom: ClassRoom | null = useMemo(() => {
    return teacherClasses.find((c) => c.id === selectedCallingClassId) || teacherClasses[0] || classroom || null;
  }, [teacherClasses, selectedCallingClassId, classroom]);

  const currentClassStudents = useMemo(() => {
    if (!currentClassroom || !currentClassroom.students) return [];
    return currentClassroom.students.map((s: any) => {
      if (typeof s === 'string') return { id: s, name: s, avatar: '👨‍🎓', gender: 'male' };
      return {
        id: s.id || s.code || s.name,
        name: s.name || s.studentName || 'Học sinh',
        studentCode: s.studentCode || s.code || '',
        oralScore: s.oralScore,
        bonusPoints: s.bonusPoints,
        gender: s.gender,
        avatar: s.avatar || (s.gender === 'female' ? '👩‍🎓' : '👨‍🎓'),
      };
    });
  }, [currentClassroom]);

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
  const [isMatrixMode, setIsMatrixMode] = useState<boolean>(false);
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

  // AI Voice State for Live Quiz Hub
  const [readingQuestionId, setReadingQuestionId] = useState<string | null>(null);
  const [isCallingSpeech, setIsCallingSpeech] = useState<boolean>(false);
  const liveCallingTimerRef = useRef<any>(null);
  const prevLiveSpeechKeyRef = useRef<string>('');
  const prevBoardSpeechKeyRef = useRef<string>('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceTonePreset>(() => {
    try {
      const savedVoiceId = localStorage.getItem('smartboard_ai_voice_preset');
      if (savedVoiceId) {
        const found = VOICE_TONE_PRESETS.find((v) => v.id === savedVoiceId);
        if (found) return found;
      }
    } catch (_) {}
    return VOICE_TONE_PRESETS[0]; // Cô giáo Kore dịu dàng chuẩn SGK
  });
  const [speechSpeed, setSpeechSpeed] = useState<number>(() => getSpeechSpeedMultiplier());
  const handleSelectVoicePreset = (preset: VoiceTonePreset) => {
    setSelectedVoice(preset);
    try {
      localStorage.setItem('smartboard_ai_voice_preset', preset.id);
    } catch (_) {}
  };
  const handleSelectSpeechSpeed = (nextSpeed: number) => {
    const updated = setSpeechSpeedMultiplier(nextSpeed);
    setSpeechSpeed(updated);
  };

  // Lưu & Mở Đề Trắc Nghiệm / Bài Tập Đã Lưu
  const [savedQuizzesList, setSavedQuizzesList] = useState<SavedEducationalItem[]>(() =>
    getSavedEducationalItems().filter((x) => x.type === 'quiz')
  );
  const [isSyncingSavedQuizzes, setIsSyncingSavedQuizzes] = useState<boolean>(false);
  const [showSavedQuizzesModal, setShowSavedQuizzesModal] = useState<boolean>(false);
  const [showSaveQuizModal, setShowSaveQuizModal] = useState<boolean>(false);
  const [saveQuizTitle, setSaveQuizTitle] = useState<string>('');
  const [saveQuizSubject, setSaveQuizSubject] = useState<string>('Toán học');
  const [saveQuizGrade, setSaveQuizGrade] = useState<string>('Lớp 12');
  const [saveQuizNotes, setSaveQuizNotes] = useState<string>('');
  const [savedQuizSearch, setSavedQuizSearch] = useState<string>('');
  const [quizToast, setQuizToast] = useState<string | null>(null);

  // Tự động đồng bộ thời gian thực cho Kho Đề Đã Lưu giữa PC và Điện thoại
  useEffect(() => {
    // 1. Tải từ Cloud khi mở
    pullSavedQuizzesFromCloud().then((items) => {
      if (items && Array.isArray(items)) {
        setSavedQuizzesList(items.filter((x) => x.type === 'quiz'));
      }
    });

    // 2. Lắng nghe Firestore Realtime (khi PC lưu, Điện thoại cập nhật trong tích tắc)
    const unsub = initSavedQuizzesRealtimeSync((items) => {
      if (items && Array.isArray(items)) {
        setSavedQuizzesList(items.filter((x) => x.type === 'quiz'));
      }
    });

    // 3. Lắng nghe sự kiện cục bộ
    const handleLocalUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setSavedQuizzesList(e.detail.filter((x: any) => x.type === 'quiz'));
      } else {
        setSavedQuizzesList(getSavedEducationalItems().filter((x) => x.type === 'quiz'));
      }
    };
    window.addEventListener('saved-quizzes-updated', handleLocalUpdate);

    return () => {
      unsub();
      window.removeEventListener('saved-quizzes-updated', handleLocalUpdate);
    };
  }, []);

  // Hàm bấm tay để đồng bộ tức thì từ Đám Mây
  const handleManualSyncQuizzesFromCloud = async () => {
    setIsSyncingSavedQuizzes(true);
    try {
      const items = await pullSavedQuizzesFromCloud();
      const quizzesOnly = items.filter((x) => x.type === 'quiz');
      setSavedQuizzesList(quizzesOnly);
      gameSounds.playCorrectChime();
      setQuizToast(`Đã đồng bộ thành công ${quizzesOnly.length} bộ đề từ Đám Mây (PC & Điện Thoại)!`);
      setTimeout(() => setQuizToast(null), 3500);
    } catch (_) {
      setQuizToast('Đã kiểm tra đồng bộ với Đám Mây.');
      setTimeout(() => setQuizToast(null), 2500);
    } finally {
      setIsSyncingSavedQuizzes(false);
    }
  };

  // State chung lưu trữ câu hỏi phòng thi trực tiếp (ưu tiên localStorage nếu teacher vừa chọn đề tùy chỉnh, sau đó roomState hoặc currentLesson)
  const [liveExamQuestions, setLiveExamQuestions] = useState<QuizQuestion[]>(() => {
    try {
      const saved = localStorage.getItem('smartboard_live_exam_questions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.id !== 'q_sample_1') {
          return parsed;
        }
      }
    } catch (_) {}
    if (roomState?.questions && roomState.questions.length > 0) return roomState.questions;
    try {
      const saved = localStorage.getItem('smartboard_live_exam_questions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return currentLesson?.quizzes || [];
  });

  // Tự động đồng bộ liveExamQuestions mỗi khi roomState.questions cập nhật từ server/firestore (tránh ghi đè lúc vừa nạp bộ đề mới)
  useEffect(() => {
    if (roomState?.questions && roomState.questions.length > 0) {
      const timeSinceManualLaunch = Date.now() - lastManualQuizLaunchAtRef.current;
      const isIncomingDefaultSample =
        roomState.questions.length === 4 && roomState.questions[0]?.id === 'q_sample_1';
      if (timeSinceManualLaunch < 4500 && isIncomingDefaultSample) {
        return;
      }
      setLiveExamQuestions(roomState.questions);
      if (roomState.title) {
        setActiveQuizTitle(roomState.title);
      }
      try {
        localStorage.setItem('smartboard_live_exam_questions', JSON.stringify(roomState.questions));
        if (roomState.title) {
          localStorage.setItem('smartboard_live_exam_title', roomState.title);
        }
      } catch (_) {}
    }
  }, [roomState?.questions, roomState?.title]);

  // Bộ câu hỏi phòng thi: đọc trực tiếp ngay lập tức, không bao giờ bị rỗng nếu vừa tạo câu hỏi
  const questions: QuizQuestion[] = (
    liveExamQuestions.length > 0
      ? liveExamQuestions
      : (roomState?.questions && roomState.questions.length > 0)
      ? roomState.questions
      : (generatedQuestions.length > 0)
      ? generatedQuestions
      : (currentLesson?.quizzes && currentLesson.quizzes.length > 0)
      ? currentLesson.quizzes
      : []
  );

  const [localActiveIndex, setLocalActiveIndex] = useState<number>(() => {
    return Math.max(0, roomState?.activeQuestionIndex || 0);
  });

  // Sync with remote room state updates (Chỉ đồng bộ tự động khi không ở chế độ trình chiếu lên bảng để tránh nhảy câu)
  useEffect(() => {
    if (activeMode !== 'presentation' && typeof roomState?.activeQuestionIndex === 'number') {
      setLocalActiveIndex((prev) => {
        if (roomState.activeQuestionIndex !== prev && roomState.activeQuestionIndex >= 0 && roomState.activeQuestionIndex < Math.max(1, questions.length)) {
          return roomState.activeQuestionIndex;
        }
        return prev;
      });
    }
  }, [roomState?.activeQuestionIndex, questions.length, activeMode]);

  const activeIndex = Math.min(
    Math.max(0, localActiveIndex),
    Math.max(0, questions.length - 1)
  );
  const activeIndexRef = useRef<number>(activeIndex);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);
  const currentQ: QuizQuestion | undefined = questions[activeIndex];

  const currentSubmissions: StudentSubmission[] =
    (currentQ && roomState?.submissions[currentQ.id]) || [];

  // Tự động kích hoạt câu hỏi sang liveExamQuestions khi chuyển sang tab Phòng thi nếu đã có câu hỏi tạo sẵn
  useEffect(() => {
    if (activeMode === 'live' && liveExamQuestions.length === 0 && generatedQuestions.length > 0) {
      setLiveExamQuestions(generatedQuestions);
      try {
        localStorage.setItem('smartboard_live_exam_questions', JSON.stringify(generatedQuestions));
      } catch (_) {}
    }
  }, [activeMode, liveExamQuestions.length, generatedQuestions]);

  // If room already has questions and generatedQuestions is empty, initialize preview
  useEffect(() => {
    if (questions.length > 0 && generatedQuestions.length === 0) {
      setGeneratedQuestions(questions);
    }
  }, [questions.length]);

  // Reset timer whenever question changes in Live mode & pre-warm TTS audio safely
  useEffect(() => {
    const speechKey = `${activeMode}:${activeIndex}:${currentQ?.id || ''}:${selectedVoice.id}`;
    if (prevLiveSpeechKeyRef.current && prevLiveSpeechKeyRef.current !== speechKey) {
      if (liveCallingTimerRef.current) {
        clearTimeout(liveCallingTimerRef.current);
        liveCallingTimerRef.current = null;
      }
      stopAllSpeech();
      setReadingQuestionId(null);
      setIsCallingSpeech(false);
    }
    prevLiveSpeechKeyRef.current = speechKey;

    if (currentQ && activeMode === 'live') {
      setTimeLeft(currentQ.timeLimit || 30);
      setIsRevealed(false);
      setIsTimerRunning(true);
    }
    // Pre-warm preprocessed first chunk in RAM cache (only POST/cache match, no wasted GET URLs)
    if (currentQ && (activeMode === 'live' || activeMode === 'presentation')) {
      prefetchQuestionSpeech(
        {
          id: currentQ.id,
          question: currentQ.question,
          options: currentQ.options || [],
          subStatements: (currentQ as any).subStatements || (currentQ as any).statements || [],
          subject: currentQ.subject,
        },
        selectedVoice
      ).catch(() => {});
    }
  }, [activeIndex, currentQ?.id, activeMode, selectedVoice.id]);

  const handleToggleSpeakCurrentQuestion = (q?: QuizQuestion) => {
    unlockWebAudio();
    const targetQ = q || currentQ;
    if (!targetQ) return;
    if (liveCallingTimerRef.current) {
      clearTimeout(liveCallingTimerRef.current);
      liveCallingTimerRef.current = null;
    }
    if (readingQuestionId === targetQ.id) {
      stopAllSpeech();
      setReadingQuestionId(null);
      setIsCallingSpeech(false);
    } else {
      setReadingQuestionId(targetQ.id);
      setIsCallingSpeech(true);
      liveCallingTimerRef.current = setTimeout(() => {
        setIsCallingSpeech(false);
        setReadingQuestionId((prev) => (prev === targetQ.id ? null : prev));
      }, 12000);
      speakQuestionContent(targetQ, {
        preset: selectedVoice,
        onStart: () => {
          if (liveCallingTimerRef.current) {
            clearTimeout(liveCallingTimerRef.current);
            liveCallingTimerRef.current = null;
          }
          setIsCallingSpeech(false);
        },
        onEnd: () => {
          if (liveCallingTimerRef.current) {
            clearTimeout(liveCallingTimerRef.current);
            liveCallingTimerRef.current = null;
          }
          setReadingQuestionId(null);
          setIsCallingSpeech(false);
        },
        onError: () => {
          if (liveCallingTimerRef.current) {
            clearTimeout(liveCallingTimerRef.current);
            liveCallingTimerRef.current = null;
          }
          setReadingQuestionId(null);
          setIsCallingSpeech(false);
        },
      });
    }
  };

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

  // Helper: extract structured Word (.docx) content preserving tables and math (<m:t>/<w:t>)
  const extractStructuredDocxText = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    try {
      const zip = await JSZip.loadAsync(arrayBuffer);
      const docXmlFile = zip.file('word/document.xml');
      if (docXmlFile) {
        const xmlStr = await docXmlFile.async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');
        const body =
          xmlDoc.getElementsByTagNameNS('*', 'body')[0] ||
          xmlDoc.getElementsByTagName('w:body')[0];

        const extractParagraphText = (pNode: Element): string => {
          const walk = (node: Node): string => {
            if (node.nodeType === 3) return '';
            if (node.nodeType !== 1) return '';
            const el = node as Element;
            const local = el.localName || el.nodeName.split(':').pop() || '';
            if (local === 't') return el.textContent || '';
            if (local === 'tab') return ' ';
            if (local === 'br' || local === 'cr') return '\n';
            let out = '';
            for (let i = 0; i < el.childNodes.length; i++) {
              out += walk(el.childNodes[i]);
            }
            return out;
          };
          return walk(pNode).replace(/[ \t]+/g, ' ').trim();
        };

        const extractTableText = (tblNode: Element): string => {
          const rows: string[] = [];
          for (let r = 0; r < tblNode.childNodes.length; r++) {
            const child = tblNode.childNodes[r] as Element;
            if (!child || child.nodeType !== 1) continue;
            const local = child.localName || child.nodeName.split(':').pop();
            if (local !== 'tr') continue;
            const cells: string[] = [];
            for (let c = 0; c < child.childNodes.length; c++) {
              const tc = child.childNodes[c] as Element;
              if (!tc || tc.nodeType !== 1) continue;
              const tcLocal = tc.localName || tc.nodeName.split(':').pop();
              if (tcLocal !== 'tc') continue;
              const cellLines: string[] = [];
              for (let p = 0; p < tc.childNodes.length; p++) {
                const pEl = tc.childNodes[p] as Element;
                if (!pEl || pEl.nodeType !== 1) continue;
                const pLocal = pEl.localName || pEl.nodeName.split(':').pop();
                if (pLocal === 'p') {
                  const txt = extractParagraphText(pEl);
                  if (txt) cellLines.push(txt);
                } else if (pLocal === 'tbl') {
                  const nested = extractTableText(pEl);
                  if (nested) cellLines.push(nested);
                }
              }
              cells.push(cellLines.join(' / '));
            }
            if (cells.some((x) => x.length > 0)) {
              rows.push(`| ${cells.join(' | ')} |`);
            }
          }
          return rows.join('\n');
        };

        if (body) {
          const blocks: string[] = [];
          for (let i = 0; i < body.childNodes.length; i++) {
            const node = body.childNodes[i] as Element;
            if (!node || node.nodeType !== 1) continue;
            const local = node.localName || node.nodeName.split(':').pop();
            if (local === 'p') {
              const txt = extractParagraphText(node);
              if (txt) blocks.push(txt);
            } else if (local === 'tbl') {
              const tbl = extractTableText(node);
              if (tbl) blocks.push(`\n[BẢNG MA TRẬN / ĐỀ]\n${tbl}\n[/BẢNG]\n`);
            }
          }
          const combined = blocks.join('\n').trim();
          if (combined.length > 20) {
            return combined;
          }
        }
      }
    } catch (docxXmlErr) {
      console.warn('Structured DOCX XML extraction fallback to mammoth:', docxXmlErr);
    }
    const res = await mammoth.extractRawText({ arrayBuffer });
    return res.value;
  };

  // Auto-detect grade & subject hints from uploaded file name & header text
  const detectGradeAndSubjectFromMatrix = (fileName: string, text: string) => {
    const sample = `${fileName} ${(text || '').slice(0, 1200)}`;
    const norm = sample.toLowerCase();

    if (/lớp\s*10|toán\s*10|vật\s*l[ýí]\s*10|hóa\s*10|khối\s*10|\b10[a-z]\d/i.test(norm)) {
      setSelectedGrade('Lớp 10');
    } else if (/lớp\s*11|toán\s*11|vật\s*l[ýí]\s*11|hóa\s*11|khối\s*11|\b11[a-z]\d/i.test(norm)) {
      setSelectedGrade('Lớp 11');
    } else if (/lớp\s*12|toán\s*12|vật\s*l[ýí]\s*12|hóa\s*12|khối\s*12|\b12[a-z]\d/i.test(norm)) {
      setSelectedGrade('Lớp 12');
    } else if (/lớp\s*[6789]|thcs|toán\s*[6789]/i.test(norm)) {
      setSelectedGrade('Khối THCS');
    }

    if (/vật\s*l[ýí]|môn\s*l[ýí]/i.test(norm)) setSelectedSubject('Vật lý');
    else if (/hóa\s*học|môn\s*hóa/i.test(norm)) setSelectedSubject('Hóa học');
    else if (/sinh\s*học|môn\s*sinh/i.test(norm)) setSelectedSubject('Sinh học');
    else if (/tiếng\s*anh|english/i.test(norm)) setSelectedSubject('Tiếng Anh');
    else if (/lịch\s*sử|môn\s*sử/i.test(norm)) setSelectedSubject('Lịch sử');
    else if (/địa\s*l[ýí]|môn\s*địa/i.test(norm)) setSelectedSubject('Địa lý');
    else if (/tin\s*học|môn\s*tin/i.test(norm)) setSelectedSubject('Tin học');
    else if (/toán\s*học|môn\s*toán|đề\s*cương.*toán|kttx\s*toán/i.test(norm)) setSelectedSubject('Toán học');
  };

  // Handle file selection (Image, PDF, Word, TXT)
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    let fileCategory: 'image' | 'pdf' | 'word' | 'text' = 'text';
    const fileName = file.name?.toLowerCase();

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
        extractedText = await extractStructuredDocxText(arrayBuffer);
      } else if (fileCategory === 'pdf') {
        // Trích xuất văn bản tiếng Việt nguyên bản từ tệp PDF
        try {
          if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
          }
          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer),
            useSystemFonts: true,
          });
          const pdf = await loadingTask.promise;
          const maxPages = Math.min(pdf.numPages, 30);
          const textParts: string[] = [];

          for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = extractCleanPdfText(textContent);
            if (pageText) {
              textParts.push(`--- Trang ${i} ---\n${pageText}`);
            }
          }

          if (textParts.length > 0) {
            extractedText = textParts.join('\n\n');
          }
        } catch (pdfErr) {
          console.warn('PDF text extraction notice in LiveQuizHub:', pdfErr);
        }

        // Đồng thời đọc base64 để AI nhìn trực tiếp bảng biểu & công thức toán trong PDF
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        extractedText = await file.text();
      }

      detectGradeAndSubjectFromMatrix(file.name, extractedText || '');

      setUploadedFile({
        file,
        name: file.name,
        size: fileSizeStr,
        type: fileCategory,
        previewUrl,
        base64,
        extractedText,
      });
      setIsMatrixMode(true);

      const hasTextNotice = extractedText ? ` (${extractedText.length} ký tự văn bản đã bóc tách)` : '';
      setStatusMessage(`✓ Đã nhận ma trận đề: "${file.name}"${hasTextNotice}. Chế độ "Tạo theo ma trận" đã được bật. Bấm "Tạo Câu Hỏi Bằng AI" để khởi tạo.`);
    } catch (err: any) {
      console.error('File parsing error', err);
      setStatusMessage(`⚠️ Lỗi đọc tệp: ${err?.message || 'Không thể đọc tệp'}`);
    }
  };

  // Ultra-Fast AI Quiz Generation
  const handleGenerateFastQuiz = async () => {
    setIsGenerating(true);
    setGenerationTimeMs(null);
    setStatusMessage(
      uploadedFile
        ? `⚡ Đang đọc ma trận "${uploadedFile.name}" & tạo câu hỏi bám sát nội dung ma trận...`
        : '⚡ Đang phân tích yêu cầu & tạo câu hỏi trắc nghiệm siêu tốc...'
    );
    const startTime = performance.now();

    try {
      const clientApiKey = getGeminiApiKey();
      const trimmedPrompt = promptTopic.trim();
      const effectivePrompt = uploadedFile
        ? trimmedPrompt
        : trimmedPrompt || currentLesson?.title || `${selectedSubject} ${selectedGrade}`;

      const payload: any = {
        prompt: effectivePrompt,
        subject: selectedSubject,
        grade: selectedGrade,
        count: isMatrixMode ? 'auto_matrix' : questionCount,
        isMatrixMode: isMatrixMode || Boolean(uploadedFile),
        difficulty: selectedDifficulty,
        timeLimit: selectedTimeLimit,
        apiKey: clientApiKey,
      };

      if (uploadedFile) {
        const mimeType =
          uploadedFile.file.type ||
          (uploadedFile.type === 'image'
            ? 'image/jpeg'
            : uploadedFile.type === 'pdf'
              ? 'application/pdf'
              : undefined);
        const canSendBase64 =
          (uploadedFile.type === 'image' || uploadedFile.type === 'pdf') &&
          Boolean(uploadedFile.base64) &&
          (uploadedFile.base64?.length || 0) < 13_000_000;

        payload.matrixFile = {
          fileName: uploadedFile.name,
          ...(uploadedFile.extractedText ? { text: uploadedFile.extractedText } : {}),
          ...(canSendBase64 ? { mimeType, base64: uploadedFile.base64 } : {}),
        };
      }

      let questions: QuizQuestion[] = [];
      let serverErrorMsg = '';
      let shouldTryDirectClient = false;

      try {
        const response = await fetch('/api/ai/fast-matrix-quiz', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(clientApiKey ? { 'x-gemini-api-key': clientApiKey } : {}),
          },
          body: JSON.stringify(payload),
        });

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await response.json();
          if (
            response.ok &&
            Array.isArray(data?.questions) &&
            data.questions.length > 0 &&
            !data.fallback &&
            !data.isFallback
          ) {
            questions = data.questions;
          } else {
            serverErrorMsg = data?.error || data?.message || '';
            if ((response.status === 404 || response.status >= 500) && clientApiKey) {
              shouldTryDirectClient = true;
            } else if (response.status === 403 && !clientApiKey && !serverErrorMsg) {
              serverErrorMsg = 'Chưa cấu hình Gemini API Key.';
            }
          }
        } else {
          shouldTryDirectClient = true;
        }
      } catch (netErr: any) {
        console.warn('[LiveQuizHub] Server endpoint unreachable, checking direct client AI:', netErr);
        shouldTryDirectClient = true;
        serverErrorMsg = netErr?.message || '';
      }

      if (questions.length === 0 && (shouldTryDirectClient || (!serverErrorMsg && clientApiKey))) {
        questions = await directFastMatrixQuiz(payload);
      }

      const elapsed = Math.round(performance.now() - startTime);
      setGenerationTimeMs(elapsed);

      if (questions && questions.length > 0) {
        setGeneratedQuestions(questions);
        setStatusMessage(
          uploadedFile
            ? `⚡ Hoàn tất! Đã tạo ${questions.length} câu hỏi bám sát ma trận "${uploadedFile.name}" trong ${(elapsed / 1000).toFixed(1)}s.`
            : `⚡ Hoàn tất! Tạo thành công ${questions.length} câu hỏi chuẩn hóa trong ${(elapsed / 1000).toFixed(1)}s.`
        );
      } else {
        throw new Error(
          serverErrorMsg ||
            'AI chưa tạo được đề từ ma trận đính kèm. Vui lòng kiểm tra Gemini API Key trong Cài đặt hoặc thử lại.'
        );
      }
    } catch (err: any) {
      console.error('Quiz generation error:', err);
      const elapsed = Math.round(performance.now() - startTime);
      setGenerationTimeMs(elapsed);
      const errMsg = err?.message || 'Không thể tạo câu hỏi từ ma trận.';
      setStatusMessage(`⚠️ ${errMsg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Launch Quiz to Live Classroom
  const handleDeployToStudents = async () => {
    const questionsToDeploy = generatedQuestions.length > 0 ? generatedQuestions : questions;
    if (questionsToDeploy.length === 0) return;

    const cleanMatrixTitle = uploadedFile?.name ? uploadedFile.name.replace(/\.[^/.]+$/, '') : '';
    const resolvedTitle = promptTopic
      ? `Đề thi: ${promptTopic}`
      : cleanMatrixTitle
        ? `Đề theo ma trận: ${cleanMatrixTitle}`
        : `${selectedSubject} - ${selectedGrade}`;

    // 1. Lập tức gán mảng câu hỏi vừa tạo vào state chung của phòng thi (liveExamQuestions = createdQuestions)
    setLiveExamQuestions(questionsToDeploy);

    // 2. Đồng bộ ngay vào localStorage phòng thi
    try {
      localStorage.setItem('smartboard_live_exam_questions', JSON.stringify(questionsToDeploy));
      localStorage.setItem('smartboard_live_exam_title', resolvedTitle);
    } catch (e) {
      console.warn('localStorage error', e);
    }

    // 3. Đồng bộ an toàn vào Firestore phòng thi (không nghẽn quota)
    try {
      const pin = roomState?.pin || '758899';
      const roomDocRef = doc(db, 'rooms', pin);
      safeSetDoc(roomDocRef, {
        pin,
        title: resolvedTitle,
        questions: questionsToDeploy,
        activeQuestionIndex: 0,
        isLive: true,
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});
    } catch (e) {
      console.warn('Firestore sync failed', e);
    }

    // 4. Gọi cập nhật cấp App và server API
    if (onApplyQuestions) {
      await onApplyQuestions(questionsToDeploy, resolvedTitle);
    }

    onControlRoom(0, true);
    setTimeLeft(questionsToDeploy[0]?.timeLimit || 30);
    setIsTimerRunning(true);
    setIsRevealed(false);
    setActiveMode('live');

    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
    });
  };

  // Export generated questions to standardized Word (.docx) with OMML math & OpenXML tables
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);
  const handleExportToWordDocx = async () => {
    const questionsToExport = generatedQuestions.length > 0 ? generatedQuestions : questions;
    if (questionsToExport.length === 0) {
      setStatusMessage('Chưa có câu hỏi nào để xuất file Word (.docx)');
      return;
    }

    setIsExportingDocx(true);
    setStatusMessage('📄 Đang xử lý công thức OMML & khởi tạo tệp Word (.docx)...');

    try {
      await exportExamToWordDocx({
        title: promptTopic || currentLesson?.title || `ĐỀ KIỂM TRA ĐỊNH KỲ ${selectedSubject.toUpperCase()}`,
        subject: selectedSubject,
        grade: selectedGrade,
        questions: questionsToExport,
        teacherName: teacher?.name || 'Thầy Trịnh Tuấn',
        examCode: roomState?.pin?.slice(-3) || '101',
      });
      setStatusMessage(`✓ Đã xuất thành công tệp Word (.docx) gồm ${questionsToExport.length} câu hỏi chuẩn OMML!`);
    } catch (err: any) {
      console.error('Word export error:', err);
      setStatusMessage(`Lỗi xuất Word: ${err?.message || 'Không thể tạo file docx'}`);
    } finally {
      setIsExportingDocx(false);
    }
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

  const resetBoardQuestionInteractions = () => {
    setBoardSelectedOption(null);
    setBoardAnswerResult(null);
    setBoardTfSelections({});
    setBoardTfRevealed(false);
    setBoardShortAnswerRevealed(false);
    setCongratsMessage('');
  };

  const handleNextQuestion = () => {
    const prev = activeIndexRef.current;
    const maxIdx = Math.max(0, questions.length - 1);
    if (prev < maxIdx) {
      const nextIndex = prev + 1;
      activeIndexRef.current = nextIndex;
      setLocalActiveIndex(nextIndex);
      resetBoardQuestionInteractions();
      try {
        if (onControlRoom) onControlRoom(nextIndex, true);
      } catch (_) {}
    }
  };

  const handlePrevQuestion = () => {
    const prev = activeIndexRef.current;
    if (prev > 0) {
      const prevIndex = prev - 1;
      activeIndexRef.current = prevIndex;
      setLocalActiveIndex(prevIndex);
      resetBoardQuestionInteractions();
      try {
        if (onControlRoom) onControlRoom(prevIndex, true);
      } catch (_) {}
    }
  };

  // Keyboard navigation & wireless presenter clicker support for TV presentation
  useEffect(() => {
    if (activeMode !== 'presentation') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        handleNextQuestion();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrevQuestion();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMode, activeIndex, questions.length]);

  // Trình Chiếu & Gọi Học Sinh Lên Bảng Handlers
  const handleBoardOptionClick = (key: string) => {
    unlockWebAudio();
    if (!currentQ) return;
    if (boardAnswerResult !== null) return; // Đã trả lời, tránh bấm liên tục

    const cleanKey = key.trim().toUpperCase();
    setBoardSelectedOption(cleanKey);
    const correctKey = (currentQ.correctAnswer || '').trim().toUpperCase();
    const isCorrect = cleanKey === correctKey;

    if (isCorrect) {
      setBoardAnswerResult('correct');
      gameSounds.playCorrectChime();
      setTimeout(() => gameSounds.playVictoryFanfare(), 250);

      // Bắn pháo hoa ăn mừng rực rỡ trên màn hình Tivi 75 inch
      confetti({
        particleCount: 160,
        spread: 90,
        origin: { y: 0.55 },
        colors: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'],
      });
      setTimeout(() => {
        confetti({
          particleCount: 110,
          angle: 60,
          spread: 75,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 110,
          angle: 120,
          spread: 75,
          origin: { x: 1 },
        });
      }, 300);

      const studentDisplayName = boardSelectedStudent ? `em ${boardSelectedStudent}` : 'em';
      const praises = [
        `Nhiệt liệt chúc mừng ${studentDisplayName} đã trả lời rất chính xác! Thầy cô khen ngợi em và tặng em một điểm cộng!`,
        `Xuất sắc! Câu trả lời của ${studentDisplayName} hoàn toàn chính xác! Cả lớp hãy cho một tràng pháo tay thật lớn nào!`,
        `Chính xác! ${studentDisplayName} nắm kiến thức bài học rất vững và tư duy rất nhanh! Thầy cô rất tự hào về em!`,
        `Tuyệt vời! Phương án ${cleanKey} là đáp án hoàn toàn chính xác! Chúc mừng ${studentDisplayName} đã xuất sắc ghi điểm!`,
      ];
      const picked = praises[Math.floor(Math.random() * praises.length)];
      setCongratsMessage(picked);
      speakText(picked, { preset: selectedVoice });
    } else {
      setBoardAnswerResult('wrong');
      gameSounds.playWrongBuzz();

      const studentDisplayName = boardSelectedStudent ? `em ${boardSelectedStudent}` : 'em';
      const consolations = [
        `Rất tiếc câu trả lời chưa chính xác rồi ${studentDisplayName} nhé! Đừng buồn, em hãy chú ý lắng nghe thầy cô chữa bài để làm tốt hơn ở lần sau nhé!`,
        `Tiếc quá, chưa đúng rồi! Đừng nản lòng nhé ${studentDisplayName}, cố gắng ở câu hỏi tiếp theo chắc chắn em sẽ làm đúng!`,
        `Chưa chính xác rồi ${studentDisplayName} nhé! Thầy cô ghi nhận tinh thần rất tích cực của em, lần sau chú ý hơn sẽ làm rất tốt!`,
      ];
      const picked = consolations[Math.floor(Math.random() * consolations.length)];
      setCongratsMessage(picked);
      speakText(picked, { preset: selectedVoice });
    }
  };

  const handleBoardTfSelect = (sIdx: number, val: boolean) => {
    unlockWebAudio();
    if (boardTfRevealed) return;
    setBoardTfSelections((prev) => ({
      ...prev,
      [sIdx]: prev[sIdx] === val ? null : val,
    }));
  };

  const handleBoardTfReveal = (subStatements: any[]) => {
    unlockWebAudio();
    if (!currentQ || boardTfRevealed) return;
    setBoardTfRevealed(true);

    let correctCount = 0;
    const total = subStatements.length;
    subStatements.forEach((sub, sIdx) => {
      const expected = typeof sub.correct === 'boolean' ? sub.correct : Boolean(sub.isCorrect);
      if (boardTfSelections[sIdx] === expected) {
        correctCount++;
      }
    });

    const hasSelections = Object.values(boardTfSelections).some((v) => v === true || v === false);
    const studentDisplayName = boardSelectedStudent ? `em ${boardSelectedStudent}` : 'cả lớp';

    if (!hasSelections) {
      gameSounds.playCorrectChime();
      setBoardAnswerResult(null);
      setCongratsMessage(`Đã công bố đáp án Đúng/Sai chuẩn cho từng ý a, b, c, d.`);
    } else if (correctCount === total && total > 0) {
      setBoardAnswerResult('correct');
      gameSounds.playCorrectChime();
      setTimeout(() => gameSounds.playVictoryFanfare(), 250);
      confetti({
        particleCount: 150,
        spread: 85,
        origin: { y: 0.55 },
        colors: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'],
      });
      const msg = `Xuất sắc! ${studentDisplayName} đã trả lời đúng chính xác cả ${total}/${total} ý Đúng/Sai!`;
      setCongratsMessage(msg);
      speakText(msg, { preset: selectedVoice });
    } else if (correctCount >= Math.ceil(total / 2)) {
      setBoardAnswerResult('correct');
      gameSounds.playCorrectChime();
      const msg = `Tốt lắm! Đã trả lời đúng ${correctCount}/${total} ý. Cùng kiểm tra lại từng mệnh đề nhé!`;
      setCongratsMessage(msg);
      speakText(msg, { preset: selectedVoice });
    } else {
      setBoardAnswerResult('wrong');
      gameSounds.playWrongBuzz();
      const msg = `Đúng ${correctCount}/${total} ý rồi, ${studentDisplayName} hãy xem phần hướng dẫn chi tiết bên dưới nhé!`;
      setCongratsMessage(msg);
      speakText(msg, { preset: selectedVoice });
    }
  };

  const handleCallRandomStudent = () => {
    unlockWebAudio();
    let candidateList: string[] = currentClassStudents.map((s) => s.name);

    if (candidateList.length === 0 && roomState?.activeStudents && roomState.activeStudents.length > 0) {
      candidateList = roomState.activeStudents.map((s) => s.name);
    }

    if (candidateList.length === 0) {
      const clsName = currentClassroom?.name || 'này';
      alert(`Lớp ${clsName} hiện chưa có danh sách học sinh. Thầy/Cô vui lòng chuyển sang tab "Lớp Học" để thêm học sinh hoặc nhập danh sách lớp từ file Excel!`);
      return;
    }

    const picked = candidateList[Math.floor(Math.random() * candidateList.length)];
    setBoardSelectedStudent(picked);
    resetBoardQuestionInteractions();
    setShowCallStudentModal(false);

    // AI đọc câu gọi học sinh lên bảng bằng tiếng Việt chuẩn
    speakStudentCalling(picked, 'call', [], { preset: selectedVoice });
  };

  const handleReadBoardQuestion = () => {
    unlockWebAudio();
    if (!currentQ) return;
    if (aiCallingTimerRef.current) {
      clearTimeout(aiCallingTimerRef.current);
      aiCallingTimerRef.current = null;
    }
    if (isReadingBoardQuestion || boardAiSpeechState !== 'idle') {
      stopAllSpeech();
      setIsReadingBoardQuestion(false);
      setBoardAiSpeechState('idle');
      return;
    }
    setIsReadingBoardQuestion(true);
    setBoardAiSpeechState('calling');

    // Watchdog timer: Nếu sau 12s thiết bị TV/điện thoại hoặc mạng bị nghẽn, tự động thoát trạng thái calling
    aiCallingTimerRef.current = setTimeout(() => {
      if (boardAiSpeechStateRef.current === 'calling') {
        setIsReadingBoardQuestion(false);
        setBoardAiSpeechState('idle');
      }
    }, 12000);

    speakQuestionContent(currentQ, {
      preset: selectedVoice,
      onStart: () => {
        if (aiCallingTimerRef.current) {
          clearTimeout(aiCallingTimerRef.current);
          aiCallingTimerRef.current = null;
        }
        setBoardAiSpeechState('speaking');
      },
      onEnd: () => {
        if (aiCallingTimerRef.current) {
          clearTimeout(aiCallingTimerRef.current);
          aiCallingTimerRef.current = null;
        }
        setIsReadingBoardQuestion(false);
        setBoardAiSpeechState('idle');
      },
      onError: () => {
        if (aiCallingTimerRef.current) {
          clearTimeout(aiCallingTimerRef.current);
          aiCallingTimerRef.current = null;
        }
        setIsReadingBoardQuestion(false);
        setBoardAiSpeechState('idle');
      },
    });
  };

  // Reset trạng thái đọc AI chỉ khi thực sự chuyển câu hỏi (tránh re-render ngắt âm đang phát)
  useEffect(() => {
    const boardKey = `${localActiveIndex}:${currentQ?.id || ''}`;
    if (prevBoardSpeechKeyRef.current && prevBoardSpeechKeyRef.current !== boardKey) {
      if (aiCallingTimerRef.current) {
        clearTimeout(aiCallingTimerRef.current);
        aiCallingTimerRef.current = null;
      }
      stopAllSpeech();
      setIsReadingBoardQuestion(false);
      setBoardAiSpeechState('idle');
    }
    prevBoardSpeechKeyRef.current = boardKey;
  }, [localActiveIndex, currentQ?.id]);

  // Đồng bộ chế độ Toàn Màn Hình Trình Chiếu theo phạm vi mục này (ẩn thanh Header và thanh Menu phía trên)
  useEffect(() => {
    const active = isPresentationFullScreen && activeMode === 'presentation';
    window.dispatchEvent(new CustomEvent('set-feature-fullscreen', { detail: { active } }));
    return () => {
      if (active) {
        window.dispatchEvent(new CustomEvent('set-feature-fullscreen', { detail: { active: false } }));
      }
    };
  }, [isPresentationFullScreen, activeMode]);

  useEffect(() => {
    if (activeMode !== 'presentation' && isPresentationFullScreen) {
      setIsPresentationFullScreen(false);
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  }, [activeMode, isPresentationFullScreen]);

  // Phím Escape hoặc thoát fullscreen gốc trình duyệt để thu nhỏ lại đầy đủ
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPresentationFullScreen) {
        wasNativePresentationFsRef.current = false;
        setIsPresentationFullScreen(false);
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        }
      }
    };
    const handleNativeFsChange = () => {
      const hasFs = Boolean(document.fullscreenElement);
      if (hasFs) {
        wasNativePresentationFsRef.current = true;
      } else if (wasNativePresentationFsRef.current) {
        wasNativePresentationFsRef.current = false;
        setIsPresentationFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleEscKey);
    document.addEventListener('fullscreenchange', handleNativeFsChange);
    document.addEventListener('webkitfullscreenchange', handleNativeFsChange);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
      document.removeEventListener('fullscreenchange', handleNativeFsChange);
      document.removeEventListener('webkitfullscreenchange', handleNativeFsChange);
    };
  }, [isPresentationFullScreen]);

  // Handlers cho tính năng Lưu và Mở bài tập trắc nghiệm
  const handleSaveQuizSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveQuizTitle.trim()) return;

    const targetQuestions = generatedQuestions.length > 0 ? generatedQuestions : questions;
    if (targetQuestions.length === 0) {
      setQuizToast('Chưa có câu hỏi nào để lưu!');
      setTimeout(() => setQuizToast(null), 3000);
      return;
    }

    const savedItem = saveEducationalItem({
      title: saveQuizTitle.trim(),
      type: 'quiz',
      subject: saveQuizSubject,
      grade: saveQuizGrade,
      questionCount: targetQuestions.length,
      questions: targetQuestions,
      notes: saveQuizNotes.trim() || undefined,
    });

    const updated = getSavedEducationalItems().filter((x) => x.type === 'quiz');
    setSavedQuizzesList(updated);
    setShowSaveQuizModal(false);
    setSaveQuizTitle('');
    setSaveQuizNotes('');
    setQuizToast(`Đã lưu bài tập "${savedItem.title}" (${targetQuestions.length} câu) thành công! Khi đến trường, Thầy/Cô chỉ cần mở "Kho Đề Đã Lưu" để trình chiếu cho học sinh.`);
    gameSounds.playVictoryFanfare();
    setTimeout(() => setQuizToast(null), 4500);
  };

  const applySelectedSavedQuiz = async (item: SavedEducationalItem, targetMode: 'presentation' | 'live' | 'exam' | 'creator') => {
    lastManualQuizLaunchAtRef.current = Date.now();
    setLiveExamQuestions(item.questions);
    setGeneratedQuestions(item.questions);
    setActiveQuizTitle(item.title);
    setPromptTopic(item.title);
    if (item.subject) setSelectedSubject(item.subject);
    if (item.grade) setSelectedGrade(item.grade);
    setLocalActiveIndex(0);
    resetBoardQuestionInteractions();
    setShowSavedQuizzesModal(false);

    try {
      localStorage.setItem('smartboard_live_exam_questions', JSON.stringify(item.questions));
      localStorage.setItem('smartboard_live_exam_title', item.title);
    } catch (_) {}

    if (onApplyQuestions) {
      await onApplyQuestions(item.questions, item.title);
    }
    onControlRoom(0, true);
    setActiveMode(targetMode);
    gameSounds.playCorrectChime();
  };

  const handleLaunchSavedQuizPresentation = async (item: SavedEducationalItem) => {
    await applySelectedSavedQuiz(item, 'presentation');
    setQuizToast(`Đã nạp bài tập "${item.title}" (${item.questions.length} câu) vào chế độ Trình Chiếu Lên Bảng!`);
    setTimeout(() => setQuizToast(null), 3500);
  };

  const handleLaunchSavedQuizLive = async (item: SavedEducationalItem) => {
    await applySelectedSavedQuiz(item, 'live');
    setQuizToast(`Đã phát bài tập "${item.title}" (${item.questions.length} câu) vào phòng thi trực tiếp!`);
    setTimeout(() => setQuizToast(null), 3500);
  };

  const handleLaunchSavedQuizExam = async (item: SavedEducationalItem) => {
    await applySelectedSavedQuiz(item, 'exam');
    setQuizToast(`Đã nạp bài tập "${item.title}" vào chế độ Phòng Thi Khóa Màn Hình!`);
    setTimeout(() => setQuizToast(null), 3500);
  };

  const handleLaunchSavedQuizCreator = async (item: SavedEducationalItem) => {
    await applySelectedSavedQuiz(item, 'creator');
    setQuizToast(`Đã nạp bài tập "${item.title}" vào mục Soạn Đề AI để chỉnh sửa & trình chiếu!`);
    setTimeout(() => setQuizToast(null), 3500);
  };

  const handleDeleteSavedQuiz = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Thầy/Cô có chắc chắn muốn xóa bài tập trắc nghiệm này không?')) {
      deleteEducationalItem(id);
      const updated = getSavedEducationalItems().filter((x) => x.type === 'quiz');
      setSavedQuizzesList(updated);
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

  const isScopedPresentationFS = isPresentationFullScreen && activeMode === 'presentation';

  return (
    <div
      ref={liveQuizViewportRef}
      id="live-quiz-viewport"
      className={
        isScopedPresentationFS
          ? 'fixed inset-0 z-[9990] w-screen h-dvh flex flex-col bg-slate-950 rounded-none overflow-hidden border-0 shadow-none'
          : 'relative w-full h-[calc(100vh-100px)] flex flex-col bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-md'
      }
    >
      {/* Top Universal Mode Switcher & Room Status Bar (Ẩn hoàn toàn khi trình chiếu câu hỏi Toàn Màn Hình) */}
      {!isScopedPresentationFS && (
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
              id="presentation-mode-nav-btn"
              onClick={() => {
                setActiveMode('presentation');
                resetBoardQuestionInteractions();
              }}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeMode === 'presentation'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
              title="Trình chiếu câu hỏi lên màn hình 75 inch và gọi học sinh lên bảng làm bài ngay"
            >
              <Tv className="w-4 h-4 text-amber-300" />
              <span>Trình Chiếu & Lên Bảng</span>
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

            <button
              id="analytics-mode-nav-btn"
              onClick={() => setActiveMode('analytics')}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeMode === 'analytics'
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <BarChart3 className="w-4 h-4 text-teal-300" />
              <span>Biểu Đồ Phân Tích</span>
            </button>
          </div>

          <div className="hidden xl:flex items-center gap-2 text-xs text-slate-400 pl-2">
            <span>Mã phòng:</span>
            <span className="font-mono font-black text-amber-400 text-sm tracking-wider">{roomState?.pin || '758899'}</span>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Nút Kho Đề Đã Lưu luôn hiển thị để mở nhanh */}
          <button
            onClick={() => setShowSavedQuizzesModal(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
            title="Mở kho bài tập trắc nghiệm đã tạo sẵn ở nhà để trình chiếu hoặc phát cho học sinh"
          >
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <span>Kho Đề Đã Lưu ({savedQuizzesList.length})</span>
          </button>

          {/* Nút Lưu Bài Tập */}
          {(generatedQuestions.length > 0 || questions.length > 0) && (
            <button
              onClick={() => {
                setSaveQuizTitle(promptTopic || currentLesson?.title || `Bài tập trắc nghiệm ${selectedSubject} - ${new Date().toLocaleDateString('vi-VN')}`);
                setSaveQuizSubject(selectedSubject);
                setSaveQuizGrade(selectedGrade);
                setShowSaveQuizModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              title="Lưu bộ câu hỏi trắc nghiệm này để dùng lại ở lớp"
            >
              <Save className="w-4 h-4 text-amber-400" />
              <span>Lưu Bài Tập ({generatedQuestions.length > 0 ? generatedQuestions.length : questions.length} câu)</span>
            </button>
          )}

          {/* Nút Xuất File Word .docx chuẩn OMML đọc tốt trên điện thoại */}
          {(generatedQuestions.length > 0 || questions.length > 0) && (
            <button
              onClick={handleExportToWordDocx}
              disabled={isExportingDocx}
              className="px-3.5 py-2 rounded-xl bg-blue-900/70 hover:bg-blue-800 text-blue-200 border border-blue-700/60 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50 shadow-xs"
              title="Xuất bộ đề thi ra file Word .docx chuẩn cấu trúc OMML đọc tốt trên điện thoại và máy tính"
            >
              <FileText className="w-4 h-4 text-blue-300" />
              <span>{isExportingDocx ? 'Đang xuất Word...' : 'Xuất Word (.docx)'}</span>
            </button>
          )}

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
      )}

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
                      setIsMatrixMode(false);
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
                    <option value="Lớp 12">Lớp 12</option>
                    <option value="Lớp 11">Lớp 11</option>
                    <option value="Lớp 10">Lớp 10</option>
                    <option value="Khối THCS">Khối THCS (Lớp 6-9)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-slate-700">Số lượng câu hỏi:</label>
                    {isMatrixMode ? (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-600" /> Theo ma trận
                      </span>
                    ) : (
                      <span className="text-[11px] font-black text-indigo-700 font-mono bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                        {questionCount} câu
                      </span>
                    )}
                  </div>

                  {/* Tùy chọn: Tạo theo ma trận đính kèm */}
                  <label
                    className={`flex items-center gap-2 px-2.5 py-1.5 mb-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      isMatrixMode
                        ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900 shadow-xs'
                        : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isMatrixMode}
                      onChange={(e) => setIsMatrixMode(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                    />
                    <span className="flex-1">Tạo theo ma trận đính kèm</span>
                    {uploadedFile && (
                      <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-200/80 text-emerald-800 px-1.5 py-0.5 rounded-md">
                        Đã tải tệp
                      </span>
                    )}
                  </label>

                  {/* Khi isMatrixMode bật: làm mờ / khóa nút và hiển thị thông báo */}
                  {isMatrixMode ? (
                    <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-[11px] font-semibold leading-snug">
                      <div className="flex items-start gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                        <span>Số lượng câu hỏi sẽ được tự động trích xuất từ file ma trận.</span>
                      </div>
                      <div className="text-[10px] text-amber-700 mt-1 pl-5">
                        Tự tạo đủ Phần I, II, III (và IV tự luận) đúng số câu trong ma trận.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-4 gap-1 mb-1.5">
                        {[4, 5, 8, 10].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setQuestionCount(c)}
                            className={`py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                              questionCount === c
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
                        <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">Tự chọn:</span>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={questionCount}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setQuestionCount(Math.min(50, Math.max(1, val)));
                          }}
                          className="w-16 px-1.5 py-0.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-indigo-700 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">(tối đa 50)</span>
                      </div>
                    </>
                  )}
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
                <div
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                    statusMessage.startsWith('⚠️') || statusMessage.startsWith('Lỗi')
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-indigo-50 border-indigo-200/60 text-indigo-900'
                  }`}
                >
                  {statusMessage.startsWith('⚠️') || statusMessage.startsWith('Lỗi') ? (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                  )}
                  <span>{statusMessage}</span>
                  {generationTimeMs !== null && (
                    <span
                      className={`ml-auto font-mono text-[11px] px-2 py-0.5 rounded font-bold shrink-0 ${
                        statusMessage.startsWith('⚠️') || statusMessage.startsWith('Lỗi')
                          ? 'bg-rose-200/80 text-rose-900'
                          : 'bg-indigo-200/80 text-indigo-900'
                      }`}
                    >
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
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={handleExportToWordDocx}
                    disabled={isExportingDocx}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                    title="Xuất đề thi ra tệp Word (.docx) chuẩn OMML không dùng markdown"
                  >
                    <FileText className="w-4 h-4 text-white" />
                    <span>{isExportingDocx ? 'Đang xuất Word...' : 'Xuất File Word (.docx)'}</span>
                  </button>

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
                generatedQuestions.map((q, idx) => {
                  const prevQ = idx > 0 ? generatedQuestions[idx - 1] : null;
                  const isNewPart = !prevQ || (q.partLabel && q.partLabel !== prevQ.partLabel) || (q.partType && q.partType !== prevQ.partType);

                  return (
                    <React.Fragment key={q.id || idx}>
                      {/* Section Part Header Banner when moving to new Part */}
                      {isNewPart && q.partLabel && (
                        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 text-white shadow-md flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center font-black text-sm">
                              {q.partType === 'part_2_true_false' ? 'II' : q.partType === 'part_3_short_answer' ? 'III' : q.partType === 'part_4_essay' ? 'IV' : 'I'}
                            </span>
                            <div>
                              <h4 className="text-sm font-black tracking-wide uppercase">{q.partLabel}</h4>
                              <p className="text-[11px] text-indigo-200">
                                {q.partType === 'part_2_true_false'
                                  ? 'Mỗi câu hỏi có 4 ý a), b), c), d). Thí sinh chọn Đúng hoặc Sai cho từng ý.'
                                  : q.partType === 'part_3_short_answer'
                                  ? 'Thí sinh tính toán và điền đáp số ngắn / số nguyên hoặc thập phân.'
                                  : q.partType === 'part_4_essay'
                                  ? 'Câu hỏi tự luận kiểm tra lập luận, các bước giải chi tiết và biểu điểm.'
                                  : 'Mỗi câu hỏi có 4 phương án A, B, C, D. Thí sinh chọn 1 phương án đúng nhất.'}
                              </p>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-xl bg-white/20 text-[11px] font-bold">
                            Chuẩn BGD 2025
                          </span>
                        </div>
                      )}

                      <div
                        className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs hover:border-indigo-300 transition-all space-y-4"
                      >
                        {/* Question Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="px-3 py-1 rounded-xl bg-indigo-600 text-white text-xs font-black">
                              CÂU {idx + 1}
                            </span>
                            {q.partLabel && (
                              <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
                                {q.partLabel.split(':')[0]}
                              </span>
                            )}
                            {q.difficulty && (
                              <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
                                {q.difficulty}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-mono font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{q.timeLimit || 30}s</span>
                            </span>
                            {q.maxScore && (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono font-bold">
                                {q.maxScore} điểm
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => handleDeleteQuestion(q.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Xóa câu hỏi này"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Question Text & Diagram (Tự động vẽ đồ thị hàm số & hình minh họa thực tế chuẩn SGK) */}
                        <div className="py-1">
                          <QuizRichContentRenderer
                            content={q.question}
                            diagramType={q.diagramType}
                            diagramData={q.diagramData}
                            textClassName="text-base font-bold text-slate-900 leading-relaxed mb-3"
                          />
                        </div>

                        {/* Format 1: Part II - True / False with 4 Sub-Statements (a, b, c, d) */}
                        {q.partType === 'part_2_true_false' || (q.subStatements && q.subStatements.length > 0) ? (
                          <div className="space-y-2.5 pt-1">
                            <div className="text-xs font-bold text-slate-600">Đánh giá tính Đúng / Sai của các khẳng định sau:</div>
                            <div className="grid grid-cols-1 gap-2">
                              {(q.subStatements || []).map((sub, sIdx) => {
                                const subKey = sub.key || sub.label || ['a', 'b', 'c', 'd'][sIdx] || `ý ${sIdx + 1}`;
                                const subText = sub.text || sub.statement || '';
                                const isSubCorrect = typeof sub.isCorrect === 'boolean' ? sub.isCorrect : Boolean(sub.correct);
                                return (
                                  <div
                                    key={sIdx}
                                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3"
                                  >
                                    <div className="flex items-start gap-2.5 flex-1">
                                      <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                                        {subKey}
                                      </span>
                                      <div className="text-sm font-semibold text-slate-800 pt-0.5">
                                        <MathFormulaRenderer content={subText} />
                                      </div>
                                    </div>
                                    <div className="shrink-0 flex items-center gap-1.5">
                                      <span
                                        className={`px-3 py-1 rounded-xl text-xs font-black border ${
                                          isSubCorrect
                                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                                            : 'bg-rose-100 text-rose-700 border-rose-300'
                                        }`}
                                      >
                                        {isSubCorrect ? '✓ ĐÚNG' : '✗ SAI'}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : q.partType === 'part_3_short_answer' || q.shortAnswerKey ? (
                          /* Format 2: Part III - Short Answer / Numeric Fill */
                          <div className="p-4 rounded-2xl bg-cyan-50/70 border border-cyan-200 space-y-2">
                            <div className="text-xs font-bold text-cyan-900 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-cyan-600" />
                              <span>Đáp Án Điền Khuyết / Trả Lời Ngắn:</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="px-4 py-2 rounded-xl bg-white border-2 border-cyan-400 text-slate-900 font-mono font-black text-base shadow-xs">
                                {q.shortAnswerKey || q.correctAnswer || 'Chưa cung cấp'}
                              </span>
                              <span className="text-xs text-slate-500 font-medium">
                                (Học sinh nhập chính xác số hoặc cụm từ ngắn trên máy tính/điện thoại)
                              </span>
                            </div>
                          </div>
                        ) : q.partType === 'part_4_essay' || q.essayRubric ? (
                          /* Format 3: Part IV - Essay & Scoring Rubric */
                          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                            <div className="text-xs font-black text-amber-900 uppercase flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-amber-600" />
                              <span>Hướng Dẫn Chấm Tự Luận & Thang Điểm:</span>
                            </div>
                            <div className="text-xs text-slate-800 leading-relaxed font-medium bg-white/80 p-3 rounded-xl border border-amber-200/60">
                              <MathFormulaRenderer content={q.essayRubric || q.explanation || 'Xem hướng dẫn giải chi tiết bên dưới.'} />
                            </div>
                          </div>
                        ) : (
                          /* Format 4: Part I - Multiple Choice (A, B, C, D) */
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
                        )}

                        {/* Explanation */}
                        {q.explanation && (
                          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-950 flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-amber-900">Giải thích chi tiết: </span>
                              <MathFormulaRenderer content={q.explanation} />
                            </div>
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })
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
                    onClick={handleExportToWordDocx}
                    disabled={isExportingDocx}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4 text-white" />
                    <span>{isExportingDocx ? 'Đang xuất Word...' : 'Xuất File Word (.docx)'}</span>
                  </button>

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

              {/* Nút Bắt đầu đếm giờ / Tạm dừng */}
              <button
                onClick={() => {
                  if (timeLeft === 0) setTimeLeft(currentQ?.timeLimit || 30);
                  setIsTimerRunning((prev) => !prev);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 ${
                  isTimerRunning
                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500 shadow-emerald-600/30'
                }`}
                title={isTimerRunning ? 'Tạm dừng đếm giờ' : 'Bắt đầu đếm giờ làm bài'}
              >
                {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isTimerRunning ? 'Tạm dừng' : 'Bắt đầu đếm giờ'}</span>
              </button>

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
                  <div className="text-xs uppercase font-extrabold tracking-widest text-indigo-600 mb-3 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                      <span>ĐỀ BÀI TRẮC NGHIỆM</span>
                      {currentQ.difficulty && (
                        <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600 font-medium">
                          Độ khó: {currentQ.difficulty}
                        </span>
                      )}
                    </div>

                    {/* AI Speech Voice Control */}
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedVoice.id}
                        onChange={(e) => {
                          const found = VOICE_TONE_PRESETS.find((p) => p.id === e.target.value);
                          if (found) handleSelectVoicePreset(found);
                        }}
                        className="text-[11px] font-bold text-slate-700 bg-white border border-slate-300 rounded-lg px-2 py-1 focus:outline-none"
                      >
                        {VOICE_TONE_PRESETS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleToggleSpeakCurrentQuestion()}
                        className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          readingQuestionId === currentQ.id
                            ? isCallingSpeech
                              ? 'bg-amber-500 text-white shadow-md animate-pulse'
                              : 'bg-rose-600 text-white animate-pulse shadow-md'
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                        }`}
                        title="Nghe giọng AI đọc câu hỏi và 4 phương án cho cả lớp"
                      >
                        {readingQuestionId === currentQ.id ? (
                          isCallingSpeech ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Đang gọi giọng AI...</span>
                            </>
                          ) : (
                            <>
                              <Square className="w-3.5 h-3.5 fill-current" />
                              <span>Dừng đọc AI</span>
                            </>
                          )
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Nghe AI đọc câu hỏi 🔊</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {readingQuestionId === currentQ.id && (
                    <div className="mb-3 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between gap-2 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                        {isCallingSpeech ? (
                          <span className="font-semibold text-amber-900 flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
                            Đang gọi giọng đọc AI diễn cảm, Thầy/Cô đợi một chút nhé...
                          </span>
                        ) : (
                          <span className="font-semibold text-emerald-700 flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                            Trợ lý AI đang đọc đề bài và các phương án
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        {selectedVoice.label}
                      </span>
                    </div>
                  )}

                  <div className={`${scale.questionText} text-slate-900 font-bold`}>
                    <QuizRichContentRenderer
                      content={
                        currentQ.question ||
                        (currentQ as any).prompt ||
                        (currentQ as any).content ||
                        (currentQ as any).text ||
                        (currentQ as any).questionText ||
                        (currentQ as any).stem ||
                        (currentQ as any).title ||
                        'Chưa có nội dung đề bài.'
                      }
                      diagramType={currentQ.diagramType}
                      diagramData={currentQ.diagramData}
                      textClassName="text-slate-900 font-bold text-lg md:text-xl lg:text-2xl"
                    />
                  </div>
                </div>

                {/* Options / True-False Statements / Short Answer */}
                {(() => {
                  const liveSubStatements =
                    Array.isArray((currentQ as any).subStatements) && (currentQ as any).subStatements.length > 0
                      ? (currentQ as any).subStatements
                      : Array.isArray((currentQ as any).statements) && (currentQ as any).statements.length > 0
                      ? (currentQ as any).statements
                      : [];
                  const isLiveTf = currentQ.partType === 'part_2_true_false' || liveSubStatements.length > 0;
                  const isLiveShort = !isLiveTf && (currentQ.partType === 'part_3_short_answer' || !!currentQ.shortAnswerKey);

                  if (isLiveTf) {
                    return (
                      <div className="space-y-2.5 shrink-0">
                        {liveSubStatements.map((sub: any, sIdx: number) => {
                          const label = sub.label || sub.key || ['a', 'b', 'c', 'd'][sIdx] || `${sIdx + 1}`;
                          const text = sub.statement || sub.text || '';
                          const isTrue = typeof sub.correct === 'boolean' ? sub.correct : Boolean(sub.isCorrect);
                          return (
                            <div
                              key={sIdx}
                              className="p-3.5 md:p-4 rounded-xl border-2 border-slate-200 bg-white flex items-center justify-between gap-3 shadow-xs"
                            >
                              <div className="flex items-start gap-3 flex-1">
                                <span className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-black text-sm flex items-center justify-center shrink-0">
                                  {label})
                                </span>
                                <div className="text-sm md:text-base text-slate-800 font-bold leading-snug pt-0.5">
                                  <MathFormulaRenderer content={text} />
                                </div>
                              </div>
                              {isRevealed && (
                                <span
                                  className={`px-3 py-1 rounded-xl text-xs font-black shrink-0 ${
                                    isTrue
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-rose-600 text-white'
                                  }`}
                                >
                                  {isTrue ? '✓ ĐÚNG' : '✗ SAI'}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  if (isLiveShort) {
                    return (
                      <div className="p-4 rounded-xl border-2 border-cyan-200 bg-cyan-50/70 flex items-center justify-between gap-3 shrink-0">
                        <span className="text-sm font-bold text-cyan-900">
                          {isRevealed ? 'Đáp án trả lời ngắn:' : 'Học sinh tính toán và điền đáp số ngắn trên thiết bị'}
                        </span>
                        {isRevealed && (
                          <span className="px-4 py-1.5 rounded-xl bg-white border-2 border-cyan-500 font-mono font-black text-lg text-slate-900">
                            {currentQ.shortAnswerKey || currentQ.correctAnswer || 'Chưa có'}
                          </span>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-3.5 shrink-0">
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
                            className={`relative p-3.5 md:p-4 rounded-xl border-2 transition-all flex flex-col justify-between min-h-[58px] md:min-h-[64px] ${cardStyle}`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center font-black text-base md:text-lg shrink-0 ${
                                  isRevealed && isCorrect
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-indigo-50 border border-indigo-200 text-indigo-700'
                                }`}
                              >
                                {opt.key}
                              </div>
                              <div className="flex-1 text-sm md:text-base text-slate-800 font-bold leading-snug">
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
                  );
                })()}

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

      {/* VIEW: TRÌNH CHIẾU CÂU HỎI & GỌI HỌC SINH LÊN BẢNG TRÊN TIVI 75 INCH (POWERPOINT SLIDE DECK) */}
      {activeMode === 'presentation' && (
        <div
          className={`flex flex-col relative transition-colors duration-300 ${
            currentBoardTheme.isLight ? 'text-slate-900' : 'text-white'
          } flex-1 ${
            isPresentationFullScreen
              ? 'overflow-y-auto'
              : 'overflow-hidden'
          }`}
          style={{
            background: currentBoardTheme.canvasBackground,
            fontFamily: currentBoardFont.cssFamily,
          }}
        >
          {/* PowerPoint Master Slide Subtle Geometric Grid / Dot Pattern */}
          {currentBoardTheme.decorPatternBackground && (
            <div
              className="pointer-events-none absolute inset-0 opacity-90"
              style={{
                backgroundImage: currentBoardTheme.decorPatternBackground,
                backgroundSize: currentBoardTheme.decorPatternSize || '28px 28px',
              }}
            />
          )}

          {/* Ambient radial sheen (compositor-friendly gradient, 60fps on 75" TV) */}
          <div
            className="pointer-events-none absolute inset-0 opacity-75"
            style={{
              background: currentBoardTheme.sheenBackground,
            }}
          />

          {/* Top Status & Controls Bar */}
          <div
            className={`relative flex flex-wrap items-center justify-between px-4 sm:px-6 py-3 border-b z-30 shrink-0 gap-2.5 sticky top-0 shadow-[0_8px_28px_rgba(15,23,42,0.14)] ${currentBoardTheme.topBarClass}`}
          >
            {/* Left: Question Indicator, Quiz Title & Called Student */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div
                className={`px-3.5 py-1.5 rounded-2xl border font-mono text-sm md:text-base font-black flex items-center gap-2 shadow-inner tabular-nums ${currentBoardTheme.counterPillClass}`}
              >
                <span className={`tracking-wide ${currentBoardTheme.counterLabelClass}`}>CÂU</span>
                <span className={`text-xl md:text-2xl ${currentBoardTheme.counterValueClass}`}>
                  {activeIndex + 1}/{questions.length}
                </span>
              </div>

              {boardSelectedStudent ? (
                <div
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border font-bold text-xs md:text-sm shadow-md ${currentBoardTheme.studentBadgeClass}`}
                >
                  <span className="text-lg" aria-hidden="true">🎒</span>
                  <span>Học sinh lên bảng:</span>
                  <span className={`font-black text-sm md:text-base underline decoration-2 underline-offset-4 ${currentBoardTheme.isLight ? 'text-indigo-700 decoration-indigo-500' : 'text-amber-300 decoration-amber-300'}`}>
                    {boardSelectedStudent}
                  </span>
                  <button
                    onClick={() => {
                      setBoardSelectedStudent('');
                      resetBoardQuestionInteractions();
                    }}
                    className="ml-1 p-1 hover:bg-black/15 rounded-lg opacity-80 hover:opacity-100 cursor-pointer"
                    title="Bỏ chọn học sinh"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  className={`hidden xl:flex items-center gap-2 text-xs font-medium px-3.5 py-2 rounded-2xl border ${currentBoardTheme.studentPlaceholderClass}`}
                >
                  <span className="truncate max-w-[230px]">
                    {activeQuizTitle ? `Đề: ${activeQuizTitle}` : 'Bấm "Gọi Lên Bảng" để chọn học sinh'}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Quick Action Controls */}
            <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
              <button
                onClick={handleCallRandomStudent}
                className="px-3 py-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-xs md:text-sm flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer whitespace-nowrap shrink-0"
                title="Gọi ngẫu nhiên học sinh trong lớp lên bảng trả lời"
              >
                <Dice5 className="w-4 h-4 text-slate-950" />
                <span>Gọi Lên Bảng</span>
              </button>

              <button
                onClick={() => setShowCallStudentModal(true)}
                className={`px-3 py-2 rounded-2xl border font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${currentBoardTheme.secondaryBtnClass}`}
                title={`Chọn học sinh cụ thể từ danh sách ${currentClassroom?.name ? (currentClassroom.name.toLowerCase().startsWith('lớp') ? currentClassroom.name : `Lớp ${currentClassroom.name}`) : 'lớp'}`}
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {currentClassroom?.name ? (currentClassroom.name.toLowerCase().startsWith('lớp') ? currentClassroom.name : `Lớp ${currentClassroom.name}`) : 'Danh Sách Lớp'}
                </span>
              </button>

              {/* Chọn Giọng Đọc AI */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowBoardVoiceMenu((v) => !v);
                    setShowBoardThemeMenu(false);
                    setShowBoardFontMenu(false);
                  }}
                  className={`px-3 py-2 rounded-2xl border font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${currentBoardTheme.secondaryBtnClass}`}
                  title={`Chọn giọng đọc AI (${selectedVoice.name})`}
                >
                  <Mic className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="hidden 2xl:inline max-w-[125px] truncate">{selectedVoice.label}</span>
                  <span className="2xl:hidden">Giọng AI</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                </button>

                {showBoardVoiceMenu && (
                  <div
                    className={`absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border p-3 z-50 space-y-1.5 ${currentBoardTheme.popoverClass}`}
                  >
                    <div className="flex items-center justify-between px-2 py-1.5 border-b border-current/10">
                      <span className="text-xs font-black uppercase tracking-wider opacity-85">
                        Chọn Giọng Đọc AI Truyền Cảm
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowBoardVoiceMenu(false)}
                        className="p-1 rounded-lg hover:bg-black/15 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                      {VOICE_TONE_PRESETS.slice(0, 8).map((preset) => {
                        const isSel = selectedVoice.id === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              handleSelectVoicePreset(preset);
                              setShowBoardVoiceMenu(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                              isSel
                                ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold shadow-sm'
                                : currentBoardTheme.isLight
                                ? 'bg-slate-50 hover:bg-indigo-50 border-slate-200 text-slate-800'
                                : 'bg-white/5 hover:bg-white/15 border-white/10 text-white'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-black truncate">{preset.label}</div>
                              <div className={`text-[11px] truncate ${isSel ? 'text-slate-800' : 'opacity-75'}`}>
                                {preset.sub}
                              </div>
                            </div>
                            {isSel && <Check className="w-4 h-4 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="pt-2 border-t border-current/10 flex items-center justify-between gap-2 px-1">
                      <span className="text-[11px] font-bold opacity-80 whitespace-nowrap">Tốc độ đọc:</span>
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
                              onClick={() => handleSelectSpeechSpeed(sp.val)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer whitespace-nowrap ${
                                active
                                  ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow-xs'
                                  : currentBoardTheme.isLight
                                  ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                                  : 'bg-white/10 border-white/15 text-white/90 hover:bg-white/20'
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

              <button
                onClick={handleReadBoardQuestion}
                className={`px-3 py-2 rounded-2xl border text-xs md:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  boardAiSpeechState === 'calling'
                    ? 'bg-amber-400/20 border-amber-300 text-amber-300 shadow-lg'
                    : isReadingBoardQuestion
                    ? 'bg-rose-600 border-rose-300 text-white shadow-lg'
                    : 'bg-[#6d28d9] hover:bg-[#7c3aed] border-purple-200/45 text-white shadow-md'
                }`}
                title={
                  boardAiSpeechState === 'calling'
                    ? 'Đang gọi trợ lý AI chuẩn bị giọng đọc...'
                    : isReadingBoardQuestion
                    ? 'Dừng đọc câu hỏi'
                    : `AI đọc câu hỏi bằng ${selectedVoice.label}`
                }
              >
                {boardAiSpeechState === 'calling' ? (
                  <>
                    <Loader2 className="w-4 h-4 text-amber-300 animate-spin" />
                    <span>Đang gọi...</span>
                  </>
                ) : isReadingBoardQuestion ? (
                  <>
                    <VolumeX className="w-4 h-4 text-white" />
                    <span>Dừng đọc</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 text-purple-100" />
                    <span>Đọc Đề AI</span>
                  </>
                )}
              </button>

              {/* Tùy Chọn Font Chữ & Cỡ Chữ Trình Chiếu */}
              <div className="relative flex items-center">
                <div className={`flex items-center rounded-2xl border overflow-hidden ${currentBoardTheme.secondaryBtnClass}`}>
                  <button
                    type="button"
                    onClick={() => handleChangeBoardFontSize(boardFontSize - 2)}
                    disabled={boardFontSize <= 18}
                    className="px-2 py-2 hover:bg-black/10 disabled:opacity-35 transition-colors cursor-pointer"
                    title="Giảm cỡ chữ"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBoardFontMenu((v) => !v);
                      setShowBoardThemeMenu(false);
                      setShowBoardVoiceMenu(false);
                    }}
                    className="px-2.5 py-2 border-x border-current/15 font-bold text-xs md:text-sm flex items-center gap-1.5 hover:bg-black/10 transition-colors cursor-pointer whitespace-nowrap"
                    title={`Chọn Font chữ (${currentBoardFont.name}) & Cỡ chữ (${boardFontSize}px)`}
                  >
                    <Type className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden lg:inline max-w-[100px] truncate">{currentBoardFont.name}</span>
                    <span className="font-mono text-[11px] font-black opacity-85 tabular-nums">{boardFontSize}px</span>
                    <ChevronDown className="w-3 h-3 opacity-80" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeBoardFontSize(boardFontSize + 2)}
                    disabled={boardFontSize >= 44}
                    className="px-2 py-2 hover:bg-black/10 disabled:opacity-35 transition-colors cursor-pointer"
                    title="Tăng cỡ chữ"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {showBoardFontMenu && (
                  <div
                    className={`absolute right-0 top-full mt-2 w-80 sm:w-[400px] rounded-2xl border p-4 z-50 space-y-4 ${currentBoardTheme.popoverClass}`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-current/15">
                      <div className="flex items-center gap-2">
                        <Type className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-black uppercase tracking-wider">
                          Font Chữ &amp; Kích Thước Trình Chiếu
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowBoardFontMenu(false)}
                        className="p-1 rounded-lg hover:bg-black/15 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Size Controls */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold opacity-85">Cỡ chữ câu hỏi:</span>
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 tabular-nums">
                          {boardFontSize}px
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleChangeBoardFontSize(boardFontSize - 2)}
                          disabled={boardFontSize <= 18}
                          className={`p-1.5 rounded-xl border disabled:opacity-35 cursor-pointer ${
                            currentBoardTheme.isLight ? 'border-slate-300 hover:bg-slate-100' : 'border-white/20 hover:bg-white/10'
                          }`}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="range"
                          min={18}
                          max={44}
                          step={1}
                          value={boardFontSize}
                          onChange={(e) => handleChangeBoardFontSize(Number(e.target.value))}
                          className="flex-1 accent-amber-500 cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => handleChangeBoardFontSize(boardFontSize + 2)}
                          disabled={boardFontSize >= 44}
                          className={`p-1.5 rounded-xl border disabled:opacity-35 cursor-pointer ${
                            currentBoardTheme.isLight ? 'border-slate-300 hover:bg-slate-100' : 'border-white/20 hover:bg-white/10'
                          }`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { px: 20, label: 'Gọn 20px' },
                          { px: 26, label: 'Chuẩn 26px' },
                          { px: 32, label: 'Lớn 32px' },
                          { px: 38, label: 'TV 38px' },
                        ].map((preset) => {
                          const isActive = boardFontSize === preset.px;
                          return (
                            <button
                              key={preset.px}
                              type="button"
                              onClick={() => handleChangeBoardFontSize(preset.px)}
                              className={`py-1.5 px-1 rounded-xl border text-[11px] font-bold transition-all cursor-pointer tabular-nums ${
                                isActive
                                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-xs'
                                  : currentBoardTheme.isLight
                                  ? 'bg-slate-100 hover:bg-indigo-50 border-slate-200 text-slate-700'
                                  : 'bg-white/10 hover:bg-white/20 border-white/15 text-white/90'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Font Family Selector */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold opacity-85">Kiểu Font chữ Slide:</div>
                      <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                        {PRESENTATION_FONTS.map((font) => {
                          const isSel = currentBoardFont.id === font.id;
                          return (
                            <button
                              key={font.id}
                              type="button"
                              onClick={() => handleSelectBoardFont(font.id)}
                              className={`w-full text-left px-3 py-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                isSel
                                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                                  : currentBoardTheme.isLight
                                  ? 'bg-slate-50 hover:bg-indigo-50 border-slate-200 text-slate-800'
                                  : 'bg-white/5 hover:bg-white/15 border-white/15 text-white'
                              }`}
                            >
                              <div className="min-w-0">
                                <div
                                  className="text-sm font-bold truncate"
                                  style={{ fontFamily: font.cssFamily }}
                                >
                                  Aa · {font.name}
                                </div>
                                <div className={`text-[11px] truncate ${isSel ? 'text-slate-800' : 'opacity-70'}`}>
                                  {font.subtitle}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                                    isSel
                                      ? 'bg-slate-950/15 text-slate-950'
                                      : currentBoardTheme.isLight
                                      ? 'bg-slate-200/80 text-slate-700'
                                      : 'bg-white/10 text-white/80'
                                  }`}
                                >
                                  {font.badgeText}
                                </span>
                                {isSel && <Check className="w-4 h-4" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chọn Giao Diện Slide PowerPoint & Bố Cục */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowBoardThemeMenu((v) => !v);
                    setShowBoardVoiceMenu(false);
                    setShowBoardFontMenu(false);
                  }}
                  className={`px-3 py-2 rounded-2xl border font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${currentBoardTheme.secondaryBtnClass}`}
                  title="Chọn giao diện Slide PowerPoint & bố cục trình chiếu"
                >
                  <span
                    className="w-4 h-4 rounded-full border border-white/60 shrink-0 shadow-xs"
                    style={{ background: currentBoardTheme.swatchGradient }}
                  />
                  <Palette className="w-4 h-4 shrink-0 hidden sm:inline" />
                  <span className="hidden lg:inline max-w-[115px] truncate">{currentBoardTheme.name}</span>
                  <span className="lg:hidden">Mẫu Slide</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                </button>

                {showBoardThemeMenu && (
                  <div
                    className={`absolute right-0 mt-2 w-[340px] sm:w-[460px] rounded-2xl border p-4 z-50 space-y-3.5 ${currentBoardTheme.popoverClass}`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-current/15">
                      <div className="flex items-center gap-2">
                        <LayoutTemplate className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-black uppercase tracking-wider">
                          Thiết Kế Slide PowerPoint &amp; Bố Cục
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowBoardThemeMenu(false)}
                        className="p-1 rounded-lg hover:bg-black/15 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Slide Layout Switcher */}
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider opacity-75">
                        Bố cục trình chiếu:
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'classic' as PresentationLayoutMode, label: 'Chuẩn 1 Cột', sub: 'Trên - Dưới' },
                          { id: 'split' as PresentationLayoutMode, label: 'Chia Đôi 16:9', sub: 'Đề trái · Đáp án phải' },
                          { id: 'focus' as PresentationLayoutMode, label: 'Rạp Chiếu', sub: 'Tập trung giữa' },
                        ].map((lay) => {
                          const isSel = boardLayout === lay.id;
                          return (
                            <button
                              key={lay.id}
                              type="button"
                              onClick={() => handleSelectBoardLayout(lay.id)}
                              className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                                isSel
                                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                                  : currentBoardTheme.isLight
                                  ? 'bg-slate-50 hover:bg-indigo-50 border-slate-200 text-slate-800'
                                  : 'bg-white/5 hover:bg-white/15 border-white/15 text-white'
                              }`}
                            >
                              <div className="text-xs font-black truncate">{lay.label}</div>
                              <div className={`text-[10px] truncate ${isSel ? 'text-slate-800' : 'opacity-70'}`}>
                                {lay.sub}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Grouped Visual Mini-Slide Thumbnails */}
                    <div className="max-h-[360px] overflow-y-auto space-y-3 pr-1">
                      {[
                        {
                          key: 'light' as const,
                          title: 'Slide Nền Sáng Chuyên Nghiệp (Phòng Sáng)',
                          icon: Sun,
                        },
                        {
                          key: 'dark' as const,
                          title: 'Slide Nền Tối Sân Khấu & Tivi 75"',
                          icon: Moon,
                        },
                      ].map((group) => {
                        const GroupIcon = group.icon;
                        const items = PRESENTATION_THEMES.filter((t) => t.category === group.key);
                        return (
                          <div key={group.key} className="space-y-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider opacity-80 px-0.5">
                              <GroupIcon className="w-3.5 h-3.5 text-amber-500" />
                              <span>{group.title}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {items.map((theme) => {
                                const isSel = currentBoardTheme.id === theme.id;
                                return (
                                  <button
                                    key={theme.id}
                                    type="button"
                                    onClick={() => handleSelectBoardTheme(theme.id)}
                                    className={`text-left p-2 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                                      isSel
                                        ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-400/15 shadow-md'
                                        : currentBoardTheme.isLight
                                        ? 'bg-slate-50 hover:bg-indigo-50 border-slate-200 text-slate-800'
                                        : 'bg-white/5 hover:bg-white/10 border-white/15 text-white'
                                    }`}
                                  >
                                    {/* Miniature 16:9 PowerPoint Slide Preview */}
                                    <div
                                      className="w-full aspect-[16/9] rounded-lg overflow-hidden p-1.5 flex flex-col justify-between border border-black/15 relative shadow-inner"
                                      style={{ background: theme.canvasBackground }}
                                    >
                                      <div
                                        className="w-full rounded-sm p-1 flex flex-col gap-1 border border-white/15"
                                        style={{ backgroundColor: theme.miniCardBg }}
                                      >
                                        <div
                                          className="h-1 w-full rounded-full"
                                          style={{ background: theme.masterStripBackground }}
                                        />
                                        <div
                                          className="h-1.5 w-3/4 rounded-full opacity-75"
                                          style={{ backgroundColor: theme.accentSwatch }}
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-1">
                                        {[0, 1, 2, 3].map((b) => (
                                          <div
                                            key={b}
                                            className="h-2.5 rounded-sm border border-white/15"
                                            style={{ backgroundColor: theme.miniOptionBg }}
                                          />
                                        ))}
                                      </div>
                                      {isSel && (
                                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow">
                                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 px-0.5">
                                      <div className="text-xs font-black truncate">{theme.name}</div>
                                      <div className="text-[10px] opacity-70 truncate">{theme.styleLabel}</div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {(boardSelectedOption !== null ||
                boardAnswerResult !== null ||
                Object.keys(boardTfSelections).length > 0 ||
                boardTfRevealed ||
                boardShortAnswerRevealed) && (
                <button
                  onClick={resetBoardQuestionInteractions}
                  className={`px-3 py-2 rounded-2xl border font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${currentBoardTheme.secondaryBtnClass}`}
                  title="Xóa lựa chọn để học sinh thử lại"
                >
                  <RotateCcw className="w-4 h-4 text-amber-500" />
                  <span>Làm Lại</span>
                </button>
              )}

              {/* Nút Toàn Màn Hình / Thu Nhỏ chiếu Tivi 75 inch */}
              <button
                onClick={() => {
                  const nextVal = !isPresentationFullScreen;
                  setIsPresentationFullScreen(nextVal);
                  setShowBoardThemeMenu(false);
                  setShowBoardVoiceMenu(false);
                  setShowBoardFontMenu(false);
                  if (nextVal) {
                    try {
                      const targetEl = liveQuizViewportRef.current || document.documentElement;
                      if (!document.fullscreenElement && targetEl.requestFullscreen) {
                        targetEl.requestFullscreen().catch(() => {});
                      }
                    } catch (_) {}
                  } else {
                    wasNativePresentationFsRef.current = false;
                    try {
                      if (document.fullscreenElement && document.exitFullscreen) {
                        document.exitFullscreen().catch(() => {});
                      }
                    } catch (_) {}
                  }
                }}
                className={`px-3 py-2 rounded-2xl border text-xs md:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isPresentationFullScreen
                    ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-lg font-black'
                    : currentBoardTheme.secondaryBtnClass
                }`}
                title={isPresentationFullScreen ? 'Thoát toàn màn hình (Esc)' : 'Phóng to full màn hình TV 75 inch'}
              >
                {isPresentationFullScreen ? (
                  <>
                    <Minimize2 className="w-4 h-4" />
                    <span>Thu Nhỏ (Esc)</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-4 h-4 text-emerald-500" />
                    <span>Toàn Màn Hình</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div
            className={`relative z-10 flex-1 overflow-y-auto p-4 md:p-7 flex flex-col justify-between w-full space-y-5 ${
              boardLayout === 'focus'
                ? 'max-w-5xl mx-auto'
                : isPresentationFullScreen || boardLayout === 'split'
                ? 'max-w-[96vw] mx-auto px-4 sm:px-8'
                : 'max-w-7xl mx-auto'
            }`}
          >
            {!currentQ ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12">
                <BookOpen className="w-16 h-16 opacity-60 mb-4" />
                <h3 className={`text-xl font-bold mb-2 ${currentBoardTheme.questionTextClass}`}>
                  Chưa có câu hỏi nào để trình chiếu
                </h3>
                <p className="text-sm max-w-md opacity-80">
                  Vui lòng chọn từ &quot;Kho Đề Đã Lưu&quot; hoặc chuyển sang tab &quot;Soạn Đề AI &amp; Ma Trận&quot; để nạp câu hỏi.
                </p>
                <button
                  onClick={() => setActiveMode('creator')}
                  className="mt-6 px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm cursor-pointer shadow-lg"
                >
                  Tạo Đề Trắc Nghiệm Ngay
                </button>
              </div>
            ) : (
              <>
                {/* AI Character Voice Assistant Status Banner */}
                {boardAiSpeechState !== 'idle' && (
                  <div className={`p-4 rounded-3xl border-2 shadow-2xl flex items-center justify-between gap-4 ${currentBoardTheme.aiBannerClass}`}>
                    <div className="flex items-center gap-3.5">
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-400 via-violet-400 to-amber-300 p-0.5 shadow-lg">
                          <div className={`w-full h-full rounded-[14px] flex items-center justify-center text-white ${currentBoardTheme.aiBannerIconBgClass}`}>
                            {boardAiSpeechState === 'calling' ? (
                              <Bot className="w-6 h-6 text-amber-300 animate-bounce" />
                            ) : (
                              <Volume2 className="w-6 h-6 text-emerald-300" />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap text-xs md:text-sm">
                          <h4 className={`font-black flex items-center gap-1.5 ${currentBoardTheme.aiBannerTitleClass}`}>
                            {boardAiSpeechState === 'calling' ? (
                              <>
                                <span>Đang kết nối giọng đọc AI</span>
                                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                              </>
                            ) : (
                              <span>Trợ lý AI đang đọc câu hỏi</span>
                            )}
                          </h4>
                          <span className="opacity-60" aria-hidden="true">·</span>
                          <span className="font-semibold opacity-90">
                            {selectedVoice.label || 'Cô giáo dịu dàng'}
                          </span>
                        </div>
                        <p className="text-xs opacity-90 flex items-center gap-2 flex-wrap">
                          {boardAiSpeechState === 'calling' ? (
                            <span className="font-medium">
                              Đang chuẩn bị âm thanh tiếng Việt chuẩn SGK, Thầy/Cô vui lòng chờ trong giây lát...
                            </span>
                          ) : (
                            <span className="font-medium">
                              Đang phát âm thanh bài giảng trực tiếp qua loa phòng học
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        stopAllSpeech();
                        setIsReadingBoardQuestion(false);
                        setBoardAiSpeechState('idle');
                      }}
                      className={`px-4 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 ${currentBoardTheme.aiBannerStopClass}`}
                    >
                      <VolumeX className="w-4 h-4" />
                      <span>Dừng Đọc</span>
                    </button>
                  </div>
                )}

                {/* Slide Body Wrapper (Supports Classic Stack, Split 16:9, and Focus Theater Layouts) */}
                <div
                  className={
                    boardLayout === 'split'
                      ? 'grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start flex-1'
                      : 'space-y-5 flex-1 flex flex-col justify-center'
                  }
                >
                  {/* 1. Clear & Prominent Question Card (ĐỀ BÀI) */}
                  <div className={boardLayout === 'split' ? 'lg:col-span-6' : 'w-full'}>
                    {(() => {
                      const presentationQuestionText =
                        currentQ.question ||
                        (currentQ as any).prompt ||
                        (currentQ as any).content ||
                        (currentQ as any).text ||
                        (currentQ as any).questionText ||
                        (currentQ as any).title ||
                        (currentQ as any).stem ||
                        '';

                      return (
                        <div className={`rounded-3xl border-2 relative overflow-hidden shrink-0 ${currentBoardTheme.questionCardClass}`}>
                          {/* PowerPoint Top Master Ribbon */}
                          <div
                            className="h-1.5 w-full"
                            style={{ background: currentBoardTheme.masterStripBackground }}
                          />

                          <div className="p-6 md:p-8">
                            <div className={`flex items-center justify-between pb-3.5 mb-4 border-b flex-wrap gap-3 ${currentBoardTheme.questionDividerClass}`}>
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className={`px-3.5 py-1.5 rounded-xl font-black text-xs md:text-sm uppercase tracking-wide flex items-center gap-1.5 shadow-sm tabular-nums ${currentBoardTheme.questionBadgeClass}`}>
                                  <FileText className="w-4 h-4" />
                                  <span>ĐỀ BÀI CÂU {activeIndex + 1}/{questions.length}</span>
                                </span>
                                <div className={`flex items-center gap-2 text-xs md:text-sm font-semibold ${currentBoardTheme.questionMetaClass}`}>
                                  <span>{(currentQ as any).subject || selectedSubject}</span>
                                  <span aria-hidden="true" className="opacity-50">·</span>
                                  <span>{(currentQ as any).grade || selectedGrade}</span>
                                  {currentQ.difficulty && (
                                    <>
                                      <span aria-hidden="true" className="opacity-50">·</span>
                                      <span className={currentBoardTheme.isLight ? 'text-indigo-700 font-bold' : 'text-amber-200'}>
                                        {currentQ.difficulty}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className={`text-xs md:text-sm font-medium hidden sm:flex items-center gap-2 ${currentBoardTheme.questionMetaClass}`}>
                                <Tv className={`w-4 h-4 ${currentBoardTheme.isLight ? 'text-indigo-600' : 'text-amber-300'}`} />
                                <span>Trình Chiếu 75&quot;</span>
                                <span aria-hidden="true" className="opacity-45">·</span>
                                <span>
                                  {currentQ.partType === 'part_2_true_false' ||
                                  (Array.isArray((currentQ as any).subStatements) && (currentQ as any).subStatements.length > 0)
                                    ? 'Chạm Đúng / Sai cho từng ý a, b, c, d'
                                    : currentQ.partType === 'part_3_short_answer' || currentQ.shortAnswerKey
                                    ? 'Bấm nút để xem đáp án điền khuyết'
                                    : 'Chạm đáp án trực tiếp để trả lời'}
                                </span>
                              </div>
                            </div>

                            {/* Question Content & Formulas with User Font & Exact Size */}
                            <div
                              className={`font-bold leading-relaxed tracking-normal select-text ${currentBoardTheme.questionTextClass}`}
                              style={{
                                fontFamily: currentBoardFont.cssFamily,
                                fontSize: `${boardFontSize}px`,
                              }}
                            >
                              <QuizRichContentRenderer
                                content={presentationQuestionText || 'Chưa có nội dung đề bài.'}
                                diagramType={currentQ.diagramType}
                                diagramData={currentQ.diagramData}
                                textClassName={`${currentBoardTheme.questionTextClass} font-bold`}
                                textStyle={{
                                  fontFamily: currentBoardFont.cssFamily,
                                  fontSize: `${boardFontSize}px`,
                                }}
                                isPresentationMode={true}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Right Column (Split Mode) or Bottom Section (Classic/Focus Mode): Answers + Feedback + Explanation */}
                  <div className={boardLayout === 'split' ? 'lg:col-span-6 space-y-4' : 'space-y-5 w-full'}>
                    {/* 2. Interactive Options / True-False Sub-Statements (a, b, c, d) / Short Answer / Essay */}
                    {(() => {
                      const rawSubStatements: any[] =
                        Array.isArray((currentQ as any).subStatements) && (currentQ as any).subStatements.length > 0
                          ? (currentQ as any).subStatements
                          : Array.isArray((currentQ as any).statements) && (currentQ as any).statements.length > 0
                          ? (currentQ as any).statements
                          : [];
                      const isTrueFalseQ = currentQ.partType === 'part_2_true_false' || rawSubStatements.length > 0;
                      const isShortAnswerQ = !isTrueFalseQ && (currentQ.partType === 'part_3_short_answer' || !!currentQ.shortAnswerKey);
                      const isEssayQ =
                        !isTrueFalseQ &&
                        !isShortAnswerQ &&
                        (currentQ.partType === 'part_4_essay' || !!currentQ.essayRubric || !currentQ.options || currentQ.options.length === 0);

                      if (isTrueFalseQ) {
                        return (
                          <div className="space-y-4 shrink-0">
                            <div className={`grid grid-cols-1 ${boardLayout === 'split' ? '' : 'lg:grid-cols-2'} gap-3.5`}>
                              {rawSubStatements.map((sub: any, sIdx: number) => {
                                const subKey = (sub.label || sub.key || ['a', 'b', 'c', 'd'][sIdx] || `${sIdx + 1}`).trim();
                                const subText = (sub.statement || sub.text || '').trim();
                                const expectedTrue = typeof sub.correct === 'boolean' ? sub.correct : Boolean(sub.isCorrect);
                                const chosen = boardTfSelections[sIdx];
                                const isSubRight = chosen !== null && chosen !== undefined && chosen === expectedTrue;
                                const isSubWrong = chosen !== null && chosen !== undefined && chosen !== expectedTrue;

                                let rowCardClass = currentBoardTheme.optionDefaultClass;
                                if (boardTfRevealed) {
                                  if (isSubRight) {
                                    rowCardClass = 'bg-emerald-700/95 border-2 border-emerald-300 text-white shadow-xl';
                                  } else if (isSubWrong) {
                                    rowCardClass = 'bg-rose-800/95 border-2 border-rose-300 text-white shadow-lg';
                                  }
                                }

                                return (
                                  <div
                                    key={sIdx}
                                    className={`p-4 md:p-5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${rowCardClass}`}
                                  >
                                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                      <div
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0 border shadow-sm ${
                                          boardTfRevealed && isSubRight
                                            ? 'bg-emerald-300 text-slate-950 border-emerald-200'
                                            : boardTfRevealed && isSubWrong
                                            ? 'bg-rose-300 text-slate-950 border-rose-200'
                                            : currentBoardTheme.optionBadgeClass
                                        }`}
                                      >
                                        {subKey})
                                      </div>
                                      <div
                                        className={`flex-1 font-bold leading-snug pt-0.5 ${
                                          boardTfRevealed && (isSubRight || isSubWrong)
                                            ? 'text-white'
                                            : currentBoardTheme.optionTextClass
                                        }`}
                                        style={{
                                          fontFamily: currentBoardFont.cssFamily,
                                          fontSize: `${boardOptionFontSize}px`,
                                        }}
                                      >
                                        <MathFormulaRenderer content={subText} />
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                      <button
                                        type="button"
                                        disabled={boardTfRevealed}
                                        onClick={() => handleBoardTfSelect(sIdx, true)}
                                        className={`px-4 py-2.5 rounded-xl font-black text-sm border-2 transition-all cursor-pointer active:scale-95 ${
                                          boardTfRevealed
                                            ? expectedTrue
                                              ? 'bg-emerald-400 text-slate-950 border-emerald-200 shadow-md'
                                              : chosen === true
                                              ? 'bg-rose-500 text-white border-rose-200'
                                              : 'opacity-40 bg-slate-800/40 border-white/15'
                                            : chosen === true
                                            ? 'bg-emerald-500 text-slate-950 border-emerald-200 shadow-md scale-105'
                                            : currentBoardTheme.isLight
                                            ? 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300'
                                            : 'bg-white/10 hover:bg-emerald-500/30 text-white border-white/25'
                                        }`}
                                      >
                                        {boardTfRevealed && expectedTrue ? '✓ ĐÚNG' : 'Đúng'}
                                      </button>
                                      <button
                                        type="button"
                                        disabled={boardTfRevealed}
                                        onClick={() => handleBoardTfSelect(sIdx, false)}
                                        className={`px-4 py-2.5 rounded-xl font-black text-sm border-2 transition-all cursor-pointer active:scale-95 ${
                                          boardTfRevealed
                                            ? !expectedTrue
                                              ? 'bg-amber-400 text-slate-950 border-amber-200 shadow-md'
                                              : chosen === false
                                              ? 'bg-rose-500 text-white border-rose-200'
                                              : 'opacity-40 bg-slate-800/40 border-white/15'
                                            : chosen === false
                                            ? 'bg-rose-500 text-white border-rose-200 shadow-md scale-105'
                                            : currentBoardTheme.isLight
                                            ? 'bg-white hover:bg-rose-50 text-rose-700 border-rose-300'
                                            : 'bg-white/10 hover:bg-rose-500/30 text-white border-white/25'
                                        }`}
                                      >
                                        {boardTfRevealed && !expectedTrue ? '✗ SAI' : 'Sai'}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {!boardTfRevealed && (
                              <div className="flex items-center justify-center pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleBoardTfReveal(rawSubStatements)}
                                  className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-base flex items-center gap-2.5 shadow-xl active:scale-95 transition-all cursor-pointer"
                                >
                                  <CheckCircle2 className="w-5 h-5" />
                                  <span>Kiểm Tra &amp; Công Bố Đáp Án Đúng/Sai</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (isShortAnswerQ) {
                        return (
                          <div className={`p-6 rounded-3xl border-2 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 ${currentBoardTheme.questionCardClass}`}>
                            <div className="space-y-1">
                              <div className={`text-sm font-black uppercase tracking-wider ${currentBoardTheme.questionBadgeClass} inline-block px-3 py-1 rounded-xl`}>
                                Câu Trắc Nghiệm Trả Lời Ngắn
                              </div>
                              <p
                                className={`font-semibold ${currentBoardTheme.questionTextClass}`}
                                style={{
                                  fontFamily: currentBoardFont.cssFamily,
                                  fontSize: `${boardOptionFontSize}px`,
                                }}
                              >
                                {boardShortAnswerRevealed
                                  ? 'Đáp số chính xác của bài toán:'
                                  : 'Mời học sinh trình bày cách giải và đọc đáp số ngắn gọn.'}
                              </p>
                            </div>

                            {boardShortAnswerRevealed ? (
                              <div
                                className="px-7 py-3.5 rounded-2xl bg-emerald-500 text-slate-950 font-mono font-black shadow-xl border-2 border-emerald-200 tabular-nums"
                                style={{ fontSize: `${boardShortAnswerFontSize}px` }}
                              >
                                {currentQ.shortAnswerKey || currentQ.correctAnswer || 'Chưa cung cấp'}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  unlockWebAudio();
                                  setBoardShortAnswerRevealed(true);
                                  gameSounds.playCorrectChime();
                                }}
                                className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-base flex items-center gap-2 shadow-xl active:scale-95 transition-all cursor-pointer"
                              >
                                <CheckCircle2 className="w-5 h-5" />
                                <span>Hiện Đáp Án &amp; Lời Giải</span>
                              </button>
                            )}
                          </div>
                        );
                      }

                      if (isEssayQ) {
                        return (
                          <div className={`p-6 rounded-3xl border-2 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0 ${currentBoardTheme.questionCardClass}`}>
                            <div
                              className={`font-semibold ${currentBoardTheme.questionTextClass}`}
                              style={{
                                fontFamily: currentBoardFont.cssFamily,
                                fontSize: `${boardOptionFontSize}px`,
                              }}
                            >
                              {currentQ.essayRubric ? (
                                <MathFormulaRenderer content={currentQ.essayRubric} />
                              ) : (
                                'Câu hỏi tự luận: Giáo viên hướng dẫn học sinh trình bày các bước giải trên bảng.'
                              )}
                            </div>
                            {!boardShortAnswerRevealed && (
                              <button
                                type="button"
                                onClick={() => {
                                  unlockWebAudio();
                                  setBoardShortAnswerRevealed(true);
                                  gameSounds.playCorrectChime();
                                }}
                                className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm shrink-0 cursor-pointer shadow-lg"
                              >
                                Xem Hướng Dẫn Chấm
                              </button>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div className={`grid grid-cols-1 ${boardLayout === 'split' ? 'gap-3.5' : 'md:grid-cols-2 gap-4'} shrink-0`}>
                          {currentQ.options.map((opt) => {
                            const isSelected = boardSelectedOption === opt.key;
                            const isCorrect = opt.key === currentQ.correctAnswer;
                            const hasAnswered = boardAnswerResult !== null;

                            let cardClass = currentBoardTheme.optionDefaultClass;
                            let badgeClass = currentBoardTheme.optionBadgeClass;
                            let optTextClass = currentBoardTheme.optionTextClass;

                            if (hasAnswered) {
                              if (isSelected) {
                                if (isCorrect) {
                                  cardClass =
                                    'bg-emerald-700 border-2 border-emerald-300 text-white ring-2 ring-emerald-300/40 shadow-xl scale-[1.01]';
                                  badgeClass = 'bg-emerald-300 text-slate-950 font-black border-emerald-200';
                                  optTextClass = 'text-white';
                                } else {
                                  cardClass =
                                    'bg-rose-800 border-2 border-rose-300 text-white ring-2 ring-rose-300/40 shadow-lg';
                                  badgeClass = 'bg-rose-300 text-slate-950 font-black border-rose-200';
                                  optTextClass = 'text-white';
                                }
                              } else if (isCorrect) {
                                cardClass =
                                  'bg-emerald-900/90 border-2 border-emerald-300 border-dashed text-emerald-50';
                                badgeClass = 'bg-emerald-400 text-slate-950 font-black border-emerald-300';
                                optTextClass = 'text-white';
                              } else {
                                cardClass = currentBoardTheme.optionDimmedClass;
                                badgeClass = currentBoardTheme.optionDimmedBadgeClass;
                              }
                            }

                            return (
                              <button
                                key={opt.key}
                                type="button"
                                onClick={() => handleBoardOptionClick(opt.key)}
                                disabled={hasAnswered}
                                className={`p-4 md:p-5 rounded-2xl border-2 transition-all duration-150 flex items-center gap-4 text-left cursor-pointer active:scale-[0.985] select-none relative group min-h-[64px] md:min-h-[72px] ${cardClass}`}
                              >
                                <div
                                  className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center font-black text-lg shrink-0 border transition-all shadow-sm ${badgeClass}`}
                                >
                                  {opt.key}
                                </div>
                                <div
                                  className={`flex-1 font-bold leading-snug ${optTextClass}`}
                                  style={{
                                    fontFamily: currentBoardFont.cssFamily,
                                    fontSize: `${boardOptionFontSize}px`,
                                  }}
                                >
                                  <MathFormulaRenderer content={opt.text} />
                                </div>

                                {hasAnswered && isSelected && isCorrect && (
                                  <div className="p-1.5 px-3 rounded-xl bg-emerald-300 text-slate-950 font-black flex items-center gap-1 shadow-md text-xs shrink-0">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>ĐÚNG</span>
                                  </div>
                                )}

                                {hasAnswered && isSelected && !isCorrect && (
                                  <div className="p-1.5 px-3 rounded-xl bg-rose-300 text-slate-950 font-black flex items-center gap-1 shadow-md text-xs shrink-0">
                                    <X className="w-4 h-4" />
                                    <span>CHƯA ĐÚNG</span>
                                  </div>
                                )}

                                {hasAnswered && !isSelected && isCorrect && (
                                  <div className="p-1.5 px-3 rounded-xl bg-emerald-400 text-slate-950 font-black flex items-center gap-1 shadow-md text-xs shrink-0">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>ĐÁP ÁN ĐÚNG</span>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* 3. Celebration / Encouragement Feedback Card */}
                    {boardAnswerResult === 'correct' && (
                      <div className="p-5 md:p-6 rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-green-700 text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 border-2 border-emerald-300 animate-fade-in">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-3xl shadow-inner shrink-0">
                            🎉
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-xl md:text-2xl font-black text-white tracking-wide">
                                CHÍNH XÁC! XUẤT SẮC!
                              </h3>
                              <Award className="w-7 h-7 text-amber-300" />
                            </div>
                            <p className="text-emerald-50 text-base md:text-lg font-bold mt-1 leading-relaxed">
                              {congratsMessage}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                          <button
                            onClick={() => {
                              confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
                              gameSounds.playVictoryFanfare();
                            }}
                            className="px-4 py-2.5 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-black text-xs md:text-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                          >
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            <span>Pháo Hoa</span>
                          </button>

                          <button
                            onClick={handleNextQuestion}
                            disabled={activeIndex >= questions.length - 1}
                            className="px-5 py-2.5 rounded-2xl bg-white text-emerald-900 hover:bg-emerald-50 font-black text-sm flex items-center gap-1.5 shadow-xl transition-all cursor-pointer active:scale-95 disabled:opacity-40"
                          >
                            <span>Câu Kế Tiếp</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {boardAnswerResult === 'wrong' && (
                      <div className="p-5 md:p-6 rounded-3xl bg-gradient-to-r from-amber-600 via-orange-600 to-rose-700 text-white shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 border-2 border-amber-300 animate-fade-in">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-3xl shadow-inner shrink-0">
                            💡
                          </div>
                          <div>
                            <h3 className="text-xl md:text-2xl font-black text-white tracking-wide">
                              CHƯA CHÍNH XÁC RỒI!
                            </h3>
                            <p className="text-amber-50 text-base md:text-lg font-bold mt-1 leading-relaxed">
                              {congratsMessage}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                          <button
                            onClick={resetBoardQuestionInteractions}
                            className="px-4 py-2.5 rounded-2xl bg-white/20 hover:bg-white/30 text-white font-black text-xs md:text-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                          >
                            <RotateCcw className="w-4 h-4 text-amber-200" />
                            <span>Thử Lại</span>
                          </button>

                          <button
                            onClick={handleNextQuestion}
                            disabled={activeIndex >= questions.length - 1}
                            className="px-5 py-2.5 rounded-2xl bg-white text-rose-900 hover:bg-rose-50 font-black text-sm flex items-center gap-1.5 shadow-xl transition-all cursor-pointer active:scale-95 disabled:opacity-40"
                          >
                            <span>Câu Kế Tiếp</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 4. Detailed Explanation Card when Answered */}
                    {(boardAnswerResult !== null || boardTfRevealed || boardShortAnswerRevealed) && currentQ.explanation && (
                      <div className={`p-5 md:p-6 rounded-3xl border-2 shadow-xl animate-fade-in ${currentBoardTheme.explanationCardClass}`}>
                        <div className={`flex items-center gap-2.5 pb-2.5 mb-2.5 border-b ${currentBoardTheme.explanationDividerClass}`}>
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                          <h4 className={`text-xs md:text-sm font-black uppercase tracking-wider ${currentBoardTheme.explanationTitleClass}`}>
                            HƯỚNG DẪN GIẢI CHI TIẾT &amp; BÀI HỌC KINH NGHIỆM
                          </h4>
                        </div>
                        <div
                          className={`font-medium leading-relaxed ${currentBoardTheme.explanationTextClass}`}
                          style={{
                            fontFamily: currentBoardFont.cssFamily,
                            fontSize: `${boardExplanationFontSize}px`,
                          }}
                        >
                          <MathFormulaRenderer content={currentQ.explanation} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Bottom Navigation & Question Picker */}
                <div className={`flex flex-wrap items-center justify-between pt-4 border-t gap-4 ${currentBoardTheme.bottomBarClass}`}>
                  {/* Prev Button */}
                  <button
                    onClick={handlePrevQuestion}
                    disabled={activeIndex <= 0}
                    className={`px-6 py-3 rounded-2xl font-bold text-sm flex items-center gap-2 border disabled:opacity-35 disabled:pointer-events-none transition-all cursor-pointer ${currentBoardTheme.prevBtnClass}`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span>Câu Trước</span>
                  </button>

                  {/* Question Index Pills */}
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    {questions.map((q, idx) => (
                      <button
                        key={q.id || idx}
                        onClick={() => {
                          setLocalActiveIndex(idx);
                          onControlRoom(idx, true);
                          resetBoardQuestionInteractions();
                        }}
                        className={`w-10 h-10 md:w-11 md:h-11 rounded-2xl font-black text-sm transition-all cursor-pointer flex items-center justify-center border tabular-nums ${
                          activeIndex === idx
                            ? `shadow-lg scale-110 ring-2 ${currentBoardTheme.pageActiveClass}`
                            : currentBoardTheme.pageInactiveClass
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={handleNextQuestion}
                    disabled={activeIndex >= questions.length - 1}
                    className={`px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-lg disabled:opacity-35 disabled:pointer-events-none transition-all cursor-pointer ${currentBoardTheme.nextBtnClass}`}
                  >
                    <span>Câu Kế Tiếp</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal Chọn Học Sinh Lên Bảng */}
      {showCallStudentModal && (
        <div className="fixed inset-0 z-[10050] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 md:p-8 max-w-lg w-full text-white shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-2xl">
                  🎒
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">Gọi Học Sinh Lên Bảng</h3>
                  <p className="text-xs text-slate-400">Chọn hoặc nhập tên học sinh lên bảng giải bài</p>
                </div>
              </div>
              <button
                onClick={() => setShowCallStudentModal(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Random Button */}
            <button
              onClick={handleCallRandomStudent}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
            >
              <Dice5 className="w-5 h-5 fill-slate-950" />
              <span>🎲 Quay Ngẫu Nhiên 1 Học Sinh Bất Kỳ</span>
            </button>

            {/* Manual input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400">Hoặc nhập trực tiếp tên học sinh:</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn An..."
                  value={studentCallManualInput}
                  onChange={(e) => setStudentCallManualInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && studentCallManualInput.trim()) {
                      const name = studentCallManualInput.trim();
                      setBoardSelectedStudent(name);
                      resetBoardQuestionInteractions();
                      setShowCallStudentModal(false);
                      setStudentCallManualInput('');
                      unlockWebAudio();
                      speakStudentCalling(name, 'call', [], { preset: selectedVoice });
                    }
                  }}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:border-amber-400 outline-hidden font-bold"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (studentCallManualInput.trim()) {
                      const name = studentCallManualInput.trim();
                      setBoardSelectedStudent(name);
                      resetBoardQuestionInteractions();
                      setShowCallStudentModal(false);
                      setStudentCallManualInput('');
                      unlockWebAudio();
                      speakStudentCalling(name, 'call', [], { preset: selectedVoice });
                    }
                  }}
                  disabled={!studentCallManualInput.trim()}
                  className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm disabled:opacity-40"
                >
                  Gọi Em Này
                </button>
              </div>
            </div>

            {/* Student list from class */}
            {/* Class Selector Dropdown */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">Tùy chọn lớp học của Thầy/Cô:</label>
                <span className="text-[11px] text-amber-400 font-bold font-mono">
                  {currentClassStudents.length} học sinh
                </span>
              </div>
              <select
                value={currentClassroom?.id || selectedCallingClassId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedCallingClassId(newId);
                  try {
                    localStorage.setItem('smartboard_active_class_id', newId);
                  } catch (_) {}
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border-2 border-slate-700 text-white font-bold text-xs focus:border-amber-400 outline-none cursor-pointer"
              >
                {teacherClasses.map((cls) => {
                  const count = (cls.students || []).length;
                  const rawName = cls.name || 'Lớp học';
                  const formattedName = rawName.toLowerCase().startsWith('lớp') ? rawName : `Lớp ${rawName}`;
                  return (
                    <option key={cls.id} value={cls.id}>
                      🏫 {formattedName} (Sĩ số: {count} em)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Student list from selected class */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-400">
                  Danh sách học sinh {currentClassroom?.name ? (currentClassroom.name.toLowerCase().startsWith('lớp') ? currentClassroom.name : `Lớp ${currentClassroom.name}`) : ''}:
                </label>
                <span className="text-[11px] text-slate-500">
                  (Bấm vào tên học sinh để chọn lên bảng)
                </span>
              </div>

              {currentClassStudents.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-800/60 border border-dashed border-slate-700 text-center space-y-2">
                  <p className="text-xs text-slate-400">Lớp này hiện chưa có danh sách học sinh.</p>
                  <p className="text-[11px] text-amber-400 font-medium">Thầy/Cô vui lòng chuyển sang tab "Lớp Học" để thêm học sinh hoặc nhập từ file Excel.</p>
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto grid grid-cols-2 gap-2 p-1 custom-scrollbar">
                  {currentClassStudents.map((st, stIdx: number) => (
                    <button
                      key={st.id || stIdx}
                      type="button"
                      onClick={() => {
                        setBoardSelectedStudent(st.name);
                        resetBoardQuestionInteractions();
                        setShowCallStudentModal(false);
                        unlockWebAudio();
                        speakStudentCalling(st.name, 'call', [], { preset: selectedVoice });
                      }}
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 hover:border-amber-400 border border-slate-700 text-left text-xs font-bold text-slate-200 truncate transition-all cursor-pointer flex items-center gap-2 group"
                      title={`Gọi em ${st.name} lên bảng`}
                    >
                      <span className="text-amber-400 group-hover:scale-110 transition-transform">
                        {st.avatar || (st.gender === 'female' ? '👩‍🎓' : '👨‍🎓')}
                      </span>
                      <span className="truncate">{st.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
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

      {/* Analytics Dashboard Mode */}
      {activeMode === 'analytics' && (
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-6">
          <AnalyticsDashboard
            lesson={currentLesson || { title: 'Bài giảng hiện tại', quizzes: questions }}
            roomState={roomState}
            onOpenExportModal={onOpenExportModal || (() => {})}
            onAskAIAboutResults={() => {}}
          />
        </div>
      )}

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

      {/* Modal 1: Lưu Bài Tập Trắc Nghiệm Vào Kho */}
      {showSaveQuizModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
          <div className="bg-slate-900 rounded-3xl w-full max-w-lg flex flex-col shadow-2xl border border-slate-700 overflow-hidden text-white">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-700 via-blue-700 to-indigo-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20">
                  <Save className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black tracking-tight">
                    Lưu Bài Tập Trắc Nghiệm Vào Kho
                  </h3>
                  <p className="text-xs text-indigo-200">
                    Lưu bài tập tạo sẵn tại nhà để mở nhanh khi đến lớp giảng dạy
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSaveQuizModal(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuizSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-1.5">
                  Tên Bộ Bài Tập Trắc Nghiệm: <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={saveQuizTitle}
                  onChange={(e) => setSaveQuizTitle(e.target.value)}
                  placeholder="Ví dụ: Ôn tập hàm số & đồ thị chuyên đề 12"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-1.5">
                    Môn Học:
                  </label>
                  <select
                    value={saveQuizSubject}
                    onChange={(e) => setSaveQuizSubject(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none"
                  >
                    <option value="Toán học">Toán học</option>
                    <option value="Vật lý">Vật lý</option>
                    <option value="Hóa học">Hóa học</option>
                    <option value="Sinh học">Sinh học</option>
                    <option value="Tiếng Anh">Tiếng Anh</option>
                    <option value="Lịch sử">Lịch sử</option>
                    <option value="Địa lý">Địa lý</option>
                    <option value="Ngữ văn">Ngữ văn</option>
                    <option value="Tin học">Tin học</option>
                    <option value="Công nghệ">Công nghệ</option>
                    <option value="GDCD">GDCD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-1.5">
                    Khối Lớp:
                  </label>
                  <select
                    value={saveQuizGrade}
                    onChange={(e) => setSaveQuizGrade(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white outline-none"
                  >
                    <option value="Lớp 10">Lớp 10</option>
                    <option value="Lớp 11">Lớp 11</option>
                    <option value="Lớp 12">Lớp 12</option>
                    <option value="Lớp 9">Lớp 9</option>
                    <option value="Lớp 8">Lớp 8</option>
                    <option value="Lớp 7">Lớp 7</option>
                    <option value="Lớp 6">Lớp 6</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
                <span>Số câu hỏi: <strong className="text-emerald-400 font-mono text-sm">{generatedQuestions.length > 0 ? generatedQuestions.length : questions.length} câu</strong></span>
                <span>Chế độ sẵn sàng: <strong className="text-amber-400">Trình chiếu & Thi trực tiếp</strong></span>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-300 uppercase tracking-wider mb-1.5">
                  Ghi Chú Sư Phạm (Tùy chọn):
                </label>
                <input
                  type="text"
                  value={saveQuizNotes}
                  onChange={(e) => setSaveQuizNotes(e.target.value)}
                  placeholder="Ghi chú tiết học, yêu cầu làm bài..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowSaveQuizModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
                >
                  <Save className="w-4 h-4" />
                  <span>Xác Nhận Lưu Bài Tập</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Kho Đề & Bài Tập Trắc Nghiệm Đã Lưu */}
      {showSavedQuizzesModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
          <div className="bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl border border-slate-700 overflow-hidden text-white">
            <div className="px-6 py-4 bg-gradient-to-r from-amber-600 via-orange-600 to-indigo-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20">
                  <FolderOpen className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black tracking-tight">
                    Kho Đề &amp; Bài Tập Trắc Nghiệm Đã Lưu ({savedQuizzesList.length} đề)
                  </h3>
                  <p className="text-xs text-amber-200">
                    Bấm &quot;Trình Chiếu Lên Bảng&quot; để chiếu câu hỏi cho học sinh lên bảng làm bài ngay trên Tivi 75 inch
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualSyncQuizzesFromCloud}
                  disabled={isSyncingSavedQuizzes}
                  className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 border border-white/20 transition-all cursor-pointer shadow-sm"
                  title="Đồng bộ ngay với Đám Mây để cập nhật các đề mới tạo trên máy tính hoặc điện thoại"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSavedQuizzes ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">{isSyncingSavedQuizzes ? 'Đang đồng bộ...' : 'Đồng Bộ Đám Mây'}</span>
                </button>
                <button
                  onClick={() => setShowSavedQuizzesModal(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="p-4 bg-slate-950/60 border-b border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={savedQuizSearch}
                  onChange={(e) => setSavedQuizSearch(e.target.value)}
                  placeholder="Tìm kiếm bài tập trắc nghiệm đã lưu theo tên đề, môn học, khối lớp..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3.5">
              {savedQuizzesList.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-300">Chưa có bài tập trắc nghiệm nào trong kho</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Thầy/Cô hãy tạo đề bằng AI hoặc nhập câu hỏi, sau đó bấm &quot;Lưu Bài Tập&quot; để lưu trữ dùng lâu dài!
                  </p>
                </div>
              ) : (
                savedQuizzesList
                  .filter((item) => {
                    if (!savedQuizSearch.trim()) return true;
                    const q = savedQuizSearch.toLowerCase();
                    return (
                      item.title.toLowerCase().includes(q) ||
                      (item.subject || '').toLowerCase().includes(q) ||
                      (item.grade || '').toLowerCase().includes(q)
                    );
                  })
                  .map((item) => (
                    <div
                      key={item.id}
                      className="p-4 md:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
                    >
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0 font-black text-lg">
                          📝
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-black text-[10px] uppercase border border-indigo-500/30">
                              {item.subject}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-bold text-[10px]">
                              {item.grade}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px]">
                              {item.questionCount || item.questions.length} câu hỏi
                            </span>
                          </div>
                          <h4 className="text-sm md:text-base font-black text-white truncate">
                            {item.title}
                          </h4>
                          {item.notes && (
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Quick 1-Click Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap self-end md:self-center">
                        <button
                          onClick={(e) => handleDeleteSavedQuiz(item.id, e)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                          title="Xóa đề này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleLaunchSavedQuizCreator(item)}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Mở đề này trong mục soạn thảo để sửa đổi"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="hidden sm:inline">Soạn lại</span>
                        </button>

                        <button
                          onClick={() => handleLaunchSavedQuizLive(item)}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-emerald-900/60 text-emerald-300 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Mở phòng thi đấu trực tiếp cho học sinh làm qua điện thoại"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Thi Đấu</span>
                        </button>

                        {/* Button Đinh: Trình Chiếu Lên Bảng Cho Học Sinh Làm Ngay! */}
                        <button
                          onClick={() => handleLaunchSavedQuizPresentation(item)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
                          title="Trình chiếu câu hỏi lên màn hình 75 inch và gọi học sinh lên bảng làm trực tiếp"
                        >
                          <Tv className="w-4 h-4 text-slate-950" />
                          <span>Trình Chiếu Lên Bảng!</span>
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Quiz Toast Notification */}
      {quizToast && (
        <div className="absolute bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs md:text-sm shadow-2xl flex items-center gap-2.5 border border-emerald-400 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-amber-300 shrink-0" />
          <span>{quizToast}</span>
        </div>
      )}
    </div>
  );
};
