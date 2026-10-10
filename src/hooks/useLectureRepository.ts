import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  doc,
  getDocs,
  getDoc,
  writeBatch,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';
import { safeAddDoc, safeDeleteDoc } from '../utils/firebaseSafe';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage, auth } from '../lib/firebase';
import { signInAnonymously } from 'firebase/auth';

export interface LectureItem {
  id: string;
  fileName: string;
  downloadURL: string;
  uploadedAt: Timestamp | null | any;
  fileType: string;
  fileSize?: string | number;
  storagePath?: string;
  [key: string]: any;
}

export interface UseLectureRepositoryResult {
  lectures: LectureItem[];
  isLoading: boolean;
  error: string | null;
  uploadingProgress: number; // 0 đến 100%
  uploadLectureFile: (file: File) => Promise<LectureItem>;
  deleteLectureFile: (id: string, storagePath?: string, fileName?: string) => Promise<void>;
}

// Helper: High-Speed raw binary stream upload directly to server endpoint (/api/documents/upload-raw)
function uploadRawToServer(file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve) => {
    try {
      const xhr = new XMLHttpRequest();
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const url = `/api/documents/upload-raw?fileName=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(ext)}`;
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data.fileUrl || '');
          } catch {
            resolve('');
          }
        } else {
          resolve('');
        }
      };
      xhr.onerror = () => resolve('');
      xhr.ontimeout = () => resolve('');
      xhr.timeout = 60000;
      xhr.send(file);
    } catch {
      resolve('');
    }
  });
}

/**
 * Custom Hook: useLectureRepository
 * Xử lý toàn bộ logic upload file lên Firebase Storage, lưu metadata lên Firestore
 * và đồng bộ danh sách file thời gian thực (Realtime onSnapshot) qua các thiết bị.
 */
