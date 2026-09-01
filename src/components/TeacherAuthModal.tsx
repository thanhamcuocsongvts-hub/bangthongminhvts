import React, { useState } from 'react';
import {
  UserCheck,
  GraduationCap,
  School,
  Mail,
  Phone,
  Plus,
  CheckCircle2,
  X,
  BookOpen,
  Users,
  Award,
  LogOut,
  Sparkles,
  Lock,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { TeacherProfile, SubjectType } from '../types';

interface TeacherAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers?: TeacherProfile[];
  activeTeacher: TeacherProfile | null;
  onSelectTeacher: (teacher: TeacherProfile | null) => void;
  onAddNewTeacher: (newTeacher: TeacherProfile) => void;
  onLogout: () => void;
}

export const TeacherAuthModal: React.FC<TeacherAuthModalProps> = ({
  isOpen,
  onClose,
  teachers = [],
  activeTeacher,
  onSelectTeacher,
  onAddNewTeacher,
  onLogout,
}) => {
  const [authView, setAuthView] = useState<'profiles' | 'register' | 'google'>('profiles');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [subject, setSubject] = useState<SubjectType>('Sinh học');
  const [school, setSchool] = useState<string>('Trường THPT Chuyên Lê Hồng Phong');
  const [phone, setPhone] = useState<string>('');
  const [googleEmail, setGoogleEmail] = useState<string>('thanhamcuocsong.vts@gmail.com');
  const [googleName, setGoogleName] = useState<string>('Thầy Võ Thành Sơn');
  const [googleSubject, setGoogleSubject] = useState<SubjectType>('Toán học');
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle register new teacher
  const handleRegisterTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newTeacher: TeacherProfile = {
      id: 'teacher_' + Date.now(),
      name: name.trim(),
      email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '')}@truongthpt.edu.vn`,
      phone: phone.trim() || '0901.234.567',
      subject,
      school: school.trim() || 'Trường THPT',
      avatar: subject === 'Toán học' || subject === 'Vật lý' ? '👨‍🏫' : '👩‍🏫',
      classes: [
        {
          id: 'class_new_1',
          name: '10A1',
          grade: 'Lớp 10',
          academicYear: '2026 - 2027',
          subject,
          students: [
            { id: 'st_demo_1', code: 'HS1001', name: 'Nguyễn Văn An', oralScore: 9, test15mScore: 8.5, test1PeriodScore: 9.0, quizScore: 9, bonusPoints: 2, isCalled: false },
            { id: 'st_demo_2', code: 'HS1002', name: 'Trần Thị Bình', oralScore: 8, test15mScore: 9.0, test1PeriodScore: 8.0, quizScore: 8, bonusPoints: 1, isCalled: false },
            { id: 'st_demo_3', code: 'HS1003', name: 'Lê Hoàng Cường', oralScore: 10, test15mScore: 9.5, test1PeriodScore: 10, quizScore: 10, bonusPoints: 4, isCalled: false },
            { id: 'st_demo_4', code: 'HS1004', name: 'Phạm Thu Dung', oralScore: 7.5, test15mScore: 8.0, test1PeriodScore: 7.5, quizScore: 7, bonusPoints: 0, isCalled: false },
          ],
        },
      ],
    };

    onAddNewTeacher(newTeacher);
    onSelectTeacher(newTeacher);
    setSuccessToast(`Đã tạo tài khoản giáo viên ${newTeacher.name} thành công!`);
    setTimeout(() => {
      setSuccessToast(null);
      onClose();
    }, 1200);
  };

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    setIsGoogleSigningIn(true);
    try {
      // Simulate Google OAuth handshake with verified email
      await new Promise((r) => setTimeout(r, 900));

      const existingTeacher = (teachers || []).find(
        (t) => t.email.toLowerCase() === googleEmail.toLowerCase()
      );

      if (existingTeacher) {
        onSelectTeacher(existingTeacher);
      } else {
        const googleTeacher: TeacherProfile = {
          id: 'teacher_google_' + Date.now(),
          name: googleName || 'Giáo viên Google',
          email: googleEmail,
          phone: '0988.776.655',
          subject: googleSubject,
          school: 'Trường THPT Quốc Gia',
          avatar: '🎓',
          classes: [
            {
              id: 'class_gg_1',
              name: '12A1',
              grade: 'Lớp 12',
              academicYear: '2026 - 2027',
              subject: googleSubject,
              students: [
                { id: 'st_g1', code: 'HS1201', name: 'Nguyễn Thanh Tùng', bonusPoints: 2, isCalled: false },
                { id: 'st_g2', code: 'HS1202', name: 'Vũ Minh Anh', bonusPoints: 1, isCalled: false },
                { id: 'st_g3', code: 'HS1203', name: 'Đặng Tuấn Kiệt', bonusPoints: 3, isCalled: false },
                { id: 'st_g4', code: 'HS1204', name: 'Trần Thảo My', bonusPoints: 0, isCalled: false },
              ],
            },
          ],
        };
        onAddNewTeacher(googleTeacher);
        onSelectTeacher(googleTeacher);
      }

      setSuccessToast(`Đăng nhập Google thành công: ${googleEmail}`);
      setTimeout(() => {
        setSuccessToast(null);
        onClose();
      }, 1000);
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="w-full max-w-2xl p-6 md:p-8 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-2xl shadow-xs">
              {activeTeacher?.avatar || '👨‍🏫'}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Tài Khoản Giáo Viên
              </h2>
              <p className="text-slate-500 text-xs font-medium">
                Đăng nhập, đăng ký hồ sơ sư phạm hoặc liên kết tài khoản Google
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-bold flex items-center gap-2 animate-fade-in">
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Navigation Tabs between Profiles, Register, and Google Sign-in */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => setAuthView('profiles')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              authView === 'profiles'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Danh Sách Giáo Viên</span>
          </button>

          <button
            onClick={() => setAuthView('register')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              authView === 'register'
                ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Đăng Ký Mới</span>
          </button>

          <button
            onClick={() => setAuthView('google')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              authView === 'google'
                ? 'bg-white text-red-600 shadow-sm border border-slate-200/60'
                : 'text-slate-600 hover:text-slate-900'
            }`}
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
            <span>Google Sign-In</span>
          </button>
        </div>

        {/* View 1: Active Teacher & Switch Profiles */}
        {authView === 'profiles' && (
          <div className="space-y-5">
            {/* Active Account Status & Logout */}
            {activeTeacher ? (
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-blue-50/60 border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-indigo-200 flex items-center justify-center text-3xl shadow-sm">
                    {activeTeacher.avatar || '👨‍🏫'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-lg text-slate-900">{activeTeacher.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase">
                        Đang Đăng Nhập
                      </span>
                    </div>
                    <div className="text-xs text-indigo-700 font-semibold mt-0.5">
                      Môn: {activeTeacher.subject} • {activeTeacher.school}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" />
                      <span>{activeTeacher.email}</span>
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                <div className="flex sm:flex-col items-end gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      onLogout();
                      setSuccessToast('Đã đăng xuất tài khoản.');
                      setTimeout(() => setSuccessToast(null), 1500);
                    }}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-rose-600 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                    title="Đăng xuất tài khoản hiện tại"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Đăng Xuất</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                    ?
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">Chưa đăng nhập tài khoản</div>
                    <div className="text-xs text-slate-500">Vui lòng chọn một hồ sơ giáo viên bên dưới hoặc đăng nhập Google</div>
                  </div>
                </div>
              </div>
            )}

            {/* List of Available Teachers */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  CHỌN TÀI KHOẢN GIÁO VIÊN BỘ MÔN
                </h3>
                <button
                  onClick={() => setAuthView('register')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Đăng ký mới</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {teachers.map((teacher) => {
                  const isCurrent = activeTeacher && teacher.id === activeTeacher.id;
                  return (
                    <div
                      key={teacher.id}
                      onClick={() => {
                        onSelectTeacher(teacher);
                        onClose();
                      }}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isCurrent
                          ? 'bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-500/20'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xl shadow-xs">
                          {teacher.avatar || '👨‍🏫'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm leading-tight">{teacher.name}</div>
                          <div className="text-[11px] text-slate-500">{teacher.subject} • {teacher.classes.length} Lớp</div>
                        </div>
                      </div>

                      {isCurrent ? (
                        <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />
                      ) : (
                        <span className="text-xs text-indigo-600 font-bold hover:underline shrink-0">Chọn</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* View 2: Register New Teacher Form */}
        {authView === 'register' && (
          <form onSubmit={handleRegisterTeacher} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>ĐĂNG KÝ TÀI KHOẢN GIÁO VIÊN MỚI</span>
              </h3>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Họ và Tên Giáo Viên <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Cô Nguyễn Phương Thảo"
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Môn Học Giảng Dạy
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value as SubjectType)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="Toán học">Toán học</option>
                  <option value="Vật lý">Vật lý</option>
                  <option value="Hóa học">Hóa học</option>
                  <option value="Sinh học">Sinh học</option>
                  <option value="Ngữ văn">Ngữ văn</option>
                  <option value="Lịch sử">Lịch sử</option>
                  <option value="Tiếng Anh">Tiếng Anh</option>
                  <option value="Tin học">Tin học</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Đơn Vị Trường Học
                </label>
                <input
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="Ví dụ: THPT Chuyên Lê Hồng Phong"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Email Liên Hệ
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@school.edu.vn"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  Số Điện Thoại
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912.xxx.xxx"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAuthView('profiles')}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Đăng Ký & Đăng Nhập Ngay</span>
              </button>
            </div>
          </form>
        )}

        {/* View 3: Google Sign-In */}
        {authView === 'google' && (
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/50 border border-slate-200 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-md flex items-center justify-center mx-auto">
                <svg className="w-8 h-8" viewBox="0 0 24 24">
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
              <h3 className="text-xl font-black text-slate-900">
                Đăng Nhập Bằng Tài Khoản Google
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Tự động đồng bộ giáo án, danh sách lớp học và sổ điểm giảng dạy qua Google Workspace
              </p>
            </div>

            <div className="space-y-4 max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Địa Chỉ Email Google
                </label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    className="w-full bg-transparent text-slate-900 text-xs font-medium focus:outline-none"
                    placeholder="email@gmail.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tên Hiển Thị
                  </label>
                  <input
                    type="text"
                    value={googleName}
                    onChange={(e) => setGoogleName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Môn Dạy
                  </label>
                  <select
                    value={googleSubject}
                    onChange={(e) => setGoogleSubject(e.target.value as SubjectType)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none"
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

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleSigningIn}
                className="w-full py-3 rounded-2xl bg-white hover:bg-slate-50 border-2 border-slate-300 hover:border-slate-400 text-slate-800 font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-sm active:scale-98"
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
                <span>{isGoogleSigningIn ? 'Đang xác thực Google...' : 'Tiếp Tục Với Google'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Hệ thống bảo mật dữ liệu sư phạm an toàn cho màn hình SmartBoard 75 Pro.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
