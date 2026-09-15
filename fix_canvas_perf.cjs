const fs = require('fs');
let code = fs.readFileSync('src/components/ClassroomBlackboardView.tsx', 'utf8');

// Disable expensive shadowBlur during live rendering
code = code.replace(/ctx\.shadowBlur = 12;/g, 'ctx.shadowBlur = 0;');
code = code.replace(/ctx\.shadowBlur = 8;/g, 'ctx.shadowBlur = 0;');
code = code.replace(/ctx\.shadowBlur = isFluo \? 8 : 1;/g, 'ctx.shadowBlur = 0;');

fs.writeFileSync('src/components/ClassroomBlackboardView.tsx', code);
