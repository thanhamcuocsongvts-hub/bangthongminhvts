const fs = require('fs');
let code = fs.readFileSync('src/components/PresentationView.tsx', 'utf8');

if (!code.includes('ChevronDown')) {
  code = code.replace("import {", "import {\n  ChevronDown,\n  ChevronUp,");
} else if (!code.includes('ChevronUp')) {
  code = code.replace("ChevronDown,", "ChevronDown,\n  ChevronUp,");
}
fs.writeFileSync('src/components/PresentationView.tsx', code);
