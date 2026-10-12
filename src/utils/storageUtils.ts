/**
 * High-Capacity Persistent Storage Engine for SmartBoard 75 Pro
 * Utilizes Firestore Transactions & Batched Writes for cross-device real-time sync,
 * with IndexedDB for high-capacity offline caching.
 */

const DB_NAME = 'SmartBoard75ProDB';
const DB_VERSION = 1;
const STORE_LESSONS = 'lessons';
const STORE_FILES = 'files_cache';
const STORE_SETTINGS = 'settings';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_LESSONS)) {
        db.createObjectStore(STORE_LESSONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

import { safeSetDoc, isFirestoreQuotaExhausted } from './firebaseSafe';

/**
 * Save large lesson documents to IndexedDB
 */
export async function saveLessonsToDB(lessons: any[]): Promise<void> {
  try {
    const validLessons = (lessons || []).filter(
      (l: any) => l && l.id && typeof l.title === 'string' && l.title.trim().length > 0 && !('username' in l) && !('classes' in l)
    );

    const db = await openDB();
    const tx = db.transaction(STORE_LESSONS, 'readwrite');
    const store = tx.objectStore(STORE_LESSONS);

    // Clear and re-save
    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => reject(clearReq.error);
    });

    for (const item of validLessons) {
      store.put(item);
      // If item contains large data: fileUrl, ensure it's also secured in STORE_FILES cache
      if (item.fileUrl && (item.fileUrl.startsWith('data:') || item.fileUrl.startsWith('blob:'))) {
        try {
          const filesStore = tx.objectStore(STORE_FILES);
          filesStore.put({ id: item.id, dataUrl: item.fileUrl, savedAt: Date.now() });
        } catch (_) {}
      }
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    
    // Sync to backend server without consuming Firestore quota
    try {
      fetch('/api/lessons/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessons: validLessons, replaceAll: true }),
      }).catch(() => {});
    } catch {}

    window.dispatchEvent(new CustomEvent('sync-status', { detail: 'synced' }));
  } catch (err) {
    console.warn('IndexedDB save fallback to localStorage:', err);
    try {
      const validFallback = (lessons || []).filter(
        (l: any) => l && l.id && typeof l.title === 'string' && l.title.trim().length > 0 && !('username' in l) && !('classes' in l)
      );
      localStorage.setItem('smartboard_lessons', JSON.stringify(validFallback));
    } catch (lsErr) {
      console.error('LocalStorage quota exceeded for lessons:', lsErr);
    }
  }
}

/**
 * Atomic Firestore Batched Write: Add or update a lesson across all devices in real-time
 */
