const fs = require('fs');

// Fix HeaderBar.tsx
let headerCode = fs.readFileSync('src/components/HeaderBar.tsx', 'utf8');
const iconImport = `import { 
  Maximize, Minimize, Download, QrCode, User, Settings, Users, MonitorPlay, 
  BookOpen, CheckCircle2, Trophy, Gamepad2, MessageSquare, PenTool,
  Cloud, CloudOff, CloudUpload, CloudDrizzle,
  Presentation, CheckSquare, Globe, BarChart3, FolderOpen, Bot, ShieldCheck, 
  KeyRound, RefreshCw, LogOut, LogIn, Dices, Type
} from 'lucide-react';`;
headerCode = headerCode.replace(/import \{[\s\S]*?\} from 'lucide-react';/, iconImport);
fs.writeFileSync('src/components/HeaderBar.tsx', headerCode);

// Fix UniversalDocumentViewer.tsx
let docCode = fs.readFileSync('src/components/UniversalDocumentViewer.tsx', 'utf8');
const docImport = `import { 
  X, ZoomIn, ZoomOut, Search, FileText, ChevronRight, Download, MonitorPlay,
  Share2, Maximize, FileSpreadsheet, RotateCw, Layers
} from 'lucide-react';`;
docCode = docCode.replace(/import \{[\s\S]*?\} from 'lucide-react';/, docImport);
fs.writeFileSync('src/components/UniversalDocumentViewer.tsx', docCode);

