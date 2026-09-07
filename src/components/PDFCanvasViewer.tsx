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
} from 'lucide-react';
import { TouchWhiteboard } from './TouchWhiteboard';

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
  zoom?: number;
  rotation?: number;
  compact?: boolean;
  isAnnotating?: boolean;
  onToggleAnnotating?: () => void;
}

export const PDFCanvasViewer: React.FC<PDFCanvasViewerProps> = ({
  fileUrl,
  title,
  zoom = 100,
  rotation = 0,
  compact = false,
  isAnnotating: propIsAnnotating,
  onToggleAnnotating,
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
  const singleRenderTaskRef = useRef<any>(null);

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
        if (fileUrl.startsWith('data:application/pdf;base64,')) {
          const base64 = fileUrl.replace('data:application/pdf;base64,', '');
          const binaryStr = window.atob(base64);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          loadingTask = pdfjsLib.getDocument({ data: bytes });
        } else {
          loadingTask = pdfjsLib.getDocument(fileUrl);
        }

        const doc = await loadingTask.promise;
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

  // Track active page during smooth scroll (Continuous Mode)
  const handleScroll = () => {
    if (viewMode !== 'continuous' || !scrollContainerRef.current || numPages === 0) return;
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
  };

  // Handle Fullscreen Toggle
  const toggleFullscreen = () => {
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
      <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-950 text-white">
        <div className="p-4 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30 max-w-md">
          <AlertCircle className="w-10 h-10 mx-auto mb-2 text-amber-400" />
          <h4 className="text-base font-black">Xem trước tài liệu: {title}</h4>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            {error || 'Không thể kết xuất trang PDF trực tiếp. Thầy/Cô có thể mở trong tab mới hoặc tải về máy.'}
          </p>
          <div className="flex items-center justify-center gap-3 mt-4">
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Mở Tab Mới
            </a>
            <a
              href={fileUrl}
              download={`${title}.pdf`}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 border border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              Tải Xuống
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id="pdf-viewer-root-container"
      className="flex-1 w-full h-full flex flex-col overflow-hidden bg-slate-950 text-slate-100 relative select-none"
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
        className="flex-1 w-full h-full overflow-y-auto overflow-x-auto p-4 flex flex-col items-center bg-slate-950/95 custom-scrollbar relative select-none touch-pan-y"
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
          <div className="relative my-auto flex flex-col items-center transition-transform duration-100 ease-out">
            <div
              className="rounded-xl shadow-2xl bg-white overflow-hidden"
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
            </div>
            <div className="mt-3 text-xs text-slate-400 font-medium">
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

      {/* Floating Pen Action button when drawing overlay is inactive */}
      {!effectiveAnnotating && (
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

      {/* Interactive Overlay Touch Whiteboard (Rendered INSIDE container so it works 100% in Fullscreen) */}
      {effectiveAnnotating && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          <TouchWhiteboard
            id={`pdf-whiteboard-overlay-${title.replace(/[^a-zA-Z0-9]/g, '_')}`}
            isOverlay={true}
            onCloseOverlay={toggleAnnotating}
          />
        </div>
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
        className="relative bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-700/50 transition-all hover:border-indigo-500/50"
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

