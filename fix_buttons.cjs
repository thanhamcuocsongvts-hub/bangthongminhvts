const fs = require('fs');
let code = fs.readFileSync('src/components/PresentationView.tsx', 'utf8');

const replacement = `          {/* Collapse Toolbar Button */}
          <button
            onClick={() => setIsToolbarCollapsed(true)}
            className="p-2 rounded-xl border border-slate-700 bg-slate-800 text-amber-400 hover:bg-slate-700 hover:text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            title="Thu gọn thanh công cụ lên trên"
          >
            <ChevronUp className="w-4 h-4 stroke-[2.5]" />
            <span className="hidden xl:inline">Thu gọn</span>
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            id="toggle-presentation-fullscreen-btn"
            onClick={togglePresentationFullscreen}
            className={\`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer \${
              isFullscreen
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md ring-2 ring-amber-300 font-black'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white'
            }\`}
            title={isFullscreen ? 'Thoát toàn màn hình (Phím Esc)' : 'Phóng toàn màn hình 75 inch bài giảng'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
            <span className="hidden xl:inline">{isFullscreen ? 'Thoát Toàn Màn Hình' : 'Toàn màn hình'}</span>
          </button>`;

code = code.replace(/          \{\/\* Fullscreen Toggle Button \*\/\}[\s\S]*?            <span className="hidden xl:inline">\{isFullscreen \? 'Thu nhỏ' : 'Toàn màn hình'\}<\/span>\n          <\/button>/, replacement);

// ensure ChevronUp and ChevronDown are imported
if (!code.includes('ChevronUp')) {
  code = code.replace(/import \{([\s\S]*?)ChevronDown/, "import { ChevronUp, ChevronDown");
}

fs.writeFileSync('src/components/PresentationView.tsx', code);
