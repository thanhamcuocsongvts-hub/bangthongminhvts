import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Sparkles,
  Layers,
  CheckSquare,
  Search,
  Edit3,
  Save,
  Download,
  ExternalLink,
  Eye,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  RotateCw,
  HelpCircle,
  Zap,
  BookmarkCheck,
  FileText,
  FileCode,
  Check,
  Send,
  Printer,
  Maximize2,
  Minimize2,
  ArrowRight,
  ListOrdered,
  Sigma,
  Trash2,
  Compass,
  FolderOpen,
  Upload,
  X,
  FileUp,
  BookmarkPlus,
} from 'lucide-react';
import { LessonDoc, TextScale, ExtractedDocSummary, SlideItem, QuizQuestion } from '../types';
import { exportLessonToWord } from '../utils/exportUtils';
import { cleanDocumentText, parseUploadedFileToLesson } from '../utils/fileParser';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { UniversalDocumentViewer } from './UniversalDocumentViewer';
import { ScopeConstraintModal, ScopeActionType } from './ScopeConstraintModal';

interface DocumentReaderViewProps {
  lesson: LessonDoc;
  textScale: TextScale;
  onUpdateLesson: (updated: LessonDoc) => void;
  onDeleteLesson?: (id: string) => void;
  onLaunchSlides: () => void;
  onLaunchQuiz: () => void;
  onSendToAIChat: (prompt: string) => void;
  allLessons?: LessonDoc[];
  onSelectLesson?: (lesson: LessonDoc) => void;
  onAddNewLesson?: (lesson: LessonDoc) => void;
  onOpenTemporaryLesson?: (lesson: LessonDoc) => void;
  onSaveToLibrary?: (lesson: LessonDoc) => void;
  isSavedInLibrary?: boolean;
}

