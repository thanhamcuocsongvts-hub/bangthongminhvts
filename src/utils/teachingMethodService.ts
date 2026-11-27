import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TeachingMethodExercise, TeachingMethodPlan } from '../types';
import { safeSetDoc } from './firebaseSafe';
import { getGeminiApiKey } from './geminiClient';
import { normalizeAllMathInText } from './mathNormalization';
import { normalizeTeacherOwnerId } from './teacherPrivacy';

const STORAGE_PREFIX = 'smartboard_teaching_methods_v1_';

function getStorageKey(teacherId?: string | null): string {
  return `${STORAGE_PREFIX}${normalizeTeacherOwnerId(teacherId)}`;
}

function getFirestoreDocRef(teacherId?: string | null) {
  const ownerId = normalizeTeacherOwnerId(teacherId);
  return doc(db, 'global_store', `teaching_methods_${ownerId}`);
}

export function normalizeTeachingMethodPlan(raw: any): TeachingMethodPlan {
  const norm = (val: any) => (val === null || val === undefined ? '' : normalizeAllMathInText(String(val)));
  const now = new Date().toISOString();
  return {
    id: String(raw?.id || `method_${Date.now()}`),
    teacherId: raw?.teacherId ? String(raw.teacherId) : undefined,
    title: norm(raw?.title || 'Phương pháp giải bài tập'),
    prompt: norm(raw?.prompt || ''),
    subject: String(raw?.subject || 'Toán học'),
    grade: String(raw?.grade || 'Lớp 12'),
    targetLevel: String(raw?.targetLevel || 'Chuẩn SGK (Thông hiểu - Vận dụng)'),
    recognitionSigns: norm(raw?.recognitionSigns || ''),
    learningObjective: norm(raw?.learningObjective || ''),
    commonMistakes: Array.isArray(raw?.commonMistakes)
      ? raw.commonMistakes.map((m: any) => norm(m)).filter(Boolean)
      : [],
    steps: Array.isArray(raw?.steps)
      ? raw.steps.map((s: any, idx: number) => ({
          stepNumber: Number(s?.stepNumber) || idx + 1,
          title: norm(s?.title || `Bước ${idx + 1}`),
          actionGuide: norm(s?.actionGuide || ''),
          formula: norm(s?.formula || ''),
          keyNote: norm(s?.keyNote || ''),
        }))
      : [],
    formulas: Array.isArray(raw?.formulas)
      ? raw.formulas.map((f: any) => ({
          name: norm(f?.name || 'Công thức trọng tâm'),
          expression: norm(f?.expression || ''),
          condition: norm(f?.condition || ''),
        }))
      : [],
    examples: Array.isArray(raw?.examples)
      ? raw.examples.map((ex: any, idx: number) => ({
          title: norm(ex?.title || `Ví dụ minh họa ${idx + 1}`),
          problem: norm(ex?.problem || ''),
          stepByStepSolution: Array.isArray(ex?.stepByStepSolution)
            ? ex.stepByStepSolution.map((st: any, sIdx: number) => ({
                stepLabel: norm(st?.stepLabel || `Bước ${sIdx + 1}`),
                content: norm(st?.content || ''),
                resultFormula: norm(st?.resultFormula || ''),
              }))
            : [],
          finalAnswer: norm(ex?.finalAnswer || ''),
          teacherTip: norm(ex?.teacherTip || ''),
        }))
      : [],
    exercises: Array.isArray(raw?.exercises)
      ? raw.exercises.map((ex: any, idx: number) => ({
          id: String(ex?.id || `ex_${Date.now()}_${idx + 1}`),
          index: Number(ex?.index) || idx + 1,
          level: String(ex?.level || 'Thông hiểu'),
          problem: norm(ex?.problem || ''),
          hint: norm(ex?.hint || ''),
          solutionSteps: norm(ex?.solutionSteps || ''),
          shortAnswer: norm(ex?.shortAnswer || ''),
        }))
      : [],
    createdAt: String(raw?.createdAt || now),
    updatedAt: String(raw?.updatedAt || now),
  };
}

