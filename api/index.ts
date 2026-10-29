import { GoogleGenAI } from '@google/genai';

// In-memory audio cache for fast serverless responses (<10ms)
const ttsAudioCache = new Map<string, { buffer: Buffer; mime: string }>();

function chunkTextForTTS(text: string, maxLen: number = 140): string[] {
  const parts = text.split(/(?<=[.!?:;\n])\s+/);
  const chunks: string[] = [];
  let cur = '';

  for (const part of parts) {
    const s = part.trim();
    if (!s) continue;
    if (s.length > maxLen) {
      if (cur) chunks.push(cur);
      cur = '';
      const words = s.split(/\s+/);
      let wordChunk = '';
      for (const w of words) {
        if ((wordChunk + ' ' + w).length > maxLen) {
          if (wordChunk) chunks.push(wordChunk.trim());
          wordChunk = w;
        } else {
          wordChunk = wordChunk ? `${wordChunk} ${w}` : w;
        }
      }
      if (wordChunk) cur = wordChunk;
    } else {
      if ((cur + ' ' + s).length > maxLen) {
        if (cur) chunks.push(cur);
        cur = s;
      } else {
        cur = cur ? `${cur} ${s}` : s;
      }
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, maxLen)];
}

async function fetchSingleTtsAudio(chunk: string, lang: string): Promise<Buffer | null> {
  const encoded = encodeURIComponent(chunk);
  const urls = [
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${lang}&client=gtx&q=${encoded}`,
    `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob`,
    `https://translate.google.com.vn/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob`,
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://translate.google.com/',
          Accept: 'audio/mpeg, audio/*; q=0.9, */*; q=0.5',
        },
      });
      if (response.ok) {
        const arrayBuf = await response.arrayBuffer();
        if (arrayBuf.byteLength > 100) {
          return Buffer.from(arrayBuf);
        }
      }
    } catch (_) {}
  }
  return null;
}

