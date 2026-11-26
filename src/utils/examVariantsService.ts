import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { OnlineExamVariant, QuizQuestion } from '../types';
import {
  balanceQuizAnswerDistribution,
  ensurePart3RoundingPrompt,
  extractChoiceKey,
  formatPlainShortAnswerKey,
  hashStringToSeed,
  inferPartType,
  mulberry32,
  shuffleQuestionOptionsOnly,
  shuffleQuestionsWithinParts,
  stripLeadingChoicePrefix,
} from './quizDistribution';
import {
  createDirectGeminiClient,
  getGeminiApiKey,
  sanitizeQuizQuestionMath,
} from './geminiClient';

export interface GenerateVariantsParams {
  questions: QuizQuestion[];
  variantCount: number; // 2..20
  subject: string;
  grade: string;
  title: string;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
}

export interface GenerateVariantsResult {
  variants: OnlineExamVariant[];
  usedAI: boolean;
  aiVariantSetsCount: number;
  totalVariantCount: number;
  notice?: string;
}

function escapeUnescapedLatexInJson(text: string): string {
  return text.replace(
    /((?:^|[^\\])(?:\\\\)*)\\(?=(?:frac|forall|times|tan|theta|tau|text|tfrac|triangle|tilde|to(?![a-zA-Z])|beta|binom|bar|begin|big|backslash|bullet|right|rightarrow|rho|rangle|rbrace|rceil|rfloor|neq|notin|nabla)|[^"\\/bfnrtu])/g,
    '$1\\\\'
  );
}

function extractCompleteObjectsFromArray(text: string): any[] | null {
  const startArr = text.indexOf('[');
  if (startArr === -1) return null;
  const items: any[] = [];
  let inString = false;
  let escapeNext = false;
  let depth = 0;
  let objStart = -1;

  for (let idx = startArr + 1; idx < text.length; idx++) {
    const ch = text[idx];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') {
      if (depth === 0) objStart = idx;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart !== -1) {
        const chunk = text.slice(objStart, idx + 1);
        try {
          items.push(JSON.parse(escapeUnescapedLatexInJson(chunk)));
        } catch {
          try {
            items.push(JSON.parse(chunk));
          } catch (_) {}
        }
        objStart = -1;
      }
    }
  }
  return items.length > 0 ? items : null;
}

function safeParseVariantJson(raw: string): any {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const escaped = escapeUnescapedLatexInJson(cleaned);
  try {
    return JSON.parse(escaped);
  } catch {
    try {
      return JSON.parse(cleaned);
    } catch {
      return extractCompleteObjectsFromArray(escaped) || extractCompleteObjectsFromArray(cleaned);
    }
  }
}

