const fs = require('fs');
let code = fs.readFileSync('src/components/PresentationView.tsx', 'utf8');

const replacement = `      {/* Presentation Workspace Control Panel */}
      {!isFullscreen && (
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md shrink-0">`;

code = code.replace(/      \{\/\* Presentation Workspace Control Panel \*\/\}\n      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 border-b border-slate-800 bg-slate-900\/50 backdrop-blur-md shrink-0">/, replacement);

const replacementEnd = `          )}
        </div>
      )}

      {/* Presentation Area (Single Screen OR Split Screen with Whiteboard) */}`;

code = code.replace(/          \)\}\n        <\/div>\n\n      \{\/\* Presentation Area \(Single Screen OR Split Screen with Whiteboard\) \*\/\}/, replacementEnd);

fs.writeFileSync('src/components/PresentationView.tsx', code);
