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
    const db = await openDB();
    const tx = db.transaction(STORE_LESSONS, 'readwrite');
    const store = tx.objectStore(STORE_LESSONS);

    // Clear and re-save
    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => reject(clearReq.error);
    });

    for (const item of lessons) {
      store.put(item);
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
        body: JSON.stringify({ lessons }),
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
        
        const sanitizedLessons = lessons.map((l) => {
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
      localStorage.setItem('smartboard_lessons', JSON.stringify(lessons));
    } catch (lsErr) {
      console.error('LocalStorage quota exceeded for lessons:', lsErr);
    }
  }
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
    return Array.from(allLessonsMap.values());
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
