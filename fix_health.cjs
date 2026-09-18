const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const oldCheck = `app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));`;

const newCheck = `app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});`;

code = code.replace(oldCheck, newCheck);
fs.writeFileSync('server.ts', code);
