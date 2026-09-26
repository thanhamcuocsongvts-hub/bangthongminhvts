import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Dices,
  Play,
  Square,
  QrCode,
  Users,
  CheckCircle2,
  FolderOpen,
  PenTool,
  Trophy,
  Award,
  Layers,
  Sparkles,
  BookOpen,
  Smartphone,
  Tv,
  Volume2,
  CheckSquare,
  ArrowRight,
  Plus,
  Minus,
  AlertCircle,
  Star,
  Crown,
} from 'lucide-react';
import { LessonDoc, RoomState, TeacherProfile, ClassRoom, ClassStudent } from '../types';

interface TeacherMobileRemoteProps {
  currentLesson: LessonDoc;
  allLessons: LessonDoc[];
  activeTeacher: TeacherProfile | null;
  roomState: RoomState | null;
  onSelectLesson: (lesson: LessonDoc) => void;
  onOpenQR: () => void;
  onOpenRandomPicker: () => void;
  onSwitchTab: (tab: any) => void;
  onControlRoom: (index: number, isLive: boolean) => Promise<void>;
  onResetRoom: () => Promise<void>;
  onAddStudentBonusPoint?: (studentId: string, points: number) => void;
  onSetStudentOralScore?: (studentId: string, score: number) => void;
  syncStatus?: 'synced' | 'syncing' | 'offline' | 'error';
}

