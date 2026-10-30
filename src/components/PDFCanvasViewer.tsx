import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Loader2,
  AlertCircle,
  FileText,
  Download,
  ExternalLink,
  BookOpen,
  Maximize2,
  Minimize2,
  Pen,
  Sparkles,
  Hash,
  Volume2,
  Square,
  ChevronDown,
  Check,
  Users,
} from 'lucide-react';
import { TouchWhiteboard } from './TouchWhiteboard';
import { RandomStudentPickerModal } from './RandomStudentPickerModal';
import { ClassRoom } from '../types';
import { speakText, stopAllSpeech, VOICE_TONE_PRESETS, VoiceTonePreset } from '../utils/aiSpeechService';
import { cleanPdfVietnameseText, extractCleanPdfText } from '../utils/pdfTextExtractor';
import 'pdfjs-dist/web/pdf_viewer.css';

const persistUpdatedClassrooms = (updatedClasses: ClassRoom[]) => {
  try {
    const saved = localStorage.getItem('smartboard_teachers');
    if (saved) {
      const teachers = JSON.parse(saved);
      if (Array.isArray(teachers) && teachers.length > 0) {
        const activeId = localStorage.getItem('smartboard_active_teacher') || localStorage.getItem('smartboard_active_teacher_id');
        const activeIdx = teachers.findIndex((t: any) => t.id === activeId);
        const targetIdx = activeIdx !== -1 ? activeIdx : 0;
        teachers[targetIdx] = { ...teachers[targetIdx], classes: updatedClasses };
        localStorage.setItem('smartboard_teachers', JSON.stringify(teachers));
        localStorage.setItem('smartboard_active_classroom_list', JSON.stringify(updatedClasses));
        window.dispatchEvent(new CustomEvent('smartboard_classes_updated', { detail: updatedClasses }));
      }
    }
  } catch (_) {}
};

const loadViewerClassrooms = (): ClassRoom[] => {
  try {
    const saved = localStorage.getItem('smartboard_teachers');
    if (saved) {
      const teachers = JSON.parse(saved);
      if (Array.isArray(teachers) && teachers.length > 0) {
        const activeId = localStorage.getItem('smartboard_active_teacher') || localStorage.getItem('smartboard_active_teacher_id');
        const activeT = teachers.find((t: any) => t.id === activeId);
        if (activeT?.classes && activeT.classes.length > 0 && activeT.classes.some((c: any) => (c.students?.length || 0) > 0)) {
          return activeT.classes;
        }
        // Tìm giáo viên bất kỳ có danh sách lớp đã tải lên
        const teacherWithClasses = teachers.find((t: any) => t.classes && t.classes.length > 0 && t.classes.some((c: any) => (c.students?.length || 0) > 0));
        if (teacherWithClasses?.classes && teacherWithClasses.classes.length > 0) {
          return teacherWithClasses.classes;
        }
      }
    }
  } catch (_) {}

  try {
    const savedList = localStorage.getItem('smartboard_active_classroom_list') || localStorage.getItem('smartboard_classrooms');
    if (savedList) {
      const parsed = JSON.parse(savedList);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.some((c: any) => (c.students?.length || 0) > 0)) {
        return parsed;
      }
    }
  } catch (_) {}

  // Danh sách mặc định chuẩn 12 học sinh Lớp 12A1 đồng bộ chuẩn xác với tab Lớp học
  return [
    {
      id: 'class_12a1',
      name: '12A1',
      grade: 'Lớp 12',
      academicYear: '2026 - 2027',
      subject: 'Toán học',
      students: [
        { id: 'st_1', code: 'HS1201', name: 'Nguyễn Văn An', studentCode: 'HS1201', oralScore: 9, bonusPoints: 2, gender: 'male', avatar: '👨‍🎓', isCalled: false },
        { id: 'st_2', code: 'HS1202', name: 'Trần Thị Bình', studentCode: 'HS1202', oralScore: 10, bonusPoints: 1, gender: 'female', avatar: '👩‍🎓', isCalled: false },
        { id: 'st_3', code: 'HS1203', name: 'Lê Hoàng Cường', studentCode: 'HS1203', oralScore: 8, bonusPoints: 0, gender: 'male', avatar: '👨‍🎓', isCalled: false },
        { id: 'st_4', code: 'HS1204', name: 'Phạm Thu Dung', studentCode: 'HS1204', oralScore: 9, bonusPoints: 3, gender: 'female', avatar: '👩‍🎓', isCalled: false },
        { id: 'st_5', code: 'HS1205', name: 'Vũ Quốc Bảo', studentCode: 'HS1205', oralScore: 8, bonusPoints: 1, gender: 'male', avatar: '👨‍🎓', isCalled: false },
        { id: 'st_6', code: 'HS1206', name: 'Đỗ Gia Hân', studentCode: 'HS1206', oralScore: 10, bonusPoints: 2, gender: 'female', avatar: '👩‍🎓', isCalled: false },
        { id: 'st_7', code: 'HS1207', name: 'Hoàng Đức Anh', studentCode: 'HS1207', oralScore: 9, bonusPoints: 0, gender: 'male', avatar: '👨‍🎓', isCalled: false },
        { id: 'st_8', code: 'HS1208', name: 'Bùi Ngọc Ánh', studentCode: 'HS1208', oralScore: 10, bonusPoints: 2, gender: 'female', avatar: '👩‍🎓', isCalled: false },
        { id: 'st_9', code: 'HS1209', name: 'Đặng Khánh Linh', studentCode: 'HS1209', oralScore: 9, bonusPoints: 1, gender: 'female', avatar: '👩‍🎓', isCalled: false },
        { id: 'st_10', code: 'HS1210', name: 'Trịnh Tuấn Kiệt', studentCode: 'HS1210', oralScore: 10, bonusPoints: 3, gender: 'male', avatar: '👨‍🎓', isCalled: false },
        { id: 'st_11', code: 'HS1211', name: 'Lê Mỹ Duyên', studentCode: 'HS1211', oralScore: 9, bonusPoints: 1, gender: 'female', avatar: '👩‍🎓', isCalled: false },
        { id: 'st_12', code: 'HS1212', name: 'Nguyễn Tiến Đạt', studentCode: 'HS1212', oralScore: 8, bonusPoints: 0, gender: 'male', avatar: '👨‍🎓', isCalled: false },
      ],
    },
    {
      id: 'class_12a2',
      name: '12A2',
      grade: 'Lớp 12',
      academicYear: '2026 - 2027',
      subject: 'Toán học',
      students: [
        { id: 'st_21', code: 'HS1213', name: 'Trần Hoàng Nam', studentCode: 'HS1213', oralScore: 9, bonusPoints: 1, gender: 'male', avatar: '👨‍🎓', isCalled: false },
        { id: 'st_22', code: 'HS1214', name: 'Lê Quỳnh Nga', studentCode: 'HS1214', oralScore: 10, bonusPoints: 2, gender: 'female', avatar: '👩‍🎓', isCalled: false },
        { id: 'st_23', code: 'HS1215', name: 'Phạm Minh Quân', studentCode: 'HS1215', oralScore: 8, bonusPoints: 0, gender: 'male', avatar: '👨‍🎓', isCalled: false },
        { id: 'st_24', code: 'HS1216', name: 'Ngô Gia Huy', studentCode: 'HS1216', oralScore: 9, bonusPoints: 1, gender: 'male', avatar: '👨‍🎓', isCalled: false },
      ],
    },
  ];
};

