const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `  // Sync teachers across devices (PC <-> Mobile)
  useEffect(() => {
    // Subscribe to realtime updates
    const unsub = onSnapshot(doc(db, 'global_store', 'smartboard_data'), (docSnap) => {
       if (docSnap.exists() && docSnap.data().teachers) {
          const cloudTeachers = docSnap.data().teachers;
          // Trust the cloud as the absolute source of truth for cross-device sync
          setTeachers(cloudTeachers);
          localStorage.setItem('smartboard_teachers', JSON.stringify(cloudTeachers));
       }
    });

    const unsubLessons = onSnapshot(doc(db, 'global_store', 'smartboard_lessons'), (docSnap) => {`;

code = code.replace(/  \/\/ Sync teachers across devices \(PC <-> Mobile\)[\s\S]*?const unsubLessons = onSnapshot\(doc\(db, 'global_store', 'smartboard_lessons'\), \(docSnap\) => \{/, replacement);

fs.writeFileSync('src/App.tsx', code);
