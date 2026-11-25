import { HomeworkAssignment, QuizOption, QuizQuestion } from '../types';

const CHOICE_KEYS = ['A', 'B', 'C', 'D'] as const;
type ChoiceKey = (typeof CHOICE_KEYS)[number];

/**
 * Fast deterministic 32-bit PRNG (Mulberry32)
 */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0 || 1;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStringToSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1337;
}

function shuffleWithRng<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function inferPartType(
  q: Partial<QuizQuestion>
): 'part_1_choice' | 'part_2_true_false' | 'part_3_short_answer' | 'part_4_essay' {
  const rawPt = String(q.partType || '').trim().toLowerCase();
  if (rawPt === 'part_2_true_false' || rawPt.includes('true_false') || rawPt.includes('dung_sai') || (Array.isArray(q.subStatements) && q.subStatements.length > 0)) {
    return 'part_2_true_false';
  }
  if (rawPt === 'part_3_short_answer' || rawPt.includes('short_answer') || rawPt.includes('tra_loi_ngan') || Boolean(q.shortAnswerKey)) {
    return 'part_3_short_answer';
  }
  if (rawPt === 'part_4_essay' || rawPt.includes('essay') || rawPt.includes('tu_luan') || Boolean(q.essayRubric)) {
    return 'part_4_essay';
  }
  return 'part_1_choice';
}

/**
 * Extracts canonical choice letter A/B/C/D from strings like "C", "C.", "Đáp án C", "C. 12"
 */
export function extractChoiceKey(rawAnswer: any): ChoiceKey {
  const s = String(rawAnswer || '').trim().toUpperCase();
  if (CHOICE_KEYS.includes(s as ChoiceKey)) return s as ChoiceKey;
  const directPrefix = s.match(/^([A-D])(?:[\.\)\:\s]|$)/);
  if (directPrefix) return directPrefix[1] as ChoiceKey;
  const phraseMatch = s.match(/(?:ĐÁP\s*ÁN|PHƯƠNG\s*ÁN|LỰA\s*CHỌN|CHỌN)\s*[:\-]?\s*([A-D])\b/i);
  if (phraseMatch) return phraseMatch[1].toUpperCase() as ChoiceKey;
  const anyKey = s.match(/\b([A-D])\b/);
  if (anyKey) return anyKey[1] as ChoiceKey;
  return 'A';
}

export function stripLeadingChoicePrefix(text: string): string {
  return String(text || '').replace(/^\s*[A-D]\s*[\.\)\:]\s+(?=\S)/, '').trim();
}

export function buildBalancedChoiceTargets(
  count: number,
  seedInput?: number | string
): ChoiceKey[] {
  const seed =
    typeof seedInput === 'number'
      ? seedInput
      : typeof seedInput === 'string'
      ? hashStringToSeed(seedInput)
      : Math.floor(Date.now() % 1_000_000_000) ^ (count * 2654435761);
  const rng = mulberry32(seed);
  const targets: ChoiceKey[] = [];
  let prevKey: ChoiceKey | null = null;
  let prevPrevKey: ChoiceKey | null = null;

  while (targets.length < count) {
    const block = shuffleWithRng([...CHOICE_KEYS], rng);
    if (prevKey && prevKey === prevPrevKey && block[0] === prevKey) {
      const swapIdx = block.findIndex((k) => k !== prevKey);
      if (swapIdx > 0) {
        [block[0], block[swapIdx]] = [block[swapIdx], block[0]];
      }
    }
    for (const k of block) {
      if (targets.length >= count) break;
      targets.push(k);
      prevPrevKey = prevKey;
      prevKey = k;
    }
  }
  return targets;
}

/**
 * Protects questions whose options reference option letters by position
 * (only inspects option texts so math symbols like "tam giác ABC" or "cả A và B" in the question stem never block balancing).
 */
