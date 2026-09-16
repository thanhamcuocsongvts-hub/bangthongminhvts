const fs = require('fs');
let code = fs.readFileSync('src/components/UniversalDocumentViewer.tsx', 'utf8');

const lines = code.split('\n');

const pptxReplacement = `        {/* 5. POWERPOINT PRESENTATION VIEWER (.PPTX, .PPT)           */}
        {/* ========================================================= */}
        {fileType === 'pptx' && (
          <div className="flex-1 w-full h-full overflow-y-auto p-6 flex flex-col items-center justify-center text-center bg-gradient-to-br from-orange-950/20 to-slate-950">
            <div className="relative p-10 rounded-3xl bg-slate-900 border border-orange-500/30 shadow-2xl max-w-2xl w-full flex flex-col items-center overflow-hidden">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-600/10 blur-3xl rounded-full pointer-events-none"></div>
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-rose-600/10 blur-3xl rounded-full pointer-events-none"></div>
              
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-500 to-rose-600 p-0.5 shadow-lg shadow-orange-500/30 mb-6 relative z-10 flex items-center justify-center">
                <div className="w-full h-full bg-slate-900 rounded-[22px] flex items-center justify-center">
                   <MonitorPlay className="w-10 h-10 text-orange-500" />
                </div>
              </div>

              <h2 className="text-2xl font-black text-white mb-2 relative z-10">Phòng Trình Chiếu PowerPoint</h2>
              <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 relative z-10">
                Để giữ nguyên 100% các hiệu ứng (Animations), âm thanh và cấu trúc Slide phức tạp gốc, hãy mở trực tiếp bằng phần mềm PowerPoint trên máy.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 w-full relative z-10">
                {lesson.fileUrl ? (
                  <a
                    href={lesson.fileUrl}
                    download={lesson.title.endsWith('.pptx') || lesson.title.endsWith('.ppt') ? lesson.title : \`\${lesson.title}.pptx\`}
                    className="flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-orange-600 to-rose-600 hover:from-orange-500 hover:to-rose-500 text-white font-black text-lg flex flex-col items-center justify-center gap-1 shadow-xl shadow-orange-600/20 transition-all hover:scale-105 active:scale-95"
                  >
                    <div className="flex items-center gap-2">
                      <Download className="w-6 h-6" />
                      <span>Mở Trình Chiếu PowerPoint</span>
                    </div>
                    <span className="text-[10px] font-medium text-orange-200 uppercase tracking-widest">Giữ nguyên 100% hiệu ứng gốc</span>
                  </a>
                ) : (
                  <div className="flex-1 py-4 rounded-2xl bg-slate-800 text-slate-500 font-bold text-sm flex items-center justify-center border border-slate-700">
                    Chưa tải được dữ liệu tệp. Vui lòng tải lại trang.
                  </div>
                )}
              </div>
              
              <div className="w-full mt-6 pt-6 border-t border-slate-800/80 flex items-start gap-4 text-left relative z-10">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Info className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200 mb-1">Hướng dẫn</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sau khi bấm nút, tệp sẽ được tải xuống. Thầy/Cô chỉ cần click mở tệp vừa tải ở góc màn hình trình duyệt, phần mềm PowerPoint sẽ tự bật lên sẵn sàng trình chiếu với đầy đủ hiệu ứng.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}`;

// replace lines 500 to 546
lines.splice(499, 47, pptxReplacement);

let newCode = lines.join('\n');
if (!newCode.includes('Info')) {
  newCode = newCode.replace(/import \{([\s\S]*?)FileText/, "import { Info, $1FileText");
}
fs.writeFileSync('src/components/UniversalDocumentViewer.tsx', newCode);
