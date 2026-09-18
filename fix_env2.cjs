const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace("|| __dirname.includes('dist') ", "");
fs.writeFileSync('server.ts', code);
