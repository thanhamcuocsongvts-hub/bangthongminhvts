import React, { useState } from 'react';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  Edit2,
} from 'lucide-react';
import { QuizQuestion } from '../types';
import { MathFormulaRenderer } from './MathFormulaRenderer';

interface FileQuizImportModalProps {
  onClose: () => void;
  onApplyQuestions: (questions: QuizQuestion[], quizTitle?: string, replace?: boolean) => void;
}

export const FileQuizImportModal: React.FC<FileQuizImportModalProps> = ({
  onClose,
  onApplyQuestions,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [parsedQuestions, setParsedQuestions] = useState<QuizQuestion[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState<boolean>(true);
  const [examTitle, setExamTitle] = useState<string>('Đề thi nhập từ tệp');

  // Handle file select
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setExamTitle(selected.name.replace(/\.[^/.]+$/, ''));
    setErrorMessage(null);

    // Read content
    try {
      const text = await selected.text();
      setPastedText(text);
    } catch (err) {
      console.warn('Could not read text directly, will send filename', err);
    }
  };

  // Process and extract questions
  const handleParseQuestions = async () => {
    const contentToParse = pastedText.trim();
    if (!contentToParse && !file) {
      setErrorMessage('Vui lòng chọn tệp hoặc dán nội dung đề thi vào ô văn bản.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // 1. If JSON format
      if (contentToParse.startsWith('[') || contentToParse.startsWith('{')) {
        try {
          const json = JSON.parse(contentToParse);
          const list = Array.isArray(json) ? json : json.questions;
          if (Array.isArray(list) && list.length > 0) {
            setParsedQuestions(list);
            setIsProcessing(false);
            return;
          }
        } catch (_) {
          // not plain json, proceed to API
        }
      }

      // 2. Call server AI parser
      const res = await fetch('/api/ai/parse-quiz-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileContent: contentToParse || (file ? `Tệp: ${file.name}` : ''),
          fileName: file?.name || examTitle,
        }),
      });

      const data = await res.json();
      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        setParsedQuestions(data.questions);
      } else {
        setErrorMessage('Không thể tìm thấy câu hỏi trong tệp. Hãy kiểm tra định dạng hoặc dán văn bản trực tiếp.');
      }
    } catch (err: any) {
      console.error('Parse file error:', err);
      setErrorMessage('Lỗi xử lý tệp: ' + (err?.message || 'Vui lòng thử lại'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    if (parsedQuestions.length === 0) return;
    onApplyQuestions(parsedQuestions, examTitle, replaceExisting);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 select-none animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-teal-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20">
              <Upload className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black tracking-tight">
                Nhập Đề Thi Trắc Nghiệm Từ File
              </h2>
              <p className="text-xs text-emerald-100">
                Tự động bóc tách từ Word (.docx), Excel (.xlsx), PDF, Text (.txt) hoặc JSON
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

        {/* Content Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 shrink-0">
          <button
            onClick={() => setActiveTab('upload')}
            className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Tải Tệp Lên</span>
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'paste'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Dán Nội Dung Văn Bản</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {parsedQuestions.length === 0 ? (
            <>
              {activeTab === 'upload' ? (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-8 text-center transition-all bg-slate-50 hover:bg-emerald-50/20">
                    <input
                      type="file"
                      id="quiz-file-upload"
                      className="hidden"
                      accept=".txt,.doc,.docx,.pdf,.xlsx,.csv,.json"
                      onChange={handleFileChange}
                    />
                    <label
                      htmlFor="quiz-file-upload"
                      className="cursor-pointer flex flex-col items-center justify-center space-y-3"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                        <Upload className="w-8 h-8" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          {file ? file.name : 'Nhấp để chọn tệp đề thi hoặc kéo thả vào đây'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Hỗ trợ định dạng Word (.docx), Excel (.xlsx, .csv), PDF, TXT, JSON
                        </p>
                      </div>
                      <span className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs">
                        Chọn Tệp Từ Máy Tính
                      </span>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      Dán văn bản đề thi trắc nghiệm:
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Hệ thống tự nhận diện các câu: "Câu 1: ... A. ... B. ... C. ... D. ..."
                    </span>
                  </div>
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    rows={8}
                    className="w-full p-4 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder={`Ví dụ mẫu:\nCâu 1: Hàm số y = x^3 - 3x có bao nhiêu điểm cực trị?\nA. 0\nB. 1\nC. 2\nD. 3\nĐáp án: C\n\nCâu 2: ...`}
                  />
                </div>
              )}

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleParseQuestions}
                  disabled={isProcessing}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Đang bóc tách câu hỏi...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-emerald-200" />
                      <span>Bóc Tách Câu Hỏi Tự Động</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* Parsed Questions Preview */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-bold text-slate-800">
                    Đã bóc tách thành công {parsedQuestions.length} câu hỏi trắc nghiệm
                  </span>
                </div>
                <button
                  onClick={() => setParsedQuestions([])}
                  className="text-xs text-indigo-600 hover:underline font-bold cursor-pointer"
                >
                  Chọn tệp khác
                </button>
              </div>

              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {parsedQuestions.map((q, idx) => (
                  <div key={q.id || idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-2">
                    <div className="text-xs font-black text-emerald-700 flex items-center gap-1.5">
                      <span>CÂU {idx + 1}:</span>
                      <span className="font-medium text-slate-800">
                        <MathFormulaRenderer text={q.question} />
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt) => (
                        <div
                          key={opt.key}
                          className={`p-2 rounded-lg text-xs flex items-center gap-2 border ${
                            q.correctAnswer === opt.key
                              ? 'bg-emerald-100/70 border-emerald-300 text-emerald-950 font-bold'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <span className="w-5 h-5 rounded-md bg-white flex items-center justify-center font-bold text-[11px] border border-slate-200">
                            {opt.key}
                          </span>
                          <span className="truncate">
                            <MathFormulaRenderer text={opt.text} />
                          </span>
                        </div>
                      ))}
                    </div>

                    {q.explanation && (
                      <p className="text-[11px] text-slate-500 italic pt-1">
                        Giải thích: {q.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {parsedQuestions.length > 0 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>Thay thế toàn bộ câu hỏi hiện tại</span>
            </label>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleApply}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>Áp Dụng Vào Lớp Học ({parsedQuestions.length} câu)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
