import React, { useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';

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
}

export const PDFCanvasViewer: React.FC<PDFCanvasViewerProps> = ({
  fileUrl,
  title,
  zoom = 100,
  rotation = 0,
  compact = false,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);

  // Action state
  const [internalZoom, setInternalZoom] = useState<number>(zoom);
  const [viewMode, setViewMode] = useState<'single' | 'continuous'>('continuous');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync prop zoom if updated from parent
  useEffect(() => {
    if (zoom) setInternalZoom(zoom);
  }, [zoom]);

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
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cancellation errors
        }
      }
    };
  }, [fileUrl]);

  // Render Current Page to Canvas (Single Mode)
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || viewMode !== 'single') return;

    let isCurrent = true;

    const renderPage = async () => {
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // Ignore cancellation
          }
        }

        const page = await pdfDoc.getPage(currentPage);
        if (!isCurrent || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Base scale factor adjusted for user zoom and rotation
        const scaleFactor = (internalZoom / 100) * 1.5; // High-DPI 1.5x sharp multiplier
        const viewport = page.getViewport({ scale: scaleFactor, rotation });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: ctx,
          viewport: viewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn('PDF page render error:', err);
        }
      }
    };

    renderPage();

    return () => {
      isCurrent = false;
    };
  }, [pdfDoc, currentPage, internalZoom, rotation, viewMode]);

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
        <p className="text-sm font-bold text-slate-300">Đang tải và làm mịn trang PDF ({title})...</p>
        <p className="text-xs text-slate-500">Khởi tạo chế độ đọc cuộn mượt mà chuẩn SmartBoard 75 Pro</p>
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
      className="flex-1 w-full h-full flex flex-col overflow-hidden bg-slate-950 text-slate-100 relative select-none"
    >
      {/* Top PDF Toolbar Strip */}
      <div className="px-3 py-2 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-2 text-xs shrink-0 select-none shadow-md z-10">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="font-bold text-slate-200 flex items-center gap-1.5 truncate">
            <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="truncate">{title}</span>
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold hidden sm:inline">
            {numPages} trang
          </span>
        </div>

        {/* Zoom & View Controls */}
        <div className="flex items-center gap-1.5">
          {/* Zoom Out */}
          <button
            onClick={() => setInternalZoom((z) => Math.max(50, z - 15))}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
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
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Phóng to (+15%)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* Reset Zoom */}
          <button
            onClick={() => setInternalZoom(100)}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 hover:text-white transition-colors hidden md:inline"
            title="Đặt lại 100%"
          >
            100%
          </button>

          {/* View Mode Toggle: Continuous Scroll vs Single Page */}
          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 ml-1">
            <button
              onClick={() => setViewMode('continuous')}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                viewMode === 'continuous'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Chế độ cuộn liên tục các trang"
            >
              Cuộn
            </button>
            <button
              onClick={() => setViewMode('single')}
              className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                viewMode === 'single'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Chế độ lật từng trang"
            >
              Trang
            </button>
          </div>

          {/* Single Page Navigation (if single mode) */}
          {viewMode === 'single' && (
            <div className="flex items-center gap-1 bg-slate-800/90 px-2 py-1 rounded-lg border border-slate-700 ml-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 text-slate-300"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] font-bold text-indigo-300 px-1">
                {currentPage}/{numPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                disabled={currentPage >= numPages}
                className="p-0.5 rounded hover:bg-white/10 disabled:opacity-30 text-slate-300"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors ml-1"
            title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Phóng to toàn màn hình'}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main PDF Scrollable Reading Canvas Area with Touch Pinch-To-Zoom */}
      <div
        className="flex-1 w-full h-full overflow-y-auto overflow-x-auto p-4 flex flex-col items-center bg-slate-950/95 scroll-smooth custom-scrollbar relative touch-none select-none"
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
                width: 'fit-content',
              }}
            >
              <canvas
                ref={canvasRef}
                className="block transition-all"
                style={{
                  width: `${(internalZoom / 100) * 750}px`,
                  height: 'auto',
                  maxWidth: 'none',
                }}
              />
            </div>
            <div className="mt-3 text-xs text-slate-400 font-medium">
              Trang {currentPage} trên tổng số {numPages} • Thu phóng: {internalZoom}%
            </div>
          </div>
        ) : (
          /* Continuous Scroll: Render all pages in high-resolution smooth column */
          <div
            className="flex flex-col items-center gap-6 py-2 transition-all duration-100 ease-out"
            style={{
              width: 'fit-content',
              minWidth: 'min(100%, 750px)',
            }}
          >
            {Array.from({ length: numPages }, (_, idx) => idx + 1).map((pNum) => (
              <PDFPageItem
                key={pNum}
                pdfDoc={pdfDoc}
                pageNumber={pNum}
                zoom={internalZoom}
                rotation={rotation}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Individual Page Item for Continuous Smooth Scrolling
 */
const PDFPageItem: React.FC<{
  pdfDoc: any;
  pageNumber: number;
  zoom: number;
  rotation: number;
}> = ({ pdfDoc, pageNumber, zoom, rotation }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendered, setRendered] = useState<boolean>(false);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let isCancelled = false;

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (isCancelled || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const scaleFactor = (zoom / 100) * 1.4;
        const viewport = page.getViewport({ scale: scaleFactor, rotation });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: ctx,
          viewport,
        }).promise;

        if (!isCancelled) setRendered(true);
      } catch (err) {
        // Handled silently
      }
    };

    render();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, pageNumber, zoom, rotation]);

  return (
    <div className="flex flex-col items-center group" style={{ width: 'fit-content' }}>
      <div
        className="relative bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-700/50 transition-all hover:border-indigo-500/50"
        style={{
          width: `${Math.max(300, (zoom / 100) * 750)}px`,
          maxWidth: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-auto block"
          style={{
            boxShadow: '0 15px 35px rgba(0,0,0,0.6)',
          }}
        />
        {!rendered && (
          <div className="w-[600px] h-[800px] flex items-center justify-center bg-slate-900 text-slate-400 text-xs font-bold">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mr-2" />
            Đang tải trang {pageNumber}...
          </div>
        )}
      </div>
      <div className="mt-2 text-[11px] font-bold text-slate-500 group-hover:text-indigo-400 transition-colors">
        Trang {pageNumber} • {zoom}%
      </div>
    </div>
  );
};