export function loadLocalTeachingMethods(teacherId?: string | null): TeachingMethodPlan[] {
  try {
    const raw = localStorage.getItem(getStorageKey(teacherId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTeachingMethodPlan);
  } catch {
    return [];
  }
}

export function saveLocalTeachingMethods(teacherId: string | null | undefined, list: TeachingMethodPlan[]): void {
  try {
    localStorage.setItem(getStorageKey(teacherId), JSON.stringify(list.slice(0, 80)));
  } catch (err) {
    console.warn('Could not save teaching methods to localStorage:', err);
  }
}

export async function pullTeachingMethodsFromCloud(teacherId?: string | null): Promise<TeachingMethodPlan[]> {
  const local = loadLocalTeachingMethods(teacherId);
  try {
    const snap = await getDoc(getFirestoreDocRef(teacherId));
    if (snap.exists() && Array.isArray(snap.data()?.items)) {
      const cloudItems = snap.data().items.map(normalizeTeachingMethodPlan);
      const map = new Map<string, TeachingMethodPlan>();
      [...local, ...cloudItems].forEach((item) => {
        const prev = map.get(item.id);
        if (!prev || String(item.updatedAt) >= String(prev.updatedAt)) {
          map.set(item.id, item);
        }
      });
      const merged = Array.from(map.values()).sort((a, b) =>
        String(b.updatedAt).localeCompare(String(a.updatedAt))
      );
      saveLocalTeachingMethods(teacherId, merged);
      return merged;
    }
  } catch (err) {
    console.warn('Pull teaching methods notice:', err);
  }
  return local;
}

export function subscribeTeachingMethodsCloud(
  teacherId: string | null | undefined,
  onUpdate: (items: TeachingMethodPlan[]) => void
): () => void {
  const unsub = onSnapshot(
    getFirestoreDocRef(teacherId),
    (snap) => {
      if (snap.exists() && Array.isArray(snap.data()?.items)) {
        const cloudItems = snap.data().items
          .map(normalizeTeachingMethodPlan)
          .sort((a: TeachingMethodPlan, b: TeachingMethodPlan) =>
            String(b.updatedAt).localeCompare(String(a.updatedAt))
          );
        saveLocalTeachingMethods(teacherId, cloudItems);
        onUpdate(cloudItems);
      }
    },
    (err) => {
      console.warn('Teaching methods snapshot notice:', err?.message || err);
    }
  );
  return unsub;
}

export async function saveTeachingMethodPlan(
  teacherId: string | null | undefined,
  plan: TeachingMethodPlan
): Promise<TeachingMethodPlan[]> {
  const ownerId = normalizeTeacherOwnerId(teacherId);
  const current = loadLocalTeachingMethods(teacherId);
  const stamped: TeachingMethodPlan = {
    ...plan,
    teacherId: ownerId,
    updatedAt: new Date().toISOString(),
  };
  const next = [stamped, ...current.filter((item) => item.id !== stamped.id)].slice(0, 80);
  saveLocalTeachingMethods(teacherId, next);

  await safeSetDoc(
    getFirestoreDocRef(teacherId),
    {
      teacherId: ownerId,
      items: JSON.parse(JSON.stringify(next)),
      updatedAt: stamped.updatedAt,
    },
    { merge: true }
  );

  return next;
}

export async function deleteTeachingMethodPlan(
  teacherId: string | null | undefined,
  methodId: string
): Promise<TeachingMethodPlan[]> {
  const ownerId = normalizeTeacherOwnerId(teacherId);
  const current = loadLocalTeachingMethods(teacherId);
  const next = current.filter((item) => item.id !== methodId);
  saveLocalTeachingMethods(teacherId, next);

  await safeSetDoc(
    getFirestoreDocRef(teacherId),
    {
      teacherId: ownerId,
      items: JSON.parse(JSON.stringify(next)),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return next;
}

async function postTeachingMethodRequest(
  payload: Record<string, any>,
  customKey: string | null
): Promise<{ res: Response; data: any; rawText: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (customKey) {
    headers['x-gemini-api-key'] = customKey;
  }

  const res = await fetch('/api/ai/generate-teaching-method', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...payload,
      ...(customKey ? { apiKey: customKey } : {}),
    }),
  });

  const rawText = await res.text();
  let data: any = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = null;
  }

  return { res, data, rawText };
}

