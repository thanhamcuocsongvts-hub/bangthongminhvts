const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `    });
    return () => unsub();
    
  }, []);`;

const replacement = `    });

    const unsubLessons = onSnapshot(doc(db, 'global_store', 'smartboard_lessons'), (docSnap) => {
       if (docSnap.exists() && docSnap.data().lessons) {
          const cloudLessons = docSnap.data().lessons;
          setLessons(cloudLessons);
          setIsLessonsLoaded(true);
       }
    });

    return () => {
      unsub();
      unsubLessons();
    };
  }, []);`;

content = content.replace(target, replacement);
fs.writeFileSync('src/App.tsx', content);
