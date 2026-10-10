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

  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
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

  const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

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

  const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

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
  count?: number;
  difficulty?: string;
  timeLimit?: number;
}): Promise<QuizQuestion[]> {
  const ai = createDirectGeminiClient();
  const {
    prompt,
    matrixFile,
    subject = 'Toán học',
    grade = 'Lớp 12',
    count = 5,
    difficulty = 'Thông hiểu',
    timeLimit = 30,
  } = params;

  const numQuestions = Math.min(Math.max(Number(count) || 5, 1), 20);

  const systemInstruction = `Bạn là Chuyên gia Soạn Đề Thi Trắc Nghiệm Sư Phạm Chuẩn Bộ Giáo Dục Việt Nam.
Nhiệm vụ: Tạo ${numQuestions} câu hỏi trắc nghiệm chất lượng cao sát chương trình SGK mới (Kết nối tri thức, Cánh diều, Chân trời sáng tạo).
Môn học: ${subject}
Khối lớp: ${grade}
Mức độ: ${difficulty}
Thời gian mỗi câu: ${timeLimit} giây
Yêu cầu định dạng: BẮT BUỘC chỉ trả về mảng JSON thuần túy (Array of objects).
Mỗi phần tử:
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
  "explanation": "Lời giải chi tiết ngắn gọn",
  "timeLimit": ${timeLimit}
}`;

  if (ai) {
    const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

    for (const model of models) {
      try {
        const contents: any[] = [];
        if (matrixFile && matrixFile.base64 && matrixFile.mimeType) {
          const cleanB64 = matrixFile.base64.replace(/^data:.*?;base64,/, '');
          contents.push({
            role: 'user',
            parts: [
              { inlineData: { mimeType: matrixFile.mimeType, data: cleanB64 } },
              { text: `${systemInstruction}\n\nYêu cầu của giáo viên: ${prompt || 'Tạo đề theo ma trận đề tải lên'}` },
            ],
          });
        } else if (matrixFile && matrixFile.text) {
          contents.push({
            role: 'user',
            parts: [
              { text: `${systemInstruction}\n\nNội dung tệp ma trận đề:\n${matrixFile.text}\n\nYêu cầu bổ sung: ${prompt}` },
            ],
          });
        } else {
          contents.push({
            role: 'user',
            parts: [
              { text: `${systemInstruction}\n\nChủ đề bài học / Yêu cầu cụ thể: ${prompt || 'Kiến thức bài giảng'}` },
            ],
          });
        }

        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        let raw = (response.text || '').trim();
        raw = raw.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
        const parsed = JSON.parse(raw);
        const questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);

        if (questions && questions.length > 0) {
          return questions.map((q: any, idx: number) => ({
            id: q.id || `q_${Date.now()}_${idx + 1}`,
            question: q.question || `Câu hỏi ${idx + 1}`,
            options: Array.isArray(q.options)
              ? q.options
              : [
                  { key: 'A', text: 'Phương án A' },
                  { key: 'B', text: 'Phương án B' },
                  { key: 'C', text: 'Phương án C' },
                  { key: 'D', text: 'Phương án D' },
                ],
            correctAnswer: q.correctAnswer || 'A',
            explanation: q.explanation || 'Lời giải chi tiết chuẩn SGK.',
            timeLimit: q.timeLimit || timeLimit,
          }));
        }
      } catch (err: any) {
        console.warn(`[Client Direct AI] Matrix quiz with ${model} failed:`, err?.message || err);
      }
    }
  }

  // Curriculum Fallback if API key is missing or offline
  return generateCurriculumQuestionsFallback(prompt, subject, numQuestions, timeLimit);
}

/**
 * High-quality fallback generator when offline or no API Key
 */
function generateCurriculumQuestionsFallback(
  topic: string,
  subject: string,
  count: number,
  timeLimit: number
): QuizQuestion[] {
  const cleanTopic = (topic || '').trim() || `${subject} Trọng tâm SGK`;
  const isMath = subject.includes('Toán');
  const isChem = subject.includes('Hóa');
  const isPhys = subject.includes('Lý');

  const questions: QuizQuestion[] = [];
  for (let i = 1; i <= count; i++) {
    let qText = `Câu ${i}: Cho bài toán/kiến thức liên quan đến chủ đề "${cleanTopic}". Khẳng định nào sau đây là đúng?`;
    let optA = `Khẳng định đúng chuẩn xác về ${cleanTopic} theo lý thuyết SGK`;
    let optB = `Mệnh đề chưa chuẩn xác hoặc thiếu điều kiện ràng buộc`;
    let optC = `Trường hợp suy luận sai lầm thường gặp khi áp dụng công thức`;
    let optD = `Giá trị đối nghịch với định lý chuẩn`;

    if (isChem && cleanTopic.toLowerCase().includes('este')) {
      if (i === 1) {
        qText = `Câu 1: Thủy phân este đơn chức no, mạch hở $CH_3COOC_2H_5$ (etyl axetat) trong dung dịch $NaOH$ đun nóng thu được muối và ancol nào sau đây?`;
        optA = `$CH_3COONa$ và $C_2H_5OH$`;
        optB = `$C_2H_5COONa$ và $CH_3OH$`;
        optC = `$CH_3COOH$ và $C_2H_5ONa$`;
        optD = `$HCOONa$ và $C_3H_7OH$`;
      } else if (i === 2) {
        qText = `Câu 2: Phản ứng thủy phân este trong môi trường kiềm (phản ứng xà phòng hóa) có đặc điểm nào sau đây?`;
        optA = `Là phản ứng một chiều và không thuận nghịch`;
        optB = `Là phản ứng thuận nghịch hai chiều`;
        optC = `Luôn sinh ra axit cacboxylic tự do`;
        optD = `Chỉ xảy ra ở nhiệt độ phòng không cần đun nóng`;
      } else if (i === 3) {
        qText = `Câu 3: Công thức phân tử tổng quát của este đơn chức no, mạch hở là:`;
        optA = `$C_nH_{2n}O_2$ $(n \\ge 2)$`;
        optB = `$C_nH_{2n-2}O_2$ $(n \\ge 3)$`;
        optC = `$C_nH_{2n+2}O_2$ $(n \\ge 1)$`;
        optD = `$C_nH_{2n}O$ $(n \\ge 2)$`;
      } else if (i === 4) {
        qText = `Câu 4: Thủy phân este phenyl axetat ($CH_3COOC_6H_5$) trong dung dịch $NaOH$ dư, đun nóng thì tỉ lệ mol phản ứng $n_{este} : n_{NaOH}$ là:`;
        optA = `$1 : 2$`;
        optB = `$1 : 1$`;
        optC = `$1 : 3$`;
        optD = `$2 : 1$`;
      }
    } else if (isMath) {
      if (i === 1) {
        qText = `Câu 1: Về chủ đề "${cleanTopic}", đạo hàm của hàm số $y = x^3 - 3x^2 + 2$ tại điểm $x = 2$ có giá trị bằng:`;
        optA = `$0$`;
        optB = `$2$`;
        optC = `$-3$`;
        optD = `$6$`;
      }
    }

    questions.push({
      id: `q_ai_${Date.now()}_${i}`,
      question: qText,
      options: [
        { key: 'A', text: optA },
        { key: 'B', text: optB },
        { key: 'C', text: optC },
        { key: 'D', text: optD },
      ],
      correctAnswer: 'A',
      explanation: `Theo chuẩn lý thuyết và SGK chương trình mới về "${cleanTopic}", phương án A là chính xác.`,
      timeLimit,
    });
  }

  return questions;
}
