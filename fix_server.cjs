const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// Wrap mkdirSync in try-catch
code = code.replace(
  "if (!fs.existsSync(UPLOADS_DIR)) {\n  fs.mkdirSync(UPLOADS_DIR, { recursive: true });\n}",
  "try {\n  if (!fs.existsSync(UPLOADS_DIR)) {\n    fs.mkdirSync(UPLOADS_DIR, { recursive: true });\n  }\n} catch (e) { console.warn('Could not create UPLOADS_DIR', e); }"
);

code = code.replace(
  "if (!fs.existsSync(DATA_DIR)) {\n  fs.mkdirSync(DATA_DIR, { recursive: true });\n}",
  "try {\n  if (!fs.existsSync(DATA_DIR)) {\n    fs.mkdirSync(DATA_DIR, { recursive: true });\n  }\n} catch (e) { console.warn('Could not create DATA_DIR', e); }"
);

// Fallback directories to /tmp if process.cwd() is read-only
const oldDirs = `const UPLOADS_DIR = path.join(process.cwd(), "uploads");
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) { console.warn('Could not create UPLOADS_DIR', e); }

app.use("/uploads", express.static(UPLOADS_DIR));

const DATA_DIR = path.join(process.cwd(), "data");`;

const newDirs = `const UPLOADS_DIR = process.env.NODE_ENV === 'production' ? '/tmp/uploads' : path.join(process.cwd(), "uploads");
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (e) { console.warn('Could not create UPLOADS_DIR', e); }

app.use("/uploads", express.static(UPLOADS_DIR));

const DATA_DIR = process.env.NODE_ENV === 'production' ? '/tmp/data' : path.join(process.cwd(), "data");`;

code = code.replace(oldDirs, newDirs);

fs.writeFileSync('server.ts', code);