export const TeacherMobileRemote: React.FC<TeacherMobileRemoteProps> = ({
  currentLesson,
  allLessons,
  activeTeacher,
  roomState,
  onSelectLesson,
  onOpenQR,
  onOpenRandomPicker,
  onSwitchTab,
  onControlRoom,
  onResetRoom,
  onAddStudentBonusPoint,
  onSetStudentOralScore,
  syncStatus = 'synced',
}) => {
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    return activeTeacher?.classes?.[0]?.id || '';
  });
  const [quickPickedStudent, setQuickPickedStudent] = useState<ClassStudent | null>(null);
  const [showPickedToast, setShowPickedToast] = useState<string | null>(null);

  const currentClass: ClassRoom | undefined = activeTeacher?.classes?.find(
    (c) => c.id === selectedClassId
  ) || activeTeacher?.classes?.[0];

  const slides = currentLesson?.slides || [];
  const hasSlides = slides.length > 0;
  const currentSlide = hasSlides ? slides[activeSlideIndex] : null;

  // Handle slide advance with haptic feedback
  const handlePrevSlide = () => {
    if (activeSlideIndex > 0) {
      if ('vibrate' in navigator) navigator.vibrate(30);
      setActiveSlideIndex((prev) => prev - 1);
    }
  };

  const handleNextSlide = () => {
    if (activeSlideIndex < slides.length - 1) {
      if ('vibrate' in navigator) navigator.vibrate(30);
      setActiveSlideIndex((prev) => prev + 1);
    }
  };

  // Instant 1-tap Lucky Student Picker
  const handleQuickPickStudent = () => {
    if (!currentClass || !currentClass.students || currentClass.students.length === 0) {
      onOpenRandomPicker();
      return;
    }
    if ('vibrate' in navigator) navigator.vibrate([40, 60, 40]);
    const validStudents = currentClass.students.filter((s) => s.status !== 'absent');
    if (validStudents.length === 0) return;
    const randomIdx = Math.floor(Math.random() * validStudents.length);
    const chosen = validStudents[randomIdx];
    setQuickPickedStudent(chosen);
    setShowPickedToast(`Đã chọn ngẫu nhiên: ${chosen.name} (${chosen.code})`);
    setTimeout(() => setShowPickedToast(null), 4000);
  };

  const handleQuickAddPoint = (student: ClassStudent, pts: number) => {
    if ('vibrate' in navigator) navigator.vibrate(40);
    onAddStudentBonusPoint?.(student.id, pts);
    setShowPickedToast(
      pts > 0
        ? `🎉 Đã khen thưởng +${pts} điểm cho ${student.name}!`
        : `⚠️ Đã trừ ${pts} điểm của ${student.name}!`
    );
    setTimeout(() => setShowPickedToast(null), 3000);
  };

  const handleQuickSetOral = (student: ClassStudent, score: number) => {
    if ('vibrate' in navigator) navigator.vibrate(50);
    onSetStudentOralScore?.(student.id, score);
    setShowPickedToast(
      score === 10
        ? `👑 Xuất sắc! Đã chấm 10 điểm cho ${student.name}!`
        : score === 0
        ? `❌ Đã chấm 0 điểm cho ${student.name}!`
        : `Đã chấm ${score} điểm cho ${student.name}!`
    );
    setTimeout(() => setShowPickedToast(null), 3000);
  };

  // Live Quiz Control
  const totalQuestions = roomState?.questions?.length || 0;
  const currentQuestionIdx = roomState?.activeQuestionIndex ?? 0;
  const isLive = roomState?.isLive ?? false;
  const currentQId = roomState?.questions?.[currentQuestionIdx]?.id;
  const submissionsCount = currentQId && roomState?.submissions?.[currentQId]
    ? roomState.submissions[currentQId].length
    : 0;

  return (
    <div className="w-full flex flex-col gap-3.5 pb-20 select-none animate-in fade-in duration-200">
      {/* Toast Notification */}
      {showPickedToast && (
        <div className="fixed top-14 left-4 right-4 z-50 p-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-amber-400/40 text-xs font-bold flex items-center justify-between animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="truncate">{showPickedToast}</span>
          </div>
          <button onClick={() => setShowPickedToast(null)} className="text-slate-400 hover:text-white text-xs">
            ✕
          </button>
        </div>
      )}

      {/* Teacher Status & TV Connection Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 rounded-3xl shadow-lg border border-indigo-500/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-xl shadow-inner">
              {activeTeacher?.avatar || '👨‍🏫'}
            </div>
            <div>
              <div className="text-xs font-black flex items-center gap-1.5 text-white">
                <span>{activeTeacher?.name || 'Giáo Viên'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Remote TV 75"
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                {activeTeacher?.subject || 'Bộ Môn'} • {currentClass?.name || 'Chưa chọn lớp'}
              </div>
            </div>
          </div>

          {/* QR & PIN Quick Launcher */}
          <button
            onClick={onOpenQR}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-black shadow-xs cursor-pointer active:scale-95"
            title="Mở mã QR cho học sinh quét vào phòng"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>PIN: {roomState?.pin || '758899'}</span>
          </button>
        </div>

        {/* Quick Class Selector if Teacher has multiple classes */}
        {activeTeacher?.classes && activeTeacher.classes.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 custom-scrollbar">
            <span className="text-[10px] text-slate-400 shrink-0">Lớp:</span>
            {activeTeacher.classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setSelectedClassId(cls.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                  (currentClass?.id === cls.id)
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white/10 text-slate-300 hover:bg-white/15'
                }`}
              >
                {cls.name} ({cls.students?.length || 0} HS)
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CARD 1: PRESENTATION & SLIDE CLICKER (ĐIỀU KHIỂN TRÌNH CHIẾU) */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-indigo-50 text-indigo-700">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-slate-800">Điều Khiển Trình Chiếu</div>
              <div className="text-[10px] text-slate-500 truncate max-w-[200px]">
                {currentLesson?.title || 'Chưa chọn bài giảng'}
              </div>
            </div>
          </div>

          <button
            onClick={() => onSwitchTab('documents')}
            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Đổi bài</span>
          </button>
        </div>

        {hasSlides ? (
          <div className="flex flex-col gap-3">
            {/* Current Slide Preview Box */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-50/70 to-slate-100 border border-indigo-200/80 flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                  Slide {activeSlideIndex + 1} / {slides.length}
                </span>
                <span className="text-[10px] text-slate-500">
                  {currentSlide?.subtitle || 'NỘI DUNG'}
                </span>
              </div>
              <h4 className="text-sm font-black text-slate-900 line-clamp-2">
                {currentSlide?.title || `Slide ${activeSlideIndex + 1}`}
              </h4>
              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {currentSlide?.content || 'Trình chiếu nội dung bài giảng lên màn hình tivi.'}
              </p>
            </div>

            {/* Big Ergonomic Clicker Buttons (Thumb Friendly) */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={handlePrevSlide}
                disabled={activeSlideIndex === 0}
                className="py-4 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-slate-800 font-black text-sm flex items-center justify-center gap-2 border border-slate-300/80 shadow-xs transition-all cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5 text-slate-700" />
                <span>Slide Trước</span>
              </button>

              <button
                onClick={handleNextSlide}
                disabled={activeSlideIndex === slides.length - 1}
                className="py-4 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-indigo-600/25 transition-all cursor-pointer"
              >
                <span>Kế Tiếp</span>
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Quick Slide Carousel Jump */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 custom-scrollbar">
              {slides.map((s, idx) => (
                <button
                  key={s.id || idx}
                  onClick={() => setActiveSlideIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    activeSlideIndex === idx
                      ? 'bg-indigo-600 text-white shadow-xs scale-105'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center flex flex-col items-center gap-2">
            <BookOpen className="w-7 h-7 text-indigo-400" />
            <div className="text-xs text-slate-600">
              Bài giảng hiện tại chưa có slide trình chiếu.
            </div>
            <button
              onClick={() => onSwitchTab('documents')}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow cursor-pointer"
            >
              Chọn bài có Slide từ Kho
            </button>
          </div>
        )}
      </div>

      {/* CARD 2: QUICK LUCKY STUDENT PICKER & SCORING (QUAY GỌI HỌC SINH & CHẤM ĐIỂM) */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-amber-50 text-amber-600">
              <Dices className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-slate-800">Gọi Học Sinh & Chấm Điểm</div>
              <div className="text-[10px] text-slate-500">
                {currentClass?.name || 'Lớp học'} ({currentClass?.students?.length || 0} học sinh)
              </div>
            </div>
          </div>

          <button
            onClick={onOpenRandomPicker}
            className="text-[11px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Vòng quay lớn</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* 1-Tap Trigger Big Button */}
        <button
          onClick={handleQuickPickStudent}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:brightness-105 active:scale-98 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-amber-500/25 transition-all cursor-pointer"
        >
          <Dices className="w-5 h-5 animate-spin-slow" />
          <span>🎲 BẤM QUAY GỌI NGẪU NHIÊN</span>
        </button>

        {/* Quick Result & Instant Grading */}
        {quickPickedStudent && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col gap-2.5 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-200 border border-amber-300 flex items-center justify-center text-lg">
                  {quickPickedStudent.avatar || '🎓'}
                </div>
                <div>
                  <div className="text-xs font-black text-slate-900">{quickPickedStudent.name}</div>
                  <div className="text-[10px] text-amber-800 font-mono font-bold">
                    Mã: {quickPickedStudent.code} • STT: {quickPickedStudent.stt || '1'}
                  </div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-amber-200 text-amber-900 rounded-md font-bold">
                Được chọn!
              </span>
            </div>

            {/* Instant Grading Buttons: Trừ Điểm (-1, -2, 0 đ) & Khen Thưởng (+1, +2, 10 đ) */}
            <div className="pt-2 border-t border-amber-200/80 flex flex-col gap-2">
              {/* KHEN THƯỞNG */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-emerald-800 uppercase flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span>Khen thưởng:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleQuickAddPoint(quickPickedStudent, 1)}
                    className="flex-1 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    title="Khen thưởng +1 điểm"
                  >
                    <span>+1 đ</span>
                  </button>
                  <button
                    onClick={() => handleQuickAddPoint(quickPickedStudent, 2)}
                    className="flex-1 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    title="Khen thưởng +2 điểm"
                  >
                    <span>+2 đ</span>
                  </button>
                  <button
                    onClick={() => handleQuickSetOral(quickPickedStudent, 10)}
                    className="flex-1 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 active:scale-95 text-slate-950 font-black text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer border border-amber-300"
                    title="Chấm 10 điểm miệng"
                  >
                    <Crown className="w-3 h-3 text-slate-950" />
                    <span>10 đ</span>
                  </button>
                </div>
              </div>

              {/* TRỪ ĐIỂM */}
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-rose-800 uppercase flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-rose-600" />
                  <span>Trừ điểm:</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleQuickAddPoint(quickPickedStudent, -1)}
                    className="flex-1 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    title="Trừ 1 điểm (-1 đ)"
                  >
                    <span>-1 đ</span>
                  </button>
                  <button
                    onClick={() => handleQuickAddPoint(quickPickedStudent, -2)}
                    className="flex-1 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 active:scale-95 text-white font-black text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    title="Trừ 2 điểm (-2 đ)"
                  >
                    <span>-2 đ</span>
                  </button>
                  <button
                    onClick={() => handleQuickSetOral(quickPickedStudent, 0)}
                    className="flex-1 py-1.5 rounded-xl bg-slate-900 hover:bg-black active:scale-95 text-rose-300 font-black text-xs flex items-center justify-center gap-1 shadow-xs cursor-pointer border border-rose-500/30"
                    title="Chấm 0 điểm (0 đ)"
                  >
                    <span>0 đ</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CARD 3: LIVE QUIZ CONTROLLER (ĐIỀU KHIỂN TRẮC NGHIỆM) */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-slate-800">Điều Khiển Trắc Nghiệm</div>
              <div className="text-[10px] text-slate-500">
                {totalQuestions > 0 ? `${totalQuestions} câu hỏi trắc nghiệm` : 'Chưa có câu hỏi'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isLive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {isLive ? 'Đang Nhận Bài' : 'Đang Dừng'}
            </span>
          </div>
        </div>

        {totalQuestions > 0 ? (
          <div className="flex flex-col gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-700">
                  Câu {currentQuestionIdx + 1}/{totalQuestions}
                </span>
                <span className="text-[11px] text-slate-500 truncate max-w-[170px]">
                  {roomState?.questions?.[currentQuestionIdx]?.question || 'Đang thi'}
                </span>
              </div>
              <div className="font-mono font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                {submissionsCount} bài nộp
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onControlRoom(currentQuestionIdx, !isLive)}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                  isLive
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-emerald-600 text-white shadow-xs'
                }`}
              >
                {isLive ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isLive ? 'Khóa Làm Bài' : 'Mở Nhận Bài'}</span>
              </button>

              <button
                onClick={() => {
                  const nextIdx = (currentQuestionIdx + 1) % totalQuestions;
                  onControlRoom(nextIdx, isLive);
                }}
                className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>Câu Tiếp Theo</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-slate-50 text-center text-xs text-slate-500">
            Chưa có câu hỏi thi trong bài học này.
          </div>
        )}
      </div>

      {/* QUICK SWITCH TO TV MODES */}
      <div className="bg-slate-900 text-white rounded-3xl p-4 shadow-md flex flex-col gap-2.5">
        <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
          <Tv className="w-3.5 h-3.5 text-indigo-400" />
          <span>Chuyển Chế Độ Giảng Dạy Trên TV:</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onSwitchTab('whiteboard')}
            className="py-2.5 px-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold flex flex-col items-center gap-1 text-center cursor-pointer"
          >
            <PenTool className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px]">Bảng Viết</span>
          </button>
          <button
            onClick={() => onSwitchTab('documents')}
            className="py-2.5 px-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold flex flex-col items-center gap-1 text-center cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 text-amber-400" />
            <span className="text-[10px]">Kho Bài</span>
          </button>
          <button
            onClick={() => onSwitchTab('gradebook')}
            className="py-2.5 px-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold flex flex-col items-center gap-1 text-center cursor-pointer"
          >
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-[10px]">Lớp Học</span>
          </button>
        </div>
      </div>
    </div>
  );
};
