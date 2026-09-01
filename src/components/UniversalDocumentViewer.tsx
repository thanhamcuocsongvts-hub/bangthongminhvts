import React, { useState, useMemo } from 'react';
import {
  FileText,
  Table,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  Search,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Layers,
  Sparkles,
  Download,
  Copy,
  Check,
  Eye,
  Sliders,
  Printer,
} from 'lucide-react';
import { LessonDoc } from '../types';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { cleanDocumentText } from '../utils/fileParser';
import { PDFCanvasViewer } from './PDFCanvasViewer';

interface UniversalDocumentViewerProps {
  lesson: LessonDoc;
  compact?: boolean; // If in corner or split view
  initialZoom?: number;
  onLaunchSlides?: () => void;
  onLaunchQuiz?: () => void;
}

export const UniversalDocumentViewer: React.FC<UniversalDocumentViewerProps> = ({
  lesson,
  compact = false,
  initialZoom = 100,
  onLaunchSlides,
  onLaunchQuiz,
}) => {
  const [zoom, setZoom] = useState<number>(initialZoom);
  const [rotation, setRotation] = useState<number>(0);
  const [invertColors, setInvertColors] = useState<boolean>(false);
  const [selectedSheet, setSelectedSheet] = useState<string>(() => {
    return lesson.sheetData?.sheetNames?.[0] || 'Sheet1';
  });
  const [tableSearch, setTableSearch] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');

  const fileType = lesson.fileType || 'other';

  // Excel Sheet processing
  const currentSheetRows = useMemo(() => {
    if (!lesson.sheetData?.sheets) {
      // Fallback: parse rawText as lines
      if (fileType === 'xlsx' && lesson.rawText) {
        return lesson.rawText
          .split('\n')
          .filter((line) => line.trim().length > 0)
          .map((line) => line.split(' | '));
      }
      return [];
    }
    const rows = lesson.sheetData.sheets[selectedSheet] || [];
    if (!tableSearch.trim()) return rows;

    const term = tableSearch.toLowerCase();
    return rows.filter((row, idx) => {
      if (idx === 0) return true; // Keep header
      return row.some((cell) => String(cell || '').toLowerCase().includes(term));
    });
  }, [lesson.sheetData, lesson.rawText, selectedSheet, tableSearch, fileType]);

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
          {/* Zoom Controls (Images, PDF, Word, Excel) */}
          <div className="flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded-lg border border-white/10">
            <button
              onClick={() => setZoom((prev) => Math.max(40, prev - 15))}
              className="p-1 rounded hover:bg-white/20 text-slate-300 transition-colors"
              title="Thu nhỏ (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono font-bold text-amber-400 min-w-[36px] text-center text-[11px]">
              {zoom}%
            </span>
            <button
              onClick={() => setZoom((prev) => Math.min(300, prev + 15))}
              className="p-1 rounded hover:bg-white/20 text-slate-300 transition-colors"
              title="Phóng to (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(100)}
              className="px-1.5 py-0.5 rounded text-[10px] text-slate-400 hover:text-white font-bold"
              title="Đặt lại 100%"
            >
              100%
            </button>
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

          {/* Font Size for Word / Text */}
          {(fileType === 'docx' || fileType === 'text' || fileType === 'other') && (
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

          {/* Copy Text */}
          <button
            onClick={handleCopyText}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
            title="Sao chép nội dung văn bản"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
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

      {/* Main Content Area Based On Type */}
      <div className="flex-1 w-full h-full overflow-auto bg-slate-950 relative flex flex-col">
        {/* ========================================================= */}
        {/* 1. EXCEL SPREADSHEET VIEWER (.XLSX, .XLS, .CSV)            */}
        {/* ========================================================= */}
        {fileType === 'xlsx' && (
          <div className="flex-1 flex flex-col w-full h-full overflow-hidden bg-slate-900 text-slate-100">
            {/* Sheet Tabs & Search Bar */}
            <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Sheet selector tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Trang tính:</span>
                {(lesson.sheetData?.sheetNames || ['Sheet1']).map((sName) => (
                  <button
                    key={sName}
                    onClick={() => setSelectedSheet(sName)}
                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all ${
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
        {fileType === 'image' && lesson.fileUrl && (
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
                src={lesson.fileUrl}
                alt={lesson.title}
                className="max-h-[80vh] max-w-full object-contain rounded-xl shadow-2xl border border-white/10"
              />
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. PDF VIEWER (.PDF) - HIGH FIDELITY CANVAS RENDERING      */}
        {/* ========================================================= */}
        {fileType === 'pdf' && lesson.fileUrl && (
          <PDFCanvasViewer
            fileUrl={lesson.fileUrl}
            title={lesson.title}
            zoom={zoom}
            rotation={rotation}
            compact={compact}
          />
        )}

        {/* ========================================================= */}
        {/* 4. WORD DOCUMENT VIEWER (.DOCX, .DOC)                     */}
        {/* ========================================================= */}
        {fileType === 'docx' && (
          <div className="flex-1 w-full h-full overflow-y-auto p-3 md:p-6 flex justify-center bg-slate-950/80">
            <div
              className={`w-full max-w-4xl bg-white text-slate-900 rounded-2xl p-6 md:p-10 shadow-2xl border border-slate-300 font-serif leading-relaxed ${fontSizeClasses[fontSize]} transition-all`}
            >
              {/* Document Header Bar */}
              <div className="pb-6 mb-6 border-b border-slate-300 font-sans not-italic flex items-center justify-between">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900">{lesson.title}</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {lesson.subject} • {lesson.grade} • Giáo viên: {lesson.author}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                  Microsoft Word (.docx)
                </span>
              </div>

              {/* Render HTML or Cleaned Text */}
              {lesson.htmlContent ? (
                <div
                  className="prose prose-slate max-w-none prose-headings:font-sans prose-headings:font-black prose-p:leading-relaxed prose-table:border-collapse prose-td:border prose-td:p-2 prose-th:border prose-th:bg-slate-100 prose-th:p-2 select-text"
                  style={{
                    fontSize: `${(zoom / 100) * 15}px`,
                    lineHeight: 1.7,
                  }}
                  dangerouslySetInnerHTML={{
                    __html: lesson.htmlContent.replace(
                      /<img([^>]*?)src=["']data:image\/(wmf|x-wmf)[^"']*["']([^>]*?)>/gi,
                      ''
                    ),
                  }}
                />
              ) : (
                <div
                  className="whitespace-pre-line space-y-3 font-sans"
                  style={{ fontSize: `${(zoom / 100) * 15}px` }}
                >
                  <MathFormulaRenderer content={cleanDocumentText(lesson.rawText) || 'Không có nội dung văn bản'} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 5. POWERPOINT PRESENTATION VIEWER (.PPTX, .PPT)           */}
        {/* ========================================================= */}
        {fileType === 'pptx' && (
          <div className="flex-1 w-full h-full overflow-y-auto p-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-8 rounded-3xl bg-slate-900 border border-indigo-500/40 shadow-2xl max-w-lg w-full space-y-4">
              <Layers className="w-14 h-14 mx-auto text-indigo-400 animate-pulse" />
              <div>
                <h3 className="text-lg font-black text-white">{lesson.title}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Định dạng: Microsoft PowerPoint Presentation (.pptx)
                </p>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/10 text-left">
                {cleanDocumentText(lesson.rawText) ||
                  'Tệp trình chiếu PowerPoint đã được nạp thành công. Thầy/Cô có thể tạo bộ slide tương tác hoặc trình chiếu trực tiếp trên SmartBoard 75 Pro.'}
              </p>
              {onLaunchSlides && (
                <button
                  onClick={onLaunchSlides}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <Layers className="w-4 h-4" />
                  <span>Trình Chiếu Slide Bài Giảng</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 6. PLAIN TEXT / CODE / OTHER FALLBACK                     */}
        {/* ========================================================= */}
        {(fileType === 'text' || fileType === 'other') && (
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
                {cleanDocumentText(lesson.rawText) || (
                  <div className="p-8 text-center text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Chưa có nội dung văn bản cho tài liệu này.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
