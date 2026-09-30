import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = req.url || '';

  if (url.includes('/api/health') || url === '/api') {
    return res.status(200).json({ status: 'ok', server: 'vercel-serverless' });
  }

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.VITE_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is not configured in Vercel environment variables.',
    });
  }

  const ai = new GoogleGenAI({ apiKey });

  // 1. Handwriting Recognition
  if (url.includes('/api/ai/recognize-handwriting') && req.method === 'POST') {
    const { imageBase64, mimeType = 'image/jpeg', context = 'bài giảng lớp học' } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: 'Thiếu dữ liệu ảnh' });
    }
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];
    let lastErr = '';
    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: cleanBase64 } },
                {
                  text: `[VAI TRÒ]: Bạn là một GIÁO VIÊN VIỆT NAM ĐỌC VÀ CHẤM CHỮ VIẾT TAY TRÊN BẢNG LỚP HỌC.
Dù chữ viết xấu, viết ẩu, viết vội, nét nghệch ngoạc, thiếu dấu hoặc dính nét, hãy dựa vào ngữ cảnh: ${context} để đọc và suy luận ĐÚNG 100% từ ngữ hoặc công thức toán học/tiếng Việt.
CHỈ TRẢ VỀ DUY NHẤT VĂN BẢN ĐÃ NHẬN DIỆN, KHÔNG GIẢI THÍCH, KHÔNG NGOẶC KÉP.`,
                },
              ],
            },
          ],
          config: { temperature: 0.1, maxOutputTokens: 200 },
        });
        const text = (response.text || '').trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
        return res.status(200).json({ success: true, text });
      } catch (e: any) {
        lastErr = e?.message || String(e);
        console.warn(`[Vercel Serverless] Handwriting with ${model} failed, trying next...`, lastErr);
      }
    }
    return res.status(500).json({ error: lastErr || 'Gemini error' });
  }

  // 2. Generate Quiz
  if (url.includes('/api/ai/generate-quiz') && req.method === 'POST') {
    const { topic, subject = 'Toán học', grade = 'Lớp 12', count = 5, difficulty = 'Thông hiểu' } = req.body || {};
    const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];
    let lastErr = '';
    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: `Soạn ${count} câu hỏi trắc nghiệm chất lượng cao về chủ đề: "${topic}". Môn: ${subject}, Khối: ${grade}, Mức độ: ${difficulty}.
Trả về JSON array thuần túy: [{"id":"q1","question":"...","options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],"correctAnswer":"A","explanation":"...","timeLimit":30}]`,
          config: { responseMimeType: 'application/json', temperature: 0.2 },
        });
        const parsed = JSON.parse((response.text || '[]').trim());
        const questions = Array.isArray(parsed) ? parsed : parsed.questions || [];
        return res.status(200).json({ success: true, questions });
      } catch (e: any) {
        lastErr = e?.message || String(e);
        console.warn(`[Vercel Serverless] Quiz with ${model} failed, trying next...`, lastErr);
      }
    }
    return res.status(500).json({ error: lastErr || 'Gemini quiz error' });
  }

  return res.status(404).json({ error: 'Endpoint not found on serverless router' });
}
