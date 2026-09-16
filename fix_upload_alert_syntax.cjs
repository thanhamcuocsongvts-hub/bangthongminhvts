const fs = require('fs');
let code = fs.readFileSync('src/components/DocumentLibrary.tsx', 'utf8');

const replacement = `      if (file.size > 20 * 1024 * 1024) {
        setUploadStatus(\`Đã nạp "\${newDoc.title}". (Lưu ý: Tệp > 20MB nên chỉ được lưu cục bộ trên máy này, Tivi trường sẽ chỉ nhận được tên bài giảng)\`);
      } else {
        setUploadStatus(\`Đã nạp và đồng bộ Đám mây thành công tài liệu "\${newDoc.title}"!\`);
      }
      setTimeout(() => setUploadStatus(null), 5000);`;

code = code.replace(/      if \(file\.size > 20 \* 1024 \* 1024\) \{[\s\S]*?      setTimeout\(\(\) => setUploadStatus\(null\), 5000\);/, replacement);
fs.writeFileSync('src/components/DocumentLibrary.tsx', code);
