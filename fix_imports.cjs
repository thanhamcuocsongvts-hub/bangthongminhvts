const fs = require('fs');

let pvCode = fs.readFileSync('src/components/PresentationView.tsx', 'utf8');
if (!pvCode.includes('ChevronUp,')) {
  pvCode = pvCode.replace('ChevronDown,', 'ChevronDown,\n  ChevronUp,');
  fs.writeFileSync('src/components/PresentationView.tsx', pvCode);
}

let uvCode = fs.readFileSync('src/components/UniversalDocumentViewer.tsx', 'utf8');
if (!uvCode.includes('Info,')) {
  uvCode = uvCode.replace('FileText,', 'Info,\n  FileText,');
  fs.writeFileSync('src/components/UniversalDocumentViewer.tsx', uvCode);
}
