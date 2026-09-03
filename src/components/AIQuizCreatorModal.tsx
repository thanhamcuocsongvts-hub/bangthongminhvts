import React, { useState } from 'react';
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
  ListOrdered,
  Clock,
  Award,
} from 'lucide-react';
import { QuizQuestion, LessonDoc } from '../types';

interface AIQuizCreatorModalProps {
  currentLesson?: LessonDoc | null;
  onClose: () => void;
  onApplyQuestions: (questions: QuizQuestion[], quizTitle?: string) => void;
}

export const AIQuizCreatorModal: React.FC<AIQuizCreatorModalProps> = ({
  currentLesson,
  onClose,
  onApplyQuestions,
}) => {
  const [topic, setTopic] = useState<string>(
    currentLesson?.title || 'Ôn tập kiến thức trọng tâm học kỳ'
  );
  const [subject, setSubject] = useState<string>(currentLesson?.subject || 'Toán học');
  const [grade, setGrade] = useState<string>(currentLesson?.grade || 'Lớp 12');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<'Cơ bản' | 'Thông hiểu' | 'Vận dụng' | 'Vận dụng cao'>('Thông hiểu');
  const [timeLimit, setTimeLimit] = useState<number>(30);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestion[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Trigger AI generation
  const handleGenerate = async () => {
    if (!topic.trim()) {
      setErrorMessage('Vui lòng nhập chủ đề bài học hoặc kiến thức cần tạo trắc nghiệm.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);

    const promptContext = `Chủ đề: ${topic}
Môn: ${subject}
Khối lớp: ${grade}
Số lượng câu hỏi: ${questionCount}
Mức độ: ${difficulty}
${currentLesson?.rawText ? `Nội dung tài liệu tham khảo: ${currentLesson.rawText.slice(0, 1500)}` : ''}`;

    try {
      const response = await fetch('/api/ai/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: promptContext,
          content: currentLesson?.rawText || promptContext,
          count: questionCount,
          subject,
          grade,
          difficulty,
        }),
      });

      const data = await response.json();
      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        const withLimits = data.questions.map((q: QuizQuestion, idx: number) => ({
          ...q,
          id: `ai_q_${Date.now()}_${idx + 1}`,
          timeLimit: q.timeLimit || timeLimit,
          difficulty: q.difficulty || difficulty,
        }));
        setGeneratedQuestions(withLimits);
      } else {
        setErrorMessage('Không thể tạo câu hỏi từ AI. Vui lòng thử lại với chủ đề chi tiết hơn.');
      }
    } catch (e: any) {
      console.error('Error generating AI quiz', e);
      setErrorMessage('Lỗi kết nối máy chủ AI: ' + (e?.message || 'Vui lòng kiểm tra kết nối mạng'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Add an empty custom manual question
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
    onApplyQuestions(generatedQuestions, `Trắc nghiệm: ${topic}`);
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
                AI Tạo Bộ Đề Trắc Nghiệm Ôn Tập Tự Động
              </h2>
              <p className="text-xs text-purple-200">
                Tạo nhanh câu hỏi chuẩn 4 đáp án A-B-C-D kèm lời giải chi tiết cho học sinh
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 custom-scrollbar">
          {/* Setup Form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            {/* Topic Input */}
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
                placeholder="Ví dụ: Quang hợp và hô hấp tế bào, Định luật II Newton, Giải phương trình bậc hai..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Subject */}
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

            {/* Grade */}
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

            {/* Question Count */}
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

            {/* Difficulty Level */}
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

            {/* Time limit per question */}
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

            {/* Generate Button */}
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

          {/* Error display */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
              <X className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
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
                <span>Thêm Câu Hỏi Thủ Công</span>
              </button>
            </div>

            {generatedQuestions.length === 0 ? (
              <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <HelpCircle className="w-10 h-10 mx-auto text-slate-400 mb-2 opacity-60" />
                <p className="text-sm font-bold text-slate-700">Chưa có câu hỏi nào</p>
                <p className="text-xs text-slate-500 mt-1">
                  Nhấn nút &ldquo;Tạo Đề Bằng AI&rdquo; ở trên để tự động sinh câu hỏi theo chuẩn giáo dục Việt Nam.
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

                        <div className="flex items-center gap-1">
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
                        <p className="font-bold text-slate-900 text-sm mb-3">{q.question}</p>
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
                                className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center font-mono ${
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
                                <span className="text-xs">{opt.text}</span>
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
                            <span>{q.explanation}</span>
                          )}
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
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            {generatedQuestions.length > 0 && (
              <span>Đã sẵn sàng {generatedQuestions.length} câu hỏi trắc nghiệm</span>
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
