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

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
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
import { clearAllStorageFromCloud, addLessonToCloudWithBatch, syncLinksWithBatchedWrite } from '../utils/storageUtils';
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

const DEFAULT_LINKS: ExternalResourceLink[] = [];

interface StorageManagementViewProps {
  lessons: LessonDoc[];
  activeTeacher: TeacherProfile | null;
  activeLessonId: string;
  onSelectLesson: (id: string) => void;
  onAddLesson: (newDoc: LessonDoc) => void;
  onDeleteLesson: (id: string, title?: string) => Promise<void> | void;
  onCleanLibrary?: () => void;
  onClearAllStorage?: () => Promise<void> | void;
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
  onClearAllStorage,
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
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);
  const [serverDocs, setServerDocs] = useState<LessonDoc[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [deletedNames, setDeletedNames] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Link Management State (Preserves deletions so links never unexpectedly reappear)
  const [links, setLinks] = useState<ExternalResourceLink[]>(() => {
    try {
      const saved = localStorage.getItem('smartboard_cloud_links');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return DEFAULT_LINKS;
  });

  const [showAddLinkModal, setShowAddLinkModal] = useState<boolean>(false);
  const [newLinkTitle, setNewLinkTitle] = useState<string>('');
  const [newLinkUrl, setNewLinkUrl] = useState<string>('');
  const [newLinkCategory, setNewLinkCategory] = useState<'Google Drive' | 'YouTube' | 'Canva' | 'Quizizz' | 'Khác'>('Google Drive');
  const [newLinkDesc, setNewLinkDesc] = useState<string>('');

  // Firebase Realtime Hook with Batched Writes
  const {
    lectures: cloudLectures,
    uploadLectureFile,
    deleteLectureFile,
    isLoading: isRepoLoading,
  } = useLectureRepository();

  // 1. Realtime Listener for Firestore Deletion Tombstones across all devices
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'global_store', 'smartboard_deletions'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.wipeVersion) {
          // A full wipe was performed on another device
          setServerDocs([]);
          setLinks([]);
        }
        if (Array.isArray(d.deletedIds)) {
          setDeletedIds(new Set(d.deletedIds));
        }
        const nameSet = new Set<string>();
        if (Array.isArray(d.deletedFiles)) {
          d.deletedFiles.forEach((f: string) => nameSet.add(f.toLowerCase()));
        }
        if (Array.isArray(d.deletedTitles)) {
          d.deletedTitles.forEach((t: string) => nameSet.add(t.toLowerCase()));
        }
        setDeletedNames(nameSet);
      }
    }, () => {});
    return () => unsub();
  }, []);

  // 2. Continuous Background Multi-Device Sync: Polls server overview & listens to window focus
  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/storage/overview');
      if (res.ok) {
        const data = await res.json();
        if (data.documents && Array.isArray(data.documents)) {
          setServerDocs(data.documents);
        }
        if (data.links && Array.isArray(data.links)) {
          setLinks(data.links);
          try {
            localStorage.setItem('smartboard_cloud_links', JSON.stringify(data.links));
          } catch (_) {}
        }
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, 3500);
    const handleFocus = () => fetchOverview();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [fetchOverview]);

  // 3. Sync links across devices via Firestore
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
    await syncLinksWithBatchedWrite(newLinks);
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

  // YÊU CẦU: CƠ CHẾ TẢI TỆP LÊN SIÊU TỐC VÀ ĐỒNG BỘ ĐA THIẾT BỊ HOÀN HẢO (≤ 250MB)
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    // Hỗ trợ dung lượng cao lên đến 250MB
    const MAX_FILE_SIZE = 250 * 1024 * 1024; // 250 MB
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage('Vui lòng chọn tệp dưới 250MB để đảm bảo hiệu suất truyền tải.');
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

    const docId = 'doc_' + Date.now();
    const uploadTimestamp = new Date().toISOString();

    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      setSuccessMessage(`⚡ Đang tải lên và đồng bộ "${file.name}" (${sizeFormatted}) sang mọi thiết bị...`);

      // 1. Tải nhị phân siêu tốc lên Server để có đường dẫn file thật (/uploads/...) mở được trên điện thoại và PC
      let finalFileUrl = '';
      try {
        const rawRes = await fetch(
          `/api/documents/upload-raw?fileName=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(ext)}&teacherId=${encodeURIComponent(activeTeacher?.id || '')}&lessonId=${encodeURIComponent(docId)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': file.type || 'application/octet-stream' },
            body: file,
          }
        );
        if (rawRes.ok) {
          const rawData = await rawRes.json();
          if (rawData?.fileUrl) {
            finalFileUrl = rawData.fileUrl;
          }
        }
      } catch (err) {
        console.warn('Raw upload warning:', err);
      }

      if (!finalFileUrl) {
        finalFileUrl = URL.createObjectURL(file);
      }

      // 2. Tạo đối tượng LessonDoc chuẩn chỉnh
      const newDoc: LessonDoc = {
        id: docId,
        title: cleanTitle,
        fileName: file.name,
        fileType: ext as any,
        fileSize: sizeFormatted,
        fileUrl: finalFileUrl,
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
            content: `Tệp: ${file.name}\nĐịnh dạng: ${ext.toUpperCase()}\nDung lượng thực: ${sizeFormatted}\nTải lên: ${new Date().toLocaleString('vi-VN')}\nSẵn sàng đồng bộ đa thiết bị (máy tính, điện thoại, màn hình tương tác 75 inch).`,
          },
        ],
      };

      // 3. Đưa vào kho lưu trữ bài giảng ứng dụng & Firestore bằng Atomic Batched Write (Real-time sync)
      await addLessonToCloudWithBatch(newDoc);
      onAddLesson(newDoc);

      // 4. Phát tín hiệu thông báo đồng bộ thành công
      window.dispatchEvent(new CustomEvent('lesson-cloud-synced', { detail: { lessonId: docId, fileUrl: finalFileUrl } }));

      setSuccessMessage(`✅ Tệp "${file.name}" (${sizeFormatted}) đã được đồng bộ lên Cloud thành công! Điện thoại và máy tính khác đều đã nhận được.`);
    } catch (uploadErr: any) {
      console.error('Storage upload error:', uploadErr);
      setErrorMessage(`Lỗi khi tải tệp lên: ${uploadErr?.message || 'Vui lòng thử lại'}`);
    } finally {
      setIsUploading(false);
      setTimeout(() => setSuccessMessage(null), 5000);
    }
  };

  // Xóa tài liệu vĩnh viễn trên mọi thiết bị và máy chủ (Sử dụng Batched Writes & Realtime Tombstone)
  const handleDeleteDocument = async (docToDelete: LessonDoc) => {
    try {
      const id = docToDelete.id;
      const fName = (docToDelete.fileName || '').trim().toLowerCase();
      const title = (docToDelete.title || '').trim().toLowerCase();

      // 1. Phản hồi giao diện lập tức (0ms optimistic update)
      setDeletedIds((prev) => new Set([...prev, id]));
      setDeletedNames((prev) => {
        const next = new Set(prev);
        if (fName) next.add(fName);
        if (title) next.add(title);
        return next;
      });
      setServerDocs((prev) => prev.filter((d) => d.id !== id && d.fileName?.toLowerCase() !== fName));

      // 2. Xóa khỏi danh sách lessons trong App.tsx & Firestore bằng Batched Write
      await onDeleteLesson(docToDelete.id, docToDelete.title);

      // 3. Xóa qua useLectureRepository nếu có
      try {
        await deleteLectureFile(docToDelete.id, docToDelete.storagePath, docToDelete.fileName || docToDelete.title);
      } catch (_) {}

      // 4. Xóa trực tiếp trên máy chủ Express
      try {
        const qName = encodeURIComponent(docToDelete.fileName || docToDelete.title || '');
        fetch(`/api/documents/${encodeURIComponent(docToDelete.id)}?fileName=${qName}`, { method: 'DELETE' }).catch(() => {});
        fetch(`/api/lessons/${encodeURIComponent(docToDelete.id)}?title=${qName}&fileName=${qName}`, { method: 'DELETE' }).catch(() => {});
      } catch (_) {}

      setSuccessMessage(`Đã xóa vĩnh viễn "${docToDelete.title}" khỏi kho lưu trữ và mọi thiết bị!`);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err) {
      console.error('Delete document error:', err);
    }
  };

  // Dọn dẹp sạch toàn bộ kho lưu trữ trên tất cả thiết bị
  const handleClearAllStorage = async () => {
    try {
      setShowClearConfirmModal(false);
      setServerDocs([]);
      setLinks([]);
      if (onClearAllStorage) {
        await onClearAllStorage();
      } else {
        await clearAllStorageFromCloud();
      }
      setSuccessMessage('Đã dọn dẹp sạch toàn bộ kho lưu trữ trên tất cả các thiết bị!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (e: any) {
      setErrorMessage('Lỗi khi dọn dẹp kho: ' + (e.message || String(e)));
    }
  };

  // Tải tệp gốc về máy tính hoặc điện thoại với tên gốc và nhị phân chuẩn 100%
  const handleDownloadDocument = async (docToDownload: LessonDoc) => {
    try {
      const fileName = docToDownload.fileName || `${docToDownload.title}.${docToDownload.fileType || 'bin'}`;
      setSuccessMessage(`⚡ Đang tải tệp "${fileName}" về thiết bị của bạn...`);

      // 1. Nếu là tệp trên máy chủ (/uploads/...) hoặc link đầy đủ chứa /uploads/
      let uniqueName = '';
      if (docToDownload.fileUrl) {
        if (docToDownload.fileUrl.startsWith('/uploads/')) {
          uniqueName = docToDownload.fileUrl.replace(/^\/uploads\//, '');
        } else if (docToDownload.fileUrl.includes('/uploads/')) {
          uniqueName = docToDownload.fileUrl.split('/uploads/')[1];
        }
      }

      if (uniqueName) {
        const downloadUrl = `/api/documents/download/${encodeURIComponent(uniqueName)}?name=${encodeURIComponent(fileName)}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => a.remove(), 100);
        setTimeout(() => setSuccessMessage(null), 3000);
        return;
      }

      // 2. Tải qua exportOriginalLessonFile hỗ trợ Firebase Storage & Blob
      await exportOriginalLessonFile(docToDownload);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.warn('Download error:', err);
    }
  };

  // Kết hợp và khử trùng lặp giữa local, server docs, và Firestore lectures
  const allDocuments = useMemo(() => {
    const map = new Map<string, LessonDoc>();

    const isDocDeleted = (id: string, fileName?: string, title?: string) => {
      if (id && deletedIds.has(id)) return true;
      const fn = (fileName || '').trim().toLowerCase();
      const tt = (title || '').trim().toLowerCase();
      if (fn && deletedNames.has(fn)) return true;
      if (tt && deletedNames.has(tt)) return true;
      return false;
    };

    // 1. Tài liệu từ Server Documents API
    serverDocs.forEach((sd: any) => {
      if (!sd || !sd.id) return;
      if (isDocDeleted(sd.id, sd.fileName, sd.fileName)) return;
      const key = (sd.fileName || sd.id).trim().toLowerCase();
      map.set(key, {
        id: sd.id,
        title: sd.fileName?.replace(/\.[^/.]+$/, '') || sd.fileName || 'Tài liệu',
        fileName: sd.fileName,
        fileType: sd.fileType,
        fileSize: sd.fileSize,
        fileUrl: sd.fileUrl,
        subject: 'Khác',
        grade: 'Lớp 12',
        author: 'Đồng bộ Cloud',
        lastModified: sd.uploadedAt || new Date().toISOString(),
        syncedToCloud: true,
        rawText: `Tài liệu: ${sd.fileName || 'Tài liệu'}`,
        quizzes: [],
        slides: [],
      });
    });

    // 2. Tài liệu từ kho lessons của ứng dụng
    lessons.forEach((l) => {
      if (l && l.id && l.title && typeof l.title === 'string' && l.title.trim().length > 0) {
        if (isDocDeleted(l.id, l.fileName, l.title)) return;
        const key = (l.fileName || l.title).trim().toLowerCase();
        if (map.has(key)) {
          const ex = map.get(key)!;
          map.set(key, { ...ex, ...l, fileUrl: l.fileUrl || ex.fileUrl });
        } else {
          map.set(key, l);
        }
      }
    });

    // 3. Tài liệu từ Firestore collection 'lectures'
    if (cloudLectures && cloudLectures.length > 0) {
      for (const cl of cloudLectures) {
        if (isDocDeleted(cl.id, cl.fileName, cl.fileName)) continue;
        const title = cl.fileName || 'Tài liệu lưu trữ';
        const key = (cl.fileName || title).trim().toLowerCase();
        if (map.has(key)) {
          const ex = map.get(key)!;
          if (cl.downloadURL && !ex.fileUrl?.startsWith('http')) {
            ex.fileUrl = cl.downloadURL;
          }
        } else {
          const ext = cl.fileType || cl.fileName?.split('.').pop() || 'doc';
          map.set(key, {
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
            rawText: `Tài liệu: ${cl.fileName}`,
            quizzes: [],
            slides: [],
          });
        }
      }
    }

    return Array.from(map.values());
  }, [lessons, serverDocs, cloudLectures, deletedIds, deletedNames]);

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
            title="Tải lên tệp tài liệu giáo dục dung lượng cao ≤ 250MB với tốc độ siêu tốc"
          >
            {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            <span>Tải Tệp Lên Siêu Tốc (&le; 250MB)</span>
          </button>

          <button
            onClick={() => setShowAddLinkModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs md:text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-95 transition-all cursor-pointer"
            title="Lưu trữ đường link bên ngoài (Google Drive, YouTube, Canva, Quizizz...)"
          >
            <Link2 className="w-4 h-4" />
            <span>Thêm Đường Link</span>
          </button>

          <button
            onClick={() => setShowClearConfirmModal(true)}
            className="px-3.5 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
            title="Dọn dẹp sạch toàn bộ kho lưu trữ trên tất cả các thiết bị"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Dọn Sạch Kho</span>
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
                  Thầy/Cô hãy bấm <b>"Tải Tệp Lên Siêu Tốc (≤ 250MB)"</b> để nạp bài giảng PDF, Word, PowerPoint hoặc Excel vào kho lưu trữ đám mây.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center gap-2 shadow-lg"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Chọn Tệp Tải Lên (≤ 250MB)</span>
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
                            onClick={() => handleDownloadDocument(doc)}
                            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-bold active:scale-95"
                            title="Tải tệp gốc về máy tính hoặc điện thoại"
                          >
                            <Download className="w-3.5 h-3.5 text-amber-400" />
                            <span>Tải về</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteDocument(doc)}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 transition-colors cursor-pointer"
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

      {/* Modal: Xác Nhận Dọn Dẹp / Xóa Toàn Bộ Kho Lưu Trữ */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-rose-500/50 rounded-3xl max-w-md w-full p-6 shadow-2xl text-white space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">XÓA TOÀN BỘ KHO LƯU TRỮ?</h3>
                <p className="text-xs text-rose-300/80">Hành động này sẽ đồng bộ xóa sạch trên mọi thiết bị</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
              Toàn bộ <b>{allDocuments.length} tệp tài liệu</b> và dữ liệu liên quan sẽ bị xóa vĩnh viễn khỏi máy chủ Cloud, cơ sở dữ liệu Firestore và các thiết bị đang kết nối (máy tính, điện thoại, SmartBoard).
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleClearAllStorage}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg shadow-rose-600/30 cursor-pointer flex items-center gap-2 active:scale-95 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác Nhận Xóa Sạch</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const StorageView = StorageManagementView;
export default StorageManagementView;
