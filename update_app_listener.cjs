const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `  // Sync teachers across devices (PC <-> Mobile)
  useEffect(() => {
    const handleOnline = () => setSyncStatus('synced');
    const handleOffline = () => setSyncStatus('offline');
    const handleSyncStatus = (e: any) => setSyncStatus(e.detail);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sync-status', handleSyncStatus);
    
    if (!navigator.onLine) setSyncStatus('offline');`;

code = code.replace(/  \/\/ Sync teachers across devices \(PC <-> Mobile\)\n  useEffect\(\(\) => \{\n    const handleOnline = \(\) => setSyncStatus\('synced'\);\n    const handleOffline = \(\) => setSyncStatus\('offline'\);\n    window.addEventListener\('online', handleOnline\);\n    window.addEventListener\('offline', handleOffline\);\n    if \(!navigator.onLine\) setSyncStatus\('offline'\);/, replacement);

code = code.replace(/      window.removeEventListener\('online', handleOnline\);\n      window.removeEventListener\('offline', handleOffline\);\n    \};\n  \}, \[isGuestMode\]\);/, "      window.removeEventListener('online', handleOnline);\n      window.removeEventListener('offline', handleOffline);\n      window.removeEventListener('sync-status', handleSyncStatus);\n    };\n  }, [isGuestMode]);");

fs.writeFileSync('src/App.tsx', code);