export function hasPositionalOptionReference(q: Partial<QuizQuestion>): boolean {
  const combinedOptionsText = (q.options || [])
    .map((o: any) => (typeof o === 'string' ? o : o?.text || ''))
    .join(' ');
  return (
    /cả\s+[A-D]\s*(?:,|và|&|lẫn)\s*[A-D]/i.test(combinedOptionsText) ||
    /\b(?:phương\s*án|đáp\s*án|câu|lựa\s*chọn)\s*[A-D]\b/i.test(combinedOptionsText) ||
    /tất\s*cả\s*(?:các)?\s*(?:phương\s*án|đáp\s*án|câu|ý)\s*(?:trên|nêu\s*trên)/i.test(combinedOptionsText) ||
    /cả\s*(?:2|3|4|hai|ba|bốn)\s*(?:phương\s*án|đáp\s*án|ý|câu)\s*(?:trên|nêu\s*trên)/i.test(
      combinedOptionsText
    )
  );
}

/**
 * Updates unambiguous Vietnamese answer-letter citations inside explanation
 * (never touches math symbols like "điểm A", "véctơ A", "biên độ A").
 */
export function rewriteExplanationAnswerLetter(
  explanation: string,
  oldKey: ChoiceKey,
  newKey: ChoiceKey
): string {
  if (!explanation || oldKey === newKey) return explanation;
  return explanation.replace(
    /((?:đáp\s*án|phương\s*án|lựa\s*chọn)\s*(?:đúng|chính\s*xác)?\s*(?:là|:)?\s*|chọn\s+(?:đáp\s*án\s*|phương\s*án\s*)?)([A-D])(?=\s*(?:[.,;!)]|$|\s+đúng|\s+chính\s*xác))/gi,
    (full, prefix: string, foundKey: string) => {
      if (foundKey.toUpperCase() === oldKey) {
        return `${prefix}${newKey}`;
      }
      return full;
    }
  );
}

function normalizeOptionsList(options: QuizOption[] = []): Array<{ key: ChoiceKey; text: string }> {
  return CHOICE_KEYS.map((key, idx) => {
    const found =
      options.find((o) => String((o as any)?.key || '').trim().toUpperCase().replace(/[\.\)]$/, '') === key) ||
      options[idx];
    const rawText = typeof found === 'string' ? found : String((found as any)?.text || `Phương án ${key}`);
    return {
      key,
      text: stripLeadingChoicePrefix(rawText) || rawText,
    };
  });
}

function reorderQuestionToTargetKey(
  q: QuizQuestion,
  targetKey: ChoiceKey,
  rng: () => number
): QuizQuestion {
  const normOpts = normalizeOptionsList(q.options);
  const oldKey = extractChoiceKey(q.correctAnswer);

  const correctItem = normOpts.find((o) => o.key === oldKey) || normOpts[0];
  const distractors = shuffleWithRng(
    normOpts.filter((o) => o.key !== correctItem.key).map((o) => o.text),
    rng
  );

  let distractorCursor = 0;
  const newOptions: QuizOption[] = CHOICE_KEYS.map((key) => {
    if (key === targetKey) {
      return { key, text: correctItem.text };
    }
    const text = distractors[distractorCursor++] ?? '';
    return { key, text };
  });

  return {
    ...q,
    partType: 'part_1_choice',
    options: newOptions,
    correctAnswer: targetKey,
    explanation: rewriteExplanationAnswerLetter(q.explanation || '', oldKey, targetKey),
  };
}

function isChoiceDistributionBalanced(questions: QuizQuestion[], eligibleIndices: number[]): boolean {
  const n = eligibleIndices.length;
  if (n <= 1) return n === 0 || extractChoiceKey(questions[eligibleIndices[0]].correctAnswer) !== 'A';
  const counts: Record<ChoiceKey, number> = { A: 0, B: 0, C: 0, D: 0 };
  let streak = 1;
  let prev: ChoiceKey | null = null;

  for (const idx of eligibleIndices) {
    const k = extractChoiceKey(questions[idx].correctAnswer);
    counts[k]++;
    if (k === prev) {
      streak++;
      if (streak >= 3) return false;
    } else {
      streak = 1;
      prev = k;
    }
  }

  const minAllowed = Math.floor(n / 4);
  const maxAllowed = Math.ceil(n / 4);
  return CHOICE_KEYS.every((k) => counts[k] >= minAllowed && counts[k] <= maxAllowed);
}

/**
 * Re-balances multiple-choice answer keys across A, B, C, D so generated exams
 * never cluster on 'A' (or any single option letter).
 * If already balanced, preserves original aligned options and explanations untouched.
 */