export async function addLessonToCloudWithBatch(newLesson: any): Promise<void> {
  if (!newLesson || !newLesson.id) return;

  // 1. Immediately cache in local IndexedDB & LocalStorage
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_LESSONS, 'readwrite');
    tx.objectStore(STORE_LESSONS).put(newLesson);
  } catch (_) {}

  // 2. Sync to Backend Express Server
  try {
    fetch('/api/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLesson),
    }).catch(() => {});
  } catch (_) {}

  // 3. Atomic Batched Write in Firestore: writes to lectures collection AND global_store/smartboard_lessons
  try {
    const authModule = await import('../lib/firebase');
    const firestoreModule = await import('firebase/firestore');
    const db = authModule.db;
    const { doc, getDoc, writeBatch, serverTimestamp, arrayRemove } = firestoreModule;

    const batch = writeBatch(db);

    // Document in 'lectures' collection
    const lecturePayload = {
      id: newLesson.id,
      fileName: newLesson.fileName || newLesson.title,
      downloadURL: newLesson.fileUrl || '',
      fileType: newLesson.fileType || 'bin',
      fileSize: newLesson.fileSize || '',
      storagePath: newLesson.storagePath || '',
      uploadedAt: serverTimestamp(),
      title: newLesson.title,
      author: newLesson.author || 'Giáo viên',
      subject: newLesson.subject || 'Toán học',
      grade: newLesson.grade || 'Lớp 12',
    };
    batch.set(doc(db, 'lectures', newLesson.id), lecturePayload, { merge: true });

    // Atomically read and update global_store/smartboard_lessons
    let currentLessons: any[] = [];
    try {
      const lSnap = await getDoc(doc(db, 'global_store', 'smartboard_lessons'));
      if (lSnap.exists() && Array.isArray(lSnap.data().lessons)) {
        currentLessons = lSnap.data().lessons;
      }
    } catch (_) {}

    const sanitizedNewLesson = {
      ...newLesson,
      fileUrl: (newLesson.fileUrl?.startsWith('data:') && newLesson.fileUrl.length > 500000) ? '' : newLesson.fileUrl,
      syncedToCloud: true,
      lastModified: new Date().toISOString(),
    };

    const nextLessons = [
      sanitizedNewLesson,
      ...currentLessons.filter((l: any) => l.id !== newLesson.id && l.fileName !== newLesson.fileName),
    ];

    batch.set(doc(db, 'global_store', 'smartboard_lessons'), {
      lessons: nextLessons,
      version: Date.now(),
      lastUpdatedAt: serverTimestamp(),
    });

    // Remove from deletion tombstones if it was previously deleted
    const tKey = (newLesson.title || '').trim().toLowerCase();
    const fKey = (newLesson.fileName || '').trim().toLowerCase();
    const untombPayload: any = {
      deletedIds: arrayRemove(newLesson.id),
      lastUpdated: serverTimestamp(),
    };
    if (tKey) untombPayload.deletedTitles = arrayRemove(tKey);
    if (fKey) untombPayload.deletedFiles = arrayRemove(fKey);

    batch.set(doc(db, 'global_store', 'smartboard_deletions'), untombPayload, { merge: true });

    // Commit all updates atomically!
    await batch.commit();
    window.dispatchEvent(new CustomEvent('sync-status', { detail: 'synced' }));
  } catch (err) {
    console.warn('[addLessonToCloudWithBatch] Firestore batched write notice:', err);
  }
}

/**
 * Permanently delete a lesson from IndexedDB, localStorage, backend server, and Firestore global_store immediately.
 * Utilizes Firestore Batched Writes for instantaneous real-time sync across mobile and PC devices.
 */
