import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { isQuotaError, markFirestoreQuotaExhausted } from './firebaseSafe';
import {
  ClassRoom,
  HomeworkActivityEvent,
  HomeworkAssignMode,
  HomeworkAssignment,
  HomeworkQuestionDetail,
  HomeworkRosterStudent,
  HomeworkSubmission,
  HomeworkSubStatementResult,
  QuizQuestion,
} from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider: any) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;
export async function testFirestoreConnection(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration: client is offline.');
    }
  }
}

export async function ensureHomeworkAuth(): Promise<string> {
  if (auth?.currentUser?.uid) {
    return auth.currentUser.uid;
  }
  if (auth) {
    try {
      const cred = await signInAnonymously(auth);
      if (cred?.user?.uid) return cred.user.uid;
    } catch {
      // Anonymous auth might be disabled in project settings; return deterministic device ID
    }
  }
  try {
    const key = 'smartboard_student_device_uid';
    let deviceId = localStorage.getItem(key);
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).slice(2, 12);
      localStorage.setItem(key, deviceId);
    }
    return deviceId;
  } catch {
    return 'dev_' + Date.now();
  }
}

/**
 * Recursively removes undefined values and NaN so Firestore setDoc/updateDoc never fail.
 */
export function sanitizeForFirestore<T>(input: T): T {
  if (input === null || input === undefined) {
    return null as any;
  }
  if (typeof input === 'number') {
    return (Number.isFinite(input) ? input : 0) as any;
  }
  if (typeof input === 'string' || typeof input === 'boolean') {
    return input;
  }
  if (Array.isArray(input)) {
    return input
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  if (typeof input === 'object') {
    const result: Record<string, any> = {};
    Object.entries(input as Record<string, any>).forEach(([k, v]) => {
      if (v === undefined || typeof v === 'function') return;
      result[k] = sanitizeForFirestore(v);
    });
    return result as T;
  }
  return input;
}

const LOCAL_ASSIGNMENTS_KEY = 'smartboard_homework_assignments_v1';
const LOCAL_SUBMISSIONS_PREFIX = 'smartboard_homework_submissions_v1_';

function readLocalAssignments(): HomeworkAssignment[] {
  try {
    const raw = localStorage.getItem(LOCAL_ASSIGNMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalAssignments(items: HomeworkAssignment[]): void {
  try {
    localStorage.setItem(LOCAL_ASSIGNMENTS_KEY, JSON.stringify(items.slice(0, 60)));
    window.dispatchEvent(new CustomEvent('homework-assignments-updated', { detail: items }));
  } catch {}
}

function readLocalSubmissions(assignmentId: string): HomeworkSubmission[] {
  try {
    const raw = localStorage.getItem(LOCAL_SUBMISSIONS_PREFIX + assignmentId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalSubmissions(assignmentId: string, subs: HomeworkSubmission[]): void {
  try {
    localStorage.setItem(LOCAL_SUBMISSIONS_PREFIX + assignmentId, JSON.stringify(subs.slice(0, 200)));
  } catch {}
}

export function getHomeworkShareUrl(assignmentId: string): string {
  if (typeof window === 'undefined') return `/?homework=${assignmentId}`;
  return `${window.location.origin}/?homework=${encodeURIComponent(assignmentId)}`;
}

function normalizeQuizQuestionsForHomework(questions: QuizQuestion[]): QuizQuestion[] {
  return (questions || []).slice(0, 100).map((q, idx) =>
    sanitizeForFirestore({
      id: q.id || `hw_q_${idx + 1}`,
      question: String(q.question || '').slice(0, 4000),
      options: Array.isArray(q.options)
        ? q.options.map((opt) => ({
            key: String(opt.key || ''),
            text: String(opt.text || ''),
          }))
        : [],
      correctAnswer: String(q.correctAnswer || ''),
      explanation: String(q.explanation || ''),
      timeLimit: Number(q.timeLimit || 30),
      subject: q.subject || 'Toán học',
      difficulty: q.difficulty || 'Thông hiểu',
      ...(q.diagramType ? { diagramType: q.diagramType } : {}),
      ...(q.diagramData ? { diagramData: q.diagramData } : {}),
      ...(q.partType ? { partType: q.partType } : {}),
      ...(q.partLabel ? { partLabel: q.partLabel } : {}),
      ...(Array.isArray(q.subStatements) ? { subStatements: q.subStatements } : {}),
      ...(q.shortAnswerKey ? { shortAnswerKey: String(q.shortAnswerKey) } : {}),
      ...(q.essayRubric ? { essayRubric: String(q.essayRubric) } : {}),
      ...(typeof q.maxScore === 'number' ? { maxScore: q.maxScore } : {}),
    })
  );
}

export interface CreateHomeworkParams {
  title: string;
  subject: string;
  grade: string;
  teacherId: string;
  teacherName: string;
  mode: HomeworkAssignMode;
  classroom?: ClassRoom | null;
  questions: QuizQuestion[];
  durationMinutes: number;
  allowRetake: boolean;
  showAnswersAfterSubmit: boolean;
  dueDate?: string;
  note?: string;
}

export async function createHomeworkAssignment(
  params: CreateHomeworkParams
): Promise<HomeworkAssignment> {
  await ensureHomeworkAuth();
  testFirestoreConnection().catch(() => {});

  const now = new Date().toISOString();
  const id = `hw_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const code = `BT${Math.floor(1000 + Math.random() * 9000)}`;

  const classRoster: HomeworkRosterStudent[] =
    params.mode === 'class' && params.classroom?.students
      ? params.classroom.students.slice(0, 120).map((s: any, idx: number) => ({
          id: String(s.id || s.code || `st_${idx + 1}`),
          name: String(s.name || s.studentName || `Học sinh ${idx + 1}`).slice(0, 120),
          code: String(s.code || s.studentCode || ''),
        }))
      : [];

  const assignment: HomeworkAssignment = sanitizeForFirestore({
    id,
    code,
    title: params.title.trim().slice(0, 300) || 'Bài tập về nhà',
    subject: (params.subject || 'Toán học').slice(0, 80),
    grade: (params.grade || 'Lớp 12').slice(0, 80),
    teacherId: (params.teacherId || 'teacher_default').slice(0, 128),
    teacherName: (params.teacherName || 'Giáo viên').slice(0, 150),
    mode: params.mode,
    classId: params.mode === 'class' && params.classroom ? String(params.classroom.id) : '',
    className: params.mode === 'class' && params.classroom ? String(params.classroom.name) : '',
    classRoster,
    questions: normalizeQuizQuestionsForHomework(params.questions),
    durationMinutes: Math.max(0, Math.min(300, Number(params.durationMinutes || 0))),
    allowRetake: Boolean(params.allowRetake),
    showAnswersAfterSubmit: Boolean(params.showAnswersAfterSubmit),
    dueDate: params.dueDate ? String(params.dueDate).slice(0, 64) : '',
    note: params.note ? params.note.trim().slice(0, 600) : '',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  // Update local cache immediately
  const existing = readLocalAssignments().filter((a) => a.id !== assignment.id);
  writeLocalAssignments([assignment, ...existing]);

  const path = `homework_assignments/${assignment.id}`;
  try {
    await setDoc(doc(db, 'homework_assignments', assignment.id), assignment);
  } catch (err) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted();
    } else {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }

  return assignment;
}

export async function getHomeworkAssignmentById(
  assignmentId: string
): Promise<HomeworkAssignment | null> {
  if (!assignmentId) return null;
  await ensureHomeworkAuth();
  testFirestoreConnection().catch(() => {});

  const path = `homework_assignments/${assignmentId}`;
  try {
    const snap = await getDoc(doc(db, 'homework_assignments', assignmentId));
    if (snap.exists()) {
      const data = snap.data() as HomeworkAssignment;
      const local = readLocalAssignments().filter((a) => a.id !== data.id);
      writeLocalAssignments([data, ...local]);
      return data;
    }
  } catch (err) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted();
    } else {
      const cached = readLocalAssignments().find((a) => a.id === assignmentId);
      if (cached) return cached;
      handleFirestoreError(err, OperationType.GET, path);
    }
  }

  return readLocalAssignments().find((a) => a.id === assignmentId) || null;
}

export function subscribeHomeworkAssignments(
  teacherId: string | undefined,
  callback: (assignments: HomeworkAssignment[]) => void
): () => void {
  // Emit local cached assignments right away
  const localInitial = readLocalAssignments();
  if (localInitial.length > 0) {
    callback(
      localInitial
        .filter((a) => !teacherId || a.teacherId === teacherId)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    );
  }

  let active = true;
  let unsub: (() => void) | null = null;

  ensureHomeworkAuth()
    .then(() => {
      if (!active) return;
      unsub = onSnapshot(
        collection(db, 'homework_assignments'),
        (snap) => {
          const all: HomeworkAssignment[] = [];
          snap.forEach((d) => {
            const data = d.data() as HomeworkAssignment;
            if (data && data.id) all.push(data);
          });
          all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          writeLocalAssignments(all);
          const filtered = teacherId
            ? all.filter((a) => a.teacherId === teacherId || !a.teacherId)
            : all;
          callback(filtered);
        },
        (err) => {
          if (isQuotaError(err)) {
            markFirestoreQuotaExhausted();
          } else {
            console.warn('[homeworkService] subscribeHomeworkAssignments warning:', err?.message || err);
          }
        }
      );
    })
    .catch(() => {});

  const handleLocalEvt = () => {
    const items = readLocalAssignments();
    const filtered = teacherId
      ? items.filter((a) => a.teacherId === teacherId || !a.teacherId)
      : items;
    callback(filtered.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
  };
  window.addEventListener('homework-assignments-updated', handleLocalEvt);

  return () => {
    active = false;
    if (unsub) unsub();
    window.removeEventListener('homework-assignments-updated', handleLocalEvt);
  };
}

export async function updateHomeworkAssignmentStatus(
  assignmentId: string,
  status: 'active' | 'closed'
): Promise<void> {
  await ensureHomeworkAuth();
  const now = new Date().toISOString();
  const updatedLocal = readLocalAssignments().map((a) =>
    a.id === assignmentId ? { ...a, status, updatedAt: now } : a
  );
  writeLocalAssignments(updatedLocal);

  const path = `homework_assignments/${assignmentId}`;
  try {
    await updateDoc(doc(db, 'homework_assignments', assignmentId), {
      status,
      updatedAt: now,
    });
  } catch (err) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted();
    } else {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }
}

export async function deleteHomeworkAssignment(assignmentId: string): Promise<void> {
  await ensureHomeworkAuth();
  const updatedLocal = readLocalAssignments().filter((a) => a.id !== assignmentId);
  writeLocalAssignments(updatedLocal);

  const path = `homework_assignments/${assignmentId}`;
  try {
    await deleteDoc(doc(db, 'homework_assignments', assignmentId));
  } catch (err) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted();
    } else {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
}

function normalizeShortText(val: string): string {
  return String(val || '')
    .trim()
    .toLowerCase()
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ');
}

function isShortAnswerEqual(studentVal: string, expectedVal: string): boolean {
  const s = normalizeShortText(studentVal);
  const e = normalizeShortText(expectedVal);
  if (!s || !e) return false;
  if (s === e) return true;
  const sNum = Number(s);
  const eNum = Number(e);
  if (Number.isFinite(sNum) && Number.isFinite(eNum)) {
    return Math.abs(sNum - eNum) < 1e-4;
  }
  return false;
}

export function detectQuestionPartType(
  q: QuizQuestion
): 'part_1_choice' | 'part_2_true_false' | 'part_3_short_answer' | 'part_4_essay' {
  if (q.partType) return q.partType;
  if (Array.isArray(q.subStatements) && q.subStatements.length > 0) return 'part_2_true_false';
  if (q.shortAnswerKey) return 'part_3_short_answer';
  if (q.essayRubric) return 'part_4_essay';
  return 'part_1_choice';
}

export interface QuestionProcessStat {
  timeSpentSeconds: number;
  changeCount: number;
  answeredAt?: string;
}

export function gradeHomeworkSubmission(
  questions: QuizQuestion[],
  answersMap: Record<string, any>,
  processStats: Record<string, QuestionProcessStat>
): {
  questionDetails: HomeworkQuestionDetail[];
  totalScore: number;
  correctCount: number;
  wrongCount: number;
} {
  let totalRawWeightEarned = 0;
  let totalAutoGradableQuestions = 0;
  let correctCount = 0;
  let wrongCount = 0;

  const questionDetails: HomeworkQuestionDetail[] = questions.map((q, idx) => {
    const qId = q.id || `q_${idx + 1}`;
    const partType = detectQuestionPartType(q);
    const stat = processStats[qId] || { timeSpentSeconds: 0, changeCount: 0 };
    const ans = answersMap[qId];

    if (partType === 'part_2_true_false') {
      totalAutoGradableQuestions += 1;
      const subs = q.subStatements || [];
      const studentObj = typeof ans === 'object' && ans !== null ? ans : {};
      let correctSubCount = 0;
      const subResults: HomeworkSubStatementResult[] = subs.map((sub, sIdx) => {
        const label = String(sub.label || sub.key || ['a', 'b', 'c', 'd'][sIdx] || sIdx + 1);
        const text = String(sub.statement || sub.text || '');
        const expected = typeof sub.correct === 'boolean' ? sub.correct : Boolean(sub.isCorrect);
        const rawChoice = studentObj[label] ?? studentObj[String(sIdx)];
        const studentChoice = typeof rawChoice === 'boolean' ? rawChoice : null;
        const matched = studentChoice !== null && studentChoice === expected;
        if (matched) correctSubCount += 1;
        return {
          label,
          text,
          studentChoice,
          correctChoice: expected,
          isCorrect: matched,
        };
      });

      // BGD 2025 partial scoring ratio per 1.0 question weight
      let weightEarned = 0;
      if (subs.length === 4) {
        if (correctSubCount === 1) weightEarned = 0.1;
        else if (correctSubCount === 2) weightEarned = 0.25;
        else if (correctSubCount === 3) weightEarned = 0.5;
        else if (correctSubCount === 4) weightEarned = 1.0;
      } else if (subs.length > 0) {
        weightEarned = correctSubCount / subs.length;
      }

      const isFullCorrect = subs.length > 0 && correctSubCount === subs.length;
      const isPartial = correctSubCount > 0 && !isFullCorrect;
      if (isFullCorrect) correctCount += 1;
      else wrongCount += 1;
      totalRawWeightEarned += weightEarned;

      const selectedDisplay =
        subResults
          .map((sr) => `${sr.label}) ${sr.studentChoice === null ? '—' : sr.studentChoice ? 'Đúng' : 'Sai'}`)
          .join(' | ') || 'Chưa trả lời';
      const correctDisplay =
        subResults.map((sr) => `${sr.label}) ${sr.correctChoice ? 'Đúng' : 'Sai'}`).join(' | ') || '';

      return sanitizeForFirestore({
        questionId: qId,
        questionIndex: idx,
        partType,
        isCorrect: isFullCorrect,
        isPartiallyCorrect: isPartial,
        scoreEarned: Number(weightEarned.toFixed(2)),
        maxScore: 1,
        selectedDisplay,
        correctDisplay,
        subResults,
        timeSpentSeconds: Math.max(0, Math.round(stat.timeSpentSeconds || 0)),
        changeCount: Math.max(0, Math.round(stat.changeCount || 0)),
        answeredAt: stat.answeredAt || '',
      });
    }

    if (partType === 'part_3_short_answer') {
      totalAutoGradableQuestions += 1;
      const studentText = typeof ans === 'string' ? ans.trim() : '';
      const expectedKey = String(q.shortAnswerKey || q.correctAnswer || '').trim();
      const matched = isShortAnswerEqual(studentText, expectedKey);
      if (matched) correctCount += 1;
      else wrongCount += 1;
      if (matched) totalRawWeightEarned += 1;

      return sanitizeForFirestore({
        questionId: qId,
        questionIndex: idx,
        partType,
        isCorrect: matched,
        isPartiallyCorrect: false,
        scoreEarned: matched ? 1 : 0,
        maxScore: 1,
        selectedDisplay: studentText || 'Chưa trả lời',
        correctDisplay: expectedKey || '—',
        timeSpentSeconds: Math.max(0, Math.round(stat.timeSpentSeconds || 0)),
        changeCount: Math.max(0, Math.round(stat.changeCount || 0)),
        answeredAt: stat.answeredAt || '',
      });
    }

    if (partType === 'part_4_essay') {
      const studentText = typeof ans === 'string' ? ans.trim() : '';
      // Essay question is not penalized in auto-score if mixed, or counts as completed if answered
      return sanitizeForFirestore({
        questionId: qId,
        questionIndex: idx,
        partType,
        isCorrect: Boolean(studentText),
        isPartiallyCorrect: false,
        scoreEarned: 0,
        maxScore: 0,
        selectedDisplay: studentText || 'Chưa nhập bài làm',
        correctDisplay: 'Xem hướng dẫn giải & biểu điểm chi tiết',
        timeSpentSeconds: Math.max(0, Math.round(stat.timeSpentSeconds || 0)),
        changeCount: Math.max(0, Math.round(stat.changeCount || 0)),
        answeredAt: stat.answeredAt || '',
      });
    }

    // Default: part_1_choice (A / B / C / D)
    totalAutoGradableQuestions += 1;
    const selectedKey = typeof ans === 'string' ? ans.trim().toUpperCase() : '';
    const correctKey = String(q.correctAnswer || '').trim().toUpperCase();
    const matched = Boolean(selectedKey) && selectedKey === correctKey;
    if (matched) {
      correctCount += 1;
      totalRawWeightEarned += 1;
    } else {
      wrongCount += 1;
    }

    return sanitizeForFirestore({
      questionId: qId,
      questionIndex: idx,
      partType: 'part_1_choice',
      isCorrect: matched,
      isPartiallyCorrect: false,
      scoreEarned: matched ? 1 : 0,
      maxScore: 1,
      selectedDisplay: selectedKey || 'Chưa chọn',
      correctDisplay: correctKey || '—',
      timeSpentSeconds: Math.max(0, Math.round(stat.timeSpentSeconds || 0)),
      changeCount: Math.max(0, Math.round(stat.changeCount || 0)),
      answeredAt: stat.answeredAt || '',
    });
  });

  const denom = totalAutoGradableQuestions > 0 ? totalAutoGradableQuestions : Math.max(1, questions.length);
  const totalScore = Math.min(10, Math.max(0, Number(((totalRawWeightEarned / denom) * 10).toFixed(2))));

  return {
    questionDetails,
    totalScore,
    correctCount,
    wrongCount,
  };
}

export async function submitHomeworkAttempt(params: {
  assignment: HomeworkAssignment;
  studentName: string;
  studentRosterId?: string;
  studentClassName?: string;
  answersMap: Record<string, any>;
  processStats: Record<string, QuestionProcessStat>;
  activityLog: HomeworkActivityEvent[];
  startedAt: string;
  totalTimeSeconds: number;
}): Promise<HomeworkSubmission> {
  const uid = await ensureHomeworkAuth();
  const { assignment } = params;

  const existingSubs = readLocalSubmissions(assignment.id);
  const prevAttempts = existingSubs.filter(
    (s) =>
      (params.studentRosterId && s.studentRosterId === params.studentRosterId) ||
      s.studentName.trim().toLowerCase() === params.studentName.trim().toLowerCase()
  ).length;

  const graded = gradeHomeworkSubmission(
    assignment.questions,
    params.answersMap,
    params.processStats
  );

  const submittedAt = new Date().toISOString();
  const submissionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const finalLog: HomeworkActivityEvent[] = [
    ...params.activityLog.slice(-490),
    {
      timestamp: submittedAt,
      elapsedSeconds: Math.max(0, Math.round(params.totalTimeSeconds)),
      type: 'submit',
      detail: `Nộp bài hoàn tất — Đạt ${graded.totalScore}/10 điểm (${graded.correctCount}/${assignment.questions.length} câu đúng)`,
    },
  ];

  const submission: HomeworkSubmission = sanitizeForFirestore({
    id: submissionId,
    assignmentId: assignment.id,
    studentAuthUid: uid,
    studentRosterId: params.studentRosterId || '',
    studentName: params.studentName.trim().slice(0, 150),
    studentClassName: (params.studentClassName || assignment.className || '').slice(0, 80),
    attemptNumber: prevAttempts + 1,
    answers: params.answersMap,
    questionDetails: graded.questionDetails,
    totalScore: graded.totalScore,
    correctCount: graded.correctCount,
    wrongCount: graded.wrongCount,
    totalQuestions: assignment.questions.length,
    startedAt: params.startedAt,
    submittedAt,
    totalTimeSeconds: Math.max(0, Math.round(params.totalTimeSeconds)),
    activityLog: finalLog,
  });

  // Save locally for instant student receipt + fallback
  writeLocalSubmissions(assignment.id, [submission, ...existingSubs]);
  try {
    localStorage.setItem(`smartboard_hw_receipt_${assignment.id}`, JSON.stringify(submission));
  } catch {}

  const path = `homework_assignments/${assignment.id}/submissions/${submission.id}`;
  try {
    await setDoc(
      doc(db, 'homework_assignments', assignment.id, 'submissions', submission.id),
      submission
    );
  } catch (err) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted();
    } else {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }

  return submission;
}

export async function fetchHomeworkSubmissions(
  assignmentId: string
): Promise<HomeworkSubmission[]> {
  if (!assignmentId) return [];
  await ensureHomeworkAuth();
  try {
    const snap = await getDocs(
      collection(db, 'homework_assignments', assignmentId, 'submissions')
    );
    const list: HomeworkSubmission[] = [];
    snap.forEach((d) => {
      const data = d.data() as HomeworkSubmission;
      if (data && data.id) list.push(data);
    });
    list.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    writeLocalSubmissions(assignmentId, list);
    return list;
  } catch (err) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted();
    }
    return readLocalSubmissions(assignmentId);
  }
}

export function subscribeHomeworkSubmissions(
  assignmentId: string,
  callback: (submissions: HomeworkSubmission[]) => void
): () => void {
  if (!assignmentId) {
    callback([]);
    return () => {};
  }

  const localInitial = readLocalSubmissions(assignmentId);
  if (localInitial.length > 0) {
    callback(localInitial.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || '')));
  }

  let active = true;
  let unsub: (() => void) | null = null;

  ensureHomeworkAuth()
    .then(() => {
      if (!active) return;
      unsub = onSnapshot(
        collection(db, 'homework_assignments', assignmentId, 'submissions'),
        (snap) => {
          const list: HomeworkSubmission[] = [];
          snap.forEach((d) => {
            const data = d.data() as HomeworkSubmission;
            if (data && data.id) list.push(data);
          });
          list.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
          writeLocalSubmissions(assignmentId, list);
          callback(list);
        },
        (err) => {
          if (isQuotaError(err)) {
            markFirestoreQuotaExhausted();
          } else {
            console.warn('[homeworkService] subscribeHomeworkSubmissions warning:', err?.message || err);
          }
        }
      );
    })
    .catch(() => {});

  return () => {
    active = false;
    if (unsub) unsub();
  };
}