export function balanceQuizAnswerDistribution(
  questions: QuizQuestion[],
  seedInput?: number | string,
  forceReshuffle = false
): QuizQuestion[] {
  if (!Array.isArray(questions) || questions.length === 0) return questions || [];

  const seed =
    typeof seedInput === 'number'
      ? seedInput
      : typeof seedInput === 'string'
      ? hashStringToSeed(seedInput)
      : Math.floor(Date.now() % 1_000_000_000) ^ (questions.length * 2654435761);
  const rng = mulberry32(seed);

  const eligibleIndices: number[] = [];
  questions.forEach((q, idx) => {
    if (
      inferPartType(q) === 'part_1_choice' &&
      Array.isArray(q.options) &&
      q.options.length >= 4 &&
      !hasPositionalOptionReference(q)
    ) {
      eligibleIndices.push(idx);
    }
  });

  if (eligibleIndices.length === 0) return questions;

  // Normalize option keys/labels & clean correctAnswer strings first
  const normalized = questions.map((q) => {
    if (inferPartType(q) !== 'part_1_choice' || !Array.isArray(q.options) || q.options.length < 4) {
      return q;
    }
    return {
      ...q,
      partType: 'part_1_choice' as const,
      options: normalizeOptionsList(q.options),
      correctAnswer: extractChoiceKey(q.correctAnswer),
    };
  });

  if (!forceReshuffle && isChoiceDistributionBalanced(normalized, eligibleIndices)) {
    return normalized;
  }

  const targets = buildBalancedChoiceTargets(eligibleIndices.length, seed);

  const result = [...normalized];
  eligibleIndices.forEach((qIdx, pos) => {
    result[qIdx] = reorderQuestionToTargetKey(result[qIdx], targets[pos], rng);
  });

  return result;
}

/**
 * Shuffles questions strictly within each BGD Part (I -> II -> III -> IV)
 * so exam sections stay properly grouped.
 */
export function shuffleQuestionsWithinParts(
  questions: QuizQuestion[],
  rng: () => number
): QuizQuestion[] {
  if (!Array.isArray(questions) || questions.length <= 1) return [...(questions || [])];

  const partOrder: Array<'part_1_choice' | 'part_2_true_false' | 'part_3_short_answer' | 'part_4_essay'> = [
    'part_1_choice',
    'part_2_true_false',
    'part_3_short_answer',
    'part_4_essay',
  ];

  const buckets: Record<string, QuizQuestion[]> = {
    part_1_choice: [],
    part_2_true_false: [],
    part_3_short_answer: [],
    part_4_essay: [],
  };

  questions.forEach((q) => {
    const pt = inferPartType(q);
    buckets[pt].push(q);
  });

  const shuffledAll: QuizQuestion[] = [];
  partOrder.forEach((pt) => {
    if (buckets[pt].length > 0) {
      shuffledAll.push(...shuffleWithRng(buckets[pt], rng));
    }
  });
  return shuffledAll;
}

/**
 * Shuffles the 4 options A, B, C, D of a single question using the provided RNG,
 * updating correctAnswer and explanation citations safely.
 */
export function shuffleQuestionOptionsOnly(
  q: QuizQuestion,
  rng: () => number
): QuizQuestion {
  if (
    inferPartType(q) !== 'part_1_choice' ||
    !Array.isArray(q.options) ||
    q.options.length < 2 ||
    hasPositionalOptionReference(q)
  ) {
    return q;
  }

  const normOpts = normalizeOptionsList(q.options);
  const oldKeyRaw = String(q.correctAnswer || 'A').trim().toUpperCase();
  const oldKey: ChoiceKey = (CHOICE_KEYS.includes(oldKeyRaw as ChoiceKey)
    ? oldKeyRaw
    : 'A') as ChoiceKey;

  const perm = shuffleWithRng([0, 1, 2, 3], rng);
  let newKey: ChoiceKey = oldKey;

  const newOptions: QuizOption[] = CHOICE_KEYS.map((key, idx) => {
    const src = normOpts[perm[idx]];
    if (src.key === oldKey) {
      newKey = key;
    }
    return { key, text: src.text };
  });

  return {
    ...q,
    options: newOptions,
    correctAnswer: newKey,
    explanation: rewriteExplanationAnswerLetter(q.explanation || '', oldKey, newKey),
  };
}

