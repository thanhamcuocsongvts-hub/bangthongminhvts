import { TeacherProfile } from '../types';

export const ADMIN_TEACHER: TeacherProfile = {
  id: 'teacher_admin_root',
  name: 'Quản Trị Viên Hệ Thống',
  username: 'admin',
  password: '123456',
  email: 'admin@smartboard.edu.vn',
  phone: '0901.888.999',
  subject: 'Toán học',
  school: 'Ban Quản Trị SmartBoard 75 Pro',
  avatar: '🛡️',
  role: 'admin',
  classes: [],
  createdAt: '2026-09-01T00:00:00.000Z',
};

// Dữ liệu tài khoản mặc định gồm tài khoản Admin gốc (mật khẩu 123456)
export const DEFAULT_TEACHERS: TeacherProfile[] = [ADMIN_TEACHER];

