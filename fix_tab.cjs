const fs = require('fs');
let code = fs.readFileSync('src/components/EducationalAuthScreen.tsx', 'utf8');

code = code.replace(/setMode\('login'\);/, "setTab('login');");

fs.writeFileSync('src/components/EducationalAuthScreen.tsx', code);
