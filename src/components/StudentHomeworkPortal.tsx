import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BookOpen,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Send,
  Award,
  User,
  Users,
  Search,
  Sparkles,
  AlertCircle,
  Loader2,
  RotateCcw,
  FileText,
  Lock,
  Check,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  HomeworkActivityEvent,
  HomeworkAssignment,
  HomeworkRosterStudent,
  HomeworkSubmission,
  QuizQuestion,
} from '../types';
import {
  detectQuestionPartType,
  getHomeworkAssignmentById,
  QuestionProcessStat,
  submitHomeworkAttempt,
} from '../utils/homeworkService';
import { QuizRichContentRenderer } from './QuizRichContentRenderer';
import { MathFormulaRenderer } from './MathFormulaRenderer';
import { gameSounds } from '../utils/gameSoundEffects';

interface StudentHomeworkPortalProps {
  assignmentId: string;
  isTeacherPreview?: boolean;
  onExit?: () => void;
}

function formatSecondsClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const StudentHomeworkPortal: React.FC<StudentHomeworkPortalProps> = ({
  assignmentId,
  isTeacherPreview = false,
  onExit,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [assignment, setAssignment] = useState<HomeworkAssignment | null>(null);
  const [loadError, setLoadError] = useState<string>('');

  // Student identity phase
  const [phase, setPhase] = useState<'intro' | 'taking' | 'result'>('intro');
  const [studentName, setStudentName] = useState<string>('');
  const [studentClassName, setStudentClassName] = useState<string>('');
  const [selectedRosterStudent, setSelectedRosterStudent] = useState<HomeworkRosterStudent | null>(
    null
  );
  const [rosterSearch, setRosterSearch] = useState<string>('');
  const [useManualRosterInput, setUseManualRosterInput] = useState<boolean>(false);

  // Taking phase state
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answersMap, setAnswersMap] = useState<Record<string, any>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [startedAtIso, setStartedAtIso] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false);

  // Process telemetry refs
  const questionStatsRef = useRef<Record<string, QuestionProcessStat>>({});
  const activeQuestionStartMsRef = useRef<number>(Date.now());
  const sessionStartMsRef = useRef<number>(Date.now());
  const activityLogRef = useRef<HomeworkActivityEvent[]>([]);

  // Result state
  const [submission, setSubmission] = useState<HomeworkSubmission | null>(null);
  const [resultFilter, setResultFilter] = useState<'all' | 'correct' | 'wrong'>('all');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError('');

    getHomeworkAssignmentById(assignmentId)
      .then((data) => {
        if (!mounted) return;
        if (!data) {
          setLoadError('Không tìm thấy bài tập này. Vui lòng kiểm tra lại đường link từ giáo viên.');
          setLoading(false);
          return;
        }
        setAssignment(data);
        if (data.mode === 'class' && data.className) {
          setStudentClassName(data.className);
        }
        // Check saved receipt if retake disallowed
        if (!data.allowRetake && !isTeacherPreview) {
          try {
            const savedReceipt = localStorage.getItem(`smartboard_hw_receipt_${data.id}`);
            if (savedReceipt) {
              const parsed = JSON.parse(savedReceipt) as HomeworkSubmission;
              if (parsed && parsed.assignmentId === data.id) {
                setSubmission(parsed);
                setStudentName(parsed.studentName);
                setPhase('result');
              }
            }
          } catch {}
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('Load homework error:', err);
        setLoadError('Lỗi tải dữ liệu bài tập. Vui lòng thử tải lại trang.');
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [assignmentId, isTeacherPreview]);

  const questions: QuizQuestion[] = assignment?.questions || [];
  const currentQuestion = questions[currentIdx];

  const getElapsedSecsNow = () =>
    Math.max(0, Math.round((Date.now() - sessionStartMsRef.current) / 1000));

  const appendActivity = (
    type: HomeworkActivityEvent['type'],
    detail: string,
    questionIndex?: number
  ) => {
    if (activityLogRef.current.length >= 490) return;
    activityLogRef.current.push({
      timestamp: new Date().toISOString(),
      elapsedSeconds: getElapsedSecsNow(),
      type,
      ...(typeof questionIndex === 'number' ? { questionIndex } : {}),
      detail,
    });
  };

  const flushCurrentQuestionDwellTime = (idx: number) => {
    const q = questions[idx];
    if (!q) return;
    const qId = q.id || `q_${idx + 1}`;
    const now = Date.now();
    const deltaSecs = Math.max(0, Math.round((now - activeQuestionStartMsRef.current) / 1000));
    activeQuestionStartMsRef.current = now;

    const prevStat = questionStatsRef.current[qId] || {
      timeSpentSeconds: 0,
      changeCount: 0,
    };
    questionStatsRef.current[qId] = {
      ...prevStat,
      timeSpentSeconds: prevStat.timeSpentSeconds + deltaSecs,
    };
  };

  const handleNavigateQuestion = (targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= questions.length || targetIdx === currentIdx) return;
    flushCurrentQuestionDwellTime(currentIdx);
    setCurrentIdx(targetIdx);
    activeQuestionStartMsRef.current = Date.now();
    appendActivity('view_question', `Chuyển sang xem Câu ${targetIdx + 1}`, targetIdx);
  };

  // Timer tick during taking phase
  useEffect(() => {
    if (phase !== 'taking' || !assignment) return;
    const timer = setInterval(() => {
      const secs = Math.max(0, Math.floor((Date.now() - sessionStartMsRef.current) / 1000));
      setElapsedSeconds(secs);

      if (assignment.durationMinutes > 0 && secs >= assignment.durationMinutes * 60) {
        clearInterval(timer);
        executeFinalSubmit(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, assignment]);

  const isQuestionAnswered = (q: QuizQuestion, idx: number): boolean => {
    const qId = q.id || `q_${idx + 1}`;
    const ans = answersMap[qId];
    const partType = detectQuestionPartType(q);
    if (partType === 'part_2_true_false') {
      if (!ans || typeof ans !== 'object') return false;
      const subs = q.subStatements || [];
      return subs.some((sub, sIdx) => {
        const label = String(sub.label || sub.key || ['a', 'b', 'c', 'd'][sIdx] || sIdx + 1);
        return typeof ans[label] === 'boolean' || typeof ans[String(sIdx)] === 'boolean';
      });
    }
    return typeof ans === 'string' && ans.trim().length > 0;
  };

  const answeredCount = useMemo(() => {
    return questions.filter((q, idx) => isQuestionAnswered(q, idx)).length;
  }, [questions, answersMap]);

  const handleStartHomework = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment) return;
    const resolvedName =
      assignment.mode === 'class' && selectedRosterStudent && !useManualRosterInput
        ? selectedRosterStudent.name
        : studentName.trim();

    if (!resolvedName) return;

    setStudentName(resolvedName);
    const nowIso = new Date().toISOString();
    setStartedAtIso(nowIso);
    sessionStartMsRef.current = Date.now();
    activeQuestionStartMsRef.current = Date.now();
    setElapsedSeconds(0);
    setCurrentIdx(0);
    setAnswersMap({});
    questionStatsRef.current = {};
    activityLogRef.current = [
      {
        timestamp: nowIso,
        elapsedSeconds: 0,
        type: 'start',
        detail: `${resolvedName} bắt đầu làm bài (${assignment.questions.length} câu)`,
      },
    ];
    setPhase('taking');
  };

  const handleSelectChoiceOption = (q: QuizQuestion, idx: number, optionKey: string) => {
    const qId = q.id || `q_${idx + 1}`;
    const prevVal = answersMap[qId];
    const prevStat = questionStatsRef.current[qId] || { timeSpentSeconds: 0, changeCount: 0 };

    if (prevVal && prevVal !== optionKey) {
      questionStatsRef.current[qId] = {
        ...prevStat,
        changeCount: prevStat.changeCount + 1,
        answeredAt: new Date().toISOString(),
      };
      appendActivity(
        'change_answer',
        `Đổi đáp án Câu ${idx + 1}: ${prevVal} → ${optionKey}`,
        idx
      );
    } else if (!prevVal) {
      questionStatsRef.current[qId] = {
        ...prevStat,
        answeredAt: new Date().toISOString(),
      };
      appendActivity('answer', `Chọn đáp án Câu ${idx + 1}: ${optionKey}`, idx);
    }

    setAnswersMap((prev) => ({ ...prev, [qId]: optionKey }));
  };

  const handleSelectTrueFalse = (
    q: QuizQuestion,
    idx: number,
    subLabel: string,
    choice: boolean
  ) => {
    const qId = q.id || `q_${idx + 1}`;
    const prevObj = typeof answersMap[qId] === 'object' && answersMap[qId] !== null ? answersMap[qId] : {};
    const prevChoice = prevObj[subLabel];
    const prevStat = questionStatsRef.current[qId] || { timeSpentSeconds: 0, changeCount: 0 };

    if (typeof prevChoice === 'boolean' && prevChoice !== choice) {
      questionStatsRef.current[qId] = {
        ...prevStat,
        changeCount: prevStat.changeCount + 1,
        answeredAt: new Date().toISOString(),
      };
      appendActivity(
        'change_answer',
        `Đổi ý ${subLabel}) Câu ${idx + 1}: ${prevChoice ? 'Đúng' : 'Sai'} → ${choice ? 'Đúng' : 'Sai'}`,
        idx
      );
    } else if (typeof prevChoice !== 'boolean') {
      questionStatsRef.current[qId] = {
        ...prevStat,
        answeredAt: new Date().toISOString(),
      };
      appendActivity(
        'answer',
        `Chọn ý ${subLabel}) Câu ${idx + 1}: ${choice ? 'Đúng' : 'Sai'}`,
        idx
      );
    }

    setAnswersMap((prev) => ({
      ...prev,
      [qId]: { ...prevObj, [subLabel]: choice },
    }));
  };

  const handleTextAnswerChange = (q: QuizQuestion, idx: number, value: string) => {
    const qId = q.id || `q_${idx + 1}`;
    const prevStat = questionStatsRef.current[qId] || { timeSpentSeconds: 0, changeCount: 0 };
    if (!answersMap[qId] && value.trim()) {
      appendActivity('answer', `Nhập câu trả lời Câu ${idx + 1}`, idx);
    }
    questionStatsRef.current[qId] = {
      ...prevStat,
      answeredAt: new Date().toISOString(),
    };
    setAnswersMap((prev) => ({ ...prev, [qId]: value }));
  };

  const executeFinalSubmit = async (autoByTimeout = false) => {
    if (!assignment || isSubmitting) return;
    setShowSubmitConfirm(false);
    setIsSubmitting(true);

    try {
      flushCurrentQuestionDwellTime(currentIdx);
      if (autoByTimeout) {
        appendActivity('submit', 'Hết thời gian làm bài — Hệ thống tự động nộp bài');
      }
      const totalSecs = Math.max(
        1,
        Math.round((Date.now() - sessionStartMsRef.current) / 1000)
      );

      const savedSub = await submitHomeworkAttempt({
        assignment,
        studentName: studentName || 'Học sinh',
        studentRosterId: selectedRosterStudent?.id,
        studentClassName: studentClassName || assignment.className,
        answersMap,
        processStats: questionStatsRef.current,
        activityLog: activityLogRef.current,
        startedAt: startedAtIso || new Date().toISOString(),
        totalTimeSeconds: totalSecs,
      });

      setSubmission(savedSub);
      setPhase('result');

      if (savedSub.totalScore >= 8) {
        gameSounds.playVictoryFanfare();
        confetti({
          particleCount: 110,
          spread: 75,
          origin: { y: 0.6 },
        });
      } else {
        gameSounds.playCorrectChime();
      }
    } catch (err) {
      console.error('Submit homework error:', err);
      alert('Có sự cố khi lưu bài nộp. Vui lòng thử bấm Nộp bài lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    if (!assignment?.allowRetake) return;
    setSubmission(null);
    setPhase('intro');
    setAnswersMap({});
    setCurrentIdx(0);
  };

  const filteredRoster = useMemo(() => {
    const roster = assignment?.classRoster || [];
    const q = rosterSearch.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (st) => st.name.toLowerCase().includes(q) || (st.code || '').toLowerCase().includes(q)
    );
  }, [assignment?.classRoster, rosterSearch]);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-slate-800">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
        <div className="text-sm font-bold text-slate-700">Đang tải bài tập về nhà...</div>
      </div>
    );
  }

  if (loadError || !assignment) {
    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 rounded-3xl bg-white border border-slate-200 shadow-sm text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-lg font-black text-slate-900">Không Thể Mở Bài Tập</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {loadError || 'Bài tập không tồn tại hoặc đã bị xóa.'}
          </p>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
            >
              Quay Lại
            </button>
          )}
        </div>
      </div>
    );
  }

  if (assignment.status === 'closed' && phase === 'intro' && !isTeacherPreview) {
    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 rounded-3xl bg-white border border-slate-200 shadow-sm text-center space-y-4">
          <Lock className="w-10 h-10 text-amber-600 mx-auto" />
          <h2 className="text-lg font-black text-slate-900">{assignment.title}</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Giáo viên đã đóng nhận bài nộp cho bài tập này. Vui lòng liên hệ giáo viên nếu cần mở lại.
          </p>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
            >
              Quay Lại
            </button>
          )}
        </div>
      </div>
    );
  }

  /* PHASE 1: WELCOME & STUDENT IDENTIFICATION */
  if (phase === 'intro') {
    const hasRoster =
      assignment.mode === 'class' &&
      Array.isArray(assignment.classRoster) &&
      assignment.classRoster.length > 0;

    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden text-slate-900">
          {/* Banner Header */}
          <div className="px-6 py-5 bg-slate-900 text-white space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-black">
                {assignment.mode === 'class'
                  ? `BÀI TẬP LỚP ${assignment.className}`
                  : 'BÀI TẬP VỀ NHÀ'}
              </span>
              {onExit && (
                <button
                  type="button"
                  onClick={onExit}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
                >
                  {isTeacherPreview ? 'Thoát Xem Thử' : 'Trang Chủ'}
                </button>
              )}
            </div>
            <h1 className="text-lg sm:text-xl font-black leading-snug">{assignment.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <span>GV: {assignment.teacherName}</span>
              <span>• {assignment.subject}</span>
              <span>• {assignment.grade}</span>
            </div>
          </div>

          <form onSubmit={handleStartHomework} className="p-6 space-y-5">
            {/* Key Info Strip */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-500">Số Câu Hỏi</div>
                <div className="text-lg font-black text-slate-900 tabular-nums">
                  {assignment.questions.length} câu
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-500">Thời Gian</div>
                <div className="text-lg font-black text-indigo-700 tabular-nums">
                  {assignment.durationMinutes > 0 ? `${assignment.durationMinutes} phút` : 'Tự do'}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-500">Lời Giải</div>
                <div className="text-sm font-black text-emerald-700 mt-1">
                  {assignment.showAnswersAfterSubmit ? 'Xem ngay' : 'GV chấm'}
                </div>
              </div>
            </div>

            {assignment.note && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 leading-relaxed">
                <strong>Dặn dò của giáo viên:</strong> {assignment.note}
              </div>
            )}

            {/* Student Identification */}
            {hasRoster && !useManualRosterInput ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>Chọn tên của em trong lớp {assignment.className}:</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setUseManualRosterInput(true);
                      setSelectedRosterStudent(null);
                    }}
                    className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    Không có tên? Tự nhập
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Gõ tên để tìm nhanh..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-white">
                  {filteredRoster.map((st) => {
                    const isPicked = selectedRosterStudent?.id === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setSelectedRosterStudent(st)}
                        className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                          isPicked
                            ? 'bg-emerald-50 text-emerald-900'
                            : 'text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <span>{st.name}</span>
                        {isPicked && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {hasRoster && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setUseManualRosterInput(false)}
                      className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Chọn từ danh sách lớp {assignment.className}
                    </button>
                  </div>
                )}

                <div>
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5 mb-1.5">
                    <User className="w-4 h-4 text-indigo-600" />
                    <span>Họ và tên học sinh: <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    type="text"
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Minh Anh"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Lớp (tùy chọn):
                  </label>
                  <input
                    type="text"
                    value={studentClassName}
                    onChange={(e) => setStudentClassName(e.target.value)}
                    placeholder="Ví dụ: 12A1"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={
                hasRoster && !useManualRosterInput
                  ? !selectedRosterStudent
                  : !studentName.trim()
              }
              className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Bắt Đầu Làm Bài Tập</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* PHASE 3: POST-SUBMISSION SCORE, RIGHT/WRONG BREAKDOWN & DETAILED EXPLANATIONS */
  if (phase === 'result' && submission) {
    const details = submission.questionDetails || [];
    const displayedDetails = details.filter((d) => {
      if (resultFilter === 'correct') return d.isCorrect;
      if (resultFilter === 'wrong') return !d.isCorrect;
      return true;
    });

    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] text-slate-900 pb-12">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-500 truncate">
                {submission.studentName}
                {submission.studentClassName ? ` · Lớp ${submission.studentClassName}` : ''}
              </div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 truncate">
                {assignment.title}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {assignment.allowRetake && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-black text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Làm Lại</span>
                </button>
              )}
              {onExit && (
                <button
                  type="button"
                  onClick={onExit}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer whitespace-nowrap"
                >
                  {isTeacherPreview ? 'Đóng Xem Thử' : 'Thoát'}
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
          {/* Score Hero Card */}
          <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-black">
                  <Award className="w-4 h-4" />
                  <span>ĐÃ HOÀN THÀNH BÀI TẬP</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  Kết Quả Bài Làm Của {submission.studentName}
                </h2>
                <p className="text-xs text-slate-500">
                  Thời gian hoàn thành: {formatSecondsClock(submission.totalTimeSeconds)} · Nộp lần{' '}
                  {submission.attemptNumber}
                </p>
              </div>

              <div className="px-6 py-4 rounded-2xl bg-slate-900 text-white text-center shrink-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  Điểm Số
                </div>
                <div className="text-4xl font-black text-emerald-400 tabular-nums">
                  {submission.totalScore.toFixed(1)}
                  <span className="text-lg text-slate-400 font-bold"> / 10</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div className="text-[11px] font-bold text-emerald-800">CÂU ĐÚNG</div>
                <div className="text-2xl font-black text-emerald-700 tabular-nums">
                  {submission.correctCount}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
                <div className="text-[11px] font-bold text-rose-800">CÂU SAI</div>
                <div className="text-2xl font-black text-rose-700 tabular-nums">
                  {submission.wrongCount}
                </div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-600">TỔNG CÂU</div>
                <div className="text-2xl font-black text-slate-900 tabular-nums">
                  {submission.totalQuestions}
                </div>
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>Chi Tiết Câu Đúng / Sai &amp; Lời Giải Chi Tiết</span>
            </h3>

            <div className="inline-flex bg-white p-1 rounded-2xl border border-slate-200 gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setResultFilter('all')}
                className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                  resultFilter === 'all'
                    ? 'bg-slate-900 text-white font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({details.length})
              </button>
              <button
                type="button"
                onClick={() => setResultFilter('correct')}
                className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                  resultFilter === 'correct'
                    ? 'bg-emerald-600 text-white font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Câu đúng ({submission.correctCount})
              </button>
              <button
                type="button"
                onClick={() => setResultFilter('wrong')}
                className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                  resultFilter === 'wrong'
                    ? 'bg-rose-600 text-white font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Câu sai ({submission.wrongCount})
              </button>
            </div>
          </div>

          {/* Detailed Question Breakdown + Full Explanations */}
          <div className="space-y-4">
            {displayedDetails.map((det) => {
              const q = questions[det.questionIndex];
              if (!q) return null;

              return (
                <div
                  key={det.questionId || det.questionIndex}
                  className={`p-5 sm:p-6 rounded-3xl bg-white border-2 shadow-xs space-y-4 ${
                    det.isCorrect
                      ? 'border-emerald-200'
                      : det.isPartiallyCorrect
                      ? 'border-amber-200'
                      : 'border-rose-200'
                  }`}
                >
                  {/* Question Status Header */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-slate-900 text-white text-xs font-black">
                        CÂU {det.questionIndex + 1}
                      </span>
                      {det.partType === 'part_4_essay' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-indigo-100 text-indigo-800 text-xs font-black">
                          <span>Tự luận</span>
                        </span>
                      ) : det.isCorrect ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-600 text-white text-xs font-black">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Đúng</span>
                        </span>
                      ) : det.isPartiallyCorrect ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-amber-500 text-white text-xs font-black">
                          <span>Đúng một phần</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-rose-600 text-white text-xs font-black">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Sai</span>
                        </span>
                      )}
                    </div>

                    <span className="text-xs font-semibold text-slate-500 tabular-nums">
                      Thời gian làm câu: {formatSecondsClock(det.timeSpentSeconds)}
                    </span>
                  </div>

                  {/* Stem + Diagram */}
                  <div className="text-slate-900 font-bold text-sm sm:text-base">
                    <QuizRichContentRenderer
                      content={q.question}
                      diagramType={q.diagramType}
                      diagramData={q.diagramData}
                      textClassName="text-slate-900 font-bold text-sm sm:text-base leading-relaxed"
                    />
                  </div>

                  {/* Options / Sub-statements comparison */}
                  {det.partType === 'part_2_true_false' && det.subResults ? (
                    <div className="space-y-2">
                      {det.subResults.map((sr) => (
                        <div
                          key={sr.label}
                          className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                            sr.isCorrect
                              ? 'bg-emerald-50/70 border-emerald-200'
                              : 'bg-rose-50/70 border-rose-200'
                          }`}
                        >
                          <div className="flex items-start gap-2 text-xs sm:text-sm font-semibold text-slate-800">
                            <span className="font-black text-indigo-700 shrink-0">{sr.label})</span>
                            <MathFormulaRenderer content={sr.text} />
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-[11px] font-black">
                            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700">
                              Em chọn:{' '}
                              {sr.studentChoice === null
                                ? 'Bỏ trống'
                                : sr.studentChoice
                                ? 'Đúng'
                                : 'Sai'}
                            </span>
                            {assignment.showAnswersAfterSubmit && (
                              <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white">
                                Đáp án: {sr.correctChoice ? 'Đúng' : 'Sai'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : det.partType === 'part_1_choice' && q.options?.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {q.options.map((opt) => {
                        const isChosen =
                          det.selectedDisplay.trim().toUpperCase() === opt.key.trim().toUpperCase();
                        const isRight =
                          assignment.showAnswersAfterSubmit &&
                          det.correctDisplay.trim().toUpperCase() === opt.key.trim().toUpperCase();

                        return (
                          <div
                            key={opt.key}
                            className={`p-3 rounded-2xl border-2 flex items-start gap-2.5 text-sm ${
                              isRight
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                                : isChosen && !det.isCorrect
                                ? 'bg-rose-50 border-rose-400 text-rose-950 font-semibold'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <span
                              className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                                isRight
                                  ? 'bg-emerald-600 text-white'
                                  : isChosen
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-white border border-slate-300 text-slate-700'
                              }`}
                            >
                              {opt.key}
                            </span>
                            <div className="flex-1 min-w-0">
                              <MathFormulaRenderer content={opt.text} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                        <span className="font-bold text-slate-500 block mb-1">Bài làm của em:</span>
                        <span className="font-black text-slate-900">{det.selectedDisplay}</span>
                      </div>
                      {assignment.showAnswersAfterSubmit && (
                        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                          <span className="font-bold text-emerald-800 block mb-1">Đáp án chuẩn:</span>
                          <span className="font-black text-emerald-900">{det.correctDisplay}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Detailed Solution Explanation */}
                  {assignment.showAnswersAfterSubmit && (q.explanation || q.essayRubric) && (
                    <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-1.5">
                      <div className="text-xs font-black uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                        <span>Lời Giải Chi Tiết</span>
                      </div>
                      <div className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                        <MathFormulaRenderer content={q.explanation || q.essayRubric || ''} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  /* PHASE 2: STUDENT TAKING HOMEWORK */
  const timeRemaining =
    assignment.durationMinutes > 0
      ? Math.max(0, assignment.durationMinutes * 60 - elapsedSeconds)
      : null;

  const currentPartType = currentQuestion
    ? detectQuestionPartType(currentQuestion)
    : 'part_1_choice';
  const currentQId = currentQuestion?.id || `q_${currentIdx + 1}`;
  const currentAnswer = answersMap[currentQId];

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] flex flex-col text-slate-900">
      {/* Sticky Exam Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-500 truncate">
              {studentName}
              {studentClassName ? ` · Lớp ${studentClassName}` : ''}
            </div>
            <h1 className="text-sm sm:text-base font-black text-slate-900 truncate">
              {assignment.title}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-black tabular-nums">
              <span>Đã làm:</span>
              <span className="text-indigo-700">
                {answeredCount}/{questions.length}
              </span>
            </div>

            <div
              className={`px-3 py-1.5 rounded-xl font-mono font-black text-xs sm:text-sm flex items-center gap-1.5 border tabular-nums ${
                timeRemaining !== null && timeRemaining <= 60
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'bg-slate-900 border-slate-800 text-white'
              }`}
            >
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>
                {timeRemaining !== null
                  ? formatSecondsClock(timeRemaining)
                  : formatSecondsClock(elapsedSeconds)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowSubmitConfirm(true)}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang Nộp...' : 'Nộp Bài'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-3 sm:p-6 space-y-4 pb-24">
        {/* Question Navigator Pills */}
        <div className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center gap-1.5 overflow-x-auto">
          {questions.map((q, idx) => {
            const isCurrent = idx === currentIdx;
            const isDone = isQuestionAnswered(q, idx);
            return (
              <button
                key={q.id || idx}
                type="button"
                onClick={() => handleNavigateQuestion(idx)}
                className={`w-9 h-9 rounded-xl font-black text-xs shrink-0 transition-all cursor-pointer tabular-nums border ${
                  isCurrent
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : isDone
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>

        {/* Active Question Card */}
        {currentQuestion && (
          <div className="p-5 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-indigo-600 text-white text-xs font-black">
                  CÂU {currentIdx + 1} / {questions.length}
                </span>
                {currentQuestion.partLabel && (
                  <span className="text-xs font-bold text-indigo-700">
                    {currentQuestion.partLabel}
                  </span>
                )}
              </div>
              {currentQuestion.difficulty && (
                <span className="text-xs font-semibold text-slate-500">
                  Mức độ: {currentQuestion.difficulty}
                </span>
              )}
            </div>

            {/* Question Stem & Diagram */}
            <div className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
              <QuizRichContentRenderer
                content={currentQuestion.question}
                diagramType={currentQuestion.diagramType}
                diagramData={currentQuestion.diagramData}
                textClassName="text-base sm:text-lg font-bold text-slate-900 leading-relaxed"
              />
            </div>

            {/* Answer Input by Question Part Type */}
            {currentPartType === 'part_2_true_false' ? (
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-600">
                  Chọn Đúng hoặc Sai cho từng mệnh đề sau:
                </div>
                {(currentQuestion.subStatements || []).map((sub, sIdx) => {
                  const subLabel = String(
                    sub.label || sub.key || ['a', 'b', 'c', 'd'][sIdx] || sIdx + 1
                  );
                  const subText = String(sub.statement || sub.text || '');
                  const curObj =
                    typeof currentAnswer === 'object' && currentAnswer !== null
                      ? currentAnswer
                      : {};
                  const pickedVal = curObj[subLabel];

                  return (
                    <div
                      key={subLabel}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-2.5 flex-1 text-sm font-semibold text-slate-900">
                        <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 font-black text-xs flex items-center justify-center shrink-0">
                          {subLabel}
                        </span>
                        <div className="pt-0.5">
                          <MathFormulaRenderer content={subText} />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSelectTrueFalse(currentQuestion, currentIdx, subLabel, true)}
                          className={`px-4 py-2 rounded-xl font-black text-xs border transition-all cursor-pointer ${
                            pickedVal === true
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'
                          }`}
                        >
                          Đúng
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSelectTrueFalse(currentQuestion, currentIdx, subLabel, false)
                          }
                          className={`px-4 py-2 rounded-xl font-black text-xs border transition-all cursor-pointer ${
                            pickedVal === false
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-rose-50'
                          }`}
                        >
                          Sai
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : currentPartType === 'part_3_short_answer' ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="text-xs font-black text-slate-700 block">
                  Nhập đáp số của em:
                </label>
                <input
                  type="text"
                  value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                  onChange={(e) =>
                    handleTextAnswerChange(currentQuestion, currentIdx, e.target.value)
                  }
                  placeholder="Ví dụ: 12 hoặc 2,5"
                  className="w-full sm:max-w-sm px-4 py-3 rounded-xl bg-white border-2 border-slate-300 focus:border-indigo-600 text-base font-mono font-black text-slate-900 outline-none"
                />
              </div>
            ) : currentPartType === 'part_4_essay' ? (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="text-xs font-black text-slate-700 block">
                  Trình bày các bước giải hoặc ghi chú của em:
                </label>
                <textarea
                  rows={5}
                  value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                  onChange={(e) =>
                    handleTextAnswerChange(currentQuestion, currentIdx, e.target.value)
                  }
                  placeholder="Nhập hướng giải hoặc kết quả của em tại đây..."
                  className="w-full p-4 rounded-xl bg-white border border-slate-300 focus:border-indigo-600 text-sm text-slate-900 outline-none resize-y"
                />
              </div>
            ) : (
              /* Part I: 4 Multiple-Choice Options */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {(currentQuestion.options || []).map((opt) => {
                  const isPicked = currentAnswer === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() =>
                        handleSelectChoiceOption(currentQuestion, currentIdx, opt.key)
                      }
                      className={`p-4 rounded-2xl border-2 text-left flex items-start gap-3 transition-all cursor-pointer ${
                        isPicked
                          ? 'bg-indigo-50 border-indigo-600 shadow-sm'
                          : 'bg-slate-50/70 border-slate-200 hover:border-indigo-300 hover:bg-white'
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                          isPicked
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-slate-300 text-slate-800'
                        }`}
                      >
                        {opt.key}
                      </span>
                      <div className="flex-1 text-sm sm:text-base font-semibold text-slate-900 pt-0.5">
                        <MathFormulaRenderer content={opt.text} />
                      </div>
                      {isPicked && <Check className="w-5 h-5 text-indigo-600 shrink-0 mt-1" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Bottom Prev / Next Controls */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleNavigateQuestion(currentIdx - 1)}
                disabled={currentIdx === 0}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Câu Trước</span>
              </button>

              {currentIdx < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => handleNavigateQuestion(currentIdx + 1)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Câu Tiếp Theo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(true)}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Hoàn Thành &amp; Nộp Bài</span>
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-slate-900">Xác Nhận Nộp Bài Tập?</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Em đã trả lời <strong>{answeredCount}/{questions.length}</strong> câu hỏi.
              {answeredCount < questions.length
                ? ` Vẫn còn ${questions.length - answeredCount} câu chưa làm. Em có chắc muốn nộp bài ngay để xem điểm và lời giải chi tiết không?`
                : ' Bấm Xác nhận nộp bài để xem điểm số và lời giải chi tiết ngay lập tức.'}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer"
              >
                Làm Tiếp
              </button>
              <button
                type="button"
                onClick={() => executeFinalSubmit(false)}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer"
              >
                {isSubmitting ? 'Đang Nộp Bài...' : 'Xác Nhận Nộp Bài'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
