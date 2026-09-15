const fs = require('fs');

// 1. Update HeaderBar.tsx
let headerCode = fs.readFileSync('src/components/HeaderBar.tsx', 'utf8');
if (!headerCode.includes('syncStatus?:')) {
  headerCode = headerCode.replace(/activeLessonTitle: string;/, "activeLessonTitle: string;\n  syncStatus?: 'synced' | 'syncing' | 'offline' | 'error';");
  
  const iconImport = `import { \n  Maximize, \n  Minimize, \n  Download, \n  QrCode, \n  User, \n  Settings, \n  Users, \n  MonitorPlay, \n  BookOpen, \n  CheckCircle2, \n  Trophy, \n  Gamepad2, \n  MessageSquare, \n  PenTool,\n  Cloud, CloudOff, CloudUpload, CloudDrizzle\n} from 'lucide-react';`;
  headerCode = headerCode.replace(/import \{[\s\S]*?\} from 'lucide-react';/, iconImport);
  
  const syncComponent = `
        {/* Sync Status Indicator */}
        <div className="flex items-center justify-center px-2">
          {syncStatus === 'offline' && <CloudOff className="w-5 h-5 text-red-400" title="Đang ngoại tuyến" />}
          {syncStatus === 'syncing' && <CloudUpload className="w-5 h-5 text-amber-400 animate-bounce" title="Đang đồng bộ..." />}
          {syncStatus === 'synced' && <Cloud className="w-5 h-5 text-emerald-400" title="Đã đồng bộ lên Đám mây" />}
          {syncStatus === 'error' && <CloudDrizzle className="w-5 h-5 text-rose-500" title="Lỗi đồng bộ" />}
        </div>
        
        <div className="h-6 w-px bg-slate-700 mx-1 hidden sm:block"></div>
  `;
  
  headerCode = headerCode.replace(/<div className="h-6 w-px bg-slate-700 mx-1 hidden sm:block"><\/div>/, syncComponent);
  fs.writeFileSync('src/components/HeaderBar.tsx', headerCode);
}

// 2. Update App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf8');
if (!appCode.includes('const [syncStatus, setSyncStatus]')) {
  appCode = appCode.replace(/const \[isGuestMode, setIsGuestMode\] = useState<boolean>\(false\);/, "const [isGuestMode, setIsGuestMode] = useState<boolean>(false);\n  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');");
  
  appCode = appCode.replace(/<HeaderBar/, "<HeaderBar\n        syncStatus={syncStatus}");
  
  // Update sync handlers
  const oldSyncTeachers = `  const syncTeachersToCloud = async (newTeachers: any[]) => {
    if ((window as any).teacherSyncTimeout) clearTimeout((window as any).teacherSyncTimeout);
    (window as any).teacherSyncTimeout = setTimeout(async () => {
      try {
        const sanitized = JSON.parse(JSON.stringify(newTeachers));
        await setDoc(doc(db, 'global_store', 'smartboard_data'), { teachers: sanitized }, { merge: true });
        fetch('/api/teachers/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teachers: sanitized }),
        }).catch(() => {});
      } catch (e) {
        console.warn('Sync to Firestore failed:', e);
      }
    }, 5000);
  };`;
  
  const newSyncTeachers = `  const syncTeachersToCloud = async (newTeachers: any[]) => {
    setSyncStatus('syncing');
    if ((window as any).teacherSyncTimeout) clearTimeout((window as any).teacherSyncTimeout);
    (window as any).teacherSyncTimeout = setTimeout(async () => {
      if (!navigator.onLine) {
        setSyncStatus('offline');
        return;
      }
      try {
        const sanitized = JSON.parse(JSON.stringify(newTeachers));
        await setDoc(doc(db, 'global_store', 'smartboard_data'), { teachers: sanitized }, { merge: true });
        fetch('/api/teachers/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teachers: sanitized }),
        }).catch(() => {});
        setSyncStatus('synced');
      } catch (e) {
        console.warn('Sync to Firestore failed:', e);
        setSyncStatus('error');
      }
    }, 2000);
  };`;
  
  appCode = appCode.replace(/  const syncTeachersToCloud = async \(newTeachers: any\[\]\) => \{[\s\S]*?\}, 5000\);\n  \};/, newSyncTeachers);
  
  // Offline listener
  const effectCode = `  // Sync teachers across devices (PC <-> Mobile)
  useEffect(() => {
    const handleOnline = () => setSyncStatus('synced');
    const handleOffline = () => setSyncStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (!navigator.onLine) setSyncStatus('offline');`;
    
  appCode = appCode.replace(/  \/\/ Sync teachers across devices \(PC <-> Mobile\)\n  useEffect\(\(\) => \{/, effectCode);
  
  appCode = appCode.replace(/      unsubLessons\(\);\n    \};\n  \}, \[isGuestMode\]\);/, "      unsubLessons();\n      window.removeEventListener('online', handleOnline);\n      window.removeEventListener('offline', handleOffline);\n    };\n  }, [isGuestMode]);");
  
  fs.writeFileSync('src/App.tsx', appCode);
}
