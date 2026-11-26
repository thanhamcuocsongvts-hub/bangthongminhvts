import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BookOpen,
  Clock,
  CheckCircle2,
  XCircle,
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
  Compass,
  ListFilter,
  Shuffle,
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
import {
  pickStudentVariantAssignment,
  resolveStudentOnlineExam,
} from '../utils/quizDistribution';
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
  const [submitError, setSubmitError] = useState<string>('');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false);
  const [showOnlyUnanswered, setShowOnlyUnanswered] = useState<boolean>(false);

  // Process telemetry refs
  const questionStatsRef = useRef<Record<string, QuestionProcessStat>>({});
  const activeQuestionStartMsRef = useRef<number>(Date.now());
  const activeFocusIdxRef = useRef<number>(0);
  const sessionStartMsRef = useRef<number>(Date.now());
  const activityLogRef = useRef<HomeworkActivityEvent[]>([]);

  // Result & per-student anti-cheat exam variant state
  const [submission, setSubmission] = useState<HomeworkSubmission | null>(null);
  const [resultFilter, setResultFilter] = useState<'all' | 'correct' | 'wrong'>('all');
  const [assignedVariantCode, setAssignedVariantCode] = useState<string>('');
  const [assignedVariantLabel, setAssignedVariantLabel] = useState<string>('');
  const [assignedShuffleSeed, setAssignedShuffleSeed] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setLoadError('');

    getHomeworkAssignmentById(assignmentId)
      .then((data) => {
        if (!mounted) return;
        if (!data) {
          setLoadError('Không tìm thấy Đề online này. Vui lòng kiểm tra lại đường link từ giáo viên.');
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
                if (parsed.variantCode) setAssignedVariantCode(parsed.variantCode);
                if (parsed.variantLabel) setAssignedVariantLabel(parsed.variantLabel);
                if (typeof parsed.shuffleSeed === 'number') {
                  setAssignedShuffleSeed(parsed.shuffleSeed);
                }
                setPhase('result');
              }
            }
          } catch {}
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('Load online exam error:', err);
        setLoadError('Lỗi tải dữ liệu Đề online. Vui lòng thử tải lại trang.');
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [assignmentId, isTeacherPreview]);

  const resolvedExam = useMemo(() => {
    if (!assignment) return null;
    return resolveStudentOnlineExam(assignment, assignedVariantCode, assignedShuffleSeed);
  }, [assignment, assignedVariantCode, assignedShuffleSeed]);

  const questions: QuizQuestion[] = resolvedExam?.questions || assignment?.questions || [];

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

  const handleActivateQuestion = (targetIdx: number) => {
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    if (targetIdx === activeFocusIdxRef.current) return;
    flushCurrentQuestionDwellTime(activeFocusIdxRef.current);
    activeFocusIdxRef.current = targetIdx;
    setCurrentIdx(targetIdx);
    activeQuestionStartMsRef.current = Date.now();
  };

  const handleNavigateQuestion = (targetIdx: number, prefixId = 'hw-question') => {
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    if (showOnlyUnanswered && prefixId === 'hw-question') {
      setShowOnlyUnanswered(false);
    }
    if (prefixId === 'hw-question') {
      if (targetIdx !== activeFocusIdxRef.current) {
        flushCurrentQuestionDwellTime(activeFocusIdxRef.current);
        activeFocusIdxRef.current = targetIdx;
        setCurrentIdx(targetIdx);
        activeQuestionStartMsRef.current = Date.now();
        appendActivity('view_question', `Di chuyển tới Câu ${targetIdx + 1}`, targetIdx);
      }
    }
    requestAnimationFrame(() => {
      const el = document.getElementById(`${prefixId}-${targetIdx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
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

    const pickedVariant = pickStudentVariantAssignment(assignment, resolvedName);
    setAssignedVariantCode(pickedVariant.variantCode);
    setAssignedVariantLabel(pickedVariant.variantLabel);
    setAssignedShuffleSeed(pickedVariant.shuffleSeed);

    const previewResolved = resolveStudentOnlineExam(
      assignment,
      pickedVariant.variantCode,
      pickedVariant.shuffleSeed
    );

    setStudentName(resolvedName);
    const nowIso = new Date().toISOString();
    setStartedAtIso(nowIso);
    sessionStartMsRef.current = Date.now();
    activeQuestionStartMsRef.current = Date.now();
    activeFocusIdxRef.current = 0;
    setElapsedSeconds(0);
    setCurrentIdx(0);
    setShowOnlyUnanswered(false);
    setAnswersMap({});
    questionStatsRef.current = {};
    activityLogRef.current = [
      {
        timestamp: nowIso,
        elapsedSeconds: 0,
        type: 'start',
        detail: `${resolvedName} bắt đầu làm bài (${previewResolved.questions.length} câu${
          assignment.antiCheatMode && assignment.antiCheatMode !== 'none'
            ? ` · ${pickedVariant.variantLabel}`
            : ''
        })`,
      },
    ];
    setPhase('taking');
  };

  const handleSelectChoiceOption = (q: QuizQuestion, idx: number, optionKey: string) => {
    handleActivateQuestion(idx);
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
    handleActivateQuestion(idx);
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
    handleActivateQuestion(idx);
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
    setSubmitError('');
    setIsSubmitting(true);

    try {
      flushCurrentQuestionDwellTime(activeFocusIdxRef.current);
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
        effectiveQuestions: questions,
        variantCode: resolvedExam?.variantCode || assignedVariantCode,
        variantLabel: resolvedExam?.variantLabel || assignedVariantLabel,
        shuffleSeed: resolvedExam?.shuffleSeed ?? assignedShuffleSeed,
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
      const rawMsg = err instanceof Error ? err.message : String(err || '');
      const lower = rawMsg.toLowerCase();
      if (lower.includes('permission') || lower.includes('insufficient')) {
        setSubmitError(
          'Máy chủ dữ liệu đang cập nhật quyền lưu bài nộp. Vui lòng thử bấm Nộp lại sau vài giây hoặc kiểm tra kết nối mạng.'
        );
      } else if (lower.includes('offline') || lower.includes('network') || lower.includes('failed to fetch')) {
        setSubmitError(
          'Kết nối mạng không ổn định nên chưa gửi được bài lên hệ thống. Bài làm đã được lưu tạm trên máy, em hãy kiểm tra Wi-Fi/4G rồi bấm Thử Gửi Lại.'
        );
      } else {
        setSubmitError(
          'Có sự cố kết nối khi lưu bài nộp lên hệ thống. Bài làm của em vẫn được giữ nguyên, hãy bấm Thử Gửi Lại.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewLocalReceiptFallback = () => {
    if (!assignment) return;
    try {
      const savedReceipt = localStorage.getItem(`smartboard_hw_receipt_${assignment.id}`);
      if (savedReceipt) {
        const parsed = JSON.parse(savedReceipt) as HomeworkSubmission;
        if (parsed && parsed.assignmentId === assignment.id) {
          setSubmitError('');
          setSubmission(parsed);
          setPhase('result');
        }
      }
    } catch {}
  };

  const handleRetry = () => {
    if (!assignment?.allowRetake) return;
    setSubmission(null);
    setPhase('intro');
    setAnswersMap({});
    activeFocusIdxRef.current = 0;
    setCurrentIdx(0);
    setShowOnlyUnanswered(false);
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
        <div className="text-sm font-bold text-slate-700">Đang tải Đề online...</div>
      </div>
    );
  }

  if (loadError || !assignment) {
    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center p-4">
        <div className="max-w-md w-full p-6 rounded-3xl bg-white border border-slate-200 shadow-sm text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h2 className="text-lg font-black text-slate-900">Không Thể Mở Đề Online</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {loadError || 'Đề online không tồn tại hoặc đã bị xóa.'}
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
                  ? `ĐỀ ONLINE LỚP ${assignment.className}`
                  : 'ĐỀ ONLINE'}
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
              <span>Bắt Đầu Làm Đề Online</span>
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
        {/* Full-Width Top Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3">
          <div className="w-full flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-500 truncate flex items-center gap-1.5 flex-wrap">
                <span>
                  {submission.studentName}
                  {submission.studentClassName ? ` · Lớp ${submission.studentClassName}` : ''}
                </span>
                {submission.variantLabel && submission.variantCode !== 'GỐC' && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-mono text-[10px] font-black">
                    {submission.variantLabel}
                  </span>
                )}
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

        <main className="w-full px-4 sm:px-6 lg:px-8 py-5 lg:py-6 flex flex-col lg:flex-row gap-6 items-start">
          {/* Sticky Summary & Result Quick-Jump Sidebar (Desktop Right / Mobile Top) */}
          <aside className="w-full lg:w-80 xl:w-96 lg:order-2 lg:sticky lg:top-[76px] shrink-0 space-y-4">
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="p-5 rounded-2xl bg-slate-900 text-white text-center space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[11px] font-black">
                  <Award className="w-3.5 h-3.5" />
                  <span>ĐÃ HOÀN THÀNH</span>
                </div>
                <div className="text-4xl font-black text-emerald-400 tabular-nums pt-1">
                  {submission.totalScore.toFixed(1)}
                  <span className="text-lg text-slate-400 font-bold"> / 10</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Thời gian: {formatSecondsClock(submission.totalTimeSeconds)} · Lần {submission.attemptNumber}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[10px] font-bold text-emerald-800">ĐÚNG</div>
                  <div className="text-xl font-black text-emerald-700 tabular-nums">
                    {submission.correctCount}
                  </div>
                </div>
                <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200">
                  <div className="text-[10px] font-bold text-rose-800">SAI</div>
                  <div className="text-xl font-black text-rose-700 tabular-nums">
                    {submission.wrongCount}
                  </div>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-600">TỔNG CÂU</div>
                  <div className="text-xl font-black text-slate-900 tabular-nums">
                    {submission.totalQuestions}
                  </div>
                </div>
              </div>

              {/* Result Quick Jump Grid */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="text-xs font-black text-slate-700 flex items-center justify-between">
                  <span>Di chuyển nhanh tới câu</span>
                  <span className="text-[11px] font-semibold text-slate-500">{details.length} câu</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {details.map((det) => (
                    <button
                      key={det.questionId || det.questionIndex}
                      type="button"
                      onClick={() => {
                        setResultFilter('all');
                        handleNavigateQuestion(det.questionIndex, 'hw-result-question');
                      }}
                      className={`h-9 rounded-xl font-black text-xs border tabular-nums transition-all cursor-pointer ${
                        det.partType === 'part_4_essay'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                          : det.isCorrect
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                          : det.isPartiallyCorrect
                          ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                          : 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100'
                      }`}
                    >
                      {det.questionIndex + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Main Detailed Result Column */}
          <div className="flex-1 min-w-0 w-full lg:order-1 space-y-4">
            {/* Filter Header */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-xs flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  <span>Chi Tiết Bài Làm &amp; Lời Giải Chi Tiết</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Học sinh: <strong className="text-slate-700">{submission.studentName}</strong>
                </p>
              </div>

              <div className="inline-flex bg-slate-100 p-1 rounded-2xl border border-slate-200 gap-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setResultFilter('all')}
                  className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
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
                  className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
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
                  className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
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
                    id={`hw-result-question-${det.questionIndex}`}
                    key={det.questionId || det.questionIndex}
                    className={`scroll-mt-24 p-5 sm:p-6 rounded-3xl bg-white border-2 shadow-xs space-y-4 ${
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
                          <div className="font-black text-slate-900">
                            <MathFormulaRenderer content={det.selectedDisplay} />
                          </div>
                        </div>
                        {assignment.showAnswersAfterSubmit && (
                          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                            <span className="font-bold text-emerald-800 block mb-1">Đáp án chuẩn:</span>
                            <div className="font-black text-emerald-900">
                              <MathFormulaRenderer content={det.correctDisplay} />
                            </div>
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
          </div>
        </main>
      </div>
    );
  }

  /* PHASE 2: STUDENT TAKING HOMEWORK (FULL-SCREEN FULL-EXAM SHEET + STICKY QUICK NAVIGATOR) */
  const timeRemaining =
    assignment.durationMinutes > 0
      ? Math.max(0, assignment.durationMinutes * 60 - elapsedSeconds)
      : null;

  const progressPercent =
    questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  const firstUnansweredIdx = questions.findIndex((q, idx) => !isQuestionAnswered(q, idx));
  const nextUnansweredAfterCurrent = questions.findIndex(
    (q, idx) => idx > currentIdx && !isQuestionAnswered(q, idx)
  );
  const jumpToUnansweredIdx =
    nextUnansweredAfterCurrent !== -1 ? nextUnansweredAfterCurrent : firstUnansweredIdx;

  const getPartBannerTitle = (partType: string, rawPartLabel?: string) => {
    if (rawPartLabel && rawPartLabel.trim().length > 0) return rawPartLabel.trim();
    if (partType === 'part_2_true_false') return 'PHẦN II. CÂU TRẮC NGHIỆM ĐÚNG SAI';
    if (partType === 'part_3_short_answer') return 'PHẦN III. CÂU TRẮC NGHIỆM TRẢ LỜI NGẮN';
    if (partType === 'part_4_essay') return 'PHẦN IV. TỰ LUẬN';
    return 'PHẦN I. CÂU TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN';
  };

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] flex flex-col text-slate-900">
      {/* Full-Width Sticky Exam Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3">
        <div className="w-full flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <div className="hidden sm:flex w-10 h-10 rounded-2xl bg-slate-900 text-white items-center justify-center shrink-0 font-black text-sm">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-slate-500 truncate flex items-center gap-1.5 flex-wrap">
                <span>
                  {studentName}
                  {studentClassName ? ` · Lớp ${studentClassName}` : ''}
                  {assignment.subject ? ` · ${assignment.subject}` : ''}
                  {assignment.grade ? ` (${assignment.grade})` : ''}
                </span>
                {assignment.antiCheatMode &&
                  assignment.antiCheatMode !== 'none' &&
                  resolvedExam?.variantLabel && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-mono text-[10px] font-black">
                      <Shuffle className="w-3 h-3" />
                      {resolvedExam.variantLabel}
                    </span>
                  )}
              </div>
              <h1 className="text-sm sm:text-base font-black text-slate-900 truncate">
                {assignment.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-black tabular-nums whitespace-nowrap">
              <span>Đã làm:</span>
              <span className="text-indigo-700">
                {answeredCount}/{questions.length}
              </span>
            </div>

            <div
              className={`px-3 py-1.5 rounded-xl font-mono font-black text-xs sm:text-sm flex items-center gap-1.5 border tabular-nums whitespace-nowrap ${
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

            {onExit && isTeacherPreview && (
              <button
                type="button"
                onClick={onExit}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer whitespace-nowrap"
              >
                Thoát Xem Thử
              </button>
            )}

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

      {/* Mobile / Tablet Quick-Jump Sticky Strip */}
      <div className="lg:hidden sticky top-[61px] z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 py-2.5 flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] font-black text-slate-500 whitespace-nowrap shrink-0">
          Câu hỏi ({answeredCount}/{questions.length}):
        </span>
        {questions.map((q, idx) => {
          const isCurrent = idx === currentIdx;
          const isDone = isQuestionAnswered(q, idx);
          return (
            <button
              key={q.id || idx}
              type="button"
              onClick={() => handleNavigateQuestion(idx)}
              className={`w-8 h-8 rounded-xl font-black text-xs shrink-0 transition-all cursor-pointer tabular-nums border ${
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

      {/* Inline Submission Retry Banner (replaces blocking browser alert) */}
      {submitError && (
        <div className="w-full px-4 sm:px-6 lg:px-8 pt-3">
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-black text-rose-900">Chưa thể gửi bài lên máy chủ</div>
                <div className="text-rose-800 leading-relaxed">{submitError}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => executeFinalSubmit(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {isSubmitting ? 'Đang Gửi Lại...' : 'Thử Gửi Lại Ngay'}
              </button>
              <button
                type="button"
                onClick={handleViewLocalReceiptFallback}
                className="px-3.5 py-2 rounded-xl bg-white hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs cursor-pointer whitespace-nowrap"
              >
                Xem Điểm Tạm Trên Máy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-Width 2-Zone Academic Exam Workspace */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 lg:py-6 flex flex-col lg:flex-row gap-6 items-start pb-20">
        {/* Main Full-Exam Sheet (ALL Questions Displayed Sequentially) */}
        <div className="flex-1 min-w-0 w-full space-y-5">
          {showOnlyUnanswered && answeredCount === questions.length && (
            <div className="p-8 rounded-3xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <div className="text-base font-black text-emerald-950">
                Em đã trả lời tất cả {questions.length} câu hỏi!
              </div>
              <div className="flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowOnlyUnanswered(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-bold text-xs cursor-pointer"
                >
                  Xem Lại Toàn Bộ Đề
                </button>
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(true)}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer"
                >
                  Nộp Bài Ngay
                </button>
              </div>
            </div>
          )}

          {(() => {
            let lastPartBanner = '';
            return questions.map((q, idx) => {
              const partType = detectQuestionPartType(q);
              const qId = q.id || `q_${idx + 1}`;
              const ans = answersMap[qId];
              const isDone = isQuestionAnswered(q, idx);
              const isCurrent = idx === currentIdx;

              if (showOnlyUnanswered && isDone) {
                return null;
              }

              const bannerTitle = getPartBannerTitle(partType, q.partLabel);
              const shouldRenderPartHeader = bannerTitle !== lastPartBanner;
              lastPartBanner = bannerTitle;

              // Check if Part I options are concise enough for 4-column wide desktop layout
              const isCompactChoiceOptions =
                partType === 'part_1_choice' &&
                (q.options || []).length > 0 &&
                (q.options || []).every(
                  (opt) =>
                    String(opt.text || '').trim().length <= 26 &&
                    !String(opt.text || '').includes('\n') &&
                    !String(opt.text || '').includes('\\frac')
                );

              return (
                <React.Fragment key={qId}>
                  {shouldRenderPartHeader && (
                    <div className="px-5 py-3.5 rounded-2xl bg-slate-900 text-white flex items-center justify-between gap-3">
                      <div className="text-xs sm:text-sm font-black uppercase tracking-wide">
                        {bannerTitle}
                      </div>
                      <span className="text-[11px] font-semibold text-slate-300 whitespace-nowrap shrink-0">
                        {partType === 'part_2_true_false'
                          ? 'Chọn Đúng/Sai từng ý'
                          : partType === 'part_3_short_answer'
                          ? 'Điền kết quả số'
                          : partType === 'part_4_essay'
                          ? 'Trình bày tự luận'
                          : 'Chọn 1 đáp án đúng'}
                      </span>
                    </div>
                  )}

                  <section
                    id={`hw-question-${idx}`}
                    onMouseDown={() => handleActivateQuestion(idx)}
                    onFocusCapture={() => handleActivateQuestion(idx)}
                    className={`scroll-mt-24 p-5 sm:p-7 rounded-3xl bg-white border-2 transition-colors shadow-xs space-y-5 ${
                      isCurrent
                        ? 'border-indigo-500 ring-2 ring-indigo-500/10'
                        : isDone
                        ? 'border-emerald-200 hover:border-emerald-300'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Question Header Row */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-3 py-1 rounded-xl text-xs font-black tabular-nums ${
                            isCurrent
                              ? 'bg-indigo-600 text-white'
                              : isDone
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-900 text-white'
                          }`}
                        >
                          CÂU {idx + 1}
                        </span>
                        {q.partLabel && (
                          <span className="text-xs font-bold text-indigo-700">{q.partLabel}</span>
                        )}
                        {isDone && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black">
                            <Check className="w-3 h-3" />
                            <span>
                              {partType === 'part_1_choice' && typeof ans === 'string'
                                ? `Đã chọn ${ans}`
                                : 'Đã trả lời'}
                            </span>
                          </span>
                        )}
                      </div>

                      {q.difficulty && (
                        <span className="text-xs font-semibold text-slate-500">
                          Mức độ: {q.difficulty}
                        </span>
                      )}
                    </div>

                    {/* Question Stem & Diagram */}
                    <div className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
                      <QuizRichContentRenderer
                        content={q.question}
                        diagramType={q.diagramType}
                        diagramData={q.diagramData}
                        textClassName="text-base sm:text-lg font-bold text-slate-900 leading-relaxed"
                      />
                    </div>

                    {/* Answer Input by Question Part Type */}
                    {partType === 'part_2_true_false' ? (
                      <div className="space-y-2.5">
                        <div className="text-xs font-bold text-slate-600">
                          Chọn Đúng hoặc Sai cho từng mệnh đề sau:
                        </div>
                        {(q.subStatements || []).map((sub, sIdx) => {
                          const subLabel = String(
                            sub.label || sub.key || ['a', 'b', 'c', 'd'][sIdx] || sIdx + 1
                          );
                          const subText = String(sub.statement || sub.text || '');
                          const curObj =
                            typeof ans === 'object' && ans !== null ? ans : {};
                          const pickedVal = curObj[subLabel];

                          return (
                            <div
                              key={subLabel}
                              className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="flex items-start gap-2.5 flex-1 text-sm sm:text-base font-semibold text-slate-900">
                                <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 font-black text-xs flex items-center justify-center shrink-0">
                                  {subLabel}
                                </span>
                                <div className="pt-0.5 min-w-0">
                                  <MathFormulaRenderer content={subText} />
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleSelectTrueFalse(q, idx, subLabel, true)}
                                  className={`px-4 py-2 rounded-xl font-black text-xs border transition-all cursor-pointer whitespace-nowrap ${
                                    pickedVal === true
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                      : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'
                                  }`}
                                >
                                  Đúng
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSelectTrueFalse(q, idx, subLabel, false)}
                                  className={`px-4 py-2 rounded-xl font-black text-xs border transition-all cursor-pointer whitespace-nowrap ${
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
                    ) : partType === 'part_3_short_answer' ? (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                        <label className="text-xs font-black text-slate-700 block">
                          Nhập đáp số của em:
                        </label>
                        <input
                          type="text"
                          value={typeof ans === 'string' ? ans : ''}
                          onChange={(e) => handleTextAnswerChange(q, idx, e.target.value)}
                          placeholder="Ví dụ: 12 hoặc 2,5 hoặc -0,87"
                          className="w-full sm:max-w-sm px-4 py-3 rounded-xl bg-white border-2 border-slate-300 focus:border-indigo-600 text-base font-mono font-black text-slate-900 outline-none"
                        />
                        <p className="text-[11px] font-medium text-slate-500 leading-snug">
                          Chỉ nhập số nguyên hoặc số thập phân (dùng dấu phẩy hoặc dấu chấm). Nếu đề yêu cầu làm tròn (hàng phần mười / phần trăm), hãy ghi đúng số chữ số thập phân đó.
                        </p>
                      </div>
                    ) : partType === 'part_4_essay' ? (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                        <label className="text-xs font-black text-slate-700 block">
                          Trình bày các bước giải hoặc ghi chú của em:
                        </label>
                        <textarea
                          rows={4}
                          value={typeof ans === 'string' ? ans : ''}
                          onChange={(e) => handleTextAnswerChange(q, idx, e.target.value)}
                          placeholder="Nhập hướng giải hoặc kết quả của em tại đây..."
                          className="w-full p-4 rounded-xl bg-white border border-slate-300 focus:border-indigo-600 text-sm text-slate-900 outline-none resize-y"
                        />
                      </div>
                    ) : (
                      /* Part I: 4 Multiple-Choice Options */
                      <div
                        className={`grid gap-3 ${
                          isCompactChoiceOptions
                            ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
                            : 'grid-cols-1 md:grid-cols-2'
                        }`}
                      >
                        {(q.options || []).map((opt) => {
                          const isPicked = ans === opt.key;
                          return (
                            <button
                              key={opt.key}
                              type="button"
                              onClick={() => handleSelectChoiceOption(q, idx, opt.key)}
                              className={`p-3.5 sm:p-4 rounded-2xl border-2 text-left flex items-start gap-3 transition-all cursor-pointer ${
                                isPicked
                                  ? 'bg-indigo-50 border-indigo-600 shadow-xs'
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
                              <div className="flex-1 min-w-0 text-sm sm:text-base font-semibold text-slate-900 pt-0.5">
                                <MathFormulaRenderer content={opt.text} />
                              </div>
                              {isPicked && <Check className="w-5 h-5 text-indigo-600 shrink-0 mt-1" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </React.Fragment>
              );
            });
          })()}

          {/* Bottom End-of-Exam Submit Banner */}
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm sm:text-base font-black text-slate-900">
                Đã hoàn thành {answeredCount}/{questions.length} câu hỏi
              </div>
              <p className="text-xs text-slate-500">
                {answeredCount < questions.length
                  ? `Còn ${questions.length - answeredCount} câu chưa trả lời. Em có thể bấm vào số câu ở bảng bên phải để rà soát nhanh trước khi nộp bài.`
                  : 'Em đã trả lời hết tất cả câu hỏi. Hãy kiểm tra lại một lượt và bấm Nộp Bài để xem điểm và lời giải chi tiết.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSubmitConfirm(true)}
              disabled={isSubmitting}
              className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang Nộp Bài...' : 'Hoàn Thành & Nộp Bài'}</span>
            </button>
          </div>
        </div>

        {/* Sticky Desktop Quick-Navigation & Digital Answer Sheet Sidebar */}
        <aside className="hidden lg:flex flex-col w-80 xl:w-96 sticky top-[76px] shrink-0 bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4 max-h-[calc(100vh-96px)] overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-indigo-600" />
              <span>Bảng Câu Hỏi ({questions.length} câu)</span>
            </h2>
            <span className="text-xs font-black text-indigo-700 tabular-nums">
              {progressPercent}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 tabular-nums">
              <span>Đã làm: {answeredCount} câu</span>
              <span>Còn lại: {questions.length - answeredCount} câu</span>
            </div>
          </div>

          {/* Quick Helpers: Filter Unanswered + Jump Next Unanswered */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowOnlyUnanswered((v) => !v)}
              className={`flex-1 px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                showOnlyUnanswered
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>{showOnlyUnanswered ? 'Hiện tất cả câu' : 'Lọc câu chưa làm'}</span>
            </button>
            {jumpToUnansweredIdx !== -1 && (
              <button
                type="button"
                onClick={() => handleNavigateQuestion(jumpToUnansweredIdx)}
                className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-black cursor-pointer whitespace-nowrap"
              >
                Câu {jumpToUnansweredIdx + 1} chưa làm
              </button>
            )}
          </div>

          {/* Numbered Grid (Digital Answer Sheet) */}
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIdx;
              const isDone = isQuestionAnswered(q, idx);
              const qId = q.id || `q_${idx + 1}`;
              const ans = answersMap[qId];
              const partType = detectQuestionPartType(q);
              const shortTag =
                partType === 'part_1_choice' && typeof ans === 'string' && ans.trim()
                  ? ans.trim()
                  : null;

              return (
                <button
                  key={qId}
                  type="button"
                  onClick={() => handleNavigateQuestion(idx)}
                  className={`h-11 rounded-xl font-black text-xs flex flex-col items-center justify-center leading-none transition-all cursor-pointer tabular-nums border ${
                    isCurrent
                      ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-indigo-500/40'
                      : isDone
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>{idx + 1}</span>
                  {shortTag ? (
                    <span
                      className={`text-[9px] font-extrabold mt-0.5 ${
                        isCurrent ? 'text-emerald-300' : 'text-emerald-700'
                      }`}
                    >
                      {shortTag}
                    </span>
                  ) : isDone ? (
                    <span
                      className={`text-[9px] font-bold mt-0.5 ${
                        isCurrent ? 'text-emerald-300' : 'text-emerald-600'
                      }`}
                    >
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 pt-1 border-t border-slate-100">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-900 inline-block" />
              <span>Đang xem</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400 inline-block" />
              <span>Đã làm</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-200 inline-block" />
              <span>Chưa làm</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowSubmitConfirm(true)}
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Đang Nộp Bài...' : 'Hoàn Thành & Nộp Bài'}</span>
          </button>
        </aside>
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
