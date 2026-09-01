import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Plus,
  Trash2,
  FolderOpen,
  CloudCheck,
  RefreshCw,
  Search,
  BookOpen,
  CheckCircle2,
  Layers,
  Sparkles,
  Download,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { LessonDoc, SubjectType } from '../types';
import { exportLessonJSON } from '../utils/exportUtils';
import { parseUploadedFileToLesson, cleanDocumentText } from '../utils/fileParser';

interface DocumentLibraryProps {
  lessons: LessonDoc[];
  activeLessonId: string;
  onSelectLesson: (id: string) => void;
  onAddLesson: (newDoc: LessonDoc) => void;
  onDeleteLesson: (id: string) => void;
  onSyncToCloud: () => Promise<void>;
  isSyncing: boolean;
}

export const DocumentLibrary: React.FC<DocumentLibraryProps> = ({
  lessons,
  activeLessonId,
  onSelectLesson,
  onAddLesson,
  onDeleteLesson,
  onSyncToCloud,
  isSyncing,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('Tất cả');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // New Lesson State for Modal
  const [newTitle, setNewTitle] = useState<string>('');
  const [newSubject, setNewSubject] = useState<SubjectType>('Sinh học');
  const [newGrade, setNewGrade] = useState<string>('Lớp 10');
  const [newAuthor, setNewAuthor] = useState<string>('Giáo viên bộ môn');
  const [newContent, setNewContent] = useState<string>('');

  const subjects = ['Tất cả', 'Sinh học', 'Vật lý', 'Toán học', 'Hóa học', 'Lịch sử', 'Ngữ văn', 'Tiếng Anh'];

  const filteredLessons = lessons.filter((l) => {
    const matchSearch = l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSub = selectedSubject === 'Tất cả' || l.subject === selectedSubject;
    return matchSearch && matchSub;
  });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    // File size safety check: Support large files up to 250MB
    if (file.size > 250 * 1024 * 1024) {
      setErrorMessage('Tệp quá lớn (> 250MB). Vui lòng chọn tệp nhỏ hơn 250MB.');
      return;
    }

    setIsProcessingFile(true);
    setUploadStatus(`Đang đọc tệp ${file.name}...`);
    setErrorMessage(null);

    try {
      const newDoc = await parseUploadedFileToLesson(file);
      onAddLesson(newDoc);
      setUploadStatus(`Đã nạp thành công tài liệu "${newDoc.title}"!`);
      setTimeout(() => setUploadStatus(null), 3500);
    } catch (err: any) {
      console.error('File upload error:', err);
      setErrorMessage(`Lỗi khi xử lý tệp ${file.name}: ${err.message || 'Không thể đọc nội dung'}`);
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleCreateNewLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    // Create starter slide from content
    const slides = [
      {
        id: 's1',
        title: newTitle.toUpperCase(),
        subtitle: `${newSubject} - ${newGrade}`,
        content: newContent || `Nội dung tổng quan cho bài học ${newTitle}`,
        keyTakeaway: `Trọng tâm kiến thức ${newSubject} ${newGrade}`,
      },
    ];

    const newDoc: LessonDoc = {
      id: 'lesson_' + Date.now(),
      title: newTitle.trim(),
      subject: newSubject,
      grade: newGrade,
      lastModified: new Date().toISOString(),
      syncedToCloud: true,
      author: newAuthor.trim() || 'Giáo viên bộ môn',
      rawText: newContent || newTitle,
      slides,
      quizzes: [],
    };

    onAddLesson(newDoc);
    setShowCreateModal(false);
    setNewTitle('');
    setNewContent('');
  };

  return (
    <div id="document-library-viewport" className="relative w-full h-[calc(100vh-100px)] flex flex-col bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-md p-6 md:p-8 space-y-6 overflow-y-auto">
      {/* Top Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 text-sm font-bold uppercase tracking-wider mb-1">
            <BookOpen className="w-5 h-5" />
            <span>KHO BÀI GIẢNG & ĐỒNG BỘ CLOUD</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">Quản Lý Tài Liệu Lớp Học</h1>
        </div>

        {/* Top Actions: Cloud Sync & Create Lesson */}
        <div className="flex items-center gap-3">
          <button
            id="cloud-sync-btn"
            onClick={onSyncToCloud}
            disabled={isSyncing}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-sm font-bold flex items-center gap-2 transition-all shadow-xs"
            title="Đồng bộ hóa tức thì toàn bộ bài giảng lên Cloud"
          >
            <RefreshCw className={`w-4 h-4 text-indigo-600 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Đang đồng bộ Cloud...' : 'Đồng Bộ Cloud'}</span>
          </button>

          <button
            id="create-lesson-btn"
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-5 h-5" />
            <span>Soạn Bài Mới</span>
          </button>
        </div>
      </div>

      {/* Upload Feedback Status Alerts */}
      {uploadStatus && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold flex items-center gap-2.5 animate-fade-in shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{uploadStatus}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-bold flex items-center gap-2.5 animate-fade-in shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Drag and Drop Upload Zone for 75" Touch Display */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFileUpload(e.dataTransfer.files);
        }}
        onClick={() => !isProcessingFile && fileInputRef.current?.click()}
        className={`p-8 rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center ${
          isProcessingFile
            ? 'border-indigo-400 bg-indigo-50/50 cursor-wait'
            : isDragging
            ? 'border-indigo-500 bg-indigo-50/70'
            : 'border-slate-300 bg-slate-50 hover:bg-slate-100/80 hover:border-slate-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.json,.doc,.docx,.pdf,.md,.xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        {isProcessingFile ? (
          <div className="flex flex-col items-center space-y-3">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            <h3 className="text-lg font-bold text-slate-900">Đang phân tích và xử lý tài liệu...</h3>
            <p className="text-xs text-slate-500">Hệ thống đang trích xuất văn bản một cách an toàn và tối ưu bộ nhớ</p>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-3 shadow-xs">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">
              Chạm hoặc Kéo Thả Tài Liệu Vào Đây
            </h3>
            <p className="text-slate-500 text-sm max-w-md">
              Hỗ trợ tệp văn bản bài giảng Word (.docx), Excel (.xlsx, .csv), PDF, TXT, JSON. Hệ thống tự động trích xuất nội dung và chuẩn bị slide giảng dạy.
            </p>
          </>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Subject Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1">
          {subjects.map((sub) => (
            <button
              key={sub}
              onClick={() => setSelectedSubject(sub)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all shadow-xs ${
                selectedSubject === sub
                  ? 'bg-indigo-600 text-white shadow-indigo-600/20'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm bài giảng..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-xs"
          />
        </div>
      </div>

      {/* Lesson Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLessons.map((lesson) => {
          const isActive = lesson.id === activeLessonId;
          return (
            <div
              key={lesson.id}
              className={`p-6 rounded-3xl border-2 transition-all flex flex-col justify-between shadow-xs ${
                isActive
                  ? 'bg-indigo-50/40 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-mono text-xs font-bold border border-indigo-200">
                    {lesson.subject} • {lesson.grade}
                  </span>
                  {lesson.syncedToCloud && (
                    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                      <CloudCheck className="w-4 h-4" /> Cloud
                    </span>
                  )}
                </div>

                <h3 className="text-xl font-black text-slate-900 line-clamp-2 mb-2">
                  {lesson.title}
                </h3>

                <p className="text-slate-600 text-sm line-clamp-3 mb-4 leading-relaxed">
                  {lesson.extractedSummary?.summary || cleanDocumentText(lesson.rawText) || 'Tài liệu bài giảng đính kèm.'}
                </p>

                <div className="flex items-center gap-3 text-xs text-slate-500 mb-6">
                  <div className="flex items-center gap-1">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>{lesson.slides?.length || 0} Slides</span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>{lesson.quizzes?.length || 0} Câu hỏi</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectLesson(lesson.id)}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {isActive ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>Đang Trình Chiếu</span>
                    </>
                  ) : (
                    <span>Chọn Giảng Dạy</span>
                  )}
                </button>

                <button
                  onClick={() => exportLessonJSON(lesson)}
                  title="Tải gói sao lưu JSON"
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all border border-slate-200"
                >
                  <Download className="w-4 h-4" />
                </button>

                {lessons.length > 1 && (
                  <button
                    onClick={() => onDeleteLesson(lesson.id)}
                    title="Xóa bài giảng"
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-rose-600 transition-all border border-slate-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Soạn bài mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl p-8 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-6">
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Plus className="w-6 h-6 text-indigo-600" />
              <span>Tạo Bài Giảng Mới</span>
            </h3>

            <form onSubmit={handleCreateNewLesson} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Tên Bài Học / Tiêu Đề Bài Giảng
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Định luật bảo toàn năng lượng..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Môn Học
                  </label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value as SubjectType)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="Sinh học">Sinh học</option>
                    <option value="Vật lý">Vật lý</option>
                    <option value="Toán học">Toán học</option>
                    <option value="Hóa học">Hóa học</option>
                    <option value="Lịch sử">Lịch sử</option>
                    <option value="Ngữ văn">Ngữ văn</option>
                    <option value="Tiếng Anh">Tiếng Anh</option>
                    <option value="Tin học">Tin học</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Khối Lớp
                  </label>
                  <select
                    value={newGrade}
                    onChange={(e) => setNewGrade(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="Lớp 10">Lớp 10</option>
                    <option value="Lớp 11">Lớp 11</option>
                    <option value="Lớp 12">Lớp 12</option>
                    <option value="Lớp 9">Lớp 9</option>
                    <option value="Lớp 8">Lớp 8</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Nội Dung Tóm Tắt Hoặc Tài Liệu Bài Giảng
                </label>
                <textarea
                  rows={4}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Nhập nội dung lý thuyết, công thức hoặc dán tài liệu vào đây..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20"
                >
                  Tạo Bài Giảng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
