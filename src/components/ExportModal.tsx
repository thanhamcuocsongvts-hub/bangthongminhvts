import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  FileDown,
  Layers,
  CheckCircle2,
  X,
  Sparkles,
  Download,
  FileSpreadsheet,
  Presentation,
  Check,
} from 'lucide-react';
import { LessonDoc, RoomState, TeacherProfile, ClassRoom } from '../types';
import {
  exportLessonToWord,
  exportLessonToPPTX,
  exportQuizAnalyticsToExcel,
  exportGradebookToExcel,
  exportElementToHDImage,
  exportElementToPDF,
  exportLessonJSON,
} from '../utils/exportUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: LessonDoc;
  roomState: RoomState | null;
  teacher?: TeacherProfile;
  classroom?: ClassRoom;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  lesson,
  roomState,
  teacher,
  classroom,
}) => {
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [successType, setSuccessType] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. Word Export
  const handleExportWord = async () => {
    try {
      setIsExporting('word');
      await exportLessonToWord(lesson, roomState);
      setSuccessType('word');
      setTimeout(() => setSuccessType(null), 3000);
    } catch (e) {
      console.error('Word export error:', e);
      alert('Không thể xuất file Word. Vui lòng thử lại.');
    } finally {
      setIsExporting(null);
    }
  };

  // 2. PowerPoint (.pptx) Export
  const handleExportPPTX = async () => {
    try {
      setIsExporting('pptx');
      await exportLessonToPPTX(lesson);
      setSuccessType('pptx');
      setTimeout(() => setSuccessType(null), 3000);
    } catch (e) {
      console.error('PowerPoint export error:', e);
      alert('Không thể xuất file PowerPoint (.pptx). Vui lòng thử lại.');
    } finally {
      setIsExporting(null);
    }
  };

  // 3. Excel (.xlsx) Export
  const handleExportExcel = () => {
    try {
      setIsExporting('excel');
      if (roomState && roomState.submissions && Object.keys(roomState.submissions).length > 0) {
        exportQuizAnalyticsToExcel(roomState, lesson);
      } else if (classroom && teacher) {
        exportGradebookToExcel(classroom, teacher);
      } else {
        // Fallback demo quiz analytics
        exportQuizAnalyticsToExcel(
          roomState || {
            roomPin: '8899',
            activeLessonId: lesson.id,
            activeSlideIndex: 0,
            activeQuestionIndex: 0,
            isQuizActive: false,
            activeStudents: [
              { id: 'st1', name: 'Nguyễn Văn An', score: 10, joinedAt: '' },
              { id: 'st2', name: 'Trần Thị Bình', score: 8, joinedAt: '' },
              { id: 'st3', name: 'Lê Hoàng Cường', score: 10, joinedAt: '' },
            ],
            submissions: {},
            questions: lesson.quizzes || [],
          },
          lesson
        );
      }
      setSuccessType('excel');
      setTimeout(() => setSuccessType(null), 3000);
    } catch (e) {
      console.error('Excel export error:', e);
      alert('Không thể xuất file Excel. Vui lòng thử lại.');
    } finally {
      setIsExporting(null);
    }
  };

  // 4. HD Image (.PNG) Export
  const handleExportHDImage = async () => {
    try {
      setIsExporting('image');
      const targetId = document.getElementById('slide-render-card')
        ? 'slide-render-card'
        : document.getElementById('presentation-viewport')
        ? 'presentation-viewport'
        : 'gradebook-viewport';

      await exportElementToHDImage(targetId, `${lesson.title.replace(/\s+/g, '_')}_HD.png`);
      setSuccessType('image');
      setTimeout(() => setSuccessType(null), 3000);
    } catch (e) {
      console.error('HD image export error:', e);
      alert('Không thể xuất ảnh HD. Vui lòng thử lại.');
    } finally {
      setIsExporting(null);
    }
  };

  // 5. PDF Document Export
  const handleExportPDF = async () => {
    try {
      setIsExporting('pdf');
      const targetId = document.getElementById('presentation-viewport')
        ? 'presentation-viewport'
        : document.getElementById('doc-reader-viewport')
        ? 'doc-reader-viewport'
        : 'analytics-report-view';

      await exportElementToPDF(targetId, `${lesson.title.replace(/\s+/g, '_')}_Lesson.pdf`);
      setSuccessType('pdf');
      setTimeout(() => setSuccessType(null), 3000);
    } catch (e) {
      console.error('PDF export error:', e);
      alert('Không thể xuất file PDF. Vui lòng thử lại.');
    } finally {
      setIsExporting(null);
    }
  };

  // 6. Slide Package JSON
  const handleExportSlideBackup = () => {
    try {
      setIsExporting('slide');
      exportLessonJSON(lesson);
      setSuccessType('slide');
      setTimeout(() => setSuccessType(null), 3000);
    } catch (e) {
      console.error('Slide export error:', e);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl p-6 md:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900">Xuất Bản & Chia Sẻ Đa Định Dạng</h3>
              <p className="text-xs text-slate-500 font-medium">
                Hỗ trợ Word .docx, PowerPoint .pptx, Excel .xlsx, PDF in ấn, Ảnh HD và Gói Slide
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* 6 Grid Export Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Word .DOCX */}
          <div
            onClick={handleExportWord}
            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              successType === 'word'
                ? 'bg-emerald-50 border-emerald-500'
                : 'bg-slate-50 border-slate-200 hover:border-blue-500 hover:bg-white shadow-xs'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 mb-0.5">Word (.docx)</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Giáo án đầy đủ, lý thuyết, slide và trắc nghiệm có đáp án.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-blue-600">
              <span>{isExporting === 'word' ? 'Đang tạo...' : 'Tải xuống .docx'}</span>
              {successType === 'word' ? <Check className="w-4 h-4 text-emerald-600" /> : <Download className="w-4 h-4" />}
            </div>
          </div>

          {/* 2. PowerPoint (.PPTX) */}
          <div
            onClick={handleExportPPTX}
            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              successType === 'pptx'
                ? 'bg-emerald-50 border-emerald-500'
                : 'bg-slate-50 border-slate-200 hover:border-orange-500 hover:bg-white shadow-xs'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 shrink-0">
                <Presentation className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 mb-0.5">PowerPoint (.pptx)</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Trình chiếu slide chuẩn 16:9 cho Microsoft PowerPoint.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-orange-600">
              <span>{isExporting === 'pptx' ? 'Đang tạo PPT...' : 'Tải xuống .pptx'}</span>
              {successType === 'pptx' ? <Check className="w-4 h-4 text-emerald-600" /> : <Download className="w-4 h-4" />}
            </div>
          </div>

          {/* 3. Excel (.XLSX) */}
          <div
            onClick={handleExportExcel}
            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              successType === 'excel'
                ? 'bg-emerald-50 border-emerald-500'
                : 'bg-slate-50 border-slate-200 hover:border-emerald-500 hover:bg-white shadow-xs'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 mb-0.5">Excel (.xlsx)</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Sổ điểm lớp học & Bảng phân tích xếp hạng làm bài tức thì.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-emerald-600">
              <span>{isExporting === 'excel' ? 'Đang tạo Excel...' : 'Tải xuống .xlsx'}</span>
              {successType === 'excel' ? <Check className="w-4 h-4 text-emerald-600" /> : <Download className="w-4 h-4" />}
            </div>
          </div>

          {/* 4. PDF In Ấn */}
          <div
            onClick={handleExportPDF}
            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              successType === 'pdf'
                ? 'bg-emerald-50 border-emerald-500'
                : 'bg-slate-50 border-slate-200 hover:border-rose-500 hover:bg-white shadow-xs'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <FileDown className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 mb-0.5">Tài Liệu PDF In Ấn</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Tài liệu in ấn phát tay chất lượng cao cho học sinh ôn tập.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-rose-600">
              <span>{isExporting === 'pdf' ? 'Đang tạo PDF...' : 'Tải xuống PDF'}</span>
              {successType === 'pdf' ? <Check className="w-4 h-4 text-emerald-600" /> : <Download className="w-4 h-4" />}
            </div>
          </div>

          {/* 5. HD Image (2K/4K) */}
          <div
            onClick={handleExportHDImage}
            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              successType === 'image'
                ? 'bg-emerald-50 border-emerald-500'
                : 'bg-slate-50 border-slate-200 hover:border-teal-500 hover:bg-white shadow-xs'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shrink-0">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 mb-0.5">Ảnh Chụp HD (4K)</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Ảnh chụp nét cao kèm nét vẽ cảm ứng của giáo viên trên Tivi.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-teal-600">
              <span>{isExporting === 'image' ? 'Đang kết xuất...' : 'Tải ảnh PNG'}</span>
              {successType === 'image' ? <Check className="w-4 h-4 text-emerald-600" /> : <Download className="w-4 h-4" />}
            </div>
          </div>

          {/* 6. Slide Package JSON */}
          <div
            onClick={handleExportSlideBackup}
            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
              successType === 'slide'
                ? 'bg-emerald-50 border-emerald-500'
                : 'bg-slate-50 border-slate-200 hover:border-purple-500 hover:bg-white shadow-xs'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900 mb-0.5">Gói Slide Sao Lưu</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Đồng bộ và nhập lại vào bất kỳ màn hình Tivi thông minh nào.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-purple-600">
              <span>{isExporting === 'slide' ? 'Đang xuất...' : 'Tải file JSON'}</span>
              {successType === 'slide' ? <Check className="w-4 h-4 text-emerald-600" /> : <Download className="w-4 h-4" />}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors"
          >
            Đóng Lại
          </button>
        </div>
      </div>
    </div>
  );
};
