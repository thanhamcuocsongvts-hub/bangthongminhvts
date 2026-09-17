const fs = require('fs');

let code = fs.readFileSync('firestore.rules', 'utf8');

if (!code.includes('/TaiLieuGiaoVien/')) {
  code = code.replace(
    "match /files/{fileId} {",
    "match /TaiLieuGiaoVien/{docId} {\n      allow create: if isAuthenticated() && request.resource.data.uid == request.auth.uid;\n      allow read, update, delete: if isAuthenticated() && resource.data.uid == request.auth.uid;\n    }\n\n    match /files/{fileId} {"
  );
  fs.writeFileSync('firestore.rules', code);
  console.log("Updated firestore.rules");
}
