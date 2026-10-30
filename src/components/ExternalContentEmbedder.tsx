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
  Clipboard,
  Video,
  BookOpen,
  Send,
  FileText,
  Layers,
  Bot,
  HelpCircle,
  Share2,
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

export type LinkPlatform =
  | 'youtube'
  | 'tiktok'
  | 'notebooklm'
  | 'gdrive'
  | 'gdocs'
  | 'gslides'
  | 'gsheets'
  | 'canva'
  | 'geogebra'
  | 'desmos'
  | 'phet'
  | 'wikipedia'
  | 'generic';

export interface ParsedLinkResult {
  embedUrl: string;
  originalUrl: string;
  platform: LinkPlatform;
  titleSuggestion: string;
  identifier?: string;
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
    name: 'PhET Bảng Tuần Hoàn',
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
  {
    name: 'YouTube Thí Nghiệm',
    category: 'Vật Lý',
    url: 'https://www.youtube.com/watch?v=k2YgmssbL-Q',
    description: 'Video thí nghiệm con lắc đơn và dao động',
    icon: '▶️',
  },
  {
    name: 'TikTok Khoa Học',
    category: 'Sinh Học',
    url: 'https://www.tiktok.com/@vtv24news/video/7325678901234567890',
    description: 'Clip ngắn kiến thức sinh động trên TikTok',
    icon: '📱',
  },
  {
    name: 'Google NotebookLM AI',
    category: 'Khác',
    url: 'https://notebooklm.google.com',
    description: 'Sổ tay AI soạn giáo án & phân tích bài học thông minh',
    icon: '✨',
  },
];

/**
 * Intelligent URL Parser & Formatter:
 * Converts YouTube, TikTok, Google NotebookLM, Google Drive/Docs/Slides/Sheets,
 * Canva, GeoGebra, Desmos, Wikipedia and web links into direct embeddable formats.
 */
