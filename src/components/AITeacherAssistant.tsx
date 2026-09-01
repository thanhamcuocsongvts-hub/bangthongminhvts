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
  PlusCircle,
  Copy,
  Check,
  FileText,
} from 'lucide-react';
import { ChatMessage, LessonDoc, TextScale } from '../types';

interface AITeacherAssistantProps {
  lesson: LessonDoc;
  textScale: TextScale;
  messages: ChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
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
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isLoading) return;
    const text = inputVal.trim();
    setInputVal('');
    onSendMessage(text);
  };

  const handleQuickPrompt = (promptText: string) => {
    if (isLoading) return;
    onSendMessage(promptText);
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
      <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200 z-20">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">TRỢ LÝ AI TRÍCH XUẤT KIẾN THỨC BÀI HỌC</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200">
                Gemini 3.7 Flash
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Đang kết nối trực tiếp với kho tài liệu: <span className="text-indigo-700 font-semibold">{lesson.title}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-mono flex items-center gap-1.5 shadow-xs">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <span>Kho tài liệu: {lesson.rawText.length} ký tự</span>
          </div>
        </div>
      </div>

      {/* Preset Quick Prompts for Teachers on 75" TV */}
      <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 shrink-0">
          Gợi ý nhanh:
        </span>
        <button
          onClick={() => handleQuickPrompt('Hãy tóm tắt 3 điểm mấu chốt nhất của bài học này dưới dạng 3 gạch đầu dòng cực kỳ dễ nhớ.')}
          className={`shrink-0 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition-all shadow-xs ${scale.prompt}`}
        >
          📌 Tóm tắt 3 ý cốt lõi
        </button>
        <button
          onClick={() => handleQuickPrompt('Học sinh hỏi: Ứng dụng thực tế của kiến thức này trong đời sống hiện đại là gì? Hãy giải thích với ví dụ sinh động.')}
          className={`shrink-0 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition-all shadow-xs ${scale.prompt}`}
        >
          💡 Ứng dụng thực tế sinh động
        </button>
        <button
          onClick={() => handleQuickPrompt('Trích xuất tất cả công thức/định nghĩa quan trọng từ tài liệu đã nạp.')}
          className={`shrink-0 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition-all shadow-xs ${scale.prompt}`}
        >
          📐 Trích xuất công thức & định nghĩa
        </button>
        <button
          onClick={() => handleQuickPrompt('Hãy đưa ra một câu hỏi tình huống tư duy phản biện để kích thích học sinh thảo luận.')}
          className={`shrink-0 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition-all shadow-xs ${scale.prompt}`}
        >
          🎯 Câu hỏi thảo luận phản biện
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 p-6 md:p-8 overflow-y-auto space-y-6 bg-white">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-4 shadow-xs">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Trợ Lý Giảng Dạy Đã Sẵn Sàng</h3>
            <p className="text-slate-600 max-w-lg text-base">
              Giáo viên có thể nhập câu hỏi của học sinh hoặc bấm các nút gợi ý nhanh bên trên. AI sẽ tự động đối chiếu và trích xuất dữ liệu chính xác từ bài giảng.
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
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-200 shadow-xs"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600">Đã sao chép</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Sao chép</span>
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
          <div className="flex items-center gap-3 p-6 rounded-3xl bg-slate-50 border border-slate-200 max-w-md shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white animate-spin">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div className="text-base text-purple-700 font-bold animate-pulse">
              AI đang trích xuất dữ liệu từ bài giảng...
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
          placeholder="Nhập câu hỏi học sinh thắc mắc hoặc yêu cầu AI giải thích..."
          className={`flex-1 px-6 rounded-2xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium shadow-xs ${scale.input}`}
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
