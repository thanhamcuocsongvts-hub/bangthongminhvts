import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { LessonDoc, TextScale, ExtractedDocSummary, SlideItem, QuizQuestion } from '../types';
import { exportLessonToWord } from '../utils/exportUtils';
import { cleanDocumentText } from '../utils/fileParser';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { UniversalDocumentViewer } from './UniversalDocumentViewer';

interface DocumentReaderViewProps {
  lesson: LessonDoc;
  textScale: TextScale;
  onUpdateLesson: (updated: LessonDoc) => void;
  onDeleteLesson?: (id: string) => void;
  onLaunchSlides: () => void;
  onLaunchQuiz: () => void;
  onSendToAIChat: (prompt: string) => void;
}

export const DocumentReaderView: React.FC<DocumentReaderViewProps> = ({
  lesson,
  textScale,
  onUpdateLesson,
  onDeleteLesson,
  onLaunchSlides,
  onLaunchQuiz,
  onSendToAIChat,
}) => {
  // Always default to 'original' viewer if fileUrl is available or it's a PDF/Image/Doc/XLSX
  const [activeViewMode, setActiveViewMode] = useState<'original' | 'extracted' | 'notes'>('original');
  
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [pdfZoom, setPdfZoom] = useState<number>(100);
  const [pdfRotation, setPdfRotation] = useState<number>(0);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

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

  // 1. ON-DEMAND AI: Extract Formulas & Theorems
  const handleExtractFormulas = async () => {
    try {
      setIsExtractingFormulas(true);
      const res = await fetch('/api/ai/extract-specific', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'formulas',
          title: lesson.title,
          content: displaySafeText,
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

  // 2. ON-DEMAND AI: Extract 2-Min Summary
  const handleExtractSummary = async () => {
    try {
      setIsExtractingSummary(true);
      const res = await fetch('/api/ai/extract-specific', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'summary',
          title: lesson.title,
          content: displaySafeText,
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

  // 3. ON-DEMAND AI: Convert Document to Slides
  const handleConvertDocToSlides = async () => {
    try {
      setIsConvertingSlides(true);
      const res = await fetch('/api/ai/doc-to-slides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: lesson.title,
          content: displaySafeText,
          subject: lesson.subject,
          count: 5,
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

  // 4. ON-DEMAND AI: Generate Instant Quiz
  const handleGenerateInstantQuiz = async () => {
    try {
      setIsGeneratingQuiz(true);
      const res = await fetch('/api/ai/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: displaySafeText,
          subject: lesson.subject,
          count: 5,
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
      className="w-full h-[calc(100vh-100px)] flex flex-col bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-md p-4 md:p-6 space-y-4"
    >
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
              onClick={() => {
                if (window.confirm(`Thầy/Cô có chắc chắn muốn xóa tài liệu "${lesson.title}" không?`)) {
                  onDeleteLesson(lesson.id);
                }
              }}
              className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 border border-rose-200 transition-all shadow-xs"
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
            onClick={handleExtractFormulas}
            disabled={isExtractingFormulas}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-indigo-400 text-slate-800 text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:bg-indigo-50/50"
            title="Chỉ trích xuất các định lý, công thức Toán/Lý/Hóa"
          >
            <Sigma className={`w-3.5 h-3.5 text-indigo-600 ${isExtractingFormulas ? 'animate-spin' : ''}`} />
            <span>{isExtractingFormulas ? 'Đang trích xuất...' : 'Trích Xuất Công Thức'}</span>
          </button>

          <button
            onClick={handleExtractSummary}
            disabled={isExtractingSummary}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-indigo-400 text-slate-800 text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:bg-indigo-50/50"
            title="Tóm tắt ngắn gọn các ý cốt lõi bài học"
          >
            <BookmarkCheck className={`w-3.5 h-3.5 text-emerald-600 ${isExtractingSummary ? 'animate-spin' : ''}`} />
            <span>{isExtractingSummary ? 'Đang tóm tắt...' : 'Tóm Tắt 2 Phút'}</span>
          </button>

          <button
            onClick={handleConvertDocToSlides}
            disabled={isConvertingSlides}
            className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 hover:bg-purple-100 text-purple-800 text-xs font-bold flex items-center gap-1.5 shadow-2xs"
            title="Tạo các slide giảng dạy từ tài liệu"
          >
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>{isConvertingSlides ? 'Đang tạo...' : 'Tạo Slide'}</span>
          </button>

          <button
            onClick={handleGenerateInstantQuiz}
            disabled={isGeneratingQuiz}
            className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5 shadow-2xs"
            title="Tạo bộ câu hỏi trắc nghiệm kiểm tra"
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
    </div>
  );
};
