const fs = require('fs');
let code = fs.readFileSync('src/components/UniversalDocumentViewer.tsx', 'utf8');

const newPptxViewer = `        {/* 5. POWERPOINT PRESENTATION VIEWER (.PPTX, .PPT)           */}
        {/* ========================================================= */}
        {fileType === 'pptx' && (
          <div className="flex-1 w-full h-full bg-slate-950 flex flex-col relative">
            {lesson.fileUrl && !lesson.fileUrl.startsWith('blob:') && !lesson.fileUrl.startsWith('data:') ? (
              <div className="flex-1 w-full h-full relative z-10 bg-white overflow-hidden">
                <DocViewer 
                  documents={[{ uri: lesson.fileUrl, fileType: fileType, fileName: lesson.title }]}
                  pluginRenderers={DocViewerRenderers}
                  config={{
                    header: { disableHeader: true, disableFileName: true, retainURLParams: false }
                  }}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            ) : (
              <div className="flex-1 w-full h-full overflow-y-auto p-6 flex flex-col items-center justify-center text-center bg-gradient-to-br from-orange-950/20 to-slate-950">
                <div className="relative p-10 rounded-3xl bg-slate-900 border border-orange-500/30 shadow-2xl max-w-2xl w-full flex flex-col items-center overflow-hidden">
                  <div className="absolute -top-24 -right-24 w-64 h-64 bg-orange-600/10 blur-3xl rounded-full pointer-events-none"></div>
                  <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-rose-600/10 blur-3xl rounded-full pointer-events-none"></div>
                  
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-500 to-rose-600 p-0.5 shadow-lg shadow-orange-500/30 mb-6 relative z-10 flex items-center justify-center">
                    <div className="w-full h-full bg-slate-900 rounded-[22px] flex items-center justify-center">
                       <MonitorPlay className="w-10 h-10 text-orange-500" />
                    </div>
                  </div>

                  <h2 className="text-2xl font-black text-white mb-2 relative z-10">Đã Tích Hợp Thư Viện Trình Chiếu Web</h2>
                  <p className="text-slate-400 text-sm max-w-md mx-auto mb-6 relative z-10">
                    Ứng dụng đã được tích hợp thư viện DocViewer để hiển thị hiệu ứng chuyển slide. Tuy nhiên, thư viện yêu cầu tệp phải có <b>đường dẫn lưu trữ đám mây (Public URL)</b>. Tệp hiện tại đang lưu cục bộ (offline) trên máy của Thầy/Cô.
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
                          <span>Mở Bằng PowerPoint Gốc</span>
                        </div>
                      </a>
                    ) : (
                      <div className="flex-1 py-4 rounded-2xl bg-slate-800 text-slate-500 font-bold text-sm flex items-center justify-center border border-slate-700">
                        Chưa tải được dữ liệu tệp.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}`;

// replace the old block
const regex = /\{\/\* 5\. POWERPOINT PRESENTATION VIEWER[\s\S]*?\{\/\* 6\. OTHER FALLBACK VIEWER/;
code = code.replace(regex, newPptxViewer + "\n        {/* 6. OTHER FALLBACK VIEWER");
fs.writeFileSync('src/components/UniversalDocumentViewer.tsx', code);
