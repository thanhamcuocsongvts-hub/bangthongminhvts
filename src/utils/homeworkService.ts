import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { isQuotaError, markFirestoreQuotaExhausted } from './firebaseSafe';
import { normalizeTeacherOwnerId } from './teacherPrivacy';
import { tryEvaluateSimpleMathNumber } from './quizDistribution';
import {
  ClassRoom,
  HomeworkActivityEvent,
  HomeworkAssignMode,
  HomeworkAssignment,
  HomeworkQuestionDetail,
  HomeworkRosterStudent,
  HomeworkSubmission,
  HomeworkSubStatementResult,
  OnlineExamAntiCheatMode,
  OnlineExamVariant,
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

async function postHomeworkApiJson(url: string, body: any, method: 'POST' | 'DELETE' = 'POST'): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'DELETE' ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return false;
    const data = await res.json();
    return Boolean(data?.success);
  } catch {
    return false;
  }
}

async function getHomeworkApiJson<T = any>(url: string): Promise<T | null> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function isPermissionDeniedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  return msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('insufficient');
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

const LOCAL_ASSIGNMENTS_KEY_PREFIX = 'smartboard_homework_assignments_v2_';
const LOCAL_SINGLE_ASSIGNMENT_PREFIX = 'smartboard_homework_single_v2_';
const LOCAL_SUBMISSIONS_PREFIX = 'smartboard_homework_submissions_v1_';

function getLocalAssignmentsKey(teacherId?: string | null): string {
  return `${LOCAL_ASSIGNMENTS_KEY_PREFIX}${normalizeTeacherOwnerId(teacherId)}`;
}

