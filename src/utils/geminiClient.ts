import { GoogleGenAI } from '@google/genai';
import { QuizQuestion } from '../types';

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

  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];
  let lastErr = '';

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: 'Xin chào, trả về chữ "OK" để xác nhận kết nối thành công.',
        config: {
          maxOutputTokens: 10,
          temperature: 0.1,
        },
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

  const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];

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
   - CHỈ TRẢ VỀ DUY NHẤT VĂN BẢN ĐÃ NHẬN DIỆN. KHÔNG giải thích, KHÔNG thêm lời chào, KHÔNG bọc trong dấu ngoặc kép thừa.`;

  for (const model of models) {
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
        config: {
          temperature: 0.1,
          maxOutputTokens: 250,
        },
      });

      let text = (response.text || '').trim();
      text = text.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
      if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('“') && text.endsWith('”'))) {
        text = text.slice(1, -1).trim();
      }
      if (text) return text;
    } catch (e: any) {
      console.warn(`Direct Gemini handwriting error with ${model}:`, e?.message || e);
    }
  }

  return '';
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

YÊU CẦU ĐẶC BIỆT:
1. Mỗi câu hỏi gồm đúng 4 lựa chọn (A, B, C, D).
2. Đáp án đúng correctAnswer phải là một trong các chữ cái: "A", "B", "C", "D".
3. Có phần giải thích chi tiết, sư phạm, chuẩn xác.
4. Công thức toán, lý, hóa viết bằng cú pháp LaTeX chuẩn bọc trong cặp dấu $...$ (ví dụ: $x^2 + 2x - 3 = 0$).
5. BẮT BUỘC chỉ trả về định dạng JSON thuần túy (không bọc trong markdown code block, không giải thích ngoài lề):
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
    "correctAnswer": "A",
    "explanation": "Giải thích chi tiết vì sao A đúng...",
    "timeLimit": 30
  }
]`;

  const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      let raw = (response.text || '').trim();
      raw = raw.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed && Array.isArray(parsed.questions)) {
        return parsed.questions;
      }
    } catch (e: any) {
      console.warn(`Direct Gemini generateQuiz error with ${model}:`, e?.message || e);
    }
  }

  return [];
}
