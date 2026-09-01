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

  // Render Current Page to Canvas
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

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
        const scaleFactor = (zoom / 100) * 1.5; // High-DPI 1.5x sharp multiplier
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
  }, [pdfDoc, currentPage, zoom, rotation]);

  if (loading) {
    return (
      <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-3 bg-slate-950 text-white">
        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
        <p className="text-sm font-bold text-slate-300">Đang đọc dữ liệu PDF ({title})...</p>
        <p className="text-xs text-slate-500">Khởi tạo bộ kết xuất Canvas chống chặn bảo mật</p>
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
    <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-slate-950 text-slate-100 relative">
      {/* Top Page Navigator Strip */}
      <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 text-xs shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-indigo-400" />
            Trang {currentPage} / {numPages}
          </span>
        </div>

        {/* Page navigation controls */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300"
            title="Trang trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="font-mono font-bold text-indigo-300 px-1">
            {currentPage} / {numPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            disabled={currentPage >= numPages}
            className="p-1 rounded hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300"
            title="Trang tiếp"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Action Link to open original */}
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors flex items-center gap-1 text-[11px]"
          title="Mở tài liệu trong tab mới"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Cửa sổ mới</span>
        </a>
      </div>

      {/* Canvas Viewport */}
      <div className="flex-1 w-full h-full overflow-auto p-4 flex items-center justify-center bg-slate-950/95">
        <canvas
          ref={canvasRef}
          className="max-w-full rounded-xl shadow-2xl bg-white transition-transform"
          style={{
            margin: '0 auto',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
          }}
        />
      </div>
    </div>
  );
};
