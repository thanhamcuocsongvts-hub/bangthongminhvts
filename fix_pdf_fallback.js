const fs = require('fs');
let content = fs.readFileSync('src/components/UniversalDocumentViewer.tsx', 'utf8');

const emptyFallback = `
        {/* FALLBACK FOR MISSING FILE URL */}
        {!lesson.fileUrl && (
          <div className="flex-1 w-full h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-900/40">
            <div className="w-20 h-20 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mb-6">
              <FileText className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-200 mb-2">Không tìm thấy nội dung tệp gốc</h3>
            <p className="max-w-md text-sm text-slate-400">
              Tệp tài liệu này (định dạng {fileType.toUpperCase()}) được tải lên từ một thiết bị khác. Do giới hạn của bộ nhớ đám mây nội bộ, tệp dung lượng lớn chỉ lưu cục bộ trên máy đã tải lên.
            </p>
            <p className="max-w-md text-sm text-slate-400 mt-2">
              Vui lòng xóa tệp này và <b>tải lên lại từ thiết bị hiện tại</b> để tiếp tục trình chiếu.
            </p>
          </div>
        )}
`;

if (!content.includes('FALLBACK FOR MISSING FILE URL')) {
  content = content.replace(
    `{/* ========================================================= */}\n        {/* 2. IMAGE VIEWER`,
    emptyFallback + `\n        {/* ========================================================= */}\n        {/* 2. IMAGE VIEWER`
  );
  fs.writeFileSync('src/components/UniversalDocumentViewer.tsx', content);
}
