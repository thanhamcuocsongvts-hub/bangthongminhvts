const fs = require('fs');

let code = fs.readFileSync('src/components/UniversalDocumentViewer.tsx', 'utf8');

// Ensure PPTXViewer is imported
if (!code.includes('PPTXViewer')) {
  code = code.replace("import { PDFCanvasViewer } from './PDFCanvasViewer';", "import { PDFCanvasViewer } from './PDFCanvasViewer';\nimport { PPTXViewer } from './PPTXViewer';");
}

const lines = code.split('\n');

const pptxReplacement = `        {/* 5. POWERPOINT PRESENTATION VIEWER (.PPTX, .PPT)           */}
        {/* ========================================================= */}
        {fileType === 'pptx' && lesson.fileUrl ? (
          <PPTXViewer url={lesson.fileUrl} />
        ) : fileType === 'pptx' ? (
          <div className="flex-1 w-full h-full flex items-center justify-center bg-slate-950 text-slate-400">
            Không tìm thấy đường dẫn tệp.
          </div>
        ) : null}`;

// We want to replace from line 500 to 553 (inclusive). But indices in array are 0-based.
// Wait, to be safe, let's use regex to replace from {/* 5. POWERPOINT PRESENTATION to {fileType === 'pptx' ... )}
const regex = /\{\/\* 5\. POWERPOINT PRESENTATION VIEWER[\s\S]*?\{\/\* 6\. PLAIN TEXT/;
code = code.replace(regex, pptxReplacement + "\n\n        {/* 6. PLAIN TEXT");

fs.writeFileSync('src/components/UniversalDocumentViewer.tsx', code);
