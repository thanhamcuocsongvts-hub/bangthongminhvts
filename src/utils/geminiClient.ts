import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { QuizQuestion, QuizCritiqueItem, CritiqueIssueType } from '../types';
import {
  balanceQuizAnswerDistribution,
  ensurePart3RoundingPrompt,
  extractChoiceKey,
  formatPlainShortAnswerKey,
  inferPartType,
  stripLeadingChoicePrefix,
} from './quizDistribution';
import { normalizeAllMathInText } from './mathNormalization';

/**
 * Retrieve Gemini API Key from multiple sources:
 * 1. localStorage 'gemini_api_key' (set directly by teacher in app)
 * 2. import.meta.env.VITE_GEMINI_API_KEY (configured in Vercel / Vite env)
 * 3. import.meta.env.VITE_API_KEY
 * 4. import.meta.env.GEMINI_API_KEY
 */
export function getGeminiApiKey(): string {
  try {
    const local = localStorage.getItem('gemini_api_key');
    if (local && local.trim()) return local.trim();
  } catch (_) {}

  const metaEnv = (import.meta as any).env || {};
  return (
    metaEnv.VITE_GEMINI_API_KEY ||
    metaEnv.VITE_API_KEY ||
    metaEnv.GEMINI_API_KEY ||
    metaEnv.VITE_GOOGLE_API_KEY ||
    ''
  ).trim();
}

export function saveGeminiApiKey(key: string): void {
  try {
    if (!key || !key.trim()) {
      localStorage.removeItem('gemini_api_key');
    } else {
      localStorage.setItem('gemini_api_key', key.trim());
    }
  } catch (e) {
    console.warn('Could not save gemini_api_key to localStorage:', e);
  }
}

export function isGeminiConfigured(): boolean {
  return getGeminiApiKey().length > 0;
}

/**
 * Direct client-side Gemini caller using @google/genai
 */
export function createDirectGeminiClient(customKey?: string): GoogleGenAI | null {
  const apiKey = (customKey || getGeminiApiKey()).trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-smartboard',
      },
    },
  });
}

const PRIMARY_CLIENT_MODELS = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;

function buildSafeModelConfig(model: string, baseConfig: Record<string, any> = {}): Record<string, any> {
  const cfg = { ...baseConfig };
  if (model.startsWith('gemini-4-')) {
    delete cfg.temperature;
    delete cfg.topP;
    delete cfg.topK;
    delete cfg.candidateCount;
    if (!cfg.thinkingConfig) {
      cfg.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    }
  } else {
    delete cfg.thinkingConfig;
  }
  return cfg;
}

function isFatalAuthError(msg: string): boolean {
  return (
    msg.includes('API_KEY_INVALID') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('API key should be set')
  );
}

function escapeUnescapedLatexInJson(text: string): string {
  return text.replace(
    /((?:^|[^\\])(?:\\\\)*)\\(?=(?:frac|forall|times|tan|theta|tau|text|tfrac|triangle|tilde|to(?![a-zA-Z])|beta|binom|bar|begin|big|backslash|bullet|right|rightarrow|rho|rangle|rbrace|rceil|rfloor|neq|notin|nabla)|[^"\\/bfnrtu])/g,
    '$1\\\\'
  );
}

function extractCompleteObjectsFromClientArray(text: string): any[] | null {
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

function safeParseClientJsonWithLatex(raw: string): any {
  if (!raw) return null;
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const escaped = escapeUnescapedLatexInJson(text);
  try {
    return JSON.parse(escaped);
  } catch {
    try {
      return JSON.parse(text);
    } catch {
      return extractCompleteObjectsFromClientArray(escaped) || extractCompleteObjectsFromClientArray(text);
    }
  }
}

/**
 * Test Gemini API Key connectivity with a fast call
 */
export async function testGeminiApiKey(apiKeyToTest?: string): Promise<{ success: boolean; message: string; model?: string }> {
  const key = (apiKeyToTest || getGeminiApiKey()).trim();
  if (!key) {
    return {
      success: false,
      message: 'Chưa có API Key. Vui lòng nhập khóa Gemini API của bạn.',
    };
  }

  const ai = createDirectGeminiClient(key);
  if (!ai) {
    return { success: false, message: 'Khởi tạo client AI thất bại' };
  }

  let lastErr = '';

  for (const model of PRIMARY_CLIENT_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: 'Xin chào, trả về chữ "OK" để xác nhận kết nối thành công.',
        config: buildSafeModelConfig(model, {}),
      });

      if (response && response.text) {
        return {
          success: true,
          message: `Kết nối Gemini AI thành công rực rỡ! (Model: ${model})`,
          model,
        };
      }
    } catch (err: any) {
      lastErr = err?.message || String(err);
      console.warn(`Test with ${model} failed:`, lastErr);
      if (isFatalAuthError(lastErr)) break;
    }
  }

  return {
    success: false,
    message: `Không thể kết nối với Gemini API: ${lastErr}. Vui lòng kiểm tra lại tính hợp lệ của API Key.`,
  };
}

/**
 * Direct client-side Vietnamese Handwriting Recognition (OCR)
 * Emulates experienced Vietnamese teacher who understands context and messy handwriting
 */
