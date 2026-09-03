import React, { useState } from 'react';
import {
  Globe,
  Youtube,
  ExternalLink,
  RefreshCw,
  Maximize2,
  X,
  Sparkles,
  Search,
  Compass,
  Check,
  AlertCircle,
  Pen,
  ChevronRight,
} from 'lucide-react';
import { TouchWhiteboard } from './TouchWhiteboard';

interface ExternalContentEmbedderProps {
  initialUrl?: string;
  onClose?: () => void;
  isCompact?: boolean;
}

const EDUCATIONAL_PRESETS = [
  {
    name: 'GeoGebra Toán 3D',
    category: 'Toán Học',
    url: 'https://www.geogebra.org/3d?lang=vi',
    description: 'Vẽ hình không gian, đồ thị hàm số 3D trực quan',
    icon: '📐',
  },
  {
    name: 'PhET Mô Phỏng Vật Lý',
    category: 'Vật Lý',
    url: 'https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics_vi.html',
    description: 'Thí nghiệm ảo lực và chuyển động tương tác',
    icon: '⚡',
  },
  {
    name: 'PhET Bảng Tuần Hoàn Hóa Học',
    category: 'Hóa Học',
    url: 'https://ptable.com/?lang=vi',
    description: 'Bảng tuần hoàn các nguyên tố hóa học tương tác 3D',
    icon: '🧪',
  },
  {
    name: 'Google Earth Khám Phá',
    category: 'Địa Lý',
    url: 'https://earth.google.com/web/',
    description: 'Bản đồ địa cầu vệ tinh 3D sống động toàn cầu',
    icon: '🌍',
  },
];

export const ExternalContentEmbedder: React.FC<ExternalContentEmbedderProps> = ({
  initialUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  onClose,
  isCompact = false,
}) => {
  const [urlInput, setUrlInput] = useState<string>('');
  const [currentUrl, setCurrentUrl] = useState<string>(initialUrl);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAnnotating, setIsAnnotating] = useState<boolean>(false);
  const [embedError, setEmbedError] = useState<string | null>(null);

  // Transform YouTube watch link or shorts into embeddable iframe URL
  const formatEmbedUrl = (raw: string): string => {
    let clean = raw.trim();
    if (!clean) return '';

    // Add protocol if missing
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }

    try {
      const parsed = new URL(clean);

      // YouTube standard video: youtube.com/watch?v=ID
      if (parsed.hostname.includes('youtube.com')) {
        const v = parsed.searchParams.get('v');
        if (v) {
          return `https://www.youtube.com/embed/${v}?autoplay=1&rel=0`;
        }
        if (parsed.pathname.startsWith('/shorts/')) {
          const shortId = parsed.pathname.split('/shorts/')[1]?.split('?')[0];
          return `https://www.youtube.com/embed/${shortId}?autoplay=1&rel=0`;
        }
      }

      // YouTube shortened link: youtu.be/ID
      if (parsed.hostname === 'youtu.be') {
        const id = parsed.pathname.replace('/', '');
        return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
      }

      return clean;
    } catch (_) {
      return clean;
    }
  };

  const handleApplyUrl = (target?: string) => {
    const raw = target || urlInput;
    if (!raw.trim()) return;
    const formatted = formatEmbedUrl(raw);
    setCurrentUrl(formatted);
    setIsLoading(true);
    setEmbedError(null);
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-white overflow-hidden rounded-2xl relative shadow-2xl border border-slate-800">
      {/* Top Header & Address Bar */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 z-30">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
            {currentUrl.includes('youtube') ? (
              <Youtube className="w-5 h-5 text-red-400" />
            ) : (
              <Globe className="w-5 h-5 text-indigo-400" />
            )}
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2">
              <span>Nhúng Nội Dung Trực Tuyến & YouTube</span>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Live Embed
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Chiếu video YouTube, mô phỏng thí nghiệm PhET, đồ thị GeoGebra trực tiếp trên bảng
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Pen / Annotation on top of embedded video or website */}
          <button
            onClick={() => setIsAnnotating(!isAnnotating)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
              isAnnotating
                ? 'bg-amber-500 text-white ring-2 ring-amber-300 shadow-md animate-pulse'
                : 'bg-white/10 hover:bg-white/20 text-amber-300'
            }`}
            title="Bật bút vẽ, dạ quang viết trực tiếp đè lên video / trang web đang chiếu"
          >
            <Pen className="w-3.5 h-3.5" />
            <span>{isAnnotating ? 'Đang Vẽ Chú Thích' : 'Bút Vẽ Lên Web'}</span>
          </button>

          {/* Open in external browser window */}
          <a
            href={currentUrl}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
            title="Mở trong cửa sổ trình duyệt riêng"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* Reload Frame */}
          <button
            onClick={() => {
              const url = currentUrl;
              setCurrentUrl('');
              setTimeout(() => setCurrentUrl(url), 50);
            }}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
            title="Tải lại trang web / video"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white transition-colors"
              title="Đóng cửa sổ nhúng"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* URL Input Bar & Quick Educational Presets */}
      <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex flex-col gap-2 shrink-0 z-30">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleApplyUrl();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Dán link YouTube (https://youtube.com/watch?v=...) hoặc đường link trang web bất kỳ..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shrink-0 transition-transform active:scale-95 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Tải Link</span>
          </button>
        </form>

        {/* Quick Presets Bar */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 custom-scrollbar text-xs">
          <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
            <Compass className="w-3 h-3 text-indigo-400" />
            <span>Mẫu sẵn:</span>
          </span>
          {EDUCATIONAL_PRESETS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => {
                setUrlInput(p.url);
                handleApplyUrl(p.url);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600/30 border border-slate-700 hover:border-indigo-400/50 text-slate-300 hover:text-white text-[11px] font-medium flex items-center gap-1.5 shrink-0 transition-all cursor-pointer"
              title={p.description}
            >
              <span>{p.icon}</span>
              <span className="font-bold">{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Iframe Viewer Area */}
      <div className="flex-1 w-full h-full relative bg-slate-950 overflow-hidden">
        {currentUrl ? (
          <iframe
            src={currentUrl}
            title="External Embedded Content"
            className="w-full h-full border-0 bg-white"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onLoad={() => setIsLoading(false)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <Globe className="w-12 h-12 mb-3 text-indigo-400 opacity-60" />
            <p className="text-sm font-bold text-slate-200">Chưa có đường link nào được nạp</p>
            <p className="text-xs text-slate-500 mt-1">
              Hãy dán link YouTube hoặc chọn một mẫu học tập tương tác ở trên
            </p>
          </div>
        )}

        {/* Interactive Annotation Drawing Layer (Draw on top of Web/YouTube) */}
        {isAnnotating && (
          <div className="absolute inset-0 z-40 pointer-events-auto">
            <TouchWhiteboard
              id="external-embed-whiteboard"
              isOverlay={true}
              onCloseOverlay={() => setIsAnnotating(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