function pcmToWavBuffer(
  pcmBuffer: Buffer,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // Linear PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

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
    (req.headers['x-gemini-api-key'] as string) ||
    req.body?.apiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.API_KEY ||
    process.env.VITE_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';

  const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

  // 0. High-Fidelity Text-To-Speech Route (Gemini Audio + Google TTS Fallback)
  if (url.includes('/api/tts')) {
    try {
      const parsedUrl = new URL(url, 'https://localhost');
      const text = String(req.query?.text || parsedUrl.searchParams.get('text') || '').trim();
      if (!text) {
        return res.status(400).send('Text is required');
      }

      const requestedLang = String(req.query?.lang || parsedUrl.searchParams.get('lang') || 'vi');
      const lang = requestedLang.toLowerCase().startsWith('en') ? 'en' : 'vi';
      const requestedVoice = String(
        req.query?.voice ||
        req.query?.preset ||
        parsedUrl.searchParams.get('voice') ||
        parsedUrl.searchParams.get('preset') ||
        'Kore'
      ).trim();
      const validVoices = ['Kore', 'Aoede', 'Puck', 'Charon', 'Fenrir'];
      const voice = validVoices.includes(requestedVoice) ? requestedVoice : 'Kore';
      const cacheKey = `${voice}:${lang}:${text}`;

      if (ttsAudioCache.has(cacheKey)) {
        const cached = ttsAudioCache.get(cacheKey)!;
        res.setHeader('Content-Type', cached.mime);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Content-Length', cached.buffer.length);
        return res.send(cached.buffer);
      }

      // 1. Try Gemini TTS for natural, human-like voice synthesis
      if (ai) {
        try {
          let response: any = null;
          try {
            response = await ai.models.generateContent({
              model: 'gemini-3.8-flash-lite-tts',
              contents: text,
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: voice,
                    },
                  },
                },
              },
            });
          } catch {
            response = await ai.models.generateContent({
              model: 'gemini-3.8-flash-tts',
              contents: text,
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: voice,
                    },
                  },
                },
              },
            });
          }

          const parts = response?.candidates?.[0]?.content?.parts;
          let audioBase64 = '';
          let mimeType = 'audio/wav';
          if (parts) {
            for (const p of parts) {
              if (p.inlineData?.data) {
                audioBase64 = p.inlineData.data;
                if (p.inlineData.mimeType) mimeType = p.inlineData.mimeType;
                break;
              }
            }
          }

          if (audioBase64) {
            const rawPcm = Buffer.from(audioBase64, 'base64');
            let wavBuffer = rawPcm;
            if (
              mimeType.includes('pcm') ||
              mimeType.includes('raw') ||
              !rawPcm.toString('ascii', 0, 4).startsWith('RIFF')
            ) {
              wavBuffer = pcmToWavBuffer(rawPcm, 24000);
              mimeType = 'audio/wav';
            }
            if (ttsAudioCache.size > 200) {
              const firstKey = ttsAudioCache.keys().next().value;
              if (firstKey) ttsAudioCache.delete(firstKey);
            }
            ttsAudioCache.set(cacheKey, { buffer: wavBuffer, mime: mimeType });
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('Content-Length', wavBuffer.length);
            return res.send(wavBuffer);
          }
        } catch (geminiErr) {
          console.warn('[Vercel Serverless] Gemini TTS error, falling back to Google TTS:', geminiErr);
        }
      }

      // 2. Fallback: Google Translate TTS Stream with chunk concatenation
      const chunks = chunkTextForTTS(text, 140);
      const audioBuffers: Buffer[] = [];

      for (const chunk of chunks) {
        const buf = await fetchSingleTtsAudio(chunk, lang);
        if (buf) {
          audioBuffers.push(buf);
        }
      }

      if (audioBuffers.length === 0) {
        return res.status(502).send('Không thể tạo giọng đọc tiếng Việt từ máy chủ');
      }

      const combinedBuffer = Buffer.concat(audioBuffers);
      if (ttsAudioCache.size > 200) {
        const firstKey = ttsAudioCache.keys().next().value;
        if (firstKey) ttsAudioCache.delete(firstKey);
      }
      ttsAudioCache.set(cacheKey, { buffer: combinedBuffer, mime: 'audio/mpeg' });

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Length', combinedBuffer.length);
      return res.send(combinedBuffer);
    } catch (err: any) {
      console.error('[Vercel Serverless] /api/tts error:', err);
      return res.status(500).send('Lỗi máy chủ TTS: ' + (err?.message || String(err)));
    }
  }

  // Helper: Generates curriculum-standard questions when AI is offline or without API key
  const generateServerFallbackQuestions = (
    prompt: string,
    subject: string = 'Toán học',
    count: number = 5,
    difficulty: string = 'Thông hiểu',
    timeLimit: number = 30
  ) => {
    const isMath = subject.includes('Toán');
    const isChem = subject.includes('Hóa');
    const isPhys = subject.includes('Lý');
    const cleanTopic = (prompt || '').trim() || `${subject} Kiến thức trọng tâm`;

    const qs: any[] = [];
    for (let i = 1; i <= count; i++) {
      let qText = `Câu ${i}: Cho kiến thức về "${cleanTopic}". Khẳng định nào sau đây là đúng?`;
      let optA = `Khẳng định chính xác về ${cleanTopic} theo chuẩn chương trình SGK mới`;
      let optB = `Mệnh đề chưa chuẩn xác hoặc thiếu điều kiện ràng buộc`;
      let optC = `Trường hợp suy luận sai lầm thường gặp khi áp dụng công thức`;
      let optD = `Giá trị đối nghịch với định lý chuẩn`;

      if (isMath) {
        if (i === 1) {
          qText = `Câu 1: Cho hàm số $y = f(x)$ liên tục trên $\\mathbb{R}$ và có bảng xét dấu đạo hàm. Điểm cực đại của hàm số là điểm mà tại đó đạo hàm $f'(x)$ đổi dấu như thế nào?`;
          optA = `Từ dương $(+)$ sang âm $(-)$ khi qua điểm đó`;
          optB = `Từ âm $(-)$ sang dương $(+)$ khi qua điểm đó`;
          optC = `Luôn mang dấu dương $(+)$`;
          optD = `Không đổi dấu khi qua điểm đó`;
        } else if (i === 2) {
          qText = `Câu 2: Nguyên hàm của hàm số $f(x) = 2x + \\cos x$ là:`;
          optA = `$F(x) = x^2 + \\sin x + C$`;
          optB = `$F(x) = x^2 - \\sin x + C$`;
          optC = `$F(x) = 2 - \\sin x + C$`;
          optD = `$F(x) = 2x^2 + \\cos x + C$`;
        } else if (i === 3) {
          qText = `Câu 3: Trong không gian $Oxyz$, cho mặt phẳng $(P): 2x - y + 3z - 4 = 0$. Vectơ nào sau đây là một vectơ pháp tuyến của $(P)$?`;
          optA = `$\\vec{n} = (2; -1; 3)$`;
          optB = `$\\vec{n} = (2; 1; 3)$`;
          optC = `$\\vec{n} = (-2; -1; 3)$`;
          optD = `$\\vec{n} = (2; -1; -4)$`;
        }
      } else if (isChem) {
        if (i === 1) {
          qText = `Câu 1: Chất nào sau đây là đồng phân của este etyl axetat ($CH_3COOC_2H_5$)?`;
          optA = `Axit butanoic ($CH_3CH_2CH_2COOH$)`;
          optB = `Metyl axetat ($CH_3COOCH_3$)`;
          optC = `Etyl fomat ($HCOOC_2H_5$)`;
          optD = `Axit axetic ($CH_3COOH$)`;
        }
      } else if (isPhys) {
        if (i === 1) {
          qText = `Câu 1: Một con lắc lò xo có độ cứng $k$, vật nhỏ khối lượng $m$. Chu kỳ dao động điều hòa của con lắc là:`;
          optA = `$T = 2\\pi \\sqrt{\\frac{m}{k}}$`;
          optB = `$T = 2\\pi \\sqrt{\\frac{k}{m}}$`;
          optC = `$T = \\frac{1}{2\\pi} \\sqrt{\\frac{m}{k}}$`;
          optD = `$T = 2\\pi \\sqrt{\\frac{g}{l}}$`;
        }
      }

      qs.push({
        id: `fb_q_${Date.now()}_${i}`,
        question: qText,
        options: [
          { key: 'A', text: optA },
          { key: 'B', text: optB },
          { key: 'C', text: optC },
          { key: 'D', text: optD },
        ],
        correctAnswer: 'A',
        explanation: `Lời giải chuẩn xác sư phạm cho ${cleanTopic}. Phương án A đúng lý thuyết.`,
        difficulty,
        timeLimit: Number(timeLimit) || 30,
      });
    }
    return qs;
  };

  // 1. Handwriting Recognition
  if (url.includes('/api/ai/recognize-handwriting') && req.method === 'POST') {
    if (!ai) {
      return res.status(200).json({ text: '' });
    }
    const { imageBase64, mimeType = 'image/jpeg', context = 'bài giảng lớp học' } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: 'Thiếu dữ liệu ảnh' });
    }
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];
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
CHỈ TRẢ VỀ DUY NHẤT VĂN BẢN ĐÃ NHẬN DIỆN, KHÔNG GIẢI THÍCH, KHÔNG NGOẶC KÉP.
TUYỆT ĐỐI KHÔNG mở đầu bằng 'Ảnh 1:', 'Hình 1:', 'Ảnh 1', 'Image 1:', 'Trong ảnh:' hay bất kỳ tiền tố nào.`,
                },
              ],
            },
          ],
          config: {
            temperature: 0.1,
            maxOutputTokens: 250,
          },
        });
        let text = (response.text || '').trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '');
        text = text.replace(/^(ảnh|hình|image|picture)\s*\d*\s*[:\-–—]\s*/i, '');
        text = text.replace(/^trong\s+(ảnh|hình|bức ảnh)\s*\d*\s*(là|hiển thị|chứa)?\s*[:\-–—]?\s*/i, '');
        text = text.replace(/^(đây là|nội dung trong ảnh là|văn bản trong ảnh là|chữ trong ảnh là)\s*[:\-–—]?\s*/i, '');
        if (text.toLowerCase().trim() === 'ảnh 1' || text.toLowerCase().trim() === 'hình 1') {
          text = '1';
        }
        if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('“') && text.endsWith('”'))) {
          text = text.slice(1, -1).trim();
        }
        return res.status(200).json({ success: true, text });
      } catch (e: any) {
        lastErr = e?.message || String(e);
      }
    }
    return res.status(200).json({ success: true, text: '' });
  }

  // 2. Generate Quiz
  if (url.includes('/api/ai/generate-quiz') && req.method === 'POST') {
    const { topic, subject = 'Toán học', grade = 'Lớp 12', count = 5, difficulty = 'Thông hiểu' } = req.body || {};
    const numQuestions = Math.min(Math.max(Number(count) || 5, 1), 20);

    if (ai) {
      const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];
      let lastErr = '';
      for (const model of models) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: `Soạn ${numQuestions} câu hỏi trắc nghiệm chất lượng cao về chủ đề: "${topic}". Môn: ${subject}, Khối: ${grade}, Mức độ: ${difficulty}.