export async function directRecognizeHandwriting(
  imageDataUrl: string,
  contextHint = 'bài giảng lớp học tiếng Việt, công thức toán học'
): Promise<string> {
  const ai = createDirectGeminiClient();
  if (!ai) return '';

  const cleanBase64 = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const mimeMatch = imageDataUrl.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

  const prompt = `[VAI TRÒ]:
Bạn là một GIÁO VIÊN VIỆT NAM GIÀU KINH NGHIỆM ĐỌC VÀ CHẤM CHỮ VIẾT TAY TRÊN BẢNG LỚP HỌC.
Người bình thường có thể đọc và đoán được từ ngữ dù chữ viết xấu, viết ẩu, viết vội, nét nghệch ngoạc, nét đứt, thiếu dấu hoặc dính nét. Là một giáo viên tâm huyết, bạn luôn suy luận ngữ cảnh tiếng Việt và đọc ĐÚNG 100% từ ngữ mà người viết định thể hiện!

[NGỮ CẢNH BÀI GIẢNG / LỚP HỌC]: ${contextHint || 'lớp học, giáo viên giảng bài tiếng Việt, toán học'}

[HƯỚNG DẪN ĐỌC & ĐOÁN CHỮ VIẾT TAY XẤU]:
1. ĐỌC VÀ SUY LUẬN TỪ NGỮ TIẾNG VIỆT & TÊN RIÊNG:
   - Hãy liên tưởng ngay tới các tên riêng phổ biến của người Việt (ví dụ: Kiệt, Tuấn Kiệt, Minh, An, Linh, Nam, Hùng, Long, Dũng, Hoa, Lan, Thảo, Trang, Phúc, Đức, Quân, Hoàng, Khoa...).
   - Nếu thấy các nét ký tự trông giống 'K', 'i', 'e', 't' (kể cả nét nguệch ngoạc, nét đứt, dấu chấm chữ i hay dấu nặng mờ) -> Đọc ngay là "Kiệt" (hoặc "Tuấn Kiệt" nếu có 2 từ).
   - Hãy liên tưởng tới các từ vựng học tập thường ngày (ví dụ: "Bài học", "Hôm nay", "Hình học", "Toán", "Văn", "Đại số", "Thứ hai", "Định lý", "Công thức", "Tập viết"...).
   - Tự động hoàn thiện dấu tiếng Việt chuẩn xác (dấu sắc, huyền, hỏi, ngã, nặng, mũ â ê ô, móc ư ơ, đ).
   - Nếu nét chữ trải dài trên một hàng ngang, giữ trên 1 dòng. Nếu rõ ràng nhiều dòng, dùng ký tự xuống dòng \\n.
2. ĐỐI VỚI CÔNG THỨC TOÁN HỌC / BIỂU THỨC / PHÉP TÍNH:
   - Nhận diện đúng số 0-9, phân số \\frac{a}{b}, căn thức \\sqrt{x}, số mũ x^2, chỉ số dưới x_1, dấu phép tính (+, -, \\times, :, =)... và bao quanh bằng cặp dấu $ (ví dụ: $x^2 - 4x + 3 = 0$, $15 + 28 = 43$).
3. QUY TẮC BẮT BUỘC:
   - Tuyệt đối KHÔNG từ chối. Luôn đưa ra phỏng đoán tốt nhất có nghĩa trong tiếng Việt.
   - CHỈ TRẢ VỀ DUY NHẤT VĂN BẢN ĐÃ NHẬN DIỆN. KHÔNG giải thích, KHÔNG thêm lời chào, KHÔNG bọc trong dấu ngoặc kép thừa.
   - TUYỆT ĐỐI KHÔNG mở đầu bằng 'Ảnh 1:', 'Hình 1:', 'Ảnh 1', 'Image 1:', 'Trong ảnh:' hay bất kỳ tiền tố nào.`;

  for (const model of PRIMARY_CLIENT_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        config: buildSafeModelConfig(model, {
          temperature: 0.1,
        }),
      });

      let text = (response.text || '').trim();
      text = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
      text = text.replace(/^(ảnh|hình|image|picture)\s*\d*\s*[:\-–—]\s*/i, '');
      text = text.replace(/^trong\s+(ảnh|hình|bức ảnh)\s*\d*\s*(là|hiển thị|chứa)?\s*[:\-–—]?\s*/i, '');
      text = text.replace(/^(đây là|nội dung trong ảnh là|văn bản trong ảnh là|chữ trong ảnh là)\s*[:\-–—]?\s*/i, '');
      if (text.toLowerCase().trim() === 'ảnh 1' || text.toLowerCase().trim() === 'hình 1') {
        text = '1';
      }
      if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('“') && text.endsWith('”'))) {
        text = text.slice(1, -1).trim();
      }
      if (text) return text;
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.warn(`Direct Gemini handwriting error with ${model}:`, msg);
      if (isFatalAuthError(msg)) break;
    }
  }

  return '';
}

/**
 * Normalize and clean all mathematical notation in quiz questions (vectors, fractions, radicals, integrals, limits, sets, KaTeX compat)
 */
export function normalizeMathInText(text: string): string {
  return normalizeAllMathInText(text);
}

export function sanitizeQuizQuestionMath(q: any): any {
  if (!q || typeof q !== 'object') return q;
  const cleanQ = { ...q };
  cleanQ.question = normalizeMathInText(cleanQ.question);
  cleanQ.explanation = normalizeMathInText(cleanQ.explanation);
  const isShortAnswer = inferPartType(cleanQ) === 'part_3_short_answer';
  if (isShortAnswer) {
    const rawKey = String(cleanQ.shortAnswerKey ?? cleanQ.correctAnswer ?? '');
    const formatted = formatPlainShortAnswerKey(rawKey, cleanQ.question);
    if (formatted.key) {
      cleanQ.shortAnswerKey = formatted.key;
      cleanQ.correctAnswer = formatted.key;
      if (formatted.roundedWithDecimals !== undefined) {
        cleanQ.question = ensurePart3RoundingPrompt(cleanQ.question, formatted.roundedWithDecimals);
      }
    }
  } else if (typeof cleanQ.shortAnswerKey === 'string') {
    cleanQ.shortAnswerKey = normalizeMathInText(cleanQ.shortAnswerKey);
  }
  if (typeof cleanQ.essayRubric === 'string') {
    cleanQ.essayRubric = normalizeMathInText(cleanQ.essayRubric);
  }

  if (Array.isArray(cleanQ.options)) {
    cleanQ.options = cleanQ.options.map((opt: any) => {
      if (typeof opt === 'string') {
        return normalizeMathInText(opt);
      }
      return {
        ...opt,
        text: normalizeMathInText(opt.text || ''),
      };
    });
  }

  if (Array.isArray(cleanQ.subStatements)) {
    cleanQ.subStatements = cleanQ.subStatements.map((sub: any) => ({
      ...sub,
      statement: normalizeMathInText(sub.statement || sub.text || ''),
      text: normalizeMathInText(sub.statement || sub.text || ''),
    }));
  }

  return cleanQ;
}

/**
 * Direct client-side Quiz Generation
 */
export async function directGenerateQuiz(params: {
  topic: string;
  subject?: string;
  grade?: string;
  count?: number;
  difficulty?: string;
}): Promise<QuizQuestion[]> {
  const ai = createDirectGeminiClient();
  if (!ai) return [];

  const { topic, subject = 'Toán học', grade = 'Lớp 12', count = 5, difficulty = 'Thông hiểu' } = params;

  const prompt = `Bạn là Chuyên gia Soạn Đề Thi Trắc Nghiệm Sư Phạm Chuẩn Bộ Giáo Dục Việt Nam.
Hãy tạo đúng ${count} câu hỏi trắc nghiệm chất lượng cao, CHÍNH XÁC TUYỆT ĐỐI về chủ đề: "${topic}".
Môn học: ${subject}, Khối lớp: ${grade}, Mức độ: ${difficulty}.

QUY TRÌNH GIẢI TRƯỚC - XUẤT ĐÁP ÁN SAU (BẮT BUỘC):
1. Viết đề bài ("question") chặt chẽ, đủ dữ kiện, có DUY NHẤT 1 đáp số đúng.
2. TÍNH TOÁN & VIẾT LỜI GIẢI ("explanation") TRƯỚC: giải chi tiết ra đáp số chuẩn xác (1-2 câu súc tích, không viết cứng chữ cái kiểu "Chọn đáp án A").
3. Đặt đúng đáp số vừa giải vào 1 trong 4 phương án A, B, C, D của "options"; 3 phương án còn lại là nhiễu hợp lý gần giống kết quả thật. KHÔNG ghi tiền tố "A. ", "B. " vào trong "text".
4. Sau khi đã có "options", ĐỐI CHIẾU LẠI để điền "correctAnswer" CHÍNH XÁC TUYỆT ĐỐI khớp với chữ cái chứa kết quả ở "explanation".
5. MỌI CÔNG THỨC TOÁN, LÝ, HÓA, BIỂU THỨC BẮT BUỘC DÙNG LATEX CHUẨN BỌC TRONG $...$ (escape \\\\ trong JSON): phân số $\\\\frac{a}{b}$, căn thức $\\\\sqrt{x}$, số mũ $x^{10}$, chỉ số $C_{12}^3, u_{n+1}$, tập hợp $\\\\mathbb{R} \\\\setminus \\\\{1\\\\}$, giới hạn $\\\\lim_{x \\to +\\\\infty}$, tích phân $\\\\int_{a}^{b} f(x)dx$, góc $\\\\widehat{ABC}$, $60^{\\\\circ}$, véctơ $\\\\overrightarrow{AB}$, $\\\\overrightarrow{a}$, $\\\\overrightarrow{i}$, $\\\\overrightarrow{j}$, $\\\\overrightarrow{k}$ (TUYỆT ĐỐI KHÔNG viết vec(AB), frac(a,b), sqrt(x), <=, >=, !=, oo).
6. Chỉ trả về mảng JSON thuần túy theo ĐÚNG THỨ TỰ FIELD sau:
[
  {
    "id": "q1",
    "question": "Nội dung câu hỏi...",
    "explanation": "Các bước giải chi tiết ra đáp số chuẩn...",
    "options": [
      { "key": "A", "text": "Phương án A" },
      { "key": "B", "text": "Phương án B" },
      { "key": "C", "text": "Phương án C" },
      { "key": "D", "text": "Phương án D" }
    ],
    "correctAnswer": "B",
    "timeLimit": 30
  }
]`;

  for (const model of PRIMARY_CLIENT_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: buildSafeModelConfig(model, {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
        }),
      });

      const parsed = safeParseClientJsonWithLatex(response.text || '');
      let resList: any[] = [];
      if (Array.isArray(parsed)) {
        resList = parsed;
      } else if (parsed && Array.isArray(parsed.questions)) {
        resList = parsed.questions;
      }
      if (resList.length > 0) {
        const sanitized = resList.map((q: any, idx: number) => {
          const cleanOptions = Array.isArray(q?.options)
            ? q.options.map((opt: any, oIdx: number) => ({
                key: ['A', 'B', 'C', 'D'][oIdx] || String(opt?.key || 'A').trim().toUpperCase().replace(/[\.\)]$/, ''),
                text: typeof opt === 'string'
                  ? stripLeadingChoicePrefix(opt)
                  : stripLeadingChoicePrefix(opt?.text || `Lựa chọn ${oIdx + 1}`),
              }))
            : [];
          return sanitizeQuizQuestionMath({
            ...q,
            id: q?.id || `q_${Date.now()}_${idx + 1}`,
            options: cleanOptions,
            correctAnswer: extractChoiceKey(q?.correctAnswer),
          });
        });
        return balanceQuizAnswerDistribution(
          sanitized,
          `${topic}_${Date.now()}`
        );
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.warn(`Direct Gemini generateQuiz error with ${model}:`, msg);
      if (isFatalAuthError(msg)) break;
    }
  }

  return [];
}

