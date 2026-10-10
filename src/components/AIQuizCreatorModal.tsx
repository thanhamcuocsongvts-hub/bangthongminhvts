import React, { useState, useRef } from 'react';
import {
  Sparkles,
  X,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  Plus,
  Trash2,
  Edit3,
  Check,
  Zap,
  Save,
  Layers,
  ArrowRight,
  ArrowLeft,
  ListOrdered,
  Clock,
  Award,
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileCode,
  PenTool,
  CheckSquare,
  Volume2,
  VolumeX,
  Square,
  Play,
  RotateCcw,
} from 'lucide-react';
import { QuizQuestion, LessonDoc } from '../types';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { QuizRichContentRenderer } from './QuizRichContentRenderer';
import { parseQuizFromFile } from '../utils/quizFileParser';
import { directGenerateQuiz } from '../utils/geminiClient';
import {
  speakQuestionContent,
  stopAllSpeech,
  VOICE_TONE_PRESETS,
  VoiceTonePreset,
} from '../utils/aiSpeechService';

interface AIQuizCreatorModalProps {
  currentLesson?: LessonDoc | null;
  onClose: () => void;
  onApplyQuestions: (questions: QuizQuestion[], quizTitle?: string, replace?: boolean) => void;
}

export const AIQuizCreatorModal: React.FC<AIQuizCreatorModalProps> = ({
  currentLesson,
  onClose,
  onApplyQuestions,
}) => {
  const [creationMode, setCreationMode] = useState<'ai' | 'manual' | 'file'>('ai');

  // AI Generation state
  const [topic, setTopic] = useState<string>(
    currentLesson?.title || 'Ôn tập kiến thức trọng tâm học kỳ'
  );
  const [subject, setSubject] = useState<string>(currentLesson?.subject || 'Toán học');
  const [grade, setGrade] = useState<string>(currentLesson?.grade || 'Lớp 12');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<'Cơ bản' | 'Thông hiểu' | 'Vận dụng' | 'Vận dụng cao'>('Thông hiểu');
  const [timeLimit, setTimeLimit] = useState<number>(30);
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestion[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // AI Speech Audio State
  const [readingQuestionId, setReadingQuestionId] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<VoiceTonePreset>(VOICE_TONE_PRESETS[1]); // Cô giáo dịu dàng

  // Manual Creation Stepper & Form State
  const [activeManualIndex, setActiveManualIndex] = useState<number>(0);
  const [manualQuestion, setManualQuestion] = useState<string>('');
  const [manualOptA, setManualOptA] = useState<string>('');
  const [manualOptB, setManualOptB] = useState<string>('');
  const [manualOptC, setManualOptC] = useState<string>('');
  const [manualOptD, setManualOptD] = useState<string>('');
  const [manualCorrect, setManualCorrect] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [manualExplanation, setManualExplanation] = useState<string>('');
  const [manualTime, setManualTime] = useState<number>(30);
  const [manualDiff, setManualDiff] = useState<'Cơ bản' | 'Thông hiểu' | 'Vận dụng' | 'Vận dụng cao'>('Thông hiểu');

  // Load a question into manual form if index changes
  const loadQuestionIntoManualForm = (q: QuizQuestion) => {
    setManualQuestion(q.question);
    setManualOptA(q.options?.find((o) => o.key === 'A')?.text || '');
    setManualOptB(q.options?.find((o) => o.key === 'B')?.text || '');
    setManualOptC(q.options?.find((o) => o.key === 'C')?.text || '');
    setManualOptD(q.options?.find((o) => o.key === 'D')?.text || '');
    setManualCorrect((q.correctAnswer as any) || 'A');
    setManualExplanation(q.explanation || '');
    setManualTime(q.timeLimit || 30);
    setManualDiff((q.difficulty as any) || 'Thông hiểu');
  };

  const handleToggleSpeakQuestion = (q: QuizQuestion) => {
    if (readingQuestionId === q.id) {
      stopAllSpeech();
      setReadingQuestionId(null);
    } else {
      stopAllSpeech();
      setReadingQuestionId(q.id);
      speakQuestionContent(q, {
        preset: selectedVoice,
        onStart: () => setReadingQuestionId(q.id),
        onEnd: () => setReadingQuestionId(null),
        onError: () => setReadingQuestionId(null),
      });
    }
  };

  const handleToggleSpeakDraft = () => {
    const draftQ: QuizQuestion = {
      id: 'draft',
      question: manualQuestion || 'Nội dung câu hỏi',
      options: [
        { key: 'A', text: manualOptA || 'Đáp án A' },
        { key: 'B', text: manualOptB || 'Đáp án B' },
        { key: 'C', text: manualOptC || 'Đáp án C' },
        { key: 'D', text: manualOptD || 'Đáp án D' },
      ],
      correctAnswer: manualCorrect,
      explanation: manualExplanation,
      timeLimit: manualTime,
    };
    handleToggleSpeakQuestion(draftQ);
  };

  // File Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);

  // Trigger AI generation
  const handleGenerate = async () => {
    if (!topic.trim()) {
      setErrorMessage('Vui lòng nhập chủ đề bài học hoặc kiến thức cần tạo trắc nghiệm.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      let rawQuestions: QuizQuestion[] = [];

      try {
        const response = await fetch('/api/ai/generate-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: topic.trim(),
            content: currentLesson?.rawText || '',
            count: questionCount,
            subject,
            grade,
            difficulty,
          }),
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await response.json();
            if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
              rawQuestions = data.questions;
            }
          }
        }
      } catch (apiErr) {
        console.info('[AI Fallback] Server API unavailable, generating quiz directly in browser...', apiErr);
      }

      // If server API was unavailable or returned empty, call direct client-side Gemini
      if (rawQuestions.length === 0) {
        rawQuestions = await directGenerateQuiz({
          topic: topic.trim(),
          subject,
          grade,
          count: questionCount,
          difficulty,
        });
      }

      if (rawQuestions && rawQuestions.length > 0) {
        const withLimits = rawQuestions.map((q: QuizQuestion, idx: number) => ({
          ...q,
          id: `ai_q_${Date.now()}_${idx + 1}`,
          timeLimit: q.timeLimit || timeLimit,
          difficulty: q.difficulty || difficulty,
        }));
        setGeneratedQuestions((prev) => replaceExisting ? withLimits : [...prev, ...withLimits]);
        setSuccessMessage(`Đã tạo thành công ${withLimits.length} câu hỏi chuẩn từ AI!`);
      } else {
        setErrorMessage('Không thể tạo câu hỏi từ AI. Vui lòng kiểm tra API Key trong mục Cấu hình AI hoặc nhập chủ đề chi tiết hơn.');
      }
    } catch (e: any) {
      console.error('Error generating AI quiz', e);
      setErrorMessage('Lỗi kết nối máy chủ AI: ' + (e?.message || 'Vui lòng kiểm tra lại API Key'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Add/Update manual question from form with smart Next navigation
  const handleSaveManualAndNext = (advanceToNext: boolean = true) => {
    if (!manualQuestion.trim()) {
      setErrorMessage('Vui lòng nhập nội dung câu hỏi.');
      return;
    }
    if (!manualOptA.trim() || !manualOptB.trim()) {
      setErrorMessage('Vui lòng nhập ít nhất đáp án A và đáp án B.');
      return;
    }

    const currentId =
      activeManualIndex < generatedQuestions.length
        ? generatedQuestions[activeManualIndex].id
        : `manual_q_${Date.now()}`;

    const newQ: QuizQuestion = {
      id: currentId,
      question: manualQuestion.trim(),
      options: [
        { key: 'A', text: manualOptA.trim() },
        { key: 'B', text: manualOptB.trim() },
        { key: 'C', text: manualOptC.trim() || 'Đáp án C' },
        { key: 'D', text: manualOptD.trim() || 'Đáp án D' },
      ],
      correctAnswer: manualCorrect,
      explanation: manualExplanation.trim() || 'Lời giải chi tiết.',
      timeLimit: manualTime,
      difficulty: manualDiff,
    };

    if (activeManualIndex < generatedQuestions.length) {
      setGeneratedQuestions((prev) =>
        prev.map((item, i) => (i === activeManualIndex ? newQ : item))
      );
      setSuccessMessage(`Đã cập nhật xong Câu ${activeManualIndex + 1}!`);
    } else {
      setGeneratedQuestions((prev) => [...prev, newQ]);
      setSuccessMessage(`Đã thêm Câu ${generatedQuestions.length + 1} vào danh sách!`);
    }

    setErrorMessage(null);

    if (advanceToNext) {
      const nextIdx = activeManualIndex + 1;
      setActiveManualIndex(nextIdx);
      if (nextIdx < generatedQuestions.length) {
        loadQuestionIntoManualForm(generatedQuestions[nextIdx]);
      } else {
        // Clear form for next fresh question
        setManualQuestion('');
        setManualOptA('');
        setManualOptB('');
        setManualOptC('');
        setManualOptD('');
        setManualExplanation('');
      }
    }
  };

  const handleManualGoPrev = () => {
    if (activeManualIndex > 0) {
      const prevIdx = activeManualIndex - 1;
      setActiveManualIndex(prevIdx);
      if (prevIdx < generatedQuestions.length) {
        loadQuestionIntoManualForm(generatedQuestions[prevIdx]);
      }
    }
  };

  const handleManualSelectTab = (idx: number) => {
    setActiveManualIndex(idx);
    if (idx < generatedQuestions.length) {
      loadQuestionIntoManualForm(generatedQuestions[idx]);
    } else {
      setManualQuestion('');
      setManualOptA('');
      setManualOptB('');
      setManualOptC('');
      setManualOptD('');
      setManualExplanation('');
    }
  };

  // Process uploaded file
  const handleFileUpload = async (file: File) => {
    setIsParsingFile(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const parsed = await parseQuizFromFile(file);
      if (parsed && parsed.length > 0) {
        setGeneratedQuestions((prev) => replaceExisting ? parsed : [...prev, ...parsed]);
        setSuccessMessage(`Đã nạp thành công ${parsed.length} câu hỏi từ tệp "${file.name}"!`);
      } else {
        setErrorMessage(`Không tìm thấy câu hỏi hợp lệ trong tệp "${file.name}". Hãy kiểm tra định dạng Câu 1: ... A. ... B. ...`);
      }
    } catch (e: any) {
      console.error('File parse error:', e);
      setErrorMessage(`Lỗi đọc tệp: ${e?.message || 'Vui lòng thử lại với tệp Word hoặc Excel'}`);
    } finally {
      setIsParsingFile(false);
    }
  };

  // Add an empty custom manual question directly to list
  const handleAddManualQuestion = () => {
    const newQ: QuizQuestion = {
      id: `manual_q_${Date.now()}`,
      question: 'Nhập câu hỏi trắc nghiệm mới tại đây...',
      options: [
        { key: 'A', text: 'Đáp án A' },
        { key: 'B', text: 'Đáp án B' },
        { key: 'C', text: 'Đáp án C' },
        { key: 'D', text: 'Đáp án D' },
      ],
      correctAnswer: 'A',
      explanation: 'Giải thích chi tiết cho câu hỏi.',
      timeLimit: timeLimit,
      difficulty: difficulty,
    };
    setGeneratedQuestions((prev) => [...prev, newQ]);
    setEditingIndex(generatedQuestions.length);
  };

  // Delete a question
  const handleDeleteQuestion = (idx: number) => {
    setGeneratedQuestions((prev) => prev.filter((_, i) => i !== idx));
    if (editingIndex === idx) setEditingIndex(null);
  };

  // Save all questions into room / lesson
  const handleSaveAndApply = () => {
    if (generatedQuestions.length === 0) {
      setErrorMessage('Chưa có câu hỏi nào để áp dụng.');
      return;
    }
    onApplyQuestions(generatedQuestions, `Trắc nghiệm: ${topic}`, replaceExisting);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 select-none animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20">
              <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black tracking-tight">
                Bộ Công Cụ Tạo Đề Trắc Nghiệm Thông Minh
              </h2>
              <p className="text-xs text-purple-200">
                Tạo nhanh bằng AI, nhập thủ công hoặc nhập tự động từ tệp Word (.docx), Excel (.xlsx)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Method Switcher Tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 pb-2 bg-slate-100/80 border-b border-slate-200 shrink-0">
          <button
            onClick={() => setCreationMode('ai')}
            className={`px-4 py-2 rounded-xl font-black text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer ${
              creationMode === 'ai'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>1. Tạo Bằng AI</span>
          </button>

          <button
            onClick={() => setCreationMode('manual')}
            className={`px-4 py-2 rounded-xl font-black text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer ${
              creationMode === 'manual'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            <PenTool className="w-4 h-4 text-indigo-400" />
            <span>2. Nhập Thủ Công</span>
          </button>

          <button
            onClick={() => setCreationMode('file')}
            className={`px-4 py-2 rounded-xl font-black text-xs md:text-sm flex items-center gap-2 transition-all cursor-pointer ${
              creationMode === 'file'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-emerald-500" />
            <span>3. Nhập Từ File (Word / Excel / TXT)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 custom-scrollbar">
          {/* 1. AI Creation Panel */}
          {creationMode === 'ai' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="md:col-span-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Chủ Đề Hoặc Tên Bài Học Cần Kiểm Tra</span>
                  </label>
                  {currentLesson && (
                    <button
                      onClick={() => {
                        setTopic(currentLesson.title);
                        if (currentLesson.subject) setSubject(currentLesson.subject);
                        if (currentLesson.grade) setGrade(currentLesson.grade);
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Lấy tên bài học đang mở</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ví dụ: Quang hợp và hô hấp tế bào, Định luật II Newton, Khảo sát hàm số..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Môn Học</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Toán học">Toán học</option>
                  <option value="Vật lý">Vật lý</option>
                  <option value="Hóa học">Hóa học</option>
                  <option value="Sinh học">Sinh học</option>
                  <option value="Ngữ văn">Ngữ văn</option>
                  <option value="Tiếng Anh">Tiếng Anh</option>
                  <option value="Lịch sử">Lịch sử</option>
                  <option value="Địa lý">Địa lý</option>
                  <option value="Tin học">Tin học</option>
                  <option value="Khoa học tự nhiên">Khoa học tự nhiên</option>
                  <option value="GDCD">Giáo dục công dân</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Khối Lớp</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Lớp 6">Lớp 6</option>
                  <option value="Lớp 7">Lớp 7</option>
                  <option value="Lớp 8">Lớp 8</option>
                  <option value="Lớp 9">Lớp 9</option>
                  <option value="Lớp 10">Lớp 10</option>
                  <option value="Lớp 11">Lớp 11</option>
                  <option value="Lớp 12">Lớp 12</option>
                  <option value="Ôn thi THPT">Ôn thi THPT Quốc Gia</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Số Lượng Câu</label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={3}>3 câu (Khởi động nhanh)</option>
                  <option value={5}>5 câu (Kiểm tra 15 phút)</option>
                  <option value={10}>10 câu (Ôn tập trọng tâm)</option>
                  <option value={15}>15 câu (Đề tổng hợp)</option>
                  <option value={20}>20 câu (Kiểm tra học kỳ)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Mức Độ Phân Hóa</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Cơ bản">Nhận biết (Cơ bản)</option>
                  <option value="Thông hiểu">Thông hiểu</option>
                  <option value="Vận dụng">Vận dụng</option>
                  <option value="Vận dụng cao">Vận dụng cao</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600">Thời Gian Mỗi Câu</label>
                <select
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={15}>15 giây</option>
                  <option value={30}>30 giây (Chuẩn)</option>
                  <option value={45}>45 giây</option>
                  <option value={60}>60 giây (Toán/Lý)</option>
                  <option value={90}>90 giây</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs md:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{isGenerating ? 'AI Đang Soạn Đề...' : 'Tạo Đề Bằng AI (1 Chạm)'}</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. Manual Entry Panel */}
          {creationMode === 'manual' && (
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              {/* Stepper Tabs Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
                  {generatedQuestions.map((_, qIdx) => (
                    <button
                      key={qIdx}
                      type="button"
                      onClick={() => handleManualSelectTab(qIdx)}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all cursor-pointer shrink-0 ${
                        activeManualIndex === qIdx
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                      }`}
                    >
                      Câu {qIdx + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleManualSelectTab(generatedQuestions.length)}
                    className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                      activeManualIndex === generatedQuestions.length
                        ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Soạn câu mới ({generatedQuestions.length + 1})</span>
                  </button>
                </div>

                {/* AI Voice Preset & Playback */}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedVoice.id}
                    onChange={(e) => {
                      const found = VOICE_TONE_PRESETS.find((p) => p.id === e.target.value);
                      if (found) setSelectedVoice(found);
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
                    onClick={handleToggleSpeakDraft}
                    className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      readingQuestionId === 'draft'
                        ? 'bg-rose-600 text-white animate-pulse shadow-md'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                    }`}
                    title="Nghe giọng AI đọc câu hỏi và các phương án đang soạn"
                  >
                    {readingQuestionId === 'draft' ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Dừng đọc</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Nghe AI đọc thử</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-black text-xs">
                      CÂU {activeManualIndex + 1}
                    </span>
                    <span>Nội Dung Câu Hỏi (Hỗ trợ công thức $...$)</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Mẹo: Gõ công thức trong dấu $...$ (VD: $y = x^3 - 3x^2 + 2$)
                  </span>
                </div>
                <textarea
                  value={manualQuestion}
                  onChange={(e) => setManualQuestion(e.target.value)}
                  placeholder="Ví dụ: Cho hàm số $y = x^3 - 3x + 2$. Điểm cực tiểu của hàm số là gì?"
                  className="w-full p-3 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                />
                {manualQuestion.trim() && (
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800">
                    <span className="font-bold text-indigo-600 mr-2 text-[11px]">Xem trước chuẩn SGK:</span>
                    <QuizRichContentRenderer content={manualQuestion} />
                  </div>
                )}
              </div>

              {/* 4 Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'A', val: manualOptA, setVal: setManualOptA },
                  { key: 'B', val: manualOptB, setVal: setManualOptB },
                  { key: 'C', val: manualOptC, setVal: setManualOptC },
                  { key: 'D', val: manualOptD, setVal: setManualOptD },
                ].map((item) => {
                  const isChecked = manualCorrect === item.key;
                  return (
                    <div
                      key={item.key}
                      className={`p-2.5 rounded-xl border flex items-center gap-2.5 bg-white ${
                        isChecked ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setManualCorrect(item.key as any)}
                        className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center font-mono cursor-pointer shrink-0 transition-colors ${
                          isChecked ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                        title="Đánh dấu đáp án đúng"
                      >
                        {item.key}
                      </button>
                      <input
                        type="text"
                        value={item.val}
                        onChange={(e) => item.setVal(e.target.value)}
                        placeholder={`Nội dung đáp án ${item.key}`}
                        className="flex-1 text-xs font-semibold text-slate-800 bg-transparent focus:outline-none"
                      />
                      {isChecked && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </div>
                  );
                })}
              </div>

              {/* Explanation & Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-600">Lời giải chi tiết</label>
                  <input
                    type="text"
                    value={manualExplanation}
                    onChange={(e) => setManualExplanation(e.target.value)}
                    placeholder="Giải thích vì sao chọn đáp án đúng..."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600">Thời gian làm bài</label>
                  <select
                    value={manualTime}
                    onChange={(e) => setManualTime(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={15}>15 giây</option>
                    <option value={20}>20 giây</option>
                    <option value={30}>30 giây (Chuẩn)</option>
                    <option value={45}>45 giây</option>
                    <option value={60}>60 giây</option>
                  </select>
                </div>
              </div>

              {/* CHUYỂN SANG CÂU TIẾP THEO / CÂU TRƯỚC RÕ RÀNG */}
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl">
                <button
                  type="button"
                  onClick={handleManualGoPrev}
                  disabled={activeManualIndex === 0}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 text-indigo-600" />
                  <span>← Quay lại Câu {Math.max(1, activeManualIndex)}</span>
                </button>

                <div className="text-xs font-bold text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-lg">
                  {activeManualIndex < generatedQuestions.length
                    ? `Đang xem/sửa Câu ${activeManualIndex + 1}`
                    : `Đang soạn Câu mới (${activeManualIndex + 1})`}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveManualAndNext(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-slate-600" />
                    <span>Lưu câu này</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveManualAndNext(true)}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs md:text-sm flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Lưu & Soạn câu tiếp theo</span>
                    <ArrowRight className="w-4 h-4 text-amber-300" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. File Import Panel */}
          {creationMode === 'file' && (
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.xlsx,.xls,.csv,.txt,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-white p-8 rounded-2xl cursor-pointer transition-all hover:shadow-md flex flex-col items-center justify-center group"
              >
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center text-indigo-600 mb-3 transition-colors">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-black text-slate-900 mb-1">
                  {isParsingFile ? 'Đang phân tích tệp...' : 'Bấm vào đây hoặc Kéo thả tệp đề bài vào'}
                </h4>
                <p className="text-xs text-slate-500 max-w-md mb-3">
                  Hỗ trợ Word (<strong>.docx</strong>), Excel (<strong>.xlsx, .csv</strong>), hoặc Text (<strong>.txt, .json</strong>).
                </p>
                <div className="flex items-center gap-2 text-[11px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Chuẩn format: Câu 1: ... A. ... B. ... C. ... D. ... Đáp án: A</span>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
              <X className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Generated Questions List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <ListOrdered className="w-4 h-4 text-indigo-600" />
                <span>Danh Sách Câu Hỏi ({generatedQuestions.length} câu)</span>
              </h3>
              <button
                onClick={handleAddManualQuestion}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>Thêm Câu Trống</span>
              </button>
            </div>

            {generatedQuestions.length === 0 ? (
              <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <HelpCircle className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-60" />
                <p className="text-sm font-bold text-slate-700">Chưa có câu hỏi nào trong danh sách</p>
                <p className="text-xs text-slate-500 mt-1">
                  Chọn <strong>Tạo bằng AI</strong>, <strong>Nhập thủ công</strong>, hoặc <strong>Nhập từ file</strong> ở trên để tạo đề.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {generatedQuestions.map((q, idx) => {
                  const isEditing = editingIndex === idx;

                  return (
                    <div
                      key={q.id || idx}
                      className={`p-4 rounded-2xl border transition-all ${
                        isEditing
                          ? 'border-indigo-500 bg-indigo-50/30 shadow-md'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {/* Question Header */}
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-black text-xs font-mono">
                            Câu {idx + 1}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {q.timeLimit || 30}s
                          </span>
                          {q.difficulty && (
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                              {q.difficulty}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* AI Voice Audio Button */}
                          <button
                            type="button"
                            onClick={() => handleToggleSpeakQuestion(q)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                              readingQuestionId === q.id
                                ? 'bg-rose-600 text-white animate-pulse shadow-xs'
                                : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600'
                            }`}
                            title={readingQuestionId === q.id ? 'Dừng đọc AI' : 'Nghe AI đọc câu hỏi và các phương án'}
                          >
                            {readingQuestionId === q.id ? (
                              <>
                                <Square className="w-3.5 h-3.5 fill-current" />
                                <span className="text-[11px]">Dừng</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="text-[11px]">Nghe AI</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => setEditingIndex(isEditing ? null : idx)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                            title={isEditing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa câu hỏi này'}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(idx)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500 transition-colors"
                            title="Xóa câu hỏi này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Question Text */}
                      {isEditing ? (
                        <textarea
                          value={q.question}
                          onChange={(e) => {
                            const val = e.target.value;
                            setGeneratedQuestions((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, question: val } : item))
                            );
                          }}
                          className="w-full p-2 rounded-xl bg-white border border-indigo-300 text-sm font-semibold focus:outline-none mb-3"
                          rows={2}
                        />
                      ) : (
                        <div className="font-bold text-slate-900 text-sm mb-3">
                          <QuizRichContentRenderer
                            content={q.question}
                            diagramType={q.diagramType}
                            diagramData={q.diagramData}
                          />
                        </div>
                      )}

                      {/* Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt) => {
                          const isCorrect = q.correctAnswer === opt.key;

                          return (
                            <div
                              key={opt.key}
                              onClick={() => {
                                if (isEditing) {
                                  setGeneratedQuestions((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, correctAnswer: opt.key } : item
                                    )
                                  );
                                }
                              }}
                              className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${
                                isCorrect
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                              } ${isEditing ? 'cursor-pointer hover:border-emerald-500' : ''}`}
                            >
                              <span
                                className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center font-mono shrink-0 ${
                                  isCorrect ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-300 text-slate-700'
                                }`}
                              >
                                {opt.key}
                              </span>

                              {isEditing ? (
                                <input
                                  type="text"
                                  value={opt.text}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setGeneratedQuestions((prev) =>
                                      prev.map((item, i) => {
                                        if (i !== idx) return item;
                                        const newOpts = item.options.map((o) =>
                                          o.key === opt.key ? { ...o, text: val } : o
                                        );
                                        return { ...item, options: newOpts };
                                      })
                                    );
                                  }}
                                  className="flex-1 bg-transparent border-b border-slate-300 text-xs font-semibold focus:outline-none"
                                />
                              ) : (
                                <span className="text-xs flex-1">
                                  <MathFormulaRenderer content={opt.text} />
                                </span>
                              )}

                              {isCorrect && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 ml-auto shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      {q.explanation && (
                        <div className="mt-2.5 p-2 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11px] text-amber-900 flex items-start gap-1.5">
                          <span className="font-bold shrink-0">💡 Lời giải:</span>
                          {isEditing ? (
                            <input
                              type="text"
                              value={q.explanation}
                              onChange={(e) => {
                                const val = e.target.value;
                                setGeneratedQuestions((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, explanation: val } : item
                                  )
                                );
                              }}
                              className="flex-1 bg-transparent border-b border-amber-300 text-[11px] focus:outline-none"
                            />
                          ) : (
                            <span className="flex-1">
                              <MathFormulaRenderer content={q.explanation} />
                            </span>
                          )}
                        </div>
                      )}

                      {/* Navigation bar while editing question in list */}
                      {isEditing && (
                        <div className="mt-3.5 pt-3 border-t border-indigo-200/70 flex flex-wrap items-center justify-between gap-2 bg-indigo-50/60 p-2.5 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setEditingIndex(Math.max(0, idx - 1))}
                            disabled={idx === 0}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                          >
                            <ArrowLeft className="w-3.5 h-3.5 text-indigo-600" />
                            <span>← Câu trước ({idx})</span>
                          </button>

                          <span className="text-[11px] font-black text-indigo-900 bg-white px-2.5 py-1 rounded-md border border-indigo-200">
                            Đang sửa Câu {idx + 1} / {generatedQuestions.length}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (idx < generatedQuestions.length - 1) {
                                  setEditingIndex(idx + 1);
                                } else {
                                  handleAddManualQuestion();
                                }
                              }}
                              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                            >
                              <span>
                                {idx < generatedQuestions.length - 1
                                  ? `Sang Câu ${idx + 2} →`
                                  : '+ Thêm câu tiếp theo'}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => setEditingIndex(null)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
                            >
                              Xong
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span>Thay thế toàn bộ câu hỏi hiện tại</span>
            </label>
            {generatedQuestions.length > 0 && (
              <span className="text-xs text-indigo-600 font-semibold">• Đã có {generatedQuestions.length} câu</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Hủy Bỏ
            </button>
            <button
              onClick={handleSaveAndApply}
              disabled={generatedQuestions.length === 0}
              className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-black text-xs md:text-sm flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Áp Dụng Vào Lớp Học & Phòng Thi</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
