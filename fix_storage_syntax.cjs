const fs = require('fs');
let code = fs.readFileSync('src/utils/storageUtils.ts', 'utf8');

code = code.replace(/    \}, 2000\);\n    \}, 5000\); \/\/ 5 seconds debounce/, '    }, 2000);');

fs.writeFileSync('src/utils/storageUtils.ts', code);