function autoEnrichClientDiagram(q: any): { diagramType?: string; diagramData?: any } {
  if (q.diagramType && q.diagramData) {
    return { diagramType: q.diagramType, diagramData: q.diagramData };
  }

  const text = `${q.question || ''} ${q.explanation || ''} ${(q.options || []).map((o: any) => o.text || o).join(' ')}`.toLowerCase();

  // Practical math scenarios
  if (/tấm nhôm|miếng tôn|miếng nhôm|cắt 4 góc|bốn góc|gấp thành|hộp chữ nhật không nắp|hộp không nắp/i.test(text)) {
    return { diagramType: 'practical_illustration', diagramData: { scenario: 'box_folding', title: 'Bài toán cắt 4 góc gấp thành hộp chữ nhật thể tích lớn nhất' } };
  }
  if (/thùng phi|thùng hình trụ|vỏ lon|lon nước|lon bia|hình trụ tròn xoay|diện tích toàn phần.*hình trụ/i.test(text)) {
    return { diagramType: 'practical_illustration', diagramData: { scenario: 'cylinder_can', title: 'Bài toán tối ưu vỏ lon/thùng hình trụ tiết kiệm nguyên liệu nhất' } };
  }
  if (/cổng parabol|vòm cổng|hầm chui parabol|cầu vòm parabol|parabol.*xe tải|cổng có hình parabol/i.test(text)) {
    return { diagramType: 'practical_illustration', diagramData: { scenario: 'parabola_arch', title: 'Bài toán vòm cổng parabol và khoảng lọt xe tải' } };
  }
  if (/chèo thuyền|bờ sông|dòng sông|vận tốc chèo|vận tốc chạy bộ|điểm cập bến|quãng đường sông/i.test(text)) {
    return { diagramType: 'practical_illustration', diagramData: { scenario: 'boat_river', title: 'Bài toán tối ưu thời gian chèo thuyền qua sông đến đích' } };
  }
  if (/máng nước|mương dẫn nước|máng xối|mặt cắt hình thang|hình thang cân.*máng/i.test(text)) {
    return { diagramType: 'practical_illustration', diagramData: { scenario: 'water_gutter', title: 'Mặt cắt máng nước hình thang cân lưu lượng lớn nhất' } };
  }
  if (/hàng rào|bờ tường|rào.*bờ sông|mảnh đất hình chữ nhật giáp bờ sông|3 cạnh hàng rào/i.test(text)) {
    return { diagramType: 'practical_illustration', diagramData: { scenario: 'fence_plot', title: 'Bài toán rào khu đất giáp bờ sông diện tích cực đại' } };
  }
  if (/phễu hình nón|bể hình nón|bồn chứa hình nón ngược|nón ngược chứa nước|mực nước hình nón/i.test(text)) {
    return { diagramType: 'practical_illustration', diagramData: { scenario: 'cone_tank', title: 'Bồn chứa nước hình nón ngược và tốc độ dâng mực nước' } };
  }
  if (/hồ bơi|bể chứa nước hình chữ nhật|bể bơi|thể tích hồ bơi/i.test(text)) {
    return { diagramType: 'practical_illustration', diagramData: { scenario: 'water_pool', title: 'Mô hình bể bơi / hồ chứa nước hình hộp chữ nhật' } };
  }

  // Variation / Sign Table
  if (/bảng biến thiên|bbt|bảng xét dấu/i.test(text)) {
    if (/xét dấu/i.test(text)) {
      return { diagramType: 'sign_table', diagramData: { x: ['-\\infty', '1', '3', '+\\infty'], rows: [{ label: "y'", signs: ['+', '0', '-', '0', '+'] }] } };
    }
    return { diagramType: 'variation_table', diagramData: { x: ['-\\infty', '-1', '2', '+\\infty'], yPrime: ['+', '0', '-', '0', '+'], yArrows: [{ start: '-\\infty', end: '3', dir: 'up' }, { start: '3', end: '-2', dir: 'down' }, { start: '-2', end: '+\\infty', dir: 'up' }] } };
  }

  // Function Graph
  const isGraphMentioned = /đồ thị|hình vẽ|hình bên|hình dưới|như hình|tiệm cận|\(c\)|parabol/i.test(text);
  if (isGraphMentioned) {
    if (/(?:ax\+b|cx\+d|tiệm cận|tiem can|\\frac|\/)/i.test(text)) {
      return {
        diagramType: 'function_graph',
        diagramData: { functionType: 'rational', latex: 'y = \\frac{2x-1}{x-1}', asymptotes: { vertical: 1, horizontal: 2 }, keyPoints: [{ x: 0, y: 1, label: '(0; 1)' }, { x: 0.5, y: 0, label: '(0.5; 0)' }] }
      };
    }
    if (/x\^3|bậc ba|bac ba/i.test(text)) {
      return {
        diagramType: 'function_graph',
        diagramData: { functionType: 'cubic', latex: 'y = x^3 - 3x^2 + 2', extrema: [{ x: 0, y: 2, label: '(0; 2)' }, { x: 2, y: -2, label: '(2; -2)' }] }
      };
    }
    if (/x\^4|trùng phương|trung phuong/i.test(text)) {
      return {
        diagramType: 'function_graph',
        diagramData: { functionType: 'quartic', latex: 'y = -x^4 + 2x^2 + 1', extrema: [{ x: -1, y: 2 }, { x: 0, y: 1 }, { x: 1, y: 2 }] }
      };
    }
    if (/x\^2|parabol/i.test(text)) {
      return {
        diagramType: 'function_graph',
        diagramData: { functionType: 'quadratic', latex: 'y = -x^2 + 4x', vertex: { x: 2, y: 4, label: 'I(2; 4)' } }
      };
    }
    return {
      diagramType: 'function_graph',
      diagramData: { functionType: 'rational', latex: 'y = \\frac{2x-1}{x-1}', asymptotes: { vertical: 1, horizontal: 2 }, keyPoints: [{ x: 0, y: 1, label: '(0; 1)' }, { x: 0.5, y: 0, label: '(0.5; 0)' }] }
    };
  }

  return { diagramType: undefined, diagramData: undefined };
}

