import React, { useState, useRef, useEffect } from 'react';
import { PPTXViewer } from './PPTXViewer';
import { TeacherFileManager } from './TeacherFileManager';
import {
  MonitorPlay,
  UploadCloud,
  FileUp,
  FolderOpen,
  Sparkles,
  PlayCircle,
  HelpCircle,
  ChevronRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  BookOpen,
  BookmarkPlus,
  Check,
} from 'lucide-react';
import { LessonDoc, TeacherProfile } from '../types';
import { parseUploadedFileToLesson } from '../utils/fileParser';

interface PPTPresentationModeProps {
  onSelectLesson: (lesson: LessonDoc) => void;
  onOpenTemporaryLesson?: (lesson: LessonDoc) => void;
  onSaveToLibrary?: (lesson: LessonDoc) => void;
  isSavedInLibrary?: boolean;
  activeLesson?: LessonDoc;
  activeLessonUrl?: string;
  activeLessonTitle?: string;
  activeTeacher?: TeacherProfile | null;
  onSwitchToReader?: () => void;
}

export const PPTPresentationMode: React.FC<PPTPresentationModeProps> = ({
  onSelectLesson,
  onOpenTemporaryLesson,
  onSaveToLibrary,
  isSavedInLibrary = false,
  activeLesson,
  activeLessonUrl,
  activeLessonTitle,
  activeTeacher,
  onSwitchToReader,
}) => {
  const [showFileManager, setShowFileManager] = useState<boolean>(!activeLessonUrl && !activeLesson);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveLesson = activeLesson;
  const effectiveUrl = activeLessonUrl || activeLesson?.fileUrl;
  const effectiveTitle = activeLessonTitle || activeLesson?.title || 'Bài thuyết trình PowerPoint';

  useEffect(() => {
    if (activeLesson) {
      setShowFileManager(false);
    }
  }, [activeLesson?.id]);

  const fileNameLower = (effectiveLesson?.fileName || effectiveLesson?.title || '').toLowerCase();
  const isWordOrPdfOrExcel =
    fileNameLower.endsWith('.docx') ||
    fileNameLower.endsWith('.doc') ||
    fileNameLower.endsWith('.pdf') ||
    fileNameLower.endsWith('.xlsx') ||
    fileNameLower.endsWith('.xls') ||
    effectiveLesson?.fileType === 'docx' ||
    effectiveLesson?.fileType === 'pdf' ||
    effectiveLesson?.fileType === 'xlsx';

  const isPPT = Boolean(
    !isWordOrPdfOrExcel &&
      effectiveLesson &&
      (effectiveLesson.fileType === 'pptx' ||
        effectiveLesson.fileType === 'ppt' ||
        fileNameLower.endsWith('.pptx') ||
        fileNameLower.endsWith('.ppt') ||
        (effectiveLesson.slides && effectiveLesson.slides.length > 0))
  );

  // Direct file upload handler - does NOT auto-save to Kho Bài Giảng
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const newDoc = await parseUploadedFileToLesson(
        file,
        activeTeacher?.name || 'Giáo viên',
        activeTeacher?.id
      );
      if (onOpenTemporaryLesson) {
        onOpenTemporaryLesson(newDoc);
      } else {
        onSelectLesson(newDoc);
      }
      setShowFileManager(false);
    } catch (err: any) {
      console.error('Upload PPT error:', err);
      setUploadError(err.message || 'Lỗi khi đọc tệp PowerPoint.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Launch sample PowerPoint presentation
  const launchSamplePresentation = () => {
    const sampleDoc: LessonDoc = {
      id: 'sample_ppt_' + Date.now(),
      title: 'Bài Giảng Mẫu: Chuyển Động Cơ Học (Vật Lý 10)',
      subject: 'Vật lý',
      grade: 'Lớp 10',
      lastModified: new Date().toISOString(),
      author: 'Tổ Vật Lý',
      fileType: 'pptx',
      fileName: 'Chuyen_Dong_Co_Hoc_Vat_Ly_10.pptx',
      fileSize: '2.4 MB',
      syncedToCloud: true,
      rawText: 'Bài giảng mẫu tương tác trên Tivi 75 inch chuyên nghiệp.',
      quizzes: [],
      slides: [
        {
          id: 'slide_sample_1',
          title: 'CHUYỂN ĐỘNG CƠ HỌC & HỆ QUY CHIẾU',
          subtitle: 'Chương 1: Động Học Chất Điểm - Vật Lý 10',
          content:
            '• Khái niệm chuyển động: Sự thay đổi vị trí của vật theo thời gian so với vật mốc.\n• Chất điểm: Vật có kích thước rất nhỏ so với quãng đường đi được.\n• Quỹ đạo: Đường nối những vị trí liên tiếp của chất điểm khi chuyển động.',
          formula: 's = v \\cdot t',
        },
        {
          id: 'slide_sample_2',
          title: 'VẬN TỐC & PHƯƠNG TRÌNH CHUYỂN ĐỘNG THẲNG ĐỀU',
          subtitle: 'Quy luật động học cơ bản',
          content:
            '• Vận tốc trung bình: v = Δx / Δt\n• Chuyển động thẳng đều: Vận tốc không đổi theo thời gian.\n• Phương trình tọa độ: x = x₀ + v(t - t₀)\n• Đồ thị tọa độ - thời gian: Đường thẳng xiên góc đi qua (0, x₀).',
          formula: 'x = x_0 + v \\cdot t',
        },
        {
          id: 'slide_sample_3',
          title: 'CHUYỂN ĐỘNG THẲNG BIẾN ĐỔI ĐỀU',
          subtitle: 'Gia tốc và công thức liên hệ độc lập thời gian',
          content:
            '• Gia tốc a: Đại lượng đặc trưng cho sự biến thiên vận tốc theo thời gian.\n• Vận tốc tức thời: v = v₀ + at\n• Quãng đường đi được: s = v₀t + ½at²\n• Công thức độc lập với thời gian: v² - v₀² = 2as.',
          formula: 'v^2 - v_0^2 = 2as',
        },
        {
          id: 'slide_sample_4',
          title: 'CÂU HỎI THẢO LUẬN & THỰC HÀNH',
          subtitle: 'Vận dụng kiến thức vào thực tiễn',
          content:
            '• Câu hỏi 1: Một ô tô đang chuyển động với vận tốc 72 km/h thì hãm phanh chuyển động chậm dần đều với gia tốc 2 m/s².\n• Yêu cầu: Tính quãng đường ô tô đi được đến khi dừng hẳn?\n• Hướng dẫn: Đổi đơn vị v₀ = 20 m/s; áp dụng công thức v² - v₀² = 2as với v = 0.',
          formula: 's = \\frac{0 - 20^2}{2 \\cdot (-2)} = 100\\text{ m}',
        },
      ],
    };
    onSelectLesson(sampleDoc);
    setShowFileManager(false);
  };

  return (
    <div className="w-full h-full bg-slate-950 flex flex-col relative overflow-hidden rounded-2xl border border-slate-800 shadow-2xl">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file);
        }}
        className="hidden"
      />

      {!isPPT || showFileManager ? (
        <div className="w-full h-full overflow-y-auto p-4 md:p-8 flex flex-col items-center justify-center custom-scrollbar">
          <div className="max-w-4xl w-full space-y-6">
            {/* Header Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-orange-600/20 border border-orange-500/40 text-orange-500">
                    <MonitorPlay className="w-7 h-7" />
                  </div>
                  <span>Trình Chiếu PowerPoint Chuyên Nghiệp</span>
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Trình chiếu trực tiếp file <b>.pptx</b> và <b>.ppt</b> với hoạt ảnh mượt mà, bút vẽ tương tác và chế độ
                  toàn màn hình chuẩn Tivi 75 inch.
                </p>
              </div>

              {isPPT && (
                <button
                  onClick={() => setShowFileManager(false)}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer shrink-0"
                >
                  Quay lại bài đang chiếu
                </button>
              )}
            </div>

            {/* Informative banner when current file is Word/PDF/Excel */}
            {isWordOrPdfOrExcel && effectiveLesson && (
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-blue-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm">
                      Tệp đang chọn là {effectiveLesson.fileType === 'docx' ? 'Word (.docx)' : effectiveLesson.fileType === 'pdf' ? 'PDF' : 'bảng tính Excel'}:
                    </h4>
                    <p className="text-blue-300 font-semibold text-xs mt-0.5 break-all">
                      {effectiveLesson.fileName || effectiveLesson.title}
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      Mục "Trình Chiếu PPT" chỉ dành riêng cho bài giảng PowerPoint (.pptx, .ppt). Để xem tài liệu văn bản chuẩn trang in gốc và ghi chú, Thầy/Cô mở trong tab "Mở Tài Liệu".
                    </p>
                  </div>
                </div>
                {onSwitchToReader && (
                  <button
                    onClick={onSwitchToReader}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 shrink-0 cursor-pointer transition-all active:scale-95"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Mở Trong Mục Mở Tài Liệu</span>
                  </button>
                )}
              </div>
            )}

            {/* Direct Upload / Drag & Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileUpload(file);
              }}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center gap-4 ${
                isDragging
                  ? 'border-orange-400 bg-orange-950/20 scale-[1.01]'
                  : 'border-slate-700 bg-slate-900/50 hover:bg-slate-900/80 hover:border-slate-600'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
                {isUploading ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <UploadCloud className="w-8 h-8" />
                )}
              </div>

              <div>
                <h4 className="text-lg font-bold text-white mb-1">
                  Kéo thả hoặc Chọn tệp PowerPoint từ máy tính / USB
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Hỗ trợ đầy đủ định dạng <b>.pptx</b> và <b>.ppt</b>. Ứng dụng tự động kết xuất các slide rõ nét 4K trên
                  màn hình Tivi 75".
                </p>
              </div>

              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-600/50 text-rose-300 text-xs flex items-center gap-2 max-w-md">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                <button
                  id="btn-upload-ppt-direct"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-orange-600/30 transition-all cursor-pointer active:scale-95"
                >
                  <FileUp className="w-4 h-4" />
                  <span>Chọn Tệp (.pptx, .ppt)</span>
                </button>

                <button
                  onClick={launchSamplePresentation}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Chiếu Thử Slide Mẫu</span>
                </button>
              </div>
            </div>

            {/* Teacher Cloud Library Picker */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <span>Hoặc chọn bài giảng từ Kho Tài Liệu của bạn:</span>
              </div>
              <TeacherFileManager
                onSelectFile={(lesson) => {
                  onSelectLesson(lesson);
                  setShowFileManager(false);
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full relative flex flex-col">
          {/* Top subtle bar to switch file and save to library */}
          <div className="absolute top-4 left-4 z-40 flex items-center gap-2.5">
            <button
              onClick={() => setShowFileManager(true)}
              className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md text-white text-xs font-bold rounded-xl border border-slate-700 shadow-xl flex items-center gap-2 transition-all cursor-pointer"
            >
              <MonitorPlay className="w-4 h-4 text-orange-400" />
              <span>Đổi Bài Giảng Khác</span>
            </button>

            {onSaveToLibrary && effectiveLesson && (
              isSavedInLibrary ? (
                <span className="px-3 py-1.5 bg-emerald-950/80 backdrop-blur-md text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/40 shadow-xl flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Đã có trong Kho</span>
                </span>
              ) : (
                <button
                  onClick={() => {
                    onSaveToLibrary(effectiveLesson);
                    setSavedToast(true);
                    setTimeout(() => setSavedToast(false), 3500);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 backdrop-blur-md text-white text-xs font-bold rounded-xl border border-emerald-500 shadow-xl flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Lưu bài giảng này vào Kho Bài Giảng để dùng lại lần sau"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>Lưu Vào Kho Bài Giảng</span>
                </button>
              )
            )}
          </div>

          {savedToast && (
            <div className="absolute top-16 left-4 z-50 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xl flex items-center gap-2 animate-fade-in border border-emerald-400">
              <Check className="w-4 h-4" />
              <span>Đã lưu bài giảng vào Kho Bài Giảng thành công!</span>
            </div>
          )}

          <PPTXViewer
            url={effectiveUrl}
            lesson={effectiveLesson}
            title={effectiveTitle}
            onClose={() => setShowFileManager(true)}
          />
        </div>
      )}
    </div>
  );
};
