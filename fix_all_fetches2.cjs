const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  /fetch\('\/api\/lessons', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON.stringify\(updatedDoc\),\s*\}\).catch\(\(e\) => console.warn\('Sync updated lesson to cloud error:', e\)\);/g,
  ''
);

fs.writeFileSync('src/App.tsx', content);
