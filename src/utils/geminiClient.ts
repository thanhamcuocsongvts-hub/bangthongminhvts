import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { QuizQuestion } from '../types';
import { balanceQuizAnswerDistribution } from './quizDistribution';

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
          items.push(JSON.parse(chunk));
        } catch {
          try {
            const fixedChunk = chunk.replace(/(?<!\\)\\(?!["\\/bfnrtu]|u[0-9a-fA-F]{4})/g, '\\\\');
            items.push(JSON.parse(fixedChunk));
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
  try {
    return JSON.parse(text);
  } catch {
    try {
      const fixed = text.replace(/(?<!\\)\\(?!["\\/bfnrtu]|u[0-9a-fA-F]{4})/g, '\\\\');
      return JSON.parse(fixed);
    } catch {
      return extractCompleteObjectsFromClientArray(text);
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
 * Normalize and clean mathematical notation in quiz questions (standard vectors, KaTeX compat, etc.)
 */
export function normalizeMathInText(text: string): string {
  if (!text || typeof text !== 'string') return text || '';
  return text
    // Replace \vec{...} with \overrightarrow{...}
    .replace(/\\vec\s*\{([^}]+)\}/g, '\\overrightarrow{$1}')
    .replace(/\\vec\s+([a-zA-Z0-9']+)/g, '\\overrightarrow{$1}')
    // Replace unicode combining arrow / inline arrows with \overrightarrow
    .replace(/([a-zA-Z0-9']+)[⃗\u20D7]/g, '\\overrightarrow{$1}')
    // Replace \hat{...} with \widehat{...}
    .replace(/\\hat\s*\{([^}]+)\}/g, '\\widehat{$1}')
    .replace(/\\hat\s+([a-zA-Z0-9']+)/g, '\\widehat{$1}')
    .replace(/([a-zA-Z0-9']+)̂/g, '\\widehat{$1}')
    // Replace \bar{...} with \overline{...}
    .replace(/\\bar\s*\{([^}]+)\}/g, '\\overline{$1}')
    .replace(/\\bar\s+([a-zA-Z0-9']+)/g, '\\overline{$1}')
    .replace(/([a-zA-Z0-9']+)̄/g, '\\overline{$1}');
}

export function sanitizeQuizQuestionMath(q: any): any {
  if (!q || typeof q !== 'object') return q;
  const cleanQ = { ...q };
  cleanQ.question = normalizeMathInText(cleanQ.question);
  cleanQ.explanation = normalizeMathInText(cleanQ.explanation);

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
Hãy tạo đúng ${count} câu hỏi trắc nghiệm chất lượng cao về chủ đề: "${topic}".
Môn học: ${subject}, Khối lớp: ${grade}, Mức độ: ${difficulty}.

YÊU CẦU ĐẶC BIỆT & CHUẨN HÓA KÝ HIỆU TOÁN HỌC SGK GDPT 2018:
1. Mỗi câu hỏi gồm đúng 4 lựa chọn (A, B, C, D).
2. Đáp án đúng correctAnswer phải là một trong các chữ cái: "A", "B", "C", "D". PHẢI PHÂN BỔ ĐỀU các đáp án đúng A, B, C, D giữa các câu (tuyệt đối KHÔNG dồn toàn bộ vào A hay một chữ cái cố định).
3. Có phần giải thích chi tiết, sư phạm, chuẩn xác (tập trung giải thích giá trị/công thức đúng, không ghi cứng "Đáp án A đúng").
4. MỌI CÔNG THỨC TOÁN, LÝ, HÓA, BIỂU THỨC BẮT BUỘC BỌC TRONG CẶP DẤU $...$ (ví dụ: $x^2 + 2x - 3 = 0$, $y = f(x)$).
5. ĐẶC BIỆT VỚI KÝ HIỆU VÉC-TƠ:
   - BẮT BUỘC dùng \\overrightarrow{AB}, \\overrightarrow{BC}, \\overrightarrow{a}, \\overrightarrow{AA'}, \\overrightarrow{AC'} (KHÔNG dùng \\vec{AB} vì mũi tên không bao phủ hết hai chữ cái; KHÔNG tự ghép ký tự unicode mũi tên rời).
   - Nếu phương án A, B, C, D chứa véc-tơ hay đẳng thức, BẮT BUỘC bọc trong $...$ (ví dụ: "text": "$\\overrightarrow{AB} + \\overrightarrow{BC} = \\overrightarrow{AC}$").
6. BẮT BUỘC chỉ trả về định dạng JSON thuần túy (không bọc trong markdown code block, không giải thích ngoài lề):
[
  {
    "id": "q1",
    "question": "Nội dung câu hỏi...",
    "options": [
      { "key": "A", "text": "Phương án A" },
      { "key": "B", "text": "Phương án B" },
      { "key": "C", "text": "Phương án C" },
      { "key": "D", "text": "Phương án D" }
    ],
    "correctAnswer": "C",
    "explanation": "Giải thích chi tiết công thức/kết quả đúng...",
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
          temperature: 0.2,
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
        return balanceQuizAnswerDistribution(
          resList.map((q) => sanitizeQuizQuestionMath(q)),
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

/**
 * Direct client-side Fast Matrix & Prompt Quiz Generation
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

  const isFunctionOnlyPrompt =
    !hasUploadedFile &&
    Boolean(userPrompt) &&
    /(hàm số|đơn điệu|cực trị|khảo sát|tiệm cận|gtln|gtnn|giá trị lớn nhất|giá trị nhỏ nhất|bảng biến thiên|đồ thị)/i.test(userPrompt);

  const systemInstruction = `Bạn là Chuyên gia Khảo thí & Soạn đề kiểm tra chuẩn Chương trình GDPT 2018 Việt Nam (THPT/THCS).
Nhiệm vụ tối thượng: ${
    hasUploadedFile
      ? `ĐỌC THẬT KỸ TỆP MA TRẬN / ĐỀ CƯƠNG ĐÍNH KÈM ("${matrixFile?.fileName || 'ma trận'}") và TẠO ĐỀ KIỂM TRA BÁM SÁT 100% ĐÚNG NỘI DUNG, CHỦ ĐỀ, KHỐI LỚP (${grade}), DẠNG TOÁN VÀ SỐ LƯỢNG CÂU HỎI CỦA MA TRẬN/ĐỀ CƯƠNG ĐÓ.`
      : `Tạo đề thi chuẩn xác bám sát 100% chủ đề được yêu cầu ("${userPrompt || `${subject} ${grade}`}"), môn ${subject}, khối ${grade}, mức độ ${difficulty}.`
  }

*** QUY TẮC BẮT BUỘC VỀ NỘI DUNG & CẤU TRÚC: ***
${
  hasUploadedFile
    ? `1. NGUYÊN TẮC BÁM SÁT TỆP MA TRẬN / ĐỀ CƯƠNG ĐÍNH KÈM (SỐNG CÒN):
   - TỆP ĐÍNH KÈM LÀ NGUỒN CHÂN LÝ DUY NHẤT: Đọc kỹ từng dòng, từng bảng ma trận, từng chuyên đề / đơn vị kiến thức / dạng bài / câu mẫu trong tệp "${matrixFile?.fileName || ''}".
   - MỖI CÂU HỎI TẠO RA PHẢI TƯƠNG ỨNG ĐÚNG VỚI TỪNG CHỦ ĐỀ, ĐƠN VỊ KIẾN THỨC VÀ MỨC ĐỘ (Nhận biết / Thông hiểu / Vận dụng) CÓ TRONG MA TRẬN/ĐỀ CƯƠNG ĐÓ!
   - TUYỆT ĐỐI KHÔNG ĐƯỢC tự ý mặc định lấy đề "Khảo sát hàm số Lớp 12" hay các chủ đề không có trong tệp! Ví dụ nếu tệp là ${grade} hoặc môn ${subject} thì 100% câu hỏi PHẢI đúng kiến thức trong tệp!
   - SỐ LƯỢNG CÂU HỎI VÀ CÁC PHẦN: Nếu tệp ma trận ghi rõ số câu cho từng phần (Phần I, Phần II, Phần III, Phần IV) thì TẠO ĐÚNG Y HỆT SỐ CÂU TỪNG PHẦN ĐÓ! Chỉ khi tệp không ghi rõ tổng số câu từng phần thì mới dùng cấu trúc mặc định chuẩn BGD 2025 (12 câu Phần I + 4 câu Phần II + 6 câu Phần III = 22 câu).${
     userPrompt ? `\n   - Yêu cầu bổ sung của giáo viên: "${userPrompt}".` : ''
   }`
    : isFunctionOnlyPrompt
      ? `1. Chủ đề yêu cầu về HÀM SỐ: Toàn bộ 100% các câu hỏi PHẢI thuộc về chủ đề "${userPrompt}". Không đưa Oxyz hay chương khác vào.`
      : `1. Toàn bộ 100% câu hỏi PHẢI đúng chủ đề "${userPrompt || `${subject} ${grade}`}", môn ${subject}, khối ${grade}.`
}
${
  !hasUploadedFile && isMatrixActive
    ? `2. CHẾ ĐỘ MA TRẬN CHUẨN BGD 2025: Tạo đủ 22 câu gồm 12 câu Phần I (part_1_choice), 4 câu Phần II Đúng/Sai (part_2_true_false, mỗi câu 4 ý a, b, c, d), và 6 câu Phần III Trả lời ngắn (part_3_short_answer) — tất cả thuộc đúng chủ đề "${userPrompt || `${subject} ${grade}`}".`
    : !hasUploadedFile
      ? `2. Tạo đúng ${numQuestions} câu hỏi trắc nghiệm chất lượng cao bám sát chủ đề "${userPrompt || `${subject} ${grade}`}".`
      : ''
}

Định dạng JSON:
- BẮT BUỘC chỉ trả về mảng JSON thuần túy [ { ... } ].
Cấu trúc các loại câu:
1. Phần I: { "id": "q1", "partType": "part_1_choice", "partLabel": "Phần I. Câu trắc nghiệm nhiều phương án lựa chọn", "question": "...", "options": [{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}], "correctAnswer": "C", "explanation": "Giải ngắn gọn 1-3 câu...", "timeLimit": ${timeLimit} }
   (QUY TẮC ĐÁP ÁN PHẦN I: PHẢI phân bổ đều đáp án đúng qua đầy đủ A, B, C, D — tuyệt đối không để đa số là A; phần explanation chỉ giải thích giá trị/công thức đúng, không viết cứng "Đáp án A đúng").
2. Phần II: { "id": "q2", "partType": "part_2_true_false", "partLabel": "Phần II. Câu trắc nghiệm Đúng / Sai", "question": "...", "subStatements": [{"label":"a","statement":"...","correct":true},{"label":"b","statement":"...","correct":false},{"label":"c","statement":"...","correct":true},{"label":"d","statement":"...","correct":false}], "correctAnswer": "a:Đ, b:S, c:Đ, d:S", "options": [], "explanation": "Giải ngắn gọn từng ý...", "timeLimit": 60 }
3. Phần III: { "id": "q3", "partType": "part_3_short_answer", "partLabel": "Phần III. Câu trắc nghiệm trả lời ngắn", "question": "...", "shortAnswerKey": "2,5", "correctAnswer": "2,5", "options": [], "explanation": "Giải ngắn gọn...", "timeLimit": 45 }
4. Phần IV: { "id": "q4", "partType": "part_4_essay", "partLabel": "Phần IV. Tự luận", "question": "...", "essayRubric": "Barem điểm...", "correctAnswer": "Lời giải mẫu", "options": [], "explanation": "Lời giải mẫu ngắn gọn...", "timeLimit": 120 }
- QUY TẮC HIỂN THỊ CÔNG THỨC:
  + Mọi công thức Toán/Lý/Hóa bọc trong $...$ (ví dụ $y = f(x)$, $\\overrightarrow{AB}$). Viết "explanation" súc tích, rõ ý (2-3 câu).`;

  const parts: any[] = [];
  if (matrixFile?.base64 && matrixFile?.mimeType && matrixFile.base64.length < 15_000_000) {
    const cleanB64 = matrixFile.base64.replace(/^data:.*?;base64,/, '');
    parts.push({ inlineData: { mimeType: matrixFile.mimeType, data: cleanB64 } });
  }
  if (matrixFile?.text && matrixFile.text.trim().length > 0) {
    parts.push({
      text: `NỘI DUNG VĂN BẢN BÓC TÁCH TỪ TỆP MA TRẬN / ĐỀ CƯƠNG ("${matrixFile.fileName || 'matrix'}"):\n"""\n${matrixFile.text.slice(0, 32000)}\n"""`,
    });
  }

  if (hasUploadedFile) {
    parts.push({
      text: `Thông số lớp/môn: ${subject} - ${grade} - Mức độ: ${difficulty}.${
        userPrompt ? `\nGhi chú thêm của giáo viên: "${userPrompt}"` : ''
      }\nHãy phân tích kỹ tệp ma trận/đề cương đính kèm ở trên và tạo ĐÚNG các câu hỏi bám sát 100% nội dung ma trận/đề cương đó (KHÔNG tạo đề khác ngoài ma trận). Trả về mảng JSON thuần túy.`,
    });
  } else if (isMatrixActive) {
    parts.push({
      text: `Soạn đề theo cấu trúc ma trận GDPT 2018 (12 câu Phần I, 4 câu Phần II, 6 câu Phần III):\n- Chủ đề: "${userPrompt || `${subject} ${grade}`}"\n- Môn: ${subject} | Khối: ${grade} | Mức độ: ${difficulty}\nTrả về mảng JSON thuần túy.`,
    });
  } else {
    parts.push({
      text: `Soạn đúng ${numQuestions} câu hỏi trắc nghiệm 4 lựa chọn:\n- Chủ đề: "${userPrompt || `${subject} ${grade}`}"\n- Môn: ${subject} | Khối: ${grade} | Mức độ: ${difficulty}\nTrả về mảng JSON thuần túy.`,
    });
  }

  let lastErr = '';

  for (const model of PRIMARY_CLIENT_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
        config: buildSafeModelConfig(model, {
          responseMimeType: 'application/json',
          systemInstruction,
        }),
      });

      let parsed = safeParseClientJsonWithLatex(response.text || '');
      if (parsed && !Array.isArray(parsed) && (parsed as any).questions) {
        parsed = (parsed as any).questions;
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        const mapped = parsed.map((q: any, idx: number) => {
          const rawPartType = q.partType || '';
          const isTrueFalse = rawPartType === 'part_2_true_false' || (Array.isArray(q.subStatements) && q.subStatements.length > 0);
          const isShortAnswer = rawPartType === 'part_3_short_answer' || !!q.shortAnswerKey;
          const isEssay = rawPartType === 'part_4_essay' || !!q.essayRubric;

          let partType: 'part_1_choice' | 'part_2_true_false' | 'part_3_short_answer' | 'part_4_essay' = 'part_1_choice';
          let partLabel = q.partLabel || 'Phần I. Câu trắc nghiệm nhiều phương án lựa chọn';

          if (isTrueFalse) {
            partType = 'part_2_true_false';
            partLabel = q.partLabel || 'Phần II. Câu trắc nghiệm Đúng / Sai';
          } else if (isShortAnswer) {
            partType = 'part_3_short_answer';
            partLabel = q.partLabel || 'Phần III. Câu trắc nghiệm trả lời ngắn';
          } else if (isEssay) {
            partType = 'part_4_essay';
            partLabel = q.partLabel || 'Phần IV. Tự luận';
          }

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
            options = Array.isArray(q.options) && q.options.length >= 2
              ? q.options.map((opt: any, oIdx: number) => ({
                  key: opt.key || ['A', 'B', 'C', 'D'][oIdx] || 'A',
                  text: typeof opt === 'string' ? opt : (opt.text || `Lựa chọn ${opt.key || oIdx + 1}`)
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

          return sanitizeQuizQuestionMath({
            id: q.id || `q_${Date.now()}_${idx + 1}`,
            question: q.question || `Câu hỏi ${idx + 1}`,
            partType,
            partLabel,
            options,
            subStatements,
            shortAnswerKey: q.shortAnswerKey || (isShortAnswer ? (q.correctAnswer || '') : undefined),
            essayRubric: q.essayRubric || (isEssay ? (q.explanation || 'Barem điểm chi tiết') : undefined),
            correctAnswer: String(q.correctAnswer || (isShortAnswer ? q.shortAnswerKey : (isTrueFalse ? 'a:Đ, b:S, c:Đ, d:S' : 'A'))),
            explanation: q.explanation || 'Lời giải chi tiết chuẩn SGK.',
            diagramType,
            diagramData,
            timeLimit: Number(q.timeLimit) || Number(timeLimit) || (isTrueFalse ? 60 : (isShortAnswer ? 45 : (isEssay ? 120 : 30))),
          });
        });
        return balanceQuizAnswerDistribution(mapped, `${userPrompt || grade}_${Date.now()}`);
      }
    } catch (err: any) {
      lastErr = err?.message || String(err);
      console.warn(`[Client Direct AI] Matrix quiz with ${model} failed:`, lastErr);
      if (isFatalAuthError(lastErr)) break;
    }
  }

  throw new Error(
    isFatalAuthError(lastErr)
      ? 'Gemini API Key không hợp lệ hoặc chưa được cấp quyền. Vui lòng kiểm tra lại API Key.'
      : `Không thể phân tích ma trận bằng AI (${lastErr ? lastErr.slice(0, 120) : 'phản hồi rỗng'}). Vui lòng thử lại.`
  );
}

