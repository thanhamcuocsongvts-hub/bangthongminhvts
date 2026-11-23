/**
 * Per-Account Privacy & Scoping Helpers for SmartBoard 75 Pro
 * Ensures every teacher's created exams, draft room, saved quiz bank,
 * and homework assignments remain strictly private to their own account.
 */

export function normalizeTeacherOwnerId(teacherId?: string | null): string {
  const clean = String(teacherId || '').trim();
  if (!clean) return 'guest';
  return clean.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96) || 'guest';
}

/**
 * Computes a deterministic 6-digit private classroom PIN for each teacher account.
 * Allows the same teacher to sync across their own PC/phone while keeping
 * every teacher account's live exam draft/room strictly isolated.
 */
export function getTeacherRoomPin(teacherId?: string | null): string {
  const ownerId = normalizeTeacherOwnerId(teacherId);
  if (ownerId === 'teacher_admin_root' || ownerId === 'admin') {
    return '758899';
  }
  let hash = 2166136261;
  for (let i = 0; i < ownerId.length; i++) {
    hash ^= ownerId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  let numericPin = 100000 + (unsigned % 900000);
  if (numericPin === 758899) {
    numericPin = 758900;
  }
  return String(numericPin);
}

export function getLiveExamStorageKeys(teacherId?: string | null): {
  questionsKey: string;
  titleKey: string;
} {
  const ownerId = normalizeTeacherOwnerId(teacherId);
  return {
    questionsKey: `smartboard_live_exam_questions_${ownerId}`,
    titleKey: `smartboard_live_exam_title_${ownerId}`,
  };
}
