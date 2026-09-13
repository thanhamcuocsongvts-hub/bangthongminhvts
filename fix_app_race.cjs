const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// 1. Add isLessonsLoaded state
content = content.replace(
  'const [isAILoading, setIsAILoading] = useState<boolean>(false);',
  'const [isAILoading, setIsAILoading] = useState<boolean>(false);\n  const [isLessonsLoaded, setIsLessonsLoaded] = useState<boolean>(false);'
);

// 2. Set isLessonsLoaded to true after load
content = content.replace(
  "console.warn('IndexedDB initial load note:', err);\n      });\n\n    // Cross-device sync",
  "console.warn('IndexedDB initial load note:', err);\n      })\n      .finally(() => setIsLessonsLoaded(true));\n\n    // Cross-device sync"
);

// 3. Prevent save on mount if not loaded
content = content.replace(
  '  // Save to LocalStorage & IndexedDB (Bypassing browser 5MB quota with IndexedDB)\n  useEffect(() => {\n    if (isGuestMode) return;',
  '  // Save to LocalStorage & IndexedDB (Bypassing browser 5MB quota with IndexedDB)\n  useEffect(() => {\n    if (isGuestMode || !isLessonsLoaded) return;'
);

fs.writeFileSync('src/App.tsx', content);