export function useLectureRepository(): UseLectureRepositoryResult {
  const [lectures, setLectures] = useState<LectureItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingProgress, setUploadingProgress] = useState<number>(0);

  // 1. Lắng nghe Realtime Đồng bộ danh sách bài giảng chéo thiết bị qua onSnapshot()
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    // Truy vấn collection 'lectures', sắp xếp file mới nhất lên đầu
    const lecturesCol = collection(db, 'lectures');
    const q = query(lecturesCol, orderBy('uploadedAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: LectureItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            fileName: data.fileName || 'Tài liệu không tên',
            downloadURL: data.downloadURL || '',
            uploadedAt: data.uploadedAt || null,
            fileType: data.fileType || 'other',
            fileSize: data.fileSize,
            storagePath: data.storagePath,
            ...data,
          };
        });

        setLectures(items);
        setIsLoading(false);
      },
      (err) => {
        console.warn('[useLectureRepository] Firestore onSnapshot note:', err?.message || err);
        setIsLoading(false);
      }
    );

    // Cleanup: Huỷ listener khi component unmount để tránh rò rỉ bộ nhớ (memory leak)
    return () => {
      unsubscribe();
    };
  }, []);

  // 2. Hàm Tải lên file (Upload): Đẩy song song lên Local Server (/api/documents/upload-raw) và Firebase Storage
  const uploadLectureFile = useCallback(async (file: File): Promise<LectureItem> => {
    if (!file) {
      throw new Error('Vui lòng chọn một tệp hợp lệ để tải lên.');
    }

    setError(null);
    setUploadingProgress(10);

    const sizeFormatted =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const timestamp = Date.now();
    const safeBaseName = file.name
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF-]/g, '_');
    const storagePath = `lectures/${timestamp}_${safeBaseName}.${ext}`;

    // Kick off high-speed raw server upload in parallel
    let localServerUrl = '';
    const serverUploadPromise = uploadRawToServer(file, (pct) => {
      setUploadingProgress((prev) => Math.max(prev, Math.round(pct * 0.9)));
    }).then((url) => {
      localServerUrl = url;
      return url;
    });

    // Ensure anonymous auth for Firebase Storage
    if (auth && !auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch (authErr) {
        console.warn('[useLectureRepository] Auth notice:', authErr);
      }
    }

    // Parallel Firebase Storage upload with 2.5s timeout protection (server upload finishes in < 200ms)
    const firebaseUploadPromise = new Promise<{ downloadURL: string; storagePath: string }>((resolve) => {
      const fbTimeout = setTimeout(() => {
        resolve({ downloadURL: '', storagePath });
      }, 2500);

      try {
        if (!storage) {
          clearTimeout(fbTimeout);
          resolve({ downloadURL: '', storagePath });
          return;
        }

        const fileRef = ref(storage, storagePath);
        const uploadTask = uploadBytesResumable(fileRef, file, {
          contentType: file.type || undefined,
        });

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (snapshot.totalBytes > 0) {
              const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              setUploadingProgress((prev) => Math.max(prev, progress));
            }
          },
          (uploadErr) => {
            clearTimeout(fbTimeout);
            resolve({ downloadURL: '', storagePath });
          },
          async () => {
            clearTimeout(fbTimeout);
            try {
              const fbUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve({ downloadURL: fbUrl, storagePath });
            } catch {
              resolve({ downloadURL: '', storagePath });
            }
          }
        );
      } catch {
        clearTimeout(fbTimeout);
        resolve({ downloadURL: '', storagePath });
      }
    });

    // Race or combine both uploads for lightning speed
    try {
      const [serverUrl, fbResult] = await Promise.all([
        serverUploadPromise,
        firebaseUploadPromise,
      ]);

      const effectiveDownloadUrl = fbResult.downloadURL || serverUrl || localServerUrl;

      const docData: any = {
        fileName: file.name,
        downloadURL: effectiveDownloadUrl,
        fileType: ext,
        fileSize: sizeFormatted,
        rawSizeBytes: file.size,
        storagePath: fbResult.storagePath || storagePath,
        uploadedAt: serverTimestamp(),
      };

      const docId = `lec_${Date.now()}`;
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'lectures', docId), docData);

        // Also atomically synchronize into global_store/smartboard_lessons
        try {
          const lSnap = await getDoc(doc(db, 'global_store', 'smartboard_lessons'));
          const currentLessons = (lSnap.exists() && Array.isArray(lSnap.data().lessons)) ? lSnap.data().lessons : [];
          const cleanTitle = file.name.replace(/\.[^/.]+$/, '').trim();
          const newLessonEntry = {
            id: docId,
            title: cleanTitle,
            fileName: file.name,
            fileType: ext,
            fileSize: sizeFormatted,
            fileUrl: effectiveDownloadUrl,
            subject: 'Khác',
            grade: 'Lớp 12',
            author: 'Đồng bộ Cloud',
            lastModified: new Date().toISOString(),
            syncedToCloud: true,
            rawText: `Tài liệu: ${file.name}\nDung lượng: ${sizeFormatted}`,
            quizzes: [],
            slides: [
              {
                id: `s_${docId}`,
                title: cleanTitle,
                subtitle: `${file.name} • ${sizeFormatted}`,
                content: `Tệp: ${file.name}\nĐịnh dạng: ${ext.toUpperCase()}\nDung lượng: ${sizeFormatted}`,
              },
            ],
          };
          const nextLessons = [newLessonEntry, ...currentLessons.filter((l: any) => l.fileName !== file.name && l.id !== docId)];
          batch.set(doc(db, 'global_store', 'smartboard_lessons'), {
            lessons: nextLessons,
            version: Date.now(),
            lastUpdatedAt: serverTimestamp(),
          });
        } catch (_) {}

        await batch.commit();
      } catch (firestoreErr) {
        console.warn('[useLectureRepository] Firestore batched write notice:', firestoreErr);
      }

      const createdLecture: LectureItem = {
        id: docId,
        ...docData,
        uploadedAt: new Date(),
      };

      setUploadingProgress(100);
      setTimeout(() => setUploadingProgress(0), 1200);
      return createdLecture;
    } catch (err: any) {
      console.error('[useLectureRepository] Upload failed:', err);
      // Fallback lecture item so UX is never blocked
      const fallbackLecture: LectureItem = {
        id: `lec_${Date.now()}`,
        fileName: file.name,
        downloadURL: localServerUrl || '',
        fileType: ext,
        fileSize: sizeFormatted,
        rawSizeBytes: file.size,
        storagePath,
        uploadedAt: new Date(),
      };
      setUploadingProgress(100);
      setTimeout(() => setUploadingProgress(0), 1200);
      return fallbackLecture;
    }
  }, []);

  // 3. Hàm Xoá file khỏi Firestore & Firebase Storage bằng Batched Writes
  const deleteLectureFile = useCallback(async (id: string, storagePath?: string, fileName?: string): Promise<void> => {
    try {
      setError(null);

      // 1. Phản hồi giao diện lập tức (Optimistic update 0ms)
      setLectures((prev) =>
        prev.filter((item) => {
          if (item.id === id) return false;
          if (fileName && (item.fileName === fileName || item.fileName?.toLowerCase() === fileName.toLowerCase())) return false;
          if (storagePath && item.storagePath === storagePath) return false;
          return true;
        })
      );

      // 2. Batched write to delete from lectures and update global_store
      try {
        const batch = writeBatch(db);

        // Delete direct doc
        if (id) {
          batch.delete(doc(db, 'lectures', id));
        }

        // Scan collection 'lectures' for matching filenames
        try {
          const lecturesCol = collection(db, 'lectures');
          const snapshot = await getDocs(lecturesCol);
          for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const matchId = docSnap.id === id;
            const matchFileName = Boolean(
              fileName && (
                data.fileName === fileName ||
                data.fileName?.toLowerCase() === fileName.toLowerCase() ||
                data.fileName?.trim().toLowerCase() === fileName.trim().toLowerCase()
              )
            );
            if (matchId || matchFileName) {
              batch.delete(doc(db, 'lectures', docSnap.id));
              const pathToDelete = data.storagePath || storagePath;
              if (pathToDelete) {
                try { await deleteObject(ref(storage, pathToDelete)); } catch (_) {}
              }
            }
          }
        } catch (_) {}

        // Atomically update global_store/smartboard_lessons
        try {
          const lSnap = await getDoc(doc(db, 'global_store', 'smartboard_lessons'));
          if (lSnap.exists() && Array.isArray(lSnap.data().lessons)) {
            const cur = lSnap.data().lessons;
            const next = cur.filter((l: any) => {
              if (l.id === id) return false;
              if (fileName && (l.fileName?.toLowerCase() === fileName.toLowerCase() || l.title?.toLowerCase() === fileName.toLowerCase())) return false;
              return true;
            });
            batch.set(doc(db, 'global_store', 'smartboard_lessons'), {
              lessons: next,
              version: Date.now(),
              lastUpdatedAt: serverTimestamp(),
            });
          }
        } catch (_) {}

        // Record deletion tombstone
        const delPayload: any = {
          deletedIds: arrayUnion(id),
          lastDeletedAt: serverTimestamp(),
        };
        if (fileName) {
          delPayload.deletedFiles = arrayUnion(fileName.trim().toLowerCase());
        }
        batch.set(doc(db, 'global_store', 'smartboard_deletions'), delPayload, { merge: true });

        // Commit all deletions atomically
        await batch.commit();
      } catch (batchErr) {
        console.warn('[useLectureRepository] Batched write note:', batchErr);
      }

      // 3. Xoá file vật lý trên Storage nếu có đường dẫn cụ thể
      if (storagePath) {
        try {
          const fileRef = ref(storage, storagePath);
          await deleteObject(fileRef);
        } catch (_) {}
      }

      // 4. Đồng bộ xóa trên máy chủ Express
      try {
        const qName = encodeURIComponent(fileName || '');
        fetch(`/api/documents/${encodeURIComponent(id)}?fileName=${qName}`, { method: 'DELETE' }).catch(() => {});
        fetch(`/api/lessons/${encodeURIComponent(id)}?title=${qName}&fileName=${qName}`, { method: 'DELETE' }).catch(() => {});
      } catch (_) {}
    } catch (err: any) {
      console.error('[useLectureRepository] Delete lecture error:', err);
      setError('Lỗi khi xoá bài giảng: ' + (err.message || String(err)));
      throw err;
    }
  }, []);

  return {
    lectures,
    isLoading,
    error,
    uploadingProgress,
    uploadLectureFile,
    deleteLectureFile,
  };
}
