const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

const target = `  const handleSyncToCloud = async () => {
    setIsSyncingCloud(true);
    try {
      const res = await fetch('/api/lessons/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessons }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.lessons && Array.isArray(data.lessons)) {
          setLessons(data.lessons);
          saveLessonsToDB(data.lessons).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Cloud sync error:', err);
    } finally {
      setIsSyncingCloud(false);
    }
  };`;

const replacement = `  const handleSyncToCloud = async () => {
    setIsSyncingCloud(true);
    try {
      await saveLessonsToDB(lessons);
    } catch (err) {
      console.error('Cloud sync error:', err);
    } finally {
      setIsSyncingCloud(false);
    }
  };`;

content = content.replace(target, replacement);
fs.writeFileSync('src/App.tsx', content);
