import React, { useState, useMemo, useRef } from 'react';
import { 
  X, ZoomIn, ZoomOut, Search, Info,
  FileText, ChevronRight, Download, MonitorPlay,
  Share2, Maximize, FileSpreadsheet, RotateCw, Layers, Pen, Check, Copy, ExternalLink, Table,
  FolderOpen, ChevronDown, Upload, FileUp, Sparkles, BookOpen, AlertCircle, Loader2
} from 'lucide-react';
import { LessonDoc } from '../types';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { cleanDocumentText, parseUploadedFileToLesson } from '../utils/fileParser';
import { PDFCanvasViewer } from './PDFCanvasViewer';
import { PPTXViewer } from './PPTXViewer';
import { DocxViewer } from './DocxViewer';
import { TouchWhiteboard } from './TouchWhiteboard';
import { exportOriginalLessonFile } from '../utils/exportUtils';
import { fetchFileFromCloudStore } from '../utils/storageUtils';

interface UniversalDocumentViewerProps {
  lesson: LessonDoc;
  compact?: boolean; // If in corner or split view
  initialZoom?: number;
  onLaunchSlides?: () => void;
  onLaunchQuiz?: () => void;
  isAnnotating?: boolean;
  onToggleAnnotating?: () => void;
  onFullscreenRequest?: () => void;
  onOpenFile?: () => void;
  onOpenTemporaryLesson?: (lesson: LessonDoc) => void;
}

