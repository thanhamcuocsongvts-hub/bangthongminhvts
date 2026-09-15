const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `  const syncTeachersToCloud = async (newTeachers: any[]) => {
    if ((window as any).teacherSyncTimeout) clearTimeout((window as any).teacherSyncTimeout);
    (window as any).teacherSyncTimeout = setTimeout(async () => {
      try {
        const sanitized = JSON.parse(JSON.stringify(newTeachers));
        await setDoc(doc(db, 'global_store', 'smartboard_data'), { teachers: sanitized }, { merge: true });
        fetch('/api/teachers/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teachers: sanitized }),
        }).catch(() => {});
      } catch (e) {
        console.warn('Sync to Firestore failed:', e);
      }
    }, 5000);
  };`;

content = content.replace(/const syncTeachersToCloud = async \(newTeachers: any\[\]\) => \{[\s\S]*?console\.warn\('Sync to Firestore failed:', e\);\n    \}\n  \};/, replacement);
fs.writeFileSync('src/App.tsx', content);
