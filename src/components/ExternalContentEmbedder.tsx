import React, { useState, useEffect } from 'react';
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
  Bookmark,
  BookmarkPlus,
  Trash2,
  Edit2,
  Copy,
  Download,
  Upload,
  FolderOpen,
  Filter,
} from 'lucide-react';
import { TouchWhiteboard } from './TouchWhiteboard';

export interface SavedEmbedLink {
  id: string;
  title: string;
  url: string;
  category: 'Toán Học' | 'Vật Lý' | 'Hóa Học' | 'Sinh Học' | 'Địa Lý' | 'Khác';
  notes?: string;
  createdAt: string;
}

interface ExternalContentEmbedderProps {
  initialUrl?: string;
  onClose?: () => void;
  isCompact?: boolean;
}

const DEFAULT_SAVED_LINKS: SavedEmbedLink[] = [
  {
    id: 'link_1',
    title: 'GeoGebra Toán 3D - Hình không gian & Đồ thị mặt cong',
    url: 'https://www.geogebra.org/3d?lang=vi',
    category: 'Toán Học',
    notes: 'Dùng cho tiết hình học không gian 11 & 12, tọa độ Oxyz',
    createdAt: '2026-10-20',
  },
  {
    id: 'link_2',
    title: 'PhET Mô Phỏng Sóng Cơ & Giao Thoa Sóng',
    url: 'https://phet.colorado.edu/sims/html/wave-interference/latest/wave-interference_vi.html',
    category: 'Vật Lý',
    notes: 'Thí nghiệm ảo giao thoa sóng nước và sóng ánh sáng',
    createdAt: '2026-10-21',
  },
  {
    id: 'link_3',
    title: 'Ptable - Bảng Tuần Hoàn Hóa Học Tương Tác',
    url: 'https://ptable.com/?lang=vi',
    category: 'Hóa Học',
    notes: 'Tra cứu cấu hình electron, bán kính nguyên tử và chu kỳ',
    createdAt: '2026-10-22',
  },
  {
    id: 'link_4',
    title: 'Google Earth 3D - Khám Phá Địa Cầu & Địa Mạo',
    url: 'https://earth.google.com/web/',
    category: 'Địa Lý',
    notes: 'Quan sát kiến tạo mảng, đứt gãy địa chất và khí hậu',
    createdAt: '2026-10-23',
  },
];

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

  // Saved Links Library Management
  const [savedLinks, setSavedLinks] = useState<SavedEmbedLink[]>(() => {
    try {
      const stored = localStorage.getItem('smartboard_saved_embed_links');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return DEFAULT_SAVED_LINKS;
  });

  const [showSavedLinksDrawer, setShowSavedLinksDrawer] = useState<boolean>(false);
  const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false);
  const [saveTitle, setSaveTitle] = useState<string>('');
  const [saveUrl, setSaveUrl] = useState<string>('');
  const [saveCategory, setSaveCategory] = useState<SavedEmbedLink['category']>('Toán Học');
  const [saveNotes, setSaveNotes] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('Tất cả');
  const [searchSaved, setSearchSaved] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sync saved links to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('smartboard_saved_embed_links', JSON.stringify(savedLinks));
    } catch (_) {}
  }, [savedLinks]);

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

  // Open Save Dialog with prefilled URL and sensible default title
  const handleOpenSaveDialog = (targetUrl?: string) => {
    const candidate = targetUrl || urlInput || currentUrl;
    setSaveUrl(candidate);
    let titleGuess = 'Bài giảng trực tuyến';
    if (candidate.includes('youtube.com') || candidate.includes('youtu.be')) {
      titleGuess = 'Video bài giảng YouTube';
    } else if (candidate.includes('geogebra.org')) {
      titleGuess = 'Mô phỏng hình học GeoGebra';
    } else if (candidate.includes('phet.colorado.edu')) {
      titleGuess = 'Thí nghiệm ảo PhET';
    }
    setSaveTitle(titleGuess);
    setSaveNotes('');
    setShowSaveDialog(true);
  };

  // Save new link into library
  const handleSaveLink = () => {
    if (!saveUrl.trim() || !saveTitle.trim()) return;
    const newLink: SavedEmbedLink = {
      id: 'link_' + Date.now(),
      title: saveTitle.trim(),
      url: saveUrl.trim(),
      category: saveCategory,
      notes: saveNotes.trim(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    setSavedLinks((prev) => [newLink, ...prev]);
    setShowSaveDialog(false);
  };

  const handleDeleteSavedLink = (id: string) => {
    setSavedLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const handleExportLinks = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(savedLinks, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `smartboard_saved_links_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImportLinks = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          setSavedLinks((prev) => {
            const existingUrls = new Set(prev.map((p) => p.url));
            const newOnes = imported.filter((item) => item.url && !existingUrls.has(item.url));
            return [...newOnes, ...prev];
          });
        }
      } catch (err) {
        console.error('Failed to import links', err);
      }
    };
    reader.readAsText(file);
  };

  const filteredSavedLinks = savedLinks.filter((l) => {
    const matchCat = filterCategory === 'Tất cả' || l.category === filterCategory;
    const matchSearch =
      !searchSaved.trim() ||
      l.title.toLowerCase().includes(searchSaved.toLowerCase()) ||
      l.url.toLowerCase().includes(searchSaved.toLowerCase()) ||
      (l.notes && l.notes.toLowerCase().includes(searchSaved.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 text-white overflow-hidden rounded-2xl relative shadow-2xl border border-slate-800">
      {/* Top Header & Action Bar */}
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
              Lưu link ở nhà, đến lớp mở chiếu cho học sinh xem tức thì (YouTube, GeoGebra, PhET, Web)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Button: Kho Link Đã Lưu */}
          <button
            onClick={() => setShowSavedLinksDrawer(!showSavedLinksDrawer)}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
              showSavedLinksDrawer
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 ring-2 ring-amber-300'
                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
            }`}
            title="Mở Kho Link bài giảng đã lưu để chiếu cho học sinh"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Kho Link Đã Lưu ({savedLinks.length})</span>
          </button>

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

      {/* URL Input Bar & Quick Action Save */}
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

          {/* Quick "Lưu link này" button */}
          <button
            type="button"
            onClick={() => handleOpenSaveDialog()}
            className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all cursor-pointer active:scale-95"
            title="Lưu lại đường link này vào kho để mở lại trong giờ dạy ở trường"
          >
            <BookmarkPlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>Lưu Link Này</span>
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

      {/* Main Iframe Viewer Area + Slide-in Saved Links Drawer */}
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
              Hãy dán link YouTube hoặc chọn một link đã lưu từ Kho Link để chiếu cho học sinh
            </p>
          </div>
        )}

        {/* Saved Links Slide-over Drawer */}
        {showSavedLinksDrawer && (
          <div className="absolute top-0 right-0 bottom-0 w-full sm:w-[420px] bg-slate-900/98 backdrop-blur-xl border-l border-slate-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-amber-400" />
                <h4 className="font-black text-sm text-white">Kho Link Đã Lưu Của Tôi</h4>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300">
                  {savedLinks.length}
                </span>
              </div>
              <button
                onClick={() => setShowSavedLinksDrawer(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-3 border-b border-slate-800/80 space-y-2 bg-slate-900/60">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchSaved}
                  onChange={(e) => setSearchSaved(e.target.value)}
                  placeholder="Tìm link đã lưu theo tên, ghi chú..."
                  className="w-full pl-8 pr-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar text-[10px]">
                {['Tất cả', 'Toán Học', 'Vật Lý', 'Hóa Học', 'Sinh Học', 'Địa Lý', 'Khác'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-2 py-0.5 rounded-lg whitespace-nowrap font-bold transition-all ${
                      filterCategory === cat
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Saved Links Cards List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
              {filteredSavedLinks.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs space-y-2">
                  <Bookmark className="w-8 h-8 mx-auto opacity-30" />
                  <p>Chưa có đường link nào phù hợp</p>
                  <button
                    onClick={() => handleOpenSaveDialog()}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 text-xs"
                  >
                    + Lưu link hiện tại
                  </button>
                </div>
              ) : (
                filteredSavedLinks.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition-all shadow-sm space-y-2 group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.2 rounded-md ${
                              item.category === 'Toán Học'
                                ? 'bg-sky-500/20 text-sky-300'
                                : item.category === 'Vật Lý'
                                ? 'bg-amber-500/20 text-amber-300'
                                : item.category === 'Hóa Học'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-purple-500/20 text-purple-300'
                            }`}
                          >
                            {item.category}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">{item.createdAt}</span>
                        </div>
                        <h5 className="font-bold text-xs text-white group-hover:text-amber-300 transition-colors line-clamp-2">
                          {item.title}
                        </h5>
                      </div>

                      <button
                        onClick={() => handleDeleteSavedLink(item.id)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-70 group-hover:opacity-100 transition-opacity"
                        title="Xóa link này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {item.notes && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800/80">
                        {item.notes}
                      </p>
                    )}

                    <div className="text-[10px] font-mono text-slate-500 truncate max-w-full">
                      {item.url}
                    </div>

                    {/* Action buttons on card */}
                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-700/50">
                      <button
                        onClick={() => {
                          setUrlInput(item.url);
                          handleApplyUrl(item.url);
                          setShowSavedLinksDrawer(false);
                        }}
                        className="flex-1 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                      >
                        <Globe className="w-3 h-3" />
                        <span>Mở Chiếu Lên Bảng</span>
                      </button>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.url);
                          setCopiedId(item.id);
                          setTimeout(() => setCopiedId(null), 1500);
                        }}
                        className="p-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
                        title="Sao chép đường link"
                      >
                        {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Drawer Footer Actions (Export/Import JSON) */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
              <button
                onClick={() => handleOpenSaveDialog()}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>+ Thêm Link Mới</span>
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleExportLinks}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Xuất danh sách link ra file JSON để mang lên lớp"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <label
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Nhập danh sách link từ file JSON"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <input type="file" accept=".json" onChange={handleImportLinks} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Save Link Modal Dialog */}
        {showSaveDialog && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl space-y-3.5 text-white">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <BookmarkPlus className="w-5 h-5 text-amber-400" />
                  <h4 className="font-extrabold text-sm text-white">Lưu Link Vào Kho Bài Giảng</h4>
                </div>
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Tiêu đề gợi nhớ:</label>
                <input
                  type="text"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder="VD: Thí nghiệm sóng dừng Vật lý 12..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Đường link (URL):</label>
                <input
                  type="text"
                  value={saveUrl}
                  onChange={(e) => setSaveUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Môn học / Phân loại:</label>
                  <select
                    value={saveCategory}
                    onChange={(e) => setSaveCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                  >
                    <option value="Toán Học">Toán Học</option>
                    <option value="Vật Lý">Vật Lý</option>
                    <option value="Hóa Học">Hóa Học</option>
                    <option value="Sinh Học">Sinh Học</option>
                    <option value="Địa Lý">Địa Lý</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Ghi chú dạy học (nếu có):</label>
                  <input
                    type="text"
                    value={saveNotes}
                    onChange={(e) => setSaveNotes(e.target.value)}
                    placeholder="VD: Dạy bài 2 tiết 4..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSaveDialog(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveLink}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  Lưu Vào Kho Link
                </button>
              </div>
            </div>
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