export function parseAndFormatUrl(raw: string): ParsedLinkResult {
  let clean = raw.trim();
  if (!clean) {
    return {
      embedUrl: '',
      originalUrl: '',
      platform: 'generic',
      titleSuggestion: 'Trang web trực tuyến',
    };
  }

  // Strip accidental quotes or brackets from chat/messages
  clean = clean.replace(/^[<"']+|[>"']+$/g, '');

  // Auto prepend https if missing protocol
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'https://' + clean;
  }

  try {
    const parsed = new URL(clean);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    // =========================================================================
    // 1. YOUTUBE (Watch, Shorts, Live, Embed, Playlist, youtu.be)
    // =========================================================================
    if (host.includes('youtube.com') || host === 'youtu.be') {
      let videoId = '';
      let startTime = '';
      const listId = parsed.searchParams.get('list');

      // Timestamp extraction: e.g. t=120, t=120s, t=2m30s
      const rawT = parsed.searchParams.get('t') || '';
      if (rawT) {
        if (/^\d+$/.test(rawT)) {
          startTime = rawT;
        } else {
          let totalSec = 0;
          const hMatch = rawT.match(/(\d+)h/);
          const mMatch = rawT.match(/(\d+)m/);
          const sMatch = rawT.match(/(\d+)s/);
          if (hMatch) totalSec += parseInt(hMatch[1], 10) * 3600;
          if (mMatch) totalSec += parseInt(mMatch[1], 10) * 60;
          if (sMatch) totalSec += parseInt(sMatch[1], 10);
          if (totalSec > 0) startTime = String(totalSec);
        }
      }

      if (host === 'youtu.be') {
        videoId = pathname.replace(/^\//, '').split('/')[0];
      } else if (pathname.startsWith('/shorts/')) {
        videoId = pathname.split('/shorts/')[1]?.split('/')[0]?.split('?')[0] || '';
      } else if (pathname.startsWith('/live/')) {
        videoId = pathname.split('/live/')[1]?.split('/')[0]?.split('?')[0] || '';
      } else if (pathname.startsWith('/embed/')) {
        videoId = pathname.split('/embed/')[1]?.split('/')[0]?.split('?')[0] || '';
      } else {
        videoId = parsed.searchParams.get('v') || '';
      }

      if (videoId) {
        // Use youtube-nocookie.com to avoid cookie blocks and resolve Error 153
        let embed = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=0&rel=0&playsinline=1&enablejsapi=1`;
        if (startTime) embed += `&start=${startTime}`;
        if (listId) embed += `&list=${listId}`;
        return {
          embedUrl: embed,
          originalUrl: clean,
          platform: 'youtube',
          titleSuggestion: 'Video bài giảng YouTube',
          identifier: videoId,
        };
      } else if (listId) {
        return {
          embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${listId}&autoplay=1&rel=0`,
          originalUrl: clean,
          platform: 'youtube',
          titleSuggestion: 'Danh sách phát YouTube bài giảng',
          identifier: listId,
        };
      }
    }

    // =========================================================================
    // 2. TIKTOK (Video, Embed, Short Links vt.tiktok / vm.tiktok)
    // =========================================================================
    if (host.includes('tiktok.com')) {
      // Formats:
      // https://www.tiktok.com/@creator/video/7234567890123456789
      // https://m.tiktok.com/v/7234567890123456789.html
      // https://www.tiktok.com/embed/v2/7234567890123456789
      const videoMatch = pathname.match(/\/video\/(\d+)/) || pathname.match(/\/v\/(\d+)/) || pathname.match(/\/embed\/v2\/(\d+)/);
      if (videoMatch && videoMatch[1]) {
        const vidId = videoMatch[1];
        return {
          embedUrl: `https://www.tiktok.com/embed/v2/${vidId}`,
          originalUrl: clean,
          platform: 'tiktok',
          titleSuggestion: `Video TikTok giáo dục (#${vidId.slice(-6)})`,
          identifier: vidId,
        };
      }

      // If already embed
      if (pathname.includes('/embed/')) {
        return {
          embedUrl: clean,
          originalUrl: clean,
          platform: 'tiktok',
          titleSuggestion: 'Video TikTok trực tuyến',
        };
      }

      return {
        embedUrl: clean,
        originalUrl: clean,
        platform: 'tiktok',
        titleSuggestion: 'Kênh TikTok bài giảng ngắn',
      };
    }

    // =========================================================================
    // 3. GOOGLE NOTEBOOKLM (notebooklm.google.com)
    // =========================================================================
    if (host.includes('notebooklm.google.com') || clean.includes('notebooklm')) {
      // Extract notebook ID if present
      const nbMatch = pathname.match(/\/notebook\/([a-zA-Z0-9_-]+)/);
      const notebookId = nbMatch ? nbMatch[1] : undefined;
      return {
        embedUrl: clean,
        originalUrl: clean,
        platform: 'notebooklm',
        titleSuggestion: notebookId ? `Sổ tay NotebookLM (${notebookId.slice(0, 8)}...)` : 'Google NotebookLM AI Giáo Án',
        identifier: notebookId,
      };
    }

    // =========================================================================
    // 4. GOOGLE DRIVE (Files, PDFs, Shared Videos)
    // =========================================================================
    if (host.includes('drive.google.com')) {
      const driveMatch = pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (driveMatch && driveMatch[1]) {
        return {
          embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
          originalUrl: clean,
          platform: 'gdrive',
          titleSuggestion: 'Tài liệu Google Drive trực tuyến',
          identifier: driveMatch[1],
        };
      }
    }

    // =========================================================================
    // 5. GOOGLE SLIDES (Presentation)
    // =========================================================================
    if (host.includes('docs.google.com') && pathname.includes('/presentation/')) {
      const presMatch = pathname.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
      if (presMatch && presMatch[1]) {
        return {
          embedUrl: `https://docs.google.com/presentation/d/${presMatch[1]}/embed?start=false&loop=false&delayms=3000`,
          originalUrl: clean,
          platform: 'gslides',
          titleSuggestion: 'Bài thuyết trình Google Slides',
          identifier: presMatch[1],
        };
      }
    }

    // =========================================================================
    // 6. GOOGLE DOCS (Document)
    // =========================================================================
    if (host.includes('docs.google.com') && pathname.includes('/document/')) {
      const docMatch = pathname.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
      if (docMatch && docMatch[1]) {
        return {
          embedUrl: `https://docs.google.com/document/d/${docMatch[1]}/preview`,
          originalUrl: clean,
          platform: 'gdocs',
          titleSuggestion: 'Văn bản Google Docs',
          identifier: docMatch[1],
        };
      }
    }

    // =========================================================================
    // 7. GOOGLE SHEETS (Spreadsheets)
    // =========================================================================
    if (host.includes('docs.google.com') && pathname.includes('/spreadsheets/')) {
      const sheetMatch = pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      if (sheetMatch && sheetMatch[1]) {
        return {
          embedUrl: `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/preview`,
          originalUrl: clean,
          platform: 'gsheets',
          titleSuggestion: 'Bảng tính Google Sheets',
          identifier: sheetMatch[1],
        };
      }
    }

    // =========================================================================
    // 8. CANVA (Presentation / Infographic)
    // =========================================================================
    if (host.includes('canva.com') && pathname.includes('/design/')) {
      const baseCanva = clean.split('?')[0];
      return {
        embedUrl: `${baseCanva}?embed`,
        originalUrl: clean,
        platform: 'canva',
        titleSuggestion: 'Bài giảng thiết kế Canva',
      };
    }

    // =========================================================================
    // 9. GEOGEBRA (Material & 3D Math)
    // =========================================================================
    if (host.includes('geogebra.org')) {
      const mMatch = pathname.match(/\/m\/([a-zA-Z0-9_-]+)/);
      if (mMatch && mMatch[1]) {
        return {
          embedUrl: `https://www.geogebra.org/material/iframe/id/${mMatch[1]}`,
          originalUrl: clean,
          platform: 'geogebra',
          titleSuggestion: 'Mô phỏng hình học GeoGebra',
          identifier: mMatch[1],
        };
      }
      return {
        embedUrl: clean,
        originalUrl: clean,
        platform: 'geogebra',
        titleSuggestion: 'Mô phỏng Toán học GeoGebra 3D',
      };
    }

    // =========================================================================
    // 10. DESMOS (Graphing Calculator)
    // =========================================================================
    if (host.includes('desmos.com/calculator')) {
      const desmosMatch = pathname.match(/\/calculator\/([a-zA-Z0-9_-]+)/);
      if (desmosMatch && desmosMatch[1]) {
        return {
          embedUrl: `https://www.desmos.com/calculator/${desmosMatch[1]}?embed`,
          originalUrl: clean,
          platform: 'desmos',
          titleSuggestion: 'Đồ thị hàm số Desmos',
          identifier: desmosMatch[1],
        };
      }
    }

    // =========================================================================
    // 11. PHET (Interactive Simulations)
    // =========================================================================
    if (host.includes('phet.colorado.edu')) {
      return {
        embedUrl: clean,
        originalUrl: clean,
        platform: 'phet',
        titleSuggestion: 'Thí nghiệm ảo PhET Interactive',
      };
    }

    // =========================================================================
    // 12. WIKIPEDIA (Mobile view embeds cleanly without top headers)
    // =========================================================================
    if (host.includes('wikipedia.org')) {
      const mobileHost = host.replace(/^([a-z]+)\.wikipedia\.org/, '$1.m.wikipedia.org');
      return {
        embedUrl: `https://${mobileHost}${pathname}${parsed.search}`,
        originalUrl: clean,
        platform: 'wikipedia',
        titleSuggestion: 'Bách khoa toàn thư Wikipedia',
      };
    }

    return {
      embedUrl: clean,
      originalUrl: clean,
      platform: 'generic',
      titleSuggestion: 'Trang web trực tuyến',
    };
  } catch (_) {
    return {
      embedUrl: clean,
      originalUrl: clean,
      platform: 'generic',
      titleSuggestion: 'Trang web trực tuyến',
    };
  }
}

export const ExternalContentEmbedder: React.FC<ExternalContentEmbedderProps> = ({
  initialUrl = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=0&rel=0&playsinline=1',
  onClose,
  isCompact = false,
}) => {
  const [urlInput, setUrlInput] = useState<string>('');
  const [currentUrl, setCurrentUrl] = useState<string>(initialUrl);
  const [originalUrl, setOriginalUrl] = useState<string>(initialUrl);
  const [currentPlatform, setCurrentPlatform] = useState<LinkPlatform>('youtube');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAnnotating, setIsAnnotating] = useState<boolean>(false);
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [pasteNotification, setPasteNotification] = useState<string | null>(null);

  // Dedicated AI NotebookLM Assistant State
  const [notebookAIQuery, setNotebookAIQuery] = useState<string>('');
  const [notebookAIResponse, setNotebookAIResponse] = useState<string | null>(null);
  const [isNotebookAILoading, setIsNotebookAILoading] = useState<boolean>(false);
  const [showNotebookIframeFallback, setShowNotebookIframeFallback] = useState<boolean>(false);

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

  // Apply parsed URL to view
  const handleApplyUrl = (target?: string) => {
    const raw = target || urlInput;
    if (!raw.trim()) return;

    const parsed = parseAndFormatUrl(raw);
    setCurrentUrl(parsed.embedUrl);
    setOriginalUrl(parsed.originalUrl);
    setCurrentPlatform(parsed.platform);
    setIsLoading(true);
    setEmbedError(null);
    setShowNotebookIframeFallback(false);
  };

  // Quick Paste From Clipboard
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setUrlInput(text.trim());
        handleApplyUrl(text.trim());
        const parsed = parseAndFormatUrl(text.trim());
        setPasteNotification(`Đã nhận diện: ${getPlatformBadgeName(parsed.platform)}`);
        setTimeout(() => setPasteNotification(null), 3000);
      }
    } catch (err) {
      console.warn('Cannot read clipboard directly', err);
      // Fallback: prompt teacher or focus input
      const fallback = window.prompt('Dán đường link (URL) vào đây:');
      if (fallback && fallback.trim()) {
        setUrlInput(fallback.trim());
        handleApplyUrl(fallback.trim());
      }
    }
  };

  // Global Ctrl+V / Paste listener when viewing tab
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      // If user is typing in notes or input, do not hijack
      if (activeTag === 'input' || activeTag === 'textarea') return;

      const pasted = e.clipboardData?.getData('text');
      if (
        pasted &&
        (pasted.startsWith('http://') ||
          pasted.startsWith('https://') ||
          pasted.includes('youtube.com') ||
          pasted.includes('youtu.be') ||
          pasted.includes('tiktok.com') ||
          pasted.includes('notebooklm.google.com') ||
          pasted.includes('drive.google.com') ||
          pasted.includes('docs.google.com') ||
          pasted.includes('canva.com') ||
          pasted.includes('geogebra.org') ||
          pasted.includes('phet.colorado.edu') ||
          pasted.includes('.edu') ||
          pasted.includes('.com') ||
          pasted.includes('.vn'))
      ) {
        e.preventDefault();
        const trimmed = pasted.trim();
        setUrlInput(trimmed);
        handleApplyUrl(trimmed);
        const parsed = parseAndFormatUrl(trimmed);
        setPasteNotification(`Đã tự động tải: ${getPlatformBadgeName(parsed.platform)}`);
        setTimeout(() => setPasteNotification(null), 3500);
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  // Open Save Dialog with prefilled URL and sensible default title
  const handleOpenSaveDialog = (targetUrl?: string) => {
    const candidate = targetUrl || originalUrl || urlInput || currentUrl;
    setSaveUrl(candidate);
    const parsed = parseAndFormatUrl(candidate);
    setSaveTitle(parsed.titleSuggestion || 'Bài giảng trực tuyến');

    let catGuess: SavedEmbedLink['category'] = 'Khác';
    if (parsed.platform === 'geogebra' || parsed.platform === 'desmos') catGuess = 'Toán Học';
    else if (parsed.platform === 'phet') catGuess = 'Vật Lý';
    else if (candidate.toLowerCase().includes('hóa') || candidate.toLowerCase().includes('chemistry')) catGuess = 'Hóa Học';
    else if (candidate.toLowerCase().includes('sinh') || candidate.toLowerCase().includes('biology')) catGuess = 'Sinh Học';
    else if (candidate.toLowerCase().includes('địa') || candidate.toLowerCase().includes('earth')) catGuess = 'Địa Lý';

    setSaveCategory(catGuess);
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

  // Call AI Assistant for NotebookLM / Lesson queries
  const handleAskNotebookAI = async (promptQuery?: string) => {
    const q = promptQuery || notebookAIQuery;
    if (!q.trim()) return;
    setIsNotebookAILoading(true);
    setNotebookAIResponse(null);

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Với vai trò là trợ lý sư phạm và chuyên gia khai thác tài liệu từ Google NotebookLM cho giáo viên Việt Nam, hãy trả lời ngắn gọn, súc tích và chuẩn mực theo chương trình GDPT:\n\nLink sổ tay: ${originalUrl}\n\nYêu cầu của giáo viên: ${q}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setNotebookAIResponse(data.answer || data.text || 'Đã xử lý thông tin sổ tay thành công.');
      } else {
        setNotebookAIResponse('Không thể kết nối máy chủ AI. Thầy/Cô vui lòng bấm "Mở Sổ Tay NotebookLM (Cửa Sổ Nổi)" để tương tác trực tiếp.');
      }
    } catch (e) {
      setNotebookAIResponse('Đã có lỗi mạng. Thầy/Cô hãy bấm nút "Mở Sổ Tay NotebookLM" ở trên để xem trực tiếp.');
    } finally {
      setIsNotebookAILoading(false);
    }
  };

  // Platform badges and labels
  const getPlatformBadgeName = (p: LinkPlatform) => {
    switch (p) {
      case 'youtube':
        return 'YouTube Video & Shorts';
      case 'tiktok':
        return 'TikTok Video Giáo Dục';
      case 'notebooklm':
        return 'Google NotebookLM AI';
      case 'gdrive':
        return 'Google Drive';
      case 'gslides':
        return 'Google Slides';
      case 'gdocs':
        return 'Google Docs';
      case 'gsheets':
        return 'Google Sheets';
      case 'canva':
        return 'Canva Presentation';
      case 'geogebra':
        return 'GeoGebra Toán 3D';
      case 'desmos':
        return 'Desmos Calculator';
      case 'phet':
        return 'PhET Thí Nghiệm Ảo';
      case 'wikipedia':
        return 'Wikipedia';
      default:
        return 'Trang Web Trực Tuyến';
    }
  };

  const getPlatformBadgeColor = (p: LinkPlatform) => {
    switch (p) {
      case 'youtube':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'tiktok':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'notebooklm':
        return 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-purple-300 border-purple-500/40';
      case 'gdrive':
      case 'gdocs':
      case 'gslides':
      case 'gsheets':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'canva':
        return 'bg-cyan-500/20 text-teal-300 border-teal-500/40';
      case 'geogebra':
      case 'desmos':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      case 'phet':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
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
            {currentPlatform === 'youtube' ? (
              <Youtube className="w-5 h-5 text-red-400" />
            ) : currentPlatform === 'tiktok' ? (
              <Video className="w-5 h-5 text-cyan-400" />
            ) : currentPlatform === 'notebooklm' ? (
              <Sparkles className="w-5 h-5 text-purple-400" />
            ) : (
              <Globe className="w-5 h-5 text-indigo-400" />
            )}
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-100 flex items-center gap-2 flex-wrap">
              <span>Nhúng Nội Dung Trực Tuyến & Đa Phương Tiện</span>
              <span
                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${getPlatformBadgeColor(
                  currentPlatform
                )}`}
              >
                {getPlatformBadgeName(currentPlatform)}
              </span>
              {pasteNotification && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400 animate-pulse">
                  {pasteNotification}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Chiếu mượt mà YouTube, TikTok, Google NotebookLM, Drive/Slides, GeoGebra, PhET trực tiếp lên màn hình lớp học
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
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

          {/* Dedicated Side-by-Side Teaching Window (especially great for NotebookLM or YouTube) */}
          <button
            onClick={() => {
              const target = originalUrl || currentUrl;
              window.open(target, '_blank');
            }}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Mở trong tab trình duyệt mới"
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          {/* Reload Frame */}
          <button
            onClick={() => {
              const url = currentUrl;
              setCurrentUrl('');
              setIsLoading(true);
              setTimeout(() => setCurrentUrl(url), 60);
            }}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Tải lại nội dung"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white transition-colors cursor-pointer"
              title="Đóng cửa sổ nhúng"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* URL Input Bar & Clipboard Paste & Quick Action Save */}
      <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex flex-col gap-2 shrink-0 z-30">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleApplyUrl();
          }}
          className="flex items-center gap-2 flex-wrap sm:flex-nowrap"
        >
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Dán link YouTube, TikTok, Google NotebookLM, Drive, PhET, GeoGebra..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          {/* Quick Paste from Clipboard button */}
          <button
            type="button"
            onClick={handlePasteClipboard}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 shrink-0 transition-transform active:scale-95 cursor-pointer shadow-sm"
            title="Dán nhanh đường link từ bộ nhớ tạm (Ctrl+V)"
          >
            <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
            <span>Dán Link (Ctrl+V)</span>
          </button>

          {/* Submit Load Link */}
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

      {/* Main Content Area */}
      <div className="flex-1 w-full h-full relative bg-slate-950 overflow-hidden flex flex-col">
        {/* ========================================================================= */}
        {/* CASE A: GOOGLE NOTEBOOKLM DEDICATED TEACHING WORKSPACE & LIVE LAUNCHER   */}
        {/* ========================================================================= */}
        {currentPlatform === 'notebooklm' && !showNotebookIframeFallback ? (
          <div className="w-full h-full flex flex-col p-4 sm:p-6 overflow-y-auto custom-scrollbar bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950">
            {/* NotebookLM Header Card */}
            <div className="max-w-4xl mx-auto w-full bg-slate-900/90 border border-purple-500/30 rounded-3xl p-5 shadow-2xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/25">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-white">Google NotebookLM • Sổ Tay Soạn Giảng AI</h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        AI Teacher Hub
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono truncate max-w-md" title={originalUrl}>
                      {originalUrl}
                    </p>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      // Open dedicated side-by-side teaching popup window preserving Google account cookies
                      window.open(originalUrl, 'SmartBoard_NotebookLM', 'width=1180,height=820,left=120,top=60');
                    }}
                    className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-purple-600/30 active:scale-95 transition-all cursor-pointer"
                    title="Mở NotebookLM trong cửa sổ nổi riêng biệt để vừa xem tóm tắt/Audio Overview vừa dạy học trên bảng"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Mở Sổ Tay NotebookLM (Cửa Sổ Dạy Học Nổi)</span>
                  </button>

                  <a
                    href={originalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
                    title="Mở tab mới toàn màn hình"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Mở Tab Mới</span>
                  </a>

                  <button
                    onClick={() => setShowNotebookIframeFallback(true)}
                    className="px-3 py-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-medium transition-colors"
                    title="Thử chiếu trực tiếp qua khung nhúng Iframe"
                  >
                    <span>Thử Nhúng Khung</span>
                  </button>
                </div>
              </div>

              {/* Security Notice Explaining Google Policy */}
              <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-800/40 text-xs text-indigo-200 flex items-start gap-2.5 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p>
                  <b>Lưu ý kỹ thuật:</b> Google NotebookLM sử dụng bảo mật tài khoản cá nhân của Thầy/Cô (X-Frame-Options).
                  Thầy/Cô hãy bấm <b>"Mở Sổ Tay NotebookLM (Cửa Sổ Dạy Học Nổi)"</b> để tương tác trực tiếp với toàn bộ tài
                  liệu, đặt câu hỏi cho AI và phát podcast tóm tắt <b>Audio Overview</b> mượt mà mà không lo bị chặn!
                </p>
              </div>

              {/* Integrated AI Lesson Assistant Companion */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-purple-400" />
                    <h4 className="font-bold text-xs text-slate-200">
                      Trợ Lý AI Trích Xuất Ý Cốt Lõi Từ Sổ Tay NotebookLM
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400">Trợ lý sư phạm trực tuyến</span>
                </div>

                {/* Fast Action Prompt Chips */}
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: '🎙️ Tóm tắt 3 ý cốt lõi giảng bài', prompt: 'Hãy tóm tắt 3 ý trọng tâm quan trọng nhất của bài học này để tôi giảng cho học sinh dễ hiểu nhất.' },
                    { label: '❓ Tạo 5 câu hỏi phát vấn tại lớp', prompt: 'Hãy tạo 5 câu hỏi phát vấn nhanh từ dễ đến khó để gọi học sinh lên bảng kiểm tra hiểu bài.' },
                    { label: '💡 Gợi ý thí nghiệm & hoạt động mở đầu', prompt: 'Gợi ý một câu chuyện thực tế hoặc thí nghiệm trực quan mở đầu tiết dạy để thu hút sự chú ý của học sinh.' },
                    { label: '📝 Sơ đồ tư duy tóm lược', prompt: 'Hãy hệ thống hóa các khái niệm và công thức cốt lõi của bài dưới dạng sơ đồ tư duy phân nhánh.' },
                  ].map((item, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setNotebookAIQuery(item.prompt);
                        handleAskNotebookAI(item.prompt);
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-purple-600/30 border border-slate-700 hover:border-purple-500/50 text-[11px] font-medium text-slate-300 hover:text-white transition-all cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Custom Query Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={notebookAIQuery}
                    onChange={(e) => setNotebookAIQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAskNotebookAI();
                    }}
                    placeholder="Nhập nội dung cần trợ lý trích xuất hoặc câu hỏi sư phạm..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                  <button
                    onClick={() => handleAskNotebookAI()}
                    disabled={isNotebookAILoading || !notebookAIQuery.trim()}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-md"
                  >
                    {isNotebookAILoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Hỏi AI</span>
                  </button>
                </div>

                {/* AI Response Display Box */}
                {notebookAIResponse && (
                  <div className="p-4 rounded-2xl bg-slate-800/80 border border-purple-500/30 text-xs text-slate-200 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-purple-300 font-bold text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Gợi Ý Giảng Dạy Từ AI NotebookLM</span>
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(notebookAIResponse);
                          alert('Đã sao chép nội dung gợi ý vào bộ nhớ tạm!');
                        }}
                        className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Sao chép</span>
                      </button>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed font-sans text-slate-100">
                      {notebookAIResponse}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* CASE B: EMBEDDED IFRAME VIEWER (YouTube, TikTok, Web, Drive, PhET...)     */
          /* ========================================================================= */
          <div className="w-full h-full relative flex-1 bg-slate-950 flex flex-col items-center justify-center">
            {currentUrl ? (
              <div
                className={`w-full h-full relative flex items-center justify-center ${
                  currentPlatform === 'tiktok' ? 'max-w-[540px] mx-auto' : 'w-full'
                }`}
              >
                <iframe
                  key={currentUrl}
                  src={currentUrl}
                  title="External Embedded Content"
                  className="w-full h-full border-0 bg-black"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false);
                    setEmbedError('Trang web hoặc video chặn hiển thị trực tiếp trong khung nhúng.');
                  }}
                />

                {/* Floating Safe YouTube Bar if user encounters Error 153 or embedding issues */}
                {currentPlatform === 'youtube' && (
                  <div className="absolute bottom-2 left-2 right-2 p-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 flex items-center justify-between text-xs text-slate-300 shadow-xl opacity-90 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2">
                      <Youtube className="w-4 h-4 text-red-400" />
                      <span className="text-[11px] hidden sm:inline text-slate-400">
                        Nếu video báo lỗi 153 (do người tải tắt quyền nhúng):
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={originalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Xem Trực Tiếp Trên YouTube</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Floating Fallback Bar for TikTok */}
                {currentPlatform === 'tiktok' && (
                  <div className="absolute top-2 right-2 p-1.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 flex items-center gap-2 text-xs shadow-xl">
                    <a
                      href={originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Xem Gốc Trên TikTok</span>
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-400">
                <Globe className="w-12 h-12 mb-3 text-indigo-400 opacity-60" />
                <p className="text-sm font-bold text-slate-200">Chưa có đường link nào được nạp</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Dán bất kỳ link nào (YouTube, TikTok, Google NotebookLM, Drive, PhET) hoặc chọn từ Kho Link để chiếu cho học sinh
                </p>
                <button
                  onClick={handlePasteClipboard}
                  className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <Clipboard className="w-4 h-4" />
                  <span>Dán Link Từ Bộ Nhớ Tạm</span>
                </button>
              </div>
            )}
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
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
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
                    className={`px-2 py-0.5 rounded-lg whitespace-nowrap font-bold transition-all cursor-pointer ${
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
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 text-xs cursor-pointer"
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
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer"
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

                    <div className="text-[10px] font-mono text-slate-500 truncate max-w-full">{item.url}</div>

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
                        className="p-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
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
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
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
                  className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
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
                  placeholder="VD: Video thí nghiệm sóng dừng Vật lý 12..."
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
