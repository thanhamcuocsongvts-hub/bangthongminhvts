import React, { useState } from 'react';
import {
  HardDrive,
  ShieldCheck,
  Search,
  Eye,
  EyeOff,
  RotateCcw,
  Edit,
  Trash2,
  UserPlus,
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
  School,
  Mail,
  Phone,
  BookOpen,
  LogIn,
  KeyRound,
  Sparkles,
  Lock,
  User,
} from 'lucide-react';
import { TeacherProfile, SubjectType } from '../types';

interface AdminManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: TeacherProfile[];
  activeTeacher: TeacherProfile | null;
  lessons?: LessonDoc[];
  onSelectTeacher: (teacher: TeacherProfile) => void;
  onUpdateTeacher: (teacher: TeacherProfile) => void;
  onDeleteTeacher: (teacherId: string) => void;
  onResetPassword: (teacherId: string, newPassword?: string) => void;
  onAddNewTeacher: (newTeacher: TeacherProfile) => void;
}

export const AdminManagementModal: React.FC<AdminManagementModalProps> = ({
  isOpen,
  onClose,
  teachers,
  activeTeacher,
  lessons = [],
  onSelectTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
  onResetPassword,
  onAddNewTeacher,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit Teacher State
  const [editingTeacher, setEditingTeacher] = useState<TeacherProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSubject, setEditSubject] = useState<SubjectType>('Toán học');
  const [editSchool, setEditSchool] = useState('');

  // Reset Password Dialog State
  const [resettingTeacher, setResettingTeacher] = useState<TeacherProfile | null>(null);
  const [customNewPassword, setCustomNewPassword] = useState('123456');

  // Add New Teacher State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('123456');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newSubject, setNewSubject] = useState<SubjectType>('Toán học');
  const [newSchool, setNewSchool] = useState('Trường THPT');

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleRevealPassword = (id: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCopyPassword = (pwd: string, name: string) => {
    navigator.clipboard?.writeText(pwd || '123456');
    showToast(`Đã sao chép mật khẩu của ${name}!`);
  };

  // Open Edit Modal
  const openEditModal = (t: TeacherProfile) => {
    setEditingTeacher(t);
    setEditName(t.name);
    setEditUsername(t.username || '');
    setEditPassword(t.password || '123456');
    setEditEmail(t.email);
    setEditPhone(t.phone || '');
    setEditSubject(t.subject);
    setEditSchool(t.school);
  };

  // Save Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;

    const updated: TeacherProfile = {
      ...editingTeacher,
      name: editName.trim() || editingTeacher.name,
      username: editUsername.trim() || editingTeacher.username,
      password: editPassword.trim() || editingTeacher.password,
      email: editEmail.trim() || editingTeacher.email,
      phone: editPhone.trim(),
      subject: editSubject,
      school: editSchool.trim() || editingTeacher.school,
    };

    onUpdateTeacher(updated);

    // Sync to backend
    fetch('/api/teachers/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch((err) => console.warn('Sync update teacher warning:', err));

    showToast(`Đã cập nhật thông tin tài khoản ${updated.name}!`);
    setEditingTeacher(null);
  };

  // Confirm Reset Password
  const handleConfirmResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingTeacher) return;

    const pwdToSet = customNewPassword.trim() || '123456';
    onResetPassword(resettingTeacher.id, pwdToSet);

    // Sync to backend
    fetch('/api/teachers/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId: resettingTeacher.id, newPassword: pwdToSet }),
    }).catch((err) => console.warn('Sync reset password warning:', err));

    showToast(`Đã đổi mật khẩu của ${resettingTeacher.name} thành "${pwdToSet}" thành công!`);
    setResettingTeacher(null);
  };

  // Handle Quick Reset to 123456
  const handleQuickReset = (t: TeacherProfile) => {
    onResetPassword(t.id, '123456');
    fetch('/api/teachers/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId: t.id, newPassword: '123456' }),
    }).catch((err) => console.warn('Sync reset password warning:', err));
    showToast(`Đã reset mật khẩu của ${t.name} về mặc định "123456"!`);
  };

  // Handle Add New Teacher
  const handleCreateTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const email = newEmail.trim() || `${newUsername || newName.toLowerCase().replace(/\s+/g, '')}@truongthpt.edu.vn`;
    const username = newUsername.trim() || newName.toLowerCase().replace(/\s+/g, '');

    const newTeacher: TeacherProfile = {
      id: 'teacher_' + Date.now(),
      name: newName.trim(),
      username,
      password: newPassword.trim() || '123456',
      email,
      phone: newPhone.trim(),
      subject: newSubject,
      school: newSchool.trim() || 'Trường THPT',
      avatar: newSubject === 'Toán học' || newSubject === 'Vật lý' || newSubject === 'Tin học' ? '👨‍🏫' : '👩‍🏫',
      classes: [],
      createdAt: new Date().toISOString(),
    };

    onAddNewTeacher(newTeacher);
    fetch('/api/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTeacher),
    }).catch((err) => console.warn('Sync new teacher warning:', err));

    showToast(`Đã tạo mới tài khoản giáo viên ${newTeacher.name}!`);
    setShowAddModal(false);
    setNewName('');
    setNewUsername('');
    setNewPassword('123456');
    setNewEmail('');
    setNewPhone('');
  };

  // Filter teachers
  const filteredTeachers = teachers.filter((t) => {
    const matchesSubject = selectedSubject === 'all' || t.subject === selectedSubject;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesSubject;
    const matchesSearch =
      t.name.toLowerCase().includes(q) ||
      (t.username && t.username.toLowerCase().includes(q)) ||
      t.email.toLowerCase().includes(q) ||
      (t.school && t.school.toLowerCase().includes(q)) ||
      (t.phone && t.phone.includes(q));
    return matchesSubject && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 select-none">
      <div className="w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-md">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-black tracking-tight text-white">
                  BẢNG ĐIỀU KHIỂN QUẢN TRỊ VIÊN (ADMIN)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                  Mật khẩu Root: 123456
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Quản lý toàn diện danh sách giáo viên, xem mật khẩu, đặt lại mật khẩu và cập nhật hồ sơ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-md transition-all active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Thêm Giáo Viên Mới</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all"
              title="Đóng bảng quản trị"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats & Search Filter Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row gap-3 items-center justify-between shrink-0">
          {/* Stats Badges */}
          <div className="flex items-center gap-2 text-xs w-full md:w-auto">
            <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs font-bold text-slate-700 flex items-center gap-2">
              <span className="text-slate-400">Tổng tài khoản:</span>
              <span className="font-black text-indigo-600 text-sm">{teachers.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs font-bold text-slate-700 flex items-center gap-2">
              <span className="text-slate-400">Đang chọn:</span>
              <span className="font-black text-emerald-600 text-sm">
                {activeTeacher ? activeTeacher.name : 'Chưa đăng nhập'}
              </span>
            </div>
          </div>

          {/* Search and Subject Filter */}
          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên, email, username..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            >
              <option value="all">Tất cả môn dạy</option>
              <option value="Toán học">Toán học</option>
              <option value="Vật lý">Vật lý</option>
              <option value="Hóa học">Hóa học</option>
              <option value="Sinh học">Sinh học</option>
              <option value="Ngữ văn">Ngữ văn</option>
              <option value="Lịch sử">Lịch sử</option>
              <option value="Tiếng Anh">Tiếng Anh</option>
              <option value="Tin học">Tin học</option>
              <option value="Khác">Môn khác</option>
            </select>

            <button
              onClick={() => setShowAddModal(true)}
              className="sm:hidden p-2 rounded-xl bg-indigo-600 text-white shadow-xs"
              title="Thêm giáo viên mới"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white px-6 py-2.5 text-xs font-bold flex items-center justify-between animate-in slide-in-from-top duration-150 shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-white/80 hover:text-white font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Teachers List Table / Cards */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
          {filteredTeachers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <User className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-600">Không tìm thấy tài khoản giáo viên phù hợp</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedSubject('all');
                }}
                className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition-all"
              >
                Xóa bộ lọc tìm kiếm
              </button>
            </div>
          ) : (
            filteredTeachers.map((t) => {
              const isRevealed = !!revealedPasswords[t.id];
              const pwd = t.password || '123456';
              const isAdmin = t.id === 'teacher_admin_root';
              const isActive = activeTeacher?.id === t.id;

              return (
                <div
                  key={t.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isActive
                      ? 'bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-400/30 shadow-sm'
                      : isAdmin
                      ? 'bg-amber-50/40 border-amber-200/80 shadow-2xs'
                      : 'bg-white border-slate-200/90 hover:border-indigo-200 shadow-2xs'
                  } flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}
                >
                  {/* Left info */}
                  <div className="flex items-start gap-3.5 overflow-hidden flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs">
                      {t.avatar || (isAdmin ? '🛡️' : '👨‍🏫')}
                    </div>
                    <div className="space-y-1 overflow-hidden flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-slate-900">{t.name}</span>
                        {isAdmin && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-black border border-amber-300">
                            QUẢN TRỊ VIÊN
                          </span>
                        )}
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
                            Đang Đăng Nhập
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                          {t.subject}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="flex items-center gap-1 font-medium text-slate-500">
                          <School className="w-3.5 h-3.5 text-slate-400" />
                          {t.school}
                        </span>
                        <span className="flex items-center gap-1 font-medium text-slate-500">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {t.email}
                        </span>
                        {t.username && (
                          <span className="flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50/80 px-1.5 py-0.5 rounded">
                            user: {t.username}
                          </span>
                        )}
                        {t.phone && (
                          <span className="flex items-center gap-1 font-medium text-slate-500">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {t.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle Password Controls: "XEM MẬT KHẨU" & "RESET MẬT KHẨU" */}
                  <div className="flex items-center gap-2 self-stretch md:self-auto bg-slate-100/90 p-2 rounded-xl border border-slate-200/80 shrink-0">
                    <div className="flex items-center gap-1.5 px-2">
                      <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="font-mono text-xs font-bold min-w-[70px]">
                        {isRevealed ? (
                          <span className="text-slate-900 bg-amber-100/80 px-1.5 py-0.5 rounded text-xs select-all">
                            {pwd}
                          </span>
                        ) : (
                          <span className="text-slate-400 tracking-wider">••••••</span>
                        )}
                      </div>
                    </div>

                    {/* View/Hide password toggle */}
                    <button
                      type="button"
                      onClick={() => toggleRevealPassword(t.id)}
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-600 border border-slate-200 shadow-2xs transition-all"
                      title={isRevealed ? 'Ẩn mật khẩu' : 'Bấm để xem mật khẩu'}
                    >
                      {isRevealed ? <EyeOff className="w-4 h-4 text-indigo-600" /> : <Eye className="w-4 h-4" />}
                    </button>

                    {/* Copy password */}
                    <button
                      type="button"
                      onClick={() => handleCopyPassword(pwd, t.name)}
                      className="p-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-600 border border-slate-200 shadow-2xs transition-all"
                      title="Sao chép mật khẩu"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    <div className="w-px h-5 bg-slate-300 mx-0.5" />

                    {/* Reset Password Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setResettingTeacher(t);
                        setCustomNewPassword('123456');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition-all"
                      title="Đổi hoặc reset mật khẩu cho giáo viên này"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset MK</span>
                    </button>
                  </div>

                  {/* Storage Usage Column */}
                  <div className="flex flex-col items-center justify-center bg-slate-50/50 p-2 rounded-xl border border-slate-200/50 shrink-0 min-w-[90px]">
                    <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                      <HardDrive className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Lưu Trữ</span>
                    </div>
                    {(() => {
                      const teacherLessons = (lessons || []).filter(l => l.author === t.name);
                      const fileCount = teacherLessons.length;
                      let totalKB = 0;
                      teacherLessons.forEach(l => {
                        if (l.fileSize) {
                          const num = parseFloat(l.fileSize);
                          if (!isNaN(num)) {
                            if (l.fileSize.includes('MB')) totalKB += num * 1024;
                            else if (l.fileSize.includes('KB')) totalKB += num;
                          }
                        }
                      });
                      const displaySize = totalKB > 1024 ? (totalKB / 1024).toFixed(1) + ' MB' : Math.round(totalKB) + ' KB';
                      return (
                        <div className="text-center">
                          <div className="text-sm font-black text-indigo-600">{displaySize}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{fileCount} tệp</div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Right Actions: Edit, Login As, Delete */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
                    {/* Switch/Login As */}
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTeacher(t);
                          showToast(`Đã chuyển sang tài khoản ${t.name}!`);
                          onClose();
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs flex items-center gap-1 transition-all"
                        title="Vào dạy với tài khoản này"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Vào Dạy</span>
                      </button>
                    )}

                    {/* Edit Profile */}
                    <button
                      type="button"
                      onClick={() => openEditModal(t)}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold text-xs flex items-center gap-1 transition-all"
                      title="Sửa thông tin tài khoản"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    {/* Delete (Protected for root admin) */}
                    {!isAdmin ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Thầy/Cô có chắc chắn muốn xóa tài khoản giáo viên "${t.name}"? Dữ liệu lớp học của giáo viên này sẽ bị xóa khỏi hệ thống.`)) {
                            onDeleteTeacher(t.id);
                            fetch(`/api/teachers/${t.id}`, { method: 'DELETE' }).catch((err) =>
                              console.warn('Delete teacher server warning:', err)
                            );
                            showToast(`Đã xóa tài khoản ${t.name}.`);
                          }
                        }}
                        className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all"
                        title="Xóa tài khoản này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="p-1.5 text-amber-500" title="Tài khoản Admin không thể xóa">
                        <Lock className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-600">
              Đồng bộ tự động giữa Màn hình 75 inch và Điện thoại/Máy tính bảng
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-all"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* MODAL 1: RESET PASSWORD MODAL */}
      {resettingTeacher && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-black text-base">
                <RotateCcw className="w-5 h-5 text-amber-500" />
                <span>Đặt Lại Mật Khẩu Giáo Viên</span>
              </div>
              <button
                onClick={() => setResettingTeacher(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Thầy/Cô đang đặt lại mật khẩu cho tài khoản{' '}
              <strong className="text-slate-900 font-black">{resettingTeacher.name}</strong> (Email:{' '}
              {resettingTeacher.email}).
            </p>

            <form onSubmit={handleConfirmResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Mật Khẩu Mới Muốn Đặt:
                </label>
                <input
                  type="text"
                  required
                  value={customNewPassword}
                  onChange={(e) => setCustomNewPassword(e.target.value)}
                  placeholder="Ví dụ: 123456"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCustomNewPassword('123456')}
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Mặc định: 123456
                </button>
                <button
                  type="button"
                  onClick={() => setCustomNewPassword('admin75')}
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  admin75
                </button>
                <button
                  type="button"
                  onClick={() => setCustomNewPassword('smartboard2026')}
                  className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  smartboard2026
                </button>
              </div>

              <div className="pt-3 flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>XÁC NHẬN ĐẶT LẠI MẬT KHẨU</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResettingTeacher(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT TEACHER INFO MODAL */}
      {editingTeacher && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-black text-base">
                <Edit className="w-5 h-5 text-indigo-600" />
                <span>Chỉnh Sửa Hồ Sơ Giáo Viên</span>
              </div>
              <button
                onClick={() => setEditingTeacher(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Họ và Tên Giáo Viên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Bộ Môn Giảng Dạy
                  </label>
                  <select
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value as SubjectType)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Toán học">Toán học</option>
                    <option value="Vật lý">Vật lý</option>
                    <option value="Hóa học">Hóa học</option>
                    <option value="Sinh học">Sinh học</option>
                    <option value="Ngữ văn">Ngữ văn</option>
                    <option value="Lịch sử">Lịch sử</option>
                    <option value="Tiếng Anh">Tiếng Anh</option>
                    <option value="Tin học">Tin học</option>
                    <option value="Khác">Môn khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Đơn Vị Trường Học
                  </label>
                  <input
                    type="text"
                    value={editSchool}
                    onChange={(e) => setEditSchool(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Tên Đăng Nhập (Username)
                  </label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Mật Khẩu Đăng Nhập
                  </label>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Số Điện Thoại
                  </label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>LƯU CẬP NHẬT HỒ SƠ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD NEW TEACHER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-black text-base">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                <span>Thêm Tài Khoản Giáo Viên Mới</span>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeacher} className="space-y-3.5">
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                  Họ và Tên Giáo Viên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ví dụ: Thầy Trần Minh Khang"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Bộ Môn Giảng Dạy
                  </label>
                  <select
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value as SubjectType)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Toán học">Toán học</option>
                    <option value="Vật lý">Vật lý</option>
                    <option value="Hóa học">Hóa học</option>
                    <option value="Sinh học">Sinh học</option>
                    <option value="Ngữ văn">Ngữ văn</option>
                    <option value="Lịch sử">Lịch sử</option>
                    <option value="Tiếng Anh">Tiếng Anh</option>
                    <option value="Tin học">Tin học</option>
                    <option value="Khác">Môn khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Đơn Vị Trường Học
                  </label>
                  <input
                    type="text"
                    value={newSchool}
                    onChange={(e) => setNewSchool(e.target.value)}
                    placeholder="THPT..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Tên Đăng Nhập (Username)
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="minhkhang"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Mật Khẩu (Mặc định: 123456)
                  </label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="teacher@school.edu.vn"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-slate-700 mb-1">
                    Số Điện Thoại
                  </label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="09xx..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>TẠO TÀI KHOẢN GIÁO VIÊN</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
