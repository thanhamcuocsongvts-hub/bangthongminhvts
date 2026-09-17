const fs = require('fs');
let code = fs.readFileSync('src/components/PresentationView.tsx', 'utf8');

const docSwitcherHTML = `          {/* Document Switcher Dropdown */}
          {allLessons.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowDocPicker(!showDocPicker)}
                className="px-3 py-1.5 rounded-xl border border-amber-600/50 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                title="Chọn tệp từ Kho bài giảng đã lưu"
              >
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Chọn Từ Kho:</span>
                <span className="max-w-[140px] truncate">{lesson.title}</span>
                <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
              </button>
              {showDocPicker && (
                <div className="absolute top-full left-0 mt-1.5 w-72 max-h-80 overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 custom-scrollbar">
                  <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    Kho Bài Giảng Của Bạn ({allLessons.length})
                  </div>
                  {allLessons.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => {
                        onSelectLesson?.(l);
                        setCurrentSlideIndex(0);
                        setShowDocPicker(false);
                      }}
                      className={\`w-full p-2 rounded-xl text-left text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer \${
                        l.id === lesson.id
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800'
                      }\`}
                    >
                      <File className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span className="truncate flex-1">{l.title}</span>
                      <span className="text-[10px] opacity-75 uppercase font-mono">{l.fileType}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}`;

code = code.replace(/          \{\/\* Document Switcher Dropdown \*\/\}[\s\S]*?          \)\}/, docSwitcherHTML);
fs.writeFileSync('src/components/PresentationView.tsx', code);