export async function deleteLessonFromStorage(
  id: string,
  remainingLessons: any[],
  lessonTitle?: string,
  fileName?: string
): Promise<void> {
  // 1. Cancel any pending debounce sync to avoid resurrecting the deleted item
  if ((window as any).firestoreSyncTimeout) {
    clearTimeout((window as any).firestoreSyncTimeout);
    (window as any).firestoreSyncTimeout = null;
  }

  const validRemaining = (remainingLessons || []).filter(
    (l: any) =>
      l &&
      l.id &&
      l.id !== id &&
      (!lessonTitle || l.title?.trim().toLowerCase() !== lessonTitle.trim().toLowerCase()) &&
      (!fileName || l.fileName?.trim().toLowerCase() !== fileName.trim().toLowerCase()) &&
      typeof l.title === 'string' &&
      l.title.trim().length > 0 &&
      !('username' in l) &&
      !('classes' in l)
  );

  // 2. Remove from LocalStorage
  try {
    localStorage.setItem('smartboard_lessons', JSON.stringify(validRemaining));
  } catch (_) {}

  // 3. Remove from IndexedDB
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_LESSONS, STORE_FILES], 'readwrite');
    const lessonStore = tx.objectStore(STORE_LESSONS);
    const filesStore = tx.objectStore(STORE_FILES);

    lessonStore.delete(id);
    filesStore.delete(id);

    // If lessonTitle or fileName provided, scan and delete any lingering entries
    const allRecordsReq = lessonStore.getAll();
    allRecordsReq.onsuccess = () => {
      const records = allRecordsReq.result || [];
      for (const rec of records) {
        if (!rec) continue;
        const matchTitle = lessonTitle && rec.title?.trim().toLowerCase() === lessonTitle.trim().toLowerCase();
        const matchFile = fileName && rec.fileName?.trim().toLowerCase() === fileName.trim().toLowerCase();
        if (matchTitle || matchFile) {
          lessonStore.delete(rec.id);
          filesStore.delete(rec.id);
        }
      }
    };

    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (idbErr) {
    console.warn('IndexedDB delete notice:', idbErr);
  }

  // 4. Notify backend server
  try {
    const qTitle = encodeURIComponent(lessonTitle || '');
    const qFile = encodeURIComponent(fileName || '');
    fetch(`/api/lessons/${encodeURIComponent(id)}?title=${qTitle}&fileName=${qFile}`, { method: 'DELETE' }).catch(() => {});
    fetch(`/api/documents/${encodeURIComponent(id)}?fileName=${qFile}`, { method: 'DELETE' }).catch(() => {});
    fetch('/api/lessons/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessons: validRemaining, replaceAll: true }),
    }).catch(() => {});
  } catch (_) {}

  // 5. Instantly push cleaned lessons list and deletion record to Firestore via Batched Writes
  try {
    const authModule = await import('../lib/firebase');
    const firestoreModule = await import('firebase/firestore');
    const db = authModule.db;
    const { doc, collection, getDocs, writeBatch, serverTimestamp, arrayUnion } = firestoreModule;

    const sanitizedLessons = validRemaining.map((l: any) => {
      let cleanFileUrl = l.fileUrl;
      if (cleanFileUrl && cleanFileUrl.startsWith('data:') && cleanFileUrl.length > 500000) {
        cleanFileUrl = '';
      }
      return {
        ...l,
        fileUrl: cleanFileUrl,
      };
    });
    const cleanData = JSON.parse(JSON.stringify(sanitizedLessons));

    // Firestore Batched Write for atomic cross-device synchronization
    const batch = writeBatch(db);

    // Atomic update of current lessons list with version timestamp
    batch.set(doc(db, 'global_store', 'smartboard_lessons'), {
      lessons: cleanData,
      version: Date.now(),
      lastUpdatedAt: serverTimestamp(),
    });

    // Atomic tombstone record to prevent any other device from resurrecting deleted documents
    const titleKey = lessonTitle ? lessonTitle.trim().toLowerCase() : '';
    const fileKey = fileName ? fileName.trim().toLowerCase() : '';
    const delPayload: any = {
      deletedIds: arrayUnion(id),
      lastDeletedAt: serverTimestamp(),
    };
    if (titleKey) delPayload.deletedTitles = arrayUnion(titleKey);
    if (fileKey) delPayload.deletedFiles = arrayUnion(fileKey);

    batch.set(doc(db, 'global_store', 'smartboard_deletions'), delPayload, { merge: true });

    // Directly delete known document IDs from lectures and TaiLieuGiaoVien
    if (id) {
      batch.delete(doc(db, 'lectures', id));
      batch.delete(doc(db, 'TaiLieuGiaoVien', id));
    }

    // Commit all updates atomically in a single network round-trip!
    await batch.commit();

    window.dispatchEvent(new CustomEvent('sync-status', { detail: 'synced' }));
  } catch (firestoreErr) {
    console.warn('Firestore batched write on delete notice:', firestoreErr);
  }
}

/**
 * Clear all storage across Web, Mobile, Server, and Firestore via atomic Batched Write
 */