export async function generateTeachingMethodAI(params: {
  prompt: string;
  subject: string;
  grade: string;
  targetLevel: string;
  exerciseCount: number;
  methodMode?: 'by_type' | 'by_textbook';
  textbookLesson?: string;
}): Promise<TeachingMethodPlan> {
  const customKey = getGeminiApiKey();
  const basePayload = {
    prompt: params.prompt,
    subject: params.subject,
    grade: params.grade,
    targetLevel: params.targetLevel,
    exerciseCount: params.exerciseCount,
    methodMode: params.methodMode || 'by_type',
    textbookLesson: params.textbookLesson || '',
    mode: 'full',
  };

  let attemptResult: { res: Response; data: any; rawText: string } | null = null;
  let lastErrorMsg = '';

  for (let attempt = 0; attempt < 2; attempt++) {
    const useFastMode = attempt === 1;
    try {
      attemptResult = await postTeachingMethodRequest(
        { ...basePayload, fastMode: useFastMode },
        customKey
      );
      if (attemptResult.res.ok && attemptResult.data?.success && attemptResult.data?.method) {
        return normalizeTeachingMethodPlan(attemptResult.data.method);
      }

      const status = attemptResult.res.status;
      lastErrorMsg =
        attemptResult.data?.error ||
        (status === 504 || status === 502 || status === 503
          ? `Máy chủ AI đang quá tải hoặc phản hồi chậm (HTTP ${status}).`
          : `Lỗi máy chủ HTTP ${status}.`);

      // Do not retry client validation or auth key errors
      if (status === 400 || status === 401 || status === 403) {
        break;
      }
    } catch (err: any) {
      lastErrorMsg = err?.message || 'Lỗi kết nối tới máy chủ AI.';
    }
  }

  throw new Error(lastErrorMsg || 'Không thể tạo phương pháp giảng dạy lúc này. Vui lòng thử lại.');
}

export async function generateMoreMethodExercisesAI(params: {
  existingMethod: TeachingMethodPlan;
  count?: number;
}): Promise<TeachingMethodExercise[]> {
  const customKey = getGeminiApiKey();
  const basePayload = {
    prompt: params.existingMethod.prompt || params.existingMethod.title,
    subject: params.existingMethod.subject,
    grade: params.existingMethod.grade,
    targetLevel: params.existingMethod.targetLevel,
    exerciseCount: params.count || 3,
    mode: 'more_exercises',
    existingMethod: params.existingMethod,
  };

  let lastErrorMsg = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { res, data } = await postTeachingMethodRequest(
        { ...basePayload, fastMode: attempt === 1 },
        customKey
      );
      if (res.ok && data?.success && Array.isArray(data?.exercises)) {
        const baseIdx = params.existingMethod.exercises.length;
        return data.exercises.map((ex: any, idx: number) => ({
          id: String(ex?.id || `ex_${Date.now()}_${idx + 1}`),
          index: baseIdx + idx + 1,
          level: String(ex?.level || 'Thông hiểu'),
          problem: normalizeAllMathInText(String(ex?.problem || '')),
          hint: normalizeAllMathInText(String(ex?.hint || '')),
          solutionSteps: normalizeAllMathInText(String(ex?.solutionSteps || '')),
          shortAnswer: normalizeAllMathInText(String(ex?.shortAnswer || '')),
        }));
      }
      lastErrorMsg = data?.error || `Lỗi máy chủ HTTP ${res.status}.`;
      if (res.status === 400 || res.status === 401 || res.status === 403) break;
    } catch (err: any) {
      lastErrorMsg = err?.message || 'Lỗi kết nối tới máy chủ AI.';
    }
  }

  throw new Error(lastErrorMsg || 'Không thể tạo thêm bài tập tương tự lúc này.');
}