function readLocalAssignments(teacherId?: string | null): HomeworkAssignment[] {
  if (!teacherId) return [];
  const ownerId = normalizeTeacherOwnerId(teacherId);
  try {
    const raw = localStorage.getItem(getLocalAssignmentsKey(ownerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((a: HomeworkAssignment) => a && a.teacherId === ownerId)
      : [];
  } catch {
    return [];
  }
}

function writeLocalAssignments(
  teacherId: string | undefined | null,
  items: HomeworkAssignment[]
): void {
  if (!teacherId) return;
  const ownerId = normalizeTeacherOwnerId(teacherId);
  try {
    const owned = (items || []).filter((a) => a && a.teacherId === ownerId).slice(0, 60);
    localStorage.setItem(getLocalAssignmentsKey(ownerId), JSON.stringify(owned));
    window.dispatchEvent(
      new CustomEvent('homework-assignments-updated', {
        detail: { teacherId: ownerId, items: owned },
      })
    );
  } catch {}
}

function readSingleAssignmentCache(assignmentId: string): HomeworkAssignment | null {
  try {
    const raw = localStorage.getItem(LOCAL_SINGLE_ASSIGNMENT_PREFIX + assignmentId);
    if (!raw) return null;
    return JSON.parse(raw) as HomeworkAssignment;
  } catch {
    return null;
  }
}

function writeSingleAssignmentCache(assignment: HomeworkAssignment): void {
  try {
    localStorage.setItem(
      LOCAL_SINGLE_ASSIGNMENT_PREFIX + assignment.id,
      JSON.stringify(assignment)
    );
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
  antiCheatMode?: OnlineExamAntiCheatMode;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  variantCount?: number;
  variants?: OnlineExamVariant[];
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

  const ownerId = normalizeTeacherOwnerId(params.teacherId);
  const antiCheatMode: OnlineExamAntiCheatMode = params.antiCheatMode || 'none';
  const shuffleQuestions =
    antiCheatMode === 'none' ? false : params.shuffleQuestions !== false;
  const shuffleOptions =
    antiCheatMode === 'none' ? false : params.shuffleOptions !== false;
  const normalizedVariants: OnlineExamVariant[] | undefined =
    antiCheatMode === 'variants_and_shuffle' &&
    Array.isArray(params.variants) &&
    params.variants.length > 0
      ? params.variants.slice(0, 20).map((v, vIdx) => ({
          id: String(v.id || `var_${101 + vIdx}`).slice(0, 64),
          code: String(v.code || String(101 + vIdx)).slice(0, 32),
          label: String(v.label || `Mã đề ${101 + vIdx}`).slice(0, 80),
          questions: normalizeQuizQuestionsForHomework(v.questions || params.questions),
        }))
      : undefined;
  const variantCount =
    antiCheatMode === 'variants_and_shuffle'
      ? Math.min(20, Math.max(2, normalizedVariants?.length || Number(params.variantCount || 2)))
      : antiCheatMode === 'shuffle_original'
      ? Math.min(20, Math.max(1, Number(params.variantCount || 1)))
      : 1;

  const assignment: HomeworkAssignment = sanitizeForFirestore({
    id,
    code,
    title: params.title.trim().slice(0, 300) || 'Đề online',
    subject: (params.subject || 'Toán học').slice(0, 80),
    grade: (params.grade || 'Lớp 12').slice(0, 80),
    teacherId: ownerId,
    teacherName: (params.teacherName || 'Giáo viên').slice(0, 150),
    mode: params.mode,
    classId: params.mode === 'class' && params.classroom ? String(params.classroom.id) : '',
    className: params.mode === 'class' && params.classroom ? String(params.classroom.name) : '',
    classRoster,
    questions: normalizeQuizQuestionsForHomework(params.questions),
    durationMinutes: Math.max(0, Math.min(300, Number(params.durationMinutes || 0))),
    allowRetake: Boolean(params.allowRetake),
    showAnswersAfterSubmit: Boolean(params.showAnswersAfterSubmit),
    antiCheatMode,
    shuffleQuestions,
    shuffleOptions,
    variantCount,
    ...(normalizedVariants ? { variants: normalizedVariants } : {}),
    dueDate: params.dueDate ? String(params.dueDate).slice(0, 64) : '',
    note: params.note ? params.note.trim().slice(0, 600) : '',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  // Update only this teacher's scoped local cache
  const existing = readLocalAssignments(ownerId).filter((a) => a.id !== assignment.id);
  writeLocalAssignments(ownerId, [assignment, ...existing]);
  writeSingleAssignmentCache(assignment);

  const serverSavePromise = postHomeworkApiJson('/api/homework/assignments', assignment);

  const path = `homework_assignments/${assignment.id}`;
  try {
    await setDoc(doc(db, 'homework_assignments', assignment.id), assignment);
  } catch (err) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted();
    } else {
      const serverSaved = await serverSavePromise;
      if (!serverSaved) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
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
      writeSingleAssignmentCache(data);
      return data;
    }
  } catch (err) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted();
    } else {
      const apiRes = await getHomeworkApiJson<{ assignment?: HomeworkAssignment }>(
        `/api/homework/assignments/${encodeURIComponent(assignmentId)}`
      );
      if (apiRes?.assignment) {
        writeSingleAssignmentCache(apiRes.assignment);
        return apiRes.assignment;
      }
      const cached = readSingleAssignmentCache(assignmentId);
      if (cached) return cached;
      handleFirestoreError(err, OperationType.GET, path);
    }
  }

  const apiFallback = await getHomeworkApiJson<{ assignment?: HomeworkAssignment }>(
    `/api/homework/assignments/${encodeURIComponent(assignmentId)}`
  );
  if (apiFallback?.assignment) {
    writeSingleAssignmentCache(apiFallback.assignment);
    return apiFallback.assignment;
  }

  return readSingleAssignmentCache(assignmentId);
}

export function subscribeHomeworkAssignments(
  teacherId: string | undefined,
  callback: (assignments: HomeworkAssignment[]) => void
): () => void {
  if (!teacherId) {
    callback([]);
    return () => {};
  }

  const ownerId = normalizeTeacherOwnerId(teacherId);
  if (ownerId === 'guest') {
    const guestLocal = readLocalAssignments(ownerId).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
    callback(guestLocal);
    return () => {};
  }

  // Emit this teacher's cached assignments right away
  const localInitial = readLocalAssignments(ownerId).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
  callback(localInitial);

  let active = true;
  let unsub: (() => void) | null = null;

  ensureHomeworkAuth()
    .then(() => {
      if (!active) return;
      const q = query(
        collection(db, 'homework_assignments'),
        where('teacherId', '==', ownerId)
      );
      unsub = onSnapshot(
        q,
        (snap) => {
          const owned: HomeworkAssignment[] = [];
          snap.forEach((d) => {
            const data = d.data() as HomeworkAssignment;
            if (data && data.id && data.teacherId === ownerId) {
              owned.push(data);
            }
          });
          owned.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          writeLocalAssignments(ownerId, owned);
          callback(owned);
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

  const handleLocalEvt = (e: Event) => {
    const detail = (e as CustomEvent<{ teacherId?: string }>).detail;
    if (detail?.teacherId && detail.teacherId !== ownerId) return;
    const items = readLocalAssignments(ownerId).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
    callback(items);
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
  status: 'active' | 'closed',
  teacherId?: string
): Promise<void> {
  await ensureHomeworkAuth();
  const now = new Date().toISOString();
  if (teacherId) {
    const ownerId = normalizeTeacherOwnerId(teacherId);
    const updatedLocal = readLocalAssignments(ownerId).map((a) =>
      a.id === assignmentId ? { ...a, status, updatedAt: now } : a
    );
    writeLocalAssignments(ownerId, updatedLocal);
  }

  const serverStatusPromise = postHomeworkApiJson(
    `/api/homework/assignments/${encodeURIComponent(assignmentId)}/status`,
    { status, updatedAt: now }
  );

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
      const serverUpdated = await serverStatusPromise;
      if (!serverUpdated) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }
  }
}

export async function deleteHomeworkAssignment(
  assignmentId: string,
  teacherId?: string
): Promise<void> {
  await ensureHomeworkAuth();
  if (teacherId) {
    const ownerId = normalizeTeacherOwnerId(teacherId);
    const updatedLocal = readLocalAssignments(ownerId).filter((a) => a.id !== assignmentId);
    writeLocalAssignments(ownerId, updatedLocal);
  }

  const serverDeletePromise = postHomeworkApiJson(
    `/api/homework/assignments/${encodeURIComponent(assignmentId)}`,
    undefined,
    'DELETE'
  );

  const path = `homework_assignments/${assignmentId}`;
  try {
    await deleteDoc(doc(db, 'homework_assignments', assignmentId));
  } catch (err) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted();
    } else {
      const serverDeleted = await serverDeletePromise;
      if (!serverDeleted) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    }
  }
}

function normalizeShortText(val: string): string {
  return String(val || '')
    .trim()
    .toLowerCase()
    .replace(/^\$\$|\$\$$/g, '')
    .replace(/^\$|\$$/g, '')
    .replace(/,/g, '.')
    .replace(/\s+/g, ' ');
}

function isShortAnswerEqual(studentVal: string, expectedVal: string): boolean {
  const s = normalizeShortText(studentVal);
  const e = normalizeShortText(expectedVal);
  if (!s || !e) return false;
  if (s === e) return true;
  const sNum = Number(s.replace(/\s+/g, ''));
  const eNum = Number(e.replace(/\s+/g, ''));
  if (Number.isFinite(sNum) && Number.isFinite(eNum)) {
    return Math.abs(sNum - eNum) < 1e-3;
  }
  const sEval = tryEvaluateSimpleMathNumber(studentVal);
  const eEval = tryEvaluateSimpleMathNumber(expectedVal);
  if (sEval !== null && eEval !== null) {
    return Math.abs(sEval - eEval) < 1e-3;
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
  effectiveQuestions?: QuizQuestion[];
  variantCode?: string;
  variantLabel?: string;
  shuffleSeed?: number;
  answersMap: Record<string, any>;
  processStats: Record<string, QuestionProcessStat>;
  activityLog: HomeworkActivityEvent[];
  startedAt: string;
  totalTimeSeconds: number;
}): Promise<HomeworkSubmission> {
  const uid = await ensureHomeworkAuth();
  const { assignment } = params;
  const questionsToGrade = (
    params.effectiveQuestions && params.effectiveQuestions.length > 0
      ? params.effectiveQuestions
      : assignment.questions
  ).slice(0, 100);

  if (questionsToGrade.length === 0) {
    throw new Error('Đề online chưa có câu hỏi để chấm điểm.');
  }

  const safeStudentName = (params.studentName || '').trim().slice(0, 150) || 'Học sinh';
  const safeUid = String(uid || `dev_${Date.now()}`).trim().slice(0, 128) || `dev_${Date.now()}`;

  const existingSubs = readLocalSubmissions(assignment.id);
  const prevAttempts = existingSubs.filter(
    (s) =>
      (params.studentRosterId && s.studentRosterId === params.studentRosterId) ||
      s.studentName.trim().toLowerCase() === safeStudentName.toLowerCase()
  ).length;

  const safeAnswersMap =
    params.answersMap && typeof params.answersMap === 'object' && !Array.isArray(params.answersMap)
      ? params.answersMap
      : {};

  const graded = gradeHomeworkSubmission(
    questionsToGrade,
    safeAnswersMap,
    params.processStats || {}
  );

  const submittedAt = new Date().toISOString().slice(0, 64);
  const startedAt = String(params.startedAt || submittedAt).slice(0, 64);
  const clampedTotalTime = Math.min(86400, Math.max(0, Math.round(params.totalTimeSeconds || 0)));
  const submissionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const finalLog: HomeworkActivityEvent[] = [
    ...(params.activityLog || []).slice(-490),
    {
      timestamp: submittedAt,
      elapsedSeconds: clampedTotalTime,
      type: 'submit' as const,
      detail: `Nộp bài hoàn tất — Đạt ${graded.totalScore}/10 điểm (${graded.correctCount}/${questionsToGrade.length} câu đúng)`,
    },
  ].slice(-500);

  const submission: HomeworkSubmission = sanitizeForFirestore({
    id: submissionId,
    assignmentId: assignment.id,
    studentAuthUid: safeUid,
    studentRosterId: String(params.studentRosterId || '').slice(0, 128),
    studentName: safeStudentName,
    studentClassName: String(params.studentClassName || assignment.className || '').slice(0, 80),
    ...(params.variantCode ? { variantCode: String(params.variantCode).slice(0, 32) } : {}),
    ...(params.variantLabel ? { variantLabel: String(params.variantLabel).slice(0, 80) } : {}),
    ...(typeof params.shuffleSeed === 'number' && params.shuffleSeed >= 0
      ? { shuffleSeed: Math.round(params.shuffleSeed) }
      : {}),
    attemptNumber: Math.min(100, Math.max(1, prevAttempts + 1)),
    answers: safeAnswersMap,
    questionDetails: graded.questionDetails.slice(0, 100),
    totalScore: Math.min(10, Math.max(0, Number(graded.totalScore || 0))),
    correctCount: Math.min(100, Math.max(0, Math.round(graded.correctCount || 0))),
    wrongCount: Math.min(100, Math.max(0, Math.round(graded.wrongCount || 0))),
    totalQuestions: Math.min(100, Math.max(1, questionsToGrade.length)),
    startedAt,
    submittedAt,
    totalTimeSeconds: clampedTotalTime,
    activityLog: finalLog,
  });

  // Save locally for instant student receipt + offline resilience
  writeLocalSubmissions(assignment.id, [submission, ...existingSubs]);
  try {
    localStorage.setItem(`smartboard_hw_receipt_${assignment.id}`, JSON.stringify(submission));
  } catch {}

  const serverSubPromise = postHomeworkApiJson(
    `/api/homework/assignments/${encodeURIComponent(assignment.id)}/submissions`,
    submission
  );

  const path = `homework_assignments/${assignment.id}/submissions/${submission.id}`;
  const subDocRef = doc(db, 'homework_assignments', assignment.id, 'submissions', submission.id);

  try {
    await setDoc(subDocRef, submission);
  } catch (firstErr) {
    if (isQuotaError(firstErr)) {
      markFirestoreQuotaExhausted();
      await serverSubPromise;
      return submission;
    }

    // Retry once automatically for transient mobile/network failures unless clearly permission denied
    if (!isPermissionDeniedError(firstErr)) {
      try {
        await new Promise((r) => setTimeout(r, 350));
        await setDoc(subDocRef, submission);
        await serverSubPromise;
        return submission;
      } catch (retryErr) {
        if (isQuotaError(retryErr)) {
          markFirestoreQuotaExhausted();
          await serverSubPromise;
          return submission;
        }
        const serverSaved = await serverSubPromise;
        if (serverSaved) {
          return submission;
        }
        handleFirestoreError(retryErr, OperationType.CREATE, path);
      }
    }

    const serverSaved = await serverSubPromise;
    if (serverSaved) {
      return submission;
    }
    handleFirestoreError(firstErr, OperationType.CREATE, path);
  }

  await serverSubPromise;
  return submission;
}

export async function fetchHomeworkSubmissions(
  assignmentId: string
): Promise<HomeworkSubmission[]> {
  if (!assignmentId) return [];
  await ensureHomeworkAuth();

  const mergedMap = new Map<string, HomeworkSubmission>();
  const apiResPromise = getHomeworkApiJson<{ submissions?: HomeworkSubmission[] }>(
    `/api/homework/assignments/${encodeURIComponent(assignmentId)}/submissions`
  );

  try {
    const snap = await getDocs(
      collection(db, 'homework_assignments', assignmentId, 'submissions')
    );
    snap.forEach((d) => {
      const data = d.data() as HomeworkSubmission;
      if (data && data.id) mergedMap.set(data.id, data);
    });
  } catch (err) {
    if (isQuotaError(err)) {
      markFirestoreQuotaExhausted();
    }
  }

  const apiRes = await apiResPromise;
  if (Array.isArray(apiRes?.submissions)) {
    apiRes.submissions.forEach((s) => {
      if (s && s.id && !mergedMap.has(s.id)) {
        mergedMap.set(s.id, s);
      }
    });
  }

  if (mergedMap.size > 0) {
    const list = Array.from(mergedMap.values()).sort((a, b) =>
      (b.submittedAt || '').localeCompare(a.submittedAt || '')
    );
    writeLocalSubmissions(assignmentId, list);
    return list;
  }

  return readLocalSubmissions(assignmentId);
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
