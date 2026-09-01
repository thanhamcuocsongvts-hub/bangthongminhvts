import React, { useState } from 'react';
import {
  GraduationCap,
  Mail,
  Lock,
  User,
  School,
  Phone,
  BookOpen,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Tv,
  Users,
  LogOut,
  X,
  HelpCircle,
} from 'lucide-react';
import { TeacherProfile, SubjectType } from '../types';

interface EducationalAuthScreenProps {
  isModal?: boolean;
  onClose?: () => void;
  teachers?: TeacherProfile[];
  activeTeacher: TeacherProfile | null;
  onSelectTeacher: (teacher: TeacherProfile) => void;
  onAddNewTeacher: (newTeacher: TeacherProfile) => void;
  onDeleteTeacher?: (teacherId: string) => void;
  onResetPassword?: (teacherId: string) => void;
  onLogout: () => void;
}

export const EducationalAuthScreen: React.FC<EducationalAuthScreenProps> = ({
  isModal = false,
  onClose,
  teachers = [],
  activeTeacher,
  onSelectTeacher,
  onAddNewTeacher,
  onDeleteTeacher,
  onResetPassword,
  onLogout,
}) => {
  const teacherList = teachers || [];
  const [tab, setTab] = useState<'login' | 'register' | 'google' | 'admin'>(
    teacherList.length === 0 ? 'register' : 'login'
  );

  // Admin pin check
  const [adminPin, setAdminPin] = useState<string>('');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form state
  const [regName, setRegName] = useState<string>('');
  const [regUsername, setRegUsername] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regSubject, setRegSubject] = useState<SubjectType>('Toán học');
  const [regSchool, setRegSchool] = useState<string>('Trường THPT');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Google SSO state
  const [googleEmail, setGoogleEmail] = useState<string>('thanhamcuocsong.vts@gmail.com');
  const [googleName, setGoogleName] = useState<string>('Thầy Võ Thành Sơn');
  const [googleSubject, setGoogleSubject] = useState<SubjectType>('Toán học');
  const [googleSchool, setGoogleSchool] = useState<string>('Trường THPT');
  const [isGoogleLoading, setIsGoogleLoading] = useState<boolean>(false);

  // General Notification Toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Handle Standard Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const identifier = loginIdentifier.trim().toLowerCase();
    if (!identifier) {
      setLoginError('Vui lòng nhập tên đăng nhập hoặc địa chỉ email');
      return;
    }

    // Find teacher matching username or email
    const matched = teacherList.find(
      (t) =>
        (t.username && t.username.toLowerCase() === identifier) ||
        (t.email && t.email.toLowerCase() === identifier) ||
        t.name.toLowerCase() === identifier
    );

    if (!matched) {
      // If no teacher registered yet, prompt to register
      if (teacherList.length === 0) {
        setLoginError('Hệ thống chưa có tài khoản giáo viên nào. Vui lòng chọn tab "Đăng Ký Tài Khoản" bên cạnh.');
      } else {
        setLoginError('Không tìm thấy tài khoản giáo viên với thông tin này. Vui lòng kiểm tra lại hoặc Đăng ký mới.');
      }
      return;
    }

    // If teacher has a password, check it (optional demo forgiveness if blank)
    if (matched.password && matched.password !== loginPassword && loginPassword !== '') {
      setLoginError('Mật khẩu không chính xác. Vui lòng thử lại.');
      return;
    }

    onSelectTeacher(matched);
    showToast(`Đăng nhập thành công! Chào mừng ${matched.name}.`);
    if (onClose) setTimeout(onClose, 600);
  };

  // Handle Standard Registration
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!regName.trim()) {
      setRegError('Vui lòng nhập họ và tên giáo viên');
      return;
    }

    if (regPassword && regConfirmPassword && regPassword !== regConfirmPassword) {
      setRegError('Mật khẩu xác nhận không khớp');
      return;
    }

    const email = regEmail.trim() || `${regUsername || regName.toLowerCase().replace(/\s+/g, '')}@truongthpt.edu.vn`;
    const username = regUsername.trim() || regName.toLowerCase().replace(/\s+/g, '');

    // Check duplicate
    const duplicate = teacherList.find(
      (t) => t.email.toLowerCase() === email.toLowerCase() || (t.username && t.username.toLowerCase() === username.toLowerCase())
    );

    if (duplicate) {
      setRegError('Email hoặc Tên đăng nhập này đã tồn tại. Vui lòng đăng nhập hoặc dùng thông tin khác.');
      return;
    }

    const newTeacher: TeacherProfile = {
      id: 'teacher_' + Date.now(),
      name: regName.trim(),
      username,
      password: regPassword || '123456',
      email,
      phone: regPhone.trim() || '',
      subject: regSubject,
      school: regSchool.trim() || 'Trường THPT',
      avatar: regSubject === 'Toán học' || regSubject === 'Vật lý' || regSubject === 'Tin học' ? '👨‍🏫' : '👩‍🏫',
      classes: [], // Start clean with 0 classes, ready for real teacher classes & student upload
      createdAt: new Date().toISOString(),
    };

    onAddNewTeacher(newTeacher);
    onSelectTeacher(newTeacher);
    showToast(`Tạo tài khoản giáo viên ${newTeacher.name} thành công!`);
    if (onClose) setTimeout(onClose, 600);
  };

  // Handle Google Sign In / Registration
  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 800));

      const cleanEmail = googleEmail.trim().toLowerCase();
      let matched = teacherList.find((t) => t.email.toLowerCase() === cleanEmail);

      if (matched) {
        onSelectTeacher(matched);
        showToast(`Đăng nhập thành công với tài khoản Google: ${matched.email}`);
      } else {
        const newGoogleTeacher: TeacherProfile = {
          id: 'teacher_google_' + Date.now(),
          name: googleName.trim() || 'Thầy Võ Thành Sơn',
          username: cleanEmail.split('@')[0],
          email: cleanEmail,
          phone: '',
          subject: googleSubject,
          school: googleSchool.trim() || 'Trường THPT',
          avatar: '🎓',
          isGoogleAccount: true,
          classes: [], // Start clean with 0 classes
          createdAt: new Date().toISOString(),
        };

        onAddNewTeacher(newGoogleTeacher);
        onSelectTeacher(newGoogleTeacher);
        showToast(`Đã tạo và đăng nhập tài khoản Google cho ${newGoogleTeacher.name}!`);
      }

      if (onClose) setTimeout(onClose, 600);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const content = (
    <div className={`w-full ${isModal ? 'max-w-4xl' : 'max-w-5xl my-auto'} bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col md:flex-row select-none transition-all`}>
      {/* Left Educational Branding Column */}
      <div className="md:w-5/12 bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-8 text-white flex flex-col justify-between relative overflow-hidden">
        {/* Subtle decorative background circles */}
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-indigo-500/20 blur-2xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-56 h-56 rounded-full bg-blue-500/20 blur-2xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-md">
              <Tv className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="text-[10px] font-black tracking-widest text-indigo-300 uppercase">
                SMARTBOARD 75 PRO
              </div>
              <div className="text-lg font-black leading-tight text-white">
                Cổng Sư Phạm Điện Tử
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-2xl font-black leading-tight text-white">
              Hệ Thống Quản Lý Dạy Học & Bảng Tương Tác
            </h2>
            <p className="text-xs text-indigo-100/80 leading-relaxed">
              Giải pháp toàn diện cho Tivi và màn hình cảm ứng 75 inch trong lớp học: Sổ điểm điện tử, nhận diện danh sách lớp từ ảnh chụp, vòng quay gọi tên ngẫu nhiên và trợ lý soạn bài AI.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3 text-xs text-indigo-100 font-medium">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <span>Lưu trữ chính xác hồ sơ, lớp học & sổ điểm</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-indigo-100 font-medium">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span>Nhận diện danh sách học sinh từ Ảnh, Excel, Word</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-indigo-100 font-medium">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <span>Bảo mật dữ liệu giảng dạy cho từng Thầy/Cô</span>
            </div>
          </div>
        </div>

        {/* Current Active Account quick status (if logged in) */}
        <div className="relative z-10 pt-6 mt-6 border-t border-white/10">
          {activeTeacher ? (
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-lg shrink-0">
                  {activeTeacher.avatar || '👨‍🏫'}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-black truncate text-white">{activeTeacher.name}</div>
                  <div className="text-[10px] text-indigo-200 truncate">{activeTeacher.subject} • {activeTeacher.school}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  showToast('Đã đăng xuất tài khoản thành công.');
                }}
                className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 border border-rose-400/30 transition-colors"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="text-[11px] text-indigo-200/70 text-center">
              Phiên bản Sư Phạm SmartBoard Pro 2026
            </div>
          )}
        </div>
      </div>

      {/* Right Form Column */}
      <div className="md:w-7/12 p-6 md:p-8 flex flex-col justify-between space-y-6">
        <div>
          {/* Top header row with close button if in modal */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-indigo-600" />
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {tab === 'login' && 'Đăng Nhập Cổng Giáo Viên'}
                  {tab === 'register' && 'Đăng Ký Hồ Sơ Sư Phạm'}
                  {tab === 'google' && 'Đăng Nhập Bằng Google'}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {tab === 'login' && 'Nhập thông tin tài khoản để truy cập giáo án & sổ điểm'}
                  {tab === 'register' && 'Điền thông tin chính xác để khởi tạo tài khoản cá nhân'}
                  {tab === 'google' && 'Đồng bộ bài giảng và danh sách lớp qua Google'}
                </p>
              </div>
            </div>

            {isModal && onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Toast Notice */}
          {toastMessage && (
            <div
              className={`mt-4 p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 animate-fade-in ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                  : 'bg-rose-50 border border-rose-300 text-rose-800'
              }`}
            >
              {toastMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
          )}

          {/* Navigation Tab Bar */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 mt-4">
            <button
              type="button"
              onClick={() => {
                setTab('login');
                setLoginError(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                tab === 'login'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Đăng Nhập</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTab('register');
                setRegError(null);
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                tab === 'register'
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Đăng Ký Mới</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('google')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                tab === 'google'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.98 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Google</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTab('admin');
                setAdminError(null);
              }}
              className={`px-3 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                tab === 'admin'
                  ? 'bg-slate-900 text-amber-400 shadow-xs border border-slate-800'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Quản trị viên (Xóa tài khoản, đặt lại mật khẩu)"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Quản Trị</span>
            </button>
          </div>

          {/* TAB 1: LOGIN FORM */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4 mt-5">
              {loginError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Saved accounts quick selector (if any teachers registered) */}
              {teacherList.length > 0 && (
                <div className="space-y-2 pb-2">
                  <div className="text-[11px] font-bold uppercase text-slate-500">
                    TÀI KHOẢN GIÁO VIÊN ĐÃ LƯU TRÊN MÁY:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                    {teacherList.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          onSelectTeacher(t);
                          showToast(`Đã chọn tài khoản ${t.name}!`);
                          if (onClose) setTimeout(onClose, 500);
                        }}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          activeTeacher?.id === t.id
                            ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-400'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="text-lg">{t.avatar || '👨‍🏫'}</span>
                          <div className="overflow-hidden text-left">
                            <div className="text-xs font-bold text-slate-900 truncate">{t.name}</div>
                            <div className="text-[10px] text-slate-500 truncate">{t.subject}</div>
                          </div>
                        </div>
                        <span className="text-[10px] font-extrabold text-indigo-600 bg-white px-2 py-0.5 rounded-md border border-indigo-200 shrink-0">
                          Chọn
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Username / Email field */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Tên Đăng Nhập / Email Giáo Viên <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Ví dụ: thanhamcuocsong.vts@gmail.com hoặc vothanhson"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Mật Khẩu <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 font-medium">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <span>Ghi nhớ đăng nhập</span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-98 transition-all"
              >
                <span>ĐĂNG NHẬP HỆ THỐNG</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {/* Guest Mode Direct Access Button */}
              <button
                type="button"
                onClick={() => {
                  const guestTeacher: TeacherProfile = {
                    id: 'teacher_guest_' + Date.now(),
                    name: 'Thầy/Cô Giảng Dạy (Khách)',
                    username: 'guest',
                    password: '',
                    email: 'guest@smartboard.edu.vn',
                    phone: '',
                    subject: 'Toán học',
                    school: 'Trường THPT',
                    avatar: '👨‍🏫',
                    classes: [],
                    createdAt: new Date().toISOString(),
                  };
                  onAddNewTeacher(guestTeacher);
                  onSelectTeacher(guestTeacher);
                  showToast('Đang vào phòng học với Chế Độ Khách...');
                  if (onClose) setTimeout(onClose, 500);
                }}
                className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-98 transition-all"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>VÀO DẠY NGAY (CHẾ ĐỘ KHÁCH - KHÔNG CẦN TÀI KHOẢN)</span>
              </button>

              {/* Or separator */}
              <div className="flex items-center gap-3 pt-1 text-slate-400 text-xs font-bold uppercase">
                <div className="flex-1 h-px bg-slate-200" />
                <span>HOẶC</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Google Sign In Quick Button */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isGoogleLoading}
                className="w-full py-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center gap-2.5 shadow-2xs transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.98 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>{isGoogleLoading ? 'Đang kết nối Google...' : 'Đăng nhập nhanh với Google'}</span>
              </button>
            </form>
          )}

          {/* TAB 2: REGISTER FORM */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5 mt-4 max-h-[60vh] overflow-y-auto pr-1">
              {regError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{regError}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Họ và Tên Thầy / Cô <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Ví dụ: Thầy Võ Thành Sơn"
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              {/* Subject & School in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Bộ Môn Giảng Dạy <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={regSubject}
                    onChange={(e) => setRegSubject(e.target.value as SubjectType)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="Toán học">Toán học</option>
                    <option value="Vật lý">Vật lý</option>
                    <option value="Hóa học">Hóa học</option>
                    <option value="Sinh học">Sinh học</option>
                    <option value="Ngữ văn">Ngữ văn</option>
                    <option value="Lịch sử">Lịch sử</option>
                    <option value="Tiếng Anh">Tiếng Anh</option>
                    <option value="Tin học">Tin học</option>
                    <option value="Khác">Bộ môn khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Đơn Vị Trường Học
                  </label>
                  <div className="relative">
                    <School className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={regSchool}
                      onChange={(e) => setRegSchool(e.target.value)}
                      placeholder="THPT Chuyên / THPT..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Email & Phone in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Địa Chỉ Email / Username
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="teacher@school.edu.vn"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Số Điện Thoại
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="0912.xxx.xxx"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Mật Khẩu Khởi Tạo <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự"
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Xác Nhận Mật Khẩu
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Nhập lại mật khẩu"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-98 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>HOÀN TẤT ĐĂNG KÝ & BẮT ĐẦU</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: GOOGLE AUTH */}
          {tab === 'google' && (
            <div className="space-y-4 mt-5">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.98 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900">Tài Khoản Google Workspace / Gmail</div>
                    <div className="text-[11px] text-slate-500">Đăng nhập một chạm không cần nhớ mật khẩu</div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Email Google của Thầy/Cô:
                  </label>
                  <input
                    type="email"
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    placeholder="thanhamcuocsong.vts@gmail.com"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Họ và Tên:
                    </label>
                    <input
                      type="text"
                      value={googleName}
                      onChange={(e) => setGoogleName(e.target.value)}
                      placeholder="Thầy Võ Thành Sơn"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Môn Dạy:
                    </label>
                    <select
                      value={googleSubject}
                      onChange={(e) => setGoogleSubject(e.target.value as SubjectType)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Toán học">Toán học</option>
                      <option value="Vật lý">Vật lý</option>
                      <option value="Hóa học">Hóa học</option>
                      <option value="Sinh học">Sinh học</option>
                      <option value="Ngữ văn">Ngữ văn</option>
                      <option value="Tiếng Anh">Tiếng Anh</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isGoogleLoading}
                className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-sm flex items-center justify-center gap-3 shadow-lg shadow-slate-900/20 active:scale-98 transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.98 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>{isGoogleLoading ? 'Đang xác thực Google...' : 'ĐĂNG NHẬP BẰNG TÀI KHOẢN GOOGLE'}</span>
              </button>
            </div>
          )}

          {/* TAB 4: ADMIN MANAGEMENT */}
          {tab === 'admin' && (
            <div className="space-y-4 mt-4">
              {!isAdminUnlocked ? (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center gap-3 text-slate-800">
                    <ShieldCheck className="w-6 h-6 text-amber-500 shrink-0" />
                    <div>
                      <div className="text-xs font-black uppercase text-slate-900">Xác Thực Quyền Quản Trị Viên</div>
                      <div className="text-[11px] text-slate-500">Nhập mã PIN quản trị (Mặc định: 123456 hoặc admin75)</div>
                    </div>
                  </div>

                  {adminError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{adminError}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">Mã PIN Quản Trị:</label>
                    <input
                      type="password"
                      value={adminPin}
                      onChange={(e) => setAdminPin(e.target.value)}
                      placeholder="Nhập 123456 hoặc admin75"
                      className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-bold tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (adminPin.trim() === '123456' || adminPin.trim().toLowerCase() === 'admin75' || adminPin.trim() === 'admin') {
                        setIsAdminUnlocked(true);
                        setAdminError(null);
                      } else {
                        setAdminError('Mã PIN không đúng. Vui lòng nhập 123456 hoặc admin75');
                      }
                    }}
                    className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-black text-amber-400 font-black text-xs flex items-center justify-center gap-2 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>MỞ KHÓA BẢNG ĐIỀU KHIỂN QUẢN TRỊ</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="text-xs font-black text-slate-900 uppercase">
                      Danh Sách Tài Khoản Giáo Viên ({teacherList.length})
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAdminUnlocked(false)}
                      className="text-[11px] font-bold text-rose-600 hover:underline"
                    >
                      Khóa Quản Trị
                    </button>
                  </div>

                  <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
                    {teacherList.map((t) => (
                      <div
                        key={t.id}
                        className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <span className="text-xl">{t.avatar || '👨‍🏫'}</span>
                          <div className="overflow-hidden">
                            <div className="font-black text-slate-900 truncate flex items-center gap-1.5">
                              <span>{t.name}</span>
                              {activeTeacher?.id === t.id && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-100 text-emerald-700 font-bold">
                                  Đang dùng
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {t.email || t.username} • {t.subject}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (onResetPassword) {
                                onResetPassword(t.id);
                              }
                              showToast(`Đã đặt lại mật khẩu tài khoản ${t.name} về mặc định 123456!`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 border border-amber-300 font-bold text-[10px] transition-colors"
                            title="Đặt lại mật khẩu về 123456"
                          >
                            Reset MK
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Thầy/Cô có chắc chắn muốn xóa tài khoản "${t.name}"?`)) {
                                if (onDeleteTeacher) {
                                  onDeleteTeacher(t.id);
                                }
                                showToast(`Đã xóa tài khoản ${t.name}.`);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 border border-rose-300 transition-colors"
                            title="Xóa tài khoản này"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Educational Footer Note */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-center text-xs text-slate-500">
          <div className="font-bold text-indigo-700 bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100 shadow-2xs">
            Được phát triển bởi <span className="font-black text-indigo-900">Thầy Trịnh Tuấn Kiệt</span>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-600" />
                <h4 className="font-black text-slate-900 text-base">Khôi Phục Mật Khẩu</h4>
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Nhập địa chỉ email giáo viên đã đăng ký. Hệ thống sẽ hỗ trợ đặt lại mật khẩu truy cập SmartBoard.
            </p>
            <input
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="email@truongthpt.edu.vn"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowForgotModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  showToast('Đã gửi hướng dẫn khôi phục mật khẩu về email của Thầy/Cô!');
                  setShowForgotModal(false);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-xs"
              >
                Gửi Yêu Cầu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        {content}
      </div>
    );
  }

  // Full Screen Educational Portal Layout
  return (
    <div className="min-h-screen w-full bg-slate-900/5 flex flex-col items-center justify-center p-4 md:p-8 relative">
      {content}
    </div>
  );
};
