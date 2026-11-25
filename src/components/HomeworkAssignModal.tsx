import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Link2,
  Copy,
  Check,
  QrCode,
  Clock,
  Calendar,
  Sparkles,
  Send,
  ExternalLink,
  CheckCircle2,
  ClipboardList,
  AlertCircle,
  RotateCcw,
  Eye,
  Shuffle,
  ShieldCheck,
  Layers,
  Loader2,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ClassRoom,
  HomeworkAssignMode,
  HomeworkAssignment,
  OnlineExamAntiCheatMode,
  OnlineExamVariant,
  QuizQuestion,
} from '../types';
import {
  createHomeworkAssignment,
  getHomeworkShareUrl,
} from '../utils/homeworkService';
import { generateOnlineExamVariants } from '../utils/examVariantsService';
import { gameSounds } from '../utils/gameSoundEffects';
import { normalizeTeacherOwnerId } from '../utils/teacherPrivacy';

interface HomeworkAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: QuizQuestion[];
  defaultTitle: string;
  subject: string;
  grade: string;
  teacherId: string;
  teacherName: string;
  teacherClasses: ClassRoom[];
  defaultClassId?: string;
  onCreated?: (assignment: HomeworkAssignment) => void;
  onOpenTracker?: (assignmentId: string) => void;
  onPreviewStudent?: (assignmentId: string) => void;
}

