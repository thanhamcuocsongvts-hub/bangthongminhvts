const fs = require('fs');
let code = fs.readFileSync('src/components/ClassGradebook.tsx', 'utf8');

code = code.replace(/!\(currentClass\.students \|\| \[\]\)\.\|\| \(currentClass\.students \|\| \[\]\)\.\.length \|\| 0 === 0/g, '(!currentClass.students || currentClass.students.length === 0)');
code = code.replace(/\(currentClass\.students \|\| \[\]\)\.\.length \|\| 0/g, '(currentClass.students?.length || 0)');
code = code.replace(/replaceExisting \? \[\] : \(currentClass\.students \|\| \[\]\)\./g, 'replaceExisting ? [] : (currentClass.students || []);');

fs.writeFileSync('src/components/ClassGradebook.tsx', code);
