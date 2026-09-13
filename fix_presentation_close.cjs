const fs = require('fs');
let content = fs.readFileSync('src/components/PresentationView.tsx', 'utf-8');

const closeBtn = `
          {/* Close Presentation Button */}
          {onClosePresentation && (
            <button
              onClick={onClosePresentation}
              className="p-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white border border-rose-400 font-bold flex items-center gap-1.5 shadow-md shadow-rose-500/20 transition-all cursor-pointer"
              title="Đóng tệp và trở về kho bài giảng"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              <span className="hidden xl:inline">Đóng Tệp</span>
            </button>
          )}
        </div>
      </div>
`;

content = content.replace(
  '        </div>\n      </div>\n\n      {/* Upload & Progress Floating Toast */}',
  closeBtn + '\n      {/* Upload & Progress Floating Toast */}'
);

fs.writeFileSync('src/components/PresentationView.tsx', content);
