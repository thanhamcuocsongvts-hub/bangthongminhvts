const fs = require('fs');
let code = fs.readFileSync('src/components/TouchWhiteboard.tsx', 'utf8');

if (!code.includes('interface Window')) {
  code = `declare global {
  interface Window {
    currentRafRef?: { id?: number };
  }
}

` + code;
  fs.writeFileSync('src/components/TouchWhiteboard.tsx', code);
}
