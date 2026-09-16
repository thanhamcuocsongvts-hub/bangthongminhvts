const fs = require('fs');
let code = fs.readFileSync('src/components/DocumentLibrary.tsx', 'utf8');

const replacement = `    try {
      const newDoc = await parseUploadedFileToLesson(file, activeTeacher?.name, activeTeacher?.id);
      onAddLesson(newDoc);
      if (file.size > 250000) {
        setUploadStatus(\`Đã nạp "\${newDoc.title}". (Lưu ý: Tệp > 250KB nên chỉ được lưu cục bộ trên máy này, Tivi trường sẽ chỉ nhận được tên bài giảng)\`);
      } else {
        setUploadStatus(\`Đã nạp và đồng bộ Đám mây thành công tài liệu "\${newDoc.title}"!\`);
      }
      setTimeout(() => setUploadStatus(null), 5000);
    } catch (err: any) {`;

code = code.replace(/    try \{\n      const newDoc = await parseUploadedFileToLesson\(file, activeTeacher\?.name, activeTeacher\?.id\);\n      onAddLesson\(newDoc\);\n      setUploadStatus\(`Đã nạp thành công tài liệu "\$\{newDoc.title\}"!`\);\n      setTimeout\(\(\) => setUploadStatus\(null\), 3500\);\n    \} catch \(err: any\) \{/, replacement);
fs.writeFileSync('src/components/DocumentLibrary.tsx', code);
