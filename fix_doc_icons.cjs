const fs = require('fs');
let docCode = fs.readFileSync('src/components/UniversalDocumentViewer.tsx', 'utf8');
const docImport = `import { 
  X, ZoomIn, ZoomOut, Search, FileText, ChevronRight, Download, MonitorPlay,
  Share2, Maximize, FileSpreadsheet, RotateCw, Layers, Pen, Check, Copy, ExternalLink, Table
} from 'lucide-react';`;
docCode = docCode.replace(/import \{[\s\S]*?\} from 'lucide-react';/, docImport);
fs.writeFileSync('src/components/UniversalDocumentViewer.tsx', docCode);
