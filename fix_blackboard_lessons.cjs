const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  "                lessons={lessons || []}",
  "                lessons={lessons.filter(l => l.author === activeTeacher?.name) || []}"
);

fs.writeFileSync('src/App.tsx', content);
