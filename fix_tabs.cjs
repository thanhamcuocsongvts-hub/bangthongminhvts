const fs = require('fs');
let code = fs.readFileSync('src/components/HeaderBar.tsx', 'utf8');

const newTabs = `  const tabs: Array<{ id: ActiveTab; label: string; icon: React.ReactNode }> = [
    { id: 'whiteboard', label: 'Bảng Xanh & Bút Viết', icon: <PenTool className="w-5 h-5 text-emerald-600" /> },
    { id: 'gradebook', label: 'Quản Lý Lớp Học', icon: <Users className="w-5 h-5 text-blue-600" /> },
    { id: 'documents', label: 'Kho Bài Giảng', icon: <FolderOpen className="w-5 h-5 text-amber-600" /> },
    { id: 'presentation', label: 'Trình Chiếu', icon: <Presentation className="w-5 h-5 text-indigo-600" /> },
    { id: 'reader', label: 'Mở Tài Liệu', icon: <BookOpen className="w-5 h-5 text-blue-600" /> },
    { id: 'quiz', label: 'Trắc Nghiệm Tức Thì', icon: <CheckSquare className="w-5 h-5 text-amber-500" /> },
    { id: 'games', label: 'Trò Chơi Ôn Tập', icon: <Trophy className="w-5 h-5 text-rose-500" /> },
    { id: 'embed', label: 'Nhúng Web/YouTube', icon: <Globe className="w-5 h-5 text-purple-600" /> },
    { id: 'analytics', label: 'Biểu Đồ Phân Tích', icon: <BarChart3 className="w-5 h-5 text-teal-600" /> },
    { id: 'ai_chat', label: 'Trợ Lý AI', icon: <Bot className="w-5 h-5 text-purple-600" /> },
  ];`;

code = code.replace(/  const tabs: Array<\{ id: ActiveTab; label: string; icon: React\.ReactNode \}> = \[[\s\S]*?  \];/, newTabs);
fs.writeFileSync('src/components/HeaderBar.tsx', code);
