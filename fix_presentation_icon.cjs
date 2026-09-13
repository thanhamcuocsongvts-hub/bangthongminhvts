const fs = require('fs');
let content = fs.readFileSync('src/components/PresentationView.tsx', 'utf-8');

content = content.replace(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  '<X className="w-4 h-4 stroke-[3]" />'
);

fs.writeFileSync('src/components/PresentationView.tsx', content);
