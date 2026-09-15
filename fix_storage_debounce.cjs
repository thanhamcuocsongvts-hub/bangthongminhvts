const fs = require('fs');
let content = fs.readFileSync('src/utils/storageUtils.ts', 'utf8');

const replacement = `
    // Sync to Firestore (Debounced to save quota)
    if (window.firestoreSyncTimeout) clearTimeout(window.firestoreSyncTimeout);
    window.firestoreSyncTimeout = setTimeout(async () => {
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
      } catch(e) {
        console.warn("Firestore sync failed", e);
      }
    }, 5000); // 5 seconds debounce
`;

content = content.replace(/\/\/ Sync to Firestore[\s\S]*?console\.warn\("Firestore sync failed", e\);\n    \}/, replacement.trim());
fs.writeFileSync('src/utils/storageUtils.ts', content);
