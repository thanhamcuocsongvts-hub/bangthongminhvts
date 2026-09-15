const fs = require('fs');
let code = fs.readFileSync('src/utils/storageUtils.ts', 'utf8');

const replacement = `    // Sync to Firestore (Debounced to save quota)
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
          if (cleanFileUrl && cleanFileUrl.startsWith('data:') && cleanFileUrl.length > 250000) {
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
    }, 2000);`;

code = code.replace(/    \/\/ Sync to Firestore \(Debounced to save quota\)[\s\S]*?console\.warn\("Firestore sync failed", e\);\n      \}/, replacement);
fs.writeFileSync('src/utils/storageUtils.ts', code);
