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
  status: 'approved',
  classes: [
    {
      id: 'class_12a1',
      name: '12A1',
      grade: 'Lớp 12',
      academicYear: '2026 - 2027',
      subject: 'Toán học',
      students: [
        { id: 'st_1', code: 'HS1201', name: 'Nguyễn Văn An', studentCode: 'HS1201', oralScore: 9, bonusPoints: 2, gender: 'male', avatar: '👨‍🎓', isCalled: false },
        { id: 'st_2', code: 'HS1202', name: 'Trần Thị Bình', studentCode: 'HS1202', oralScore: 10, bonusPoints: 1, gender: 'female', avatar: '👩‍🎓', isCalled: false },
        { id: 'st_3', code: 'HS1203', name: 'Lê Hoàng Cường', studentCode: 'HS1203', oralScore: 8, bonusPoints: 0, gender: 'male', avatar: '👨‍🎓', isCalled: false },
        { id: 'st_4', code: 'HS1204', name: 'Phạm Thu Dung', studentCode: 'HS1204', oralScore: 9, bonusPoints: 3, gender: 'female', avatar: '👩‍🎓', isCalled: false },
        { id: 'st_5', code: 'HS1205', name: 'Vũ Quốc Bảo', studentCode: 'HS1205', oralScore: 8, bonusPoints: 1, gender: 'male', avatar: '👨‍🎓', isCalled: false },
        { id: 'st_6', code: 'HS1206', name: 'Đỗ Gia Hân', studentCode: 'HS1206', oralScore: 10, bonusPoints: 2, gender: 'female', avatar: '👩‍🎓', isCalled: false },
        { id: 'st_7', code: 'HS1207', name: 'Hoàng Đức Anh', studentCode: 'HS1207', oralScore: 9, bonusPoints: 0, gender: 'male', avatar: '👨‍🎓', isCalled: false },
        { id: 'st_8', code: 'HS1208', name: 'Bùi Ngọc Ánh', studentCode: 'HS1208', oralScore: 10, bonusPoints: 2, gender: 'female', avatar: '👩‍🎓', isCalled: false },
        { id: 'st_9', code: 'HS1209', name: 'Đặng Khánh Linh', studentCode: 'HS1209', oralScore: 9, bonusPoints: 1, gender: 'female', avatar: '👩‍🎓', isCalled: false },
        { id: 'st_10', code: 'HS1210', name: 'Trịnh Tuấn Kiệt', studentCode: 'HS1210', oralScore: 10, bonusPoints: 3, gender: 'male', avatar: '👨‍🎓', isCalled: false },
        { id: 'st_11', code: 'HS1211', name: 'Lê Mỹ Duyên', studentCode: 'HS1211', oralScore: 9, bonusPoints: 1, gender: 'female', avatar: '👩‍🎓', isCalled: false },
        { id: 'st_12', code: 'HS1212', name: 'Nguyễn Tiến Đạt', studentCode: 'HS1212', oralScore: 8, bonusPoints: 0, gender: 'male', avatar: '👨‍🎓', isCalled: false },
      ],
    },
  ],
  createdAt: '2026-09-01T00:00:00.000Z',
};

// Dữ liệu tài khoản mặc định gồm tài khoản Admin gốc (mật khẩu 123456)
export const DEFAULT_TEACHERS: TeacherProfile[] = [ADMIN_TEACHER];

