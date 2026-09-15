const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `    const unsubLessons = onSnapshot(doc(db, 'global_store', 'smartboard_lessons'), (docSnap) => {
       if (docSnap.exists() && docSnap.data().lessons) {
          const cloudLessons = docSnap.data().lessons;
          if (Array.isArray(cloudLessons)) {
            setLessons((prev) => {
              const localMap = new Map();
              prev.forEach((l) => localMap.set(l.id, l));

              const merged = cloudLessons.map((cloudL: any) => {
                if (localMap.has(cloudL.id)) {
                  const localL = localMap.get(cloudL.id);
                  if (!cloudL.fileUrl && localL.fileUrl) {
                    cloudL.fileUrl = localL.fileUrl; // Preserve local dataUrl if cloud stripped it
                  }
                  if (!cloudL.rawText && localL.rawText) {
                    cloudL.rawText = localL.rawText;
                  }
                }
                return cloudL;
              });

              try {
                localStorage.setItem('smartboard_lessons', JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }
       }`;

code = code.replace(/    const unsubLessons = onSnapshot\(doc\(db, 'global_store', 'smartboard_lessons'\), \(docSnap\) => \{[\s\S]*?          \}\n       \}/, replacement);
fs.writeFileSync('src/App.tsx', code);
