import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Columns,
  Square,
  Sparkles,
  PlayCircle,
  HelpCircle,
  BookOpen,
  Share2,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  FileText,
  Presentation as PresentationIcon,
} from 'lucide-react';
import { LessonDoc, SlideItem, TextScale } from '../types';
import { TouchWhiteboard } from './TouchWhiteboard';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { UniversalDocumentViewer } from './UniversalDocumentViewer';

interface PresentationViewProps {
  lesson: LessonDoc;
  textScale: TextScale;
  onLaunchQuiz: () => void;
  onAskAIAboutSlide: (slide: SlideItem) => void;
  onOpenExportModal: () => void;
}

export const PresentationView: React.FC<PresentationViewProps> = ({
  lesson,
  textScale,
  onLaunchQuiz,
  onAskAIAboutSlide,
  onOpenExportModal,
}) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isSplitMode, setIsSplitMode] = useState<boolean>(false);
  const [isOverlayAnnotation, setIsOverlayAnnotation] = useState<boolean>(false);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(false);
  const [whiteboardTheme, setWhiteboardTheme] = useState<'blackboard' | 'slate' | 'graph' | 'white'>('blackboard');
  // Support displaying either the authentic original file or the extracted slides
  const [presentationMode, setPresentationMode] = useState<'original' | 'slides'>('original');

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
    <div id="presentation-viewport" className="relative w-full h-[calc(100vh-100px)] flex flex-col bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-md">
      {/* Top Slide Control Strip */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-50/90 border-b border-slate-200 z-20 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {/* Mode Switcher: Chiếu File Gốc vs Chiếu Slide */}
          <div className="flex items-center bg-white border border-slate-300 rounded-xl p-1 shadow-xs">
            <button
              onClick={() => setPresentationMode('original')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                presentationMode === 'original'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
              title="Chiếu nguyên bản tệp bài giảng gốc (Word, PDF, PowerPoint, Excel, Hình ảnh...)"
            >
              <FileText className="w-4 h-4" />
              <span>Chiếu File Gốc</span>
            </button>
            <button
              onClick={() => setPresentationMode('slides')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                presentationMode === 'slides'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
              title="Chiếu theo định dạng Slide tóm tắt"
            >
              <PresentationIcon className="w-4 h-4" />
              <span>Chiếu Slide ({slides.length || 1})</span>
            </button>
          </div>

          {presentationMode === 'slides' && (
            <button
              id="toggle-thumbnails-btn"
              onClick={() => setShowThumbnails(!showThumbnails)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                showThumbnails
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-4 h-4 text-indigo-500" />
              <span>Slide ({currentSlideIndex + 1}/{slides.length || 1})</span>
            </button>
          )}

          <span className="text-slate-300 text-sm hidden md:inline">|</span>
          <span className="text-slate-700 font-semibold text-sm truncate max-w-xs hidden sm:inline">
            {lesson.title}
          </span>
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
            className={`px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border ${
              isSplitMode
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white border-slate-200 text-emerald-700 hover:bg-emerald-50'
            }`}
            title="Chế độ song song: Nửa tài liệu chiếu, Nửa bảng viết lời giải"
          >
            <Columns className="w-5 h-5" />
            <span className="hidden lg:inline">{isSplitMode ? 'Tắt chia đôi bảng' : 'Bảng viết song song'}</span>
          </button>

          {/* Overlay Draw on Slide / Document Toggle */}
          <button
            id="toggle-draw-overlay-btn"
            onClick={() => {
              setIsOverlayAnnotation(!isOverlayAnnotation);
              if (isSplitMode) setIsSplitMode(false);
            }}
            className={`px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all border ${
              isOverlayAnnotation
                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                : 'bg-white border-slate-200 text-amber-700 hover:bg-amber-50'
            }`}
            title="Bật công cụ viết, vẽ đè trực tiếp lên tệp trình chiếu"
          >
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span className="hidden lg:inline">{isOverlayAnnotation ? 'Đang bật vẽ đè bài giảng' : 'Viết / Vẽ đè lên file'}</span>
          </button>

          {/* Ask AI about this slide */}
          <button
            id="ai-explain-slide-btn"
            onClick={() => onAskAIAboutSlide(currentSlide)}
            className="px-3.5 py-2 rounded-xl bg-purple-50 border border-purple-200 hover:bg-purple-100 text-purple-700 text-sm font-bold flex items-center gap-2 transition-all shadow-xs"
            title="Yêu cầu AI giải đáp hoặc mở rộng kiến thức tài liệu này"
          >
            <HelpCircle className="w-5 h-5 text-purple-600" />
            <span className="hidden xl:inline">Hỏi AI bài này</span>
          </button>

          {/* Quick Launch Quiz from this slide */}
          <button
            id="quick-launch-quiz-btn"
            onClick={onLaunchQuiz}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all"
            title="Cho học sinh làm trắc nghiệm tức thì"
          >
            <PlayCircle className="w-5 h-5" />
            <span>Phát trắc nghiệm</span>
          </button>
        </div>
      </div>

      {/* Main Presentation Body */}
      <div className="relative flex-1 w-full flex overflow-hidden">
        {/* Slide Thumbnail Drawer (Toggleable in Slides Mode) */}
        {presentationMode === 'slides' && showThumbnails && (
          <div className="w-72 bg-white border-r border-slate-200 p-4 overflow-y-auto flex flex-col gap-3 z-30 shrink-0 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Danh sách Slide</span>
              <span className="text-xs text-indigo-600 font-mono font-bold">{slides.length} slides</span>
            </div>
            {slides.map((s, idx) => (
              <button
                key={s.id || idx}
                onClick={() => {
                  setCurrentSlideIndex(idx);
                  setShowThumbnails(false);
                }}
                className={`p-3 rounded-xl text-left border transition-all ${
                  currentSlideIndex === idx
                    ? 'bg-indigo-50 border-indigo-400 text-slate-900 ring-1 ring-indigo-300 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="text-xs text-indigo-600 font-mono font-bold mb-1">Slide {idx + 1}</div>
                <div className="text-sm font-bold line-clamp-2 text-slate-900">{s.title}</div>
                {s.subtitle && <div className="text-xs text-slate-500 truncate mt-1">{s.subtitle}</div>}
              </button>
            ))}
          </div>
        )}

        {/* Presentation Area (Single Screen OR Split Screen with Whiteboard) */}
        <div className={`flex-1 h-full flex ${isSplitMode ? 'flex-col md:flex-row' : ''} overflow-hidden`}>
          {/* Main Display: Original Document OR Slide Cards */}
          <div
            id="slide-render-card"
            className={`relative flex-1 h-full overflow-hidden flex flex-col bg-white ${
              isSplitMode ? 'md:w-1/2 border-r border-slate-200' : 'w-full'
            }`}
          >
            {presentationMode === 'original' ? (
              /* ORIGINAL FILE PRESENTATION MODE */
              <div className="relative w-full h-full p-2 bg-slate-900">
                <UniversalDocumentViewer lesson={lesson} onLaunchQuiz={onLaunchQuiz} />
              </div>
            ) : (
              /* STRUCTURED SLIDE PRESENTATION MODE */
              <div className="relative w-full h-full p-8 md:p-12 overflow-y-auto flex flex-col justify-between">
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

            {/* Overlay Drawing Canvas when enabled */}
            {isOverlayAnnotation && (
              <div className="absolute inset-0 z-40 pointer-events-auto">
                <TouchWhiteboard id="slide-overlay-whiteboard" isOverlay={true} />
              </div>
            )}
          </div>

          {/* Split Mode: Live Touch Whiteboard on Right Side */}
          {isSplitMode && (
            <div className="flex-1 h-full md:w-1/2 p-2 bg-slate-100">
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
        <div className="px-6 py-3.5 bg-slate-50/95 border-t border-slate-200 flex items-center justify-between z-20">
          <button
            id="prev-slide-btn"
            onClick={prevSlide}
            disabled={currentSlideIndex === 0}
            className="px-6 py-3 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-lg flex items-center gap-3 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-xs active:scale-95"
          >
            <ChevronLeft className="w-7 h-7 text-indigo-600" />
            <span>Slide Trước</span>
          </button>

          {/* Page progress dots */}
          <div className="flex items-center gap-2 max-w-md overflow-x-auto py-1 px-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlideIndex(idx)}
                className={`h-3.5 rounded-full transition-all ${
                  currentSlideIndex === idx
                    ? 'w-10 bg-indigo-600 shadow-sm'
                    : 'w-3.5 bg-slate-300 hover:bg-slate-400'
                }`}
                title={`Chuyển tới Slide ${idx + 1}`}
              />
            ))}
          </div>

          <button
            id="next-slide-btn"
            onClick={nextSlide}
            disabled={currentSlideIndex >= slides.length - 1}
            className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg flex items-center gap-3 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-md shadow-indigo-600/20 active:scale-95"
          >
            <span>Slide Tiếp Theo</span>
            <ChevronRight className="w-7 h-7 text-white" />
          </button>
        </div>
      )}
    </div>
  );
};
