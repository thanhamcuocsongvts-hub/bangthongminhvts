const fs = require('fs');
let content = fs.readFileSync('src/components/DocumentLibrary.tsx', 'utf-8');

content = content.replace(
  'accept=".txt,.json,.doc,.docx,.pdf,.md,.xlsx,.xls,.csv"',
  'accept=".txt,.json,.doc,.docx,.pdf,.md,.xlsx,.xls,.csv,.ppt,.pptx,image/*"'
);

fs.writeFileSync('src/components/DocumentLibrary.tsx', content);
