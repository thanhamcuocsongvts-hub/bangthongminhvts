import React, { useState, useRef, useEffect } from 'react';
import { 
  Maximize, Minimize, Download, QrCode, Users, 
  BookOpen, Trophy, PenTool, CheckSquare, Globe, 
  FolderOpen, ShieldCheck, KeyRound, RefreshCw, LogOut, 
  LogIn, Dices, Type, ChevronDown, Smartphone, ExternalLink
} from 'lucide-react';
import { TextScale, TeacherProfile } from '../types';

export type ActiveTab =
  | 'whiteboard'
  | 'gradebook'
  | 'documents'
  | 'reader'
  | 'quiz'
  | 'games'
  | 'embed';

interface HeaderBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  textScale: TextScale;
  onTextScaleChange: (scale: TextScale) => void;
  roomPin: string;
  onOpenQR: () => void;
  onOpenExport: () => void;
  onOpenTeacherAuth: () => void;
  onOpenProfile?: () => void;
  onOpenAdmin?: () => void;
  onOpenRandomPicker: () => void;
  onSwitchToStudentView: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  activeLessonTitle: string;
  syncStatus?: 'synced' | 'syncing' | 'offline' | 'error';
  activeTeacher: TeacherProfile | null;
  onLogout: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeTab,
  onTabChange,
  textScale,
  onTextScaleChange,
  roomPin,
  onOpenQR,
  onOpenExport,
  onOpenTeacherAuth,
  onOpenProfile,
  onOpenAdmin,
  onOpenRandomPicker,
  onSwitchToStudentView,
  isFullscreen,
  onToggleFullscreen,
  activeTeacher,
  onLogout,
}) => {
  // Dropdown menus for Teacher profile & Student room portal to keep header uncluttered
  const [showTeacherMenu, setShowTeacherMenu] = useState<boolean>(false);
  const [showStudentMenu, setShowStudentMenu] = useState<boolean>(false);

  const teacherMenuRef = useRef<HTMLDivElement>(null);
  const studentMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (teacherMenuRef.current && !teacherMenuRef.current.contains(e.target as Node)) {
        setShowTeacherMenu(false);
      }
      if (studentMenuRef.current && !studentMenuRef.current.contains(e.target as Node)) {
        setShowStudentMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 7 Main Navigation Tabs - clean, prominent, fully visible outside
  const tabs: Array<{ id: ActiveTab; label: string; icon: React.ReactNode }> = [
    { id: 'whiteboard', label: 'Bảng Xanh & Bút Viết', icon: <PenTool className="w-4 h-4 text-emerald-600" /> },
    { id: 'gradebook', label: 'Quản Lý Lớp Học', icon: <Users className="w-4 h-4 text-blue-600" /> },
    { id: 'documents', label: 'Kho Bài Giảng', icon: <FolderOpen className="w-4 h-4 text-amber-600" /> },
    { id: 'reader', label: 'Mở Tài Liệu', icon: <BookOpen className="w-4 h-4 text-sky-600" /> },
    { id: 'quiz', label: 'Trắc Nghiệm & Phân Tích', icon: <CheckSquare className="w-4 h-4 text-amber-500" /> },
    { id: 'games', label: 'Trò Chơi Ôn Tập', icon: <Trophy className="w-4 h-4 text-rose-500" /> },
    { id: 'embed', label: 'Nhúng Web/YouTube', icon: <Globe className="w-4 h-4 text-purple-600" /> },
  ];

  return (
    <header className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 md:px-4 py-2 flex items-center justify-between gap-3 select-none z-30 shadow-xs relative">
      {/* 1. LEFT: Compact & Elegant Teacher Account Menu */}
      <div className="relative shrink-0" ref={teacherMenuRef}>
        {activeTeacher ? (
          <div>
            <button
              onClick={() => setShowTeacherMenu((prev) => !prev)}
              className="flex items-center gap-2 p-1.5 pr-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all text-left shadow-xs cursor-pointer group"
              title="Quản lý tài khoản giáo viên & thông tin cá nhân"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-100/80 border border-indigo-200 flex items-center justify-center text-lg shadow-xs group-hover:scale-105 transition-transform">
                {activeTeacher.avatar || '👨‍🏫'}
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-xs md:text-sm text-slate-900 max-w-[130px] truncate">
                    {activeTeacher.name}
                  </span>
                  {activeTeacher.role === 'admin' ? (
                    <span className="px-1.5 py-0.2 rounded-md bg-amber-400 text-slate-950 text-[9px] font-black uppercase">
                      Admin
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-800 text-[9px] font-extrabold uppercase">
                      {activeTeacher.subject || 'GV'}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500 truncate max-w-[130px]">
                  {activeTeacher.school || 'Trường học'}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition-transform" />
            </button>

            {/* Dropdown Menu for Teacher options */}
            {showTeacherMenu && (
              <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3.5 py-2 border-b border-slate-100">
                  <div className="font-bold text-xs text-slate-900">{activeTeacher.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">{activeTeacher.email || 'GiaoVien@smartboard.edu.vn'}</div>
                </div>

                {activeTeacher.role === 'admin' && (
                  <button
                    onClick={() => {
                      setShowTeacherMenu(false);
                      onOpenAdmin?.();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-bold text-amber-700 hover:bg-amber-50 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Quản Trị Admin Hệ Thống</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowTeacherMenu(false);
                    onOpenProfile?.();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 text-slate-500" />
                  <span>Sửa thông tin & Đổi mật khẩu</span>
                </button>

                <button
                  onClick={() => {
                    setShowTeacherMenu(false);
                    onOpenTeacherAuth();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-slate-500" />
                  <span>Chuyển tài khoản giáo viên</span>
                </button>

                <div className="my-1 border-t border-slate-100" />

                <button
                  onClick={() => {
                    setShowTeacherMenu(false);
                    onLogout();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Đăng xuất tài khoản</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenTeacherAuth}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng Nhập / Đăng Ký GV</span>
          </button>
        )}
      </div>

      {/* 2. CENTER: Main Navigation Tabs Displayed Outside Clearly */}
      <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/80 overflow-x-auto max-w-[62vw] smooth-touch-scroll">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-btn-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-2 rounded-xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {tab.icon}
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 3. RIGHT: Lucky Wheel, Student Portal Menu, Text Scale, Export, Fullscreen */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Lucky Random Picker Quick Trigger (Kept prominently as requested) */}
        <button
          onClick={onOpenRandomPicker}
          className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
          title="Mở trò chơi vòng quay may mắn gọi học sinh ngẫu nhiên"
        >
          <Dices className="w-4 h-4" />
          <span className="whitespace-nowrap">Quay Gọi HS</span>
        </button>

        {/* Student Portal Dropdown: PIN, QR Code & Student View unified */}
        <div className="relative" ref={studentMenuRef}>
          <button
            onClick={() => setShowStudentMenu((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="Mở menu quản lý học sinh nộp bài và mã PIN phòng"
          >
            <QrCode className="w-4 h-4 text-emerald-600" />
            <span className="font-mono font-black">{roomPin}</span>
            <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
          </button>

          {showStudentMenu && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-2">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">MÃ PIN VÀO PHÒNG</div>
                <div className="text-2xl font-mono font-black text-emerald-900 tracking-wider my-0.5">{roomPin}</div>
                <div className="text-[11px] text-emerald-700">Học sinh nhập mã PIN để nộp bài</div>
              </div>

              <button
                onClick={() => {
                  setShowStudentMenu(false);
                  onOpenQR();
                }}
                className="w-full p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-emerald-600" />
                <span>Quét mã QR vào phòng</span>
              </button>

              <button
                onClick={() => {
                  setShowStudentMenu(false);
                  onSwitchToStudentView();
                }}
                className="w-full p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Smartphone className="w-4 h-4 text-indigo-600" />
                <span>Mở giao diện làm bài của HS</span>
              </button>
            </div>
          )}
        </div>

        {/* Text Scale for 75" TV Back Row Readability */}
        <div className="hidden xl:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <Type className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-1" />
          <button
            onClick={() => onTextScaleChange('normal')}
            className={`px-1.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              textScale === 'normal' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            100%
          </button>
          <button
            onClick={() => onTextScaleChange('large')}
            className={`px-1.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              textScale === 'large' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            125%
          </button>
          <button
            onClick={() => onTextScaleChange('huge')}
            className={`px-1.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              textScale === 'huge' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            150%
          </button>
        </div>

        {/* Export Button */}
        <button
          id="header-export-btn"
          onClick={onOpenExport}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-all shadow-xs cursor-pointer"
          title="Xuất bài giảng ra Word, Excel, PPT, PDF, Ảnh HD"
        >
          <Download className="w-4 h-4 text-indigo-600" />
        </button>

        {/* Fullscreen TV Toggle */}
        <button
          onClick={onToggleFullscreen}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-all shadow-xs cursor-pointer"
          title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình Tivi 75 inch'}
        >
          {isFullscreen ? <Minimize className="w-4 h-4 text-amber-600" /> : <Maximize className="w-4 h-4 text-slate-700" />}
        </button>
      </div>
    </header>
  );
};
