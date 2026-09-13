const fs = require('fs');
let content = fs.readFileSync('src/components/DocumentLibrary.tsx', 'utf-8');

// 1. Add activeTeacher to props
content = content.replace(
  'interface DocumentLibraryProps {\n  lessons: LessonDoc[];',
  "import { TeacherProfile } from '../types';\n\ninterface DocumentLibraryProps {\n  lessons: LessonDoc[];\n  activeTeacher: TeacherProfile | null;"
);

// 2. Destructure activeTeacher
content = content.replace(
  '  isSyncing,\n}) => {',
  '  isSyncing,\n  activeTeacher,\n}) => {'
);

// 3. Set default author to activeTeacher.name
content = content.replace(
  "  const [newAuthor, setNewAuthor] = useState<string>('Giáo viên bộ môn');",
  "  const [newAuthor, setNewAuthor] = useState<string>(activeTeacher?.name || 'Giáo viên bộ môn');"
);

// 4. Update the author field when adding a lesson to ensure it matches
content = content.replace(
  "author: newAuthor.trim() || 'Giáo viên bộ môn',",
  "author: activeTeacher?.name || newAuthor.trim() || 'Giáo viên bộ môn',"
);

fs.writeFileSync('src/components/DocumentLibrary.tsx', content);