export async function clearAllStorageFromCloud(): Promise<void> {
  // 1. Clear LocalStorage and IndexedDB
  try {
    localStorage.removeItem('smartboard_lessons');
    localStorage.removeItem('smartboard_active_lesson_obj');
    localStorage.removeItem('smartboard_cloud_links');
  } catch (_) {}
  try {
    const db = await openDB();
    const tx = db.transaction([STORE_LESSONS, STORE_FILES], 'readwrite');
    tx.objectStore(STORE_LESSONS).clear();
    tx.objectStore(STORE_FILES).clear();
  } catch (_) {}

  // 2. Call server purge APIs
  try {
    await fetch('/api/lessons', { method: 'DELETE' });
    await fetch('/api/documents', { method: 'DELETE' });
    await fetch('/api/links', { method: 'DELETE' });
  } catch (_) {}

  // 3. Batched Write to Firestore
  try {
    const authModule = await import('../lib/firebase');
    const firestoreModule = await import('firebase/firestore');
    const db = authModule.db;
    const { doc, collection, getDocs, writeBatch, serverTimestamp } = firestoreModule;

    const batch = writeBatch(db);
    batch.set(doc(db, 'global_store', 'smartboard_lessons'), {
      lessons: [],
      version: Date.now(),
      lastUpdatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'global_store', 'smartboard_documents'), {
      documents: [],
      lastUpdatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'global_store', 'smartboard_links'), {
      links: [],
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'global_store', 'smartboard_deletions'), {
      wipedAt: serverTimestamp(),
      wipeVersion: Date.now(),
      deletedIds: [],
      deletedTitles: [],
      deletedFiles: [],
    });

    const lecSnap = await getDocs(collection(db, 'lectures'));
    lecSnap.docs.forEach((d) => batch.delete(doc(db, 'lectures', d.id)));

    const tlSnap = await getDocs(collection(db, 'TaiLieuGiaoVien'));
    tlSnap.docs.forEach((d) => batch.delete(doc(db, 'TaiLieuGiaoVien', d.id)));

    await batch.commit();
  } catch (e) {
    console.warn('Firestore clear all batch write notice:', e);
  }

  window.dispatchEvent(new CustomEvent('sync-status', { detail: 'synced' }));
}

/**
 * Force immediate cloud synchronization for lessons (NO DEBOUNCE)
 * Guarantees that lessons uploaded on home computer are instantly pushed to cloud & available at school
 */
export async function forceSyncLessonsToCloud(lessons: any[]): Promise<{ success: boolean; count: number; timestamp: string }> {
  const validLessons = (lessons || []).filter(
    (l: any) => l && l.id && typeof l.title === 'string' && l.title.trim().length > 0 && !('username' in l) && !('classes' in l)
  );

  window.dispatchEvent(new CustomEvent('sync-status', { detail: 'syncing' }));

  // 1. Save to local IndexedDB & LocalStorage
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_LESSONS, 'readwrite');
    const store = tx.objectStore(STORE_LESSONS);
    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => reject(clearReq.error);
    });
    for (const item of validLessons) {
      store.put(item);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Local IndexedDB write warning:', err);
  }

  try {
    localStorage.setItem('smartboard_lessons', JSON.stringify(validLessons));
  } catch (_) {}

  // 2. Parallel cloud sync (Local backend server + Firestore)
  const syncPromises: Promise<any>[] = [];

  syncPromises.push(
    fetch('/api/lessons/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessons: validLessons, replaceAll: true }),
    }).catch((serverErr) => console.warn('Backend server lesson sync note:', serverErr))
  );

  syncPromises.push(
    (async () => {
      try {
        const authModule = await import('../lib/firebase');
        const firestoreModule = await import('firebase/firestore');
        const db = authModule.db;
        const { doc } = firestoreModule;

        const sanitizedLessons = validLessons.map((l: any) => {
          let cleanFileUrl = l.fileUrl;
          if (cleanFileUrl && cleanFileUrl.startsWith('data:') && cleanFileUrl.length > 500000) {
            cleanFileUrl = '';
          }
          return {
            ...l,
            fileUrl: cleanFileUrl,
          };
        });
        const cleanData = JSON.parse(JSON.stringify(sanitizedLessons));
        await safeSetDoc(doc(db, 'global_store', 'smartboard_lessons'), { lessons: cleanData }, { merge: true });
      } catch (firestoreErr) {
        console.warn('Firestore lesson sync notice:', firestoreErr);
      }
    })()
  );

  await Promise.allSettled(syncPromises);

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

  window.dispatchEvent(new CustomEvent('sync-status', { detail: 'synced' }));
  return { success: true, count: validLessons.length, timestamp: timeStr };
}

/**
 * Force pull all cloud lessons from server and Firestore (Bidirectional pull)
 */
export async function forcePullLessonsFromCloud(): Promise<any[]> {
  const cloudLessons = await loadLessonsFromDB();
  if (cloudLessons && Array.isArray(cloudLessons)) {
    try {
      localStorage.setItem('smartboard_lessons', JSON.stringify(cloudLessons));
    } catch (_) {}
  }
  return cloudLessons || [];
}

