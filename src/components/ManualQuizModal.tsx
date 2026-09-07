import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  CheckCircle2,
  HelpCircle,
  Clock,
  Sparkles,
  ArrowRight,
  BookOpen,
  Edit3,
} from 'lucide-react';
import { QuizQuestion } from '../types';
import { MathFormulaRenderer } from './MathFormulaRenderer';

interface ManualQuizModalProps {
  onClose: () => void;
  onApplyQuestions: (questions: QuizQuestion[], quizTitle?: string, replace?: boolean) => void;
  initialQuestions?: QuizQuestion[];
}

export const ManualQuizModal: React.FC<ManualQuizModalProps> = ({
  onClose,
  onApplyQuestions,
  initialQuestions = [],
}) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>(() => {
    if (initialQuestions.length > 0) return initialQuestions;
    return [
      {
        id: `manual_${Date.now()}_1`,
        question: 'Cho hàm số $y = x^3 - 3x^2 + 2$. Điểm cực đại của đồ thị hàm số là:',
        options: [
          { key: 'A', text: '$(0; 2)$' },
          { key: 'B', text: '$(2; -2)$' },
          { key: 'C', text: '$(0; 0)$' },
          { key: 'D', text: '$(1; 0)$' },
        ],
        correctAnswer: 'A',
        explanation: 'Ta có $y\' = 3x^2 - 6x = 0 \\Leftrightarrow x = 0$ hoặc $x = 2$. $y\'\' = 6x - 6$, tại $x = 0$ có $y\'\'(0) = -6 < 0$ nên đạt cực đại tại điểm $(0; 2)$.',
        timeLimit: 30,
        difficulty: 'Thông hiểu',
      },
    ];
  });

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [quizTitle, setQuizTitle] = useState<string>('Bộ Đề Trắc Nghiệm Tự Soạn');

  const currentQ = questions[activeIndex] || questions[0];

  const handleUpdateCurrent = (field: keyof QuizQuestion, val: any) => {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === activeIndex ? { ...q, [field]: val } : q))
    );
  };

  const handleUpdateOption = (optKey: 'A' | 'B' | 'C' | 'D', text: string) => {
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== activeIndex) return q;
        const newOpts = q.options.map((o) => (o.key === optKey ? { ...o, text } : o));
        return { ...q, options: newOpts };
      })
    );
  };

  const handleAddNewQuestion = () => {
    const newQ: QuizQuestion = {
      id: `manual_${Date.now()}_${questions.length + 1}`,
      question: `Câu hỏi số ${questions.length + 1}... (hỗ trợ công thức $x^2 + y^2 = r^2$)`,
      options: [
        { key: 'A', text: 'Đáp án A' },
        { key: 'B', text: 'Đáp án B' },
        { key: 'C', text: 'Đáp án C' },
        { key: 'D', text: 'Đáp án D' },
      ],
      correctAnswer: 'A',
      explanation: 'Giải thích chi tiết cho đáp án đúng.',
      timeLimit: 30,
      difficulty: 'Thông hiểu',
    };
    setQuestions((prev) => [...prev, newQ]);
    setActiveIndex(questions.length);
  };

  const handleDeleteQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    const next = questions.filter((_, i) => i !== idx);
    setQuestions(next);
    setActiveIndex(Math.max(0, Math.min(idx, next.length - 1)));
  };

  const handleApply = () => {
    if (questions.length === 0) return;
    onApplyQuestions(questions, quizTitle, replaceExisting);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 select-none animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20">
              <Edit3 className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black tracking-tight">
                Tự Soạn / Nhập Đề Trắc Nghiệm Thủ Công
              </h2>
              <p className="text-xs text-blue-200">
                Thầy/Cô soạn câu hỏi, 4 phương án A-B-C-D, hỗ trợ gõ công thức Toán KaTeX $...$
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

        {/* Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Sidebar: Questions list */}
          <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 p-4 flex flex-col shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Danh sách ({questions.length} câu)
              </span>
              <button
                onClick={handleAddNewQuestion}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {questions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  onClick={() => setActiveIndex(idx)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                    activeIndex === idx
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="truncate flex-1 pr-2">
                    <span className="text-xs font-black mr-1.5 text-indigo-600">Câu {idx + 1}:</span>
                    <span className="text-xs truncate">
                      {q.question.replace(/\$/g, '').slice(0, 30)}...
                    </span>
                  </div>
                  {questions.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteQuestion(idx);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 cursor-pointer"
                      title="Xóa câu hỏi này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Quiz Title Config */}
            <div className="pt-3 border-t border-slate-200">
              <label className="block text-xs font-bold text-slate-600 mb-1">Tên bộ đề:</label>
              <input
                type="text"
                value={quizTitle}
                onChange={(e) => setQuizTitle(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Main Question Editor */}
          {currentQ && (
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {/* Question Text Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-black text-xs">
                      CÂU {activeIndex + 1}
                    </span>
                    <span>Nội dung câu hỏi:</span>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Mẹo: Gõ công thức trong dấu $...$ (VD: $x^2 + 2x - 3 = 0$)
                  </span>
                </div>
                <textarea
                  value={currentQ.question}
                  onChange={(e) => handleUpdateCurrent('question', e.target.value)}
                  rows={3}
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Nhập nội dung câu hỏi tại đây..."
                />
                {/* Live Preview Question */}
                <div className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800">
                  <span className="font-bold text-indigo-600 mr-2">Xem trước hiển thị:</span>
                  <MathFormulaRenderer text={currentQ.question} />
                </div>
              </div>

              {/* 4 Options */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 block">
                  4 Phương án A, B, C, D (Nhấp vào chữ cái để chọn đáp án đúng):
                </label>
                {(['A', 'B', 'C', 'D'] as const).map((key) => {
                  const opt = currentQ.options.find((o) => o.key === key) || { key, text: '' };
                  const isCorrect = currentQ.correctAnswer === key;
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
                        isCorrect
                          ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/30'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleUpdateCurrent('correctAnswer', key)}
                        className={`w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                          isCorrect
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                        title="Bấm để chọn đây là đáp án ĐÚNG"
                      >
                        {key}
                      </button>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleUpdateOption(key, e.target.value)}
                        placeholder={`Nội dung phương án ${key}...`}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium focus:outline-none focus:border-indigo-500"
                      />
                      <div className="w-1/3 truncate text-xs text-slate-600 px-2">
                        <MathFormulaRenderer text={opt.text || '...'} />
                      </div>
                      {isCorrect && (
                        <span className="text-xs font-black text-emerald-600 px-2 py-1 rounded-md bg-emerald-100">
                          Đáp án đúng
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Explanation & Time Limit */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 mb-1 block">
                    Lời giải chi tiết:
                  </label>
                  <input
                    type="text"
                    value={currentQ.explanation || ''}
                    onChange={(e) => handleUpdateCurrent('explanation', e.target.value)}
                    placeholder="Giải thích ngắn gọn cho học sinh sau khi làm bài..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">
                    Thời gian làm bài:
                  </label>
                  <select
                    value={currentQ.timeLimit || 30}
                    onChange={(e) => handleUpdateCurrent('timeLimit', Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value={15}>15 Giây</option>
                    <option value={20}>20 Giây</option>
                    <option value={30}>30 Giây</option>
                    <option value={45}>45 Giây</option>
                    <option value={60}>60 Giây</option>
                    <option value={90}>90 Giây</option>
                  </select>
                </div>
              </div>
            </div>
          )}
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
              <span>Thay thế toàn bộ câu hỏi hiện tại bằng bộ đề này</span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>Áp Dụng Vào Lớp Học ({questions.length} câu)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
