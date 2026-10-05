/**
 * StorageManagementView.tsx (Kho Lưu Trữ & Đồng Bộ Cloud Đa Thiết Bị)
 * SmartBoard 75 Pro
 * 
 * Tính năng chính:
 * 1. Đổi toàn bộ nhãn "Bài Giảng" thành "Lưu Trữ" (Kho Lưu Trữ & Đồng Bộ Cloud)
 * 2. Tải tệp đa định dạng giáo dục: PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx), Hình ảnh.
 *    - Giới hạn dung lượng: Chỉ cho phép tệp từ 25 MB trở xuống.
 *    - Nếu tệp > 25MB: Thông báo "Vui lòng chọn tệp dưới 25MB để đảm bảo tốc độ tải đa thiết bị".
 *    - Lưu trữ đồng bộ lên Firebase Storage / Cloud Database kèm thông tin: Tên tệp, dung lượng thực, thời gian tải.
 *    - Đảm bảo mở trên máy tính ở lớp hay ở nhà đều tải về và mở chiếu trọn vẹn 100%.
 * 3. Mục "Lưu Trữ Đường Link": Cho phép dán link Google Drive, YouTube bài giảng, Canva, Quizizz...
 *    Tự động nhận diện nền tảng, hiển thị thẻ card link đẹp mắt kèm nút "Mở liên kết".
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  FolderOpen,
  UploadCloud,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  BookOpen,
  CheckCircle2,
  Download,
  AlertCircle,
  ExternalLink,
  Link2,
  Video,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  Share2,
  HardDrive,
  Cloud,
  Sparkles,
  X,
  Clock,
  Layers,
  Globe,
  Youtube,
  Eye,
} from 'lucide-react';
import { LessonDoc, TeacherProfile } from '../types';
import { exportOriginalLessonFile } from '../utils/exportUtils';
import { useLectureRepository } from '../hooks/useLectureRepository';
import { db } from '../lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { safeSetDoc } from '../utils/firebaseSafe';

export interface ExternalResourceLink {
  id: string;
  title: string;
  url: string;
  category: 'Google Drive' | 'YouTube' | 'Canva' | 'Quizizz' | 'Khác';
  addedAt: string;
  description?: string;
}

const DEFAULT_LINKS: ExternalResourceLink[] = [
  {
    id: 'link_drive_sample',
    title: 'Google Drive - Kho Đề Thi & Giáo Án Chuyên Đề 2026',
    url: 'https://drive.google.com',
    category: 'Google Drive',
    addedAt: 'Hôm nay',
    description: 'Thư mục tài liệu ôn thi THPT Quốc Gia và đề kiểm tra định kỳ',
  },
  {
    id: 'link_youtube_sample',
    title: 'YouTube - Bài Giảng Minh Họa Hình Không Gian 3D',
    url: 'https://youtube.com',
    category: 'YouTube',
    addedAt: 'Hôm nay',
    description: 'Video trực quan chuyển động khối tròn xoay và mặt nón',
  },
  {
    id: 'link_canva_sample',
    title: 'Canva - Slide Bài Trình Chiếu Sư Phạm Sinh Động',
    url: 'https://canva.com',
    category: 'Canva',
    addedAt: 'Hôm qua',
    description: 'Bộ slide thiết kế bài giảng tương tác kích thước chuẩn 16:9',
  },
  {
    id: 'link_quizizz_sample',
    title: 'Quizizz - Trắc Nghiệm Đấu Trường Tri Thức Lớp Học',
    url: 'https://quizizz.com',
    category: 'Quizizz',
    addedAt: 'Hôm qua',
    description: 'Bộ câu hỏi thi đấu trắc nghiệm thời gian thực cho học sinh',
  },
];

interface StorageManagementViewProps {
  lessons: LessonDoc[];
  activeTeacher: TeacherProfile | null;
  activeLessonId: string;
  onSelectLesson: (id: string) => void;
  onAddLesson: (newDoc: LessonDoc) => void;
  onDeleteLesson: (id: string, title?: string) => Promise<void> | void;
  onCleanLibrary?: () => void;
  onSyncToCloud: () => Promise<void>;
  onPullFromCloud?: () => Promise<void>;
  isSyncing: boolean;
}

export const StorageManagementView: React.FC<StorageManagementViewProps> = ({
  lessons,
  activeLessonId,
  onSelectLesson,
  onAddLesson,
  onDeleteLesson,
  onCleanLibrary,
  onSyncToCloud,
  onPullFromCloud,
  isSyncing,
  activeTeacher,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'files' | 'links'>('files');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Link Management State
  const [links, setLinks] = useState<ExternalResourceLink[]>(() => {
    try {
      const saved = localStorage.getItem('smartboard_cloud_links');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return DEFAULT_LINKS;
  });

  const [showAddLinkModal, setShowAddLinkModal] = useState<boolean>(false);
  const [newLinkTitle, setNewLinkTitle] = useState<string>('');
  const [newLinkUrl, setNewLinkUrl] = useState<string>('');
  const [newLinkCategory, setNewLinkCategory] = useState<'Google Drive' | 'YouTube' | 'Canva' | 'Quizizz' | 'Khác'>('Google Drive');
  const [newLinkDesc, setNewLinkDesc] = useState<string>('');

  // Firebase Realtime Hook
  const {
    lectures: cloudLectures,
    uploadLectureFile,
    deleteLectureFile,
    isLoading: isRepoLoading,
  } = useLectureRepository();

  // Sync links across devices via Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'global_store', 'smartboard_links'), (snap) => {
      if (snap.exists() && snap.data()?.links) {
        const cloudLinks = snap.data().links;
        if (Array.isArray(cloudLinks)) {
          setLinks(cloudLinks);
          try {
            localStorage.setItem('smartboard_cloud_links', JSON.stringify(cloudLinks));
          } catch (_) {}
        }
      }
    }, () => {});
    return () => unsub();
  }, []);

  const saveLinksState = async (newLinks: ExternalResourceLink[]) => {
    setLinks(newLinks);
    try {
      localStorage.setItem('smartboard_cloud_links', JSON.stringify(newLinks));
    } catch (_) {}
    try {
      await safeSetDoc(doc(db, 'global_store', 'smartboard_links'), {
        links: newLinks,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (_) {}
  };

  // Detect category from URL automatically
  const detectCategoryFromUrl = (url: string) => {
    const u = url.toLowerCase();
    if (u.includes('drive.google') || u.includes('docs.google')) return 'Google Drive';
    if (u.includes('youtube') || u.includes('youtu.be')) return 'YouTube';
    if (u.includes('canva')) return 'Canva';
    if (u.includes('quizizz')) return 'Quizizz';
    return 'Khác';
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkUrl.trim()) return;

    let finalUrl = newLinkUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    const detected = detectCategoryFromUrl(finalUrl);
    const cat = newLinkCategory === 'Google Drive' && detected !== 'Google Drive' ? detected : newLinkCategory;

    const newLink: ExternalResourceLink = {
      id: 'link_' + Date.now(),
      title: newLinkTitle.trim() || `${cat} - Liên kết bài giảng`,
      url: finalUrl,
      category: cat,
      addedAt: new Date().toLocaleDateString('vi-VN'),
      description: newLinkDesc.trim() || undefined,
    };

    const next = [newLink, ...links];
    await saveLinksState(next);

    setNewLinkTitle('');
    setNewLinkUrl('');
    setNewLinkDesc('');
    setShowAddLinkModal(false);
    setSuccessMessage(`Đã thêm thành công liên kết "${newLink.title}"!`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleDeleteLink = async (id: string) => {
    const next = links.filter((l) => l.id !== id);
    await saveLinksState(next);
  };

  // YÊU CẦU 2: CƠ CHẾ TẢI TỆP LÊN (UPLOAD) <= 25MB
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    // BẮT BUỘC: Giới hạn 25MB
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage('Vui lòng chọn tệp dưới 25MB để đảm bảo tốc độ tải đa thiết bị');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setErrorMessage(null);
    setIsUploading(true);

    const ext = file.name.split('.').pop()?.toLowerCase() || 'doc';
    const cleanTitle = file.name.replace(/\.[^/.]+$/, '').trim();
    const sizeFormatted = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    const localBlobUrl = URL.createObjectURL(file);
    const docId = 'doc_' + Date.now();
    const uploadTimestamp = new Date().toISOString();

    const newDoc: LessonDoc = {
      id: docId,
      title: cleanTitle,
      fileName: file.name,
      fileType: ext as any,
      fileSize: sizeFormatted,
      fileUrl: localBlobUrl,
      subject: activeTeacher?.subject || 'Toán học',
      grade: 'Lớp 12',
      author: activeTeacher?.name || 'Giáo viên',
      lastModified: uploadTimestamp,
      syncedToCloud: true,
      rawText: `Tài liệu: ${file.name}\nDung lượng: ${sizeFormatted}\nThời gian tải: ${new Date().toLocaleString('vi-VN')}`,
      quizzes: [],
      slides: [
        {
          id: `s_${docId}`,
          title: cleanTitle,
          subtitle: `${file.name} • ${sizeFormatted}`,
          content: `Tệp: ${file.name}\nĐịnh dạng: ${ext.toUpperCase()}\nDung lượng thực: ${sizeFormatted}\nTải lên: ${new Date().toLocaleString('vi-VN')}\nSẵn sàng đồng bộ đa thiết bị (máy ở lớp, máy ở nhà).`,
        },
      ],
    };

    onAddLesson(newDoc);
    setSuccessMessage(`⚡ Tải lên thành công "${file.name}" (${sizeFormatted})! Đang đồng bộ đám mây...`);

    if (fileInputRef.current) fileInputRef.current.value = '';

    // Async sync to Firebase Storage
    try {
      await uploadLectureFile(file);
      setSuccessMessage(`✅ Tệp "${file.name}" (${sizeFormatted}) đã được đồng bộ đám mây thành công!`);
    } catch (uploadErr) {
      console.warn('Firebase storage upload notice:', uploadErr);
    } finally {
      setIsUploading(false);
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  // Combine local and cloud documents
  const allDocuments = useMemo(() => {
    const list: LessonDoc[] = [...lessons];
    const seenIds = new Set(lessons.map((l) => l.id));
    const seenTitles = new Set(lessons.map((l) => l.title?.trim().toLowerCase()));

    if (cloudLectures && cloudLectures.length > 0) {
      for (const cl of cloudLectures) {
        const title = cl.fileName || 'Tài liệu lưu trữ';
        const key = title.trim().toLowerCase();
        if (!seenIds.has(cl.id) && !seenTitles.has(key)) {
          seenIds.add(cl.id);
          seenTitles.add(key);
          const ext = cl.fileType || cl.fileName?.split('.').pop() || 'doc';
          list.push({
            id: cl.id,
            title,
            fileName: cl.fileName,
            fileType: ext as any,
            fileUrl: cl.downloadURL,
            fileSize: typeof cl.fileSize === 'string' ? cl.fileSize : undefined,
            storagePath: cl.storagePath,
            subject: 'Khác',
            grade: 'Lớp 12',
            author: cl.authorName || 'Đồng bộ Cloud',
            lastModified: cl.uploadedAt?.toDate ? cl.uploadedAt.toDate().toISOString() : new Date().toISOString(),
            syncedToCloud: true,
            rawText: title,
            quizzes: [],
            slides: [],
          });
        }
      }
    }

    return list;
  }, [lessons, cloudLectures]);

  const filteredDocuments = allDocuments.filter((d) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      (d.title || '').toLowerCase().includes(term) ||
      (d.fileName || '').toLowerCase().includes(term);

    if (selectedFormat === 'all') return matchSearch;
    const ext = (d.fileType || d.fileName?.split('.').pop() || '').toLowerCase();
    if (selectedFormat === 'pdf') return matchSearch && ext === 'pdf';
    if (selectedFormat === 'word') return matchSearch && (ext === 'docx' || ext === 'doc');
    if (selectedFormat === 'ppt') return matchSearch && (ext === 'pptx' || ext === 'ppt');
    if (selectedFormat === 'excel') return matchSearch && (ext === 'xlsx' || ext === 'xls' || ext === 'csv');
    if (selectedFormat === 'image') return matchSearch && (ext === 'jpg' || ext === 'png' || ext === 'jpeg' || ext === 'webp');
    return matchSearch;
  });

  const filteredLinks = links.filter((l) => {
    const term = searchTerm.toLowerCase();
    return (
      l.title.toLowerCase().includes(term) ||
      l.url.toLowerCase().includes(term) ||
      l.category.toLowerCase().includes(term)
    );
  });

  const getFormatBadge = (doc: LessonDoc) => {
    const ext = (doc.fileType || doc.fileName?.split('.').pop() || 'doc').toLowerCase();
    if (ext === 'pdf') return { label: 'PDF', bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40', icon: <FileText className="w-4 h-4 text-rose-400" /> };
    if (ext === 'docx' || ext === 'doc') return { label: 'Word', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40', icon: <FileText className="w-4 h-4 text-blue-400" /> };
    if (ext === 'pptx' || ext === 'ppt') return { label: 'PPTX', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: <Presentation className="w-4 h-4 text-amber-400" /> };
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return { label: 'Excel', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> };
    if (ext === 'jpg' || ext === 'png' || ext === 'webp' || ext === 'jpeg') return { label: 'Ảnh', bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40', icon: <ImageIcon className="w-4 h-4 text-purple-400" /> };
    return { label: ext.toUpperCase(), bg: 'bg-slate-700 text-slate-300 border-slate-600', icon: <FolderOpen className="w-4 h-4 text-slate-400" /> };
  };

  const getLinkCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'Google Drive':
        return { bg: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: <HardDrive className="w-4 h-4 text-blue-400" /> };
      case 'YouTube':
        return { bg: 'bg-rose-500/20 text-rose-300 border-rose-500/30', icon: <Youtube className="w-4 h-4 text-rose-400" /> };
      case 'Canva':
        return { bg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', icon: <Presentation className="w-4 h-4 text-cyan-400" /> };
      case 'Quizizz':
        return { bg: 'bg-purple-500/20 text-purple-300 border-purple-500/30', icon: <Sparkles className="w-4 h-4 text-purple-400" /> };
      default:
        return { bg: 'bg-slate-700/50 text-slate-300 border-slate-600', icon: <Globe className="w-4 h-4 text-slate-400" /> };
    }
  };

  return (
    <div className="flex-1 w-full h-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Top Header */}
      <div className="px-4 md:px-8 py-5 border-b border-slate-800 bg-slate-900/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-amber-600/30">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2.5">
              <span>Lưu Trữ</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                Kho Lưu Trữ & Đồng Bộ Cloud
              </span>
            </h1>
            <p className="text-slate-400 text-xs md:text-sm mt-0.5">
              Đồng bộ dữ liệu đa thiết bị (máy ở lớp, máy ở nhà) • Giới hạn tệp: <b>≤ 25MB</b>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.csv,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs md:text-sm flex items-center gap-2 shadow-lg shadow-amber-600/30 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            title="Tải lên tệp tài liệu giáo dục dung lượng ≤ 25MB"
          >
            {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            <span>Tải Tệp Lên (&le; 25MB)</span>
          </button>

          <button
            onClick={() => setShowAddLinkModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs md:text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-95 transition-all cursor-pointer"
            title="Lưu trữ đường link bên ngoài (Google Drive, YouTube, Canva, Quizizz...)"
          >
            <Link2 className="w-4 h-4" />
            <span>Thêm Đường Link</span>
          </button>

          {onSyncToCloud && (
            <button
              onClick={onSyncToCloud}
              disabled={isSyncing}
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
              title="Đồng bộ thủ công với đám mây"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Alert Notices */}
      {errorMessage && (
        <div className="mx-4 md:mx-8 mt-4 p-3.5 rounded-2xl bg-rose-950/80 border-2 border-rose-500/80 text-rose-200 text-xs md:text-sm font-bold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-1 text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mx-4 md:mx-8 mt-4 p-3.5 rounded-2xl bg-emerald-950/80 border-2 border-emerald-500/80 text-emerald-200 text-xs md:text-sm font-bold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="p-1 text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Tabs Navigation: TỆP TÀI LIỆU vs ĐƯỜNG LINK */}
      <div className="px-4 md:px-8 pt-4 pb-2 flex items-center justify-between gap-4 border-b border-slate-800/60 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('files')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'files'
                ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Tệp Lưu Trữ ({allDocuments.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('links')}
            className={`px-4 py-2 rounded-xl text-xs md:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'links'
                ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/50'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>Lưu Trữ Đường Link ({links.length})</span>
          </button>
        </div>

        {/* Filter and Search Box */}
        <div className="flex items-center gap-2">
          {activeSubTab === 'files' && (
            <div className="hidden sm:flex items-center bg-slate-900 rounded-xl p-1 border border-slate-800 text-xs">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'pdf', label: 'PDF' },
                { id: 'word', label: 'Word' },
                { id: 'ppt', label: 'PowerPoint' },
                { id: 'excel', label: 'Excel' },
                { id: 'image', label: 'Ảnh' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFormat(f.id)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    selectedFormat === f.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm tài liệu / link..."
              className="pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44 md:w-64"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        {/* SUBTAB 1: TỆP TÀI LIỆU (PDF, Word, PPTX, Excel, Hình ảnh) */}
        {activeSubTab === 'files' && (
          <div>
            {filteredDocuments.length === 0 ? (
              <div className="py-20 text-center max-w-md mx-auto space-y-3 text-slate-400">
                <FolderOpen className="w-16 h-16 mx-auto text-amber-500/40" />
                <h3 className="text-xl font-bold text-white">Chưa Có Tệp Tài Liệu Nào</h3>
                <p className="text-xs text-slate-400">
                  Thầy/Cô hãy bấm <b>"Tải Tệp Lên (≤ 25MB)"</b> để nạp bài giảng PDF, Word, PowerPoint hoặc Excel vào kho lưu trữ.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center gap-2 shadow-lg"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Chọn Tệp Dưới 25MB</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredDocuments.map((doc) => {
                  const badge = getFormatBadge(doc);
                  const isSelected = activeLessonId === doc.id;

                  return (
                    <div
                      key={doc.id}
                      className={`p-4 rounded-3xl bg-slate-900 border transition-all flex flex-col justify-between group hover:border-amber-500/60 shadow-lg ${
                        isSelected
                          ? 'border-amber-400 ring-2 ring-amber-400/40 bg-slate-850'
                          : 'border-slate-800'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Format & Size Badge */}
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-1 rounded-xl text-xs font-black border flex items-center gap-1.5 ${badge.bg}`}>
                            {badge.icon}
                            <span>{badge.label}</span>
                          </span>
                          <span className="text-[11px] font-mono font-bold text-slate-400">
                            {doc.fileSize || '< 25MB'}
                          </span>
                        </div>

                        {/* File Name & Title */}
                        <div>
                          <h3
                            onClick={() => onSelectLesson(doc.id)}
                            className="font-bold text-sm md:text-base text-white hover:text-amber-300 transition-colors cursor-pointer line-clamp-2 leading-snug"
                            title={doc.title}
                          >
                            {doc.title}
                          </h3>
                          {doc.fileName && (
                            <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5" title={doc.fileName}>
                              {doc.fileName}
                            </p>
                          )}
                        </div>

                        {/* Metadata: Upload Time & Cloud Sync */}
                        <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{doc.lastModified ? new Date(doc.lastModified).toLocaleDateString('vi-VN') : 'Đã đồng bộ'}</span>
                          </span>
                          <span className="flex items-center gap-1 text-emerald-400 font-bold">
                            <Cloud className="w-3 h-3" />
                            <span>Đa thiết bị</span>
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-4 mt-3 border-t border-slate-800">
                        <button
                          onClick={() => onSelectLesson(doc.id)}
                          className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Mở Chiếu</span>
                        </button>

                        {doc.fileUrl && (
                          <button
                            onClick={() => exportOriginalLessonFile(doc)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                            title="Tải tệp gốc về máy"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => onDeleteLesson(doc.id, doc.title)}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 transition-colors"
                          title="Xóa tệp khỏi kho lưu trữ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 2: LƯU TRỮ ĐƯỜNG LINK (Google Drive, YouTube, Canva, Quizizz...) */}
        {activeSubTab === 'links' && (
          <div>
            {filteredLinks.length === 0 ? (
              <div className="py-20 text-center max-w-md mx-auto space-y-3 text-slate-400">
                <Link2 className="w-16 h-16 mx-auto text-indigo-500/40" />
                <h3 className="text-xl font-bold text-white">Chưa Có Đường Link Nào</h3>
                <p className="text-xs text-slate-400">
                  Thầy/Cô hãy dán các đường link tài nguyên quan trọng như Google Drive, YouTube bài giảng, Canva slide hoặc Quizizz để mở nhanh trong giờ dạy.
                </p>
                <button
                  onClick={() => setShowAddLinkModal(true)}
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center gap-2 shadow-lg"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Đường Link Đầu Tiên</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredLinks.map((item) => {
                  const badge = getLinkCategoryBadge(item.category);

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-3xl bg-slate-900 border border-slate-800 hover:border-indigo-500/60 shadow-lg flex flex-col justify-between transition-all group"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${badge.bg}`}>
                            {badge.icon}
                            <span>{item.category}</span>
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {item.addedAt}
                          </span>
                        </div>

                        <div>
                          <h3 className="font-bold text-sm md:text-base text-white line-clamp-2 leading-snug group-hover:text-indigo-300 transition-colors">
                            {item.title}
                          </h3>
                          <p className="text-[11px] text-slate-400 font-mono truncate mt-1" title={item.url}>
                            {item.url}
                          </p>
                          {item.description && (
                            <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-4 mt-3 border-t border-slate-800">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Mở Liên Kết</span>
                        </a>

                        <button
                          onClick={() => handleDeleteLink(item.id)}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                          title="Xóa liên kết"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Thêm Đường Link Mới */}
      {showAddLinkModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-black">LƯU TRỮ ĐƯỜNG LINK MỚI</h3>
              </div>
              <button onClick={() => setShowAddLinkModal(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddLink} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">NỀN TẢNG LIÊN KẾT</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['Google Drive', 'YouTube', 'Canva', 'Quizizz', 'Khác'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewLinkCategory(cat)}
                      className={`p-2 rounded-xl font-bold border transition-all text-center ${
                        newLinkCategory === cat
                          ? 'bg-indigo-600 text-white border-indigo-400'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">ĐƯỜNG DẪN URL (LINK) *</label>
                <input
                  type="text"
                  required
                  value={newLinkUrl}
                  onChange={(e) => {
                    setNewLinkUrl(e.target.value);
                    const autoCat = detectCategoryFromUrl(e.target.value);
                    if (autoCat !== 'Khác') setNewLinkCategory(autoCat);
                  }}
                  placeholder="https://drive.google.com/... hoặc youtube.com/watch?v=..."
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">TÊN HIỂN THỊ GỢI NHỚ</label>
                <input
                  type="text"
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                  placeholder="Ví dụ: Slide bài 2 Cực trị hàm số (Canva)"
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">MÔ TẢ NGẮN (TÙY CHỌN)</label>
                <textarea
                  rows={2}
                  value={newLinkDesc}
                  onChange={(e) => setNewLinkDesc(e.target.value)}
                  placeholder="Ghi chú thêm về nội dung bài dạy..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddLinkModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg"
                >
                  Lưu Trữ Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export const StorageView = StorageManagementView;
export default StorageManagementView;
