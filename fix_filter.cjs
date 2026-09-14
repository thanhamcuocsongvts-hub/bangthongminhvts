const fs = require('fs');
let content = fs.readFileSync('src/utils/studentFilter.ts', 'utf8');

// Add "số học sinh đạt", "số học sinh", "hs1045" etc. to the summary keywords if not there
if (!content.includes("'số học sinh đạt'")) {
  content = content.replace(
    `'tổng số',`,
    `'tổng số',\n    'số học sinh đạt',\n    'số học sinh',\n    'hs1045',`
  );
  fs.writeFileSync('src/utils/studentFilter.ts', content);
}
