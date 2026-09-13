const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  `            {activeTab === 'documents' && (
              <DocumentLibrary
                lessons={lessons}
                activeLessonId={activeLessonId}`,
  `            {activeTab === 'documents' && (
              <DocumentLibrary
                activeTeacher={activeTeacher}
                lessons={lessons.filter(l => l.author === activeTeacher?.name)}
                activeLessonId={activeLessonId}`
);

fs.writeFileSync('src/App.tsx', content);
