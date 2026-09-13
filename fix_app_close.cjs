const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  "                onLaunchQuiz={() => setActiveTab('quiz')}",
  "                onLaunchQuiz={() => setActiveTab('quiz')}\n                onClosePresentation={() => { setActiveLessonId(''); setActiveTab('documents'); }}"
);

fs.writeFileSync('src/App.tsx', content);
