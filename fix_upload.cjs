const fs = require('fs');
let code = fs.readFileSync('src/components/DocumentLibrary.tsx', 'utf8');

const replacement = `    // File size safety check: Ensure fast sync and stability
    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage('Tệp quá lớn (> 20MB). Hệ thống không hỗ trợ tải lên file dung lượng cao để đảm bảo đồng bộ đám mây. Vui lòng giảm dung lượng hoặc lưu trên Google Drive/OneDrive rồi gửi link thay thế.');
      return;
    }`;

code = code.replace(/    \/\/ File size safety check: Support large files up to 250MB\n    if \(file.size > 250 \* 1024 \* 1024\) \{\n      setErrorMessage\('Tệp quá lớn \(> 250MB\)\. Vui lòng chọn tệp nhỏ hơn 250MB\.'\);\n      return;\n    \}/, replacement);
fs.writeFileSync('src/components/DocumentLibrary.tsx', code);