function areQuestionsMutated(generated: QuizQuestion[], source: QuizQuestion[]): boolean {
  if (!Array.isArray(generated) || generated.length === 0 || source.length === 0) return false;
  const normalizeCmp = (s: string) =>
    String(s || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .trim();
  const byId = new Map<string, QuizQuestion>();
  source.forEach((sq, i) => byId.set(String(sq.id || i), sq));

  let changedCount = 0;
  generated.forEach((gq, idx) => {
    const srcQ = (gq.id && byId.get(String(gq.id).replace(/_v\d+$/, ''))) || source[idx];
    if (!srcQ) return;
    if (normalizeCmp(gq.question) && normalizeCmp(gq.question) !== normalizeCmp(srcQ.question)) {
      changedCount++;
    }
  });
  return changedCount >= Math.max(1, Math.floor(Math.min(generated.length, source.length) * 0.4));
}

function cloneAndShuffleQuestions(
  baseSet: QuizQuestion[],
  code: string,
  shuffleSeedOffset: number,
  shuffleQuestions: boolean,
  shuffleOptions: boolean
): OnlineExamVariant {
  const seed = hashStringToSeed(`var_${code}_${shuffleSeedOffset}_${baseSet.length}`);
  const rng = mulberry32(seed);

  let cloned: QuizQuestion[] = baseSet.map((q, idx) => ({
    ...q,
    id: `${String(q.id || `q_${idx + 1}`).replace(/_v\d+$/, '')}_v${code}`,
    options: Array.isArray(q.options) ? q.options.map((o) => ({ ...o })) : [],
    subStatements: Array.isArray(q.subStatements)
      ? q.subStatements.map((s) => ({ ...s }))
      : undefined,
  }));

  if (shuffleQuestions) {
    cloned = shuffleQuestionsWithinParts(cloned, rng);
  }
  if (shuffleOptions) {
    cloned = cloned.map((q, i) =>
      shuffleQuestionOptionsOnly(q, mulberry32(seed + (i + 1) * 4099))
    );
  }
  cloned = balanceQuizAnswerDistribution(cloned, seed + 999);

  return {
    id: `var_${code}`,
    code,
    label: `Mã đề ${code}`,
    questions: cloned,
  };
}

function normalizeRawVariantQuestions(
  rawList: any[],
  templateQuestions: QuizQuestion[],
  codeTag: string
): QuizQuestion[] {
  const byIdx = new Map<number, any>();
  rawList.forEach((item: any, arrIdx: number) => {
    const idxNum = Number(item?.idx);
    if (Number.isFinite(idxNum) && idxNum >= 1 && idxNum <= templateQuestions.length) {
      byIdx.set(idxNum - 1, item);
    } else if (!byIdx.has(arrIdx)) {
      byIdx.set(arrIdx, item);
    }
  });

  const normalized: QuizQuestion[] = templateQuestions.map((tmpl, idx) => {
    const raw = byIdx.get(idx) || rawList[idx];
    if (!raw || typeof raw !== 'object' || !raw.question || !String(raw.question).trim()) {
      return {
        ...tmpl,
        id: `${String(tmpl.id || `q_${idx + 1}`).replace(/_v\d+$/, '')}_v${codeTag}`,
      };
    }

    const partType = inferPartType(tmpl);
    const baseClean = sanitizeQuizQuestionMath({
      ...tmpl,
      ...raw,
      id: `${String(tmpl.id || `q_${idx + 1}`).replace(/_v\d+$/, '')}_v${codeTag}`,
      partType,
      partLabel: raw.partLabel || tmpl.partLabel,
      diagramType: raw.diagramType || tmpl.diagramType,
      diagramData: raw.diagramData || tmpl.diagramData,
      timeLimit: Number(raw.timeLimit) || tmpl.timeLimit || 30,
      difficulty: raw.difficulty || tmpl.difficulty || 'Thông hiểu',
    });

    if (partType === 'part_1_choice') {
      const opts =
        Array.isArray(baseClean.options) && baseClean.options.length >= 4
          ? (['A', 'B', 'C', 'D'] as const).map((k, oIdx) => {
              const found =
                baseClean.options.find(
                  (o: any) => String(o?.key || '').trim().toUpperCase().replace(/[\.\)]$/, '') === k
                ) || baseClean.options[oIdx];
              const rawText = typeof found === 'string' ? found : String(found?.text || `Phương án ${k}`);
              return {
                key: k,
                text: stripLeadingChoicePrefix(rawText) || rawText,
              };
            })
          : tmpl.options;
      baseClean.options = opts;
      baseClean.correctAnswer = extractChoiceKey(baseClean.correctAnswer || tmpl.correctAnswer || 'A');
    } else if (partType === 'part_2_true_false') {
      const subs =
        Array.isArray(baseClean.subStatements) && baseClean.subStatements.length > 0
          ? baseClean.subStatements.map((s: any, sIdx: number) => {
              const label = String(s.label || s.key || ['a', 'b', 'c', 'd'][sIdx] || sIdx + 1);
              const statement = String(s.statement || s.text || '');
              const correct =
                typeof s.correct === 'boolean'
                  ? s.correct
                  : typeof s.isCorrect === 'boolean'
                  ? s.isCorrect
                  : true;
              return {
                id: `sub_${codeTag}_${idx}_${sIdx}`,
                key: label,
                label,
                statement,
                text: statement,
                correct,
                isCorrect: correct,
              };
            })
          : tmpl.subStatements;
      baseClean.subStatements = subs;
      baseClean.options = [];
      baseClean.correctAnswer = (subs || [])
        .map((s: any) => `${s.label}:${s.correct ? 'Đ' : 'S'}`)
        .join(', ');
    } else if (partType === 'part_3_short_answer') {
      baseClean.options = [];
      const rawKey = String(baseClean.shortAnswerKey ?? baseClean.correctAnswer ?? tmpl.shortAnswerKey ?? '');
      const formatted = formatPlainShortAnswerKey(rawKey, baseClean.question);
      if (formatted.roundedWithDecimals !== undefined) {
        baseClean.question = ensurePart3RoundingPrompt(baseClean.question, formatted.roundedWithDecimals);
      }
      baseClean.shortAnswerKey = formatted.key;
      baseClean.correctAnswer = formatted.key;
    } else {
      baseClean.options = [];
    }

    return baseClean as QuizQuestion;
  });

  const seed = hashStringToSeed(`norm_set_${codeTag}_${normalized.length}`);
  return balanceQuizAnswerDistribution(normalized, seed);
}

