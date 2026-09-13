const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf-8');
console.log(content.includes('signInAnonymously'));
