const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `    const unsubLessons = onSnapshot(doc(db, 'global_store', 'smartboard_lessons'), (docSnap) => {
       if (docSnap.exists() && docSnap.data().lessons) {
          const cloudLessons = docSnap.data().lessons;
          setLessons(cloudLessons);
          setIsLessonsLoaded(true);
       }
    });`;

const replacement = `    const unsubLessons = onSnapshot(doc(db, 'global_store', 'smartboard_lessons'), (docSnap) => {
       if (docSnap.exists() && docSnap.data().lessons) {
          const cloudLessons = docSnap.data().lessons;
          setLessons(cloudLessons);
       }
       setIsLessonsLoaded(true);
    });`;

content = content.replace(target, replacement);
fs.writeFileSync('src/App.tsx', content);
