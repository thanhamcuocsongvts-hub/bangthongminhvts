import React, { useState } from 'react';
import {
  AlertTriangle,
  Award,
  X,
  Clock,
  BookOpen,
  FileText,
  Scissors,
  Shirt,
  Volume2,
  Smartphone,
  Trash2,
  Sparkles,
  CheckCircle2,
  Calendar,
  Layers,
  History,
  TrendingUp,
  TrendingDown,
  User,
} from 'lucide-react';
import { ClassRoom, ClassStudent, ConductRecord } from '../types';

interface StudentConductModalProps {
  classroom?: ClassRoom;
  classRoom?: ClassRoom;
  teacherName?: string;
  initialStudentId?: string;
  selectedStudentId?: string;
  isOpen?: boolean;
  onClose: () => void;
  onSaveRecord?: (studentId: string, record: ConductRecord) => void;
  onSaveConduct?: (studentId: string, record: ConductRecord) => void;
  onDeleteRecord?: (studentId: string, recordId: string) => void;
}

export const StudentConductModal: React.FC<StudentConductModalProps> = ({
  classroom,
  classRoom,
  teacherName = 'Giáo viên bộ môn',
  initialStudentId,
  selectedStudentId: propSelectedStudentId,
  isOpen = true,
  onClose,
  onSaveRecord,
  onSaveConduct,
  onDeleteRecord,
}) => {
  if (isOpen === false) return null;

  const targetClass = classroom || classRoom;
  const studentsList: ClassStudent[] = targetClass?.students || [];

  const [modalTab, setModalTab] = useState<'record' | 'history'>('record');
  const [activeType, setActiveType] = useState<'violation' | 'reward'>('violation');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialStudentId || propSelectedStudentId || studentsList[0]?.id || ''
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('Không làm bài tập về nhà');
  const [points, setPoints] = useState<number>(-2);
  const [week, setWeek] = useState<string>('Tuần 1');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [period, setPeriod] = useState<string>('15 phút đầu giờ');
  const [note, setNote] = useState<string>('');

  const currentStudent = studentsList.find((s) => s.id === selectedStudentId) || studentsList[0];

  // Quick categories matching school standards
  const violationCategories = [
    { label: 'Đi trễ', defaultPoints: -2, icon: Clock },
    { label: 'Không thuộc bài / chưa chuẩn bị', defaultPoints: -2, icon: BookOpen },
    { label: 'Không làm bài tập về nhà', defaultPoints: -2, icon: FileText },
    { label: 'Đầu tóc sai quy định', defaultPoints: -2, icon: Scissors },
    { label: 'Đồng phục / thiếu bảng tên', defaultPoints: -2, icon: Shirt },
    { label: 'Mất trật tự trong giờ học', defaultPoints: -2, icon: Volume2 },
    { label: 'Dùng điện thoại trái phép', defaultPoints: -3, icon: Smartphone },
    { label: 'Trực nhật bẩn / quên lau bảng', defaultPoints: -3, icon: Trash2 },
    { label: 'Vi phạm khác', defaultPoints: -1, icon: AlertTriangle },
  ];

  const rewardCategories = [
    { label: 'Phát biểu bài xuất sắc', defaultPoints: 2, icon: Sparkles },
    { label: 'Làm bài tập điểm 10', defaultPoints: 3, icon: Award },
    { label: 'Giúp đỡ bạn bè học tốt', defaultPoints: 2, icon: CheckCircle2 },
    { label: 'Trực nhật sạch sẽ, đúng giờ', defaultPoints: 2, icon: Sparkles },
    { label: 'Tích cực hoạt động nhóm', defaultPoints: 2, icon: Layers },
    { label: 'Tiến bộ vượt bậc trong học tập', defaultPoints: 3, icon: Award },
    { label: 'Khen thưởng khác', defaultPoints: 1, icon: Award },
  ];

  const handleSelectCategory = (catName: string, defaultPts: number) => {
    setSelectedCategory(catName);
    setPoints(defaultPts);
  };

  const handleTypeChange = (newType: 'violation' | 'reward') => {
    setActiveType(newType);
    if (newType === 'violation') {
      setSelectedCategory('Không làm bài tập về nhà');
      setPoints(-2);
    } else {
      setSelectedCategory('Phát biểu bài xuất sắc');
      setPoints(2);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      alert('Vui lòng chọn học sinh.');
      return;
    }

    const newRecord: ConductRecord = {
      id: 'conduct_' + Date.now(),
      type: activeType,
      category: selectedCategory,
      points: Number(points),
      week,
      date,
      period,
      note: note.trim(),
      recordedBy: teacherName,
      createdAt: new Date().toISOString(),
    };

    if (onSaveRecord) {
      onSaveRecord(selectedStudentId, newRecord);
    } else if (onSaveConduct) {
      onSaveConduct(selectedStudentId, newRecord);
    }
    onClose();
  };

  const currentCategoryList = activeType === 'violation' ? violationCategories : rewardCategories;

  // Conduct summary for current student
  const studentRecords: ConductRecord[] = currentStudent?.conductRecords || [];
  const totalPositive = studentRecords.filter((r) => r.points > 0).reduce((acc, r) => acc + r.points, 0);
  const totalNegative = studentRecords.filter((r) => r.points < 0).reduce((acc, r) => acc + r.points, 0);
  const totalBonusPoints = (currentStudent?.bonusPoints ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#1e3a8a] text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/10 text-amber-300 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight">Sổ Ghi Nhận Thi Đua & Nề Nếp</h2>
              <p className="text-xs text-blue-200 font-medium">
                Người ghi nhận: <span className="font-bold text-white">{teacherName}</span> (Lớp {targetClass?.name || 'Chưa chọn'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs Bar */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setModalTab('record')}
            className={`px-4 py-2.5 text-xs font-black rounded-t-xl border-b-2 flex items-center gap-1.5 transition-all ${
              modalTab === 'record'
                ? 'bg-white text-blue-700 border-blue-600 shadow-xs'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Ghi Nhận Mới (+/-)</span>
          </button>

          <button
            type="button"
            onClick={() => setModalTab('history')}
            className={`px-4 py-2.5 text-xs font-black rounded-t-xl border-b-2 flex items-center gap-1.5 transition-all ${
              modalTab === 'history'
                ? 'bg-white text-blue-700 border-blue-600 shadow-xs'
                : 'text-slate-500 border-transparent hover:text-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5 text-indigo-500" />
            <span>Lịch Sử Thi Đua & Điểm Tích Lũy</span>
            {studentRecords.length > 0 && (
              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold">
                {studentRecords.length}
              </span>
            )}
          </button>
        </div>

        {modalTab === 'record' ? (
          /* Modal Body: Recording Form */
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-800">
            {/* Tabs: VI PHẠM (TRỪ ĐIỂM) vs KHEN THƯỞNG (CỘNG ĐIỂM) */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => handleTypeChange('violation')}
                className={`py-2.5 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                  activeType === 'violation'
                    ? 'bg-rose-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>VI PHẠM (TRỪ ĐIỂM)</span>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('reward')}
                className={`py-2.5 px-4 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
                  activeType === 'reward'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>KHEN THƯỞNG (CỘNG ĐIỂM)</span>
              </button>
            </div>

            {/* Chọn Học Sinh */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-black text-slate-700 uppercase">
                  Chọn Học Sinh <span className="text-rose-500">*</span>
                </label>
                {currentStudent && (
                  <span className="text-xs font-bold text-slate-500">
                    Điểm thi đua hiện tại:{' '}
                    <strong className={totalBonusPoints >= 0 ? 'text-emerald-600 font-black' : 'text-rose-600 font-black'}>
                      {totalBonusPoints >= 0 ? `+${totalBonusPoints}` : totalBonusPoints}đ
                    </strong>
                  </span>
                )}
              </div>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {studentsList.map((st, idx) => (
                  <option key={st.id} value={st.id}>
                    STT {String(idx + 1).padStart(2, '0')} - {st.name} ({st.group || `Tổ ${((idx % 4) + 1)}`}) [Điểm thi đua: {(st.bonusPoints || 0) >= 0 ? `+${st.bonusPoints || 0}` : (st.bonusPoints || 0)}]
                  </option>
                ))}
              </select>
            </div>

            {/* Nội Dung Phân Loại Nhanh */}
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase mb-2">
                Nội Dung Phân Loại Nhanh
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentCategoryList.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory === cat.label;
                  return (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => handleSelectCategory(cat.label, cat.defaultPoints)}
                      className={`p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? activeType === 'violation'
                            ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-300'
                            : 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-300'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${isSelected ? (activeType === 'violation' ? 'text-rose-600' : 'text-emerald-600') : 'text-slate-400'}`} />
                        <span className="text-xs font-bold leading-snug">{cat.label}</span>
                      </div>
                      <span
                        className={`text-[11px] font-black px-2 py-0.5 rounded-md ${
                          cat.defaultPoints < 0
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {cat.defaultPoints > 0 ? `+${cat.defaultPoints}đ` : `${cat.defaultPoints}đ`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Điểm Số (+/-), Tuần Học, Ngày Ghi */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                  Điểm Số (+ / -)
                </label>
                <input
                  type="number"
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  className={`w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-black text-center focus:ring-2 focus:ring-blue-500 focus:outline-none ${
                    points < 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                  Tuần Học
                </label>
                <select
                  value={week}
                  onChange={(e) => setWeek(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {Array.from({ length: 35 }, (_, i) => (
                    <option key={i + 1} value={`Tuần ${i + 1}`}>
                      Tuần {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                  Ngày Ghi
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Tiết Học / Thời Điểm */}
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                Tiết Học / Thời Điểm
              </label>
              <input
                type="text"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="Ví dụ: 15 phút đầu giờ, Tiết 1, Giờ sinh hoạt..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Ghi Chú Chi Tiết */}
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                Ghi Chú Chi Tiết
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhập ghi chú thêm nếu cần (ví dụ: nhắc nhở lần 1, tích cực xung phong...)"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
              />
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                className={`px-6 py-2.5 rounded-xl text-xs font-black text-white shadow-md transition-all cursor-pointer ${
                  activeType === 'violation'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                + Lưu Ghi Nhận
              </button>
            </div>
          </form>
        ) : (
          /* Modal Body: Point History & Cumulative Breakdown */
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-800">
            {/* Student selection */}
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase mb-1.5">
                Xem Lịch Sử Thi Đua Học Sinh
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {studentsList.map((st, idx) => (
                  <option key={st.id} value={st.id}>
                    STT {String(idx + 1).padStart(2, '0')} - {st.name} ({st.group || `Tổ ${((idx % 4) + 1)}`})
                  </option>
                ))}
              </select>
            </div>

            {/* Total balance cards */}
            <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-slate-100 border border-slate-200 text-center">
              <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500">Tổng Khen Thưởng</div>
                <div className="text-base font-black text-emerald-600 flex items-center justify-center gap-1 mt-0.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>+{totalPositive}đ</span>
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500">Tổng Vi Phạm</div>
                <div className="text-base font-black text-rose-600 flex items-center justify-center gap-1 mt-0.5">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span>{totalNegative}đ</span>
                </div>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-500">Điểm Tích Lũy Cuối</div>
                <div className={`text-base font-black flex items-center justify-center gap-1 mt-0.5 ${
                  totalBonusPoints >= 0 ? 'text-blue-600' : 'text-rose-600'
                }`}>
                  <Award className="w-3.5 h-3.5" />
                  <span>{totalBonusPoints >= 0 ? `+${totalBonusPoints}` : totalBonusPoints}đ</span>
                </div>
              </div>
            </div>

            {/* Records List */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase text-slate-700">Chi Tiết Từng Lần Ghi Nhận</h4>
              {studentRecords.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
                  Chưa có lượt ghi nhận nề nếp hoặc khen thưởng nào cho em {currentStudent?.name}.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {studentRecords.map((rec) => (
                    <div
                      key={rec.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                        rec.points < 0
                          ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                          : 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`p-1.5 rounded-xl shrink-0 mt-0.5 ${
                          rec.points < 0 ? 'bg-rose-200 text-rose-800' : 'bg-emerald-200 text-emerald-800'
                        }`}>
                          {rec.points < 0 ? <AlertTriangle className="w-4 h-4" /> : <Award className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="text-xs font-black">{rec.category}</div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            {rec.date} • {rec.week} • {rec.period}
                          </div>
                          {rec.note && (
                            <div className="text-[11px] italic text-slate-600 mt-0.5">
                              "{rec.note}"
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-black px-2.5 py-1 rounded-xl shadow-xs ${
                          rec.points < 0 ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                        }`}>
                          {rec.points > 0 ? `+${rec.points}đ` : `${rec.points}đ`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