export const DocumentReaderView: React.FC<DocumentReaderViewProps> = ({
  lesson,
  textScale,
  onUpdateLesson,
  onDeleteLesson,
  onLaunchSlides,
  onLaunchQuiz,
  onSendToAIChat,
  allLessons = [],
  onSelectLesson,
  onAddNewLesson,
  onOpenTemporaryLesson,
  onSaveToLibrary,
  isSavedInLibrary = false,
}) => {
  // Always default to 'original' viewer if fileUrl is available or it's a PDF/Image/Doc/XLSX
  const [activeViewMode, setActiveViewMode] = useState<'original' | 'extracted' | 'notes'>('original');
  
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [pdfZoom, setPdfZoom] = useState<number>(100);
  const [pdfRotation, setPdfRotation] = useState<number>(0);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Open file modal states
  const [showOpenFileModal, setShowOpenFileModal] = useState<boolean>(false);
  const [showDeleteDocModal, setShowDeleteDocModal] = useState<boolean>(false);
  const [fileSearchTerm, setFileSearchTerm] = useState<string>('');
  const [isUploadingNew, setIsUploadingNew] = useState<boolean>(false);
  const [savedToast, setSavedToast] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // On-Demand AI Extraction States
  const [isExtractingFormulas, setIsExtractingFormulas] = useState<boolean>(false);
  const [isExtractingSummary, setIsExtractingSummary] = useState<boolean>(false);
  const [isConvertingSlides, setIsConvertingSlides] = useState<boolean>(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState<boolean>(false);
  const [isAskingAI, setIsAskingAI] = useState<boolean>(false);
  const [customAIQuery, setCustomAIQuery] = useState<string>('');

  // Extracted Results
  const [extractedFormulas, setExtractedFormulas] = useState<any[]>([]);
  const [extractedSummary, setExtractedSummary] = useState<any>(lesson.extractedSummary || null);
  const [aiAnswers, setAiAnswers] = useState<Array<{ q: string; a: string; time: string }>>([]);

  // Scope Constraint State for Targeted AI Execution
  const [scopeModalAction, setScopeModalAction] = useState<ScopeActionType | null>(null);
  const [appliedScope, setAppliedScope] = useState<string>('');

  // Notes & Draft
  const [notesDraft, setNotesDraft] = useState<string>(
    cleanDocumentText(lesson.rawText) || `Ghi chú bài giảng: ${lesson.title}`
  );

  // Safe display text free from raw binary
  const displaySafeText = cleanDocumentText(lesson.rawText) ||
    `Tài liệu: ${lesson.title}\nLoại tệp: ${lesson.fileType?.toUpperCase() || 'Tài liệu'} (${lesson.fileSize || 'Sẵn sàng'})\nĐã sẵn sàng hiển thị trực tiếp trên SmartBoard 75 Pro.`;

  useEffect(() => {
    setNotesDraft(cleanDocumentText(lesson.rawText) || `Ghi chú bài giảng: ${lesson.title}`);
  }, [lesson.id, lesson.rawText]);

  // Scale map for 75" SmartBoard
  const scaleClasses = {
    normal: 'text-base leading-relaxed',
    large: 'text-lg md:text-xl leading-loose',
    huge: 'text-xl md:text-2xl leading-loose',
  };

  // 1. ON-DEMAND AI: Extract Formulas & Theorems with Scope
  const handleExtractFormulas = async (scopeConstraint?: string) => {
    try {
      setIsExtractingFormulas(true);
      if (scopeConstraint) setAppliedScope(scopeConstraint);
      const res = await fetch('/api/ai/extract-specific', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'formulas',
          title: lesson.title,
          content: displaySafeText,
          scopeConstraint: scopeConstraint || undefined,
        }),
      });

      const data = await res.json();
      if (data.items && Array.isArray(data.items)) {
        setExtractedFormulas(data.items);
        setActiveViewMode('extracted');
      }
    } catch (e: any) {
      alert('Không thể trích xuất công thức: ' + (e.message || 'Thử lại sau'));
    } finally {
      setIsExtractingFormulas(false);
    }
  };

  // 2. ON-DEMAND AI: Extract 2-Min Summary with Scope
  const handleExtractSummary = async (scopeConstraint?: string) => {
    try {
      setIsExtractingSummary(true);
      if (scopeConstraint) setAppliedScope(scopeConstraint);
      const res = await fetch('/api/ai/extract-specific', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'summary',
          title: lesson.title,
          content: displaySafeText,
          scopeConstraint: scopeConstraint || undefined,
        }),
      });

      const data = await res.json();
      setExtractedSummary(data);
      setActiveViewMode('extracted');
    } catch (e: any) {
      alert('Không thể tóm tắt: ' + (e.message || 'Thử lại sau'));
    } finally {
      setIsExtractingSummary(false);
    }
  };

  // 3. ON-DEMAND AI: Convert Document to Slides with Scope & Count
  const handleConvertDocToSlides = async (scopeConstraint?: string, count?: number) => {
    try {
      setIsConvertingSlides(true);
      if (scopeConstraint) setAppliedScope(scopeConstraint);
      const res = await fetch('/api/ai/doc-to-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: lesson.title,
          content: displaySafeText,
          subject: lesson.subject,
          count: count || 5,
          scopeConstraint: scopeConstraint || undefined,
        }),
      });

      const data = await res.json();
      const newSlides: SlideItem[] = data.slides || [];

      if (newSlides.length > 0) {
        onUpdateLesson({
          ...lesson,
          slides: newSlides,
          lastModified: new Date().toISOString(),
        });
        onLaunchSlides();
      }
    } catch (e) {
      alert('Không thể chuyển đổi slide tự động.');
    } finally {
      setIsConvertingSlides(false);
    }
  };

  // 4. ON-DEMAND AI: Generate Instant Quiz with Scope & Count
  const handleGenerateInstantQuiz = async (scopeConstraint?: string, count?: number) => {
    try {
      setIsGeneratingQuiz(true);
      if (scopeConstraint) setAppliedScope(scopeConstraint);
      const res = await fetch('/api/ai/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: displaySafeText,
          topic: lesson.title,
          subject: lesson.subject,
          count: count || 5,
          scopeConstraint: scopeConstraint || undefined,
        }),
      });

      const data = await res.json();
      const newQuizzes: QuizQuestion[] = data.questions || [];

      if (newQuizzes.length > 0) {
        onUpdateLesson({
          ...lesson,
          quizzes: newQuizzes,
          lastModified: new Date().toISOString(),
        });
        onLaunchQuiz();
      }
    } catch (e) {
      alert('Không thể tạo bộ câu hỏi trắc nghiệm tự động.');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  // Handle confirm from Scope Constraint Modal
  const handleScopeConfirm = (scopeConstraint: string, count?: number) => {
    const action = scopeModalAction;
    setScopeModalAction(null);
    if (action === 'formulas') {
      handleExtractFormulas(scopeConstraint);
    } else if (action === 'summary') {
      handleExtractSummary(scopeConstraint);
    } else if (action === 'slides') {
      handleConvertDocToSlides(scopeConstraint, count);
    } else if (action === 'quiz') {
      handleGenerateInstantQuiz(scopeConstraint, count);
    }
  };

  // 5. ON-DEMAND AI: Ask specific question on this document
  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAIQuery.trim() || isAskingAI) return;

    const q = customAIQuery.trim();
    setCustomAIQuery('');
    try {
      setIsAskingAI(true);
      const res = await fetch('/api/ai/extract-specific', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'custom',
          customQuery: q,
          title: lesson.title,
          content: displaySafeText,
        }),
      });

      const data = await res.json();
      setAiAnswers((prev) => [
        { q, a: data.answer || 'Đã phân tích xong câu hỏi của Thầy/Cô.', time: 'Vừa xong' },
        ...prev,
      ]);
      setActiveViewMode('extracted');
    } catch (err: any) {
      alert('Lỗi tra cứu: ' + (err.message || 'Thử lại sau'));
    } finally {
      setIsAskingAI(false);
    }
  };

  // Save edited notes
  const handleSaveNotes = () => {
    onUpdateLesson({
      ...lesson,
      rawText: notesDraft,
      lastModified: new Date().toISOString(),
    });
    alert('Đã lưu ghi chú bài giảng thành công!');
  };

  // Text-to-Speech
  const handleToggleSpeak = () => {
    if (!('speechSynthesis' in window)) {
      alert('Trình duyệt không hỗ trợ đọc giọng nói.');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      window.speechSynthesis.cancel();
      const textToRead = notesDraft.slice(0, 1000);
      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.lang = 'vi-VN';
      utterance.rate = 0.95;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  return (
    <div
      id="doc-reader-viewport"
      className="relative w-full h-[calc(100vh-100px)] flex flex-col bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-md p-4 md:p-6 space-y-4"
    >
      {savedToast && (
        <div className="absolute top-4 right-4 z-50 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 animate-fade-in border border-emerald-400">
          <Check className="w-4 h-4" />
          <span>Đã lưu tài liệu vào Kho Bài Giảng thành công!</span>
        </div>
      )}
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-indigo-600 tracking-wider">
                TRÌNH ĐỌC & TRÍCH XUẤT TÀI LIỆU
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold">
                {lesson.fileType ? lesson.fileType.toUpperCase() : 'TÀI LIỆU'} • {lesson.fileSize || 'Sẵn sàng'}
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 truncate max-w-xl">
              {lesson.title}
            </h1>
          </div>
        </div>

        {/* Quick Launch Buttons */}
        <div className="flex items-center gap-2">
          {/* Save to library button if viewing temporary file */}
          {onSaveToLibrary && lesson && (
            isSavedInLibrary ? (
              <span className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-bold flex items-center gap-1.5 shadow-xs">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Đã Có Trong Kho</span>
              </span>
            ) : (
              <button
                onClick={() => {
                  onSaveToLibrary(lesson);
                  setSavedToast(true);
                  setTimeout(() => setSavedToast(false), 3500);
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                title="Lưu tài liệu đang mở này vào Kho Bài Giảng"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>Lưu Vào Kho Bài Giảng</span>
              </button>
            )
          )}

          {/* Open other file button */}
          <button
            onClick={() => setShowOpenFileModal(true)}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            title="Mở tài liệu Word, PDF, PowerPoint, Excel khác từ máy tính hoặc Kho bài giảng"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Mở File Khác</span>
          </button>

          {lesson.slides && lesson.slides.length > 0 && (
            <button
              onClick={onLaunchSlides}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Layers className="w-4 h-4" />
              <span>Chiếu Slide ({lesson.slides.length})</span>
            </button>
          )}

          {lesson.quizzes && lesson.quizzes.length > 0 && (
            <button
              onClick={onLaunchQuiz}
              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <CheckSquare className="w-4 h-4" />
              <span>Thi Trắc Nghiệm ({lesson.quizzes.length})</span>
            </button>
          )}

          {onDeleteLesson && (
            <button
              type="button"
              onClick={() => setShowDeleteDocModal(true)}
              className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 border border-rose-200 transition-all shadow-xs cursor-pointer active:scale-95"
              title="Xóa tài liệu này khỏi hệ thống"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span className="hidden sm:inline">Xóa Tài Liệu</span>
            </button>
          )}

          <button
            onClick={() => exportLessonToWord(lesson)}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
            title="Tải về tệp Word"
          >
            <Download className="w-4 h-4 text-indigo-600" />
            <span className="hidden sm:inline">Xuất Word</span>
          </button>
        </div>
      </div>

      {/* Main Mode Switcher + On-Demand Extraction Quick Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
        {/* Left: View Modes */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveViewMode('original')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeViewMode === 'original'
                ? 'bg-indigo-600 text-white shadow-md font-extrabold'
                : 'text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>1. Xem Tài Liệu Gốc ({lesson.fileType?.toUpperCase() || 'Tệp'})</span>
          </button>

          <button
            onClick={() => setActiveViewMode('extracted')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeViewMode === 'extracted'
                ? 'bg-indigo-600 text-white shadow-md font-extrabold'
                : 'text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>2. Trích Xuất AI & Tra Cứu</span>
          </button>

          <button
            onClick={() => setActiveViewMode('notes')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              activeViewMode === 'notes'
                ? 'bg-indigo-600 text-white shadow-md font-extrabold'
                : 'text-slate-700 hover:bg-slate-200/60'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>3. Ghi Chú Giáo Án</span>
          </button>
        </div>

        {/* Right: On-Demand Actions Bar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setScopeModalAction('formulas')}
            disabled={isExtractingFormulas}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-indigo-400 text-slate-800 text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:bg-indigo-50/50 cursor-pointer"
            title="Trích xuất các định lý, công thức theo phạm vi kiến thức"
          >
            <Sigma className={`w-3.5 h-3.5 text-indigo-600 ${isExtractingFormulas ? 'animate-spin' : ''}`} />
            <span>{isExtractingFormulas ? 'Đang trích xuất...' : 'Trích Xuất Công Thức'}</span>
          </button>

          <button
            onClick={() => setScopeModalAction('summary')}
            disabled={isExtractingSummary}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-indigo-400 text-slate-800 text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:bg-indigo-50/50 cursor-pointer"
            title="Tóm tắt ngắn gọn theo phạm vi kiến thức"
          >
            <BookmarkCheck className={`w-3.5 h-3.5 text-emerald-600 ${isExtractingSummary ? 'animate-spin' : ''}`} />
            <span>{isExtractingSummary ? 'Đang tóm tắt...' : 'Tóm Tắt 2 Phút'}</span>
          </button>

          <button
            onClick={() => setScopeModalAction('slides')}
            disabled={isConvertingSlides}
            className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 hover:bg-purple-100 text-purple-800 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Tạo các slide giảng dạy theo phạm vi kiến thức yêu cầu"
          >
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>{isConvertingSlides ? 'Đang tạo...' : 'Tạo Slide'}</span>
          </button>

          <button
            onClick={() => setScopeModalAction('quiz')}
            disabled={isGeneratingQuiz}
            className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Tạo bộ câu hỏi trắc nghiệm theo phạm vi kiến thức yêu cầu"
          >
            <CheckSquare className="w-3.5 h-3.5 text-amber-600" />
            <span>{isGeneratingQuiz ? 'Đang ra đề...' : 'Tạo Trắc Nghiệm'}</span>
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: NATIVE UNIVERSAL DOCUMENT VIEWER (PDF / WORD / EXCEL / IMAGE / PPTX) */}
      {activeViewMode === 'original' && (
        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-slate-300 shadow-inner relative">
          <UniversalDocumentViewer
            lesson={lesson}
            onLaunchSlides={onLaunchSlides}
            onLaunchQuiz={onLaunchQuiz}
            onOpenFile={() => setShowOpenFileModal(true)}
          />
        </div>
      )}

      {/* VIEW MODE 2: ON-DEMAND AI EXTRACTIONS & QUERY ASSISTANT */}
      {activeViewMode === 'extracted' && (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Ask AI Input Box */}
          <form
            onSubmit={handleAskQuestion}
            className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 shadow-xs flex items-center gap-2"
          >
            <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
            <input
              type="text"
              value={customAIQuery}
              onChange={(e) => setCustomAIQuery(e.target.value)}
              placeholder="Hỏi AI bất kỳ điều gì về tài liệu này (Ví dụ: 'Giải thích định lý Lagrange', 'Tìm công thức tính diện tích')..."
              className="flex-1 px-3 py-2 rounded-xl bg-white border border-indigo-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs font-medium"
            />
            <button
              type="submit"
              disabled={isAskingAI || !customAIQuery.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isAskingAI ? 'Đang hỏi...' : 'Hỏi AI'}</span>
            </button>
          </form>

          {/* Active Scope Badge */}
          {appliedScope && (
            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  <span className="font-bold text-slate-600 uppercase text-[10px] block">Phạm vi kiến thức giới hạn đã yêu cầu:</span>
                  <span className="font-black text-indigo-900">{appliedScope}</span>
                </span>
              </div>
              <button
                onClick={() => setAppliedScope('')}
                className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-500 hover:bg-indigo-100 hover:text-slate-800 transition-colors"
              >
                Đặt lại phạm vi
              </button>
            </div>
          )}

          {/* AI Answers History */}
          {aiAnswers.length > 0 && (
            <div className="space-y-3">
              <span className="text-xs font-black uppercase text-indigo-700 tracking-wider">
                KẾT QUẢ GIẢI ĐÁP & TRA CỨU TÀI LIỆU:
              </span>
              {aiAnswers.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-white border border-indigo-200 shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between text-xs font-black text-slate-800">
                    <span className="flex items-center gap-1.5 text-indigo-700">
                      <HelpCircle className="w-4 h-4" />
                      <span>{item.q}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{item.time}</span>
                  </div>
                  <div className="text-sm text-slate-700 leading-relaxed font-medium pl-2 border-l-2 border-indigo-400">
                    <MathFormulaRenderer content={item.a} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Extracted Formulas Grid */}
          {extractedFormulas.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-emerald-700 tracking-wider flex items-center gap-1.5">
                  <Sigma className="w-4 h-4" />
                  <span>CÔNG THỨC & ĐỊNH LÝ TRÍCH XUẤT ({extractedFormulas.length})</span>
                </span>
                <button
                  onClick={() => setExtractedFormulas([])}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  Xóa
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {extractedFormulas.map((item, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-2xs space-y-2 hover:border-emerald-400 transition-all"
                  >
                    <h4 className="font-black text-slate-900 text-sm">{item.name}</h4>
                    {item.formula && (
                      <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-center font-mono font-bold text-sm">
                        <MathFormulaRenderer content={item.formula} isBlock />
                      </div>
                    )}
                    {item.description && (
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        {item.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted Summary Panel */}
          {extractedSummary && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-indigo-200">
                <span className="text-xs font-black uppercase text-indigo-700 tracking-wider flex items-center gap-1.5">
                  <BookmarkCheck className="w-4 h-4 text-indigo-600" />
                  <span>TÓM TẮT TRỌNG TÂM BÀI HỌC</span>
                </span>
                <button
                  onClick={() => setExtractedSummary(null)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold"
                >
                  Ẩn
                </button>
              </div>

              {extractedSummary.summary && (
                <p className="text-sm text-slate-800 font-semibold leading-relaxed">
                  {extractedSummary.summary}
                </p>
              )}

              {extractedSummary.keyTakeaways && extractedSummary.keyTakeaways.length > 0 && (
                <ul className="space-y-1.5 pl-2">
                  {extractedSummary.keyTakeaways.map((k: string, i: number) => (
                    <li key={i} className="text-xs text-slate-700 font-medium flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                      <span>{k}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* If no extraction yet */}
          {extractedFormulas.length === 0 && !extractedSummary && aiAnswers.length === 0 && (
            <div className="p-12 text-center text-slate-400 space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <Sparkles className="w-10 h-10 mx-auto text-indigo-500 opacity-60" />
              <h3 className="text-sm font-black text-slate-700">Trích Xuất AI Theo Yêu Cầu Của Thầy/Cô</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Hệ thống không tự động ép phân tích toàn bộ tài liệu để tiết kiệm thời gian. Hãy bấm nút <b>"Trích Xuất Công Thức"</b>, <b>"Tóm Tắt 2 Phút"</b>, hoặc đặt câu hỏi bất kỳ ở thanh trên khi cần.
              </p>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 3: NOTES & EDITABLE CONTENT */}
      {activeViewMode === 'notes' && (
        <div className="flex-1 flex flex-col space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-700">
              Ghi Chú & Biên Soạn Nội Dung Giảng Dạy:
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleSpeak}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all ${
                  isSpeaking ? 'bg-rose-500 text-white' : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-indigo-600" />}
                <span>{isSpeaking ? 'Dừng Đọc' : 'Đọc To'}</span>
              </button>
              <button
                onClick={handleSaveNotes}
                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu Ghi Chú</span>
              </button>
            </div>
          </div>

          <textarea
            rows={16}
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            className="w-full flex-1 p-4 rounded-xl bg-white border border-slate-300 text-slate-900 font-sans text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
            placeholder="Nhập ghi chú sư phạm hoặc nội dung bài giảng..."
          />
        </div>
      )}

      {/* Scope Constraint Modal: Requirements for Slides, Formulas, Summary, Quiz */}
      {scopeModalAction && (
        <ScopeConstraintModal
          isOpen={true}
          onClose={() => setScopeModalAction(null)}
          actionType={scopeModalAction}
          documentTitle={lesson.title}
          subject={lesson.subject}
          onConfirm={handleScopeConfirm}
          isProcessing={
            isExtractingFormulas ||
            isExtractingSummary ||
            isConvertingSlides ||
            isGeneratingQuiz
          }
        />
      )}

      {/* OPEN FILE / SWITCH DOCUMENT MODAL FOR TEACHERS */}
      {showOpenFileModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Mở Tài Liệu Khác</h3>
                  <p className="text-xs text-slate-500">
                    Tải tệp mới từ máy tính / USB hoặc chọn từ danh sách bài giảng
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOpenFileModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
              {/* Option A: Upload New File */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Tải lên tệp mới từ Máy tính / USB
                </h4>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.doc,.pdf,.pptx,.ppt,.xlsx,.xls,image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIsUploadingNew(true);
                    try {
                      const newLesson = await parseUploadedFileToLesson(file);
                      if (onOpenTemporaryLesson) {
                        onOpenTemporaryLesson(newLesson);
                      } else {
                        if (onAddNewLesson) onAddNewLesson(newLesson);
                        if (onSelectLesson) onSelectLesson(newLesson);
                      }
                      setShowOpenFileModal(false);
                    } catch (err: any) {
                      alert('Không thể mở tệp: ' + (err.message || 'Vui lòng kiểm tra lại định dạng tệp'));
                    } finally {
                      setIsUploadingNew(false);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }
                  }}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-md flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                    {isUploadingNew ? (
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Upload className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-blue-700 block">
                      {isUploadingNew ? 'Đang đọc và giải mã tài liệu...' : 'Chạm để chọn tệp từ máy tính / USB'}
                    </span>
                    <span className="text-xs text-slate-500 mt-1 block">
                      Hỗ trợ Word (.docx, .doc), PDF (.pdf), PowerPoint (.pptx, .ppt), Excel (.xlsx), Hình ảnh
                    </span>
                  </div>
                </div>
              </div>

              {/* Option B: Existing Lessons List */}
              {allLessons.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Kho bài giảng có sẵn ({allLessons.length})
                    </h4>
                    <div className="relative w-48">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={fileSearchTerm}
                        onChange={(e) => setFileSearchTerm(e.target.value)}
                        placeholder="Tìm bài giảng..."
                        className="w-full pl-8 pr-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {allLessons
                      .filter((l) =>
                        !fileSearchTerm ||
                        l.title.toLowerCase().includes(fileSearchTerm.toLowerCase()) ||
                        l.subject?.toLowerCase().includes(fileSearchTerm.toLowerCase())
                      )
                      .map((l) => {
                        const isCurrent = l.id === lesson.id;
                        return (
                          <div
                            key={l.id}
                            onClick={() => {
                              if (onSelectLesson) onSelectLesson(l);
                              setShowOpenFileModal(false);
                            }}
                            className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                              isCurrent
                                ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400/30'
                                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shadow-2xs shrink-0 uppercase">
                                {l.fileType || 'DOC'}
                              </span>
                              <div className="min-w-0">
                                <h5 className="text-sm font-bold text-slate-900 truncate">
                                  {l.title}
                                </h5>
                                <p className="text-xs text-slate-500 truncate">
                                  {l.subject || 'Chung'} • {l.fileSize || 'Sẵn sàng'}
                                </p>
                              </div>
                            </div>
                            {isCurrent ? (
                              <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold">
                                Đang mở
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-blue-600 hover:underline">
                                Mở tệp
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setShowOpenFileModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận xóa tài liệu (Không dùng window.confirm) */}
      {showDeleteDocModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Xác Nhận Xóa Tài Liệu</h3>
                  <p className="text-xs text-slate-500">Gỡ bỏ tệp khỏi hệ thống</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteDocModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              Thầy/Cô có chắc chắn muốn xóa tài liệu <span className="font-bold text-slate-900">"{lesson.title}"</span> khỏi hệ thống không?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteDocModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-bold transition-all cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteDocModal(false);
                  if (onDeleteLesson) onDeleteLesson(lesson.id);
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-md shadow-rose-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác Nhận Xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