export const HomeworkAssignModal: React.FC<HomeworkAssignModalProps> = ({
  isOpen,
  onClose,
  questions,
  defaultTitle,
  subject,
  grade,
  teacherId,
  teacherName,
  teacherClasses,
  defaultClassId,
  onCreated,
  onOpenTracker,
  onPreviewStudent,
}) => {
  const [assignMode, setAssignMode] = useState<HomeworkAssignMode>(
    teacherClasses.length > 0 ? 'class' : 'open_link'
  );
  const [selectedClassId, setSelectedClassId] = useState<string>(
    defaultClassId || teacherClasses[0]?.id || ''
  );
  const [title, setTitle] = useState<string>(defaultTitle || `Đề online ${subject}`);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [dueDate, setDueDate] = useState<string>('');
  const [allowRetake, setAllowRetake] = useState<boolean>(false);
  const [showAnswersAfterSubmit, setShowAnswersAfterSubmit] = useState<boolean>(true);
  const [antiCheatMode, setAntiCheatMode] = useState<OnlineExamAntiCheatMode>('shuffle_original');
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [shuffleOptions, setShuffleOptions] = useState<boolean>(true);
  const [variantCount, setVariantCount] = useState<number>(3);
  const [note, setNote] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savingStepText, setSavingStepText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [createdAssignment, setCreatedAssignment] = useState<HomeworkAssignment | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(defaultTitle || `Đề online ${subject}`);
      setCreatedAssignment(null);
      setErrorMsg('');
      setCopied(false);
      setSavingStepText('');
      if (defaultClassId && teacherClasses.some((c) => c.id === defaultClassId)) {
        setSelectedClassId(defaultClassId);
      } else if (teacherClasses.length > 0 && !teacherClasses.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(teacherClasses[0].id);
      }
      if (teacherClasses.length === 0) {
        setAssignMode('open_link');
      }
    }
  }, [isOpen, defaultTitle, subject, defaultClassId, teacherClasses]);

  if (!isOpen) return null;

  const selectedClass = teacherClasses.find((c) => c.id === selectedClassId) || null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!questions || questions.length === 0) {
      setErrorMsg('Chưa có câu hỏi nào trong đề. Vui lòng tạo hoặc mở đề trước.');
      return;
    }

    if (assignMode === 'class' && !selectedClass) {
      setErrorMsg('Vui lòng chọn một lớp học hoặc chuyển sang phương án Giao theo link tự do.');
      return;
    }

    setIsSaving(true);
    try {
      const resolvedTitle = title.trim() || `Đề online ${subject}`;
      const resolvedGrade = selectedClass?.grade || grade;
      let generatedVariants: OnlineExamVariant[] | undefined;

      if (antiCheatMode === 'variants_and_shuffle') {
        setSavingStepText(`Đang tạo ${variantCount} mã đề tương tự & trộn câu hỏi...`);
        const variantRes = await generateOnlineExamVariants({
          questions,
          variantCount,
          subject,
          grade: resolvedGrade,
          title: resolvedTitle,
          shuffleQuestions,
          shuffleOptions,
        });
        generatedVariants = variantRes.variants;
      }

      setSavingStepText('Đang phát hành link Đề online...');
      const created = await createHomeworkAssignment({
        title: resolvedTitle,
        subject,
        grade: resolvedGrade,
        teacherId: normalizeTeacherOwnerId(teacherId),
        teacherName: teacherName || 'Giáo viên',
        mode: assignMode,
        classroom: assignMode === 'class' ? selectedClass : null,
        questions,
        durationMinutes,
        allowRetake,
        showAnswersAfterSubmit,
        antiCheatMode,
        shuffleQuestions: antiCheatMode !== 'none' ? shuffleQuestions : false,
        shuffleOptions: antiCheatMode !== 'none' ? shuffleOptions : false,
        variantCount: antiCheatMode === 'variants_and_shuffle' ? variantCount : 1,
        variants: generatedVariants,
        dueDate: dueDate || undefined,
        note: note.trim() || undefined,
      });

      setCreatedAssignment(created);
      gameSounds.playVictoryFanfare();
      onCreated?.(created);
    } catch (err: any) {
      console.error('Create online exam error:', err);
      setErrorMsg('Không thể tạo Đề online. Vui lòng kiểm tra kết nối mạng và thử lại.');
    } finally {
      setIsSaving(false);
      setSavingStepText('');
    }
  };

  const shareUrl = createdAssignment ? getHomeworkShareUrl(createdAssignment.id) : '';

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto pb-safe">
      <div className="w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl overflow-hidden text-slate-900 my-auto">
        {/* Top Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <Send className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-lg font-black tracking-tight truncate">
                {createdAssignment ? 'Đã Tạo Link Đề Online' : 'Giao Đề Online Cho Học Sinh'}
              </h3>
              <p className="text-xs text-slate-300 truncate">
                {questions.length} câu hỏi · {subject} · {grade}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[38px] min-h-[38px] p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0 flex items-center justify-center"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdAssignment ? (
          /* STEP 2: SHARE LINK & QR VIEW */
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[82dvh] overflow-y-auto">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="text-sm font-black text-emerald-950">
                  Đề online &ldquo;{createdAssignment.title}&rdquo; đã sẵn sàng!
                </div>
                <div className="text-xs text-emerald-800">
                  {createdAssignment.mode === 'class' ? (
                    <>
                      Hình thức: <strong>Giao theo lớp {createdAssignment.className}</strong> (
                      {createdAssignment.classRoster?.length || 0} học sinh trong danh sách lớp).
                    </>
                  ) : (
                    <>
                      Hình thức: <strong>Giao theo link tự do</strong> (bất kỳ học sinh nào có link đều nhập tên và làm bài ngay).
                    </>
                  )}
                </div>
                {createdAssignment.antiCheatMode === 'variants_and_shuffle' &&
                  createdAssignment.variants &&
                  createdAssignment.variants.length > 0 && (
                    <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-black text-indigo-800 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                        Chống quay cóp:
                      </span>
                      {createdAssignment.variants.map((v) => (
                        <span
                          key={v.id}
                          className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-200 font-mono text-[11px] font-black"
                        >
                          {v.label}
                        </span>
                      ))}
                    </div>
                  )}
                {createdAssignment.antiCheatMode === 'shuffle_original' && (
                  <div className="pt-1 text-[11px] font-bold text-indigo-800 flex items-center gap-1.5">
                    <Shuffle className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Chống quay cóp: Tự động xáo trộn thứ tự câu hỏi &amp; đáp án riêng cho từng học sinh.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Share Link Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-600">
                  Đường Link Gửi Học Sinh (Zalo / Messenger / Classroom)
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 font-mono text-xs font-black">
                  Mã: {createdAssignment.code}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 font-mono text-xs text-slate-800 select-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Đã Sao Chép Link!' : 'Sao Chép Link'}</span>
                </button>
              </div>
            </div>

            {/* QR Code + Student Features Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col items-center justify-center text-center">
                <QRCodeSVG value={shareUrl} size={156} level="M" includeMargin={true} />
                <span className="text-[11px] font-bold text-slate-500 mt-1 flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-slate-600" />
                  Học sinh quét QR để làm bài trên điện thoại
                </span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="font-black text-slate-900 text-sm mb-1">
                  Học sinh & Giáo viên nhận được:
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Học sinh làm xong xem ngay <strong>điểm số (thang 10)</strong> và câu đúng/sai.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Hiển thị đầy đủ <strong>lời giải chi tiết</strong> và đáp án chuẩn từng câu.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Giáo viên theo dõi <strong>quá trình làm bài</strong>: thời gian mỗi câu, số lần đổi đáp án, mốc nộp bài.
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => onPreviewStudent?.(createdAssignment.id)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4 text-indigo-600" />
                <span>Mở Thử Giao Diện Học Sinh</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onOpenTracker?.(createdAssignment.id);
                    onClose();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
                >
                  <ClipboardList className="w-4 h-4" />
                  <span>Xem Bảng Điểm & Quá Trình</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                >
                  Hoàn Tất
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* STEP 1: CONFIGURE ASSIGNMENT */
          <form onSubmit={handleCreate} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 2 Assignment Mode Options */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 block">
                1. Chọn phương án phát Đề online
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAssignMode('class')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    assignMode === 'class'
                      ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          assignMode === 'class'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                      </div>
                      <span className="font-black text-sm text-slate-900">Giao Theo Lớp</span>
                    </div>
                    {assignMode === 'class' && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Gắn danh sách lớp học. Học sinh chọn đúng tên mình trong lớp và giáo viên thống kê được ai đã nộp / chưa nộp.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAssignMode('open_link')}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                    assignMode === 'open_link'
                      ? 'border-indigo-600 bg-indigo-50/70 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                          assignMode === 'open_link'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Link2 className="w-4 h-4" />
                      </div>
                      <span className="font-black text-sm text-slate-900">Giao Theo Link Tự Do</span>
                    </div>
                    {assignMode === 'open_link' && (
                      <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tạo link mở gửi qua nhóm Zalo/Messenger. Bất kỳ học sinh nào mở link đều nhập tên và làm bài tự do.
                  </p>
                </button>
              </div>
            </div>

            {/* Class Selector when mode === 'class' */}
            {assignMode === 'class' && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  Chọn lớp được giao bài:
                </label>
                {teacherClasses.length > 0 ? (
                  <>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {teacherClasses.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          Lớp {cls.name} ({cls.grade}) — {cls.students?.length || 0} học sinh
                        </option>
                      ))}
                    </select>
                    {selectedClass && (
                      <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          Sĩ số gắn kèm: <strong>{selectedClass.students?.length || 0} học sinh</strong>
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-2">
                    <span>
                      Hiện chưa có lớp học nào trong mục <strong>Lớp Học</strong>. Thầy/Cô có thể dùng phương án{' '}
                      <strong>Giao Theo Link Tự Do</strong>.
                    </span>
                    <button
                      type="button"
                      onClick={() => setAssignMode('open_link')}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                    >
                      Dùng Link Tự Do
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Title & Settings */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1.5">
                  2. Tên Đề online: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Đề online Chương I - Hàm số (Lớp 12A1)"
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Thời gian làm bài:</span>
                  </label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={0}>Không giới hạn thời gian</option>
                    <option value={15}>15 phút</option>
                    <option value={30}>30 phút</option>
                    <option value={45}>45 phút</option>
                    <option value={60}>60 phút</option>
                    <option value={90}>90 phút</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Hạn nộp (tùy chọn):</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 block mb-1.5">
                  Dặn dò học sinh (tùy chọn):
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ví dụ: Các em làm cẩn thận, đọc kỹ lời giải chi tiết sau khi nộp bài nhé!"
                  className="w-full px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAnswersAfterSubmit}
                    onChange={(e) => setShowAnswersAfterSubmit(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-slate-900 flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Xem đáp án & lời giải chi tiết</span>
                    </div>
                    <div className="text-[11px] text-slate-500">Hiển thị ngay sau khi nộp bài</div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowRetake}
                    onChange={(e) => setAllowRetake(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-slate-900 flex items-center gap-1">
                      <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Cho phép làm lại nhiều lần</span>
                    </div>
                    <div className="text-[11px] text-slate-500">Lưu lịch sử từng lần làm bài</div>
                  </div>
                </label>
              </div>
              {/* 3. Chống quay cóp & Trộn mã đề online */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>3. Chống quay cóp &amp; Trộn mã đề online</span>
                  </label>
                  <span className="text-[11px] font-bold text-indigo-700">
                    Hạn chế trao đổi khi kiểm tra
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAntiCheatMode('none')}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      antiCheatMode === 'none'
                        ? 'border-slate-900 bg-white shadow-xs'
                        : 'border-slate-200 bg-white/70 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-black text-slate-900 mb-0.5">Giữ nguyên đề gốc</div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Mọi học sinh làm cùng thứ tự câu &amp; đáp án.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAntiCheatMode('shuffle_original')}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      antiCheatMode === 'shuffle_original'
                        ? 'border-indigo-600 bg-white shadow-xs'
                        : 'border-slate-200 bg-white/70 hover:border-indigo-300'
                    }`}
                  >
                    <div className="text-xs font-black text-indigo-900 flex items-center gap-1 mb-0.5">
                      <Shuffle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>Xáo trộn đề gốc</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      Mỗi học sinh nhận một thứ tự câu &amp; đáp án riêng.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAntiCheatMode('variants_and_shuffle')}
                    className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      antiCheatMode === 'variants_and_shuffle'
                        ? 'border-emerald-600 bg-white shadow-xs'
                        : 'border-slate-200 bg-white/70 hover:border-emerald-300'
                    }`}
                  >
                    <div className="text-xs font-black text-emerald-900 flex items-center gap-1 mb-0.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Tạo thêm đề tương tự</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">
                      AI sinh thêm các mã đề đổi số/hàm tương đương rồi trộn.
                    </p>
                  </button>
                </div>

                {antiCheatMode !== 'none' && (
                  <div className="pt-2 border-t border-indigo-200/70 space-y-2.5">
                    {antiCheatMode === 'variants_and_shuffle' && (
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-emerald-200">
                        <span className="text-xs font-bold text-slate-800">
                          Số mã đề phát hành (Mã 101, 102...):
                        </span>
                        <div className="flex items-center gap-1.5">
                          {[2, 3, 4].map((cnt) => (
                            <button
                              key={cnt}
                              type="button"
                              onClick={() => setVariantCount(cnt)}
                              className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                variantCount === cnt
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {cnt} mã đề
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shuffleQuestions}
                          onChange={(e) => setShuffleQuestions(e.target.checked)}
                          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          Trộn thứ tự câu hỏi (theo từng phần)
                        </span>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={shuffleOptions}
                          onChange={(e) => setShuffleOptions(e.target.checked)}
                          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          Xáo trộn thứ tự đáp án A, B, C, D
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Submit */}
            <div className="pt-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 pb-safe">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2.5 min-h-[42px] rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 text-amber-300 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-300" />
                )}
                <span>
                  {isSaving ? savingStepText || 'Đang Tạo Link...' : 'Tạo Link Đề Online Ngay'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
