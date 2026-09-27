import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  doc,
  deleteDoc,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
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
        console.error('[useLectureRepository] Firestore onSnapshot error:', err);
        setError('Lỗi kết nối đồng bộ kho bài giảng: ' + (err.message || String(err)));
        setIsLoading(false);
      }
    );

    // Cleanup: Huỷ listener khi component unmount để tránh rò rỉ bộ nhớ (memory leak)
    return () => {
      unsubscribe();
    };
  }, []);

  // 2. Hàm Tải lên file (Upload): Đẩy file lên Cloud Storage và lưu document vào Firestore
  const uploadLectureFile = useCallback(async (file: File): Promise<LectureItem> => {
    if (!file) {
      throw new Error('Vui lòng chọn một tệp hợp lệ để tải lên.');
    }

    setError(null);
    setUploadingProgress(0);

    // Ensure anonymous auth for Firebase Storage security compliance
    if (auth && !auth.currentUser) {
      try {
        await signInAnonymously(auth);
      } catch (authErr) {
        console.warn('[useLectureRepository] Auth notice:', authErr);
      }
    }

    return new Promise<LectureItem>((resolve, reject) => {
      try {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const timestamp = Date.now();
        const safeBaseName = file.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF-]/g, '_');
        const storagePath = `lectures/${timestamp}_${safeBaseName}.${ext}`;
        const fileRef = ref(storage, storagePath);

        // Upload có báo tiến trình (uploadBytesResumable)
        const uploadTask = uploadBytesResumable(fileRef, file, {
          contentType: file.type || undefined,
        });

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (snapshot.totalBytes > 0) {
              const progress = Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              );
              setUploadingProgress(progress);
            }
          },
          (uploadErr) => {
            console.error('[useLectureRepository] Storage upload failed:', uploadErr);
            setError('Lỗi tải tệp lên Firebase Storage: ' + uploadErr.message);
            setUploadingProgress(0);
            reject(uploadErr);
          },
          async () => {
            try {
              // Lấy link tải thực tế getDownloadURL()
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

              const sizeFormatted =
                file.size > 1024 * 1024
                  ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                  : `${Math.round(file.size / 1024)} KB`;

              // Lưu document siêu dữ liệu mới vào collection 'lectures'
              const docData = {
                fileName: file.name,
                downloadURL,
                fileType: ext,
                fileSize: sizeFormatted,
                rawSizeBytes: file.size,
                storagePath,
                uploadedAt: serverTimestamp(),
              };

              const docRef = await addDoc(collection(db, 'lectures'), docData);

              const createdLecture: LectureItem = {
                id: docRef.id,
                ...docData,
                uploadedAt: new Date(),
              };

              setUploadingProgress(100);
              setTimeout(() => setUploadingProgress(0), 1500);
              resolve(createdLecture);
            } catch (firestoreErr: any) {
              console.error('[useLectureRepository] Firestore save failed:', firestoreErr);
              setError('Lỗi lưu siêu dữ liệu bài giảng vào Firestore: ' + firestoreErr.message);
              reject(firestoreErr);
            }
          }
        );
      } catch (err: any) {
        console.error('[useLectureRepository] Upload initiation failed:', err);
        setError('Không thể khởi tạo tiến trình upload: ' + err.message);
        setUploadingProgress(0);
        reject(err);
      }
    });
  }, []);

  // 3. Hàm Xoá file khỏi Firestore & Firebase Storage
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

      // 2. Xóa trực tiếp document Firestore theo ID nếu là ID của Firestore (không phải id local)
      if (id && !id.startsWith('lesson_')) {
        try {
          await deleteDoc(doc(db, 'lectures', id));
        } catch (directErr) {
          console.warn('[useLectureRepository] Direct deleteDoc note:', directErr);
        }
      }

      // 3. Quét sạch mọi bản ghi trùng fileName hoặc id trong collection 'lectures'
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
          const matchIdAsName = Boolean(
            id && (
              data.fileName === id ||
              data.fileName?.toLowerCase() === id.toLowerCase()
            )
          );
          const matchStorage = Boolean(storagePath && data.storagePath === storagePath);

          if (matchId || matchFileName || matchIdAsName || matchStorage) {
            await deleteDoc(doc(db, 'lectures', docSnap.id));
            const pathToDelete = data.storagePath || storagePath;
            if (pathToDelete) {
              try {
                await deleteObject(ref(storage, pathToDelete));
              } catch (_) {}
            }
          }
        }
      } catch (scanErr) {
        console.warn('[useLectureRepository] Scan deleteDoc note:', scanErr);
      }

      // 4. Xoá file vật lý trên Storage nếu có đường dẫn cụ thể
      if (storagePath) {
        try {
          const fileRef = ref(storage, storagePath);
          await deleteObject(fileRef);
        } catch (storageErr) {
          console.warn('[useLectureRepository] Storage delete note:', storageErr);
        }
      }

      // 5. Quét dọn collection cũ 'TaiLieuGiaoVien' nếu còn tồn tại tài liệu tương ứng
      try {
        const taiLieuCol = collection(db, 'TaiLieuGiaoVien');
        const snapTL = await getDocs(taiLieuCol);
        for (const docSnap of snapTL.docs) {
          const d = docSnap.data();
          if (
            docSnap.id === id ||
            (fileName && (d.name === fileName || d.name?.toLowerCase() === fileName.toLowerCase())) ||
            (id && (d.name === id || d.name?.toLowerCase() === id.toLowerCase()))
          ) {
            await deleteDoc(doc(db, 'TaiLieuGiaoVien', docSnap.id));
          }
        }
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
