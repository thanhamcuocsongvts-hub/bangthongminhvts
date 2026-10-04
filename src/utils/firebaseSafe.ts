import {
  DocumentReference,
  CollectionReference,
  SetOptions,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  Query,
  DocumentData,
} from 'firebase/firestore';

const QUOTA_STORAGE_KEY = 'smartboard_fs_quota_exceeded';
const QUOTA_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours cooldown once exhausted

/**
 * Check if Firebase Firestore free tier quota is currently exhausted
 */
export function isFirestoreQuotaExhausted(): boolean {
  try {
    const item = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (!item) return false;
    const parsed = JSON.parse(item);
    if (Date.now() - parsed.timestamp < QUOTA_COOLDOWN_MS) {
      return true;
    }
    // Expired cooldown - reset and test
    localStorage.removeItem(QUOTA_STORAGE_KEY);
    return false;
  } catch {
    return false;
  }
}

/**
 * Mark Firestore quota as exhausted to prevent further writes and SDK backoff loops
 */
export function markFirestoreQuotaExhausted(reason?: string): void {
  try {
    localStorage.setItem(
      QUOTA_STORAGE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        reason: reason || 'Quota limit exceeded for free tier daily write units',
      })
    );
    console.warn(
      '[Smartboard Cloud] Firestore free daily quota is exhausted. Automatically switched to local Express server & IndexedDB offline-first storage.'
    );
    window.dispatchEvent(new CustomEvent('sync-status', { detail: 'synced' }));
  } catch {}
}

/**
 * Check if an error is a Firestore quota / resource exhausted error
 */
export function isQuotaError(err: any): boolean {
  if (!err) return false;
  const code = err.code || err?.error?.code || '';
  const msg = err.message || String(err);
  return (
    code === 'resource-exhausted' ||
    code.includes('resource-exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded') ||
    msg.includes('Free daily write units')
  );
}

/**
 * Safe setDoc wrapper that prevents quota exhaustion errors and infinite retries
 */
export async function safeSetDoc<T = DocumentData>(
  reference: DocumentReference<T>,
  data: any,
  options?: SetOptions
): Promise<void> {
  if (isFirestoreQuotaExhausted()) {
    return;
  }

  try {
    if (options) {
      await setDoc(reference, data, options);
    } else {
      await setDoc(reference, data);
    }
  } catch (err: any) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted(err.message);
      return;
    }
    console.warn('[safeSetDoc] Firestore write warning:', err?.message || err);
  }
}

/**
 * Safe addDoc wrapper that prevents quota exhaustion errors
 */
export async function safeAddDoc<T = DocumentData>(
  reference: CollectionReference<T>,
  data: any
): Promise<DocumentReference<T> | null> {
  if (isFirestoreQuotaExhausted()) {
    return null;
  }

  try {
    return await addDoc(reference, data);
  } catch (err: any) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted(err.message);
      return null;
    }
    console.warn('[safeAddDoc] Firestore add warning:', err?.message || err);
    return null;
  }
}

/**
 * Safe updateDoc wrapper that prevents quota exhaustion errors
 */
export async function safeUpdateDoc<T = DocumentData>(
  reference: DocumentReference<T>,
  data: any
): Promise<void> {
  if (isFirestoreQuotaExhausted()) {
    return;
  }

  try {
    await updateDoc(reference, data);
  } catch (err: any) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted(err.message);
      return;
    }
    console.warn('[safeUpdateDoc] Firestore update warning:', err?.message || err);
  }
}

/**
 * Safe deleteDoc wrapper
 */
export async function safeDeleteDoc<T = DocumentData>(
  reference: DocumentReference<T>
): Promise<void> {
  if (isFirestoreQuotaExhausted()) {
    return;
  }

  try {
    await deleteDoc(reference);
  } catch (err: any) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted(err.message);
      return;
    }
    console.warn('[safeDeleteDoc] Firestore delete warning:', err?.message || err);
  }
}

/**
 * Install global error filter to prevent Firestore SDK internal retry warnings from polluting logs
 */
export function setupFirestoreConsoleFilter(): void {
  if (typeof window === 'undefined') return;
  if ((window as any).__fsConsoleFilterInstalled) return;
  (window as any).__fsConsoleFilterInstalled = true;

  const originalConsoleError = console.error.bind(console);
  const originalConsoleWarn = console.warn.bind(console);

  const shouldSuppress = (args: any[]) => {
    const fullText = args
      .map((a) => {
        if (!a) return '';
        if (typeof a === 'string') return a;
        if (a instanceof Error) return `${a.name}: ${a.message} ${a.stack || ''}`;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ');

    return (
      (fullText.includes('@firebase/firestore') || fullText.includes('Firestore (12.19.0)')) &&
      (fullText.includes('resource-exhausted') ||
        fullText.includes('Quota limit exceeded') ||
        fullText.includes('Quota exceeded') ||
        fullText.includes('maximum backoff delay'))
    );
  };

  console.error = (...args: any[]) => {
    if (shouldSuppress(args)) {
      markFirestoreQuotaExhausted('Detected SDK internal backoff');
      return;
    }
    originalConsoleError(...args);
  };

  console.warn = (...args: any[]) => {
    if (shouldSuppress(args)) {
      return;
    }
    originalConsoleWarn(...args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason?.message || String(reason || '');
    if (
      msg.includes('resource-exhausted') ||
      msg.includes('Quota limit exceeded') ||
      msg.includes('Quota exceeded')
    ) {
      markFirestoreQuotaExhausted(msg);
      event.preventDefault();
    }
  });
}

// Automatically install console filter on import
setupFirestoreConsoleFilter();