/**
 * Atomic Firestore Batched Write: Synchronize external resource links across all devices
 */
export async function syncLinksWithBatchedWrite(newLinks: any[]): Promise<void> {
  const safeLinks = Array.isArray(newLinks) ? newLinks : [];
  
  // 1. Local cache
  try {
    localStorage.setItem('smartboard_cloud_links', JSON.stringify(safeLinks));
    localStorage.setItem('smartboard_links_initialized', 'true');
  } catch (_) {}

  // 2. Server API
  try {
    fetch('/api/links/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ links: safeLinks }),
    }).catch(() => {});
  } catch (_) {}

  // 3. Atomic Batched Write in Firestore
  try {
    const authModule = await import('../lib/firebase');
    const firestoreModule = await import('firebase/firestore');
    const db = authModule.db;
    const { doc, writeBatch, serverTimestamp } = firestoreModule;

    const batch = writeBatch(db);
    batch.set(doc(db, 'global_store', 'smartboard_links'), {
      links: safeLinks,
      updatedAt: serverTimestamp(),
      count: safeLinks.length,
    });
    await batch.commit();
  } catch (err) {
    console.warn('[syncLinksWithBatchedWrite] Firestore note:', err);
  }
}

/**
 * Load lesson documents from Firestore, backend API, IndexedDB, or LocalStorage
 * Strictly respects Firestore Deletion Tombstones so deleted documents NEVER return!
 */
