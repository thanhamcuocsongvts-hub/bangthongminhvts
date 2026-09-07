import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Columns,
  Sparkles,
  PlayCircle,
  HelpCircle,
  BookOpen,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  FileText,
  Presentation as PresentationIcon,
  Pen,
  UploadCloud,
  FolderOpen,
  FileUp,
  Sigma,
  X,
  Loader2,
  FileCode,
  File,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { LessonDoc, SlideItem, TextScale } from '../types';
import { TouchWhiteboard } from './TouchWhiteboard';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { UniversalDocumentViewer } from './UniversalDocumentViewer';
import { ScopeConstraintModal, ScopeActionType } from './ScopeConstraintModal';
import { parseUploadedFileToLesson } from '../utils/fileParser';

interface PresentationViewProps {
  lesson: LessonDoc;
  allLessons?: LessonDoc[];
  textScale: TextScale;
  onSelectLesson?: (lesson: LessonDoc) => void;
  onAddLesson?: (lesson: LessonDoc) => void;
  onUpdateLesson?: (lesson: LessonDoc) => void;
  onLaunchQuiz: () => void;
  onAskAIAboutSlide: (slide: SlideItem) => void;
  onOpenExportModal: () => void;
}

export const PresentationView: React.FC<PresentationViewProps> = ({
  lesson,
  allLessons = [],
  textScale,
  onSelectLesson,
  onAddLesson,
  onUpdateLesson,
  onLaunchQuiz,
  onAskAIAboutSlide,
  onOpenExportModal,
}) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isSplitMode, setIsSplitMode] = useState<boolean>(false);
  const [isOverlayAnnotation, setIsOverlayAnnotation] = useState<boolean>(false);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [whiteboardTheme, setWhiteboardTheme] = useState<'blackboard' | 'slate' | 'graph' | 'white'>('blackboard');
  const [presentationMode, setPresentationMode] = useState<'original' | 'slides'>('original');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // File Upload states
  const [isUploadingFile, setIsUploadingFile] = useState<boolean>(false);
  const [uploadToast, setUploadToast] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [showDocPicker, setShowDocPicker] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Scope Constraint Modal states
  const [isScopeModalOpen, setIsScopeModalOpen] = useState<boolean>(false);
  const [scopeModalAction, setScopeModalAction] = useState<ScopeActionType>('slides');
  const [isAIProcessing, setIsAIProcessing] = useState<boolean>(false);

  // Extracted Formulas preview drawer/modal
  const [extractedFormulasData, setExtractedFormulasData] = useState<any | null>(null);

  // Listen to browser native fullscreen change events
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Keyboard shortcut support: 'B' or 'P' enables pen; 'Esc' closes overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'b' || e.key === 'B' || e.key === 'p' || e.key === 'P') {
        setIsOverlayAnnotation(true);
        if (isSplitMode) setIsSplitMode(false);
      } else if (e.key === 'Escape' && isOverlayAnnotation) {
        setIsOverlayAnnotation(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOverlayAnnotation, isSplitMode]);

  const togglePresentationFullscreen = () => {
    const el = document.getElementById('presentation-viewport');
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Process uploaded document file
  const processUploadedFile = async (file: File) => {
    setIsUploadingFile(true);
    setUploadToast(`Đang nạp tệp "${file.name}" cho màn hình trình chiếu...`);
    try {
      const newDoc = await parseUploadedFileToLesson(file);
      onAddLesson?.(newDoc);
      onSelectLesson?.(newDoc);
      setCurrentSlideIndex(0);
      setPresentationMode(newDoc.slides && newDoc.slides.length > 0 ? 'slides' : 'original');
      setUploadToast(`Đã nạp thành công bài giảng "${newDoc.title}"!`);
      setTimeout(() => setUploadToast(null), 3500);
    } catch (err: any) {
      console.error('Error parsing presentation file:', err);
      alert(`Không thể đọc tệp "${file.name}": ${err.message || 'Lỗi định dạng tệp'}`);
      setUploadToast(null);
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  // AI Scope Constraint Handling: Create Slides or Extract Formulas
  const handleOpenScopeModal = (action: ScopeActionType) => {
    setScopeModalAction(action);
    setIsScopeModalOpen(true);
  };

  const handleScopeModalConfirm = async (scopeConstraint: string, count?: number) => {
    setIsAIProcessing(true);
    try {
      if (scopeModalAction === 'slides') {
        const slideCount = count || 5;
        const res = await fetch('/api/ai/doc-to-slides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: lesson.title,
            content: lesson.rawText || lesson.title,
            scopeConstraint: scopeConstraint || undefined,
            slideCount,
          }),
        });

        if (!res.ok) {
          throw new Error('Lỗi máy chủ biên soạn slide AI');
        }

        const data = await res.json();
        if (data.slides && data.slides.length > 0) {
          const updatedDoc: LessonDoc = {
            ...lesson,
            slides: data.slides,
          };
          onUpdateLesson?.(updatedDoc);
          setCurrentSlideIndex(0);
          setPresentationMode('slides');
          setUploadToast(`Đã tạo thành công ${data.slides.length} slide bài giảng theo phạm vi yêu cầu!`);
          setTimeout(() => setUploadToast(null), 3500);
        } else {
          alert('AI không trích xuất được slide phù hợp. Vui lòng mở rộng phạm vi yêu cầu.');
        }
      } else if (scopeModalAction === 'formulas') {
        const res = await fetch('/api/ai/extract-specific', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target: 'formulas',
            title: lesson.title,
            content: lesson.rawText || lesson.title,
            scopeConstraint: scopeConstraint || undefined,
          }),
        });

        if (!res.ok) {
          throw new Error('Lỗi máy chủ trích xuất công thức AI');
        }

        const data = await res.json();
        setExtractedFormulasData(data);
      }
      setIsScopeModalOpen(false);
    } catch (err: any) {
      console.error('AI Scope Action error:', err);
      alert('Không thể thực hiện tác vụ AI: ' + (err.message || 'Vui lòng thử lại sau'));
    } finally {
      setIsAIProcessing(false);
    }
  };

  const slides = lesson.slides || [];
  const currentSlide = slides[currentSlideIndex] || {
    id: 'empty',
    title: lesson.title,
    subtitle: `${lesson.subject} - ${lesson.grade}`,
    content: lesson.rawText || 'Chưa có nội dung slide.',
    keyTakeaway: 'Hãy chọn hoặc tải lên bài giảng để bắt đầu giảng dạy.',
  };

  const nextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      setCurrentSlideIndex((prev) => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex((prev) => prev - 1);
    }
  };

  // Font size scale multipliers for 75" TV
  const getScaleClasses = () => {
    switch (textScale) {
      case 'huge':
        return {
          title: 'text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight',
          subtitle: 'text-2xl md:text-3xl text-indigo-600 font-semibold',
          body: 'text-2xl md:text-3xl leading-relaxed text-slate-800 font-medium',
          formula: 'text-3xl md:text-4xl font-mono font-bold text-amber-800 py-3 px-6',
          takeaway: 'text-2xl md:text-3xl font-semibold text-slate-900',
        };
      case 'large':
        return {
          title: 'text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-tight',
          subtitle: 'text-xl md:text-2xl text-indigo-600 font-semibold',
          body: 'text-xl md:text-2xl leading-relaxed text-slate-800 font-medium',
          formula: 'text-2xl md:text-3xl font-mono font-bold text-amber-800 py-2.5 px-5',
          takeaway: 'text-xl md:text-2xl font-semibold text-slate-900',
        };
      case 'normal':
      default:
        return {
          title: 'text-2xl md:text-3xl lg:text-4xl font-black tracking-tight leading-tight',
          subtitle: 'text-lg md:text-xl text-indigo-600 font-semibold',
          body: 'text-lg md:text-xl leading-relaxed text-slate-800',
          formula: 'text-xl md:text-2xl font-mono font-bold text-amber-800 py-2 px-4',
          takeaway: 'text-lg md:text-xl font-medium text-slate-900',
        };
    }
  };

  const scaleClasses = getScaleClasses();

  return (
    <div
      id="presentation-viewport"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative w-full ${
        isFullscreen ? 'h-screen rounded-none' : 'h-[calc(100vh-100px)] rounded-3xl'
      } flex flex-col bg-slate-950 overflow-hidden border border-slate-800 shadow-2xl transition-all select-none`}
    >
      {/* Hidden File Input for Teacher Uploads */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.txt,.md"
        onChange={handleFileInputChange}
      />

      {/* Top Slide Control Strip */}
      <div className="flex items-center justify-between px-4 md:px-6 py-2.5 bg-slate-900/95 border-b border-slate-800 z-30 flex-wrap gap-2 text-white">
        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
          {/* Mode Switcher: Chiếu File Gốc vs Chiếu Slide */}
          <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl p-1 shadow-xs">
            <button
              onClick={() => setPresentationMode('original')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                presentationMode === 'original'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Chiếu nguyên bản tệp bài giảng gốc (Word, PDF, PowerPoint, Excel, Hình ảnh...)"
            >
              <FileText className="w-4 h-4" />
              <span>Chiếu File Gốc</span>
            </button>
            <button
              onClick={() => setPresentationMode('slides')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                presentationMode === 'slides'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
              title="Chiếu theo định dạng Slide tóm tắt"
            >
              <PresentationIcon className="w-4 h-4" />
              <span>Chiếu Slide ({slides.length || 1})</span>
            </button>
          </div>

          {/* Teacher Upload Button (Word, PPT, Excel, PDF) */}
          <button
            id="presentation-upload-file-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingFile}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-700/30 transition-all cursor-pointer active:scale-95 border border-emerald-400/40"
            title="Tải tệp Word, PowerPoint, Excel, PDF hoặc Hình ảnh lên trình chiếu ngay"
          >
            {isUploadingFile ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : (
              <UploadCloud className="w-4 h-4 text-emerald-200" />
            )}
            <span>Tải Lên Tệp Chiếu</span>
            <span className="hidden sm:inline-block text-[10px] uppercase font-mono px-1 py-0.2 bg-emerald-700/80 rounded">
              Word/PPT/Excel/PDF
            </span>
          </button>

          {/* Document Switcher Dropdown */}
          {allLessons.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowDocPicker(!showDocPicker)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                title="Chọn nhanh bài giảng khác trong danh sách"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span className="max-w-[140px] truncate">{lesson.title}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showDocPicker && (
                <div className="absolute top-full left-0 mt-1.5 w-72 max-h-80 overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 custom-scrollbar">
                  <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    Chọn Bài Giảng Trình Chiếu ({allLessons.length})
                  </div>
                  {allLessons.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => {
                        onSelectLesson?.(l);
                        setCurrentSlideIndex(0);
                        setShowDocPicker(false);
                      }}
                      className={`w-full p-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                        l.id === lesson.id
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <File className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span className="truncate flex-1">{l.title}</span>
                      <span className="text-[10px] opacity-75 uppercase font-mono">{l.fileType}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Slide List Drawer Toggle */}
          {presentationMode === 'slides' && (
            <button
              id="toggle-thumbnails-btn"
              onClick={() => setShowThumbnails(!showThumbnails)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                showThumbnails
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Slide ({currentSlideIndex + 1}/{slides.length || 1})</span>
            </button>
          )}

          {/* AI Slide Generation with Scope Constraint */}
          <button
            id="ai-create-slides-scoped-btn"
            onClick={() => handleOpenScopeModal('slides')}
            disabled={isAIProcessing}
            className="px-2.5 py-1.5 rounded-xl bg-purple-900/60 hover:bg-purple-800 border border-purple-600/60 text-purple-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            title="Dùng AI biên soạn bộ Slide tóm tắt theo giới hạn phạm vi kiến thức"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            <span className="hidden md:inline">Tạo Slide Theo Phạm Vi</span>
          </button>
        </div>

        {/* View Mode Actions */}
        <div className="flex items-center gap-2">
          {/* Split Mode Toggle (Document/Slide + Touch Whiteboard side-by-side) */}
          <button
            id="toggle-split-screen-btn"
            onClick={() => {
              setIsSplitMode(!isSplitMode);
              if (isOverlayAnnotation) setIsOverlayAnnotation(false);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer ${
              isSplitMode
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                : 'bg-slate-800 border-slate-700 text-emerald-300 hover:bg-slate-700'
            }`}
            title="Chế độ song song: Nửa tài liệu chiếu, Nửa bảng viết lời giải"
          >
            <Columns className="w-4 h-4" />
            <span className="hidden lg:inline">{isSplitMode ? 'Tắt chia đôi bảng' : 'Bảng viết song song'}</span>
          </button>

          {/* Overlay Draw on Slide / Document Toggle (PEN) */}
          <button
            id="toggle-draw-overlay-btn"
            onClick={() => {
              setIsOverlayAnnotation(!isOverlayAnnotation);
              if (isSplitMode) setIsSplitMode(false);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border cursor-pointer ${
              isOverlayAnnotation
                ? 'bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-amber-300 shadow-md font-black'
                : 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700'
            }`}
            title="Bật/Tắt công cụ bút viết, vẽ phấn trực tiếp lên bài giảng (Phím tắt: B hoặc P)"
          >
            <Pen className="w-4 h-4 text-amber-400" />
            <span className="font-bold">{isOverlayAnnotation ? 'Đang Bật Bút Viết' : 'Bút Viết Lên File'}</span>
          </button>

          {/* Quick Formula Summary with Scope Constraint */}
          <button
            id="ai-formulas-scoped-btn"
            onClick={() => handleOpenScopeModal('formulas')}
            className="px-2.5 py-1.5 rounded-xl bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-700/60 text-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer hidden xl:flex"
            title="Trích xuất tóm tắt công thức theo giới hạn phạm vi kiến thức"
          >
            <Sigma className="w-3.5 h-3.5 text-indigo-300" />
            <span>Tóm Tắt Công Thức</span>
          </button>

          {/* Ask AI about this slide */}
          <button
            id="ai-explain-slide-btn"
            onClick={() => onAskAIAboutSlide(currentSlide)}
            className="px-2.5 py-1.5 rounded-xl bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer hidden sm:flex"
            title="Yêu cầu AI giải đáp hoặc mở rộng kiến thức tài liệu này"
          >
            <HelpCircle className="w-4 h-4 text-purple-400" />
            <span className="hidden xl:inline">Hỏi AI bài này</span>
          </button>

          {/* Quick Launch Quiz from this slide */}
          <button
            id="quick-launch-quiz-btn"
            onClick={onLaunchQuiz}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
            title="Cho học sinh làm trắc nghiệm tức thì"
          >
            <PlayCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Phát trắc nghiệm</span>
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            id="toggle-presentation-fullscreen-btn"
            onClick={togglePresentationFullscreen}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isFullscreen
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md ring-2 ring-amber-300 font-black'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white'
            }`}
            title={isFullscreen ? 'Thu nhỏ cửa sổ bài giảng (Phím Esc)' : 'Phóng toàn màn hình 75 inch bài giảng'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
            <span className="hidden xl:inline">{isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}</span>
          </button>
        </div>
      </div>

      {/* Upload & Progress Floating Toast */}
      {uploadToast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 bg-slate-950/95 border-2 border-emerald-500/80 text-emerald-200 px-5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center gap-2.5 text-xs md:text-sm font-bold animate-fade-in">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
          <span>{uploadToast}</span>
        </div>
      )}

      {/* Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-40 bg-indigo-950/90 border-4 border-dashed border-indigo-400 flex flex-col items-center justify-center gap-4 text-white p-6 backdrop-blur-md animate-fade-in">
          <UploadCloud className="w-16 h-16 text-indigo-400 animate-bounce" />
          <h2 className="text-2xl font-black text-center">Thả tệp vào đây để trình chiếu ngay</h2>
          <p className="text-sm text-indigo-200 text-center max-w-md">
            Hỗ trợ toàn bộ định dạng Word (.docx, .doc), PowerPoint (.pptx, .ppt), Excel (.xlsx, .xls), PDF và hình ảnh.
          </p>
        </div>
      )}

      {/* Main Presentation Body */}
      <div className="relative flex-1 w-full flex overflow-hidden">
        {/* Slide Thumbnail Drawer (Toggleable in Slides Mode) */}
        {presentationMode === 'slides' && showThumbnails && (
          <div className="w-72 bg-slate-900 border-r border-slate-800 p-4 overflow-y-auto flex flex-col gap-3 z-30 shrink-0 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Danh sách Slide</span>
              <span className="text-xs text-indigo-400 font-mono font-bold">{slides.length} slides</span>
            </div>
            {slides.map((s, idx) => (
              <button
                key={s.id || idx}
                onClick={() => {
                  setCurrentSlideIndex(idx);
                  setShowThumbnails(false);
                }}
                className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                  currentSlideIndex === idx
                    ? 'bg-indigo-950/80 border-indigo-500 text-white ring-1 ring-indigo-400 shadow-md'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="text-xs text-indigo-400 font-mono font-bold mb-1">Slide {idx + 1}</div>
                <div className="text-sm font-bold line-clamp-2 text-white">{s.title}</div>
                {s.subtitle && <div className="text-xs text-slate-400 truncate mt-1">{s.subtitle}</div>}
              </button>
            ))}
          </div>
        )}

        {/* Presentation Area (Single Screen OR Split Screen with Whiteboard) */}
        <div className={`flex-1 h-full flex ${isSplitMode ? 'flex-col md:flex-row' : ''} overflow-hidden`}>
          {/* Main Display: Original Document OR Slide Cards */}
          <div
            id="slide-render-card"
            className={`relative flex-1 h-full overflow-hidden flex flex-col bg-slate-950 ${
              isSplitMode ? 'md:w-1/2 border-r border-slate-800' : 'w-full'
            }`}
          >
            {presentationMode === 'original' ? (
              /* ORIGINAL FILE PRESENTATION MODE (Word, PDF, Excel, PowerPoint, Image, etc.) */
              <div className="relative w-full h-full p-1 bg-slate-950">
                <UniversalDocumentViewer
                  lesson={lesson}
                  onLaunchQuiz={onLaunchQuiz}
                  isAnnotating={isOverlayAnnotation}
                  onToggleAnnotating={() => setIsOverlayAnnotation((prev) => !prev)}
                  onFullscreenRequest={togglePresentationFullscreen}
                />
              </div>
            ) : (
              /* STRUCTURED SLIDE PRESENTATION MODE */
              <div className="relative w-full h-full p-8 md:p-12 overflow-y-auto flex flex-col justify-between bg-white text-slate-900">
                {/* Slide Header */}
                <div className="space-y-3 mb-6">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-sm font-bold">
                    <span>{lesson.subject}</span>
                    <span>•</span>
                    <span>{lesson.grade}</span>
                    <span>•</span>
                    <span>Slide {currentSlideIndex + 1}/{slides.length || 1}</span>
                  </div>

                  <h1 className={`${scaleClasses.title} text-slate-900 tracking-tight`}>
                    {currentSlide.title}
                  </h1>

                  {currentSlide.subtitle && (
                    <p className={scaleClasses.subtitle}>
                      {currentSlide.subtitle}
                    </p>
                  )}
                </div>

                {/* Main Content & Formula Display */}
                <div className="space-y-6 flex-1">
                  {/* Formula Callout if exists */}
                  {currentSlide.formula && (
                    <div className="p-5 rounded-2xl bg-amber-50/90 border-2 border-amber-300 shadow-sm flex items-center gap-4">
                      <div className="w-3 h-12 bg-amber-500 rounded-full" />
                      <div className="flex-1">
                        <div className="text-xs uppercase font-bold text-amber-700 tracking-wider mb-1">
                          Công thức / Định lý trọng tâm:
                        </div>
                        <div className={scaleClasses.formula}>
                          <MathFormulaRenderer content={currentSlide.formula} isBlock={true} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Formatted Content Paragraphs / Bullets */}
                  <div className={`space-y-4 ${scaleClasses.body}`}>
                    {currentSlide.content.split('\n').map((line, lIdx) => {
                      if (!line.trim()) return null;
                      const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-');
                      const cleanLine = line.replace(/^[•\-]\s*/, '');
                      return (
                        <div key={lIdx} className={`flex items-start gap-3 ${isBullet ? 'pl-2' : ''}`}>
                          {isBullet && (
                            <div className="w-3 h-3 rounded-full bg-indigo-600 mt-2.5 shrink-0 shadow-xs" />
                          )}
                          <div className="flex-1 text-slate-800">
                            <MathFormulaRenderer content={cleanLine} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Key Takeaway Banner */}
                  {currentSlide.keyTakeaway && (
                    <div className="mt-6 p-5 rounded-2xl bg-indigo-50/90 border border-indigo-200 shadow-xs flex items-start gap-4">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs uppercase tracking-widest text-indigo-700 font-bold mb-1">
                          Ghi nhớ cốt lõi:
                        </div>
                        <div className={scaleClasses.takeaway}>
                          {currentSlide.keyTakeaway}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Slide Footer */}
                <div className="pt-6 mt-4 border-t border-slate-200 flex items-center justify-between text-slate-500 text-sm">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-slate-400" />
                    <span>Giáo viên: {lesson.author}</span>
                  </div>
                  <div className="font-mono text-slate-400">
                    Tivi 75" Chế độ Giảng Dạy Cảm Ứng
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Split Mode: Live Touch Whiteboard on Right Side */}
          {isSplitMode && (
            <div className="flex-1 h-full md:w-1/2 p-2 bg-slate-900 border-l border-slate-800">
              <TouchWhiteboard
                id="split-side-whiteboard"
                backgroundTheme={whiteboardTheme}
                onBackgroundChange={setWhiteboardTheme}
              />
            </div>
          )}
        </div>
      </div>

      {/* Large Navigation Bar for Slides Mode */}
      {presentationMode === 'slides' && (
        <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between z-20 text-white">
          <button
            id="prev-slide-btn"
            onClick={prevSlide}
            disabled={currentSlideIndex === 0}
            className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-lg flex items-center gap-3 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <ChevronLeft className="w-7 h-7 text-indigo-400" />
            <span>Slide Trước</span>
          </button>

          {/* Page progress dots */}
          <div className="flex items-center gap-2 max-w-md overflow-x-auto py-1 px-2 custom-scrollbar-none">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlideIndex(idx)}
                className={`h-3.5 rounded-full transition-all cursor-pointer ${
                  currentSlideIndex === idx
                    ? 'w-10 bg-indigo-500 shadow-sm'
                    : 'w-3.5 bg-slate-700 hover:bg-slate-600'
                }`}
                title={`Chuyển tới Slide ${idx + 1}`}
              />
            ))}
          </div>

          <button
            id="next-slide-btn"
            onClick={nextSlide}
            disabled={currentSlideIndex >= slides.length - 1}
            className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg flex items-center gap-3 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-md shadow-indigo-600/30 active:scale-95 cursor-pointer"
          >
            <span>Slide Tiếp Theo</span>
            <ChevronRight className="w-7 h-7 text-white" />
          </button>
        </div>
      )}

      {/* FLOATING PEN ACTION BUTTON (When drawing overlay is inactive) */}
      {!isOverlayAnnotation && !isSplitMode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-auto flex items-center gap-3 animate-fade-in">
          <button
            id="floating-enable-pen-btn"
            onClick={() => setIsOverlayAnnotation(true)}
            className="px-5 py-3 rounded-full bg-slate-950/95 hover:bg-emerald-600 border-2 border-emerald-400 text-white font-black text-sm md:text-base flex items-center gap-2.5 shadow-2xl backdrop-blur-xl transition-all hover:scale-105 active:scale-95 cursor-pointer ring-4 ring-emerald-500/25"
            title="Bật bút viết, vẽ phấn, dạ quang đè lên bài giảng (Phím tắt: B hoặc P)"
          >
            <Pen className="w-5 h-5 text-emerald-400" />
            <span>Bật Bút Viết Lên Bài Giảng</span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-white/20 text-emerald-200">
              Phím B / P
            </span>
          </button>
        </div>
      )}

      {/* UNIFIED FULL-SCREEN TOUCH WHITEBOARD OVERLAY (Guaranteed to work in 100% Fullscreen on 75" TV) */}
      {isOverlayAnnotation && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          <TouchWhiteboard
            id="presentation-unified-whiteboard"
            isOverlay={true}
            onCloseOverlay={() => setIsOverlayAnnotation(false)}
          />
        </div>
      )}

      {/* AI Scope Constraint Modal */}
      <ScopeConstraintModal
        isOpen={isScopeModalOpen}
        onClose={() => setIsScopeModalOpen(false)}
        actionType={scopeModalAction}
        documentTitle={lesson.title}
        subject={lesson.subject}
        onConfirm={handleScopeModalConfirm}
        isProcessing={isAIProcessing}
      />

      {/* Extracted Formulas Modal / Drawer */}
      {extractedFormulasData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-3xl max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-scale-up">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700">
                  <Sigma className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Công Thức & Định Lý Đã Trích Xuất</h3>
                  <p className="text-xs text-slate-500">Giới hạn theo phạm vi kiến thức yêu cầu</p>
                </div>
              </div>
              <button
                onClick={() => setExtractedFormulasData(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {extractedFormulasData.formulas && extractedFormulasData.formulas.length > 0 ? (
                extractedFormulasData.formulas.map((item: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 shadow-xs">
                    <div className="text-xs font-black uppercase text-amber-800 mb-1">{item.name}</div>
                    <div className="text-lg font-mono text-slate-900 py-2">
                      <MathFormulaRenderer content={item.latex || item.formula} isBlock={true} />
                    </div>
                    {item.note && <div className="text-xs text-slate-600 mt-1 italic">💡 {item.note}</div>}
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-500">
                  {extractedFormulasData.content || 'Đã trích xuất công thức theo yêu cầu.'}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setExtractedFormulasData(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all"
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
