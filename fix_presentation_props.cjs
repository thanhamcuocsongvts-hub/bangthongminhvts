const fs = require('fs');
let content = fs.readFileSync('src/components/PresentationView.tsx', 'utf-8');
content = content.replace(
  '  onOpenExportModal: () => void;\n}',
  '  onOpenExportModal: () => void;\n  onClosePresentation?: () => void;\n}'
);
fs.writeFileSync('src/components/PresentationView.tsx', content);
