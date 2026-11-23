import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { OnlineExamVariant, QuizQuestion } from '../types';
import {
  balanceQuizAnswerDistribution,
  hashStringToSeed,
  inferPartType,
  mulberry32,
  shuffleQuestionOptionsOnly,
  shuffleQuestionsWithinParts,
} from './quizDistribution';
import {
  createDirectGeminiClient,
  getGeminiApiKey,
  sanitizeQuizQuestionMath,
} from './geminiClient';

export interface GenerateVariantsParams {
  questions: QuizQuestion[];
  variantCount: number; // 2, 3, or 4
  subject: string;
  grade: string;
  title: string;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
}

export interface GenerateVariantsResult {
  variants: OnlineExamVariant[];
  usedAI: boolean;
  notice?: string;
}

function safeParseVariantJson(raw: string): any {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      const fixed = cleaned.replace(/(?<!\\)\\(?!["\\/bfnrtu]|u[0-9a-fA-F]{4})/g, '\\\\');
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

function buildAlgorithmicFallbackVariant(
  sourceQuestions: QuizQuestion[],
  variantIndex: number,
  code: string,
  shuffleQuestions: boolean,
  shuffleOptions: boolean
): OnlineExamVariant {
  const seed = hashStringToSeed(`fallback_var_${code}_${variantIndex}_${sourceQuestions.length}`);
  const rng = mulberry32(seed);

  let cloned: QuizQuestion[] = sourceQuestions.map((q, idx) => ({
    ...q,
    id: `${q.id || `q_${idx + 1}`}_v${code}`,
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

function normalizeVariantQuestions(
  rawList: any[],
  templateQuestions: QuizQuestion[],
  code: string,
  shuffleQuestions: boolean,
  shuffleOptions: boolean
): QuizQuestion[] {
  const normalized: QuizQuestion[] = templateQuestions.map((tmpl, idx) => {
    const raw = rawList[idx];
    if (!raw || typeof raw !== 'object' || !raw.question) {
      return {
        ...tmpl,
        id: `${tmpl.id || `q_${idx + 1}`}_v${code}`,
      };
    }

    const partType = inferPartType(tmpl);
    const cleaned = sanitizeQuizQuestionMath({
      ...tmpl,
      ...raw,
      id: `${tmpl.id || `q_${idx + 1}`}_v${code}`,
      partType,
      partLabel: raw.partLabel || tmpl.partLabel,
      diagramType: raw.diagramType || tmpl.diagramType,
      diagramData: raw.diagramData || tmpl.diagramData,
      timeLimit: Number(raw.timeLimit) || tmpl.timeLimit || 30,
      difficulty: raw.difficulty || tmpl.difficulty || 'Thông hiểu',
    });

    if (partType === 'part_1_choice') {
      const opts = Array.isArray(cleaned.options) && cleaned.options.length >= 4
        ? cleaned.options.slice(0, 4).map((o: any, oIdx: number) => ({
            key: String(o?.key || ['A', 'B', 'C', 'D'][oIdx] || 'A').toUpperCase(),
            text: typeof o === 'string' ? o : String(o?.text || `Phương án ${oIdx + 1}`),
          }))
        : tmpl.options;
      cleaned.options = opts;
      cleaned.correctAnswer = String(cleaned.correctAnswer || tmpl.correctAnswer || 'A')
        .trim()
        .toUpperCase();
    } else if (partType === 'part_2_true_false') {
      const subs =
        Array.isArray(cleaned.subStatements) && cleaned.subStatements.length > 0
          ? cleaned.subStatements.map((s: any, sIdx: number) => {
              const label = String(s.label || s.key || ['a', 'b', 'c', 'd'][sIdx] || sIdx + 1);
              const statement = String(s.statement || s.text || '');
              const correct =
                typeof s.correct === 'boolean'
                  ? s.correct
                  : typeof s.isCorrect === 'boolean'
                  ? s.isCorrect
                  : true;
              return {
                id: `sub_${code}_${idx}_${sIdx}`,
                key: label,
                label,
                statement,
                text: statement,
                correct,
                isCorrect: correct,
              };
            })
          : tmpl.subStatements;
      cleaned.subStatements = subs;
      cleaned.options = [];
      cleaned.correctAnswer = (subs || [])
        .map((s: any) => `${s.label}:${s.correct ? 'Đ' : 'S'}`)
        .join(', ');
    } else if (partType === 'part_3_short_answer') {
      cleaned.options = [];
      const key = String(cleaned.shortAnswerKey || cleaned.correctAnswer || tmpl.shortAnswerKey || '');
      cleaned.shortAnswerKey = key;
      cleaned.correctAnswer = key;
    } else {
      cleaned.options = [];
    }

    return cleaned as QuizQuestion;
  });

  const seed = hashStringToSeed(`norm_var_${code}_${normalized.length}`);
  let finalQuestions = balanceQuizAnswerDistribution(normalized, seed);
  if (shuffleQuestions) {
    finalQuestions = shuffleQuestionsWithinParts(finalQuestions, mulberry32(seed + 17));
  }
  if (shuffleOptions) {
    finalQuestions = finalQuestions.map((q, idx) =>
      shuffleQuestionOptionsOnly(q, mulberry32(seed + (idx + 1) * 3571))
    );
  }
  return finalQuestions;
}

async function generateVariantsDirectClient(
  params: GenerateVariantsParams,
  ai: GoogleGenAI
): Promise<OnlineExamVariant[] | null> {
  const {
    questions,
    variantCount,
    subject,
    grade,
    title,
    shuffleQuestions = true,
    shuffleOptions = true,
  } = params;

  const extraCount = Math.min(3, Math.max(1, variantCount - 1));
  const compactSource = questions.slice(0, 35).map((q, i) => ({
    idx: i + 1,
    partType: inferPartType(q),
    question: q.question,
    options: q.options,
    subStatements: q.subStatements,
    shortAnswerKey: q.shortAnswerKey,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
  }));

  const prompt = `Bạn là Chuyên gia Khảo thí Bộ GD&ĐT Việt Nam.
Dưới đây là ĐỀ GỐC ("${title}", môn ${subject}, ${grade}) gồm ${compactSource.length} câu hỏi:
${JSON.stringify(compactSource)}

Hãy tạo thêm ${extraCount} MÃ ĐỀ TƯƠNG ĐƯƠNG (cùng dạng toán/kiến thức, cùng độ khó, cùng cấu trúc các phần, NHƯNG thay đổi số liệu/hàm số/giả thiết/mệnh đề/bối cảnh tương đương để học sinh không quay cóp hay trao đổi đáp án với nhau).

QUY TẮC BẮT BUỘC:
1. Mỗi mã đề mới phải giữ nguyên đủ ${compactSource.length} câu theo đúng thứ tự partType tương ứng với đề gốc.
2. Tính toán lại chính xác 100% đáp án đúng và lời giải chi tiết cho số liệu mới.
3. Với câu Phần I (part_1_choice), phân bổ ĐỀU các đáp án đúng A, B, C, D (tuyệt đối không dồn vào một chữ cái).
4. Công thức Toán/Lý/Hóa bọc trong $...$, dùng \\overrightarrow{AB} cho véctơ, escape \\\\ trong JSON.
5. Trả về đúng JSON object: { "variants": [ { "questions": [...] }, ... ] } gồm đúng ${extraCount} phần tử trong mảng "variants".`;

  const models = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
  for (const model of models) {
    try {
      const cfg: Record<string, any> = {
        responseMimeType: 'application/json',
      };
      if (model.startsWith('gemini-4')) {
        cfg.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }
      const resp = await ai.models.generateContent({
        model,
        contents: prompt,
        config: cfg,
      });
      const parsed = safeParseVariantJson(resp.text || '');
      const list = Array.isArray(parsed?.variants)
        ? parsed.variants
        : Array.isArray(parsed)
        ? parsed
        : null;
      if (list && list.length > 0) {
        const result: OnlineExamVariant[] = [];
        for (let i = 0; i < extraCount; i++) {
          const code = String(102 + i);
          const itemQuestions = Array.isArray(list[i]?.questions)
            ? list[i].questions
            : Array.isArray(list[i])
            ? list[i]
            : null;
          if (itemQuestions && itemQuestions.length > 0) {
            result.push({
              id: `var_${code}`,
              code,
              label: `Mã đề ${code}`,
              questions: normalizeVariantQuestions(
                itemQuestions,
                questions,
                code,
                shuffleQuestions,
                shuffleOptions
              ),
            });
          } else {
            result.push(
              buildAlgorithmicFallbackVariant(
                questions,
                i + 1,
                code,
                shuffleQuestions,
                shuffleOptions
              )
            );
          }
        }
        return result;
      }
    } catch (err) {
      console.warn(`[examVariantsService] Direct Gemini ${model} error:`, err);
    }
  }
  return null;
}

/**
 * Creates 2..4 online exam variants ("Mã đề 101", "Mã đề 102", ...):
 * - Mã đề 101 is based on the teacher's balanced/shuffled original exam.
 * - Mã đề 102..104 are AI-generated similar isomorphic variants + shuffled order/options.
 * - Guaranteed non-blocking fallback if backend/AI is temporarily unavailable.
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

  const targetCount = Math.min(4, Math.max(2, Number(variantCount) || 2));

  // Mã đề 101 = original exam with balanced A/B/C/D + optional shuffle
  const baseSeed = hashStringToSeed(`var_101_${title}_${questions.length}`);
  let baseQuestions = balanceQuizAnswerDistribution(questions, baseSeed);
  if (shuffleQuestions) {
    baseQuestions = shuffleQuestionsWithinParts(baseQuestions, mulberry32(baseSeed + 5));
  }
  if (shuffleOptions) {
    baseQuestions = baseQuestions.map((q, idx) =>
      shuffleQuestionOptionsOnly(q, mulberry32(baseSeed + (idx + 1) * 2971))
    );
  }
  const variant101: OnlineExamVariant = {
    id: 'var_101',
    code: '101',
    label: 'Mã đề 101',
    questions: baseQuestions.map((q, idx) => ({
      ...q,
      id: `${q.id || `q_${idx + 1}`}_v101`,
    })),
  };

  const extraNeeded = targetCount - 1;
  const clientApiKey = getGeminiApiKey();

  // 1. Try server endpoint first
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
        subject,
        grade,
        title,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.variants) && data.variants.length > 0) {
        const extraVariants: OnlineExamVariant[] = [];
        for (let i = 0; i < extraNeeded; i++) {
          const code = String(102 + i);
          const rawVariant = data.variants[i];
          const rawQs = Array.isArray(rawVariant?.questions)
            ? rawVariant.questions
            : Array.isArray(rawVariant)
            ? rawVariant
            : null;
          if (rawQs && rawQs.length > 0) {
            extraVariants.push({
              id: `var_${code}`,
              code,
              label: `Mã đề ${code}`,
              questions: normalizeVariantQuestions(
                rawQs,
                questions,
                code,
                shuffleQuestions,
                shuffleOptions
              ),
            });
          } else {
            extraVariants.push(
              buildAlgorithmicFallbackVariant(
                questions,
                i + 1,
                code,
                shuffleQuestions,
                shuffleOptions
              )
            );
          }
        }
        return {
          variants: [variant101, ...extraVariants],
          usedAI: true,
        };
      }
    }
  } catch (err) {
    console.warn('[examVariantsService] Server route fallback:', err);
  }

  // 2. Fallback to direct client Gemini if user supplied personal API key
  const directAi = createDirectGeminiClient(clientApiKey);
  if (directAi) {
    const directResult = await generateVariantsDirectClient(params, directAi);
    if (directResult && directResult.length > 0) {
      return {
        variants: [variant101, ...directResult],
        usedAI: true,
      };
    }
  }

  // 3. Guaranteed algorithmic shuffled variants fallback
  const fallbackExtras: OnlineExamVariant[] = [];
  for (let i = 0; i < extraNeeded; i++) {
    fallbackExtras.push(
      buildAlgorithmicFallbackVariant(
        questions,
        i + 1,
        String(102 + i),
        shuffleQuestions,
        shuffleOptions
      )
    );
  }

  return {
    variants: [variant101, ...fallbackExtras],
    usedAI: false,
    notice: 'Đã tạo các mã đề trộn độc lập từ đề gốc.',
  };
}
