const fs = require('fs');
let code = fs.readFileSync('src/components/PresentationView.tsx', 'utf8');

// 1. Add state
code = code.replace(
  "const [isFullscreen, setIsFullscreen] = useState<boolean>(false);",
  "const [isFullscreen, setIsFullscreen] = useState<boolean>(false);\n  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState<boolean>(false);"
);

// 2. Add collapse button and floating expand button
const toolbarStripStart = `      {/* Hidden File Input for Teacher Uploads */}`;
const replacementStart = `      {/* Hidden File Input for Teacher Uploads */}
      {/* Floating expand button when collapsed */}
      {isToolbarCollapsed && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-50 p-1">
          <button
            onClick={() => setIsToolbarCollapsed(false)}
            className="px-4 py-1 rounded-b-xl bg-slate-900/90 border border-t-0 border-slate-700 text-slate-300 hover:text-white shadow-lg backdrop-blur-md flex items-center justify-center cursor-pointer transition-all hover:bg-slate-800"
            title="Hiện thanh công cụ (Toolbar)"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>
      )}`;

code = code.replace("      {/* Hidden File Input for Teacher Uploads */}", replacementStart);

// 3. Conditional render of Top Slide Control Strip
const stripRegex = /      \{\/\* Top Slide Control Strip \*\/\}\n      <div className="flex items-center justify-between px-4 md:px-6 py-2\.5 bg-slate-900\/95 border-b border-slate-800 z-30 flex-wrap gap-2 text-white">/g;

code = code.replace(stripRegex, `      {/* Top Slide Control Strip */}
      {!isToolbarCollapsed && (
      <div className="flex items-center justify-between px-4 md:px-6 py-2.5 bg-slate-900/95 border-b border-slate-800 z-30 flex-wrap gap-2 text-white">`);

// 4. Close the div for Top Slide Control Strip
const stripEndRegex = /      \{\/\* Upload & Progress Floating Toast \*\/\}/g;
code = code.replace(stripEndRegex, `      </div>\n      )}\n      {/* Upload & Progress Floating Toast */}`);

fs.writeFileSync('src/components/PresentationView.tsx', code);