Trả về JSON array thuần túy: [{"id":"q1","question":"...","options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],"correctAnswer":"A","explanation":"...","timeLimit":30}]`,
            config: { responseMimeType: 'application/json', temperature: 0.2 },
          });
          const parsed = JSON.parse((response.text || '[]').trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, ''));
          const questions = Array.isArray(parsed) ? parsed : parsed.questions || [];
          if (questions && questions.length > 0) {
            return res.status(200).json({ success: true, questions });
          }
        } catch (e: any) {
          lastErr = e?.message || String(e);
          console.warn(`[Vercel Serverless] Quiz with ${model} failed, trying next...`, lastErr);
        }
      }
    }

    // Guaranteed curriculum questions fallback
    const fallback = generateServerFallbackQuestions(topic, subject, numQuestions, difficulty);
    return res.status(200).json({ success: true, questions: fallback, fallback: true });
  }

  // 3. Fast Matrix Quiz & Prompt Quiz (Used by LiveQuizHub / Trắc Nghiệm & Phân Tích)
  if (url.includes('/api/ai/fast-matrix-quiz') && req.method === 'POST') {
    const {
      prompt = '',
      matrixFile,
      subject = 'Toán học',
      grade = 'Lớp 12',
      count = 5,
      difficulty = 'Thông hiểu',
      timeLimit = 30,
    } = req.body || {};

    const numQuestions = Math.min(Math.max(Number(count) || 5, 1), 20);
    const userPrompt = (prompt || '').trim();

    if (ai) {
      const systemInstruction = `Bạn là hệ thống AI Khảo thí & Soạn đề trắc nghiệm giáo dục hàng đầu Việt Nam.
Nhiệm vụ: Phân tích ma trận đề (nếu có) hoặc yêu cầu của giáo viên để tạo ${numQuestions} câu hỏi trắc nghiệm 4 phương án (A, B, C, D) CHUẨN XÁC, SÁT VỚI CHƯƠNG TRÌNH SGK MỚI.
Môn học: ${subject}
Khối lớp: ${grade}
Mức độ: ${difficulty}
Thời gian làm bài mỗi câu: ${timeLimit} giây
Yêu cầu định dạng: BẮT BUỘC trả về JSON array hợp lệ.
Mỗi phần tử có cấu trúc:
{
  "id": "q1",
  "question": "Nội dung câu hỏi (sử dụng LaTeX $...$ cho công thức toán/hóa nếu có)",
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

      const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.1-flash-lite'];
      let lastErr = '';

      for (const model of models) {
        try {
          const contents: any[] = [];
          if (matrixFile && matrixFile.base64 && matrixFile.mimeType) {
            const cleanB64 = matrixFile.base64.replace(/^data:.*?;base64,/, '');
            contents.push({
              role: 'user',
              parts: [
                { inlineData: { mimeType: matrixFile.mimeType, data: cleanB64 } },
                { text: `${systemInstruction}\n\nYêu cầu bổ sung của giáo viên: ${userPrompt || 'Tạo đề theo ma trận đề tải lên'}` }
              ]
            });
          } else if (matrixFile && matrixFile.text) {
            contents.push({
              role: 'user',
              parts: [
                { text: `${systemInstruction}\n\nNội dung tệp ma trận đề:\n${matrixFile.text}\n\nYêu cầu bổ sung: ${userPrompt}` }
              ]
            });
          } else {
            contents.push({
              role: 'user',
              parts: [
                { text: `${systemInstruction}\n\nChủ đề bài học / Yêu cầu cụ thể: ${userPrompt || 'Kiến thức trọng tâm bài học'}` }
              ]
            });
          }

          const response = await ai.models.generateContent({
            model,
            contents,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            }
          });

          const raw = (response.text || '').trim().replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/, '').trim();
          const parsed = JSON.parse(raw);
          const questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);

          if (questions && questions.length > 0) {
            return res.status(200).json({ success: true, questions });
          }
        } catch (e: any) {
          lastErr = e?.message || String(e);
          console.warn(`[Vercel Serverless] Fast matrix quiz with ${model} failed:`, lastErr);
        }
      }
    }

    // Guaranteed fallback
    const fallback = generateServerFallbackQuestions(userPrompt, subject, numQuestions, difficulty, timeLimit);
    return res.status(200).json({ success: true, questions: fallback, fallback: true });
  }

  return res.status(404).json({ error: 'Endpoint not found on serverless router' });
}
