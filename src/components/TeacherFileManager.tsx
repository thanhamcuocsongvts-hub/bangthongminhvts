import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, storage } from '../lib/firebase';
import { File, Upload, Trash2, Loader2, Play } from 'lucide-react';
import { LessonDoc } from '../types';

export const TeacherFileManager: React.FC<{ onSelectFile?: (lesson: LessonDoc) => void }> = ({ onSelectFile }) => {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const fetchFiles = async (user) => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const q = query(collection(db, 'TaiLieuGiaoVien'), where('uid', '==', user.uid));
      const querySnapshot = await getDocs(q);
      const docs = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setFiles(docs.sort((a: any, b: any) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    } catch (err) {
      console.error('Error fetching files:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchFiles(user);
      } else {
        setFiles([]);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !auth.currentUser) return;
    const file = e.target.files[0];
    
    // Upload limit around 5MB
    if (file.size > 10 * 1024 * 1024) {
      alert("Kích thước file quá lớn. Vui lòng chọn file nhỏ hơn 10MB.");
      return;
    }

    const storageRef = ref(storage, `TaiLieuGiaoVien/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    setUploading(true);
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(p);
      },
      (error) => {
        console.error('Upload failed:', error);
        setUploading(false);
        alert('Tải lên thất bại');
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await addDoc(collection(db, 'TaiLieuGiaoVien'), {
            uid: auth.currentUser?.uid,
            name: file.name,
            url: downloadURL,
            size: file.size,
            type: file.type || file.name.split('.').pop(),
            createdAt: Timestamp.now()
          });
          setUploading(false);
          setProgress(0);
          fetchFiles(auth.currentUser);
        } catch (error) {
          console.error("Error saving doc:", error);
          setUploading(false);
        }
      }
    );
  };

  const handleDelete = async (fileId: string, url: string) => {
    if (!window.confirm("Bạn có chắc muốn xóa file này?")) return;
    try {
      await deleteDoc(doc(db, 'TaiLieuGiaoVien', fileId));
      try {
        const fileRef = ref(storage, url);
        await deleteObject(fileRef);
      } catch (e) {
        console.log("File possibly already deleted from storage");
      }
      setFiles(files.filter(f => f.id !== fileId));
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  return (
    <div className="bg-slate-900 rounded-3xl p-6 border-2 border-slate-800 flex flex-col h-[500px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <File className="w-6 h-6 text-indigo-400" />
          Tài Liệu Giáo Viên
        </h3>
        <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 transition-colors">
          <Upload className="w-5 h-5" />
          {uploading ? `Đang tải ${Math.round(progress)}%` : 'Tải Lên File'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} accept=".pdf,.doc,.docx,.ppt,.pptx" />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : files.length === 0 ? (
          <div className="text-center text-slate-500 py-10">
            Chưa có tài liệu nào được tải lên.
          </div>
        ) : (
          files.map(f => (
            <div key={f.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/50 border border-slate-700/50 hover:bg-slate-800 transition-colors">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                  <File className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="truncate">
                  <h4 className="text-sm font-semibold text-white truncate max-w-[200px]" title={f.name}>{f.name}</h4>
                  <p className="text-xs text-slate-400">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onSelectFile && (
                  <button 
                    onClick={() => {
                      const ext = f.name.split('.').pop()?.toLowerCase() || '';
                      onSelectFile({
                        id: f.id,
                        title: f.name,
                        fileName: f.name,
                        fileSize: `${(f.size / 1024 / 1024).toFixed(2)} MB`,
                        source: 'cloud',
                        fileUrl: f.url,
                        fileType: ext === 'pdf' ? 'pdf' : ['ppt', 'pptx'].includes(ext) ? 'pptx' : ['doc', 'docx'].includes(ext) ? 'docx' : 'other',
                        rawText: '',
                        subject: 'Khác',
                        grade: 'Mọi lớp',
                        lastModified: new Date().toISOString(),
                        syncedToCloud: true,
                        author: 'Giáo viên',
                        slides: [],
                        quizzes: []
                      } as any);
                    }}
                    className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors"
                    title="Mở Trình Chiếu"
                  >
                    <Play className="w-5 h-5" />
                  </button>
                )}
                <button 
                  onClick={() => handleDelete(f.id, f.url)}
                  className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
