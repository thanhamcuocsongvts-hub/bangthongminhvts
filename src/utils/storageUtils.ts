/**
 * High-Capacity Persistent Storage Engine for SmartBoard 75 Pro
 * Utilizes IndexedDB for large lesson documents (PDF, Word, PPTX, scanned gradebooks up to 100MB+)
 * with automatic fallback to localStorage.
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
    
    // Sync to backend server
    try {
      fetch('/api/lessons/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessons: validLessons, replaceAll: true }),
      }).catch(() => {});
    } catch {}

    // Sync to Firestore (Debounced to save quota)
    window.dispatchEvent(new CustomEvent('sync-status', { detail: 'syncing' }));
    if ((window as any).firestoreSyncTimeout) clearTimeout((window as any).firestoreSyncTimeout);
    (window as any).firestoreSyncTimeout = setTimeout(async () => {
      if (!navigator.onLine) {
        window.dispatchEvent(new CustomEvent('sync-status', { detail: 'offline' }));
        return;
      }
      try {
        const authModule = await import('../lib/firebase');
        const firestoreModule = await import('firebase/firestore');
        const db = authModule.db;
        const { doc, setDoc } = firestoreModule;
        
        const sanitizedLessons = validLessons.map((l: any) => {
          let cleanFileUrl = l.fileUrl;
          // Firestore document limit is 1MB. Any Base64 data: URL over 500KB must not be stored in firestore document
          if (cleanFileUrl && cleanFileUrl.startsWith('data:') && cleanFileUrl.length > 500000) {
            cleanFileUrl = '';
          }
          return {
            ...l,
            fileUrl: cleanFileUrl,
          };
        });
        const cleanData = JSON.parse(JSON.stringify(sanitizedLessons));
        await setDoc(doc(db, 'global_store', 'smartboard_lessons'), { lessons: cleanData });
        window.dispatchEvent(new CustomEvent('sync-status', { detail: 'synced' }));
      } catch(e) {
        console.warn("Firestore sync failed", e);
        window.dispatchEvent(new CustomEvent('sync-status', { detail: 'error' }));
      }
    }, 1500);
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

  // 2. Immediate push to backend server
  try {
    await fetch('/api/lessons/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessons: validLessons, replaceAll: true }),
    });
  } catch (serverErr) {
    console.warn('Backend server lesson sync note:', serverErr);
  }

  // 3. Immediate push to Firestore
  try {
    const authModule = await import('../lib/firebase');
    const firestoreModule = await import('firebase/firestore');
    const db = authModule.db;
    const { doc, setDoc } = firestoreModule;

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
    await setDoc(doc(db, 'global_store', 'smartboard_lessons'), { lessons: cleanData }, { merge: true });
    window.dispatchEvent(new CustomEvent('sync-status', { detail: 'synced' }));
    
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    return { success: true, count: validLessons.length, timestamp: timeStr };
  } catch (firestoreErr) {
    console.error('Firestore lesson sync error:', firestoreErr);
    window.dispatchEvent(new CustomEvent('sync-status', { detail: 'error' }));
    throw firestoreErr;
  }
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
 * Load lesson documents from Firestore, backend API, IndexedDB, or LocalStorage
 * Perfectly merges cloud lessons from server and Firestore so any machine sees all uploaded files!
 */
export async function loadLessonsFromDB(): Promise<any[] | null> {
  const allLessonsMap = new Map<string, any>();

  // 1. Fetch from backend API (/api/lessons) - shared across all devices
  try {
    const res = await fetch('/api/lessons');
    if (res.ok) {
      const json = await res.json();
      if (json && Array.isArray(json.lessons)) {
        json.lessons.forEach((l: any) => {
          if (l && l.id) allLessonsMap.set(l.id, l);
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
          if (cl && cl.id) {
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
      if (ll && ll.id) {
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
          parsed.forEach((l: any) => allLessonsMap.set(l.id, l));
        }
      } catch {}
    }
  }

  if (allLessonsMap.size > 0) {
    const valid = Array.from(allLessonsMap.values()).filter(
      (l: any) => l && l.id && typeof l.title === 'string' && l.title.trim().length > 0 && !('username' in l) && !('classes' in l)
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

  return null;
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