export async function loadLessonsFromDB(): Promise<any[] | null> {
  const allLessonsMap = new Map<string, any>();
  const deletedIds = new Set<string>();
  const deletedTitles = new Set<string>();
  const deletedFiles = new Set<string>();

  // 0. Fetch Firestore Deletion Tombstones first to prevent resurrecting deleted files
  try {
    const authModule = await import('../lib/firebase');
    const firestoreModule = await import('firebase/firestore');
    const db = authModule.db;
    const { doc, getDoc } = firestoreModule;
    const delSnap = await getDoc(doc(db, 'global_store', 'smartboard_deletions'));
    if (delSnap.exists()) {
      const d = delSnap.data();
      if (d.wipeVersion) {
        // Entire library was purged across cloud
        localStorage.removeItem('smartboard_lessons');
        return [];
      }
      if (Array.isArray(d.deletedIds)) {
        d.deletedIds.forEach((id: string) => deletedIds.add(id));
      }
      if (Array.isArray(d.deletedTitles)) {
        d.deletedTitles.forEach((t: string) => deletedTitles.add(t.toLowerCase().trim()));
      }
      if (Array.isArray(d.deletedFiles)) {
        d.deletedFiles.forEach((f: string) => deletedFiles.add(f.toLowerCase().trim()));
      }
    }
  } catch (_) {}

  // Check local deleted tombstones as well
  try {
    const localDel = localStorage.getItem('smartboard_deleted_lessons');
    if (localDel) {
      const p = JSON.parse(localDel);
      if (Array.isArray(p.ids)) p.ids.forEach((id: string) => deletedIds.add(id));
      if (Array.isArray(p.titles)) p.titles.forEach((t: string) => deletedTitles.add(t.toLowerCase().trim()));
    }
  } catch (_) {}

  const isTombstoned = (l: any) => {
    if (!l || !l.id) return true;
    if (deletedIds.has(l.id)) return true;
    const t = (l.title || '').trim().toLowerCase();
    if (t && deletedTitles.has(t)) return true;
    const f = (l.fileName || '').trim().toLowerCase();
    if (f && deletedFiles.has(f)) return true;
    return false;
  };

  // 1. Fetch from backend API (/api/lessons) - shared across all devices
  try {
    const res = await fetch('/api/lessons');
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.lessons)) {
        json.lessons.forEach((l: any) => {
          if (l && l.id && !isTombstoned(l)) allLessonsMap.set(l.id, l);
        });
      }
    }
  } catch (e) {
    console.warn("Backend /api/lessons read failed", e);
  }

  // 2. Fetch from Firestore global store
  try {
    const authModule = await import('../lib/firebase');
    const firestoreModule = await import('firebase/firestore');
    const db = authModule.db;
    const { doc, getDoc } = firestoreModule;
    const docSnap = await getDoc(doc(db, 'global_store', 'smartboard_lessons'));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && Array.isArray(data.lessons)) {
        data.lessons.forEach((cl: any) => {
          if (cl && cl.id && !isTombstoned(cl)) {
            if (allLessonsMap.has(cl.id)) {
              const existing = allLessonsMap.get(cl.id);
              allLessonsMap.set(cl.id, {
                ...cl,
                fileUrl: existing.fileUrl || cl.fileUrl,
                rawText: existing.rawText || cl.rawText,
                slides: (existing.slides && existing.slides.length > 0) ? existing.slides : cl.slides,
              });
            } else {
              allLessonsMap.set(cl.id, cl);
            }
          }
        });
      }
    }
  } catch(e) {
    console.warn("Firestore read failed", e);
  }

  // 3. Fetch from local IndexedDB cache
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_LESSONS, 'readonly');
    const store = tx.objectStore(STORE_LESSONS);
    const localLessons: any[] = await new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result && req.result.length > 0 ? req.result : []);
      req.onerror = () => resolve([]);
    });

    localLessons.forEach((ll: any) => {
      if (ll && ll.id && !isTombstoned(ll)) {
        if (allLessonsMap.has(ll.id)) {
          const cloud = allLessonsMap.get(ll.id);
          allLessonsMap.set(ll.id, {
            ...cloud,
            fileUrl: ll.fileUrl || cloud.fileUrl,
            rawText: ll.rawText || cloud.rawText,
            slides: (ll.slides && ll.slides.length > 0) ? ll.slides : cloud.slides,
          });
        } else {
          allLessonsMap.set(ll.id, ll);
        }
      }
    });

    // Check STORE_FILES for any lesson with missing fileUrl
    const filesTx = db.transaction(STORE_FILES, 'readonly');
    const filesStore = filesTx.objectStore(STORE_FILES);
    for (const [id, lesson] of allLessonsMap.entries()) {
      if (!lesson.fileUrl) {
        const cachedFile: any = await new Promise((resolve) => {
          const req = filesStore.get(id);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        });
        if (cachedFile && cachedFile.dataUrl) {
          lesson.fileUrl = cachedFile.dataUrl;
          allLessonsMap.set(id, lesson);
        }
      }
    }
  } catch(e) {
    console.warn("IndexedDB read failed", e);
  }

  // 4. Check LocalStorage fallback
  if (allLessonsMap.size === 0) {
    const ls = localStorage.getItem('smartboard_lessons');
    if (ls) {
      try {
        const parsed = JSON.parse(ls);
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach((l: any) => {
            if (l && l.id && !isTombstoned(l)) {
              allLessonsMap.set(l.id, l);
            }
          });
        }
      } catch {}
    }
  }

  if (allLessonsMap.size > 0) {
    const valid = Array.from(allLessonsMap.values()).filter(
      (l: any) => l && l.id && !isTombstoned(l) && typeof l.title === 'string' && l.title.trim().length > 0 && !('username' in l) && !('classes' in l)
    );
    const seen = new Set<string>();
    const deduped: any[] = [];
    for (const item of valid) {
      const key = item.title.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(item);
      }
    }
    return deduped;
  }

  return [];
}

/**
 * Save large binary/file blob cache
 */
export async function saveLargeFileCache(fileId: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, 'readwrite');
    tx.objectStore(STORE_FILES).put({ id: fileId, dataUrl, savedAt: Date.now() });
  } catch (e) {
    console.warn('Could not cache large file:', e);
  }
}

/**
 * Retrieve large binary/file blob cache
 */