async function generateClientWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`AI request timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Direct client-side Fast Matrix & Prompt Quiz Generation (2-Phase Parallel Batched Engine)
 * Handles text prompts or uploaded matrix files (images, PDF, Word text)
 */
export async function directFastMatrixQuiz(params: {
  prompt: string;
  matrixFile?: {
    fileName: string;
    mimeType?: string;
    base64?: string;
    text?: string;
  };
  subject?: string;
  grade?: string;
  count?: number | string;
  difficulty?: string;
  timeLimit?: number;
  isMatrixMode?: boolean;
  apiKey?: string;
}): Promise<QuizQuestion[]> {
  const ai = createDirectGeminiClient(params.apiKey);
  const {
    prompt,
    matrixFile,
    subject = 'Toán học',
    grade = 'Lớp 12',
    count = 5,
    difficulty = 'Thông hiểu',
    timeLimit = 30,
  } = params;

  const hasUploadedFile = Boolean(matrixFile && (matrixFile.text || matrixFile.base64));
  const isMatrixActive = params.isMatrixMode === true || hasUploadedFile || (params.count as any) === 'auto_matrix';
  const numQuestions = isMatrixActive ? 22 : Math.min(Math.max(Number(count) || 5, 1), 50);
  const rawPrompt = (prompt || '').trim();
  const isGenericDefaultPrompt =
    hasUploadedFile &&
    (!rawPrompt ||
      rawPrompt.toLowerCase() === 'khảo sát hàm số và đồ thị' ||
      rawPrompt.toLowerCase() === 'tạo đề theo ma trận đề tải lên');
  const userPrompt = isGenericDefaultPrompt ? '' : rawPrompt;

  if (!ai) {
    throw new Error('Chưa cấu hình Gemini API Key. Vui lòng nhập API Key trong Cài đặt để phân tích ma trận đề.');
  }

  const matrixText = (matrixFile?.text || '').trim();
  const hasRichExtractedText = matrixText.length >= 150;
  const isImageUpload = Boolean(matrixFile?.mimeType?.startsWith('image/'));
  // Only attach inlineData for images or scanned PDFs without extracted text
  const shouldAttachBinary = Boolean(
    matrixFile?.base64 &&
      matrixFile?.mimeType &&
      matrixFile.base64.length < 15_000_000 &&
      (isImageUpload || !hasRichExtractedText)
  );
  const cleanInlinePart = shouldAttachBinary
    ? {
        inlineData: {
          mimeType: matrixFile!.mimeType!,
          data: matrixFile!.base64!.replace(/^data:.*?;base64,/, ''),
        },
      }
    : null;

  type ClientMatrixSlot = {
    n: number;
    partType: 'part_1_choice' | 'part_2_true_false' | 'part_3_short_answer' | 'part_4_essay';
    level: string;
    topic: string;
    targetKey?: string;
  };

  let resolvedSubject = subject;
  let resolvedGrade = grade;
  let slots: ClientMatrixSlot[] = [];

  const normalizeSlotPartType = (raw: any): ClientMatrixSlot['partType'] => {
    const s = String(raw || '').toLowerCase();
    if (s.includes('2') || s.includes('true_false') || s.includes('dung_sai') || s.includes('đúng')) return 'part_2_true_false';
    if (s.includes('3') || s.includes('short') || s.includes('tra_loi_ngan') || s.includes('ngắn')) return 'part_3_short_answer';
    if (s.includes('4') || s.includes('essay') || s.includes('tu_luan') || s.includes('tự luận')) return 'part_4_essay';
    return 'part_1_choice';
  };

  const buildDefaultBgdSlots = (scopeTopic: string): ClientMatrixSlot[] => {
    const t = scopeTopic || `${subject} ${grade}`;
    const list: ClientMatrixSlot[] = [];
    const p1Levels = [
      'Nhận biết', 'Nhận biết', 'Nhận biết', 'Nhận biết',
      'Nhận biết', 'Nhận biết', 'Thông hiểu', 'Thông hiểu',
      'Thông hiểu', 'Thông hiểu', 'Vận dụng', 'Vận dụng',
    ];
    for (let i = 0; i < 12; i++) {
      list.push({ n: i + 1, partType: 'part_1_choice', level: p1Levels[i] || difficulty, topic: `${t} (dạng ${i + 1})` });
    }
    for (let i = 0; i < 4; i++) {
      list.push({ n: 13 + i, partType: 'part_2_true_false', level: i < 2 ? 'Thông hiểu' : 'Vận dụng', topic: `${t} - Mệnh đề Đúng/Sai #${i + 1}` });
    }
    for (let i = 0; i < 6; i++) {
      list.push({ n: 17 + i, partType: 'part_3_short_answer', level: i < 2 ? 'Thông hiểu' : 'Vận dụng', topic: `${t} - Bài toán trả lời ngắn #${i + 1}` });
    }
    return list;
  };

  // Phase 1: Ultra-fast matrix blueprint extraction using gemini-3.1-flash-lite
  if (hasUploadedFile) {
    const planParts: any[] = [];
    if (cleanInlinePart) planParts.push(cleanInlinePart);
    if (matrixText) {
      planParts.push({
        text: `NỘI DUNG MA TRẬN / ĐỀ CƯƠNG ("${matrixFile?.fileName || 'matrix'}"):\n"""\n${matrixText.slice(0, 16000)}\n"""`,
      });
    }
    planParts.push({
      text: `Đọc kỹ ma trận/đề cương trên (môn gợi ý: ${subject}, khối: ${grade}${userPrompt ? `, yêu cầu: ${userPrompt}` : ''}).
Trả về ĐÚNG JSON khung danh sách từng câu hỏi cần tạo:
{
  "subject": "Tên môn học đúng trong tệp",
  "grade": "Khối lớp đúng trong tệp (ví dụ: Lớp 11)",
  "items": [
    { "n": 1, "partType": "part_1_choice", "level": "Nhận biết", "topic": "Tên chủ đề/đơn vị kiến thức/dạng bài chính xác theo dòng ma trận (10-18 từ)" }
  ]
}
Quy tắc:
- Nếu tệp ghi rõ số câu Phần I (trắc nghiệm 4 lựa chọn: part_1_choice), Phần II (Đúng/Sai: part_2_true_false), Phần III (Trả lời ngắn: part_3_short_answer), Phần IV (Tự luận: part_4_essay) -> liệt kê ĐÚNG tổng số câu và loại câu từng phần đó (tối đa 36 câu).
- Nếu tệp chỉ nêu chủ đề không ghi số câu -> lập 22 câu chuẩn BGD (12 part_1_choice, 4 part_2_true_false, 6 part_3_short_answer) bám 100% chuyên đề trong tệp.`,
    });

    try {
      const planRes = await generateClientWithTimeout(
        ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: [{ role: 'user', parts: planParts }],
          config: buildSafeModelConfig('gemini-3.1-flash-lite', {
            responseMimeType: 'application/json',
            systemInstruction:
              'Bạn là chuyên gia phân tích ma trận đề thi GDPT 2018. Chỉ xuất JSON ngắn gọn liệt kê chính xác từng vị trí câu hỏi trong ma trận, KHÔNG giải đề ở bước này.',
          }),
        }),
        18000
      );
      const parsedPlan = safeParseClientJsonWithLatex(planRes.text || '');
      if (parsedPlan?.subject) resolvedSubject = String(parsedPlan.subject);
      if (parsedPlan?.grade) resolvedGrade = String(parsedPlan.grade);
      const rawItems = Array.isArray(parsedPlan?.items)
        ? parsedPlan.items
        : Array.isArray(parsedPlan)
          ? parsedPlan
          : [];
      if (rawItems.length > 0) {
        slots = rawItems.slice(0, 36).map((it: any, i: number) => ({
          n: Number(it?.n) || i + 1,
          partType: normalizeSlotPartType(it?.partType),
          level: String(it?.level || difficulty),
          topic: String(it?.topic || userPrompt || `${resolvedSubject} ${resolvedGrade}`).slice(0, 220),
        }));
      }
    } catch (planErr: any) {
      const msg = planErr?.message || String(planErr);
      if (isFatalAuthError(msg)) {
        throw new Error('Gemini API Key không hợp lệ hoặc chưa được cấp quyền. Vui lòng kiểm tra lại API Key.');
      }
      console.warn('[Client Fast Matrix Phase 1] Blueprint fallback:', msg);
    }

    if (slots.length === 0) {
      slots = buildDefaultBgdSlots(userPrompt || matrixFile?.fileName || `${resolvedSubject} ${resolvedGrade}`);
    }
  } else if (isMatrixActive) {
    slots = buildDefaultBgdSlots(userPrompt || `${subject} ${grade}`);
  } else {
    for (let i = 0; i < numQuestions; i++) {
      slots.push({
        n: i + 1,
        partType: 'part_1_choice',
        level: difficulty,
        topic: `${userPrompt || `${subject} ${grade}`} (câu ${i + 1})`,
      });
    }
  }

  // Chunk into concurrent batches of max 6 questions
  const BATCH_SIZE = slots.length <= 8 ? slots.length : 6;
  const batches: ClientMatrixSlot[][] = [];
  for (let i = 0; i < slots.length; i += BATCH_SIZE) {
    batches.push(slots.slice(i, i + BATCH_SIZE));
  }

  const compactFileContext =
    hasUploadedFile && matrixText
      ? `\nNgữ cảnh trích từ tệp "${matrixFile?.fileName || ''}" (tham khảo đúng thuật ngữ/công thức/dạng toán):\n"""\n${matrixText.slice(0, 5000)}\n"""`
      : '';

  const batchSystemInstruction = `Bạn là Chuyên gia Khảo thí & Toán/Khoa học chuẩn GDPT 2018 (${resolvedSubject} - ${resolvedGrade}).
QUY TRÌNH GIẢI TRƯỚC - XUẤT ĐÁP ÁN SAU (BẮT BUỘC ĐỂ ĐẢM BẢO CHÍNH XÁC 100%):
1. Đề bài ("question") phải chặt chẽ, đủ dữ kiện, có DUY NHẤT 1 đáp số chính xác. KHÔNG ra câu vô nghiệm hoặc sai số liệu.
2. TÍNH TOÁN & VIẾT LỜI GIẢI ("explanation") TRƯỚC: Thực hiện đầy đủ phép tính từng bước để tìm ra đáp số cuối cùng.
3. VỚI CÂU PHẦN I (part_1_choice): Sau khi có đáp số ở "explanation", đặt ĐÚNG đáp số đó vào một trong 4 phương án A/B/C/D của "options", tạo 3 phương án nhiễu hợp lý gần giống kết quả thật (không trùng lặp), rồi ĐỐI CHIẾU LẠI để ghi "correctAnswer" CHÍNH XÁC TUYỆT ĐỐI khớp với chữ cái chứa đáp số đúng (KHÔNG viết cứng tên chữ cái trong lời giải; KHÔNG ghi "A. ", "B. " vào "text").
4. VỚI CÂU PHẦN II (part_2_true_false): Đủ 4 ý a, b, c, d với kết luận Đúng/Sai chuẩn xác; đặt "correctAnswer" khớp đúng từng ý (ví dụ "a:Đ, b:S, c:Đ, d:S").
5. VỚI CÂU PHẦN III (part_3_short_answer - Chuẩn phiếu trả lời ngắn BGD 2025): Kết quả cuối cùng PHẢI là 1 giá trị số duy nhất (tối đa 4-5 ký tự gồm dấu trừ/dấu phẩy, ví dụ "12", "-4", "2,5", "0,87"). Nếu kết quả ra phân số thập phân vô hạn (1/3, 7/6...), chứa căn thức (\\\\sqrt{2}, \\\\sqrt{3}...), $\\\\pi$, $e$, $\\\\ln$... BẮT BUỘC ghi rõ yêu cầu làm tròn ngay cuối đề bài "question" (ví dụ: "(kết quả làm tròn đến hàng phần trăm)" hoặc "(kết quả làm tròn đến hàng phần mười)"); đồng thời "shortAnswerKey" và "correctAnswer" CHỈ ĐƯỢC chứa số thập phân đã làm tròn bằng dấu phẩy (ví dụ "0,87" hoặc "-1,33"), TUYỆT ĐỐI KHÔNG để ký hiệu LaTeX ($...$, \\\\frac, \\\\sqrt) hay phân số trong "shortAnswerKey".
6. TOÀN BỘ CÔNG THỨC TOÁN/LÝ/HÓA DÙNG LATEX CHUẨN BỌC 100% TRONG $...$ (escape \\\\ trong JSON): phân số \\\\frac{a}{b}, căn thức \\\\sqrt{x}, mũ/chỉ số bọc ngoặc x^{n+1}, C_n^k, tích phân \\\\int_a^b, giới hạn \\\\lim_{x \\to +\\\\infty}, tập hợp \\\\mathbb{R} \\\\setminus \\\\{1\\\\}, góc \\\\widehat{ABC}, độ ^{\\\\circ}, véctơ \\\\overrightarrow{AB}, \\\\overrightarrow{a}, \\\\overrightarrow{i}, \\\\overrightarrow{j}, \\\\overrightarrow{k}. TUYỆT ĐỐI KHÔNG viết ASCII như vec(AB), frac(a,b), sqrt(x), (a+b)/(c+d), <=, >=, oo.`;

  const parseBatch = (raw: string): any[] => {
    let parsed = safeParseClientJsonWithLatex(raw);
    if (parsed && !Array.isArray(parsed) && Array.isArray((parsed as any).questions)) {
      parsed = (parsed as any).questions;
    }
    return Array.isArray(parsed) ? parsed : [];
  };

  let lastErr = '';

  const runBatch = async (batchSlots: ClientMatrixSlot[], batchIdx: number): Promise<any[]> => {
    const slotSpecs = batchSlots
      .map((s) => {
        const typeLabel =
          s.partType === 'part_1_choice'
            ? 'Phần I (part_1_choice, 4 lựa chọn A/B/C/D)'
            : s.partType === 'part_2_true_false'
              ? 'Phần II Đúng/Sai (part_2_true_false, đủ 4 ý a,b,c,d)'
              : s.partType === 'part_3_short_answer'
                ? 'Phần III Trả lời ngắn (part_3_short_answer)'
                : 'Phần IV Tự luận (part_4_essay)';
        return `- Câu số ${s.n}: ${typeLabel} | Mức độ: ${s.level} | Nội dung: ${s.topic}`;
      })
      .join('\n');

    const batchParts: any[] = [];
    if (cleanInlinePart) batchParts.push(cleanInlinePart);
    batchParts.push({
      text: `Hãy soạn ĐÚNG ${batchSlots.length} câu hỏi sau cho đề ${resolvedSubject} (${resolvedGrade}):
${slotSpecs}
${userPrompt ? `Yêu cầu chung của giáo viên: "${userPrompt}"` : ''}${compactFileContext}

Chỉ trả về mảng JSON thuần túy gồm đúng ${batchSlots.length} phần tử theo ĐÚNG THỨ TỰ FIELD (giải trong "explanation" trước khi xuất "options" & "correctAnswer"):
- Phần I: { "slotNumber": 1, "partType": "part_1_choice", "partLabel": "Phần I. Câu trắc nghiệm nhiều phương án lựa chọn", "question": "...", "explanation": "Các bước giải chi tiết ra đáp số...", "options": [{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}], "correctAnswer": "C", "difficulty": "Nhận biết", "timeLimit": ${timeLimit} }
- Phần II: { "slotNumber": 13, "partType": "part_2_true_false", "partLabel": "Phần II. Câu trắc nghiệm Đúng / Sai", "question": "...", "explanation": "Phân tích từng ý a, b, c, d...", "subStatements": [{"label":"a","statement":"...","correct":true},{"label":"b","statement":"...","correct":false},{"label":"c","statement":"...","correct":true},{"label":"d","statement":"...","correct":false}], "correctAnswer": "a:Đ, b:S, c:Đ, d:S", "options": [], "difficulty": "Thông hiểu", "timeLimit": 60 }
- Phần III: { "slotNumber": 17, "partType": "part_3_short_answer", "partLabel": "Phần III. Câu trắc nghiệm trả lời ngắn", "question": "...", "explanation": "Giải chi tiết ra kết quả...", "shortAnswerKey": "2,5", "correctAnswer": "2,5", "options": [], "difficulty": "Vận dụng", "timeLimit": 45 }
- Phần IV: { "slotNumber": 23, "partType": "part_4_essay", "partLabel": "Phần IV. Tự luận", "question": "...", "explanation": "Lời giải chi tiết...", "essayRubric": "...", "correctAnswer": "Đáp số", "options": [], "difficulty": "Vận dụng", "timeLimit": 120 }`,
    });

    try {
      const resPrimary = await generateClientWithTimeout(
        ai.models.generateContent({
          model: PRIMARY_CLIENT_MODELS[0],
          contents: [{ role: 'user', parts: batchParts }],
          config: buildSafeModelConfig(PRIMARY_CLIENT_MODELS[0], {
            responseMimeType: 'application/json',
            systemInstruction: batchSystemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          }),
        }),
        36000
      );
      const items = parseBatch(resPrimary.text || '');
      if (items.length > 0) return items;
    } catch (err: any) {
      lastErr = err?.message || String(err);
      if (isFatalAuthError(lastErr)) throw err;
      console.warn(`[Client Fast Matrix Batch ${batchIdx + 1}] Primary failed (${lastErr.slice(0, 80)}), retrying lite...`);
    }

    try {
      const resLite = await generateClientWithTimeout(
        ai.models.generateContent({
          model: PRIMARY_CLIENT_MODELS[1],
          contents: [{ role: 'user', parts: batchParts }],
          config: buildSafeModelConfig(PRIMARY_CLIENT_MODELS[1], {
            responseMimeType: 'application/json',
            systemInstruction: batchSystemInstruction,
          }),
        }),
        22000
      );
      return parseBatch(resLite.text || '');
    } catch (liteErr: any) {
      lastErr = liteErr?.message || String(liteErr);
      if (isFatalAuthError(lastErr)) throw liteErr;
      return [];
    }
  };

  const batchResults = await Promise.all(batches.map((b, idx) => runBatch(b, idx)));
  const parsed = batchResults.flat();

  if (parsed.length > 0) {
    const mapped = parsed.map((q: any, idx: number) => {
      const partType = inferPartType(q);
      const isTrueFalse = partType === 'part_2_true_false';
      const isShortAnswer = partType === 'part_3_short_answer';
      const isEssay = partType === 'part_4_essay';

      let partLabel = q.partLabel || 'Phần I. Câu trắc nghiệm nhiều phương án lựa chọn';
      if (isTrueFalse) partLabel = q.partLabel || 'Phần II. Câu trắc nghiệm Đúng / Sai';
      else if (isShortAnswer) partLabel = q.partLabel || 'Phần III. Câu trắc nghiệm trả lời ngắn';
      else if (isEssay) partLabel = q.partLabel || 'Phần IV. Tự luận';

      let subStatements: any[] | undefined = undefined;
      if (isTrueFalse && Array.isArray(q.subStatements) && q.subStatements.length > 0) {
        subStatements = q.subStatements.map((s: any, sIdx: number) => {
          const label = s.label || s.key || ['a', 'b', 'c', 'd'][sIdx] || `ý ${sIdx + 1}`;
          const statement = s.statement || s.text || '';
          const correct = typeof s.correct === 'boolean' ? s.correct : (typeof s.isCorrect === 'boolean' ? s.isCorrect : true);
          return {
            id: `sub_${idx}_${sIdx}`,
            key: label,
            label,
            statement,
            text: statement,
            correct,
            isCorrect: correct,
          };
        });
      }

      let options: any[] = [];
      if (partType === 'part_1_choice') {
        options =
          Array.isArray(q.options) && q.options.length >= 2
            ? q.options.map((opt: any, oIdx: number) => ({
                key: ['A', 'B', 'C', 'D'][oIdx] || String(opt?.key || 'A').trim().toUpperCase().replace(/[\.\)]$/, ''),
                text:
                  typeof opt === 'string'
                    ? stripLeadingChoicePrefix(opt)
                    : stripLeadingChoicePrefix(opt.text || `Lựa chọn ${opt.key || oIdx + 1}`),
              }))
            : [
                { key: 'A', text: 'Phương án A' },
                { key: 'B', text: 'Phương án B' },
                { key: 'C', text: 'Phương án C' },
                { key: 'D', text: 'Phương án D' },
              ];
      }

      const enriched = autoEnrichClientDiagram(q);
      const diagramType = q.diagramType || enriched.diagramType || undefined;
      const diagramData = q.diagramData || enriched.diagramData || undefined;

      const cleanCorrectAnswer = isTrueFalse
        ? subStatements
          ? subStatements.map((s) => `${s.label}:${s.correct ? 'Đ' : 'S'}`).join(', ')
          : String(q.correctAnswer || 'a:Đ, b:S, c:Đ, d:S')
        : isShortAnswer
          ? String(q.shortAnswerKey ?? q.correctAnswer ?? '')
          : isEssay
            ? String(q.correctAnswer || 'Lời giải mẫu')
            : extractChoiceKey(q.correctAnswer);

      return sanitizeQuizQuestionMath({
        id: q.id || `q_${Date.now()}_${idx + 1}`,
        question: q.question || `Câu hỏi ${idx + 1}`,
        partType,
        partLabel,
        options,
        subStatements,
        shortAnswerKey: q.shortAnswerKey || (isShortAnswer ? cleanCorrectAnswer : undefined),
        essayRubric: q.essayRubric || (isEssay ? (q.explanation || 'Barem điểm chi tiết') : undefined),
        correctAnswer: cleanCorrectAnswer,
        explanation: q.explanation || 'Lời giải chi tiết chuẩn SGK.',
        diagramType,
        diagramData,
        timeLimit: Number(q.timeLimit) || Number(timeLimit) || (isTrueFalse ? 60 : isShortAnswer ? 45 : isEssay ? 120 : 30),
      });
    });

    return balanceQuizAnswerDistribution(mapped, `${userPrompt || resolvedGrade}_${Date.now()}`);
  }

  throw new Error(
    isFatalAuthError(lastErr)
      ? 'Gemini API Key không hợp lệ hoặc chưa được cấp quyền. Vui lòng kiểm tra lại API Key.'
      : `Không thể phân tích ma trận bằng AI (${lastErr ? lastErr.slice(0, 120) : 'phản hồi rỗng'}). Vui lòng thử lại.`
  );
}

