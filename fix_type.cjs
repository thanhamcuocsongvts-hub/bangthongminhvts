const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

if (!code.includes('status?:')) {
  code = code.replace(/  role\?: 'admin' \| 'teacher';/, "  role?: 'admin' | 'teacher';\n  status?: 'pending' | 'approved';");
  fs.writeFileSync('src/types.ts', code);
}
