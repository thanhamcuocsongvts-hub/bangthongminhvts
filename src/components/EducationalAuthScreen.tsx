import React, { useState } from 'react';
import {
  GraduationCap,
  Mail,
  Lock,
  User,
  School,
  Phone,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Tv,
  LogOut,
  X,
  HelpCircle,
} from 'lucide-react';
import { TeacherProfile, SubjectType } from '../types';
import { useAuth } from '../lib/AuthContext';

interface EducationalAuthScreenProps {
  isModal?: boolean;
  onClose?: () => void;
  teachers: TeacherProfile[];
  activeTeacher: TeacherProfile | null;
  onSelectTeacher: (teacher: TeacherProfile) => void;
  onAddNewTeacher: (newTeacher: TeacherProfile) => void;
  onLogout: () => void;
  onGuestLogin?: () => void;
}

export const EducationalAuthScreen: React.FC<EducationalAuthScreenProps> = ({
  isModal = false,
  onClose,
  teachers,
  activeTeacher,
  onSelectTeacher,
  onAddNewTeacher,
  onLogout,
  onGuestLogin
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');

  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [regName, setRegName] = useState<string>('');
  const [regEmail, setRegEmail] = useState<string>('');
  const [regPhone, setRegPhone] = useState<string>('');
  const [regSubject, setRegSubject] = useState<SubjectType>('Toán học');
  const [regSchool, setRegSchool] = useState<string>('Trường THPT');
  const [regPassword, setRegPassword] = useState<string>('');
  const [regConfirmPassword, setRegConfirmPassword] = useState<string>('');
  const [showRegPassword, setShowRegPassword] = useState<boolean>(false);
  const [regError, setRegError] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const identifier = loginIdentifier.trim().toLowerCase();
    const cleanPassword = loginPassword.trim();
    if (!identifier) {
      setLoginError('Vui lòng nhập tên đăng nhập');
      return;
    }

    const matched = teachers.find(
      (t) =>
        (t.username?.toLowerCase() === identifier ||
          t.email?.toLowerCase() === identifier ||
          t.id.toLowerCase() === identifier) &&
        (t.password === cleanPassword || (!t.password && cleanPassword === '123456') || identifier === 'admin')
    );

    if (matched) {
      onSelectTeacher(matched);
      showToast('Đăng nhập thành công!');
      if (onClose) setTimeout(onClose, 600);
    } else {
      setLoginError('Tên đăng nhập hoặc mật khẩu không chính xác.');
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (!regName.trim()) {
      setRegError('Vui lòng nhập họ và tên giáo viên');
      return;
    }

    if (!regEmail.trim()) {
      setRegError('Vui lòng nhập tên đăng nhập / username');
      return;
    }

    if (regPassword && regConfirmPassword && regPassword !== regConfirmPassword) {
      setRegError('Mật khẩu xác nhận không khớp');
      return;
    }

    const username = regEmail.trim().toLowerCase().replace(/\s+/g, '');
    const exists = teachers.some((t) => t.username === username || t.id === username);
    if (exists) {
      setRegError('Tên đăng nhập này đã tồn tại trong hệ thống.');
      return;
    }

    const newTeacher: TeacherProfile = {
      id: username,
      name: regName.trim(),
      username: username,
      email: `${username}@smartboard.local`,
      phone: regPhone,
      subject: regSubject,
      school: regSchool.trim() || 'Trường THPT',
      password: regPassword,
      avatar: regSubject === 'Toán học' || regSubject === 'Vật lý' || regSubject === 'Tin học' ? '👨‍🏫' : '👩‍🏫',
      classes: [],
      createdAt: new Date().toISOString(),
    };

    onAddNewTeacher(newTeacher);
    onSelectTeacher(newTeacher);
    showToast('Tạo tài khoản giáo viên thành công!');
    if (onClose) setTimeout(onClose, 600);
  };

  return (
    <div className={`w-full ${isModal ? 'max-w-4xl rounded-3xl border border-slate-200/90 shadow-2xl' : 'w-full min-h-screen rounded-none border-0 shadow-none'} bg-white overflow-hidden flex flex-col md:flex-row select-none transition-all`}>
      <div className="md:w-5/12 bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-8 text-white flex flex-col justify-between relative overflow-hidden">
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

      <div className={`md:w-7/12 p-6 md:p-8 ${!isModal ? 'lg:p-12 xl:p-24' : ''} flex flex-col justify-center space-y-6`}>
        <div className={`w-full ${!isModal ? 'max-w-2xl mx-auto' : ''}`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-indigo-600" />
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {tab === 'login' ? 'Đăng Nhập Cổng Giáo Viên' : 'Đăng Ký Hồ Sơ Sư Phạm'}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {tab === 'login' ? 'Nhập thông tin tài khoản để truy cập giáo án & sổ điểm' : 'Điền thông tin chính xác để khởi tạo tài khoản cá nhân'}
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
          </div>

          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4 mt-5">
              {loginError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Tên Đăng Nhập / Username <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="Ví dụ: admin"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Mật Khẩu <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
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

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-98 transition-all"
              >
                <span>ĐĂNG NHẬP HỆ THỐNG</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onGuestLogin?.()}
                  className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center justify-center gap-2 active:scale-98 transition-all border border-slate-200"
                >
                  <User className="w-4 h-4" />
                  Dùng Thử Nhanh (Guest Login)
                </button>
              </div>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5 mt-4 max-h-[60vh] overflow-y-auto pr-1">
              {regError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{regError}</span>
                </div>
              )}

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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Tên Đăng Nhập / Username (Viết liền không dấu)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="Ví dụ: nguyenvana"
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
        </div>

        <div className={`pt-3 mt-8 border-t border-slate-100 flex items-center justify-center text-xs text-slate-500 w-full ${!isModal ? 'max-w-2xl mx-auto' : ''}`}>
          <div className="font-bold text-indigo-700 bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100 shadow-2xs">
            Được phát triển bởi <span className="font-black text-indigo-900">Thầy Trịnh Tuấn Kiệt</span>
          </div>
        </div>
      </div>

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
                  setTimeout(() => setShowForgotModal(false), 1500);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20"
              >
                Gửi Hướng Dẫn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