async function generateVariantsDirectClient(
  params: GenerateVariantsParams,
  ai: GoogleGenAI,
  distinctSetsCount: number
): Promise<QuizQuestion[][] | null> {
  const { questions, subject, grade, title } = params;
  const compactSource = questions.slice(0, 36).map((q, i) => ({
    idx: i + 1,
    partType: inferPartType(q),
    question: q.question,
    options: q.options,
    subStatements: q.subStatements,
    shortAnswerKey: q.shortAnswerKey,
    correctAnswer: q.correctAnswer,
  }));

  const BATCH_SIZE = 4;
  const batches: Array<typeof compactSource> = [];
  for (let i = 0; i < compactSource.length; i += BATCH_SIZE) {
    batches.push(compactSource.slice(i, i + BATCH_SIZE));
  }

  let hydrogenBusy = false;

  const runVariantBatch = async (setIndex: number, batchItems: typeof compactSource): Promise<any[]> => {
    const prompt = `Bạn là Chuyên gia Khảo thí Bộ GD&ĐT Việt Nam.
Tạo MÃ ĐỀ TƯƠNG ĐƯƠNG #${setIndex + 2} cho đề "${title}" (${subject} - ${grade}) từ ${batchItems.length} câu gốc sau:
${JSON.stringify(batchItems)}

QUY TẮC BẮT BUỘC:
1. PHẢI BIẾN ĐỔI ĐỀ (KHÔNG CHÉP NGUYÊN VĂN): Giữ nguyên dạng toán/đơn vị kiến thức và mức độ khó, NHƯNG thay đổi số liệu, hệ số, biểu thức hàm số hoặc giả thiết tình huống tương đương.
2. GIẢI TRƯỚC - XUẤT ĐÁP ÁN SAU (ĐÚNG THỨ TỰ FIELD JSON):
   - "idx": giữ nguyên đúng số idx từ câu gốc.
   - "question": đề bài mới với số liệu mới.
   - "explanation": Giải ngắn gọn súc tích (1-3 câu) từ đầu theo số liệu mới ra đáp số chính xác 100% (KHÔNG ghi cứng tên chữ cái đáp án).
   - "options" (cho part_1_choice): 4 phương án A/B/C/D phân biệt (KHÔNG ghi "A. " vào text), chứa ĐÚNG 1 phương án khớp kết quả vừa giải ở "explanation".
   - "subStatements" (cho part_2_true_false): đủ 4 ý a, b, c, d với chân trị true/false chuẩn theo số liệu mới.
   - "shortAnswerKey" (cho part_3_short_answer): Kết quả là 1 số duy nhất (tối đa 4-5 ký tự, ví dụ "12", "2,5", "-0,87"). Nếu kết quả mới là phân số vô hạn, căn thức, $\\\\pi, e$... BẮT BUỘC thêm yêu cầu làm tròn vào cuối "question" như "(kết quả làm tròn đến hàng phần trăm)" hoặc "(hàng phần mười)" và chỉ xuất số thập phân đã làm tròn bằng dấu phẩy vào "shortAnswerKey" & "correctAnswer" (KHÔNG để LaTeX hay phân số trong shortAnswerKey).
   - "correctAnswer": xuất SAU CÙNG khớp 100% đáp số vừa giải.
3. Công thức toán/lý/hóa dùng LaTeX chuẩn bọc trong $...$, véctơ dùng \\\\overrightarrow{AB}, escape \\\\ trong JSON.
Trả về ĐÚNG 1 mảng JSON gồm ${batchItems.length} phần tử.`;

    const callModel = async (model: 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite') => {
      const cfg: Record<string, any> = {
        responseMimeType: 'application/json',
        systemInstruction:
          'Bạn là chuyên gia tạo đề thi tương đương chuẩn GDPT 2018. Luôn đổi mới số liệu/hàm số và tự giải lại chính xác từng bước trước khi xuất options và correctAnswer.',
      };
      if (model.startsWith('gemini-4')) {
        cfg.thinkingConfig = { thinkingLevel: ThinkingLevel.MEDIUM };
      }
      const resp = await Promise.race([
        ai.models.generateContent({
          model,
          contents: prompt,
          config: cfg,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Variant batch timeout')), 38000)
        ),
      ]);
      const parsed = safeParseVariantJson(resp.text || '');
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : [];
      return arr;
    };

    const modelsOrder: Array<'gemini-4-hydrogen' | 'gemini-3.1-flash-lite'> = hydrogenBusy
      ? ['gemini-3.1-flash-lite', 'gemini-4-hydrogen']
      : ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];

    for (const model of modelsOrder) {
      try {
        const res = await callModel(model);
        if (res.length > 0) return res;
      } catch (err: any) {
        const msg = err?.message || String(err);
        if (model.startsWith('gemini-4') && (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand'))) {
          hydrogenBusy = true;
        }
      }
    }
    return [];
  };

  // Run distinct variant sets with bounded concurrency
  const tasks: Array<{ setIndex: number; batch: typeof compactSource }> = [];
  for (let s = 0; s < distinctSetsCount; s++) {
    for (const batch of batches) {
      tasks.push({ setIndex: s, batch });
    }
  }

  const collectedBySet: any[][] = Array.from({ length: distinctSetsCount }, () => []);
  const CONCURRENCY = 4;
  let cursor = 0;
  const worker = async () => {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      const res = await runVariantBatch(task.setIndex, task.batch);
      if (res.length > 0) {
        collectedBySet[task.setIndex].push(...res);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => worker()));

  const finalSets: QuizQuestion[][] = [];
  for (let s = 0; s < distinctSetsCount; s++) {
    if (collectedBySet[s].length > 0) {
      const norm = normalizeRawVariantQuestions(collectedBySet[s], questions, String(102 + s));
      if (areQuestionsMutated(norm, questions)) {
        finalSets.push(norm);
      }
    }
  }

  return finalSets.length > 0 ? finalSets : null;
}

/**
 * Generates 2..20 online exam variants ("Mã đề 101", "Mã đề 102", ...):
 * - Fetches up to 4 distinct AI-rewritten isomorphic question sets (changing numbers/functions/hypotheses
 *   and re-solving each answer accurately), then builds all `targetCount` variants (101..100+targetCount)
 *   with distinct question order & option shuffles across those base sets.
 */
export async function generateOnlineExamVariants(
  params: GenerateVariantsParams
): Promise<GenerateVariantsResult> {
  const {
    questions,
    variantCount,
    subject,
    grade,
    title,
    shuffleQuestions = true,
    shuffleOptions = true,
  } = params;

  const targetCount = Math.min(20, Math.max(2, Number(variantCount) || 2));
  const distinctAiSetsRequested = Math.min(3, targetCount - 1);
  const clientApiKey = getGeminiApiKey();

  let aiQuestionSets: QuizQuestion[][] = [];

  // 1. Try batched server endpoint (/api/ai/generate-exam-variants)
  try {
    const res = await fetch('/api/ai/generate-exam-variants', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(clientApiKey ? { 'x-gemini-api-key': clientApiKey } : {}),
      },
      body: JSON.stringify({
        questions,
        variantCount: targetCount,
        distinctCount: distinctAiSetsRequested,
        subject,
        grade,
        title,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.variants) && data.variants.length > 0) {
        const extracted: QuizQuestion[][] = [];
        data.variants.forEach((rawVariant: any, idx: number) => {
          const rawQs = Array.isArray(rawVariant?.questions)
            ? rawVariant.questions
            : Array.isArray(rawVariant)
            ? rawVariant
            : null;
          if (rawQs && rawQs.length > 0) {
            const norm = normalizeRawVariantQuestions(rawQs, questions, String(102 + idx));
            if (areQuestionsMutated(norm, questions)) {
              extracted.push(norm);
            }
          }
        });
        aiQuestionSets = extracted;
      }
    }
  } catch (err) {
    console.warn('[examVariantsService] Server route failed, trying client direct:', err);
  }

  // 2. Direct client Gemini fallback if server failed/timed out and key is configured
  if (aiQuestionSets.length === 0) {
    const directAi = createDirectGeminiClient(clientApiKey);
    if (directAi) {
      const directSets = await generateVariantsDirectClient(params, directAi, distinctAiSetsRequested);
      if (directSets && directSets.length > 0) {
        aiQuestionSets = directSets;
      }
    }
  }

  const usedAI = aiQuestionSets.length > 0;

  // Pool of base question sets:
  // Index 0 = Original exam (Mã đề 101)
  // Index 1..k = Distinct AI-mutated isomorphic sets
  const baseSetsPool: QuizQuestion[][] = [
    balanceQuizAnswerDistribution(questions, hashStringToSeed(`var_101_${title}_${questions.length}`)),
    ...aiQuestionSets,
  ];

  // Assemble all targetCount variants (Mã 101 .. Mã 100+targetCount)
  const allVariants: OnlineExamVariant[] = [];
  for (let i = 0; i < targetCount; i++) {
    const code = String(101 + i);
    const chosenSet =
      i === 0
        ? baseSetsPool[0]
        : baseSetsPool.length > 1
        ? baseSetsPool[1 + ((i - 1) % (baseSetsPool.length - 1))]
        : baseSetsPool[0];
    allVariants.push(
      cloneAndShuffleQuestions(chosenSet, code, i + 1, shuffleQuestions, shuffleOptions)
    );
  }

  if (usedAI) {
    return {
      variants: allVariants,
      usedAI: true,
      aiVariantSetsCount: aiQuestionSets.length,
      totalVariantCount: targetCount,
      notice:
        targetCount > aiQuestionSets.length + 1
          ? `AI đã biến đổi số liệu tạo ${aiQuestionSets.length} bộ đề tương đương mới (+ đề gốc) và trộn thành ${targetCount} mã đề riêng.`
          : `AI đã biên soạn ${aiQuestionSets.length} mã đề tương đương đổi số liệu hoàn toàn mới và trộn ngẫu nhiên.`,
    };
  }

  return {
    variants: allVariants,
    usedAI: false,
    aiVariantSetsCount: 0,
    totalVariantCount: targetCount,
    notice:
      'Chưa kết nối được AI để đổi số liệu (kiểm tra Gemini API Key). Hệ thống tạm tạo các mã đề xáo trộn độc lập từ đề gốc.',
  };
}
