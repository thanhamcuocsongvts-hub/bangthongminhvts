import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const SERVERLESS_TEXT_MODELS = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;

function buildServerlessModelConfig(model: string, baseConfig: Record<string, any> = {}): Record<string, any> {
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

function isServerlessFatalAuthErr(msg: string): boolean {
  return msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('API key should be set');
}

function extractCompleteObjectsServerless(text: string): any[] | null {
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

function safeParseServerlessJsonWithLatex(raw: string): any {
  if (!raw) return null;
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(text);
  } catch {
    try {
      const fixed = text.replace(/(?<!\\)\\(?!["\\/bfnrtu]|u[0-9a-fA-F]{4})/g, '\\\\');
      return JSON.parse(fixed);
    } catch {
      return extractCompleteObjectsServerless(text);
    }
  }
}

function normalizeServerlessMathInText(text: string): string {
  if (!text || typeof text !== 'string') return text || '';
  return text
    .replace(/\\vec\s*\{([^}]+)\}/g, '\\overrightarrow{$1}')
    .replace(/\\vec\s+([a-zA-Z0-9']+)/g, '\\overrightarrow{$1}')
    .replace(/([a-zA-Z0-9']+)[⃗\u20D7]/g, '\\overrightarrow{$1}')
    .replace(/\\hat\s*\{([^}]+)\}/g, '\\widehat{$1}')
    .replace(/\\hat\s+([a-zA-Z0-9']+)/g, '\\widehat{$1}')
    .replace(/\\bar\s*\{([^}]+)\}/g, '\\overline{$1}')
    .replace(/\\bar\s+([a-zA-Z0-9']+)/g, '\\overline{$1}');
}

function normalizeServerlessQuestion(q: any, idx: number, difficulty: string, subject: string, timeLimit: number) {
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
  if (isTrueFalse && Array.isArray(q.subStatements)) {
    subStatements = q.subStatements.map((s: any, sIdx: number) => {
      const label = s.label || s.key || ['a', 'b', 'c', 'd'][sIdx] || `ý ${sIdx + 1}`;
      const statement = normalizeServerlessMathInText(s.statement || s.text || '');
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
          text: normalizeServerlessMathInText(typeof opt === 'string' ? opt : (opt.text || `Lựa chọn ${opt.key || oIdx + 1}`)),
        }))
      : [
          { key: 'A', text: 'Phương án A' },
          { key: 'B', text: 'Phương án B' },
          { key: 'C', text: 'Phương án C' },
          { key: 'D', text: 'Phương án D' },
        ];
  }

  return {
    id: q.id || `ai_fast_q_${Date.now()}_${idx + 1}`,
    question: normalizeServerlessMathInText(q.question || `Câu hỏi ${idx + 1}`),
    partType,
    partLabel,
    options,
    subStatements,
    shortAnswerKey: q.shortAnswerKey || (isShortAnswer ? (q.correctAnswer || '') : undefined),
    essayRubric: q.essayRubric || (isEssay ? (q.explanation || 'Hướng dẫn chấm') : undefined),
    correctAnswer: String(q.correctAnswer || (isShortAnswer ? q.shortAnswerKey : (isTrueFalse ? 'a:Đ, b:S, c:Đ, d:S' : 'A'))),
    explanation: normalizeServerlessMathInText(q.explanation || 'Lời giải chi tiết theo chuẩn sư phạm.'),
    diagramType: q.diagramType,
    diagramData: q.diagramData,
    timeLimit: Number(q.timeLimit) || Number(timeLimit) || (isTrueFalse ? 60 : (isShortAnswer ? 45 : (isEssay ? 120 : 30))),
    difficulty: q.difficulty || difficulty,
    subject,
  };
}

// In-memory audio cache for fast serverless responses (<10ms)
const ttsAudioCache = new Map<string, { buffer: Buffer; mime: string; engine: string }>();

const VOICE_STYLE_HINTS: Record<string, { geminiVoice: string; fallbackVoice: string; style: string }> = {
  Kore: {
    geminiVoice: 'Kore',
    fallbackVoice: 'Kore',
    style: 'Bright, cheerful, energetic Vietnamese female teacher speaking at a brisk, lively, engaging classroom pace with crisp articulation',
  },
  Aoede: {
    geminiVoice: 'Zephyr',
    fallbackVoice: 'Kore',
    style: 'Engaging, expressive, dynamic Vietnamese narrator speaking at a lively, natural pace with warm vocal energy',
  },
  Zephyr: {
    geminiVoice: 'Zephyr',
    fallbackVoice: 'Kore',
    style: 'Upbeat, warm, bright Vietnamese narrator speaking at a brisk, clear, captivating pace',
  },
  Puck: {
    geminiVoice: 'Puck',
    fallbackVoice: 'Fenrir',
    style: 'High-energy, enthusiastic, vibrant Vietnamese quiz show host speaking at a brisk, punchy, exciting pace',
  },
  Charon: {
    geminiVoice: 'Charon',
    fallbackVoice: 'Fenrir',
    style: 'Confident, resonant, authoritative Vietnamese male lecturer speaking at a crisp, brisk, engaging classroom pace',
  },
  Fenrir: {
    geminiVoice: 'Fenrir',
    fallbackVoice: 'Charon',
    style: 'Sharp, dynamic, professional Vietnamese television anchor speaking at a brisk, decisive, captivating pace',
  },
};

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
    `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob`,
    `https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=${lang}&client=gtx&q=${encoded}`,
    `https://translate.google.com.vn/translate_tts?ie=UTF-8&q=${encoded}&tl=${lang}&client=tw-ob`,
  ];
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://translate.google.com/',
          Accept: 'audio/mpeg, audio/*; q=0.9, */*; q=0.5',
        },
      });
      clearTimeout(timeoutId);
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
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-gemini-api-key'
  );
  res.setHeader('Access-Control-Expose-Headers', 'X-TTS-Engine');

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

  const ai = apiKey
    ? new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })
    : null;

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
      const validVoices = ['Kore', 'Aoede', 'Zephyr', 'Puck', 'Charon', 'Fenrir'];
      const voice = validVoices.includes(requestedVoice) ? requestedVoice : 'Kore';
      const presetId = String(req.query?.preset || parsedUrl.searchParams.get('preset') || voice).trim();
      const allowGemini = Boolean(ai) && parsedUrl.searchParams.get('useGemini') !== '0';
      const cacheKey = `${allowGemini ? 'g38' : 'gt'}:${voice}:${presetId}:${lang}:${text}`;

      if (ttsAudioCache.has(cacheKey)) {
        const cached = ttsAudioCache.get(cacheKey)!;
        res.setHeader('Content-Type', cached.mime);
        res.setHeader('X-TTS-Engine', cached.engine);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.setHeader('Content-Length', cached.buffer.length);
        return res.send(cached.buffer);
      }

      // 1. Gemini 3.8 Neural TTS (expressive multi-voice speechMetadata) when API key is configured
      if (allowGemini && ai) {
        try {
          const voiceSpec = VOICE_STYLE_HINTS[voice] || VOICE_STYLE_HINTS.Kore;
          const langStylePrefix =
            lang === 'en'
              ? 'Natural English pronunciation. '
              : 'Natural standard Vietnamese pronunciation (miền Bắc/chuẩn SGK). ';
          const speechStyle = `${langStylePrefix}${voiceSpec.style}`;

          const tryGenerateGeminiTts = async (modelName: string, targetVoice: string) => {
            return ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  role: 'user',
                  parts: [
                    {
                      text,
                      speechMetadata: {
                        style: speechStyle,
                      },
                    } as any,
                  ],
                },
              ],
              config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: targetVoice,
                    },
                  },
                },
              },
            });
          };

          let response: any = null;
          try {
            response = await Promise.race([
              tryGenerateGeminiTts('gemini-3.8-flash-lite-tts', voiceSpec.geminiVoice),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini TTS timeout')), 5500)),
            ]);
          } catch {
            try {
              response = await Promise.race([
                tryGenerateGeminiTts('gemini-3.8-flash-tts', voiceSpec.fallbackVoice),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini flash TTS timeout')), 5000)),
              ]);
            } catch (_) {}
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
            const rawBytes = Buffer.from(audioBase64, 'base64');
            const hasRiffHeader = rawBytes.length > 12 && rawBytes.toString('ascii', 0, 4) === 'RIFF';
            let wavBuffer = rawBytes;
            if (!hasRiffHeader && (mimeType.includes('pcm') || mimeType.includes('raw') || mimeType.includes('l16'))) {
              wavBuffer = pcmToWavBuffer(rawBytes, 24000);
              mimeType = 'audio/wav';
            } else if (hasRiffHeader) {
              mimeType = 'audio/wav';
            }
            if (ttsAudioCache.size > 200) {
              const firstKey = ttsAudioCache.keys().next().value;
              if (firstKey) ttsAudioCache.delete(firstKey);
            }
            ttsAudioCache.set(cacheKey, { buffer: wavBuffer, mime: mimeType, engine: 'gemini-3.8' });
            res.setHeader('Content-Type', mimeType);
            res.setHeader('X-TTS-Engine', 'gemini-3.8');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('Content-Length', wavBuffer.length);
            return res.send(wavBuffer);
          }
        } catch (geminiErr) {
          console.warn('[Vercel Serverless] Gemini 3.8 TTS error, falling back to Google TTS:', geminiErr);
        }
      }

      // 2. Fast Google Translate TTS Stream with parallel chunk fetching
      const chunks = chunkTextForTTS(text, 180);
      const chunkPromises = chunks.map((chunk) => fetchSingleTtsAudio(chunk, lang));
      const chunkResults = await Promise.all(chunkPromises);
      const audioBuffers: Buffer[] = chunkResults.filter((b): b is Buffer => b !== null);

      if (audioBuffers.length === 0) {
        return res.status(502).send('Không thể tạo giọng đọc tiếng Việt từ máy chủ');
      }

      const combinedBuffer = Buffer.concat(audioBuffers);
      if (ttsAudioCache.size > 200) {
        const firstKey = ttsAudioCache.keys().next().value;
        if (firstKey) ttsAudioCache.delete(firstKey);
      }
      ttsAudioCache.set(cacheKey, { buffer: combinedBuffer, mime: 'audio/mpeg', engine: 'google-translate' });

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('X-TTS-Engine', 'google-translate');
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
    let lastErr = '';
    for (const model of SERVERLESS_TEXT_MODELS) {
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
          config: buildServerlessModelConfig(model, {
            temperature: 0.1,
          }),
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
        if (isServerlessFatalAuthErr(lastErr)) break;
      }
    }
    return res.status(200).json({ success: true, text: '' });
  }

  // 2. Generate Quiz
  if (url.includes('/api/ai/generate-quiz') && req.method === 'POST') {
    const { topic, subject = 'Toán học', grade = 'Lớp 12', count = 5, difficulty = 'Thông hiểu' } = req.body || {};
    const numQuestions = Math.min(Math.max(Number(count) || 5, 1), 20);

    if (ai) {
      let lastErr = '';
      for (const model of SERVERLESS_TEXT_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: `Soạn ${numQuestions} câu hỏi trắc nghiệm chất lượng cao về chủ đề: "${topic}". Môn: ${subject}, Khối: ${grade}, Mức độ: ${difficulty}.
Trả về JSON array thuần túy: [{"id":"q1","question":"...","options":[{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],"correctAnswer":"A","explanation":"...","timeLimit":30}]`,
            config: buildServerlessModelConfig(model, { responseMimeType: 'application/json', temperature: 0.2 }),
          });
          const parsed = safeParseServerlessJsonWithLatex(response.text || '[]');
          const questions = Array.isArray(parsed) ? parsed : parsed?.questions || [];
          if (questions && questions.length > 0) {
            return res.status(200).json({ success: true, questions });
          }
        } catch (e: any) {
          lastErr = e?.message || String(e);
          console.warn(`[Vercel Serverless] Quiz with ${model} failed, trying next...`, lastErr);
          if (isServerlessFatalAuthErr(lastErr)) break;
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
      isMatrixMode = false,
    } = req.body || {};

    const hasUploadedFile = Boolean(matrixFile && (matrixFile.text || matrixFile.base64));
    const isAutoMatrix = count === 'auto_matrix';
    const isMatrixExplicit = isMatrixMode === true || isAutoMatrix || hasUploadedFile;
    const numQuestions = hasUploadedFile || isAutoMatrix ? 22 : Math.min(Math.max(Number(count) || 5, 1), 50);
    const rawUserPrompt = (prompt || '').trim();
    const isGenericDefaultPrompt =
      hasUploadedFile &&
      (!rawUserPrompt ||
        rawUserPrompt.toLowerCase() === 'khảo sát hàm số và đồ thị' ||
        rawUserPrompt.toLowerCase() === 'tạo đề theo ma trận đề tải lên');
    const userPrompt = isGenericDefaultPrompt ? '' : rawUserPrompt;

    if (!ai) {
      return res.status(403).json({
        success: false,
        error: 'Chưa cấu hình Gemini API Key. Vui lòng thiết lập API Key để tạo đề từ ma trận.',
      });
    }

    const systemInstruction = `Bạn là chuyên gia Khảo thí & Soạn đề kiểm tra chuẩn Chương trình GDPT 2018 Việt Nam (THPT/THCS).
Nhiệm vụ tối thượng: ${
      hasUploadedFile
        ? `ĐỌC THẬT KỸ TỆP MA TRẬN / ĐỀ CƯƠNG ĐÍNH KÈM ("${matrixFile?.fileName || 'ma trận'}") và TẠO ĐỀ KIỂM TRA BÁM SÁT 100% ĐÚNG NỘI DUNG, CHỦ ĐỀ, KHỐI LỚP (${grade}), DẠNG TOÁN VÀ SỐ LƯỢNG CÂU HỎI CỦA MA TRẬN/ĐỀ CƯƠNG ĐÓ.`
        : `Tạo đề thi chuẩn xác bám sát 100% chủ đề được yêu cầu ("${userPrompt || `${subject} ${grade}`}"), môn ${subject}, khối ${grade}, mức độ ${difficulty}.`
    }

*** QUY TẮC BẮT BUỘC VỀ NỘI DUNG & CẤU TRÚC: ***
${
  hasUploadedFile
    ? `1. NGUYÊN TẮC BÁM SÁT TỆP MA TRẬN / ĐỀ CƯƠNG ĐÍNH KÈM:
   - TỆP ĐÍNH KÈM LÀ NGUỒN CHÂN LÝ DUY NHẤT.
   - TUYỆT ĐỐI KHÔNG tự ý mặc định lấy đề "Khảo sát hàm số Lớp 12" nếu ma trận không phải chủ đề đó. Phải bám sát 100% chủ đề, khối lớp (${grade}), mức độ và số câu từng phần trong tệp.${
     userPrompt ? `\n   - Yêu cầu bổ sung của giáo viên: "${userPrompt}".` : ''
   }`
    : `1. Toàn bộ 100% câu hỏi PHẢI đúng chủ đề "${userPrompt || `${subject} ${grade}`}", môn ${subject}, khối ${grade}.`
}
${
  !hasUploadedFile && isAutoMatrix
    ? `2. CHẾ ĐỘ MA TRẬN CHUẨN BGD 2025: Tạo đủ 22 câu gồm 12 câu Phần I (part_1_choice), 4 câu Phần II Đúng/Sai (part_2_true_false, mỗi câu 4 ý a, b, c, d), và 6 câu Phần III Trả lời ngắn (part_3_short_answer).`
    : !hasUploadedFile
      ? `2. Tạo đúng ${numQuestions} câu hỏi trắc nghiệm bám sát chủ đề "${userPrompt || `${subject} ${grade}`}".`
      : ''
}
ĐỊNH DẠNG JSON MỖI CÂU HỎI (BẮT BUỘC TRẢ VỀ MẢNG JSON THUẦN TÚY [ { ... } ]):
1. Phần I: { "id": "q1", "partType": "part_1_choice", "partLabel": "Phần I. Câu trắc nghiệm nhiều phương án lựa chọn", "question": "...", "options": [{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}], "correctAnswer": "A", "explanation": "...", "timeLimit": ${timeLimit} }
2. Phần II: { "id": "q2", "partType": "part_2_true_false", "partLabel": "Phần II. Câu trắc nghiệm Đúng / Sai", "question": "...", "subStatements": [{"label":"a","statement":"...","correct":true},{"label":"b","statement":"...","correct":false},{"label":"c","statement":"...","correct":true},{"label":"d","statement":"...","correct":false}], "correctAnswer": "a:Đ, b:S, c:Đ, d:S", "options": [], "explanation": "...", "timeLimit": 60 }
3. Phần III: { "id": "q3", "partType": "part_3_short_answer", "partLabel": "Phần III. Câu trắc nghiệm trả lời ngắn", "question": "...", "shortAnswerKey": "2,5", "correctAnswer": "2,5", "options": [], "explanation": "...", "timeLimit": 45 }
4. Phần IV: { "id": "q4", "partType": "part_4_essay", "partLabel": "Phần IV. Tự luận", "question": "...", "essayRubric": "Thang điểm...", "correctAnswer": "Lời giải mẫu", "options": [], "explanation": "...", "timeLimit": 120 }`;

    let lastErr = '';

    for (const model of SERVERLESS_TEXT_MODELS) {
      try {
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
            }\nHãy phân tích kỹ tệp ma trận/đề cương đính kèm ở trên và tạo ĐÚNG các câu hỏi bám sát 100% nội dung ma trận/đề cương đó. Trả về mảng JSON thuần túy.`,
          });
        } else if (isMatrixExplicit) {
          parts.push({
            text: `Soạn đề theo cấu trúc ma trận GDPT 2018 (12 câu Phần I, 4 câu Phần II, 6 câu Phần III):\n- Chủ đề: "${userPrompt || `${subject} ${grade}`}"\n- Môn: ${subject} | Khối: ${grade} | Mức độ: ${difficulty}`,
          });
        } else {
          parts.push({
            text: `Soạn đúng ${numQuestions} câu hỏi trắc nghiệm 4 lựa chọn:\n- Chủ đề: "${userPrompt || `${subject} ${grade}`}"\n- Môn: ${subject} | Khối: ${grade} | Mức độ: ${difficulty}`,
          });
        }

        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: buildServerlessModelConfig(model, {
            responseMimeType: 'application/json',
            systemInstruction,
          }),
        });

        let parsed = safeParseServerlessJsonWithLatex(response.text || '');
        if (parsed && !Array.isArray(parsed) && parsed.questions) {
          parsed = parsed.questions;
        }

        if (Array.isArray(parsed) && parsed.length > 0) {
          const questions = parsed.map((q: any, idx: number) =>
            normalizeServerlessQuestion(q, idx, difficulty, subject, Number(timeLimit) || 30)
          );
          return res.status(200).json({ success: true, questions });
        }
      } catch (e: any) {
        lastErr = e?.message || String(e);
        console.warn(`[Vercel Serverless] Fast matrix quiz with ${model} failed:`, lastErr);
        if (isServerlessFatalAuthErr(lastErr)) break;
      }
    }

    const isAuth = isServerlessFatalAuthErr(lastErr);
    const isQuota = lastErr.includes('RESOURCE_EXHAUSTED') || lastErr.includes('429');
    return res.status(isAuth ? 403 : isQuota ? 429 : 502).json({
      success: false,
      error: isAuth
        ? 'Chưa cấu hình hoặc sai Gemini API Key.'
        : isQuota
          ? 'Hệ thống AI đang quá tải giới hạn lượt gọi (429). Vui lòng thử lại sau ít giây.'
          : `Không thể phân tích ma trận bằng AI (${lastErr ? lastErr.slice(0, 120) : 'phản hồi rỗng'}). Vui lòng thử lại.`,
    });
  }

  return res.status(404).json({ error: 'Endpoint not found on serverless router' });
}
