import React from 'react';
import {
  Tv,
  Presentation,
  BookOpen,
  PenTool,
  CheckSquare,
  BarChart3,
  Users,
  FolderOpen,
  Bot,
  Maximize,
  Minimize,
  QrCode,
  Download,
  Type,
  Dices,
  UserCheck,
  LogOut,
  LogIn,
  Trophy,
  Globe,
} from 'lucide-react';
import { TextScale, TeacherProfile } from '../types';

export type ActiveTab =
  | 'presentation'
  | 'reader'
  | 'whiteboard'
  | 'quiz'
  | 'games'
  | 'embed'
  | 'analytics'
  | 'gradebook'
  | 'documents'
  | 'ai_chat';

interface HeaderBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  textScale: TextScale;
  onTextScaleChange: (scale: TextScale) => void;
  roomPin: string;
  onOpenQR: () => void;
  onOpenExport: () => void;
  onOpenTeacherAuth: () => void;
  onOpenRandomPicker: () => void;
  onSwitchToStudentView: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  activeLessonTitle: string;
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
  onOpenRandomPicker,
  onSwitchToStudentView,
  isFullscreen,
  onToggleFullscreen,
  activeLessonTitle,
  activeTeacher,
  onLogout,
}) => {
  const tabs: Array<{ id: ActiveTab; label: string; icon: React.ReactNode }> = [
    { id: 'whiteboard', label: 'Bảng Xanh & Bút Viết', icon: <PenTool className="w-5 h-5 text-emerald-600" /> },
    { id: 'gradebook', label: 'Quản Lý Lớp Học', icon: <Users className="w-5 h-5 text-blue-600" /> },
    { id: 'presentation', label: 'Slide Trình Chiếu', icon: <Presentation className="w-5 h-5 text-indigo-600" /> },
    { id: 'reader', label: 'Mở Tài Liệu', icon: <BookOpen className="w-5 h-5 text-blue-600" /> },
    { id: 'quiz', label: 'Trắc Nghiệm Tức Thì', icon: <CheckSquare className="w-5 h-5 text-amber-500" /> },
    { id: 'games', label: 'Trò Chơi Ôn Tập', icon: <Trophy className="w-5 h-5 text-rose-500" /> },
    { id: 'embed', label: 'Nhúng Web/YouTube', icon: <Globe className="w-5 h-5 text-purple-600" /> },
    { id: 'analytics', label: 'Biểu Đồ Phân Tích', icon: <BarChart3 className="w-5 h-5 text-teal-600" /> },
    { id: 'documents', label: 'Kho Bài Giảng', icon: <FolderOpen className="w-5 h-5 text-amber-600" /> },
    { id: 'ai_chat', label: 'Trợ Lý AI', icon: <Bot className="w-5 h-5 text-purple-600" /> },
  ];

  return (
    <header className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-3 md:px-4 py-2.5 flex items-center justify-between gap-3 select-none z-30 shadow-xs">
      {/* Brand & Teacher Profile Status */}
      <div className="flex items-center gap-2 shrink-0">
        {activeTeacher ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenTeacherAuth}
              className="flex items-center gap-2 p-1.5 rounded-2xl hover:bg-slate-100 transition-all text-left group"
              title="Bấm để chuyển đổi tài khoản giáo viên hoặc xem thông tin hồ sơ"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xl shadow-xs group-hover:scale-105 transition-transform">
                {activeTeacher.avatar || '👨‍🏫'}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm text-slate-900 leading-tight">
                    {activeTeacher.name}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase">
                    {activeTeacher.subject}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium truncate max-w-[150px]">
                  {activeTeacher.school}
                </div>
              </div>
            </button>

            {/* Quick Logout Button */}
            <button
              onClick={onLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all"
              title="Đăng xuất tài khoản giáo viên"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenTeacherAuth}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold transition-all shadow-xs"
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng Nhập / Đăng Ký</span>
          </button>
        )}
      </div>

      {/* Main Navigation Tabs for Large Touch Display */}
      <nav className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/80 overflow-x-auto max-w-[55vw]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-btn-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-2 rounded-xl font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all shrink-0 ${
                isActive
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {tab.icon}
              <span className="hidden xl:inline">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Right Controls: Lucky Random Student, Text Scale, QR PIN, Export, Fullscreen */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Lucky Random Picker Quick Trigger */}
        <button
          onClick={onOpenRandomPicker}
          className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition-all"
          title="Mở trò chơi vòng quay may mắn gọi học sinh ngẫu nhiên"
        >
          <Dices className="w-4 h-4" />
          <span className="hidden lg:inline">Quay Gọi HS</span>
        </button>

        {/* Text Scale for 75" TV Back Row Readability */}
        <div className="hidden 2xl:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <Type className="w-4 h-4 text-slate-500 ml-2 mr-1" />
          <button
            onClick={() => onTextScaleChange('normal')}
            className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
              textScale === 'normal' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            100%
          </button>
          <button
            onClick={() => onTextScaleChange('large')}
            className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
              textScale === 'large' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            125%
          </button>
          <button
            onClick={() => onTextScaleChange('huge')}
            className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all ${
              textScale === 'huge' ? 'bg-indigo-600 text-white' : 'text-slate-600'
            }`}
          >
            150% Bàn cuối
          </button>
        </div>

        {/* Room PIN Button */}
        <button
          onClick={onOpenQR}
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-emerald-700 font-mono font-black text-xs flex items-center gap-1.5 transition-all shadow-xs"
          title="Mở mã QR cho học sinh quét vào phòng nộp bài"
        >
          <QrCode className="w-4 h-4 text-emerald-600" />
          <span className="hidden sm:inline">PIN:</span>
          <span>{roomPin}</span>
        </button>

        {/* Export Button */}
        <button
          id="header-export-btn"
          onClick={onOpenExport}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-all shadow-xs"
          title="Xuất bài giảng ra Word, Excel, PPT, PDF, Ảnh HD"
        >
          <Download className="w-4 h-4 text-indigo-600" />
        </button>

        {/* Student Mobile Portal Link */}
        <button
          onClick={onSwitchToStudentView}
          className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold flex items-center gap-1 transition-all hidden md:flex shadow-xs"
          title="Xem thử giao diện làm bài của học sinh"
        >
          <span>Giao diện HS</span>
        </button>

        {/* Fullscreen TV Toggle */}
        <button
          onClick={onToggleFullscreen}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-all shadow-xs"
          title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình Tivi 75 inch'}
        >
          {isFullscreen ? <Minimize className="w-4 h-4 text-amber-600" /> : <Maximize className="w-4 h-4 text-slate-700" />}
        </button>
      </div>
    </header>
  );
};
