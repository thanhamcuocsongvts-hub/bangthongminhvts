const fs = require('fs');
let code = fs.readFileSync('src/components/UniversalDocumentViewer.tsx', 'utf8');

const replacement = `          <div className="flex-1 w-full h-full overflow-y-auto p-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-8 rounded-3xl bg-slate-900 border border-indigo-500/40 shadow-2xl max-w-lg w-full space-y-5">
              <Layers className="w-14 h-14 mx-auto text-indigo-400 animate-pulse" />
              <div>
                <h3 className="text-lg font-black text-white">{lesson.title}</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Định dạng: Microsoft PowerPoint (.ppt / .pptx)
                </p>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/10 text-left">
                Để trình chiếu tệp PowerPoint kèm theo toàn bộ hiệu ứng chuyển động đặc trưng một cách mượt mà nhất, vui lòng mở tệp bằng phần mềm PowerPoint gốc trên máy.
              </p>
              
              <div className="flex flex-col gap-3 mt-4">
                {lesson.fileUrl && (
                  <a
                    href={lesson.fileUrl}
                    download={lesson.title.endsWith('.pptx') || lesson.title.endsWith('.ppt') ? lesson.title : \`\${lesson.title}.pptx\`}
                    className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Mở Bằng PowerPoint Gốc (Giữ Hiệu Ứng)
                  </a>
                )}
                {onLaunchSlides && (
                  <button
                    onClick={onLaunchSlides}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
                  >
                    <MonitorPlay className="w-4 h-4" />
                    Tạo Slide Bảng Thông Minh
                  </button>
                )}
              </div>
            </div>
          </div>`;

code = code.replace(/          <div className="flex-1 w-full h-full overflow-y-auto p-6 flex flex-col items-center justify-center text-center space-y-4">\n            <div className="p-8 rounded-3xl bg-slate-900 border border-indigo-500\/40 shadow-2xl max-w-lg w-full space-y-4">[\s\S]*?<\/div>\n          <\/div>/, replacement);
fs.writeFileSync('src/components/UniversalDocumentViewer.tsx', code);
