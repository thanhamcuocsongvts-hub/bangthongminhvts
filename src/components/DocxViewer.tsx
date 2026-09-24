import React, { useEffect, useRef, useState, useCallback } from 'react';
import { renderAsync } from 'docx-preview';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Printer,
  Download,
  ExternalLink,
  Loader2,
  Pen,
  FileText,
  AlertCircle,
  Copy,
  Check,
  FolderOpen,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { LessonDoc } from '../types';
import { exportOriginalLessonFile } from '../utils/exportUtils';
import { TouchWhiteboard } from './TouchWhiteboard';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { cleanDocumentText } from '../utils/fileParser';
import { parseDocxWithFullMathAndMedia } from '../utils/docxMathParser';

interface DocxViewerProps {
  fileUrl?: string;
  lesson: LessonDoc;
  title?: string;
  isAnnotating?: boolean;
  onToggleAnnotating?: () => void;
  onFullscreenRequest?: () => void;
  onLaunchQuiz?: () => void;
  onOpenFile?: () => void;
}

export const DocxViewer: React.FC<DocxViewerProps> = ({
  fileUrl,
  lesson,
  title,
  isAnnotating: propIsAnnotating,
  onToggleAnnotating,
  onFullscreenRequest,
  onOpenFile,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingStatus, setLoadingStatus] = useState<string>('Đang mở tệp văn bản Word (.docx)...');
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [showZoomMenu, setShowZoomMenu] = useState<boolean>(false);
  const [isPinching, setIsPinching] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [useFallback, setUseFallback] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'math_mode' | 'print_mode'>('math_mode');
  const [hasMathFormulas, setHasMathFormulas] = useState<boolean>(false);
  const [enhancedHtml, setEnhancedHtml] = useState<string>(lesson.htmlContent || '');

  // Annotation layer state
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

  const docContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const targetUrl = fileUrl || lesson.fileUrl;
  const documentTitle = title || lesson.fileName || lesson.title || 'Tài liệu Word';

  // 2-Finger Touch Pinch-To-Zoom Gesture Tracking
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(100);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      touchStartZoomRef.current = zoom;
      setIsPinching(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = currentDist / touchStartDistRef.current;
      const targetZoom = Math.round(Math.min(300, Math.max(40, touchStartZoomRef.current * ratio)));
      setZoom(targetZoom);
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
    setIsPinching(false);
  };

  // Ctrl + Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 10 : -10;
      setZoom((prev) => Math.min(300, Math.max(40, prev + delta)));
    }
  };

  // Load and render DOCX with docx-preview
  useEffect(() => {
    let isCancelled = false;

    async function loadDocx() {
      setLoading(true);
      setError(null);
      setUseFallback(false);
      setLoadingStatus('Đang nạp dữ liệu văn bản Word (.docx)...');

      if (!targetUrl) {
        setUseFallback(true);
        setLoading(false);
        return;
      }

      try {
        let arrayBuffer: ArrayBuffer | null = null;

        if (targetUrl.startsWith('data:')) {
          // Parse base64 data URL to ArrayBuffer
          const base64Data = targetUrl.split(',')[1];
          const binaryString = window.atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          arrayBuffer = bytes.buffer;
        } else {
          // Fetch remote or blob URL
          setLoadingStatus('Đang tải tệp Word từ máy chủ...');
          const response = await fetch(targetUrl);
          if (!response.ok) {
            throw new Error(`Không thể nạp tệp (Mã lỗi HTTP: ${response.status})`);
          }
          arrayBuffer = await response.arrayBuffer();
        }

        if (isCancelled) return;

        // Check if file is a valid ZIP/OpenXML DOCX (starts with PK\x03\x04)
        const bytes = new Uint8Array(arrayBuffer);
        const isZip =
          bytes.length > 4 &&
          bytes[0] === 0x50 &&
          bytes[1] === 0x4b &&
          bytes[2] === 0x03 &&
          bytes[3] === 0x04;

        if (!isZip) {
          // Legacy Word 97-2003 (.doc) binary format or plain text
          setUseFallback(true);
          setViewMode('math_mode');
          setLoading(false);
          return;
        }

        // Deep extraction of MathType OLE equations, OMML math, and vector figures
        try {
          setLoadingStatus('Đang quét và kết xuất công thức MathType & Toán học...');
          const deepResult = await parseDocxWithFullMathAndMedia(arrayBuffer);
          if (!isCancelled && deepResult.html) {
            setEnhancedHtml(deepResult.html);
            const containsMath =
              deepResult.html.includes('mathtype-') ||
              deepResult.html.includes('katex') ||
              deepResult.html.includes('math-inline') ||
              deepResult.html.includes('data:image/svg+xml');

            if (containsMath) {
              setHasMathFormulas(true);
              setViewMode('math_mode');
            }
            // Display immediately so teacher can start reading and solving formulas right away
            setLoading(false);
          }
        } catch (deepErr) {
          console.warn('Deep MathType parse notice:', deepErr);
        }

        if (docContainerRef.current && arrayBuffer) {
          docContainerRef.current.innerHTML = '';
          try {
            await renderAsync(arrayBuffer, docContainerRef.current, undefined, {
              className: 'docx',
              inWrapper: true,
              ignoreWidth: false,
              ignoreHeight: false,
              ignoreFonts: false,
              breakPages: true,
              experimental: true,
              useBase64URL: true,
              renderHeaders: true,
              renderFooters: true,
              renderFootnotes: true,
              renderEndnotes: true,
              trimXmlDeclaration: true,
            });
          } catch (renderErr) {
            console.warn('docx-preview layout notice:', renderErr);
          }

          if (!isCancelled) {
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.warn('docx-preview render notice, switching to authentic paper view:', err);
        if (!isCancelled) {
          setUseFallback(true);
          setLoading(false);
        }
      }
    }

    loadDocx();

    return () => {
      isCancelled = true;
    };
  }, [targetUrl]);

  // Zoom controls
  const handleZoomIn = () => setZoom((z) => Math.min(250, z + 15));
  const handleZoomOut = () => setZoom((z) => Math.max(50, z - 15));
  const handleResetZoom = () => setZoom(100);

  // Copy text handler
  const handleCopyText = () => {
    const textToCopy = lesson.rawText || '';
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col w-full h-full bg-slate-200/90 select-none overflow-hidden relative font-sans">
      {/* 1. TOP TOOLBAR (Standard Word/A4 Desktop Controls) */}
      <div className="h-12 bg-slate-900 border-b border-slate-700 px-3 md:px-5 flex items-center justify-between gap-2 shrink-0 z-30 shadow-md">
        {/* Left: Document Info */}
        <div className="flex items-center gap-2.5 overflow-hidden min-w-0">
          <span className="px-2.5 py-1 rounded-md bg-blue-600 text-white font-mono text-[11px] font-black uppercase shrink-0 shadow-xs flex items-center gap-1">
            <FileText className="w-3 h-3" />
            DOCX
          </span>
          <span className="text-white text-xs md:text-sm font-bold truncate max-w-[140px] md:max-w-xs">
            {documentTitle}
          </span>
          {lesson.fileSize && (
            <span className="hidden xl:inline-block text-[11px] text-slate-400 font-mono">
              ({lesson.fileSize})
            </span>
          )}

          {/* View Mode Toggle: MathType/KaTeX vs Print Layout */}
          <div className="hidden sm:flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 ml-1">
            <button
              onClick={() => setViewMode('math_mode')}
              className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all ${
                viewMode === 'math_mode'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Chế độ hiển thị công thức MathType & Toán học rõ nét chuẩn KaTeX"
            >
              <Sparkles className="w-3 h-3 text-amber-300" />
              <span>Toán & MathType</span>
            </button>
            <button
              onClick={() => setViewMode('print_mode')}
              className={`px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-all ${
                viewMode === 'print_mode'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Chế độ trang in văn bản Word"
            >
              <FileText className="w-3 h-3" />
              <span>Trang In Word</span>
            </button>
          </div>

          {hasMathFormulas && (
            <span className="hidden lg:flex px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-600/50 text-[10px] font-bold items-center gap-1 shrink-0">
              <Check className="w-2.5 h-2.5 text-emerald-400" />
              MathType OK
            </span>
          )}
        </div>

        {/* Center/Right: Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mở File Khác button */}
          {onOpenFile && (
            <button
              onClick={onOpenFile}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
              title="Mở tài liệu khác từ máy tính hoặc Kho bài giảng"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Mở File Khác</span>
            </button>
          )}

          {/* Zoom Controls with Percentage Dropdown */}
          <div className="relative flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-slate-200">
            <button
              onClick={handleZoomOut}
              className="p-1.5 hover:bg-slate-700 rounded-md transition-colors"
              title="Thu nhỏ (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setShowZoomMenu((prev) => !prev)}
              className="px-2 py-0.5 text-xs font-mono font-bold hover:bg-slate-700 rounded-md transition-colors min-w-[55px] text-center flex items-center justify-center gap-0.5 text-amber-400"
              title="Chọn tỷ lệ phần trăm phóng to / thu nhỏ"
            >
              <span>{zoom}%</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            <button
              onClick={handleZoomIn}
              className="p-1.5 hover:bg-slate-700 rounded-md transition-colors"
              title="Phóng to (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            {/* Percentage Presets Dropdown */}
            {showZoomMenu && (
              <div
                className="absolute top-full mt-1.5 right-0 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 w-48 text-xs space-y-1"
                onMouseLeave={() => setShowZoomMenu(false)}
              >
                <div className="px-2 py-1 text-[11px] font-bold text-slate-400 border-b border-slate-800 flex items-center justify-between">
                  <span>Tỷ lệ thu phóng</span>
                  <span className="text-amber-400 font-mono">{zoom}%</span>
                </div>
                <div className="grid grid-cols-2 gap-1 pt-1">
                  {[50, 75, 90, 100, 125, 150, 175, 200, 250, 300].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => {
                        setZoom(preset);
                        setShowZoomMenu(false);
                      }}
                      className={`px-2 py-1.5 rounded-lg text-left font-mono font-bold text-xs flex items-center justify-between transition-colors ${
                        zoom === preset
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span>{preset}%</span>
                      {zoom === preset && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setZoom(100);
                    setShowZoomMenu(false);
                  }}
                  className="w-full text-center py-1.5 mt-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] border border-slate-700"
                >
                  Mặc định (100%)
                </button>
              </div>
            )}
          </div>

          {/* Reset Zoom to 100% button */}
          {zoom !== 100 && (
            <button
              onClick={handleResetZoom}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              title="Về kích thước chuẩn (100%)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Annotation Pen for 75" TV */}
          <button
            onClick={toggleAnnotating}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs ${
              effectiveAnnotating
                ? 'bg-rose-600 text-white ring-2 ring-rose-400'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Bút vẽ / Viết ghi chú trực tiếp lên văn bản Word"
          >
            <Pen className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">
              {effectiveAnnotating ? 'Tắt Bút Vẽ' : 'Bút Vẽ Lên File'}
            </span>
          </button>

          {/* Copy Text */}
          <button
            onClick={handleCopyText}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Sao chép toàn bộ nội dung văn bản"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Print */}
          <button
            onClick={handlePrint}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors hidden sm:flex"
            title="In tài liệu (Ctrl+P)"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>

          {/* Download Original File */}
          <button
            onClick={() => exportOriginalLessonFile(lesson)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-xs"
            title="Tải về máy tệp Word gốc (.docx)"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden md:inline">Tải Tệp Gốc</span>
          </button>

          {/* Fullscreen for 75" TV */}
          {onFullscreenRequest && (
            <button
              onClick={onFullscreenRequest}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
              title="Toàn màn hình trình chiếu"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* External Window */}
          {targetUrl && (
            <a
              href={targetUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              title="Mở trong tab mới"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* 2. MAIN DOCUMENT VIEWPORT WITH PINCH-ZOOM & SCROLL */}
      <div
        ref={scrollContainerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        className="flex-1 w-full h-full overflow-y-auto overflow-x-auto p-4 md:p-8 flex justify-center items-start custom-scrollbar relative"
        style={{
          backgroundColor: '#e5e7eb', // Professional neutral gray desktop background like Word Web / Google Docs
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Floating Pinch-To-Zoom Badge Indicator */}
        {isPinching && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white border border-slate-700 px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2 text-sm font-bold animate-pulse">
            <span className="text-amber-400">🔍 Phóng to/Thu nhỏ 2 ngón tay:</span>
            <span className="font-mono text-base text-cyan-300">{zoom}%</span>
          </div>
        )}
        {/* Loading Indicator */}
        {loading && (
          <div className="absolute inset-0 z-20 bg-slate-100/90 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-700">{loadingStatus}</p>
          </div>
        )}

        {/* Drawing Annotation Layer */}
        {effectiveAnnotating && (
          <div className="absolute inset-0 z-40 pointer-events-none">
            <TouchWhiteboard
              id={`docx-whiteboard-${lesson.id}`}
              isOverlay={true}
              onCloseOverlay={toggleAnnotating}
            />
          </div>
        )}

        {/* VIEW CONTAINER */}
        {viewMode === 'print_mode' && !useFallback ? (
          /* PRIMARY: Native docx-preview Container (Exact A4 Pages & Layout) */
          <div
            ref={docContainerRef}
            className="transition-transform duration-150 origin-top flex flex-col items-center shadow-2xl"
            style={{
              transform: zoom !== 100 ? `scale(${zoom / 100})` : 'none',
              transformOrigin: 'top center',
            }}
          />
        ) : (
          /* MATH & MATHTYPE MODE / FALLBACK: Authentic Word Paper View with full KaTeX formulas & diagrams */
          <div
            className="w-full max-w-4xl bg-white text-slate-900 shadow-2xl border border-slate-300 rounded-sm p-8 md:p-14 transition-transform duration-150 origin-top font-serif leading-relaxed"
            style={{
              transform: zoom !== 100 ? `scale(${zoom / 100})` : 'none',
              transformOrigin: 'top center',
              fontSize: `${(zoom / 100) * 16}px`,
              lineHeight: 1.75,
              minHeight: '1100px', // Standard A4 ratio
            }}
          >
            {/* Document Header */}
            <div className="pb-6 mb-8 border-b border-slate-200 font-sans flex items-center justify-between">
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  {lesson.title}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  {lesson.subject} • {lesson.grade} • Giáo viên: {lesson.author || 'Thầy/Cô'}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200 shrink-0 flex items-center gap-1.5 font-sans">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                Toán & MathType (KaTeX)
              </span>
            </div>

            {/* Document Content */}
            {enhancedHtml || lesson.htmlContent ? (
              <div
                className="select-text prose prose-slate max-w-none text-slate-900 prose-p:leading-relaxed prose-table:border-collapse prose-td:border prose-td:border-slate-300 prose-td:p-2.5 prose-th:border prose-th:border-slate-300 prose-th:bg-slate-100 prose-th:p-2.5"
                dangerouslySetInnerHTML={{
                  __html: enhancedHtml || lesson.htmlContent || '',
                }}
              />
            ) : (
              <div className="select-text whitespace-pre-line font-sans text-slate-900 leading-relaxed">
                <MathFormulaRenderer
                  content={cleanDocumentText(lesson.rawText) || 'Không có nội dung văn bản'}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Global Style Injector for docx-preview pages */}
      <style>{`
        /* Clean desk background for Word viewer */
        .docx-wrapper,
        .docx-page-wrapper {
          background: #f1f5f9 !important;
          padding: 24px 16px !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          box-sizing: border-box !important;
          min-width: 100% !important;
        }

        /* Each A4 Page must be pure white paper with dark crisp text, like native Microsoft Word */
        .docx-wrapper > section,
        .docx-page-wrapper > section,
        section.docx,
        section.docx-page,
        article.docx,
        article.docx-page {
          background: #ffffff !important;
          background-color: #ffffff !important;
          color: #0f172a !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12), 0 1px 4px rgba(0, 0, 0, 0.08) !important;
          border: 1px solid #cbd5e1 !important;
          margin: 0 auto 28px auto !important;
          border-radius: 2px !important;
          box-sizing: border-box !important;
          opacity: 1 !important;
          visibility: visible !important;
        }

        .docx-wrapper > section:last-child,
        .docx-page-wrapper > section:last-child {
          margin-bottom: 40px !important;
        }

        /* Word Document Tables */
        .docx-wrapper table,
        .docx-page-wrapper table {
          border-collapse: collapse !important;
          margin: 8px 0 !important;
        }
        .docx-wrapper table td,
        .docx-wrapper table th,
        .docx-page-wrapper table td,
        .docx-page-wrapper table th {
          border: 1px solid #cbd5e1 !important;
          padding: 6px 10px !important;
        }

        /* Word Document Images */
        .docx-wrapper img,
        .docx-page-wrapper img {
          max-width: 100% !important;
          height: auto !important;
          display: inline-block !important;
        }
      `}</style>
    </div>
  );
};
