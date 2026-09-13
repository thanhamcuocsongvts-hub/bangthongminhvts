const fs = require('fs');
let content = fs.readFileSync('src/utils/fileParser.ts', 'utf-8');

const target = `  // Fallback to public temporary hosting for Office files if no Firebase Auth is present
  // Microsoft Office Web Viewer REQUIRES a public URL to work.
  if (!serverFileUrl && ['pptx', 'ppt', 'docx', 'doc', 'xlsx', 'xls'].includes(ext)) {
    try {
      console.log('Uploading office file to tmpfiles.org for public viewer access...');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: formData
      });
      const json = await res.json();
      if (json.status === 'success' && json.data?.url) {
        // Convert https://tmpfiles.org/12345/file.ext to https://tmpfiles.org/dl/12345/file.ext
        effectiveFileUrl = json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
      }
    } catch (e) {
      console.error('tmpfiles fallback upload failed:', e);
    }
  }`;

content = content.replace(target, `  // Microsoft Office Web Viewer requires a public URL, but tmpfiles is unreliable.
  // We will now rely on our robust internal DocumentViewer for all offline rendering.`);

fs.writeFileSync('src/utils/fileParser.ts', content);
