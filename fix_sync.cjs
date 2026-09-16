const fs = require('fs');
let code = fs.readFileSync('src/utils/storageUtils.ts', 'utf8');

// Tăng giới hạn đồng bộ lên 25MB (26214400 bytes) để phù hợp với giới hạn up 20MB
code = code.replace(/cleanFileUrl\.length > 250000/g, 'cleanFileUrl.length > 26214400');

fs.writeFileSync('src/utils/storageUtils.ts', code);
