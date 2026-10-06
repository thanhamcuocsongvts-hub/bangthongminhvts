import React, { useState, useRef, useEffect } from 'react';
import { 
  Maximize, Minimize, Download, QrCode, Users, 
  BookOpen, Trophy, PenTool, CheckSquare, Globe, 
  FolderOpen, ShieldCheck, KeyRound, RefreshCw, LogOut, 
  LogIn, Dices, Type, ChevronDown, Smartphone, Menu, X,
  GraduationCap, Sparkles, Zap, Sprout, Gamepad2, Presentation
} from 'lucide-react';
import { TextScale, TeacherProfile } from '../types';
import { useDeviceDetection } from '../hooks/useDeviceDetection';

export type ActiveTab =
  | 'whiteboard'
  | 'fast-whiteboard'
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
  onOpenAIConfig?: () => void;
  pendingTeachersCount?: number;
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
  onOpenAIConfig,
  pendingTeachersCount = 0,
}) => {
  const { isMobile } = useDeviceDetection();
  const [showTeacherMenu, setShowTeacherMenu] = useState<boolean>(false);
  const [showStudentMenu, setShowStudentMenu] = useState<boolean>(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState<boolean>(false);
  const [showTeacherAccountModal, setShowTeacherAccountModal] = useState<boolean>(false);

  const teacherMenuRef = useRef<HTMLDivElement>(null);
  const studentMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (teacherMenuRef.current && !teacherMenuRef.current.contains(target)) {
        setShowTeacherMenu(false);
      }
      if (studentMenuRef.current && !studentMenuRef.current.contains(target)) {
        setShowStudentMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // 8 Main Navigation Tabs - Chuẩn tên gọi ngắn gọn sư phạm, dàn trải 1 dòng duy nhất
  const tabs: Array<{ id: ActiveTab; label: string; shortLabel: string; icon: React.ReactNode; desc: string }> = [
    { id: 'whiteboard', label: 'Bảng Xanh', shortLabel: 'Bảng Xanh', icon: <Sprout className="w-4 h-4 text-emerald-400" />, desc: 'Bảng xanh sư phạm 75", ô kẻ chuẩn, chữ đẹp AI, hình học' },
    { id: 'fast-whiteboard', label: 'Bảng Nhanh', shortLabel: 'Bảng Nhanh', icon: <Zap className="w-4 h-4 text-amber-400" />, desc: 'Bảng siêu tốc 120Hz 4K không độ trễ' },
    { id: 'gradebook', label: 'Lớp Học', shortLabel: 'Lớp Học', icon: <Users className="w-4 h-4 text-blue-400" />, desc: 'Danh sách học sinh, điểm số, chuyên cần' },
    { id: 'documents', label: 'Lưu Trữ', shortLabel: 'Lưu Trữ', icon: <FolderOpen className="w-4 h-4 text-amber-400" />, desc: 'Kho Lưu Trữ & Đồng Bộ Cloud (PDF, Word, PPTX, Excel ≤ 25MB)' },
    { id: 'reader', label: 'Tài Liệu', shortLabel: 'Tài Liệu', icon: <BookOpen className="w-4 h-4 text-sky-400" />, desc: 'Đọc tài liệu gốc & trích xuất kiến thức AI' },
    { id: 'quiz', label: 'Trắc Nghiệm', shortLabel: 'Trắc Nghiệm', icon: <CheckSquare className="w-4 h-4 text-emerald-400" />, desc: 'Làm bài thi trực tiếp, thống kê biểu đồ lớp' },
    { id: 'games', label: 'Trò Chơi', shortLabel: 'Trò Chơi', icon: <Gamepad2 className="w-4 h-4 text-rose-400" />, desc: 'Game tương tác học tập, ôn luyện kiến thức' },
    { id: 'embed', label: 'Nhúng Web', shortLabel: 'Nhúng Web', icon: <Globe className="w-4 h-4 text-purple-400" />, desc: 'Video bài giảng YouTube & mô phỏng thí nghiệm' },
  ];

  const currentTab = tabs.find((t) => t.id === activeTab) || tabs[0];

  // ================= MOBILE PHONE HEADER BAR (< 768px) =================
  if (isMobile) {
    return (
      <header className="w-full flex items-center justify-between px-2.5 py-1.5 overflow-hidden select-none bg-slate-900 border-b border-slate-800 text-white z-30 shadow-xs relative">
        {/* Left: Compact Teacher Avatar / Name */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeTeacher ? (
            <button
              type="button"
              onClick={() => setShowTeacherAccountModal(true)}
              className="flex items-center gap-1.5 p-1 pr-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 transition-all text-left cursor-pointer active:scale-95"
              title={`Tài khoản: ${activeTeacher.name} (Bấm để xem thông tin & Đăng xuất)`}
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-sm shadow-xs">
                {activeTeacher.avatar || '👨‍🏫'}
              </div>
              <div className="flex items-center gap-1">
                <span className="max-w-[90px] truncate text-[11px] font-black text-slate-200 leading-tight">
                  {activeTeacher.name.split(' ').slice(-2).join(' ')}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
              </div>
            </button>
          ) : (
            <button
              onClick={onOpenTeacherAuth}
              className="flex items-center gap-1 px-2 py-1 rounded-xl bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 text-[11px] font-bold"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Đăng nhập</span>
            </button>
          )}
        </div>

        {/* Center: Quick Active Tab Pill */}
        <button
          onClick={() => setShowMobileDrawer(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs font-black shadow-xs max-w-[140px] truncate cursor-pointer active:scale-95 transition-all"
          title="Bấm để chuyển nhanh giữa các tính năng giảng dạy"
        >
          {currentTab.icon}
          <span className="truncate">{currentTab.shortLabel}</span>
          <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
        </button>

        {/* Right: Lucky Wheel, PIN & Hamburger Drawer Button */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onOpenRandomPicker}
            className="p-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-xs cursor-pointer active:scale-95 transition-all"
            title="Quay gọi học sinh ngẫu nhiên"
          >
            <Dices className="w-4 h-4 text-slate-950" />
          </button>

          <button
            onClick={() => setShowStudentMenu((prev) => !prev)}
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-[11px] font-mono font-black cursor-pointer"
            title="Mã PIN học sinh"
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>#{roomPin}</span>
          </button>

          <button
            onClick={() => setShowMobileDrawer(true)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer"
            title="Mở menu toàn bộ tính năng"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Student PIN Dropdown on Mobile */}
        {showStudentMenu && (
          <div className="absolute right-2 top-full mt-1.5 w-64 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 p-3 z-50 animate-in fade-in slide-in-from-top-2 space-y-2 text-white">
            <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-center">
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400">MÃ PIN VÀO PHÒNG</div>
              <div className="text-2xl font-mono font-black text-emerald-300 tracking-wider my-0.5">#{roomPin}</div>
              <div className="text-[11px] text-emerald-300">Học sinh nhập mã PIN để nộp bài</div>
            </div>
            <button
              onClick={() => {
                setShowStudentMenu(false);
                onOpenQR();
              }}
              className="w-full p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span>Quét mã QR học sinh</span>
            </button>
            <button
              onClick={() => {
                setShowStudentMenu(false);
                onSwitchToStudentView();
              }}
              className="w-full p-2.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/50 text-indigo-300 text-xs font-bold flex items-center gap-2 cursor-pointer"
            >
              <Smartphone className="w-4 h-4 text-indigo-400" />
              <span>Xem giao diện làm bài của HS</span>
            </button>
          </div>
        )}

        {/* MOBILE SLIDE-OVER DRAWER FOR COMPLETE EASY NAVIGATION */}
        {showMobileDrawer && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end animate-fade-in">
            <div className="w-[85vw] max-w-[340px] h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col overflow-y-auto text-white">
              {/* Drawer Header */}
              <div className="p-3.5 bg-gradient-to-r from-slate-950 to-slate-900 border-b border-slate-800 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-xl">
                    {activeTeacher?.avatar || '👨‍🏫'}
                  </div>
                  <div className="leading-tight">
                    <div className="font-black text-sm text-white truncate max-w-[180px]">
                      {activeTeacher?.name || 'Giáo viên'}
                    </div>
                    <div className="text-[11px] text-emerald-300 truncate max-w-[180px]">
                      {activeTeacher?.school || 'SmartBoard 75 Pro'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowMobileDrawer(false)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 8 Main Navigation Tabs */}
              <div className="p-3 space-y-1.5 flex-1">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 mb-1">
                  CHỌN TÍNH NĂNG GIẢNG DẠY
                </div>
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const isWhiteboard = tab.id === 'whiteboard';
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        onTabChange(tab.id);
                        setShowMobileDrawer(false);
                      }}
                      className={`w-full p-2.5 rounded-2xl flex items-center gap-3 transition-all text-left cursor-pointer ${
                        isWhiteboard
                          ? isActive
                            ? 'bg-emerald-600 text-white shadow-md border-2 border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]'
                            : 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/80'
                          : isActive
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                          : 'bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/60'
                      }`}
                    >
                      <div className={`p-2 rounded-xl shrink-0 ${isActive ? 'bg-white/20 text-white' : 'bg-slate-700 shadow-xs'}`}>
                        {tab.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-black truncate ${isActive ? 'text-white' : 'text-slate-100'}`}>
                          {tab.label}
                        </div>
                        <div className={`text-[10px] truncate ${isActive ? 'text-emerald-100' : 'text-slate-400'}`}>
                          {tab.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Quick Teacher Actions */}
                <div className="pt-3 border-t border-slate-800 space-y-1.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                    TIỆN ÍCH DẠY HỌC
                  </div>
                  <button
                    onClick={() => {
                      setShowMobileDrawer(false);
                      onOpenRandomPicker();
                    }}
                    className="w-full p-2.5 rounded-xl bg-amber-950/60 hover:bg-amber-900 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Dices className="w-4 h-4 text-amber-400" />
                    <span>Quay gọi học sinh ngẫu nhiên</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMobileDrawer(false);
                      onOpenExport();
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-indigo-400" />
                    <span>Xuất bài giảng (PDF / Ảnh HD)</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMobileDrawer(false);
                      onToggleFullscreen();
                    }}
                    className="w-full p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <Maximize className="w-4 h-4 text-slate-400" />
                    <span>{isFullscreen ? 'Thu nhỏ màn hình' : 'Toàn màn hình điện thoại'}</span>
                  </button>
                </div>

                {/* Account & Profile Options */}
                <div className="pt-3 border-t border-slate-800 space-y-1.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                    TÀI KHOẢN GIÁO VIÊN
                  </div>
                  {activeTeacher && activeTeacher.role === 'admin' && (
                    <button
                      onClick={() => {
                        setShowMobileDrawer(false);
                        onOpenAdmin?.();
                      }}
                      className="w-full p-2 rounded-xl text-xs font-bold text-amber-400 hover:bg-amber-950/50 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                        <span>Quản trị Admin Hệ thống</span>
                      </div>
                      {pendingTeachersCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black animate-pulse">
                          {pendingTeachersCount}
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMobileDrawer(false);
                      onOpenAIConfig?.();
                    }}
                    className="w-full p-2 rounded-xl text-xs font-bold text-purple-300 hover:bg-purple-950/50 flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>Cấu hình Gemini AI & API Key</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMobileDrawer(false);
                      onOpenProfile?.();
                    }}
                    className="w-full p-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-slate-400" />
                    <span>Đổi mật khẩu & Thông tin</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMobileDrawer(false);
                      onOpenTeacherAuth();
                    }}
                    className="w-full p-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 text-slate-400" />
                    <span>Đổi tài khoản giáo viên</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMobileDrawer(false);
                      onLogout();
                    }}
                    className="w-full p-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-950/50 flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    <span>Đăng xuất tài khoản</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CHI TIẾT TÀI KHOẢN GIÁO VIÊN & ĐĂNG XUẤT CHO MOBILE */}
        {showTeacherAccountModal && activeTeacher && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden text-white flex flex-col p-5 space-y-4 animate-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 rounded-xl bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-2xl shadow-xs">
                    {activeTeacher.avatar || '👨‍🏫'}
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-white">{activeTeacher.name}</h3>
                    <div className="text-[11px] text-emerald-400 font-medium">
                      {activeTeacher.subject} • {activeTeacher.school || 'SmartBoard Pro'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTeacherAccountModal(false)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Account Info Details */}
              <div className="bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Trạng thái:</span>
                  {activeTeacher.role === 'admin' ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/40">
                      QUẢN TRỊ VIÊN (ADMIN)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/40">
                      GIÁO VIÊN BỘ MÔN
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Tên đăng nhập:</span>
                  <span className="font-mono font-bold text-indigo-300">{activeTeacher.username || activeTeacher.id}</span>
                </div>
                {activeTeacher.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Email:</span>
                    <span className="text-slate-300 truncate max-w-[180px] font-mono text-[11px]">{activeTeacher.email}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                {/* NÚT ĐĂNG XUẤT NỔI BẬT NHẤT */}
                <button
                  type="button"
                  onClick={() => {
                    setShowTeacherAccountModal(false);
                    onLogout();
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>ĐĂNG XUẤT TÀI KHOẢN</span>
                </button>

                {activeTeacher.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowTeacherAccountModal(false);
                      onOpenAdmin?.();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>Quản Trị Admin Hệ Thống</span>
                    {pendingTeachersCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black animate-pulse">
                        {pendingTeachersCount}
                      </span>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowTeacherAccountModal(false);
                    onOpenProfile?.();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-slate-400" />
                  <span>Xem & Sửa Thông Tin Hồ Sơ</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowTeacherAccountModal(false);
                    onOpenTeacherAuth();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                  <span>Đổi Tài Khoản Giáo Viên</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowTeacherAccountModal(false);
                    onOpenAIConfig?.();
                  }}
                  className="w-full py-2 px-3 rounded-xl text-purple-300 hover:bg-purple-950/40 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Cấu hình Gemini AI / API Key</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
    );
  }

  // ================= DESKTOP & 75-INCH TV HEADER BAR (ZERO HORIZONTAL SCROLLBAR - SINGLE ROW) =================
  return (
    <header className="w-full flex items-center justify-between px-3 py-1.5 select-none bg-slate-900 border-b border-slate-800 text-white z-50 shadow-xs relative overflow-visible">
      {/* 1. LEFT: Huy hiệu giáo viên siêu gọn (Avatar + Thầy Kiệt + Icon Trường) + Nút Admin */}
      <div className="flex items-center gap-1.5 shrink-0">
        {activeTeacher ? (
          <div className="relative shrink-0" ref={teacherMenuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowTeacherMenu((prev) => !prev);
              }}
              className="flex items-center gap-1.5 p-1 pr-2 rounded-xl bg-slate-800/90 hover:bg-slate-750 border border-slate-700/80 transition-all text-left shadow-xs cursor-pointer group shrink-0 active:scale-95"
              title={`Tài khoản: ${activeTeacher.name} (Bấm để xem thông tin & Đăng xuất)`}
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-sm shadow-xs group-hover:scale-105 transition-transform">
                {activeTeacher.avatar || '👨‍🏫'}
              </div>
              <div className="flex items-center gap-1">
                <span className="font-black text-xs text-slate-200 truncate max-w-[110px]">
                  {activeTeacher.name || 'Thầy Kiệt'}
                </span>
                <GraduationCap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </div>
              <ChevronDown className={`w-3 h-3 text-slate-400 group-hover:text-slate-200 transition-transform shrink-0 ${showTeacherMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu for Teacher options - Floats directly under teacher button */}
            {showTeacherMenu && (
              <div className="absolute left-0 top-full mt-2 w-72 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-white ring-1 ring-white/10">
                <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-black text-xs text-white flex items-center gap-1.5">
                      <span>{activeTeacher.name}</span>
                      {activeTeacher.role === 'admin' && (
                        <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 text-[9px] font-black border border-amber-500/40">
                          QUẢN TRỊ VIÊN
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate max-w-[210px]">
                      {activeTeacher.email || 'GiaoVien@smartboard.edu.vn'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTeacherMenu(false)}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-1.5 space-y-0.5">
                  {activeTeacher.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowTeacherMenu(false);
                        onOpenAdmin?.();
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-bold text-amber-400 hover:bg-amber-950/40 rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-400" />
                        <span>Quản Trị Admin Hệ Thống</span>
                      </div>
                      {pendingTeachersCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black animate-pulse">
                          {pendingTeachersCount} chờ duyệt
                        </span>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowTeacherMenu(false);
                      onOpenAIConfig?.();
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-bold text-purple-300 hover:bg-purple-950/40 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span>Cấu hình Gemini AI / API Key</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowTeacherMenu(false);
                      onOpenProfile?.();
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-bold text-slate-200 hover:bg-slate-800 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4 text-slate-400" />
                    <span>Sửa thông tin & Đổi mật khẩu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowTeacherMenu(false);
                      onOpenTeacherAuth();
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-bold text-slate-200 hover:bg-slate-800 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 text-slate-400" />
                    <span>Chuyển tài khoản giáo viên</span>
                  </button>

                  <div className="my-1 border-t border-slate-800" />

                  {/* NÚT ĐĂNG XUẤT TÀI KHOẢN NỔI BẬT */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowTeacherMenu(false);
                      onLogout();
                    }}
                    className="w-full px-3 py-2.5 text-left text-xs font-black text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600 rounded-xl flex items-center gap-2 transition-all cursor-pointer border border-rose-500/20 hover:border-rose-600 shadow-sm"
                  >
                    <LogOut className="w-4 h-4 text-rose-400" />
                    <span>Đăng xuất tài khoản</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenTeacherAuth}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Đăng Nhập</span>
          </button>
        )}

        {/* Quick Admin Button for Instant Access */}
        {activeTeacher && activeTeacher.role === 'admin' && (
          <button
            type="button"
            onClick={onOpenAdmin}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 text-xs font-black transition-all shadow-xs cursor-pointer shrink-0 ml-1 active:scale-95"
            title="Mở Bảng Quản Trị Admin (Duyệt giáo viên & Quản lý)"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Admin</span>
            {pendingTeachersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-orange-500 text-white text-[10px] font-black animate-pulse">
                {pendingTeachersCount}
              </span>
            )}
          </button>
        )}

        {/* Nút Đăng Xuất Nhanh Trực Tiếp Trên Header */}
        {activeTeacher && (
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 ml-1 active:scale-95"
            title="Đăng xuất khỏi tài khoản này ngay"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden xl:inline">Đăng Xuất</span>
          </button>
        )}
      </div>

      {/* 2. CENTER: DÀN TRỰC TIẾP TRÊN 1 HÀNG DUY NHẤT (flex-nowrap, justify-center, BỎ HOÀN TOÀN THANH TRƯỢT NGANG) */}
      <nav className="flex items-center flex-nowrap justify-center gap-1 xl:gap-1.5 bg-slate-800/80 p-1 rounded-2xl border border-slate-700/60 min-w-0">
        {/* 7 Tabs chính */}
        {tabs.slice(0, 7).map((tab) => {
          const isActive = activeTab === tab.id;
          const isWhiteboard = tab.id === 'whiteboard';
          return (
            <button
              key={tab.id}
              id={`tab-btn-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={`px-2 xl:px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                isWhiteboard
                  ? isActive
                    ? 'bg-emerald-600 text-white font-black shadow-md border-2 border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)] ring-1 ring-emerald-400/60 scale-[1.02]'
                    : 'border border-emerald-400/80 text-emerald-300 hover:text-white hover:bg-emerald-950/60 shadow-[0_0_8px_rgba(52,211,153,0.3)] font-bold'
                  : isActive
                  ? 'bg-slate-700 text-white shadow-xs border border-slate-600 font-bold scale-[1.02]'
                  : 'text-slate-300 hover:text-white hover:bg-slate-750 font-medium'
              }`}
            >
              {tab.icon}
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}

        {/* Nút tính năng số 8: [Gọi Tên] (Icon tiêu điểm/vòng quay) nằm trực tiếp trên cùng hàng */}
        <button
          onClick={onOpenRandomPicker}
          className="px-2 xl:px-2.5 py-1 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-xs transition-all shrink-0 cursor-pointer active:scale-95"
          title="Gọi học sinh ngẫu nhiên / Vòng quay may mắn"
        >
          <Dices className="w-3.5 h-3.5 text-slate-950" />
          <span className="whitespace-nowrap font-black">Gọi Tên</span>
        </button>

        {/* Nút bổ sung: Nhúng Web / YouTube icon gọn */}
        <button
          id="tab-btn-embed"
          onClick={() => onTabChange('embed')}
          className={`p-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
            activeTab === 'embed'
              ? 'bg-slate-700 text-purple-300 shadow-xs border border-purple-500/50'
              : 'text-slate-400 hover:text-purple-300 hover:bg-slate-750'
          }`}
          title="Nhúng Web / Video YouTube mô phỏng"
        >
          <Globe className="w-3.5 h-3.5 text-purple-400" />
        </button>
      </nav>

      {/* 3. RIGHT: THU GỌN TỐI ĐA CÁC NÚT (Khóa AI, #Mã phòng, Zoom %, Xuất, Fullscreen) */}
      <div className="flex items-center gap-1 xl:gap-1.5 shrink-0">
        {/* Nút Khóa AI compact: icon nhỏ + nhãn ngắn */}
        <button
          onClick={onOpenAIConfig}
          className="px-2 py-1 rounded-xl bg-purple-950/70 hover:bg-purple-900 border border-purple-500/50 text-purple-200 text-xs font-bold flex items-center gap-1 shadow-xs transition-all cursor-pointer shrink-0"
          title="Cài đặt khóa Google Gemini API"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
          <span className="text-[11px] font-bold">Khóa AI</span>
        </button>

        {/* Mã phòng: Badge thu nhỏ hiển thị #758899 */}
        <div className="relative shrink-0" ref={studentMenuRef}>
          <button
            onClick={() => setShowStudentMenu((prev) => !prev)}
            className="flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 text-xs font-mono font-bold transition-all shadow-xs cursor-pointer"
            title="Mã phòng học sinh nộp bài"
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-400" />
            <span>#{roomPin}</span>
          </button>

          {showStudentMenu && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-2 text-white">
              <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-center">
                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400">MÃ PIN VÀO PHÒNG</div>
                <div className="text-2xl font-mono font-black text-emerald-300 tracking-wider my-0.5">#{roomPin}</div>
                <div className="text-[11px] text-emerald-300">Học sinh nhập mã PIN để nộp bài</div>
              </div>

              <button
                onClick={() => {
                  setShowStudentMenu(false);
                  onOpenQR();
                }}
                className="w-full p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-emerald-400" />
                <span>Quét mã QR vào phòng</span>
              </button>

              <button
                onClick={() => {
                  setShowStudentMenu(false);
                  onSwitchToStudentView();
                }}
                className="w-full p-2 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/50 text-indigo-300 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Smartphone className="w-4 h-4 text-indigo-400" />
                <span>Mở giao diện làm bài của HS</span>
              </button>
            </div>
          )}
        </div>

        {/* Tỷ lệ Zoom (125%): Icon tròn tối giản kích thước w-8 h-8 */}
        <button
          onClick={() => {
            const nextScale: Record<TextScale, TextScale> = {
              normal: 'large',
              large: 'huge',
              huge: 'normal',
            };
            onTextScaleChange(nextScale[textScale] || 'normal');
          }}
          className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 cursor-pointer shadow-xs transition-all"
          title={`Tỷ lệ màn hình (Hiện tại: ${textScale === 'huge' ? '150%' : textScale === 'large' ? '125%' : '100%'}) - Bấm để chuyển đổi`}
        >
          <span>{textScale === 'huge' ? '150%' : textScale === 'large' ? '125%' : '100%'}</span>
        </button>

        {/* Nút Xuất bài giảng icon tròn tối giản w-8 h-8 */}
        <button
          id="header-export-btn"
          onClick={onOpenExport}
          className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-indigo-300 flex items-center justify-center shrink-0 cursor-pointer shadow-xs transition-all"
          title="Xuất bài giảng ra Word, Excel, PPT, PDF, Ảnh HD"
        >
          <Download className="w-4 h-4 text-indigo-300" />
        </button>

        {/* Toàn màn hình: Icon tròn tối giản kích thước w-8 h-8 */}
        <button
          onClick={onToggleFullscreen}
          className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center justify-center shrink-0 cursor-pointer shadow-xs transition-all"
          title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình Tivi 75 inch'}
        >
          {isFullscreen ? <Minimize className="w-4 h-4 text-amber-400" /> : <Maximize className="w-4 h-4 text-slate-200" />}
        </button>
      </div>
    </header>
  );
};