/**
 * Picks a deterministic+random variant code & shuffle seed when a student starts an online exam.
 */
export function pickStudentVariantAssignment(
  assignment: HomeworkAssignment,
  studentKey: string
): { variantCode: string; variantLabel: string; shuffleSeed: number } {
  const mode = assignment.antiCheatMode || 'none';
  const rawEntropy = `${assignment.id}:${studentKey.trim().toLowerCase()}:${Date.now()}:${Math.random()}`;
  const shuffleSeed = (hashStringToSeed(rawEntropy) % 1_900_000_000) + 101;

  if (mode === 'variants_and_shuffle' && Array.isArray(assignment.variants) && assignment.variants.length > 0) {
    const studentHash = hashStringToSeed(`${assignment.id}:${studentKey.trim().toLowerCase()}`);
    const picked = assignment.variants[studentHash % assignment.variants.length];
    return {
      variantCode: picked.code,
      variantLabel: picked.label || `Mã đề ${picked.code}`,
      shuffleSeed,
    };
  }

  if (mode === 'shuffle_original') {
    const displayCode = String(101 + (shuffleSeed % 98));
    return {
      variantCode: displayCode,
      variantLabel: `Đề trộn #${displayCode}`,
      shuffleSeed,
    };
  }

  return {
    variantCode: 'GỐC',
    variantLabel: 'Đề chuẩn',
    shuffleSeed: 0,
  };
}

/**
 * Reconstructs the exact exam questions & option order that a student sees/saw,
 * given the assignment + persisted variantCode + shuffleSeed.
 * Shared identically by StudentHomeworkPortal (taking + result) and HomeworkTrackerView (teacher inspection).
 */
export function resolveStudentOnlineExam(
  assignment: HomeworkAssignment,
  variantCode?: string,
  shuffleSeed?: number
): {
  variantCode: string;
  variantLabel: string;
  shuffleSeed: number;
  questions: QuizQuestion[];
} {
  const mode = assignment.antiCheatMode || 'none';

  let baseQuestions: QuizQuestion[] = assignment.questions || [];
  let resolvedCode = variantCode || 'GỐC';
  let resolvedLabel = variantCode && variantCode !== 'GỐC' ? `Mã đề ${variantCode}` : 'Đề chuẩn';

  if (
    mode === 'variants_and_shuffle' &&
    Array.isArray(assignment.variants) &&
    assignment.variants.length > 0
  ) {
    const found =
      (variantCode
        ? assignment.variants.find((v) => v.code === variantCode || v.id === variantCode)
        : null) || assignment.variants[0];
    baseQuestions = found.questions || baseQuestions;
    resolvedCode = found.code;
    resolvedLabel = found.label || `Mã đề ${found.code}`;
  } else if (mode === 'shuffle_original') {
    resolvedCode = variantCode || '101';
    resolvedLabel = `Đề trộn #${resolvedCode}`;
  }

  const effectiveSeed = typeof shuffleSeed === 'number' && shuffleSeed > 0 ? shuffleSeed : 0;

  if (mode === 'none' || effectiveSeed === 0) {
    return {
      variantCode: resolvedCode,
      variantLabel: resolvedLabel,
      shuffleSeed: effectiveSeed,
      questions: baseQuestions,
    };
  }

  const shouldShuffleQuestions = assignment.shuffleQuestions !== false;
  const shouldShuffleOptions = assignment.shuffleOptions !== false;

  let effectiveQuestions = [...baseQuestions];

  if (shouldShuffleQuestions) {
    effectiveQuestions = shuffleQuestionsWithinParts(effectiveQuestions, mulberry32(effectiveSeed));
  }

  if (shouldShuffleOptions) {
    effectiveQuestions = effectiveQuestions.map((q, idx) =>
      shuffleQuestionOptionsOnly(q, mulberry32(effectiveSeed + (idx + 1) * 7919))
    );
  }

  return {
    variantCode: resolvedCode,
    variantLabel: resolvedLabel,
    shuffleSeed: effectiveSeed,
    questions: effectiveQuestions,
  };
}
