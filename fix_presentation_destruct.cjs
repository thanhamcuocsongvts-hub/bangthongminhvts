const fs = require('fs');
let content = fs.readFileSync('src/components/PresentationView.tsx', 'utf-8');
content = content.replace(
  '  onOpenExportModal,\n}) => {',
  '  onOpenExportModal,\n  onClosePresentation,\n}) => {'
);
fs.writeFileSync('src/components/PresentationView.tsx', content);