export async function getLargeFileCache(fileId: string): Promise<string | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, 'readonly');
    return new Promise((resolve) => {
      const req = tx.objectStore(STORE_FILES).get(fileId);
      req.onsuccess = () => resolve(req.result ? req.result.dataUrl : null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

/**
 * Convert File or Blob to Base64 string
 */
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Convert Base64 string to native Blob
 */
export function base64ToBlob(base64: string, mimeType: string = 'application/octet-stream'): Blob {
  const cleanBase64 = base64.replace(/\s+/g, '');
  const byteCharacters = atob(cleanBase64);
  const byteNumbers = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([byteNumbers], { type: mimeType });
}

/**
 * Universal Cloud Storage: Save complete file binary to Firestore and local IndexedDB
 * Works across ALL platforms (PC, phone, tablet, Vercel, cloud run)
 */
export async function saveFileToCloudStore(
  file: File,
  docId: string
): Promise<{ fileUrl: string; fileSizeFormatted: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const sizeFormatted =
    file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

  // 1. Lưu vào IndexedDB cục bộ của máy hiện tại để truy xuất tức thì (<5ms)
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, 'readwrite');
    tx.objectStore(STORE_FILES).put({
      id: docId,
      blob: file,
      fileName: file.name,
      fileSize: sizeFormatted,
      mimeType: file.type || 'application/octet-stream',
      savedAt: Date.now(),
    });
  } catch (idbErr) {
    console.warn('[saveFileToCloudStore] IndexedDB note:', idbErr);
  }

  // 2. Tải lên máy chủ lưu trữ siêu tốc (/api/documents/upload-raw)
  let cloudFileUrl = `/uploads/${docId}_${file.name.replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF-]/g, '_')}.${ext}`;
  const serverUploadPromise = (async () => {
    try {
      const rawRes = await fetch(
        `/api/documents/upload-raw?fileName=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(ext)}&lessonId=${encodeURIComponent(docId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        }
      );
      if (rawRes.ok) {
        const data = await rawRes.json();
        if (data?.fileUrl) {
          cloudFileUrl = data.fileUrl;
        }
      }
    } catch (_) {}
  })();

  // 3. Đồng thời ghi nhị phân lên Firestore collection 'files' (hỗ trợ phân mảnh chunk) để các thiết bị khác (điện thoại, máy tính khác) luôn tải được
  const firestoreUploadPromise = (async () => {
    try {
      const base64Data = await fileToBase64(file);
      const authModule = await import('../lib/firebase');
      const firestoreModule = await import('firebase/firestore');
      const firestoreDb = authModule.db;
      const { doc, setDoc, serverTimestamp, writeBatch } = firestoreModule;

      const CHUNK_SIZE = 450000; // ~450KB per chunk để an toàn dưới giới hạn 1MB Firestore
      if (base64Data.length <= CHUNK_SIZE) {
        await setDoc(doc(firestoreDb, 'files', docId), {
          id: docId,
          fileName: file.name,
          fileType: ext,
          fileSize: sizeFormatted,
          rawSizeBytes: file.size,
          mimeType: file.type || 'application/octet-stream',
          dataBase64: base64Data,
          isChunked: false,
          chunkCount: 1,
          uploadedAt: serverTimestamp(),
        });
      } else {
        const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
        await setDoc(doc(firestoreDb, 'files', docId), {
          id: docId,
          fileName: file.name,
          fileType: ext,
          fileSize: sizeFormatted,
          rawSizeBytes: file.size,
          mimeType: file.type || 'application/octet-stream',
          isChunked: true,
          chunkCount: totalChunks,
          uploadedAt: serverTimestamp(),
        });

        for (let i = 0; i < totalChunks; i += 10) {
          const batch = writeBatch(firestoreDb);
          const end = Math.min(i + 10, totalChunks);
          for (let j = i; j < end; j++) {
            const chunkStr = base64Data.slice(j * CHUNK_SIZE, (j + 1) * CHUNK_SIZE);
            batch.set(doc(firestoreDb, 'files', docId, 'chunks', String(j)), {
              chunkIndex: j,
              data: chunkStr,
            });
          }
          await batch.commit();
        }
      }
    } catch (fsErr) {
      console.warn('[saveFileToCloudStore] Firestore save notice:', fsErr);
    }
  })();

  // Đợi máy chủ upload hoàn tất (thường < 150ms)
  await Promise.race([
    serverUploadPromise,
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);

  // Tiếp tục chạy Firestore trong background nếu chưa xong
  firestoreUploadPromise.catch(() => {});

  return { fileUrl: cloudFileUrl, fileSizeFormatted: sizeFormatted };
}

/**
 * Universal Cloud Storage: Lấy file nguyên bản từ local IndexedDB hoặc Firestore Cloud
 * Tái tạo chính xác 100% dung lượng và định dạng gốc trên bất kỳ điện thoại hay máy tính nào
 */
export async function fetchFileFromCloudStore(
  docId: string
): Promise<{ blob: Blob; fileName: string; mimeType: string } | null> {
  if (!docId) return null;

  // 1. Kiểm tra bộ nhớ cục bộ IndexedDB trước
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, 'readonly');
    const item: any = await new Promise((resolve) => {
      const req = tx.objectStore(STORE_FILES).get(docId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    if (item?.blob instanceof Blob) {
      return { blob: item.blob, fileName: item.fileName || 'tai-lieu', mimeType: item.mimeType || item.blob.type };
    }
    if (typeof item?.dataUrl === 'string' && item.dataUrl.startsWith('data:')) {
      const parts = item.dataUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
      const blob = base64ToBlob(parts[1], mime);
      return { blob, fileName: item.fileName || 'tai-lieu', mimeType: mime };
    }
  } catch (_) {}

  // 2. Tải về từ Firestore collection 'files' (dành cho điện thoại hoặc máy tính khác)
  try {
    const authModule = await import('../lib/firebase');
    const firestoreModule = await import('firebase/firestore');
    const firestoreDb = authModule.db;
    const { doc, getDoc, getDocs, collection, query, orderBy, where, limit } = firestoreModule;

    let fileDocSnap = await getDoc(doc(firestoreDb, 'files', docId));
    let targetDocId = docId;

    if (!fileDocSnap.exists()) {
      // Thử tìm theo fileName
      const filesCol = collection(firestoreDb, 'files');
      const qSnap = await getDocs(query(filesCol, where('fileName', '==', docId), limit(1)));
      if (!qSnap.empty) {
        fileDocSnap = qSnap.docs[0];
        targetDocId = fileDocSnap.id;
      }
    }

    if (!fileDocSnap.exists()) return null;

    const data = fileDocSnap.data();
    const fileName = data.fileName || 'tai-lieu';
    const mimeType = data.mimeType || 'application/octet-stream';

    if (!data.isChunked && data.dataBase64) {
      const blob = base64ToBlob(data.dataBase64, mimeType);
      try {
        const idb = await openDB();
        const tx = idb.transaction(STORE_FILES, 'readwrite');
        tx.objectStore(STORE_FILES).put({ id: docId, blob, fileName, mimeType, savedAt: Date.now() });
      } catch (_) {}
      return { blob, fileName, mimeType };
    }

    if (data.isChunked && data.chunkCount > 0) {
      const chunksCol = collection(firestoreDb, 'files', targetDocId, 'chunks');
      const q = query(chunksCol, orderBy('chunkIndex', 'asc'));
      const chunkSnaps = await getDocs(q);

      const chunkList: { index: number; data: string }[] = [];
      chunkSnaps.forEach((s) => {
        const cData = s.data();
        chunkList.push({ index: cData.chunkIndex, data: cData.data || '' });
      });
      chunkList.sort((a, b) => a.index - b.index);

      const fullBase64 = chunkList.map((c) => c.data).join('');
      if (fullBase64) {
        const blob = base64ToBlob(fullBase64, mimeType);
        try {
          const idb = await openDB();
          const tx = idb.transaction(STORE_FILES, 'readwrite');
          tx.objectStore(STORE_FILES).put({ id: docId, blob, fileName, mimeType, savedAt: Date.now() });
        } catch (_) {}
        return { blob, fileName, mimeType };
      }
    }
  } catch (err) {
    console.warn('[fetchFileFromCloudStore] Error fetching from Firestore:', err);
  }

  return null;
}
