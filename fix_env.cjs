const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const oldCheck = `if (process.env.NODE_ENV !== "production") {`;
const newCheck = `const isProd = process.env.NODE_ENV === "production" || process.env.K_SERVICE || process.env.CLOUD_RUN_JOB || __dirname.includes('dist') || fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));
  if (!isProd) {`;

code = code.replace(oldCheck, newCheck);

fs.writeFileSync('server.ts', code);