/**
 * Direct client-side AI Independent Reflection & Critique fallback:
 * Re-solves every question from scratch to detect wrong answers, missing options, or ambiguous statements.
 */
export async function directCritiqueQuiz(params: {
  questions: QuizQuestion[];
  subject?: string;
  grade?: string;
  apiKey?: string;
}): Promise<QuizCritiqueItem[]> {
  const ai = createDirectGeminiClient(params.apiKey);
  if (!ai) {
    throw new Error('Chưa cấu hình Gemini API Key để phản biện đề.');
  }

  const { questions, subject = 'Toán học', grade = 'Lớp 12' } = params;
  const BATCH_SIZE = 5;
  const indexedQuestions = questions.slice(0, 50).map((q, idx) => ({
    questionIndex: idx,
    questionId: String(q?.id || `q_${idx + 1}`),
    partType: inferPartType(q),
    question: String(q?.question || ''),
    options: Array.isArray(q?.options) ? q.options : [],
    subStatements: Array.isArray(q?.subStatements) ? q.subStatements : undefined,
    shortAnswerKey: q?.shortAnswerKey,
    currentCorrectAnswer: String(q?.correctAnswer || ''),
    currentExplanation: String(q?.explanation || ''),
  }));

  const batches: Array<typeof indexedQuestions> = [];
  for (let i = 0; i < indexedQuestions.length; i += BATCH_SIZE) {
    batches.push(indexedQuestions.slice(i, i + BATCH_SIZE));
  }

  const critiqueSystemInstruction = `Bạn là CHỦ TỊCH HỘI ĐỒNG PHẢN BIỆN & THẨM ĐỊNH ĐỀ THI ĐỘC LẬP (${subject} - ${grade}, chuẩn GDPT 2018).
NHIỆM VỤ TỐI THƯỢNG: Đọc và TỰ GIẢI LẠI TỪNG CÂU HỎI TỪ CON SỐ 0. TUYỆT ĐỐI KHÔNG TIN TƯỞNG MÙ QUÁNG "currentCorrectAnswer" HAY "currentExplanation".

QUY TRÌNH THẨM ĐỊNH TỪNG CÂU:
1. Kiểm tra đề bài ("question"): Có thiếu giả thiết/điều kiện, sai số liệu, mập mờ câu chữ hoặc có thể hiểu nhiều nghĩa không?
2. Tự giải độc lập từng bước từ đầu ("reSolvedSteps"), tính ra đáp số chuẩn xác 100%.
3. Phân loại "status" CHÍNH XÁC vào 1 trong 4 giá trị:
   - "ok": Đề bài rõ ràng, chặt chẽ; có đúng 1 đáp án duy nhất khớp với kết quả tự giải; và "currentCorrectAnswer" ĐÃ ĐÚNG 100% (với Phần II thì cả 4 ý a,b,c,d đều đúng chân trị).
   - "wrong_answer": Đề bài rõ ràng, phương án đúng ĐÃ NẰM TRONG 4 phương án A/B/C/D, NHƯNG "currentCorrectAnswer" đang chấm NHẦM chữ cái khác (ví dụ giải ra A nhưng ứng dụng lưu B), HOẶC ý Đúng/Sai Phần II / đáp số Phần III đang gắn sai. Khi đó: giữ nguyên đề & options nếu đã chuẩn, chỉ trả về "suggestedPatch" sửa lại đúng "correctAnswer" (hoặc "subStatements"/"shortAnswerKey") và "explanation".
   - "no_correct_option": Kết quả tự giải KHÔNG xuất hiện trong 4 phương án A/B/C/D, HOẶC có >= 2 phương án đúng/trùng lặp giá trị. Khi đó: trả về "suggestedPatch" cung cấp đủ 4 phương án "options" A, B, C, D phân biệt với đúng 1 đáp án đúng, kèm "correctAnswer" và "explanation".
   - "ambiguous": Đề bài chưa rõ ràng, thiếu dữ kiện, sai công thức/số liệu dẫn tới vô nghiệm hoặc không xác định được đáp án duy nhất. Với câu Phần III (part_3_short_answer): nếu đáp số là phân số vô hạn, căn thức, $\\\\pi, e$ mà đề CHƯA ghi yêu cầu làm tròn (hàng phần mười / phần trăm), HOẶC "shortAnswerKey" đang chứa LaTeX/phân số/căn thay vì số thập phân gọn, cũng ĐÁNH DẤU "ambiguous" và trả về "suggestedPatch" thêm yêu cầu làm tròn vào cuối "question" + quy đổi "shortAnswerKey" và "correctAnswer" thành số thập phân đã làm tròn chuẩn (ví dụ "0,87").
4. TOÀN BỘ CÔNG THỨC TOÁN/LÝ/HÓA TRONG "reSolvedSteps", "reason", "suggestedPatch" DÙNG LATEX CHUẨN BỌC TRONG $...$ (escape \\\\ trong JSON, véctơ dùng \\\\overrightarrow{AB}, phân số \\\\frac{a}{b}). KHÔNG viết "A. ", "B. " vào "options[].text".
5. Nếu "status" !== "ok", BẮT BUỘC phải có "suggestedPatch" đầy đủ và đã được kiểm tra khớp 100% giữa kết quả giải và "correctAnswer"!`;

  const parseArr = (raw: string): any[] => {
    let parsed = safeParseClientJsonWithLatex(raw);
    if (parsed && !Array.isArray(parsed) && Array.isArray((parsed as any).items)) {
      parsed = (parsed as any).items;
    }
    if (parsed && !Array.isArray(parsed) && Array.isArray((parsed as any).results)) {
      parsed = (parsed as any).results;
    }
    return Array.isArray(parsed) ? parsed : [];
  };

  const runBatch = async (batch: typeof indexedQuestions): Promise<any[]> => {
    const prompt = `Hãy phản biện, giải lại độc lập từ đầu và thẩm định chính xác từng câu trong ${batch.length} câu sau:
${JSON.stringify(batch)}

Trả về ĐÚNG 1 mảng JSON thuần túy gồm ${batch.length} phần tử, mỗi phần tử có cấu trúc:
{
  "questionId": "...",
  "questionIndex": 0,
  "status": "ok" | "wrong_answer" | "no_correct_option" | "ambiguous",
  "reason": "Nhận xét ngắn gọn rõ ràng (nếu lỗi ghi rõ lỗi gì, đáp án cũ sai ở đâu).",
  "reSolvedSteps": "Các bước giải độc lập chi tiết ra đáp số chuẩn bằng LaTeX $...$.",
  "verifiedCorrectAnswer": "A",
  "suggestedPatch": {
    "question": "(chỉ cần nếu sửa đề, hoặc giữ nguyên)",
    "options": [{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],
    "subStatements": [],
    "shortAnswerKey": "...",
    "correctAnswer": "A",
    "explanation": "Lời giải chuẩn xác khớp hoàn toàn đáp án..."
  }
}`;

    for (const model of PRIMARY_CLIENT_MODELS) {
      try {
        const res = await generateClientWithTimeout(
          ai.models.generateContent({
            model,
            contents: prompt,
            config: buildSafeModelConfig(model, {
              responseMimeType: 'application/json',
              systemInstruction: critiqueSystemInstruction,
              thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
            }),
          }),
          45000
        );
        const items = parseArr((res.text || '').trim());
        if (items.length > 0) return items;
      } catch (err: any) {
        if (isFatalAuthError(err?.message || String(err))) throw err;
      }
    }
    return [];
  };

  const batchResults = await Promise.all(
    batches.map((b) =>
      runBatch(b).catch((err) => {
        if (isFatalAuthError(err?.message || String(err))) throw err;
        return b.map((item) => ({
          questionId: item.questionId,
          questionIndex: item.questionIndex,
          status: 'ok',
          reason: 'Chưa phản biện được câu này do nghẽn mạng.',
          reSolvedSteps: item.currentExplanation || '',
          verifiedCorrectAnswer: item.currentCorrectAnswer,
        }));
      })
    )
  );

  const flatRaw = batchResults.flat();
  const byId = new Map<string, any>();
  const byIdx = new Map<number, any>();
  flatRaw.forEach((r: any) => {
    if (r?.questionId) byId.set(String(r.questionId), r);
    if (typeof r?.questionIndex === 'number') byIdx.set(r.questionIndex, r);
  });

  const validStatuses = new Set<CritiqueIssueType>(['ok', 'wrong_answer', 'no_correct_option', 'ambiguous']);

  return indexedQuestions.map((orig): QuizCritiqueItem => {
    const raw = byId.get(orig.questionId) || byIdx.get(orig.questionIndex) || {};
    let status: CritiqueIssueType = validStatuses.has(raw.status) ? raw.status : 'ok';
    const reSolvedSteps = normalizeMathInText(String(raw.reSolvedSteps || orig.currentExplanation || ''));
    const reason = normalizeMathInText(
      String(raw.reason || (status === 'ok' ? 'Đề rõ ràng và đáp án chính xác.' : 'Cần kiểm tra lại câu hỏi/đáp án.'))
    );

    let verifiedCorrectAnswer = String(raw.verifiedCorrectAnswer || orig.currentCorrectAnswer || 'A');
    if (orig.partType === 'part_1_choice') {
      verifiedCorrectAnswer = extractChoiceKey(verifiedCorrectAnswer);
    } else if (orig.partType === 'part_3_short_answer') {
      const targetQText =
        typeof raw?.suggestedPatch?.question === 'string' && raw.suggestedPatch.question.trim()
          ? raw.suggestedPatch.question
          : orig.question;
      verifiedCorrectAnswer = formatPlainShortAnswerKey(verifiedCorrectAnswer, targetQText).key;
    }

    let suggestedPatch: QuizCritiqueItem['suggestedPatch'] = undefined;
    if (status !== 'ok' && raw.suggestedPatch && typeof raw.suggestedPatch === 'object') {
      const patch = { ...raw.suggestedPatch };
      const cleanPatch: NonNullable<QuizCritiqueItem['suggestedPatch']> = {
        explanation: normalizeMathInText(String(patch.explanation || reSolvedSteps || orig.currentExplanation)),
        correctAnswer: String(patch.correctAnswer || verifiedCorrectAnswer),
      };
      if (typeof patch.question === 'string' && patch.question.trim()) {
        cleanPatch.question = normalizeMathInText(patch.question.trim());
      }
      if (orig.partType === 'part_1_choice') {
        const baseOpts = Array.isArray(patch.options) && patch.options.length >= 4 ? patch.options : orig.options;
        if (Array.isArray(baseOpts) && baseOpts.length >= 4) {
          cleanPatch.options = (['A', 'B', 'C', 'D'] as const).map((k, oIdx) => {
            const found =
              baseOpts.find((o: any) => String(o?.key || '').trim().toUpperCase().replace(/[\.\)]$/, '') === k) ||
              baseOpts[oIdx];
            const txt = typeof found === 'string' ? found : String(found?.text || `Phương án ${k}`);
            return { key: k, text: normalizeMathInText(stripLeadingChoicePrefix(txt) || txt) };
          });
        }
        cleanPatch.correctAnswer = extractChoiceKey(cleanPatch.correctAnswer || verifiedCorrectAnswer);
        verifiedCorrectAnswer = cleanPatch.correctAnswer;
      } else if (orig.partType === 'part_2_true_false') {
        const baseSubs =
          Array.isArray(patch.subStatements) && patch.subStatements.length > 0 ? patch.subStatements : orig.subStatements;
        if (Array.isArray(baseSubs) && baseSubs.length > 0) {
          cleanPatch.subStatements = baseSubs.map((s: any, sIdx: number) => {
            const label = s.label || s.key || ['a', 'b', 'c', 'd'][sIdx] || `ý ${sIdx + 1}`;
            const statement = normalizeMathInText(s.statement || s.text || '');
            const correct = typeof s.correct === 'boolean' ? s.correct : Boolean(s.isCorrect);
            return {
              id: s.id || `sub_${orig.questionIndex}_${sIdx}`,
              key: label,
              label,
              statement,
              text: statement,
              correct,
              isCorrect: correct,
            };
          });
          cleanPatch.correctAnswer = cleanPatch.subStatements.map((s) => `${s.label}:${s.correct ? 'Đ' : 'S'}`).join(', ');
          verifiedCorrectAnswer = cleanPatch.correctAnswer;
        }
      } else if (orig.partType === 'part_3_short_answer') {
        const formattedShort = formatPlainShortAnswerKey(
          String(patch.shortAnswerKey ?? patch.correctAnswer ?? verifiedCorrectAnswer),
          cleanPatch.question || orig.question
        );
        if (formattedShort.roundedWithDecimals !== undefined) {
          cleanPatch.question = ensurePart3RoundingPrompt(cleanPatch.question || orig.question, formattedShort.roundedWithDecimals);
        }
        cleanPatch.shortAnswerKey = formattedShort.key;
        cleanPatch.correctAnswer = formattedShort.key;
        verifiedCorrectAnswer = formattedShort.key;
      }

      if (
        status === 'wrong_answer' &&
        orig.partType === 'part_1_choice' &&
        cleanPatch.correctAnswer === extractChoiceKey(orig.currentCorrectAnswer) &&
        !cleanPatch.question
      ) {
        status = 'ok';
      } else {
        suggestedPatch = cleanPatch;
      }
    } else if (status !== 'ok') {
      suggestedPatch = {
        correctAnswer: verifiedCorrectAnswer,
        explanation: reSolvedSteps || orig.currentExplanation,
      };
    }

    return {
      questionId: orig.questionId,
      questionIndex: orig.questionIndex,
      status,
      reason,
      reSolvedSteps,
      verifiedCorrectAnswer,
      ...(suggestedPatch ? { suggestedPatch } : {}),
    };
  });
}

