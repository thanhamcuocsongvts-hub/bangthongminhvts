const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace onAddLesson fetch
content = content.replace(
  `                  setLessons((prev) => [newDoc, ...prev]);
                  setActiveLessonId(newDoc.id);
                  fetch('/api/lessons', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newDoc),
                  }).catch((e) => console.warn('Sync new lesson to cloud error:', e));
                }`,
  `                  setLessons((prev) => [newDoc, ...prev]);
                  setActiveLessonId(newDoc.id);
                }`
);

// Replace onDeleteLesson fetch
content = content.replace(
  `                  setLessons((prev) => prev.filter((l) => l.id !== id));
                  if (activeLessonId === id) {
                    setActiveLessonId('');
                  }
                  fetch(\`/api/lessons/\${id}\`, { method: 'DELETE' }).catch(() => {});
                }`,
  `                  setLessons((prev) => prev.filter((l) => l.id !== id));
                  if (activeLessonId === id) {
                    setActiveLessonId('');
                  }
                }`
);

fs.writeFileSync('src/App.tsx', content);
