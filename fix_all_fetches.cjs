const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

content = content.replace(
  /fetch\('\/api\/lessons', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON.stringify\(newDoc\),\s*\}\).catch\(\(e\) => console.warn\('Sync new lesson to cloud error:', e\)\);/g,
  ''
);

content = content.replace(
  /fetch\(`\/api\/lessons\/\$\{id\}`\, \{ method: 'DELETE' \}\).catch\(\(\) => \{\}\);/g,
  ''
);

fs.writeFileSync('src/App.tsx', content);
