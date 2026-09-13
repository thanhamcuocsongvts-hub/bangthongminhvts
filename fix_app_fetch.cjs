const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `    // Cross-device sync: Fetch lessons stored on the cloud server (accessible from PC, TV 75", Mobile)
    fetch('/api/lessons')
      .then((res) => res.json())
      .then((data) => {
        if (data.lessons && Array.isArray(data.lessons) && data.lessons.length > 0) {
          setLessons((prev) => {
            const map = new Map<string, LessonDoc>();
            prev.forEach((l) => map.set(l.id, l));
            data.lessons.forEach((l: LessonDoc) => {
              map.set(l.id, { ...l, syncedToCloud: true });
            });
            const merged = Array.from(map.values());
            saveLessonsToDB(merged).catch(() => {});
            return merged;
          });
        }
      })
      .catch((err) => {
        console.warn('Could not fetch cloud lessons:', err);
      });`;

content = content.replace(target, '');
fs.writeFileSync('src/App.tsx', content);