// Configure pdfjs worker using unpkg / cdnjs or inline worker to avoid Vite bundling worker issues
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
  } catch (e) {
    console.warn('PDF Worker init notice:', e);
  }
}

interface PDFCanvasViewerProps {
  fileUrl: string;
  title: string;
  lessonId?: string;
  zoom?: number;
  rotation?: number;
  compact?: boolean;
  isAnnotating?: boolean;
  onToggleAnnotating?: () => void;
  onFullscreenRequest?: () => void;
  onOpenFile?: () => void;
}

export const PDFCanvasViewer: React.FC<PDFCanvasViewerProps> = ({
  fileUrl,
  title = 'Tài liệu PDF',
  lessonId,
  zoom = 100,
  rotation = 0,
  compact = false,
  isAnnotating: propIsAnnotating,
  onToggleAnnotating,
  onFullscreenRequest,
  onOpenFile,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInputVal, setPageInputVal] = useState<string>('1');
  const [isEditingPage, setIsEditingPage] = useState<boolean>(false);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [aspectRatio, setAspectRatio] = useState<number>(1.414); // Default standard A4
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const singleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const singleTextLayerRef = useRef<HTMLDivElement | null>(null);
  const singleRenderTaskRef = useRef<any>(null);
  const [isSpeakingPage, setIsSpeakingPage] = useState<boolean>(false);
  const [selectedVoice, setSelectedVoice] = useState<VoiceTonePreset>(VOICE_TONE_PRESETS[0]);
  const [showVoiceMenu, setShowVoiceMenu] = useState<boolean>(false);

  // Helper to reconstruct clean Vietnamese text from PDF items without artificial kerning splits
  const extractCleanPageText = useCallback((textContent: any): string => {
    return extractCleanPdfText(textContent);
  }, []);

  // Quick Speech reader for currently viewed page
  const handleReadCurrentPage = useCallback(async () => {
    if (isSpeakingPage) {
      stopAllSpeech();
      setIsSpeakingPage(false);
      return;
    }
    if (!pdfDoc) return;
    try {
      const page = await pdfDoc.getPage(currentPage);
      const textContent = await page.getTextContent();
      const pageText = extractCleanPageText(textContent);

      if (!pageText || !pageText.trim()) {
        alert('Trang này không có văn bản dạng ký tự (có thể là trang scan hình ảnh). Bạn có thể dùng chuột hoặc bút quét đoạn chữ để đọc.');
        return;
      }

      setIsSpeakingPage(true);
      speakText(pageText, {
        preset: selectedVoice,
        onStart: () => setIsSpeakingPage(true),
        onEnd: () => setIsSpeakingPage(false),
        onError: () => setIsSpeakingPage(false),
      });
    } catch (e: any) {
      console.warn('Read page error:', e);
      setIsSpeakingPage(false);
    }
  }, [isSpeakingPage, pdfDoc, currentPage, selectedVoice, extractCleanPageText]);

  const handleReadWithVoice = useCallback(async (preset: VoiceTonePreset) => {
    if (!pdfDoc) return;
    try {
      const page = await pdfDoc.getPage(currentPage);
      const textContent = await page.getTextContent();
      const pageText = extractCleanPageText(textContent);

      if (!pageText || !pageText.trim()) return;

      setIsSpeakingPage(true);
      speakText(pageText, {
        preset,
        onStart: () => setIsSpeakingPage(true),
        onEnd: () => setIsSpeakingPage(false),
        onError: () => setIsSpeakingPage(false),
      });
    } catch (_) {
      setIsSpeakingPage(false);
    }
  }, [pdfDoc, currentPage, extractCleanPageText]);

  // Drawing Annotation state (Synced with prop or local fallback)
  const [internalAnnotating, setInternalAnnotating] = useState<boolean>(false);
  const effectiveAnnotating =
    propIsAnnotating !== undefined ? propIsAnnotating : internalAnnotating;

  const toggleAnnotating = useCallback(() => {
    if (onToggleAnnotating) {
      onToggleAnnotating();
    } else {
      setInternalAnnotating((prev) => !prev);
    }
  }, [onToggleAnnotating]);

  // Student Caller state & Class Selection
  const [allClassrooms, setAllClassrooms] = useState<ClassRoom[]>(loadViewerClassrooms);
  const [selectedClassIndex, setSelectedClassIndex] = useState<number>(0);
  const [showClassDropdown, setShowClassDropdown] = useState<boolean>(false);
  const [showRandomPickerModal, setShowRandomPickerModal] = useState<boolean>(false);

  // Synchronize classrooms when teacher updates or uploads roster in "Lớp học" tab
  const refreshClassrooms = useCallback(() => {
    const latest = loadViewerClassrooms();
    setAllClassrooms(latest);
  }, []);

  useEffect(() => {
    const handleSync = () => refreshClassrooms();
    window.addEventListener('smartboard_classes_updated', handleSync);
    window.addEventListener('storage', handleSync);
    window.addEventListener('focus', handleSync);
    return () => {
      window.removeEventListener('smartboard_classes_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [refreshClassrooms]);

  useEffect(() => {
    if (showClassDropdown || showRandomPickerModal) {
      refreshClassrooms();
    }
  }, [showClassDropdown, showRandomPickerModal, refreshClassrooms]);

  // Action state
  const [internalZoom, setInternalZoom] = useState<number>(zoom);
  const [viewMode, setViewMode] = useState<'single' | 'continuous'>('continuous');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync prop zoom if updated from parent
  useEffect(() => {
    if (zoom) setInternalZoom(zoom);
  }, [zoom]);

  // Fullscreen event listener to sync state with native browser fullscreen changes
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Keyboard shortcut listener ('f' for fullscreen, 'b' or 'p' for pen drawing)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'b' || e.key === 'B' || e.key === 'p' || e.key === 'P') {
        toggleAnnotating();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleAnnotating]);

  // Load PDF Document
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const loadDoc = async () => {
      try {
        let loadingTask: any;
        let doc: any = null;
        let pdfBytes: Uint8Array | null = null;

        // 1. Convert data URL or fetch blob / http URL to ArrayBuffer in main thread
        try {
          if (fileUrl.startsWith('data:')) {
            const base64Data = fileUrl.includes(',') ? fileUrl.split(',')[1] : fileUrl;
            const binaryStr = window.atob(base64Data.replace(/\s+/g, ''));
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            pdfBytes = bytes;
          } else if (!fileUrl.startsWith('firestore://')) {
            const res = await fetch(fileUrl);
            if (res.ok) {
              const arrayBuffer = await res.arrayBuffer();
              pdfBytes = new Uint8Array(arrayBuffer);
            }
          }
        } catch (fetchErr) {
          console.warn('Main-thread PDF fetch notice, trying cloud storage fallback:', fetchErr);
        }

        // 2. Fallback: Check local IndexedDB or Firestore if URL failed or was firestore://
        if (!pdfBytes) {
          const targetId = lessonId || (() => {
            const docIdMatch = fileUrl.match(/\/uploads\/(lesson_\d+|doc_\d+)_/) || fileUrl.match(/(lesson_\d+|doc_\d+)/);
            return docIdMatch ? docIdMatch[1] : '';
          })();

          if (targetId) {
            try {
              const { fetchFileFromCloudStore } = await import('../utils/storageUtils');
              const fileData = await fetchFileFromCloudStore(targetId);
              if (fileData?.blob) {
                const arrayBuffer = await fileData.blob.arrayBuffer();
                pdfBytes = new Uint8Array(arrayBuffer);
              }
            } catch (_) {}
          }
        }

        if (!pdfBytes || pdfBytes.length === 0) {
          throw new Error('Không thể tải dữ liệu tệp PDF từ bộ nhớ hoặc máy chủ.');
        }

        // Pass bytes directly so the worker never has cross-origin network fetch issues
        loadingTask = pdfjsLib.getDocument({
          data: pdfBytes,
          cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/cmaps/`,
          cMapPacked: true,
        });
        doc = await loadingTask.promise;

        if (!isMounted) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setCurrentPage(1);
        setPageInputVal('1');

        // Measure page 1 dimensions to lock aspect ratio for super smooth virtualized scrolling
        try {
          const page1 = await doc.getPage(1);
          const vp = page1.getViewport({ scale: 1 });
          if (vp.width && vp.height) {
            setAspectRatio(vp.height / vp.width);
          }
        } catch (measErr) {
          console.warn('Could not measure page 1 aspect ratio:', measErr);
        }

        setLoading(false);
      } catch (err: any) {
        console.error('Error loading PDF with pdfjs:', err);
        if (isMounted) {
          setError(err.message || 'Không thể giải mã tệp PDF.');
          setLoading(false);
        }
      }
    };

    loadDoc();

    return () => {
      isMounted = false;
      if (singleRenderTaskRef.current) {
        try {
          singleRenderTaskRef.current.cancel();
        } catch {
          // Ignore cancellation errors
        }
      }
    };
  }, [fileUrl]);

  // Base calculated page pixel dimensions based on zoom & aspect ratio
  const pageWidth = Math.max(300, Math.round((internalZoom / 100) * 750));
  const pageHeight = Math.round(pageWidth * aspectRatio);

  // Render Current Page to Canvas (Single Page Mode)
  useEffect(() => {
    if (!pdfDoc || !singleCanvasRef.current || viewMode !== 'single') return;

    let isCurrent = true;

    const renderPage = async () => {
      try {
        if (singleRenderTaskRef.current) {
          try {
            singleRenderTaskRef.current.cancel();
          } catch {
            // Ignore cancellation
          }
        }

        const page = await pdfDoc.getPage(currentPage);
        if (!isCurrent || !singleCanvasRef.current) return;

        const canvas = singleCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const baseScale = (internalZoom / 100) * 1.35;
        const scaleFactor = baseScale * dpr;
        const viewport = page.getViewport({ scale: scaleFactor, rotation });

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = `${pageWidth}px`;
        canvas.style.height = `${pageHeight}px`;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const task = page.render(renderContext);
        singleRenderTaskRef.current = task;
        await task.promise;

        if (singleTextLayerRef.current && isCurrent) {
          try {
            const textContent = await page.getTextContent();
            if (singleTextLayerRef.current && isCurrent) {
              singleTextLayerRef.current.innerHTML = '';
              singleTextLayerRef.current.style.setProperty('--scale-factor', `${scaleFactor}`);
              const textTask = (pdfjsLib as any).renderTextLayer({
                textContentSource: textContent,
                container: singleTextLayerRef.current,
                viewport: viewport,
              });
              await textTask.promise;
            }
          } catch (tErr) {
            console.warn('Single text layer render notice:', tErr);
          }
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('PDF single page render error:', err);
        }
      }
    };

    renderPage();

    return () => {
      isCurrent = false;
    };
  }, [pdfDoc, currentPage, internalZoom, rotation, viewMode, pageWidth, pageHeight]);

  // Jump to a specific page
  const handleJumpToPage = (target: number) => {
    const validPage = Math.min(numPages, Math.max(1, target));
    setCurrentPage(validPage);
    setPageInputVal(String(validPage));
    setIsEditingPage(false);

    if (viewMode === 'continuous' && scrollContainerRef.current) {
      const pageEl = document.getElementById(`pdf-page-${validPage}`);
      if (pageEl) {
        pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Track active page during smooth scroll with requestAnimationFrame throttling (Continuous Mode)
  const scrollRafRef = useRef<number | null>(null);
  const handleScroll = () => {
    if (viewMode !== 'continuous' || !scrollContainerRef.current || numPages === 0) return;
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      if (!scrollContainerRef.current) return;
      const container = scrollContainerRef.current;
      const scrollTop = container.scrollTop;
      const gap = 24; // 24px gap between pages
      const approxPage = Math.min(
        numPages,
        Math.max(1, Math.floor((scrollTop + pageHeight * 0.3) / (pageHeight + gap)) + 1)
      );
      if (approxPage !== currentPage) {
        setCurrentPage(approxPage);
        setPageInputVal(String(approxPage));
      }
    });
  };

  // Handle Fullscreen Toggle
  const toggleFullscreen = () => {
    if (onFullscreenRequest) {
      onFullscreenRequest();
      return;
    }
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-3 bg-slate-950 text-white">
        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
        <p className="text-sm font-bold text-slate-300">Đang tải và tối ưu hóa tài liệu PDF ({title})...</p>
        <p className="text-xs text-slate-500">Khởi tạo chế độ cuộn mượt mà siêu tốc chuẩn SmartBoard 75 Pro</p>
      </div>
    );
  }

  if (error || !pdfDoc) {
    return (
      <div className="flex-1 w-full h-full flex flex-col bg-slate-950 text-white relative">
        <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs shrink-0 z-20">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-200 truncate max-w-xs">{title}</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
              PDF
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onOpenFile && (
              <button
                onClick={onOpenFile}
                className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1 text-xs cursor-pointer shadow-xs"
              >
                Mở Tệp Khác
              </button>
            )}
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1 text-xs shadow-xs"
              >
                <ExternalLink className="w-3 h-3" />
                Mở Tab Mới
              </a>
            )}
            {fileUrl && (
              <a
                href={fileUrl}
                download={`${title}.pdf`}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center gap-1 text-xs border border-slate-700 shadow-xs"
              >
                <Download className="w-3 h-3" />
                Tải Về
              </a>
            )}
          </div>
        </div>
        {fileUrl ? (
          <iframe
            src={fileUrl}
            className="w-full flex-1 border-0 bg-white"
            title={title}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
            <h4 className="text-base font-bold text-white">Chưa có tệp PDF để hiển thị</h4>
            <p className="text-xs text-slate-400 max-w-sm">
              {error || 'Vui lòng chọn hoặc tải lên tệp PDF từ máy tính hoặc USB.'}
            </p>
            {onOpenFile && (
              <button
                onClick={onOpenFile}
                className="mt-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
              >
                Chọn Tệp PDF Ngay
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id="pdf-viewer-root-container"
      className="flex-1 w-full h-full flex flex-col overflow-hidden bg-slate-950 text-slate-100 relative select-text"
    >
      {/* Top PDF Toolbar Strip */}
      <div className="px-3 py-2 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 select-none shadow-md z-20">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="font-bold text-slate-200 flex items-center gap-1.5 truncate">
            <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="truncate max-w-[200px] md:max-w-md">{title}</span>
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold hidden sm:inline shrink-0">
            {numPages} trang
          </span>
          {onOpenFile && (
            <button
              onClick={onOpenFile}
              className="ml-2 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer shadow-xs"
              title="Mở tài liệu khác"
            >
              Mở Tệp Khác
            </button>
          )}
        </div>

        {/* Zoom & View Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Zoom Out */}
          <button
            onClick={() => setInternalZoom((z) => Math.max(50, z - 15))}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Thu nhỏ (-15%)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="text-[11px] font-mono font-bold text-indigo-300 px-1 min-w-10 text-center">
            {internalZoom}%
          </span>

          {/* Zoom In */}
          <button
            onClick={() => setInternalZoom((z) => Math.min(250, z + 15))}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Phóng to (+15%)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* Reset Zoom */}
          <button
            onClick={() => setInternalZoom(100)}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 hover:text-white transition-colors hidden md:inline cursor-pointer"
            title="Đặt lại 100%"
          >
            100%
          </button>

          {/* View Mode Toggle: Continuous Scroll vs Single Page */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 ml-1">
            <button
              onClick={() => setViewMode('continuous')}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                viewMode === 'continuous'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Chế độ cuộn liên tục mượt mà"
            >
              Cuộn
            </button>
            <button
              onClick={() => setViewMode('single')}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                viewMode === 'single'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Chế độ lật từng trang"
            >
              Trang
            </button>
          </div>

          {/* Page Navigator & Jump to Page */}
          <div className="flex items-center gap-1 bg-slate-800/90 px-2 py-0.5 rounded-lg border border-slate-700 ml-1">
            <button
              onClick={() => handleJumpToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 text-slate-300 cursor-pointer"
              title="Trang trước"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {isEditingPage ? (
              <input
                type="number"
                min={1}
                max={numPages}
                value={pageInputVal}
                onChange={(e) => setPageInputVal(e.target.value)}
                onBlur={() => handleJumpToPage(parseInt(pageInputVal, 10) || currentPage)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleJumpToPage(parseInt(pageInputVal, 10) || currentPage);
                  } else if (e.key === 'Escape') {
                    setIsEditingPage(false);
                    setPageInputVal(String(currentPage));
                  }
                }}
                autoFocus
                className="w-12 text-center bg-slate-950 border border-indigo-500 text-white font-mono text-[11px] font-bold rounded py-0.5 px-1 outline-none"
              />
            ) : (
              <button
                onClick={() => setIsEditingPage(true)}
                className="font-mono text-[11px] font-bold text-indigo-300 px-1 hover:underline cursor-pointer"
                title="Bấm để nhập số trang cần nhảy tới"
              >
                {currentPage}/{numPages}
              </button>
            )}

            <button
              onClick={() => handleJumpToPage(currentPage + 1)}
              disabled={currentPage >= numPages}
              className="p-1 rounded hover:bg-white/10 disabled:opacity-30 text-slate-300 cursor-pointer"
              title="Trang tiếp theo"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* AI Page Reader Button + Voice Selector */}
          <div className="relative flex items-center">
            <button
              onClick={handleReadCurrentPage}
              className={`px-3 py-1 rounded-l-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer border-y border-l ${
                isSpeakingPage
                  ? 'bg-rose-600 text-white border-rose-400 ring-2 ring-rose-400/80 shadow-md'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/60 shadow-xs'
              }`}
              title={
                isSpeakingPage
                  ? 'Dừng đọc văn bản trang này'
                  : `Đọc to toàn bộ văn bản trang hiện tại bằng ${selectedVoice.name}`
              }
            >
              {isSpeakingPage ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>⏹ Dừng</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>🔊 Đọc Trang Này</span>
                </>
              )}
            </button>

            {/* Voice Dropdown Toggle Button */}
            <button
              onClick={() => setShowVoiceMenu((prev) => !prev)}
              className="px-2 py-1 bg-emerald-700 hover:bg-emerald-600 text-white border-y border-r border-emerald-400/60 rounded-r-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
              title="Chọn giọng đọc: Nam, Nữ, Học Sinh, Podcast"
            >
              <span>{selectedVoice.icon}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showVoiceMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu for 4 Voices */}
            {showVoiceMenu && (
              <div
                className="absolute top-full mt-1.5 left-0 z-50 w-72 bg-slate-950/98 backdrop-blur-2xl border-2 border-emerald-500/70 rounded-2xl shadow-2xl p-2 text-white space-y-1 animate-in fade-in zoom-in-95 duration-100"
                onMouseLeave={() => setShowVoiceMenu(false)}
              >
                <div className="px-2 py-1 text-[10px] font-black uppercase text-emerald-400 border-b border-white/10 flex items-center justify-between">
                  <span>CHỌN GIỌNG ĐỌC TIẾNG VIỆT</span>
                  <span className="text-[9px] text-slate-400 font-mono">100% Âm lượng</span>
                </div>
                {VOICE_TONE_PRESETS.map((preset) => {
                  const isSel = selectedVoice.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setSelectedVoice(preset);
                        setShowVoiceMenu(false);
                        if (isSpeakingPage) {
                          stopAllSpeech();
                          setIsSpeakingPage(false);
                          setTimeout(() => {
                            handleReadWithVoice(preset);
                          }, 60);
                        }
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer ${
                        isSel
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold ring-1 ring-emerald-400'
                          : 'hover:bg-white/10 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{preset.icon}</span>
                        <div>
                          <div className="font-bold text-xs">{preset.name}</div>
                          <div className="text-[10px] text-slate-400 opacity-80">{preset.sub}</div>
                        </div>
                      </div>
                      {isSel && <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Class Selection Dropdown & Random Student Caller */}
          <div className="relative flex items-center">
            <button
              onClick={() => setShowClassDropdown((prev) => !prev)}
              className="px-2.5 py-1 rounded-l-lg bg-indigo-950/90 hover:bg-indigo-900 border border-indigo-700/80 text-indigo-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="Lựa chọn lớp học để gọi học sinh lên bảng"
            >
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Lớp: {allClassrooms[selectedClassIndex]?.name || '12A1'}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showClassDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showClassDropdown && (
              <div
                className="absolute top-full mt-1.5 left-0 z-50 w-48 bg-slate-950/95 backdrop-blur-xl border border-indigo-500/50 rounded-xl shadow-2xl p-1.5 text-white space-y-1 animate-in fade-in zoom-in-95"
                onMouseLeave={() => setShowClassDropdown(false)}
              >
                <div className="px-2 py-1 text-[10px] font-black uppercase text-indigo-400 border-b border-white/10 flex items-center justify-between">
                  <span>LỰA CHỌN LỚP HỌC</span>
                  <span className="text-[9px] text-slate-400 font-mono">{allClassrooms.length} Lớp</span>
                </div>
                {allClassrooms.map((c, idx) => (
                  <button
                    key={c.id || idx}
                    onClick={() => {
                      setSelectedClassIndex(idx);
                      setShowClassDropdown(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                      selectedClassIndex === idx ? 'bg-indigo-600 text-white font-black' : 'hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    <span>{c.name} ({c.students?.length || 0} HS)</span>
                    {selectedClassIndex === idx && <Check className="w-3.5 h-3.5 text-amber-300" />}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowRandomPickerModal(true)}
              className="px-3 py-1 rounded-r-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black flex items-center gap-1.5 border border-amber-400 shadow-md transition-all active:scale-95 cursor-pointer"
              title="Gọi ngẫu nhiên học sinh trong lớp lên bảng phát biểu hoặc trả lời câu hỏi"
            >
              <span>🎯 Gọi Học Sinh</span>
            </button>
          </div>

          {/* Prominent Pen Annotation Button in Toolbar */}
          <button
            onClick={toggleAnnotating}
            className={`px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer border ${
              effectiveAnnotating
                ? 'bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-amber-300/80 shadow-md animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border-amber-500/30'
            }`}
            title={
              effectiveAnnotating
                ? 'Đang bật bút vẽ lên tài liệu (nhấn để tắt)'
                : 'Bật công cụ viết, vẽ phấn, dạ quang lên bài giảng (Phím tắt: B hoặc P)'
            }
          >
            <Pen className="w-3.5 h-3.5" />
            <span>{effectiveAnnotating ? 'Đang Viết Vẽ' : 'Bút Viết Lên Bài Giảng'}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className={`p-1.5 rounded-lg transition-colors ml-1 cursor-pointer flex items-center gap-1 ${
              isFullscreen
                ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                : 'bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white'
            }`}
            title={isFullscreen ? 'Thu nhỏ cửa sổ (Phím Esc hoặc F)' : 'Phóng to toàn màn hình (Phím F)'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Main PDF Scrollable Reading Canvas Area with Touch Pinch-To-Zoom */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 w-full h-full overflow-y-auto overflow-x-auto p-4 flex flex-col items-center bg-slate-950/95 custom-scrollbar relative select-text touch-pan-y scroll-smooth overscroll-contain"
        style={{
          WebkitOverflowScrolling: 'touch',
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 2 && containerRef.current) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
            (containerRef.current as any)._pinchStartDist = dist;
            (containerRef.current as any)._pinchStartZoom = internalZoom;
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && (containerRef.current as any)?._pinchStartDist) {
            e.preventDefault();
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
            const startDist = (containerRef.current as any)._pinchStartDist;
            const startZoom = (containerRef.current as any)._pinchStartZoom || 100;
            if (startDist > 10) {
              const scale = dist / startDist;
              const newZoom = Math.round(Math.min(300, Math.max(40, startZoom * scale)));
              setInternalZoom(newZoom);
            }
          }
        }}
        onTouchEnd={(e) => {
          if (e.touches.length < 2) {
            if (containerRef.current) {
              delete (containerRef.current as any)._pinchStartDist;
              delete (containerRef.current as any)._pinchStartZoom;
            }
          }
        }}
        onWheel={(e) => {
          if (e.ctrlKey) {
            e.preventDefault();
            const delta = -e.deltaY * 0.5;
            setInternalZoom((z) => Math.min(300, Math.max(40, Math.round(z + delta))));
          }
        }}
      >
        {viewMode === 'single' ? (
          <div className="relative my-auto flex flex-col items-center transition-transform duration-100 ease-out select-text">
            <div
              className="rounded-xl shadow-2xl bg-white overflow-hidden relative select-text"
              style={{
                boxShadow: '0 20px 50px rgba(0,0,0,0.85)',
                width: `${pageWidth}px`,
                height: `${pageHeight}px`,
              }}
            >
              <canvas
                ref={singleCanvasRef}
                className="block"
                style={{
                  width: `${pageWidth}px`,
                  height: `${pageHeight}px`,
                }}
              />
              {/* Native PDF TextLayer for Drag-To-Select & Instant AI Speech */}
              <div
                ref={singleTextLayerRef}
                className="textLayer absolute inset-0 select-text"
                style={{
                  width: `${pageWidth}px`,
                  height: `${pageHeight}px`,
                  pointerEvents: 'auto',
                  userSelect: 'text',
                  WebkitUserSelect: 'text',
                }}
              />
            </div>
            <div className="mt-3 text-xs text-slate-400 font-medium select-none">
              Trang {currentPage} trên tổng số {numPages} • Thu phóng: {internalZoom}%
            </div>
          </div>
        ) : (
          /* Continuous Scroll: High-performance virtualized column for 100+ pages */
          <div
            className="flex flex-col items-center gap-6 py-2 transition-all duration-75 ease-out"
            style={{
              width: `${pageWidth}px`,
              minWidth: `${pageWidth}px`,
            }}
          >
            {Array.from({ length: numPages }, (_, idx) => idx + 1).map((pNum) => (
              <PDFPageItem
                key={pNum}
                pdfDoc={pdfDoc}
                pageNumber={pNum}
                zoom={internalZoom}
                rotation={rotation}
                pageWidth={pageWidth}
                pageHeight={pageHeight}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating Pen Action button when drawing overlay is inactive (standalone mode) */}
      {!effectiveAnnotating && !onToggleAnnotating && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto animate-fade-in flex items-center gap-2">
          <button
            onClick={toggleAnnotating}
            className="px-4 py-2.5 rounded-full bg-slate-950/95 hover:bg-emerald-600 border-2 border-white/40 text-white font-black text-xs md:text-sm flex items-center gap-2 shadow-2xl backdrop-blur-xl transition-all hover:scale-105 active:scale-95 cursor-pointer ring-4 ring-emerald-500/20"
            title="Bật thanh công cụ viết, vẽ phấn, dạ quang trực tiếp lên bài giảng (Phím tắt: B hoặc P)"
          >
            <Pen className="w-4 h-4 text-emerald-400" />
            <span>Bật Bút Viết Lên Bài Giảng</span>
          </button>
        </div>
      )}

      {/* Interactive Overlay Touch Whiteboard (always active when effectiveAnnotating is true) */}
      {effectiveAnnotating && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          <TouchWhiteboard
            id={`pdf-whiteboard-overlay-${title.replace(/[^a-zA-Z0-9]/g, '_')}`}
            isOverlay={true}
            onCloseOverlay={toggleAnnotating}
          />
        </div>
      )}

      {/* Lucky Random Student Picker Game Modal */}
      {showRandomPickerModal && (
        <RandomStudentPickerModal
          isOpen={showRandomPickerModal}
          onClose={() => setShowRandomPickerModal(false)}
          classroom={allClassrooms[selectedClassIndex] || allClassrooms[0]}
          allClasses={allClassrooms}
          onSelectClassroom={(cls) => {
            const idx = allClassrooms.findIndex((c) => c.id === cls.id);
            if (idx !== -1) setSelectedClassIndex(idx);
          }}
          onAddBonusPoint={(studentId) => {
            setAllClassrooms((prev) => {
              const updated = prev.map((c) => ({
                ...c,
                students: c.students.map((st) =>
                  st.id === studentId ? { ...st, bonusPoints: (st.bonusPoints || 0) + 1, isCalled: true } : st
                ),
              }));
              persistUpdatedClassrooms(updated);
              return updated;
            });
          }}
          onSetOralScore={(studentId, score) => {
            setAllClassrooms((prev) => {
              const updated = prev.map((c) => ({
                ...c,
                students: c.students.map((st) =>
                  st.id === studentId ? { ...st, oralScore: score, isCalled: true } : st
                ),
              }));
              persistUpdatedClassrooms(updated);
              return updated;
            });
          }}
        />
      )}
    </div>
  );
};

/**
 * High-performance Individual Page Item with IntersectionObserver Virtualization
 * Ensures only visible & near-visible pages allocate heavy Canvas memory.
 * Frees GPU RAM for 100+ page documents and delivers silky-smooth 60-120fps scrolling.
 */
const PDFPageItem: React.FC<{
  pdfDoc: any;
  pageNumber: number;
  zoom: number;
  rotation: number;
  pageWidth: number;
  pageHeight: number;
}> = ({ pdfDoc, pageNumber, zoom, rotation, pageWidth, pageHeight }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const [isInViewport, setIsInViewport] = useState<boolean>(pageNumber <= 2);
  const [rendered, setRendered] = useState<boolean>(false);
  const renderTaskRef = useRef<any>(null);

  // IntersectionObserver to only mount & render canvas when within 1000px of view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setIsInViewport(true);
        } else {
          // When page scrolls far away, release canvas rendering to preserve memory
          setIsInViewport(false);
          setRendered(false);
        }
      },
      {
        rootMargin: '1000px 0px 1000px 0px',
        threshold: 0.01,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber]);

  // Render to canvas when page enters the viewport margin
  useEffect(() => {
    if (!isInViewport || !pdfDoc) return;
    let isCancelled = false;

    const render = async () => {
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
        }

        const page = await pdfDoc.getPage(pageNumber);
        if (isCancelled || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        const baseScale = (zoom / 100) * 1.35;
        const scaleFactor = baseScale * dpr;
        const viewport = page.getViewport({ scale: scaleFactor, rotation });

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = `${pageWidth}px`;
        canvas.style.height = `${pageHeight}px`;

        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        if (textLayerRef.current && !isCancelled) {
          try {
            const textContent = await page.getTextContent();
            if (textLayerRef.current && !isCancelled) {
              textLayerRef.current.innerHTML = '';
              textLayerRef.current.style.setProperty('--scale-factor', `${scaleFactor}`);
              const textTask = (pdfjsLib as any).renderTextLayer({
                textContentSource: textContent,
                container: textLayerRef.current,
                viewport: viewport,
              });
              await textTask.promise;
            }
          } catch (tErr) {
            console.warn('Continuous text layer render notice:', tErr);
          }
        }

        if (!isCancelled) {
          setRendered(true);
        }
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          // ignore cancelled tasks
        }
      }
    };

    render();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
    };
  }, [isInViewport, pdfDoc, pageNumber, zoom, rotation, pageWidth, pageHeight]);

  return (
    <div
      id={`pdf-page-${pageNumber}`}
      ref={containerRef}
      className="flex flex-col items-center group relative will-change-transform"
      style={{
        width: `${pageWidth}px`,
        minHeight: `${pageHeight}px`,
        contain: 'layout style paint',
        contentVisibility: 'auto',
        containIntrinsicSize: `${pageWidth}px ${pageHeight}px`,
      }}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-700/50 transition-all hover:border-indigo-500/50 select-text"
        style={{
          width: `${pageWidth}px`,
          height: `${pageHeight}px`,
          boxShadow: '0 15px 35px rgba(0,0,0,0.6)',
        }}
      >
        {isInViewport ? (
          <>
            <canvas
              ref={canvasRef}
              className="block"
              style={{
                width: `${pageWidth}px`,
                height: `${pageHeight}px`,
              }}
            />
            {/* Native PDF TextLayer for Drag-To-Select & Instant AI Speech */}
            <div
              ref={textLayerRef}
              className="textLayer absolute inset-0 select-text"
              style={{
                width: `${pageWidth}px`,
                height: `${pageHeight}px`,
                pointerEvents: 'auto',
                userSelect: 'text',
                WebkitUserSelect: 'text',
              }}
            />
            {!rendered && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-slate-900 text-slate-400 text-xs font-bold"
                style={{ width: `${pageWidth}px`, height: `${pageHeight}px` }}
              >
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mr-2" />
                Đang nạp trang {pageNumber}...
              </div>
            )}
          </>
        ) : (
          /* Zero-cost lightweight placeholder when far offscreen */
          <div
            className="w-full h-full flex flex-col items-center justify-center bg-slate-900/90 text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-xl"
            style={{ width: `${pageWidth}px`, height: `${pageHeight}px` }}
          >
            <FileText className="w-8 h-8 text-slate-600 mb-1.5 opacity-60" />
            <span className="font-bold text-slate-400">Trang {pageNumber}</span>
            <span className="text-[10px] text-slate-600 mt-0.5">{zoom}%</span>
          </div>
        )}
      </div>
      <div className="mt-2 text-[11px] font-bold text-slate-500 group-hover:text-indigo-400 transition-colors">
        Trang {pageNumber} • {zoom}%
      </div>
    </div>
  );
};

