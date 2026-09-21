import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth, db, storage } from '../lib/firebase';
import { File, Upload, Trash2, Loader2, Play, CloudCheck, RefreshCw, X } from 'lucide-react';
import { LessonDoc } from '../types';
import { parseUploadedFileToLesson } from '../utils/fileParser';

export const TeacherFileManager: React.FC<{ onSelectFile?: (lesson: LessonDoc) => void }> = ({ onSelectFile }) => {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [fileToDelete, setFileToDelete] = useState<any | null>(null);

  const fetchFiles = async () => {
    setLoading(true);
    const combinedFiles = new Map<string, any>();

    // 1. Fetch from server Cloud Documents API (/api/documents)
    try {
      const serverRes = await fetch('/api/documents');
      if (serverRes.ok) {
        const serverData = await serverRes.json();
        if (serverData && Array.isArray(serverData.documents)) {
          serverData.documents.forEach((d: any) => {
            const key = d.uniqueFileName || d.fileName || d.id;
            combinedFiles.set(key, {
              id: d.id,
              name: d.fileName,
              url: d.fileUrl,
              size: typeof d.fileSize === 'string' ? parseFloat(d.fileSize) * 1024 * 1024 : (d.fileSize || 0),
              sizeFormatted: d.fileSize,
              type: d.fileType,
              source: 'cloud-server',
              createdAt: d.uploadedAt ? new Date(d.uploadedAt).getTime() : Date.now(),
            });
          });
        }
      }
    } catch (apiErr) {
      console.warn('Server /api/documents fetch notice:', apiErr);
    }

    // 2. Fetch from Firestore TaiLieuGiaoVien collection
    try {
      const querySnapshot = await getDocs(collection(db, 'TaiLieuGiaoVien'));
      querySnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const key = data.name || docSnap.id;
        if (!combinedFiles.has(key)) {
          combinedFiles.set(key, {
            id: docSnap.id,
            name: data.name,
            url: data.url,
            size: data.size || 0,
            sizeFormatted: data.size ? `${(data.size / 1024 / 1024).toFixed(2)} MB` : '',
            type: data.type,
            source: 'firebase',
            createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          });
        }
      });
    } catch (fbErr) {
      console.warn('Firestore TaiLieuGiaoVien fetch notice:', fbErr);
    }

    const fileList = Array.from(combinedFiles.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    setFiles(fileList);
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
    const unsubscribe = onAuthStateChanged(auth, () => {
      fetchFiles();
    });
    return () => unsubscribe();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    
    // Upload limit 100MB
    if (file.size > 100 * 1024 * 1024) {
      alert("Kích thước file quá lớn. Vui lòng chọn file nhỏ hơn 100MB.");
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      // 1. Read Base64
      const base64Data: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setProgress(40);

      // 2. Upload to Cloud Server API
      let fileUrl = '';
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      try {
        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileType: ext,
            base64Data,
            fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
          }),
        });
        if (res.ok) {
          const resData = await res.json();
          fileUrl = resData.fileUrl;
        }
      } catch (uploadErr) {
        console.warn('Local cloud upload error:', uploadErr);
      }

      setProgress(75);

      // 3. Try Firebase Storage & Firestore
      try {
        let currentUser = auth.currentUser;
        if (!currentUser) {
          try {
            const userCred = await signInAnonymously(auth);
            currentUser = userCred.user;
          } catch {}
        }
        if (currentUser) {
          const storageRef = ref(storage, `TaiLieuGiaoVien/${currentUser.uid}/${Date.now()}_${file.name}`);
          const uploadTask = uploadBytesResumable(storageRef, file);
          uploadTask.on('state_changed', (snap) => {
            const p = 75 + ((snap.bytesTransferred / snap.totalBytes) * 20);
            setProgress(p);
          });
          await uploadTask;
          const fbUrl = await getDownloadURL(storageRef);
          if (!fileUrl) fileUrl = fbUrl;

          await addDoc(collection(db, 'TaiLieuGiaoVien'), {
            uid: currentUser.uid,
            name: file.name,
            url: fbUrl || fileUrl,
            size: file.size,
            type: ext,
            createdAt: Timestamp.now(),
          });
        }
      } catch (fbErr) {
        console.warn('Firebase document save notice:', fbErr);
      }

      setProgress(100);
      setUploading(false);
      await fetchFiles();
    } catch (err: any) {
      console.error('Upload failed:', err);
      alert('Tải lên thất bại: ' + (err.message || 'Lỗi mạng'));
      setUploading(false);
    }
  };

  const handleOpenDoc = async (f: any) => {
    if (!onSelectFile) return;
    setOpeningId(f.id);

    try {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      // Fetch the actual file blob from URL so fileParser can extract full slides & math
      const response = await fetch(f.url);
      const blob = await response.blob();
      const reconstructedFile = new window.File([blob], f.name, { type: blob.type });

      const parsedDoc = await parseUploadedFileToLesson(reconstructedFile, 'Giáo viên');
      parsedDoc.fileUrl = f.url;
      parsedDoc.syncedToCloud = true;
      onSelectFile(parsedDoc);
    } catch (e) {
      console.warn('Direct parse notice, using metadata lesson:', e);
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      onSelectFile({
        id: f.id,
        title: f.name,
        fileName: f.name,
        fileSize: f.sizeFormatted || `${(f.size / 1024 / 1024).toFixed(2)} MB`,
        source: 'cloud',
        fileUrl: f.url,
        fileType: ext === 'pdf' ? 'pdf' : ['ppt', 'pptx'].includes(ext) ? 'pptx' : ['doc', 'docx'].includes(ext) ? 'docx' : 'other',
        rawText: `Tài liệu từ Đám Mây: ${f.name}\nĐã sẵn sàng trình chiếu trên Tivi 75 inch.`,
        subject: 'Khác',
        grade: 'Mọi lớp',
        lastModified: new Date().toISOString(),
        syncedToCloud: true,
        author: 'Giáo viên',
        slides: [],
        quizzes: [],
      } as any);
    } finally {
      setOpeningId(null);
    }
  };

  const handleDelete = async (fileId: string, url: string) => {
    try {
      // 1. Delete from server API
      try {
        await fetch(`/api/documents/${fileId}`, { method: 'DELETE' });
      } catch {}

      // 2. Delete from Firestore if exists
      try {
        await deleteDoc(doc(db, 'TaiLieuGiaoVien', fileId));
      } catch {}

      // 3. Delete from Firebase Storage if URL matches
      try {
        if (url && url.includes('firebasestorage')) {
          const fileRef = ref(storage, url);
          await deleteObject(fileRef);
        }
      } catch {}

      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  return (
    <div className="bg-slate-900 rounded-3xl p-6 border-2 border-slate-800 flex flex-col h-[520px] shadow-2xl">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <File className="w-6 h-6 text-indigo-400" />
            Kho Tài Liệu Đám Mây (Cloud Repository)
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Đồng bộ tự động giữa Máy tính cá nhân, Điện thoại và Tivi 75" phòng học
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchFiles}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 transition-all shadow-lg hover:shadow-indigo-500/25">
            <Upload className="w-5 h-5" />
            {uploading ? `Đang tải ${Math.round(progress)}%` : 'Tải Lên Đám Mây'}
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} accept=".pdf,.doc,.docx,.ppt,.pptx,.xlsx,.xls" />
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2.5">
        {loading ? (
          <div className="flex flex-col justify-center items-center h-48 gap-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <span className="text-xs text-slate-400 font-mono">Đang đồng bộ kho bài giảng đám mây...</span>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center text-slate-400 py-16 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Upload className="w-8 h-8" />
            </div>
            <p className="font-semibold text-slate-300">Chưa có tài liệu nào trong kho đám mây.</p>
            <p className="text-xs text-slate-500 max-w-sm">
              Thầy/Cô hãy bấm "Tải Lên Đám Mây" để lưu trữ file PowerPoint (.pptx), Word (.docx), PDF. File sẽ tự động xuất hiện trên mọi máy tính và Tivi 75 inch!
            </p>
          </div>
        ) : (
          files.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 hover:border-indigo-500/40 transition-all group"
            >
              <div className="flex items-center gap-3.5 overflow-hidden">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                  <File className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white truncate max-w-[260px] md:max-w-md" title={f.name}>
                      {f.name}
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                      Cloud Sync
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {f.sizeFormatted || (f.size ? `${(f.size / 1024 / 1024).toFixed(2)} MB` : 'Cloud File')} • {new Date(f.createdAt || Date.now()).toLocaleDateString('vi-VN')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onSelectFile && (
                  <button
                    onClick={() => handleOpenDoc(f)}
                    disabled={openingId === f.id}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold font-mono shadow-sm"
                    title="Mở Trình Chiếu / Đọc Bài Giảng"
                  >
                    {openingId === f.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    <span>{openingId === f.id ? 'Đang mở...' : 'Trình Chiếu'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFileToDelete(f)}
                  className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
                  title="Xóa tệp khỏi đám mây"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Xác nhận xóa tệp đám mây */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Xóa Tệp Khỏi Đám Mây</h3>
                  <p className="text-xs text-slate-400">Giải phóng dung lượng Cloud</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Bạn có chắc muốn xóa tài liệu <span className="font-bold text-white">"{fileToDelete.name}"</span> khỏi đám mây không?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-bold transition-all cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = fileToDelete;
                  setFileToDelete(null);
                  handleDelete(target.id, target.url);
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-md shadow-rose-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác Nhận Xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