export const UniversalDocumentViewer: React.FC<UniversalDocumentViewerProps> = ({
  lesson,
  compact = false,
  initialZoom = 100,
  onLaunchSlides,
  onLaunchQuiz,
  isAnnotating: propIsAnnotating,
  onToggleAnnotating,
  onFullscreenRequest,
  onOpenFile,
  onOpenTemporaryLesson,
}) => {
  const fileType = lesson.fileType || 'other';
  const ext = (lesson.fileName || '').split('.').pop()?.toLowerCase() || '';
  const isDocx = fileType === 'docx' || ext === 'docx' || ext === 'doc';
  const isPptx = fileType === 'pptx' || ext === 'pptx' || ext === 'ppt';
  const isExcel = fileType === 'xlsx' || ext === 'xlsx' || ext === 'xls' || ext === 'csv';
  const isPdf = fileType === 'pdf' || ext === 'pdf';
  const isImage = fileType === 'image' || ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'svg'].includes(ext);

  const [zoom, setZoom] = useState<number>(initialZoom);
  const [showZoomMenu, setShowZoomMenu] = useState<boolean>(false);
  const [isPinching, setIsPinching] = useState<boolean>(false);
  const [rotation, setRotation] = useState<number>(0);
  const [invertColors, setInvertColors] = useState<boolean>(false);
  const [isParsingFile, setIsParsingFile] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const internalFileInputRef = useRef<HTMLInputElement>(null);
  const [activeFileUrl, setActiveFileUrl] = useState<string>(
    lesson.fileUrl || (lesson as any).localBlobUrl || ''
  );

  const handleQuickUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsParsingFile(true);
      const newLesson = await parseUploadedFileToLesson(file);
      if (onOpenTemporaryLesson) {
        onOpenTemporaryLesson(newLesson);
      } else if (onOpenFile) {
        onOpenFile();
      }
    } catch (err: any) {
      alert('Không thể mở tệp: ' + (err.message || 'Kiểm tra lại định dạng tệp'));
    } finally {
      setIsParsingFile(false);
      if (internalFileInputRef.current) internalFileInputRef.current.value = '';
    }
  };

  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    try {
      setIsParsingFile(true);
      const newLesson = await parseUploadedFileToLesson(file);
      if (onOpenTemporaryLesson) {
        onOpenTemporaryLesson(newLesson);
      } else if (onOpenFile) {
        onOpenFile();
      }
    } catch (err: any) {
      alert('Không thể mở tệp: ' + (err.message || 'Kiểm tra lại định dạng tệp'));
    } finally {
      setIsParsingFile(false);
    }
  };

  // Synchronize and verify file accessibility, falling back to local IndexedDB/Firestore
  React.useEffect(() => {
    let isMounted = true;
    const initial = lesson.fileUrl || (lesson as any).localBlobUrl || '';
    if (initial && !initial.startsWith('firestore://')) {
      setActiveFileUrl(initial);
    }

    async function ensureAccessibleFile() {
      // If no file URL or it's a server URL that might not be on disk yet, or firestore:// scheme, check IndexedDB
      if (!initial || initial.startsWith('/uploads/') || initial.startsWith('firestore://')) {
        try {
          const cloudData = await fetchFileFromCloudStore(lesson.id);
          if (cloudData?.blob && isMounted) {
            const blobUrl = URL.createObjectURL(cloudData.blob);
            setActiveFileUrl(blobUrl);
          }
        } catch (_) {}
      }
    }
    ensureAccessibleFile();

    return () => {
      isMounted = false;
    };
  }, [lesson.id, lesson.fileUrl, (lesson as any).localBlobUrl]);

  const [dynamicSheetData, setDynamicSheetData] = useState<{
    sheetNames: string[];
    sheets: Record<string, any[][]>;
  } | null>(lesson.sheetData || null);

  const [selectedSheet, setSelectedSheet] = useState<string>(() => {
    return lesson.sheetData?.sheetNames?.[0] || 'Sheet1';
  });

  // If Excel and missing sheetData (e.g. from localStorage restoration), dynamically parse with XLSX
  React.useEffect(() => {
    if (isExcel && (!dynamicSheetData || !dynamicSheetData.sheets)) {
      let cancelled = false;
      async function parseExcelBuffer() {
        try {
          let buf: ArrayBuffer | null = null;
          const url = activeFileUrl || lesson.fileUrl || (lesson as any).localBlobUrl;
          if (url && !url.startsWith('firestore://')) {
            try {
              const res = await fetch(url);
              if (res.ok) buf = await res.arrayBuffer();
            } catch (_) {}
          }
          if (!buf && lesson.id) {
            const fileData = await fetchFileFromCloudStore(lesson.id);
            if (fileData?.blob) {
              buf = await fileData.blob.arrayBuffer();
            }
          }
          if (buf && !cancelled) {
            const XLSX = await import('xlsx');
            const wb = XLSX.read(buf, { type: 'array' });
            const sNames = wb.SheetNames || ['Sheet1'];
            const sObj: Record<string, any[][]> = {};
            sNames.forEach((sn) => {
              const ws = wb.Sheets[sn];
              if (ws) {
                sObj[sn] = XLSX.utils.sheet_to_json(ws, { header: 1 });
              }
            });
            setDynamicSheetData({ sheetNames: sNames, sheets: sObj });
            if (sNames.length > 0) {
              setSelectedSheet(sNames[0]);
            }
          }
        } catch (xErr) {
          console.warn('Dynamic Excel parse notice:', xErr);
        }
      }
      parseExcelBuffer();
      return () => { cancelled = true; };
    }
  }, [isExcel, activeFileUrl, lesson.fileUrl, lesson.id, dynamicSheetData]);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
  const [internalAnnotating, setInternalAnnotating] = useState<boolean>(false);

  const effectiveAnnotating = propIsAnnotating !== undefined ? propIsAnnotating : internalAnnotating;
  const toggleAnnotating = onToggleAnnotating || (() => setInternalAnnotating((prev) => !prev));

  // Touch Pinch-to-Zoom tracking
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

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 10 : -10;
      setZoom((prev) => Math.min(300, Math.max(40, prev + delta)));
    }
  };

  // Excel Sheet processing
  const currentSheetRows = useMemo(() => {
    const sheetSource = dynamicSheetData || lesson.sheetData;
    if (!sheetSource?.sheets) {
      // Fallback: parse rawText as lines
      if (isExcel && lesson.rawText) {
        return lesson.rawText
          .split('\n')
          .filter((line) => line.trim().length > 0)
          .map((line) => line.split(' | '));
      }
      return [];
    }
    const rows = sheetSource.sheets[selectedSheet] || [];
    if (!tableSearch.trim()) return rows;

    const term = tableSearch?.toLowerCase();
    return rows.filter((row, idx) => {
      if (idx === 0) return true; // Keep header
      return row.some((cell) => String(cell || '').toLowerCase().includes(term));
    });
  }, [dynamicSheetData, lesson.sheetData, lesson.rawText, selectedSheet, tableSearch, isExcel]);

  const handleCopyText = () => {
    navigator.clipboard.writeText(lesson.rawText || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Font size classes for Word & Text
  const fontSizeClasses = {
    sm: 'text-xs md:text-sm',
    md: 'text-sm md:text-base',
    lg: 'text-base md:text-lg',
    xl: 'text-lg md:text-xl',
  };

  // 1. High-fidelity Microsoft Word (.docx, .doc) native paper viewer
  if (isDocx) {
    return (
      <DocxViewer
        fileUrl={activeFileUrl || lesson.fileUrl || (lesson as any).localBlobUrl}
        lesson={lesson}
        title={lesson.title}
        isAnnotating={effectiveAnnotating}
        onToggleAnnotating={toggleAnnotating}
        onFullscreenRequest={onFullscreenRequest}
        onLaunchQuiz={onLaunchQuiz}
        onOpenFile={onOpenFile}
      />
    );
  }

  // 2. High-fidelity Microsoft PowerPoint (.pptx, .ppt) presentation viewer
  if (isPptx) {
    return (
      <PPTXViewer
        url={activeFileUrl || lesson.fileUrl || (lesson as any).localBlobUrl}
        lesson={lesson}
        title={lesson.title}
        onFullscreen={onFullscreenRequest}
        onOpenFile={onOpenFile}
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 text-slate-100 rounded-2xl overflow-hidden border border-slate-700/60 shadow-inner relative select-text">
      {/* Universal Document Toolbar */}
      <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs select-none">
        {/* Left: Document Info & Type Badge */}
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="px-2 py-0.5 rounded-md bg-indigo-900/80 text-indigo-300 font-mono font-bold uppercase tracking-wider text-[10px] border border-indigo-500/30 shrink-0">
            {fileType.toUpperCase()}
          </span>
          <span className="font-bold text-slate-200 truncate max-w-[200px] md:max-w-xs" title={lesson.title}>
            {lesson.title}
          </span>
        </div>

        {/* Center/Right: Controls for Specific Types */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Mở File Khác button */}
          {onOpenFile && (
            <button
              onClick={onOpenFile}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1 text-[11px] shadow-sm transition-all cursor-pointer"
              title="Mở tài liệu khác từ Máy tính / USB hoặc Kho bài giảng"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Mở File Khác</span>
            </button>
          )}

          {/* Zoom Controls (Images, PDF, Word, Excel) */}
          <div className="relative flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded-lg border border-white/10">
            <button
              onClick={() => setZoom((prev) => Math.max(40, prev - 15))}
              className="p-1 rounded hover:bg-white/20 text-slate-300 transition-colors cursor-pointer"
              title="Thu nhỏ (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setShowZoomMenu((prev) => !prev)}
              className="font-mono font-bold text-amber-400 min-w-[45px] text-center text-[11px] hover:bg-white/10 px-1 py-0.5 rounded transition-colors flex items-center justify-center gap-0.5 cursor-pointer"
              title="Chọn tỷ lệ thu phóng theo phần trăm"
            >
              <span>{zoom}%</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            <button
              onClick={() => setZoom((prev) => Math.min(300, prev + 15))}
              className="p-1 rounded hover:bg-white/20 text-slate-300 transition-colors cursor-pointer"
              title="Phóng to (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setZoom(100)}
              className="px-1.5 py-0.5 rounded text-[10px] text-slate-400 hover:text-white font-bold cursor-pointer"
              title="Đặt lại 100%"
            >
              100%
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

          {/* Rotate (Image & PDF) */}
          {(fileType === 'image' || fileType === 'pdf') && (
            <button
              onClick={handleRotate}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
              title="Xoay 90 độ"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Invert contrast for Images (High contrast blackboard mode) */}
          {fileType === 'image' && (
            <button
              onClick={() => setInvertColors((prev) => !prev)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                invertColors
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-white/10 hover:bg-white/20 text-slate-300'
              }`}
              title="Đảo màu tương phản cao (phù hợp giảng dạy bảng đen)"
            >
              Đảo Màu
            </button>
          )}

          {/* Font Size for Text */}
          {(fileType === 'text' || fileType === 'other') && (
            <div className="flex items-center gap-0.5 bg-white/10 p-0.5 rounded-lg">
              {(['sm', 'md', 'lg', 'xl'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFontSize(s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    fontSize === s ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {/* Annotation Drawing Overlay Button for Presentations/Documents */}
          <button
            onClick={toggleAnnotating}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              effectiveAnnotating
                ? 'bg-amber-500 text-white ring-2 ring-amber-300 shadow-md animate-pulse'
                : 'bg-white/10 hover:bg-white/20 text-amber-300'
            }`}
            title={
              effectiveAnnotating
                ? 'Đang bật thanh công cụ vẽ lên bài giảng (nhấn để tắt)'
                : 'Bật thanh công cụ: Viết, vẽ, dạ quang, thước kẻ, tẩy xóa trực tiếp lên tài liệu'
            }
          >
            <Pen className="w-3.5 h-3.5" />
            <span>{effectiveAnnotating ? 'Đang Vẽ Chú Thích' : 'Bút Vẽ Lên File'}</span>
          </button>

          {/* Copy Text */}
          <button
            onClick={handleCopyText}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
            title="Sao chép nội dung văn bản"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Download Original File */}
          <button
            onClick={() => exportOriginalLessonFile(lesson)}
            className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 font-bold flex items-center gap-1 text-[11px] transition-all cursor-pointer"
            title={`Tải về máy tệp gốc: ${lesson.fileName || lesson.title}`}
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Tải Tệp Gốc</span>
          </button>

          {/* External Window Link */}
          {lesson.fileUrl && (
            <a
              href={lesson.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1 text-[11px] shadow-sm transition-all"
              title="Mở trong tab trình duyệt mới"
            >
              <ExternalLink className="w-3 h-3" />
              <span className="hidden sm:inline">Cửa Sổ Riêng</span>
            </a>
          )}
        </div>
      </div>

      {/* Main Content Area Based On Type with Smooth Touch Pinch-to-Zoom */}
      <div
        className="flex-1 w-full h-full overflow-auto bg-slate-950 relative flex flex-col custom-scrollbar scroll-smooth overscroll-contain touch-pan-y"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            (e.currentTarget as any)._pinchStartDist = Math.hypot(
              touch1.clientX - touch2.clientX,
              touch1.clientY - touch2.clientY
            );
            (e.currentTarget as any)._pinchStartZoom = zoom;
            setIsPinching(true);
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && (e.currentTarget as any)._pinchStartDist) {
            e.preventDefault();
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
            const startDist = (e.currentTarget as any)._pinchStartDist;
            const startZoom = (e.currentTarget as any)._pinchStartZoom || 100;
            if (startDist > 10) {
              const scale = dist / startDist;
              setZoom(Math.round(Math.min(300, Math.max(40, startZoom * scale))));
            }
          }
        }}
        onTouchEnd={(e) => {
          if (e.touches.length < 2) {
            delete (e.currentTarget as any)._pinchStartDist;
            delete (e.currentTarget as any)._pinchStartZoom;
            setIsPinching(false);
          }
        }}
        onWheel={(e) => {
          if (e.ctrlKey) {
            e.preventDefault();
            const delta = -e.deltaY * 0.5;
            setZoom((z) => Math.min(300, Math.max(40, Math.round(z + delta))));
          }
        }}
      >
        {/* Floating Pinch-To-Zoom Badge Indicator */}
        {isPinching && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white border border-slate-700 px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2 text-sm font-bold animate-pulse pointer-events-none">
            <span className="text-amber-400">🔍 Phóng to/Thu nhỏ 2 ngón tay:</span>
            <span className="font-mono text-base text-cyan-300">{zoom}%</span>
          </div>
        )}
        {/* Interactive Annotation Drawing Layer with Full Toolbar, Fluorescent Colors & Shapes */}
        {effectiveAnnotating && fileType !== 'pdf' && (
          <div className="absolute inset-0 z-40 pointer-events-none">
            <TouchWhiteboard
              id={`doc-whiteboard-${lesson.id}`}
              isOverlay={true}
              onCloseOverlay={toggleAnnotating}
            />
          </div>
        )}
        {/* ========================================================= */}
        {/* 1. EXCEL SPREADSHEET VIEWER (.XLSX, .XLS, .CSV)            */}
        {/* ========================================================= */}
        {isExcel && (
          <div className="flex-1 flex flex-col w-full h-full overflow-hidden bg-slate-900 text-slate-100">
            {/* Sheet Tabs & Search Bar */}
            <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Sheet selector tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Trang tính:</span>
                {(dynamicSheetData?.sheetNames || lesson.sheetData?.sheetNames || ['Sheet1']).map((sName) => (
                  <button
                    key={sName}
                    onClick={() => setSelectedSheet(sName)}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      selectedSheet === sName
                        ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                        : 'bg-white/10 hover:bg-white/20 text-slate-300'
                    }`}
                  >
                    {sName}
                  </button>
                ))}
              </div>

              {/* Search within sheet */}
              <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Lọc hàng / Tìm kiếm trong bảng..."
                  className="bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none w-36 md:w-56"
                />
                {tableSearch && (
                  <button
                    onClick={() => setTableSearch('')}
                    className="text-slate-400 hover:text-white text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Grid Table */}
            <div
              className="flex-1 overflow-auto p-3"
              style={{ fontSize: `${(zoom / 100) * 14}px` }}
            >
              {currentSheetRows.length > 0 ? (
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden border border-slate-700 rounded-xl shadow-xl bg-slate-900">
                    <table className="min-w-full divide-y divide-slate-700 border-collapse">
                      {/* Header Row */}
                      <thead>
                        <tr className="bg-slate-800/90 text-slate-200">
                          <th className="px-3 py-2.5 text-left text-xs font-mono font-bold text-slate-400 border-r border-slate-700 w-12 bg-slate-850">
                            #
                          </th>
                          {Array.isArray(currentSheetRows[0]) &&
                            currentSheetRows[0].map((cell: any, cIdx: number) => (
                              <th
                                key={cIdx}
                                className="px-4 py-2.5 text-left font-black tracking-wider text-emerald-400 border-r border-slate-700 whitespace-nowrap bg-slate-800"
                              >
                                {cell !== undefined && cell !== null ? String(cell) : `Cột ${cIdx + 1}`}
                              </th>
                            ))}
                        </tr>
                      </thead>

                      {/* Body Rows */}
                      <tbody className="divide-y divide-slate-800 bg-slate-900/60 font-medium">
                        {currentSheetRows.slice(1).map((row: any[], rIdx: number) => (
                          <tr
                            key={rIdx}
                            className={`hover:bg-indigo-950/40 transition-colors ${
                              rIdx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-850/50'
                            }`}
                          >
                            <td className="px-3 py-2 font-mono text-xs text-slate-400 border-r border-slate-800 bg-slate-950/40 text-center font-bold">
                              {rIdx + 1}
                            </td>
                            {Array.isArray(row) &&
                              row.map((cell: any, cIdx: number) => (
                                <td
                                  key={cIdx}
                                  className="px-4 py-2 border-r border-slate-800/80 text-slate-200 whitespace-pre-wrap leading-normal"
                                >
                                  {cell !== undefined && cell !== null ? String(cell) : ''}
                                </td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="py-2 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>
                      Tổng cộng: <b>{currentSheetRows.length - 1}</b> hàng dữ liệu trong {selectedSheet}
                    </span>
                    {tableSearch && (
                      <span className="text-amber-400">Đang lọc theo: "{tableSearch}"</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 space-y-2">
                  <Table className="w-10 h-10 mx-auto text-emerald-400 opacity-60" />
                  <p className="font-bold">Bảng tính trống hoặc không tìm thấy dữ liệu phù hợp</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. IMAGE VIEWER (JPG, PNG, WEBP, SVG)                     */}
        {/* ========================================================= */}
        {isImage && (activeFileUrl || lesson.fileUrl || (lesson as any).localBlobUrl) && (
          <div className="flex-1 w-full h-full flex items-center justify-center p-4 overflow-auto">
            <div
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center',
                filter: invertColors ? 'invert(1) hue-rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease-out',
              }}
              className="max-w-full max-h-full flex items-center justify-center"
            >
              <img
                src={activeFileUrl || lesson.fileUrl || (lesson as any).localBlobUrl}
                alt={lesson.title}
                onError={async (e) => {
                  try {
                    const cloudData = await fetchFileFromCloudStore(lesson.id);
                    if (cloudData?.blob) {
                      const bUrl = URL.createObjectURL(cloudData.blob);
                      setActiveFileUrl(bUrl);
                      (e.currentTarget as HTMLImageElement).src = bUrl;
                    }
                  } catch (_) {}
                }}
                className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl border border-white/10"
              />
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. PDF VIEWER (.PDF) - HIGH FIDELITY CANVAS RENDERING      */}
        {/* ========================================================= */}
        {isPdf && (activeFileUrl || lesson.fileUrl || (lesson as any).localBlobUrl) && (
          <PDFCanvasViewer
            fileUrl={activeFileUrl || lesson.fileUrl || (lesson as any).localBlobUrl}
            title={lesson.title}
            lessonId={lesson.id}
            zoom={zoom}
            rotation={rotation}
            compact={compact}
            isAnnotating={effectiveAnnotating}
            onToggleAnnotating={toggleAnnotating}
            onFullscreenRequest={onFullscreenRequest}
            onOpenFile={onOpenFile}
          />
        )}

        {/* ========================================================= */}
        {/* 4. PLAIN TEXT / CODE / OTHER FALLBACK (WHEN HAS TEXT)      */}
        {/* ========================================================= */}
        {!isExcel && !isPdf && !isImage && cleanDocumentText(lesson.rawText) && lesson.id !== 'empty_lesson' && (
          <div className="flex-1 w-full h-full overflow-y-auto p-4 md:p-8 flex justify-center bg-slate-950">
            <div
              className={`w-full max-w-4xl bg-slate-900 text-slate-200 rounded-2xl p-6 md:p-8 shadow-2xl border border-slate-800 font-mono leading-relaxed ${fontSizeClasses[fontSize]}`}
            >
              <div className="pb-4 mb-4 border-b border-slate-800 flex items-center justify-between font-sans">
                <span className="text-xs font-bold text-slate-400 uppercase">
                  Văn Bản Tài Liệu: {lesson.title}
                </span>
                <span className="text-xs text-slate-500">{lesson.fileSize || 'Text'}</span>
              </div>
              <div className="whitespace-pre-line font-sans text-slate-300">
                <MathFormulaRenderer content={cleanDocumentText(lesson.rawText)} />
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. TRUNG TÂM MỞ & ĐỌC TÀI LIỆU (PDF, WORD, EXCEL, POWERPOINT, ẢNH)        */}
        {/* ========================================================================= */}
        {(!(activeFileUrl || lesson.fileUrl || (lesson as any).localBlobUrl) || lesson.id === 'empty_lesson' || (!isExcel && !isPdf && !isImage && !cleanDocumentText(lesson.rawText))) && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragOver(false);
            }}
            onDrop={handleFileDrop}
            className={`flex-1 w-full h-full flex flex-col items-center justify-center p-6 md:p-12 text-center transition-all ${
              isDragOver ? 'bg-blue-950/60 ring-4 ring-blue-500 ring-inset' : 'bg-slate-950/90'
            }`}
          >
            <input
              ref={internalFileInputRef}
              type="file"
              accept=".docx,.doc,.pdf,.pptx,.ppt,.xlsx,.xls,.csv,image/*"
              onChange={handleQuickUpload}
              className="hidden"
            />

            <div className="max-w-2xl w-full bg-slate-900 border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-3xl p-8 shadow-2xl transition-all space-y-6">
              {/* Header Icon */}
              <div className="flex items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-inner">
                  {isParsingFile ? (
                    <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                  ) : (
                    <FolderOpen className="w-8 h-8 text-blue-400" />
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xl md:text-2xl font-black text-white">
                  {isParsingFile ? 'Đang đọc và nạp tài liệu...' : 'Trung Tâm Đọc Tài Liệu Giảng Dạy'}
                </h3>
                <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto">
                  Hỗ trợ 100% định dạng giáo án và bài giảng: <b>PDF, Word (.docx/.doc), Excel (.xlsx), PowerPoint (.pptx/.ppt), Hình ảnh</b>
                </p>
              </div>

              {/* Main Action Button */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isParsingFile}
                  onClick={() => internalFileInputRef.current?.click()}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-blue-600/25 active:scale-95 transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Chọn Tệp Từ Máy Tính / USB</span>
                </button>

                {onOpenFile && (
                  <button
                    type="button"
                    onClick={onOpenFile}
                    className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 border border-slate-700 cursor-pointer transition-all"
                  >
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    <span>Mở Kho Bài Giảng Có Sẵn</span>
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-500 font-medium">
                💡 Hoặc kéo & thả trực tiếp bất kỳ tệp tài liệu nào vào khung này để đọc ngay
              </div>

              {/* Supported Format Grid Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-4 border-t border-slate-800/80 text-left">
                {/* 1. PDF */}
                <div
                  onClick={() => internalFileInputRef.current?.click()}
                  className="p-3 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-red-500/50 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs mb-2 group-hover:scale-110 transition-transform">
                    PDF
                  </div>
                  <div className="text-xs font-bold text-slate-200">Tệp PDF</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Lật trang, cuộn mượt, AI đọc</div>
                </div>

                {/* 2. Word */}
                <div
                  onClick={() => internalFileInputRef.current?.click()}
                  className="p-3 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/50 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs mb-2 group-hover:scale-110 transition-transform">
                    DOC
                  </div>
                  <div className="text-xs font-bold text-slate-200">Tệp Word</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">A4 chuẩn, MathType, KaTeX</div>
                </div>

                {/* 3. Excel */}
                <div
                  onClick={() => internalFileInputRef.current?.click()}
                  className="p-3 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs mb-2 group-hover:scale-110 transition-transform">
                    XLS
                  </div>
                  <div className="text-xs font-bold text-slate-200">Tệp Excel</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Mọi Sheet, lọc tìm kiếm</div>
                </div>

                {/* 4. PowerPoint */}
                <div
                  onClick={() => internalFileInputRef.current?.click()}
                  className="p-3 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-orange-500/50 transition-all cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-xs mb-2 group-hover:scale-110 transition-transform">
                    PPT
                  </div>
                  <div className="text-xs font-bold text-slate-200">PowerPoint</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Chiếu 4K, hiệu ứng, bút vẽ</div>
                </div>

                {/* 5. Images */}
                <div
                  onClick={() => internalFileInputRef.current?.click()}
                  className="p-3 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 transition-all cursor-pointer group col-span-2 sm:col-span-1"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs mb-2 group-hover:scale-110 transition-transform">
                    IMG
                  </div>
                  <div className="text-xs font-bold text-slate-200">Hình Ảnh</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Phóng 300%, xoay, đảo màu</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
