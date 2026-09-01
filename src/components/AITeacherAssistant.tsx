import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  HelpCircle,
  BookOpen,
  Zap,
  RefreshCw,
  Copy,
  Check,
  FileText,
  Layers,
  ChevronDown,
  Info,
  SlidersHorizontal,
  Bookmark,
  Compass,
} from 'lucide-react';
import { ChatMessage, LessonDoc, TextScale } from '../types';

interface AITeacherAssistantProps {
  lesson: LessonDoc;
  textScale: TextScale;
  messages: ChatMessage[];
  onSendMessage: (text: string, customContext?: string, scopeTitle?: string) => Promise<void>;
  isLoading: boolean;
  onInsertToWhiteboard?: (text: string) => void;
}

export const AITeacherAssistant: React.FC<AITeacherAssistantProps> = ({
  lesson,
  textScale,
  messages,
  onSendMessage,
  isLoading,
  onInsertToWhiteboard,
}) => {
  const [inputVal, setInputVal] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [scopeMode, setScopeMode] = useState<'slide' | 'all' | 'custom'>('slide');
  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number>(0);
  const [customSnippet, setCustomSnippet] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const slides = lesson.slides || [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Compute the current active context text based on selected scope
  const getActiveScopeContext = () => {
    if (scopeMode === 'slide' && slides.length > 0) {
      const s = slides[selectedSlideIndex] || slides[0];
      const title = s?.title || `Slide ${selectedSlideIndex + 1}`;
      const content = `${s?.title || ''}\n${s?.subtitle || ''}\n${s?.content || ''}\n${s?.formula ? `Công thức: ${s.formula}` : ''}\n${s?.keyTakeaway ? `Ghi nhớ: ${s.keyTakeaway}` : ''}`;
      return {
        text: content.trim() || lesson.rawText,
        scopeTitle: `Trang/Slide ${selectedSlideIndex + 1}: ${title}`,
        charCount: content.length,
      };
    }

    if (scopeMode === 'custom' && customSnippet.trim()) {
      return {
        text: customSnippet.trim(),
        scopeTitle: `Đoạn trích do Giáo viên chọn (${customSnippet.slice(0, 30)}...)`,
        charCount: customSnippet.length,
      };
    }

    return {
      text: lesson.rawText,
      scopeTitle: `Toàn bộ bài giảng: ${lesson.title}`,
      charCount: lesson.rawText.length,
    };
  };

  const currentScope = getActiveScopeContext();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isLoading) return;
    const text = inputVal.trim();
    setInputVal('');
    onSendMessage(text, currentScope.text, currentScope.scopeTitle);
  };

  const handleQuickPrompt = (promptText: string) => {
    if (isLoading) return;
    onSendMessage(promptText, currentScope.text, currentScope.scopeTitle);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Font scale classes for readability on 75" TV
  const getScaleClasses = () => {
    switch (textScale) {
      case 'huge':
        return {
          bubble: 'text-2xl md:text-3xl leading-relaxed',
          input: 'text-2xl py-4',
          prompt: 'text-xl py-3 px-5',
        };
      case 'large':
        return {
          bubble: 'text-xl md:text-2xl leading-relaxed',
          input: 'text-xl py-3.5',
          prompt: 'text-lg py-2.5 px-4',
        };
      case 'normal':
      default:
        return {
          bubble: 'text-base md:text-lg leading-relaxed',
          input: 'text-base py-3',
          prompt: 'text-sm py-2 px-3',
        };
    }
  };

  const scale = getScaleClasses();

  return (
    <div id="ai-chat-viewport" className="relative w-full h-[calc(100vh-100px)] flex flex-col bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-md">
      {/* Top AI Header */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white z-20 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">TRỢ LÝ SƯ PHẠM AI (GEMINI 3.7 FLASH)</h2>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-400/30">
                Phản hồi ~1.2s
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Hỗ trợ Thầy/Cô khai thác kiến thức, tạo ví dụ thực tế & giải đáp theo từng phạm vi bài học.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Guide Toggle */}
          <button
            onClick={() => setShowGuide(!showGuide)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
              showGuide
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                : 'bg-white/10 text-amber-300 hover:bg-white/20 border-white/20'
            }`}
            title="Xem hướng dẫn cách ứng dụng AI trong giảng dạy"
          >
            <Info className="w-4 h-4" />
            <span>{showGuide ? 'Ẩn Hướng Dẫn' : 'Hướng Dẫn Dùng AI'}</span>
          </button>
        </div>
      </div>

      {/* SCOPE SELECTION BAR (User requested: Select by page, chapter, or custom snippet to save time) */}
      <div className="px-6 py-2.5 bg-indigo-50/90 border-b border-indigo-100 flex items-center justify-between flex-wrap gap-2 text-xs font-semibold text-slate-700">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-indigo-900 font-bold flex items-center gap-1">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            Phạm vi AI phân tích:
          </span>

          {/* Scope Mode Buttons */}
          <div className="flex items-center bg-white border border-indigo-200 rounded-xl p-0.5 shadow-2xs">
            <button
              onClick={() => setScopeMode('slide')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                scopeMode === 'slide'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-indigo-50'
              }`}
            >
              🎯 Theo Trang / Slide Cụ Thể
            </button>
            <button
              onClick={() => setScopeMode('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                scopeMode === 'all'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-indigo-50'
              }`}
            >
              📚 Cả Bài Học
            </button>
            <button
              onClick={() => setScopeMode('custom')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                scopeMode === 'custom'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-indigo-50'
              }`}
            >
              ✂️ Đoạn Trích Tùy Chọn
            </button>
          </div>

          {/* If Slide mode is active: select specific slide */}
          {scopeMode === 'slide' && slides.length > 0 && (
            <select
              value={selectedSlideIndex}
              onChange={(e) => setSelectedSlideIndex(Number(e.target.value))}
              className="px-3 py-1 rounded-xl bg-white border border-indigo-300 text-indigo-950 font-bold text-xs focus:ring-2 focus:ring-indigo-500 shadow-2xs cursor-pointer max-w-[280px] truncate"
            >
              {slides.map((s, idx) => (
                <option key={s.id || idx} value={idx}>
                  Trang {idx + 1}: {s.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Scope Status Badge */}
        <div className="px-3 py-1 rounded-xl bg-white border border-indigo-200 text-indigo-700 text-xs font-mono font-bold flex items-center gap-1.5 shadow-2xs">
          <Bookmark className="w-3.5 h-3.5 text-indigo-500" />
          <span>{currentScope.scopeTitle}</span>
          <span className="text-slate-400">({currentScope.charCount} ký tự)</span>
        </div>
      </div>

      {/* If Custom Snippet mode is active: allow teacher to type or paste excerpt */}
      {scopeMode === 'custom' && (
        <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <input
            type="text"
            value={customSnippet}
            onChange={(e) => setCustomSnippet(e.target.value)}
            placeholder="Dán hoặc gõ đoạn văn, bài toán hoặc định lý muốn AI tập trung giải đáp..."
            className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => setCustomSnippet('')}
            className="px-2 py-1 rounded-lg bg-slate-200 text-slate-600 text-xs hover:bg-slate-300"
          >
            Xóa đoạn
          </button>
        </div>
      )}

      {/* Teacher Guide Callout Card (When toggled) */}
      {showGuide && (
        <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 text-slate-800 text-xs animate-fade-in shadow-inner">
          <h4 className="font-black text-amber-900 text-sm mb-2 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-amber-700" />
            CÁCH KHAI THÁC HIỆU QUẢ TRỢ LÝ AI TRÊN SMARTBOARD:
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl bg-white/90 border border-amber-200/80 shadow-2xs">
              <span className="font-bold text-amber-800 block mb-1">1. Tóm tắt & Trích xuất cốt lõi</span>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Bấm nút "Tóm tắt 3 ý cốt lõi" để AI rút gọn định lý thành các gạch đầu dòng dễ hiểu, giúp học sinh ghi chép nhanh.
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-white/90 border border-amber-200/80 shadow-2xs">
              <span className="font-bold text-amber-800 block mb-1">2. Ví dụ thực tiễn sinh động</span>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Bấm "Ứng dụng thực tế" khi học sinh hỏi kiến thức này dùng làm gì. AI sẽ liên hệ các ứng dụng công nghệ, đời sống hiện đại.
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-white/90 border border-amber-200/80 shadow-2xs">
              <span className="font-bold text-amber-800 block mb-1">3. Giới hạn phạm vi (Tăng tốc độ)</span>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Chọn đúng Slide/Trang đang dạy để AI không phải đọc cả cuốn sách dày, giúp câu trả lời chính xác và tức thì trong 1 giây.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Preset Quick Prompts for Teachers on 75" TV */}
      <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 shrink-0">
          Gợi ý nhanh:
        </span>
        <button
          onClick={() => handleQuickPrompt('Hãy tóm tắt 3 điểm mấu chốt nhất của phần kiến thức này dưới dạng 3 gạch đầu dòng cực kỳ dễ nhớ.')}
          className={`shrink-0 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition-all shadow-2xs ${scale.prompt}`}
        >
          📌 Tóm tắt 3 ý cốt lõi
        </button>
        <button
          onClick={() => handleQuickPrompt('Học sinh hỏi: Ứng dụng thực tế của kiến thức này trong đời sống hiện đại là gì? Hãy giải thích với 2 ví dụ trực quan sinh động.')}
          className={`shrink-0 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition-all shadow-2xs ${scale.prompt}`}
        >
          💡 Ứng dụng thực tế sinh động
        </button>
        <button
          onClick={() => handleQuickPrompt('Trích xuất tất cả công thức hoặc định nghĩa quan trọng từ nội dung này kèm lưu ý khi áp dụng.')}
          className={`shrink-0 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition-all shadow-2xs ${scale.prompt}`}
        >
          📐 Trích xuất công thức & định nghĩa
        </button>
        <button
          onClick={() => handleQuickPrompt('Hãy đưa ra một câu hỏi tình huống tư duy phản biện để kích thích học sinh thảo luận.')}
          className={`shrink-0 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition-all shadow-2xs ${scale.prompt}`}
        >
          🎯 Câu hỏi thảo luận phản biện
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6 bg-white">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-4 shadow-2xs">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Trợ Lý Sư Phạm Sẵn Sàng</h3>
            <p className="text-slate-600 max-w-lg text-base">
              Thầy/Cô có thể bấm các nút gợi ý nhanh bên trên hoặc nhập câu hỏi của học sinh. AI sẽ tự động phân tích theo phạm vi: <strong className="text-indigo-700">{currentScope.scopeTitle}</strong>.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-4 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shrink-0 shadow-md">
                    <Bot className="w-5 h-5" />
                  </div>
                )}

                <div
                  className={`relative max-w-3xl p-6 rounded-3xl shadow-sm ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-600/20'
                      : 'bg-slate-50 border border-slate-200 text-slate-900 rounded-tl-none'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-2 pb-1 border-b border-slate-200/60 text-xs font-bold">
                    <span className={isUser ? 'text-indigo-200' : 'text-purple-700 flex items-center gap-1.5'}>
                      {!isUser && <Sparkles className="w-3.5 h-3.5 text-purple-600" />}
                      {isUser ? 'Giáo viên yêu cầu' : 'AI Trợ lý Sư phạm'}
                    </span>
                    <span className={isUser ? 'text-indigo-200' : 'text-slate-400'}>{msg.timestamp}</span>
                  </div>

                  <div className={`${scale.bubble} whitespace-pre-wrap leading-relaxed`}>
                    {msg.text}
                  </div>

                  {!isUser && (
                    <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-200 shadow-2xs"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Đã sao chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Sao chép câu trả lời</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-10 h-10 rounded-xl bg-indigo-700 flex items-center justify-center text-white shrink-0 shadow-md">
                    <User className="w-5 h-5" />
                  </div>
                )}
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex items-center gap-3 p-6 rounded-3xl bg-slate-50 border border-slate-200 max-w-md shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white animate-spin">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div className="text-base text-purple-700 font-bold animate-pulse">
              AI đang phân tích theo phạm vi: {currentScope.scopeTitle}...
            </div>
          </div>
        )}
      </div>

      {/* Chat Input Bar for 75" Touch Display */}
      <form onSubmit={handleSubmit} className="p-4 md:p-6 bg-slate-50 border-t border-slate-200 flex items-center gap-3">
        <input
          id="ai-prompt-input"
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder={`Hỏi AI theo phạm vi [${currentScope.scopeTitle}]...`}
          className={`flex-1 px-6 rounded-2xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-2xs ${scale.input}`}
        />
        <button
          id="ai-send-btn"
          type="submit"
          disabled={!inputVal.trim() || isLoading}
          className="px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg flex items-center gap-2 shadow-md shadow-indigo-600/20 disabled:opacity-40 disabled:pointer-events-none transition-all active:scale-95"
        >
          <Send className="w-6 h-6" />
          <span className="hidden sm:inline">Gửi AI</span>
        </button>
      </form>
    </div>
  );
};
