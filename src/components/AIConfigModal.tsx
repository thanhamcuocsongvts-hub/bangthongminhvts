import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff,
  Cpu,
  HelpCircle,
  Info,
} from 'lucide-react';
import { getGeminiApiKey, saveGeminiApiKey, testGeminiApiKey } from '../utils/geminiClient';

interface AIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyUpdated?: () => void;
}

export const AIConfigModal: React.FC<AIConfigModalProps> = ({
  isOpen,
  onClose,
  onKeyUpdated,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [connectedModel, setConnectedModel] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      const current = getGeminiApiKey();
      setApiKey(current);
      setStatus('idle');
      setMessage('');
      if (current) {
        // Quick auto-test existing key
        handleTest(current);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async (keyToTest = apiKey) => {
    if (!keyToTest.trim()) {
      setStatus('error');
      setMessage('Vui lòng nhập API Key trước khi kiểm tra');
      return;
    }
    setStatus('testing');
    setMessage('Đang kiểm tra kết nối với Google Gemini AI...');

    const result = await testGeminiApiKey(keyToTest.trim());
    if (result.success) {
      setStatus('success');
      setMessage(result.message);
      if (result.model) setConnectedModel(result.model);
    } else {
      setStatus('error');
      setMessage(result.message);
    }
  };

  const handleSave = () => {
    saveGeminiApiKey(apiKey.trim());
    onKeyUpdated?.();
    if (apiKey.trim()) {
      handleTest(apiKey.trim());
    } else {
      setStatus('idle');
      setMessage('Đã xóa API Key lưu trên trình duyệt.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="bg-slate-900 rounded-3xl w-full max-w-xl flex flex-col shadow-2xl border border-slate-700 overflow-hidden text-white">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-700 via-indigo-700 to-emerald-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 border border-white/20">
              <Sparkles className="w-6 h-6 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black tracking-tight flex items-center gap-2">
                <span>Cấu Hình Gemini AI & API Key</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/40">
                  Google Gemini 2.5/Flash
                </span>
              </h3>
              <p className="text-xs text-purple-200">
                Kích hoạt nhận diện chữ viết tay xấu thành chữ đẹp & soạn đề thi tự động
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

        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh] custom-scrollbar">
          {/* Vercel Deployment Troubleshooting Note */}
          <div className="p-4 rounded-2xl bg-indigo-950/60 border border-indigo-500/40 space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-black uppercase tracking-wider">
              <Info className="w-4 h-4 text-amber-400" />
              <span>Lý do khi đưa lên Vercel không gọi được AI?</span>
            </div>
            <div className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
              <p>
                1. <strong>Tên biến môi trường trên Vercel:</strong> Do ứng dụng chạy trên nền Vite React, Vercel chỉ truyền các biến có tiền tố <code className="text-amber-300 font-mono bg-black/40 px-1 py-0.5 rounded">VITE_</code> vào trình duyệt. Nếu đặt là <code className="text-rose-300 font-mono bg-black/40 px-1 py-0.5 rounded">GEMINI_API_KEY</code> thì trình duyệt sẽ bị chặn không đọc được. Cần đặt là <code className="text-emerald-300 font-mono bg-black/40 px-1 py-0.5 rounded">VITE_GEMINI_API_KEY</code>.
              </p>
              <p>
                2. <strong>Giải pháp nhanh nhất 100% hiệu quả:</strong> Quý Thầy/Cô chỉ cần <strong>dán API Key vào ô bên dưới</strong> rồi nhấn <strong>"Lưu & Kiểm tra"</strong>. Hệ thống sẽ lưu trực tiếp trên trình duyệt của Thầy/Cô và kích hoạt ngay lập tức tất cả tính năng AI mà không cần cấu hình lại Vercel!
              </p>
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-300 uppercase tracking-wider">
              Khóa Google Gemini API Key (Bắt đầu bằng AIzaSy...):
            </label>
            <div className="relative flex items-center">
              <KeyRound className="w-4 h-4 text-slate-500 absolute left-3.5 pointer-events-none" />
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setStatus('idle');
                }}
                placeholder="Dán API Key tại đây (ví dụ: AIzaSy...)"
                className="w-full pl-10 pr-20 py-3 rounded-2xl bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-xs font-mono text-white placeholder-slate-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 p-1.5 text-slate-400 hover:text-white cursor-pointer"
                title={showKey ? 'Ẩn' : 'Hiện'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Khóa API được lưu an toàn trong bộ nhớ riêng (LocalStorage) của trình duyệt trên thiết bị này.
            </p>
          </div>

          {/* Status Message */}
          {status !== 'idle' && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
                status === 'testing'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : status === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}
            >
              {status === 'testing' && <RefreshCw className="w-4 h-4 animate-spin shrink-0" />}
              {status === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
              {status === 'error' && <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />}
              <span className="leading-relaxed">{message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 underline underline-offset-2"
            >
              <span>Lấy API Key miễn phí tại Google AI Studio</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleTest()}
                disabled={status === 'testing' || !apiKey.trim()}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Kiểm tra kết nối
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={status === 'testing'}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-black text-xs shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-200" />
                <span>Lưu & Kích Hoạt</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
