/**
 * AI Text-To-Speech (TTS) Service for SmartBoard 75 Pro
 * 
 * BẮT BUỘC 100% TIẾNG VIỆT (KỂ CẢ CHỮ SỐ VÀ CÔNG THỨC TOÁN):
 * 1. utterance.lang = 'vi-VN' cố định tuyệt đối.
 * 2. Luôn lọc và gán voice tiếng Việt (vi-VN, VIE, Vietnamese, Hoài My, Nam Minh, Google Tiếng Việt).
 * 3. Bộ tiền xử lý chữ số:
 *    - "1 2 3 4" -> "Một, hai, ba, bốn" (chống đọc "One, Two, Three, Four").
 *    - "Câu 1" -> "Câu một", "Bài 2" -> "Bài hai".
 *    - "x = 2" -> "x bằng hai", "12a" -> "mười hai a".
 *    - Chuyển toàn bộ ký hiệu toán sang tiếng Việt.
 * 4. 4 sắc thái giọng:
 *    - 👩‍🏫 Cô giáo dịu dàng
 *    - 👨‍🏫 Thầy giáo trầm ấm
 *    - ⚡ MC Sôi động / Năng động
 *    - 🎙️ Phát thanh viên chuẩn
 */

import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey, isGeminiConfigured } from './geminiClient';
import { cleanPdfVietnameseText } from './pdfTextExtractor';

export { cleanPdfVietnameseText };

/**
 * Đồng bộ API Key trên môi trường Web thực tế (Vercel) và AI Studio Preview:
 * Thứ tự ưu tiên:
 * 1. Key người dùng nhập trong localStorage (từ nút "Khóa AI") - CHỈ LẤY NẾU HỢP LỆ (bắt đầu bằng "AIza" và > 30 ký tự)
 * 2. process.env.GEMINI_API_KEY (ưu tiên cho môi trường AI Studio Preview)
 * 3. import.meta.env.VITE_GEMINI_API_KEY (cho Vercel / Vite client)
 * 4. getGeminiApiKey() từ geminiClient dự phòng
 */
function isValidGeminiApiKey(key: any): boolean {
  return typeof key === 'string' && key.trim().startsWith('AIza') && key.trim().length > 30;
}

export function getEffectiveGeminiApiKey(): string {
  // 1. import.meta.env?.VITE_GEMINI_API_KEY (ưu tiên trên Vercel / Vite client)
  try {
    const viteKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (viteKey && typeof viteKey === 'string' && viteKey.trim().length > 5) {
      return viteKey.trim();
    }
  } catch (_) {}

  // 2. process.env?.GEMINI_API_KEY (ưu tiên trên AI Studio Preview / Node)
  try {
    if (typeof process !== 'undefined' && process.env) {
      const pKey = process.env.GEMINI_API_KEY || (process.env as any).VITE_GEMINI_API_KEY;
      if (pKey && typeof pKey === 'string' && pKey.trim().length > 5) {
        return pKey.trim();
      }
    }
  } catch (_) {}

  // 3. localStorage.getItem('GEMINI_API_KEY') (người dùng nhập từ nút Khóa AI)
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const storageKeys = [
        'GEMINI_API_KEY',
        'gemini_api_key',
        'VITE_GEMINI_API_KEY',
        'smartboard_gemini_api_key',
        'user_gemini_api_key',
        'custom_gemini_api_key',
        'ai_api_key',
      ];
      for (const k of storageKeys) {
        const val = localStorage.getItem(k);
        if (val && typeof val === 'string' && val.trim().length > 5) {
          return val.trim();
        }
      }
    } catch (_) {}
  }

  // 4. getGeminiApiKey() từ geminiClient dự phòng
  try {
    const fallback = getGeminiApiKey();
    if (fallback && typeof fallback === 'string' && fallback.trim().length > 5) {
      return fallback.trim();
    }
  } catch (_) {}

  return '';
}

export interface VoiceTonePreset {
  id: string;
  name: string;
  label: string;
  sub: string;
  description: string;
  icon: string;
  pitch: number;
  rate: number;
  volume: number;
  gender: 'female' | 'male' | 'neutral';
  geminiVoice?: string;
}

export const VOICE_TONE_PRESETS: VoiceTonePreset[] = [
  {
    id: 'nu_truyen_cam',
    name: 'Cô giáo Kore (Nữ truyền cảm, dịu dàng, tự nhiên như người thật)',
    label: '👩‍🏫 Kore (Nữ truyền cảm - Tự nhiên)',
    sub: 'Dịu dàng • Truyền cảm • Chuẩn mực',
    description: 'Giọng đọc AI cao cấp Kore tự nhiên như người thật, âm điệu sư phạm dịu dàng, truyền cảm hứng và không bị tiếng robot',
    icon: '👩‍🏫',
    pitch: 1.05,
    rate: 1.0,
    volume: 1.0,
    gender: 'female',
    geminiVoice: 'Kore',
  },
  {
    id: 'nu_am_ap',
    name: 'Cô giáo Aoede (Nữ ấm áp, nhẹ nhàng, sâu lắng)',
    label: '🌸 Aoede (Nữ ấm áp - Nhẹ nhàng)',
    sub: 'Ấm áp • Nhẹ nhàng • Sâu lắng',
    description: 'Giọng đọc nữ Aoede ấm áp, trong sáng, diễn đạt tự nhiên và giàu cảm xúc',
    icon: '🌸',
    pitch: 1.08,
    rate: 1.0,
    volume: 1.0,
    gender: 'female',
    geminiVoice: 'Aoede',
  },
  {
    id: 'nam_nang_dong',
    name: 'MC Puck (Nam năng động, sôi nổi, bùng nổ)',
    label: '⚡ Puck (Nam năng động - Bùng nổ)',
    sub: 'Năng động • Sôi nổi • Cuốn hút',
    description: 'Giọng nam Puck tràn đầy năng lượng, hào hứng, khuấy động không khí lớp học',
    icon: '⚡',
    pitch: 1.12,
    rate: 1.12,
    volume: 1.0,
    gender: 'male',
    geminiVoice: 'Puck',
  },
  {
    id: 'nam_tram_am',
    name: 'Thầy giáo Charon (Nam trầm ấm, đĩnh đạc, chuẩn phát thanh)',
    label: '👨‍🏫 Charon (Nam trầm ấm - Thầy giáo)',
    sub: 'Trầm ấm • Đĩnh đạc • Uy nghiêm',
    description: 'Giọng thầy giáo Charon trầm ấm, uy nghiêm, phát âm rõ ràng từng từ ngữ chuẩn sư phạm',
    icon: '👨‍🏫',
    pitch: 0.90,
    rate: 0.98,
    volume: 1.0,
    gender: 'male',
    geminiVoice: 'Charon',
  },
  {
    id: 'nam_dut_khoat',
    name: 'MC Fenrir (Nam dứt khoát, kịch tính, phong cách Olympia)',
    label: '🏆 Fenrir (Nam dứt khoát - Kịch tính)',
    sub: 'Dứt khoát • Kịch tính • Sắc sảo',
    description: 'Phong cách MC Fenrir dứt khoát, kịch tính, nhấn nhá sắc nét, tạo không khí học tập sôi động',
    icon: '🏆',
    pitch: 1.05,
    rate: 1.10,
    volume: 1.0,
    gender: 'male',
    geminiVoice: 'Fenrir',
  },
  // Các preset tương thích ngược cho giao diện và cấu hình đã lưu
  {
    id: 'nu_diu_dang',
    name: 'Giọng Nữ (Cô giáo dịu dàng, truyền cảm)',
    label: '👩‍🏫 Giọng Nữ (Cô giáo)',
    sub: 'Dịu dàng • Truyền cảm • Chuẩn mực',
    description: 'Giọng cô giáo dịu dàng, êm ái, truyền cảm hứng, phát âm chuẩn xác sư phạm',
    icon: '👩‍🏫',
    pitch: 1.05,
    rate: 1.0,
    volume: 1.0,
    gender: 'female',
    geminiVoice: 'Kore',
  },
  {
    id: 'mc_chuyen_nghiep',
    name: 'MC Gameshow Sôi Động (Chuyên nghiệp, bùng nổ)',
    label: '⚡ MC Sôi Động (Bùng nổ)',
    sub: 'Nhiệt huyết • Sôi động • Cuốn hút',
    description: 'Giọng MC dẫn gameshow truyền hình cực kỳ hào hứng, bùng nổ năng lượng, khuấy động không khí lớp học',
    icon: '⚡',
    pitch: 1.15,
    rate: 1.14,
    volume: 1.0,
    gender: 'male',
    geminiVoice: 'Puck',
  },
  {
    id: 'mc_ai_la_trieu_phu',
    name: 'MC Ai Là Triệu Phú (Hồi hộp, đanh thép, cuốn hút)',
    label: '🏆 MC Ai Là Triệu Phú (Kịch tính)',
    sub: 'Hồi hộp • Đanh thép • Gay cấn',
    description: 'Phong cách người dẫn chương trình Ai Là Triệu Phú huyền thoại: kịch tính, nhấn nhá sắc sảo, dồn dập quyết định',
    icon: '🏆',
    pitch: 1.05,
    rate: 1.12,
    volume: 1.0,
    gender: 'male',
    geminiVoice: 'Fenrir',
  },
  {
    id: 'mc_olympia',
    name: 'MC Đường Lên Đỉnh Olympia (Sôi nổi, tri thức, cổ vũ)',
    label: '🌟 MC Olympia (Tri thức, bứt phá)',
    sub: 'Sôi nổi • Hào hứng • Bứt phá',
    description: 'Phong cách MC Đường Lên Đỉnh Olympia: hào hứng, đĩnh đạc, truyền động lực bứt phá điểm số tối đa',
    icon: '🌟',
    pitch: 1.18,
    rate: 1.16,
    volume: 1.0,
    gender: 'male',
    geminiVoice: 'Puck',
  },
  {
    id: 'mc_nu_nang_dong',
    name: 'Nữ MC Hoạt Náo Viên (Hào hứng, cổ vũ, tươi vui)',
    label: '🎉 Nữ MC Hoạt Náo (Cổ vũ)',
    sub: 'Hào hứng • Cổ vũ • Tươi vui',
    description: 'Giọng nữ MC hoạt náo tươi vui, rộn ràng, cổ vũ học sinh đua tài và trả lời nhanh như chớp',
    icon: '🎉',
    pitch: 1.22,
    rate: 1.14,
    volume: 1.0,
    gender: 'female',
    geminiVoice: 'Aoede',
  },
  {
    id: 'podcast',
    name: 'Giọng Đọc Podcast (Sâu lắng, tự sự, truyền cảm)',
    label: '🎙️ Giọng Đọc Podcast',
    sub: 'Sâu lắng • Truyền cảm hứng • Nhấn nhá',
    description: 'Giọng đọc Podcast Radio nghệ thuật, nhịp điệu thư thái, giàu cảm xúc và tự sự',
    icon: '🎙️',
    pitch: 0.94,
    rate: 0.90,
    volume: 1.0,
    gender: 'male',
    geminiVoice: 'Charon',
  },
];

// Pre-cached voices for instantaneous (<150ms) access
let cachedVoices: SpeechSynthesisVoice[] = [];
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    cachedVoices = window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      try {
        cachedVoices = window.speechSynthesis.getVoices();
      } catch (_) {}
    };
  } catch (_) {}
}
let currentAudioElement: HTMLAudioElement | null = null;
let activeAudioSource: AudioBufferSourceNode | null = null;
let isAudioUnlocked = false;

/**
 * Bộ đệm âm thanh AudioBuffer theo nội dung text để phát tức thì (0ms) khi đọc lại
 */
export const audioCache = new Map<string, AudioBuffer>();

/**
 * Bộ đệm âm thanh AudioBuffer theo ID câu hỏi để bấm lần 2 phát ngay lập tức (0ms)
 */
export const questionAudioCache = new Map<string, AudioBuffer>();

let sharedAudioContext: AudioContext | null = null;

/**
 * Khởi tạo sẵn (warm-up) hoặc lấy AudioContext ở cấp module với sampleRate 24000
 */
export function getOrCreateAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    try {
      sharedAudioContext = new AudioContextClass({ sampleRate: 24000 });
    } catch (_) {
      try {
        sharedAudioContext = new AudioContextClass();
      } catch {
        return null;
      }
    }
  }
  return sharedAudioContext;
}

// Khởi tạo sẵn (warm-up) AudioContext ở cấp module ngay khi file được load
if (typeof window !== 'undefined') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      sharedAudioContext = new AudioContextClass({ sampleRate: 24000 });
    }
  } catch (_) {}
}

/**
 * Dừng âm thanh đang phát trên Web Audio AudioContext mà KHÔNG đóng context dùng chung
 * để có thể tái sử dụng ngay lập tức cho câu tiếp theo với độ trễ 0ms.
 */
export function stopActiveAudioContext(): void {
  try {
    if (activeAudioSource) {
      activeAudioSource.onended = null;
      activeAudioSource.stop();
      activeAudioSource.disconnect();
      activeAudioSource = null;
    }
    if (currentAudioElement) {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
      currentAudioElement = null;
    }
  } catch (_) {}
}

/**
 * Phát trực tiếp một AudioBuffer qua AudioContext dùng chung với độ trễ 0ms
 */
export function playAudioBuffer(
  audioBuffer: AudioBuffer,
  onStart?: () => void,
  onEnd?: () => void
): Promise<boolean> {
  stopActiveAudioContext();
  const ctx = getOrCreateAudioContext();
  if (!ctx) return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    try {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      activeAudioSource = source;

      source.onended = () => {
        if (activeAudioSource === source) {
          activeAudioSource = null;
        }
        if (!isSpeechCancelled && onEnd) onEnd();
        resolve(true);
      };

      if (!isSpeechCancelled && onStart) onStart();
      source.start(0);
    } catch (err) {
      console.warn('playAudioBuffer error:', err);
      resolve(false);
    }
  });
}

/**
 * Chuyển đổi dữ liệu byte PCM (24000Hz, 1 channel Int16) sang AudioBuffer
 */
export function createAudioBufferFromPcmBytes(
  bytes: Uint8Array,
  mimeType: string = 'audio/wav',
  ctx?: AudioContext | null
): AudioBuffer | null {
  const audioCtx = ctx || getOrCreateAudioContext();
  if (!audioCtx) return null;

  const isWav = bytes.length > 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;

  if (!isWav && (mimeType.includes('pcm') || mimeType.includes('raw') || mimeType === 'audio/wav')) {
    try {
      const numSamples = Math.floor(bytes.length / 2);
      const audioBuffer = audioCtx.createBuffer(1, numSamples, 24000);
      const channelData = audioBuffer.getChannelData(0);
      const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

      for (let i = 0; i < numSamples; i++) {
        const int16 = dataView.getInt16(i * 2, true);
        channelData[i] = int16 / 32768.0;
      }
      return audioBuffer;
    } catch (e) {
      console.warn('PCM conversion error:', e);
      return null;
    }
  }
  return null;
}

/**
 * Tải và giải mã dữ liệu âm thanh từ Gemini TTS thành AudioBuffer (có lưu đệm trong audioCache)
 */
export async function fetchGeminiAudioBuffer(
  text: string,
  voiceName: string = 'Kore',
  apiKey: string
): Promise<AudioBuffer | null> {
  const trimmed = text.trim();
  if (!trimmed || !apiKey) return null;

  const cacheKey = `${voiceName}:::${trimmed}`;
  if (audioCache.has(cacheKey)) {
    return audioCache.get(cacheKey)!;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    let response: any = null;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: trimmed,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName,
              },
            },
          },
        },
      });
    } catch {
      // Dự phòng sang gemini-3.8-flash-tts
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: trimmed,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName,
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
      for (const part of parts) {
        if ((part as any).inlineData?.data) {
          audioBase64 = (part as any).inlineData.data;
          if ((part as any).inlineData.mimeType) {
            mimeType = (part as any).inlineData.mimeType;
          }
          break;
        }
      }
    }

    if (!audioBase64) return null;

    const binary = atob(audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const buffer = createAudioBufferFromPcmBytes(bytes, mimeType);
    if (buffer) {
      audioCache.set(cacheKey, buffer);
      return buffer;
    }
    return null;
  } catch (err) {
    console.warn('fetchGeminiAudioBuffer error:', err);
    return null;
  }
}

/**
 * Phát dữ liệu âm thanh từ Gemini TTS qua Web Audio AudioContext (PCM sampleRate 24000) hoặc Blob Audio.
 * Dùng đúng sampleRate: 24000 (1 kênh Int16 -> Float32) và luôn đóng/dừng AudioContext cũ trước khi phát mới.
 */
export async function playGeminiAudioData(
  bytes: Uint8Array,
  mimeType: string = 'audio/wav',
  onStart?: () => void,
  onEnd?: () => void
): Promise<boolean> {
  stopActiveAudioContext();

  const isWav = bytes.length > 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;

  // Phát PCM chuẩn 24000Hz (1 kênh Int16 -> Float32)
  if (!isWav && (mimeType.includes('pcm') || mimeType.includes('raw') || mimeType === 'audio/wav')) {
    const buffer = createAudioBufferFromPcmBytes(bytes, mimeType);
    if (buffer) {
      return playAudioBuffer(buffer, onStart, onEnd);
    }
  }

  // Fallback sang HTML5 Audio Blob nếu có định dạng container
  try {
    const effectiveMime = isWav ? 'audio/wav' : (mimeType || 'audio/mp3');
    const blob = new Blob([bytes], { type: effectiveMime });
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    currentAudioElement = audio;

    return new Promise<boolean>((resolve) => {
      audio.onplay = () => {
        if (!isSpeechCancelled && onStart) onStart();
      };
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioElement = null;
        if (!isSpeechCancelled && onEnd) onEnd();
        resolve(true);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioElement = null;
        resolve(false);
      };
      const p = audio.play();
      if (p !== undefined) {
        p.catch(() => resolve(false));
      }
    });
  } catch (_) {
    return false;
  }
}

// Tự động mở khóa âm thanh trình duyệt ngay khi người dùng chạm hoặc click chuột lần đầu trên web
export function unlockWebAudio(): void {
  if (isAudioUnlocked || typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
    }
    const silent = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
    silent.volume = 0.01;
    silent.play().catch(() => {});
    isAudioUnlocked = true;
  } catch (_) {}
}

if (typeof window !== 'undefined') {
  const handleFirstInteraction = () => {
    unlockWebAudio();
    window.removeEventListener('click', handleFirstInteraction, true);
    window.removeEventListener('touchstart', handleFirstInteraction, true);
    window.removeEventListener('keydown', handleFirstInteraction, true);
  };
  window.addEventListener('click', handleFirstInteraction, true);
  window.addEventListener('touchstart', handleFirstInteraction, true);
  window.addEventListener('keydown', handleFirstInteraction, true);
}

export function initVoiceCache(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return [];
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices && voices.length > 0) {
    cachedVoices = voices;
  }
  return cachedVoices;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  initVoiceCache();
  window.speechSynthesis.onvoiceschanged = () => {
    initVoiceCache();
  };
}

/**
 * Lọc và ưu tiên gán voice tiếng Việt 100%
 * Đảm bảo gọi window.speechSynthesis.getVoices() và lọc tìm đúng voice có voice.lang.includes('vi')
 * Ưu tiên: Google Tiếng Việt hoặc Microsoft HoaiMy/NamMinh
 */
export function getBestVietnameseVoice(gender: 'female' | 'male' | 'neutral' = 'neutral'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  let voices = cachedVoices;
  if (!voices || voices.length === 0) {
    voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      cachedVoices = voices;
    }
  }

  if (!voices || voices.length === 0) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => {
        try {
          const fresh = window.speechSynthesis.getVoices();
          if (fresh && fresh.length > 0) {
            cachedVoices = fresh;
          }
        } catch (_) {}
      };
    }
    return null;
  }

  // Luôn lọc các giọng có ngôn ngữ tiếng Việt (vi, vi-VN, VIE, Vietnamese)
  const viVoices = voices.filter((v) => {
    const lang = (v.lang || '').toLowerCase();
    const rawLang = v.lang || '';
    const name = (v.name || '').toLowerCase();
    return (
      lang.includes('vi') ||
      rawLang.includes('VIE') ||
      name.includes('vietnam') ||
      name.includes('tiếng việt') ||
      name.includes('hoaimy') ||
      name.includes('namminh')
    );
  });

  if (viVoices.length === 0) {
    return null;
  }

  // 1. Ưu tiên hàng đầu theo giới tính và các voice chuẩn Google Tiếng Việt / Microsoft HoaiMy / Microsoft NamMinh
  if (gender === 'female') {
    // 1. Ưu tiên cao nhất: Microsoft HoaiMy Online (Natural)
    const hoaiMyNatural = viVoices.find((v) => {
      const n = v.name.toLowerCase();
      return (n.includes('hoaimy') || n.includes('hoài my')) && (n.includes('natural') || n.includes('online'));
    });
    if (hoaiMyNatural) return hoaiMyNatural;

    const hoaiMy = viVoices.find((v) => {
      const n = v.name.toLowerCase();
      return n.includes('hoaimy') || n.includes('hoài my');
    });
    if (hoaiMy) return hoaiMy;

    const googleVi = viVoices.find((v) => v.name.toLowerCase().includes('google'));
    if (googleVi) return googleVi;

    const femaleVi = viVoices.find((v) => {
      const n = v.name.toLowerCase();
      return n.includes('female') || n.includes('nữ') || n.includes('linh') || n.includes('mai');
    });
    if (femaleVi) return femaleVi;

    return viVoices[0];
  }

  if (gender === 'male') {
    // 1. Ưu tiên cao nhất: Microsoft NamMinh Online (Natural)
    const namMinhNatural = viVoices.find((v) => {
      const n = v.name.toLowerCase();
      return (n.includes('namminh') || n.includes('nam minh')) && (n.includes('natural') || n.includes('online'));
    });
    if (namMinhNatural) return namMinhNatural;

    const namMinh = viVoices.find((v) => {
      const n = v.name.toLowerCase();
      return n.includes('namminh') || n.includes('nam minh');
    });
    if (namMinh) return namMinh;

    const googleVi = viVoices.find((v) => v.name.toLowerCase().includes('google'));
    if (googleVi) return googleVi;

    const maleVi = viVoices.find((v) => {
      const n = v.name.toLowerCase();
      return n.includes('male') || n.includes('nam') || n.includes('khoi') || n.includes('khôi');
    });
    if (maleVi) return maleVi;

    return viVoices[0];
  }

  // Giọng chung (neutral / general): Ưu tiên Microsoft HoaiMy/NamMinh Online Natural hoặc Google Tiếng Việt
  const topNatural = viVoices.find((v) => {
    const n = v.name.toLowerCase();
    return (n.includes('hoaimy') || n.includes('namminh')) && (n.includes('natural') || n.includes('online'));
  });
  if (topNatural) return topNatural;

  const topVoice = viVoices.find((v) => {
    const n = v.name.toLowerCase();
    return n.includes('google') || n.includes('hoaimy') || n.includes('namminh');
  });
  if (topVoice) return topVoice;

  const naturalKeywords = ['natural', 'online', 'neural', 'neural2', 'wavenet'];
  const naturalAny = viVoices.find((v) => naturalKeywords.some((k) => v.name.toLowerCase().includes(k)));
  if (naturalAny) return naturalAny;

  return viVoices[0];
}

/**
 * Lọc voice tiếng Anh chuẩn (dành riêng cho bộ môn Tiếng Anh / Anh Văn)
 */
export function getBestEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  let voices = cachedVoices;
  if (!voices || voices.length === 0) {
    voices = window.speechSynthesis.getVoices();
    cachedVoices = voices;
  }

  const enVoices = voices.filter((v) => {
    const lang = (v.lang || '').toLowerCase();
    return lang.startsWith('en') || lang.includes('en-us') || lang.includes('en-gb');
  });

  if (enVoices.length === 0) return null;

  const naturalEn = enVoices.find((v) => {
    const n = v.name.toLowerCase();
    return n.includes('natural') || n.includes('google') || n.includes('samantha') || n.includes('zira') || n.includes('jenny');
  });

  return naturalEn || enVoices[0];
}

/**
 * Chuyển đổi một chữ số hoặc số nhỏ sang chữ tiếng Việt
 */
function singleDigitToVietnamese(d: string): string {
  switch (d) {
    case '0': return 'không';
    case '1': return 'một';
    case '2': return 'hai';
    case '3': return 'ba';
    case '4': return 'bốn';
    case '5': return 'năm';
    case '6': return 'sáu';
    case '7': return 'bảy';
    case '8': return 'tám';
    case '9': return 'chín';
    default: return d;
  }
}

/**
 * Đọc số nguyên tiếng Việt chuẩn xác (1..999,999)
 */
function numberToVietnameseWords(numStr: string): string {
  const n = parseInt(numStr, 10);
  if (isNaN(n)) return numStr;
  if (n < 0) {
    return 'trừ ' + numberToVietnameseWords(String(Math.abs(n)));
  }
  if (n >= 0 && n <= 10) return singleDigitToVietnamese(String(n));
  if (n < 20) {
    if (n === 15) return 'mười lăm';
    return 'mười ' + singleDigitToVietnamese(String(n % 10));
  }
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const unit = n % 10;
    const tensStr = tens === 2 ? 'hai mươi' : singleDigitToVietnamese(String(tens)) + ' mươi';
    if (unit === 0) return tensStr;
    if (unit === 1) return tensStr + ' mốt';
    if (unit === 4) return tensStr + ' tư';
    if (unit === 5) return tensStr + ' lăm';
    return tensStr + ' ' + singleDigitToVietnamese(String(unit));
  }
  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const rem = n % 100;
    const hStr = singleDigitToVietnamese(String(hundreds)) + ' trăm';
    if (rem === 0) return hStr;
    if (rem < 10) return hStr + ' linh ' + singleDigitToVietnamese(String(rem));
    return hStr + ' ' + numberToVietnameseWords(String(rem));
  }
  if (n < 1000000) {
    const thousands = Math.floor(n / 1000);
    const rem = n % 1000;
    const thStr = numberToVietnameseWords(String(thousands)) + ' nghìn';
    if (rem === 0) return thStr;
    if (rem < 10) return thStr + ' không trăm linh ' + singleDigitToVietnamese(String(rem));
    if (rem < 100) return thStr + ' không trăm ' + numberToVietnameseWords(String(rem));
    return thStr + ' ' + numberToVietnameseWords(String(rem));
  }
  return numStr;
}

/**
 * Chuyển đổi chuyên sâu ký hiệu các lĩnh vực Toán, Lý, Hóa, Sinh, Tin học sang lời đọc Tiếng Việt chuẩn xác:
 * - Toán học: Véc-tơ, Tập hợp số, Khoảng đoạn, Hình học, Giới hạn, Tích phân
 * - Vật lý: Đơn vị (m/s2, km/h, Ω, kW, J, N, Pa, Hz, mA, μF...), Đại lượng (ω, λ, α, β, γ, ρ, φ...)
 * - Hóa học: Công thức chất (H2O, CO2, H2SO4, Ca(OH)2, NaCl, Fe2O3, C2H5OH...), Ion (Fe2+, Cu2+, SO4^2-...), Phản ứng (->, <=>, kết tủa, khí), pH, C_M, mol/l...
 * - Sinh học: Di truyền (ADN, ARN, mARN, tARN, rARN, NST, gen Aa, Bb, F1, F2, P), Năng lượng (ATP), Tế bào...
 * - Tin học: Ngôn ngữ (C++, C#, Python, Java, JS, HTML, CSS, SQL), Đơn vị (bit, byte, KB, MB, GB, RAM, CPU), Toán tử (==, !=, <=, >=, &&, ||)...
 */
export function expandStemFormulasAndTerms(text: string): string {
  if (!text) return '';
  let s = text;

  // ===== 1. TOÁN HỌC: VÉC-TƠ, TẬP HỢP & HÌNH HỌC =====
  s = s.replace(/\\vec\{0\}|\\vec\s*0/g, ' véc-tơ không ');
  s = s.replace(/\\vec\{([a-zA-Z0-9]+)\}/g, ' véc-tơ $1 ');
  s = s.replace(/\\vec\s*([a-zA-Z0-9])/g, ' véc-tơ $1 ');
  s = s.replace(/\\overrightarrow\{([A-Za-z0-9]+)\}/g, ' véc-tơ $1 ');
  s = s.replace(/\|\\vec\{([a-zA-Z0-9]+)\}\|/g, ' độ dài véc-tơ $1 ');
  s = s.replace(/\\perp|⊥/g, ' vuông góc với ');
  s = s.replace(/\\parallel|∥/g, ' song song với ');
  s = s.replace(/\\mathbb\{N\}\^\*|ℕ\*/g, ' tập hợp số tự nhiên N sao ');
  s = s.replace(/\\mathbb\{N\}|ℕ/g, ' tập hợp số tự nhiên N ');
  s = s.replace(/\\mathbb\{Z\}|ℤ/g, ' tập hợp số nguyên Z ');
  s = s.replace(/\\mathbb\{Q\}|ℚ/g, ' tập hợp số hữu tỉ Q ');
  s = s.replace(/\\mathbb\{C\}|ℂ/g, ' tập hợp số phức C ');
  s = s.replace(/\\mathbb\{R\}\s*\\setminus\s*\\?\{([^}]+)\}/g, ' tập R hiệu $1 ');
  s = s.replace(/(?:x\s*\\in|x\s*∈|x\s*thuộc)\s*(?:\\mathbb\{R\}|ℝ|\bIR\b)/g, ' x thuộc tập R ');
  s = s.replace(/\\mathbb\{R\}|ℝ|\bIR\b/g, ' tập R ');

  // ===== 2. HÓA HỌC: CÔNG THỨC CHẤT, ION, ĐƠN VỊ & PHẢN ỨNG =====
  s = s.replace(/\bH_?2SO_?4\b/g, ' H hai S O bốn ');
  s = s.replace(/\bH_?2O\b/g, ' H hai O ');
  s = s.replace(/\bCO_?2\b/g, ' C O hai ');
  s = s.replace(/\bO_?3\b/g, ' ô-zôn ');
  s = s.replace(/\bO_?2\b/g, ' O hai ');
  s = s.replace(/\bH_?2\b/g, ' H hai ');
  s = s.replace(/\bN_?2\b/g, ' N hai ');
  s = s.replace(/\bCl_?2\b/g, ' clo hai ');
  s = s.replace(/\bHCl\b/g, ' H Cl ');
  s = s.replace(/\bHNO_?3\b/g, ' H N O ba ');
  s = s.replace(/\bH_?3PO_?4\b/g, ' H ba P O bốn ');
  s = s.replace(/\bNaOH\b/g, ' Na O H ');
  s = s.replace(/\bKOH\b/g, ' K O H ');
  s = s.replace(/Ca\(OH\)_?2/g, ' Ca O H tất cả hai lần ');
  s = s.replace(/Ba\(OH\)_?2/g, ' Ba O H tất cả hai lần ');
  s = s.replace(/Al\(OH\)_?3/g, ' Al O H tất cả ba lần ');
  s = s.replace(/Fe\(OH\)_?2/g, ' Fe O H tất cả hai lần ');
  s = s.replace(/Fe\(OH\)_?3/g, ' Fe O H tất cả ba lần ');
  s = s.replace(/\bNaCl\b/g, ' Na Cl ');
  s = s.replace(/\bCaCO_?3\b/g, ' Ca C O ba ');
  s = s.replace(/\bCuSO_?4\b/g, ' Cu S O bốn ');
  s = s.replace(/\bFeSO_?4\b/g, ' Fe S O bốn ');
  s = s.replace(/Fe_?2\(SO_?4\)_?3/g, ' Fe hai S O bốn tất cả ba lần ');
  s = s.replace(/\bFe_?2O_?3\b/g, ' Fe hai O ba ');
  s = s.replace(/\bFe_?3O_?4\b/g, ' Fe ba O bốn ');
  s = s.replace(/\bFeO\b/g, ' Fe O ');
  s = s.replace(/\bAl_?2O_?3\b/g, ' Al hai O ba ');
  s = s.replace(/\bAgNO_?3\b/g, ' Ag N O ba ');
  s = s.replace(/\bKMnO_?4\b/g, ' K Mn O bốn ');
  s = s.replace(/\bBaSO_?4\b/g, ' Ba S O bốn ');
  s = s.replace(/\bCH_?4\b/g, ' C H bốn ');
  s = s.replace(/\bC_?2H_?2\b/g, ' C hai H hai ');
  s = s.replace(/\bC_?2H_?4\b/g, ' C hai H bốn ');
  s = s.replace(/\bC_?2H_?5OH\b/g, ' C hai H năm O H ');
  s = s.replace(/\bCH_?3COOH\b/g, ' C H ba C O O H ');
  s = s.replace(/\bC_?6H_?\{?12\}?O_?6\b/g, ' C sáu H mười hai O sáu ');

  // Ion & Điện tích
  s = s.replace(/\bFe\^?\{?2\+\}?|\bFe2\+/g, ' sắt hai cộng ');
  s = s.replace(/\bFe\^?\{?3\+\}?|\bFe3\+/g, ' sắt ba cộng ');
  s = s.replace(/\bCu\^?\{?2\+\}?|\bCu2\+/g, ' đồng hai cộng ');
  s = s.replace(/\bAl\^?\{?3\+\}?|\bAl3\+/g, ' nhôm ba cộng ');
  s = s.replace(/\bZn\^?\{?2\+\}?|\bZn2\+/g, ' kẽm hai cộng ');
  s = s.replace(/\bBa\^?\{?2\+\}?|\bBa2\+/g, ' bari hai cộng ');
  s = s.replace(/\bCa\^?\{?2\+\}?|\bCa2\+/g, ' canxi hai cộng ');
  s = s.replace(/\bMg\^?\{?2\+\}?|\bMg2\+/g, ' magiê hai cộng ');
  s = s.replace(/\bNa\^?\+/g, ' natri cộng ');
  s = s.replace(/\bK\^?\+/g, ' kali cộng ');
  s = s.replace(/\bAg\^?\+/g, ' bạc cộng ');
  s = s.replace(/\bH\^?\+/g, ' H cộng ');
  s = s.replace(/\bOH\^?-/g, ' O H trừ ');
  s = s.replace(/SO_?4\^?\{?2-\}?/g, ' sun-phát hai trừ ');
  s = s.replace(/CO_?3\^?\{?2-\}?/g, ' các-bo-nát hai trừ ');
  s = s.replace(/NO_?3\^?-/g, ' ni-trát trừ ');
  s = s.replace(/Cl\^?-/g, ' clo trừ ');

  // Thuật ngữ & Đơn vị hóa học
  s = s.replace(/\bpH\s*([<>=])\s*(\d+)/gi, (_, op, val) => ` p H ${op === '<' ? 'nhỏ hơn' : op === '>' ? 'lớn hơn' : 'bằng'} ${val} `);
  s = s.replace(/\bpH\b/g, ' p H ');
  s = s.replace(/(\d+)\s*(mol\/l|mol\/L)\b/g, '$1 mol trên lít');
  s = s.replace(/(\d+)\s*(g\/mol)\b/g, '$1 gam trên mol');
  s = s.replace(/(\d+)\s*(g\/ml|g\/mL)\b/g, '$1 gam trên mi-li-lít');
  s = s.replace(/(\d+)\s*(ml|mL)\b/g, '$1 mi-li-lít');
  s = s.replace(/(\d+)\s*mol\b/g, '$1 mol');
  s = s.replace(/\b(ở\s+)?(đktc|ĐKTC)\b/g, ' ở điều kiện tiêu chuẩn ');
  s = s.replace(/\bC_M\b/g, ' nồng độ mol C M ');
  s = s.replace(/\bC_m\b/g, ' nồng độ mol C m ');
  s = s.replace(/\\rightleftharpoons|⇄/g, ' phản ứng thuận nghịch ');
  s = s.replace(/\\downarrow|↓/g, ' kết tủa ');
  s = s.replace(/\\uparrow|↑/g, ' khí thoát ra ');

  // ===== 3. VẬT LÝ: ĐƠN VỊ ĐO & KÝ HIỆU HẰNG SỐ =====
  s = s.replace(/(\d+)\s*(m\/s\^2|m\/s²)/g, '$1 mét trên giây bình phương');
  s = s.replace(/(\d+)\s*m\/s\b/g, '$1 mét trên giây');
  s = s.replace(/(\d+)\s*km\/h\b/g, '$1 ki-lô-mét trên giờ');
  s = s.replace(/(\d+)\s*cm\/s\b/g, '$1 xen-ti-mét trên giây');
  s = s.replace(/(\d+)\s*rad\/s\b/g, '$1 ra-đi-an trên giây');
  s = s.replace(/(\d+)\s*rad\b/g, '$1 ra-đi-an');
  s = s.replace(/(\d+)\s*(k\\Omega|kΩ)\b/g, '$1 ki-lô-ôm');
  s = s.replace(/(\d+)\s*(M\\Omega|MΩ)\b/g, '$1 mê-ga-ôm');
  s = s.replace(/(\d+)\s*(\\Omega|Ω)\b/g, '$1 ôm');
  s = s.replace(/(\d+)\s*(kWh|kW\.h)\b/g, '$1 ki-lô-oát giờ');
  s = s.replace(/(\d+)\s*kW\b/g, '$1 ki-lô-oát');
  s = s.replace(/(\d+)\s*MW\b/g, '$1 mê-ga-oát');
  s = s.replace(/(\d+)\s*GW\b/g, '$1 ghi-ga-oát');
  s = s.replace(/(\d+)\s*W\b/g, '$1 oát');
  s = s.replace(/(\d+)\s*kJ\b/g, '$1 ki-lô-jun');
  s = s.replace(/(\d+)\s*J\b/g, '$1 jun');
  s = s.replace(/(\d+)\s*kN\b/g, '$1 ki-lô-niu-tơn');
  s = s.replace(/(\d+)\s*N\b/g, '$1 niu-tơn');
  s = s.replace(/(\d+)\s*kPa\b/g, '$1 ki-lô-pát-xcan');
  s = s.replace(/(\d+)\s*Pa\b/g, '$1 pát-xcan');
  s = s.replace(/(\d+)\s*atm\b/g, '$1 át-mốt-phe');
  s = s.replace(/(\d+)\s*kV\b/g, '$1 ki-lô-vôn');
  s = s.replace(/(\d+)\s*mV\b/g, '$1 mi-li-vôn');
  s = s.replace(/(\d+)\s*V\b/g, '$1 vôn');
  s = s.replace(/(\d+)\s*mA\b/g, '$1 mi-li-am-pe');
  s = s.replace(/(\d+)\s*(\\mu\s*A|µA|uA)\b/g, '$1 mi-crô-am-pe');
  s = s.replace(/(\d+)\s*A\b/g, '$1 am-pe');
  s = s.replace(/(\d+)\s*(\\mu\s*F|µF|uF)\b/g, '$1 mi-crô-pha-ra');
  s = s.replace(/(\d+)\s*pF\b/g, '$1 pi-cô-pha-ra');
  s = s.replace(/(\d+)\s*nF\b/g, '$1 na-nô-pha-ra');
  s = s.replace(/(\d+)\s*F\b/g, '$1 pha-ra');
  s = s.replace(/(\d+)\s*mH\b/g, '$1 mi-li-hen-ri');
  s = s.replace(/(\d+)\s*H\b/g, '$1 hen-ri');
  s = s.replace(/(\d+)\s*GHz\b/g, '$1 ghi-ga-héc');
  s = s.replace(/(\d+)\s*MHz\b/g, '$1 mê-ga-héc');
  s = s.replace(/(\d+)\s*kHz\b/g, '$1 ki-lô-héc');
  s = s.replace(/(\d+)\s*Hz\b/g, '$1 héc');
  s = s.replace(/(\d+)\s*dB\b/g, '$1 đề-xi-ben');
  s = s.replace(/(\d+)\s*(°C|\\circ\s*C)/g, '$1 độ C');
  s = s.replace(/(\d+)\s*(°F|\\circ\s*F)/g, '$1 độ F');
  s = s.replace(/(\d+)\s*K\b/g, '$1 độ ken-vin');
  s = s.replace(/(\d+)\s*kg\b/g, '$1 ki-lô-gam');
  s = s.replace(/(\d+)\s*mg\b/g, '$1 mi-li-gam');
  s = s.replace(/(\d+)\s*g\b/g, '$1 gam');

  // Ký hiệu Vật lý
  s = s.replace(/\\omega\b|(?<![a-zA-Z])ω(?![a-zA-Z])/g, ' ô-mê-ga ');
  s = s.replace(/\\Omega\b|(?<![a-zA-Z])Ω(?![a-zA-Z])/g, ' ôm ');
  s = s.replace(/\\lambda\b|(?<![a-zA-Z])λ(?![a-zA-Z])/g, ' lam-đa ');
  s = s.replace(/\\alpha\b|(?<![a-zA-Z])α(?![a-zA-Z])/g, ' an-pha ');
  s = s.replace(/\\beta\b|(?<![a-zA-Z])β(?![a-zA-Z])/g, ' bê-ta ');
  s = s.replace(/\\gamma\b|(?<![a-zA-Z])γ(?![a-zA-Z])/g, ' ga-ma ');
  s = s.replace(/\\rho\b|(?<![a-zA-Z])ρ(?![a-zA-Z])/g, ' rô ');
  s = s.replace(/\\mu\b|(?<![a-zA-Z])µ(?![a-zA-Z])/g, ' muy ');
  s = s.replace(/\\eta\b|(?<![a-zA-Z])η(?![a-zA-Z])/g, ' ê-ta ');

  // ===== 4. SINH HỌC: DI TRUYỀN, TẾ BÀO, NĂNG LƯỢNG =====
  s = s.replace(/\bADN\b|\bDNA\b/g, ' A Đê En ');
  s = s.replace(/\bmARN\b/g, ' m A e-rờ En ');
  s = s.replace(/\btARN\b/g, ' t A e-rờ En ');
  s = s.replace(/\brARN\b/g, ' r A e-rờ En ');
  s = s.replace(/\bARN\b|\bRNA\b/g, ' A e-rờ En ');
  s = s.replace(/\bNST\b/g, ' nhiễm sắc thể ');
  s = s.replace(/\bATP\b/g, ' A Tê Pê ');
  s = s.replace(/\bADP\b/g, ' A Đê Pê ');
  s = s.replace(/\bNADP\+?\b/g, ' N A Đê Pê ');
  s = s.replace(/\bF_?1\b/g, ' F một ');
  s = s.replace(/\bF_?2\b/g, ' F hai ');
  s = s.replace(/\bF_?3\b/g, ' F ba ');
  s = s.replace(/\b(thế hệ\s+)?P\s*[:xX]\s*/g, ' thế hệ bố mẹ P lai với ');
  s = s.replace(/\bAaBb\b/g, ' A lớn a nhỏ B lớn b nhỏ ');
  s = s.replace(/\bAabb\b/g, ' A lớn a nhỏ b nhỏ b nhỏ ');
  s = s.replace(/\bAABb\b/g, ' A lớn A lớn B lớn b nhỏ ');
  s = s.replace(/\bAABB\b/g, ' A lớn A lớn B lớn B lớn ');
  s = s.replace(/\baabb\b/g, ' a nhỏ a nhỏ b nhỏ b nhỏ ');
  s = s.replace(/\bAa\b/g, ' A lớn a nhỏ ');
  s = s.replace(/\bAA\b/g, ' A lớn A lớn ');
  s = s.replace(/\baa\b/g, ' a nhỏ a nhỏ ');
  s = s.replace(/\bBb\b/g, ' B lớn b nhỏ ');
  s = s.replace(/\bBB\b/g, ' B lớn B lớn ');
  s = s.replace(/\bbb\b/g, ' b nhỏ b nhỏ ');
  s = s.replace(/\bXY\b/g, ' nhiễm sắc thể X Y ');
  s = s.replace(/\bXX\b/g, ' nhiễm sắc thể X X ');

  // ===== 5. TIN HỌC: NGÔN NGỮ, PHẦN CỨNG, ĐƠN VỊ, TOÁN TỬ =====
  s = s.replace(/\bC\+\+\b/g, ' C cộng cộng ');
  s = s.replace(/\bC#\b/g, ' C thăng ');
  s = s.replace(/\bPython\b/gi, ' Pai-thơn ');
  s = s.replace(/\bJava\b(?!\s*script)/gi, ' Gia-va ');
  s = s.replace(/\bJavaScript\b|\bJS\b/gi, ' Gia-va-scrip ');
  s = s.replace(/\bHTML\b/gi, ' H Tê Mờ Lờ ');
  s = s.replace(/\bCSS\b/gi, ' C Ét Ét ');
  s = s.replace(/\bSQL\b/gi, ' Éch Quy En ');
  s = s.replace(/\bPHP\b/gi, ' P H Pê ');
  s = s.replace(/\bRAM\b/g, ' Ram ');
  s = s.replace(/\bROM\b/g, ' Rom ');
  s = s.replace(/\bCPU\b/g, ' C Pê U ');
  s = s.replace(/\bGPU\b/g, ' G Pê U ');
  s = s.replace(/\bSSD\b/g, ' Éch Ét Đê ');
  s = s.replace(/\bHDD\b/g, ' H Đê Đê ');
  s = s.replace(/(\d+)\s*(TB|Tb)\b/g, '$1 tê-ra-bai');
  s = s.replace(/(\d+)\s*(GB|Gb)\b/g, '$1 ghi-ga-bai');
  s = s.replace(/(\d+)\s*(MB|Mb)\b/g, '$1 mê-ga-bai');
  s = s.replace(/(\d+)\s*(KB|Kb)\b/g, '$1 ki-lô-bai');
  s = s.replace(/\bbyte(s)?\b/gi, ' bai ');
  s = s.replace(/\bbit(s)?\b/gi, ' bít ');
  s = s.replace(/\bKbps\b/gi, ' ki-lô-bít trên giây ');
  s = s.replace(/\bMbps\b/gi, ' mê-ga-bít trên giây ');
  s = s.replace(/\bGbps\b/gi, ' ghi-ga-bít trên giây ');
  s = s.replace(/\s*==\s*/g, ' so sánh bằng ');
  s = s.replace(/\s*!=\s*/g, ' khác ');
  s = s.replace(/\s*>=\s*/g, ' lớn hơn hoặc bằng ');
  s = s.replace(/\s*<=\s*/g, ' nhỏ hơn hoặc bằng ');
  s = s.replace(/\s*&&\s*/g, ' và logic ');
  s = s.replace(/\s*\|\|\s*/g, ' hoặc logic ');

  return s;
}

/**
 * Chuyển đổi công thức Toán học LaTeX sang lời đọc Tiếng Việt chuẩn SGK GDPT 2018 trước khi đọc:
 * - Khoảng (a; b) -> đọc là "khoảng a, b" (Regex: /\(\s*([^;()[\]]+?)\s*;\s*([^;()[\]]+?)\s*\)/g -> ' khoảng $1, $2 ')
 * - Đoạn [a; b] -> đọc là "đoạn a, b" (Regex: /\[\s*([^;()[\]]+?)\s*;\s*([^;()[\]]+?)\s*\]/g -> ' đoạn $1, $2 ')
 * - Nửa khoảng [a; b) -> đọc là "nửa khoảng a, b" (Regex: /\[\s*([^;()[\]]+?)\s*;\s*([^;()[\]]+?)\s*\)/g -> ' nửa khoảng $1, $2 ')
 * - Nửa khoảng (a; b] -> đọc là "nửa khoảng a, b" (Regex: /\(\s*([^;()[\]]+?)\s*;\s*([^;()[\]]+?)\s*\]/g -> ' nửa khoảng $1, $2 ')
 * - Ký hiệu +\infty -> đọc là "dương vô cùng"; -\infty -> đọc là "âm vô cùng".
 * - y = f(x) -> "y bằng ép ích", f'(x) -> "ép phẩy ích", f(x) -> "ép ích", y' -> "y phẩy"
 * - \mathbb{R} hoặc ℝ -> "tập hợp e-rờ"
 * - \frac{A}{B} -> "A phần B", \sqrt{A} -> "căn bậc hai của A", ^2 -> " bình phương", ^3 -> " mũ 3"
 * - \in -> "thuộc", \subset -> "con của", \cup -> "hợp", \cap -> "giao"
 * - Loại bỏ toàn bộ quy tắc cũ đọc "mở ngoặc, chấm phẩy, đóng ngoặc" đối với khoảng/đoạn
 * - Loại bỏ toàn bộ dấu $ và dấu \
 */
export function cleanMathForVietnameseTTS(text: string, isEnglishSubject: boolean = false): string {
  if (!text) return '';
  if (isEnglishSubject) {
    return text.replace(/\$/g, ' ').replace(/\\/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Tiền xử lý ký hiệu STEM chuyên sâu (Toán, Lý, Hóa, Sinh, Tin học)
  let s = expandStemFormulasAndTerms(text);

  // 1. Dịch ký hiệu hàm số và đạo hàm đọc từng chữ chuẩn sư phạm:
  // f(x) -> "f x", f(x) = -> "f x bằng", y = f(x) -> "y bằng f x", f'(x) -> "f phẩy x"
  s = s.replace(/y\s*=\s*f\s*\(\s*x\s*\)/gi, ' y bằng f x ');
  s = s.replace(/f\s*\(\s*x\s*\)\s*=\s*/gi, ' f x bằng ');
  s = s.replace(/f\s*'\s*'\s*'\s*\(\s*x\s*\)/gi, ' f ba phẩy x ');
  s = s.replace(/f\s*'\s*'\s*\(\s*x\s*\)/gi, ' f hai phẩy x ');
  s = s.replace(/f\s*'\s*\(\s*x\s*\)/gi, ' f phẩy x ');
  s = s.replace(/f\s*\(\s*x\s*\)/gi, ' f x ');
  s = s.replace(/g\s*\(\s*x\s*\)\s*=\s*/gi, ' g x bằng ');
  s = s.replace(/g\s*'\s*\(\s*x\s*\)/gi, ' g phẩy x ');
  s = s.replace(/g\s*\(\s*x\s*\)/gi, ' g x ');
  s = s.replace(/h\s*\(\s*x\s*\)\s*=\s*/gi, ' h x bằng ');
  s = s.replace(/h\s*'\s*\(\s*x\s*\)/gi, ' h phẩy x ');
  s = s.replace(/h\s*\(\s*x\s*\)/gi, ' h x ');
  s = s.replace(/f\s*'\s*\(\s*t\s*\)/gi, ' f phẩy t ');
  s = s.replace(/f\s*\(\s*t\s*\)/gi, ' f t ');
  s = s.replace(/f\s*'\s*\(\s*u\s*\)/gi, ' f phẩy u ');
  s = s.replace(/f\s*\(\s*u\s*\)/gi, ' f u ');
  s = s.replace(/\by\s*'\s*'/gi, ' y hai phẩy ');
  s = s.replace(/\by\s*'/gi, ' y phẩy ');

  // 2. Ký hiệu tập hợp số: R, N, Z, Q, C đọc chuẩn xác
  s = s.replace(/\\mathbb\{R\}\s*\\setminus\s*\\?\{([^}]+)\}/g, ' tập R hiệu $1 ');
  s = s.replace(/(?:x\s*\\in|x\s*∈|x\s*thuộc)\s*(?:\\mathbb\{R\}|ℝ|\bIR\b)/g, ' x thuộc tập R ');
  s = s.replace(/\\mathbb\{R\}|ℝ|\bIR\b/g, ' tập R ');
  s = s.replace(/(^|[\s(;\[])D\s*=\s*R(?=[\s);,\].]|$)/g, '$1D bằng tập R');
  s = s.replace(/(^|[\s(;\[])trên\s+R(?=[\s);,\].]|$)/gi, '$1trên tập R');
  s = s.replace(/(^|[\s(;\[])thuộc\s+R(?=[\s);,\].]|$)/gi, '$1thuộc tập R');
  s = s.replace(/(^|[\s(;\[])tập\s+R(?=[\s);,\].]|$)/gi, '$1tập R');
  s = s.replace(/(^|[\s(;\[])với\s+mọi\s+x\s+thuộc\s+R(?=[\s);,\].]|$)/gi, '$1với mọi x thuộc tập R');
  s = s.replace(/\\mathbb\{N\}\^\*|ℕ\*/g, ' tập N sao ');
  s = s.replace(/(?:x\s*\\in|x\s*∈|x\s*thuộc)\s*(?:\\mathbb\{N\}\^\*|ℕ\*)/g, ' x thuộc tập N sao ');
  s = s.replace(/(?:x\s*\\in|x\s*∈|x\s*thuộc)\s*(?:\\mathbb\{N\}|ℕ)/g, ' x thuộc tập N ');
  s = s.replace(/\\mathbb\{N\}|ℕ/g, ' tập N ');
  s = s.replace(/(?:x\s*\\in|x\s*∈|x\s*thuộc)\s*(?:\\mathbb\{Z\}|ℤ)/g, ' x thuộc tập Z ');
  s = s.replace(/\\mathbb\{Z\}|ℤ/g, ' tập Z ');
  s = s.replace(/(?:x\s*\\in|x\s*∈|x\s*thuộc)\s*(?:\\mathbb\{Q\}|ℚ)/g, ' x thuộc tập Q ');
  s = s.replace(/\\mathbb\{Q\}|ℚ/g, ' tập Q ');
  s = s.replace(/(?:x\s*\\in|x\s*∈|x\s*thuộc)\s*(?:\\mathbb\{C\}|ℂ)/g, ' x thuộc tập C ');
  s = s.replace(/\\mathbb\{C\}|ℂ/g, ' tập C ');

  // 3. Ký hiệu vô cùng:
  s = s.replace(/(?:-\s*\\infty|-\s*∞|-oo)\b/gi, ' âm vô cùng ');
  s = s.replace(/(?:\+\s*\\infty|\+\s*∞|\+oo)\b/gi, ' dương vô cùng ');
  s = s.replace(/(?:\\infty|∞|oo)\b/gi, ' vô cùng ');

  // 4. PHÂN BIỆT RÕ RÀNG TỌA ĐỘ ĐIỂM HÌNH HỌC VÀ KHOẢNG ĐƠN ĐIỆU:
  // 4a. Tọa độ điểm hình học: A(1; 2), B(-1; 3), M(2; -1), I(0; 1), O(0; 0), \vec{u}(1; 2)...
  s = s.replace(/(?:cho\s+điểm|điểm)\s+([A-Z])\s*\(\s*0\s*[;,]\s*0\s*\)/g, ' điểm $1 gốc tọa độ không không ');
  s = s.replace(/([A-Z])\s*\(\s*0\s*[;,]\s*0\s*\)/g, ' điểm $1 gốc tọa độ không không ');
  s = s.replace(/(?:cho\s+điểm|điểm)\s+([A-Z])\s*\(\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/g, ' điểm $1 tọa độ $2, $3, $4 ');
  s = s.replace(/([A-Z])\s*\(\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/g, ' điểm $1 tọa độ $2, $3, $4 ');
  s = s.replace(/(?:cho\s+điểm|điểm)\s+([A-Z])\s*\(\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/g, ' điểm $1 tọa độ $2, $3 ');
  s = s.replace(/([A-Z])\s*\(\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/g, ' điểm $1 tọa độ $2, $3 ');
  s = s.replace(/([A-Z])\s*\(\s*([a-zA-Z]\d*)\s*[;,]\s*([a-zA-Z]\d*)\s*\)/g, ' điểm $1 tọa độ $2, $3 ');
  s = s.replace(/\b(điểm)\s+điểm\b/g, 'điểm');
  s = s.replace(/(véc-tơ\s+[a-zA-Z0-9]+|\b\\vec\{?[a-zA-Z0-9]+\}?)\s*\(\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/g, ' $1 tọa độ $2, $3 ');
  s = s.replace(/(tọa độ|toạ độ|tọa độ cực đại|tọa độ cực tiểu|tọa độ cực trị|điểm cực đại|điểm cực tiểu|điểm cực trị|cực đại|cực tiểu|cực trị|giao điểm|tiếp điểm|tâm|đỉnh|hình chiếu|trung điểm|điểm uốn|tại điểm)\s*(?:của\s+đồ\s+thị\s+hàm\s+số)?\s*(?:là|=)?\s*\(\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/gi, ' $1 tọa độ $2, $3 ');

  // 4b. Khoảng trong ngữ cảnh xét tính đơn điệu và giải tích:
  s = s.replace(/(đồng biến|nghịch biến|đơn điệu|tăng|giảm|liên tục|khoảng biến thiên)\s+(?:trên\s+)?(?:khoảng\s+)?\(\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/gi, ' $1 trên khoảng từ $2 đến $3 ');
  s = s.replace(/(khoảng|thuộc khoảng|trên khoảng)\s*\(\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/gi, ' khoảng từ $2 đến $3 ');

  // 4c. Cặp ngoặc chứa VÔ CÙNG: (-∞; b), (a; +∞), (-∞; +∞) -> luôn là khoảng
  s = s.replace(/\(\s*(?:âm vô cùng|-\s*vô cùng|-\s*∞)\s*[;,]\s*(?:dương vô cùng|\+\s*vô cùng|\+\s*∞)\s*\)/gi, ' khoảng từ âm vô cùng đến dương vô cùng ');
  s = s.replace(/\(\s*(?:âm vô cùng|-\s*vô cùng|-\s*∞)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/gi, ' khoảng từ âm vô cùng đến $1 ');
  s = s.replace(/\(\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(?:dương vô cùng|\+\s*vô cùng|\+\s*∞)\s*\)/gi, ' khoảng từ $1 đến dương vô cùng ');
  s = s.replace(/\[\s*(?:âm vô cùng|-\s*vô cùng|-\s*∞)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\]/gi, ' nửa khoảng từ âm vô cùng đến $1 ');
  s = s.replace(/\[\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(?:dương vô cùng|\+\s*vô cùng|\+\s*∞)\s*\)/gi, ' nửa khoảng từ $1 đến dương vô cùng ');

  // 4d. Đoạn và Nửa khoảng:
  s = s.replace(/\[\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\]/g, ' đoạn từ $1 đến $2 ');
  s = s.replace(/\[\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/g, ' nửa khoảng từ $1 đến $2 ');
  s = s.replace(/\(\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\]/g, ' nửa khoảng từ $1 đến $2 ');
  s = s.replace(/\(\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/g, ' $1, $2 ');

  // 5. Phân số \frac{([^}]+)}{([^}]+)} -> "$1 phần $2"
  for (let iter = 0; iter < 5; iter++) {
    if (!s.includes('frac')) break;
    s = s.replace(/\\(?:d?frac)\{([^}]+)\}\{([^}]+)\}/g, ' $1 phần $2 ');
  }

  // 6. Căn bậc hai \sqrt{([^}]+)} -> "căn bậc hai của $1"
  for (let iter = 0; iter < 4; iter++) {
    if (!s.includes('sqrt')) break;
    s = s.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, ' căn bậc $1 của $2 ');
    s = s.replace(/\\sqrt\{([^}]+)\}/g, ' căn bậc hai của $1 ');
  }

  // 7. Số mũ: ^2 -> " bình phương", ^3 -> " mũ 3"
  s = s.replace(/\^2\b|\^\{2\}/g, ' bình phương ');
  s = s.replace(/\^3\b|\^\{3\}/g, ' mũ 3 ');
  s = s.replace(/\^\{([^}]+)\}/g, ' mũ $1 ');
  s = s.replace(/\^([0-9a-zA-Z])/g, ' mũ $1 ');

  // 8. Quan hệ tập hợp: \in -> "thuộc", \subset -> "con của", \cup -> "hợp", \cap -> "giao"
  s = s.replace(/\\in(?![a-zA-Z])/g, ' thuộc ');
  s = s.replace(/\\notin(?![a-zA-Z])/g, ' không thuộc ');
  s = s.replace(/\\subset(?![a-zA-Z])/g, ' con của ');
  s = s.replace(/\\cup(?![a-zA-Z])/g, ' hợp ');
  s = s.replace(/\\cap(?![a-zA-Z])/g, ' giao ');
  s = s.replace(/\\emptyset\b/g, ' tập rỗng ');

  // 9. Quan hệ so sánh và phép toán
  s = s.replace(/\\le\b|\\leq\b|<=/g, ' nhỏ hơn hoặc bằng ');
  s = s.replace(/\\ge\b|\\geq\b|>=/g, ' lớn hơn hoặc bằng ');
  s = s.replace(/\\ne\b|\\neq\b|!=/g, ' khác ');
  s = s.replace(/\\pm\b/g, ' cộng trừ ');
  s = s.replace(/\\times\b/g, ' nhân ');
  s = s.replace(/\\div\b/g, ' chia ');

  // 10. Phân biệt dấu '-' đứng trước số là "âm", đứng giữa phép tính là "trừ"
  s = s.replace(/(khoảng|đoạn|nửa khoảng)\s*-\s*(\d+)/gi, '$1 âm $2');
  s = s.replace(/,\s*-\s*(\d+)/g, ', âm $1');
  s = s.replace(/(^|[\s(=;,\[])-\s*(\d+)/g, '$1âm $2');
  s = s.replace(/(\d|[a-zA-Z])\s*-\s*(\d|[a-zA-Z])/g, '$1 trừ $2');

  // 11. Ký hiệu góc và tam giác
  s = s.replace(/\\angle\s*([A-Za-z0-9]+)/g, ' góc $1 ');
  s = s.replace(/\\triangle\s*([A-Za-z0-9]+)/g, ' tam giác $1 ');

  // 12. Giới hạn và tích phân
  s = s.replace(/\\lim/g, ' lim ');
  s = s.replace(/\\int/g, ' tích phân ');

  // 13. Loại bỏ toàn bộ dấu $ và dấu \
  s = s.replace(/\$/g, ' ');
  s = s.replace(/\\/g, ' ');

  // 14. Chuẩn hóa khoảng trắng
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Tiền xử lý chữ số & công thức toán học thuần tiếng Việt 100%
 * Biến các chữ số thành từ ngữ tiếng Việt để trình duyệt KHÔNG THỂ đọc tiếng Anh
 */
export function convertDigitsAndMathToVietnamese(raw: string): string {
  if (!raw) return '';
  let s = cleanMathForVietnameseTTS(raw, false);

  // 1. Trường hợp đặc biệt: Danh sách các chữ số rời rạc
  // Ví dụ: "1 2 3 4" hoặc "1, 2, 3, 4" hoặc "1 - 2 - 3 - 4"
  // Chuyển trực tiếp thành "Một, hai, ba, bốn"
  const digitsOnlyMatch = s.match(/^[\d\s,.\-–]+$/);
  if (digitsOnlyMatch) {
    const tokens = s.split(/[\s,.\-–]+/).filter(Boolean);
    if (tokens.length > 0) {
      const words = tokens.map((tk) => {
        if (/^\d+$/.test(tk)) {
          if (tk.length === 1) return singleDigitToVietnamese(tk);
          return numberToVietnameseWords(tk);
        }
        return tk;
      });
      const capitalized = words.map((w, idx) => (idx === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w));
      return capitalized.join(', ');
    }
  }

  // 1b. Phát âm chuẩn các phương án trắc nghiệm A, B, C, D bằng tiếng Việt
  s = s.replace(/\b(Phương án|Đáp án|Lựa chọn)\s*A\b/gi, 'Phương án A');
  s = s.replace(/\b(Phương án|Đáp án|Lựa chọn)\s*B\b/gi, 'Phương án Bê');
  s = s.replace(/\b(Phương án|Đáp án|Lựa chọn)\s*C\b/gi, 'Phương án Xê');
  s = s.replace(/\b(Phương án|Đáp án|Lựa chọn)\s*D\b/gi, 'Phương án Dê');

  s = s.replace(/(^|[\n.;,])\s*A\.\s*/g, '$1 Phương án A, ');
  s = s.replace(/(^|[\n.;,])\s*B\.\s*/g, '$1 Phương án Bê, ');
  s = s.replace(/(^|[\n.;,])\s*C\.\s*/g, '$1 Phương án Xê, ');
  s = s.replace(/(^|[\n.;,])\s*D\.\s*/g, '$1 Phương án Dê, ');

  // 1b-2. Chuẩn hóa triệt để ký hiệu Vô Cùng (Infinity) chuẩn sư phạm tiếng Việt
  // TUYỆT ĐỐI không đọc nhầm thành "phi" hoặc "in-phi-ty"
  s = s.replace(/(?:\\pm\s*\\infty|±\s*∞|±∞|\\pm\s*infty|±\s*oo|\+\/-\s*oo|\+\/-\s*infty)\b/gi, ' cộng trừ vô cùng ');
  s = s.replace(/(?:\+\s*\\infty|\+\s*∞|\+∞|\+\s*infty|\+\s*oo|\+oo)\b/gi, ' dương vô cùng ');
  s = s.replace(/(?:-\s*\\infty|-\s*∞|-∞|-\s*infty|-\s*oo|-oo)\b/gi, ' âm vô cùng ');
  s = s.replace(/\\(?:infty|infinity)\b|\b(?:infty|infinity)\b|∞/gi, ' vô cùng ');
  s = s.replace(/(^|[\s(;\[])\+oo(?=[\s);,\].]|$)/g, '$1dương vô cùng');
  s = s.replace(/(^|[\s(;\[])-oo(?=[\s);,\].]|$)/g, '$1âm vô cùng');
  s = s.replace(/(^|[\s(;\[])oo(?=[\s);,\].]|$)/g, '$1vô cùng');

  // Khắc phục triệt để lỗi tài liệu/OCR nhận diện nhầm ký hiệu Vô Cùng thành "phi", "\phi", "\varphi", "φ", "ϕ"
  s = s.replace(/\(\s*-\s*(?:\\phi|\\varphi|φ|ϕ|phi)\s*;\s*\+?\s*(?:\\phi|\\varphi|φ|ϕ|phi)\s*\)/gi, 'khoảng từ âm vô cùng đến dương vô cùng');
  s = s.replace(/\(\s*-\s*(?:\\phi|\\varphi|φ|ϕ|phi)\s*;\s*(-?\d+(?:[.,]\d+)?)\s*\)/gi, (_, b) => `khoảng từ âm vô cùng đến ${numberToVietnameseWords(b)}`);
  s = s.replace(/\(\s*(-?\d+(?:[.,]\d+)?)\s*;\s*\+?\s*(?:\\phi|\\varphi|φ|ϕ|phi)\s*\)/gi, (_, a) => `khoảng từ ${numberToVietnameseWords(a)} đến dương vô cùng`);
  s = s.replace(/\[\s*(-?\d+(?:[.,]\d+)?)\s*;\s*\+?\s*(?:\\phi|\\varphi|φ|ϕ|phi)\s*\)/gi, (_, a) => `nửa khoảng từ ${numberToVietnameseWords(a)} đến dương vô cùng`);
  s = s.replace(/\[\s*-\s*(?:\\phi|\\varphi|φ|ϕ|phi)\s*;\s*(-?\d+(?:[.,]\d+)?)\s*\]/gi, (_, b) => `nửa khoảng từ âm vô cùng đến ${numberToVietnameseWords(b)}`);
  s = s.replace(/(?:\\to|->|→|tiến tới|tiến đến)\s*\+\s*(?:\\phi|\\varphi|φ|ϕ|phi)\b/gi, ' tiến đến dương vô cùng ');
  s = s.replace(/(?:\\to|->|→|tiến tới|tiến đến)\s*-\s*(?:\\phi|\\varphi|φ|ϕ|phi)\b/gi, ' tiến đến âm vô cùng ');
  s = s.replace(/(?:\\to|->|→|tiến tới|tiến đến)\s*(?:\\phi|\\varphi|φ|ϕ|phi)\b/gi, ' tiến đến vô cùng ');
  s = s.replace(/(?:[+\/]\s*-\s*|±\s*)(?:\\phi|\\varphi|φ|ϕ|phi)\b/gi, ' cộng trừ vô cùng ');
  s = s.replace(/\+\s*(?:\\phi|\\varphi|φ|ϕ|phi)\b/gi, ' dương vô cùng ');
  s = s.replace(/-\s*(?:\\phi|\\varphi|φ|ϕ|phi)\b/gi, ' âm vô cùng ');

  // 1c. Tọa độ điểm hình học & vectơ (ƯU TIÊN CAO HƠN KHOẢNG ĐỂ KHÔNG BỊ ĐỌC NHẦM TỌA ĐỘ THÀNH KHOẢNG):
  s = s.replace(/([A-Z])\s*\(\s*0\s*[;,]\s*0\s*\)/g, 'điểm $1 gốc tọa độ không không');
  s = s.replace(/([A-Z])\s*\(\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/g, (_, pt, xCoord, yCoord, zCoord) => `điểm ${pt} tọa độ ${numberToVietnameseWords(xCoord)}, ${numberToVietnameseWords(yCoord)}, ${numberToVietnameseWords(zCoord)}`);
  s = s.replace(/([A-Z])\s*\(\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/g, (_, pt, xCoord, yCoord) => `điểm ${pt} tọa độ ${numberToVietnameseWords(xCoord)}, ${numberToVietnameseWords(yCoord)}`);
  s = s.replace(/(tọa độ|toạ độ|giao điểm|tiếp điểm|tâm|đỉnh|hình chiếu|trung điểm|điểm cực đại|điểm cực tiểu|điểm cực trị|điểm uốn|tại điểm)\s*(?:là|=)?\s*\(\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/gi, (_, prefix, xCoord, yCoord) => `${prefix} tọa độ ${numberToVietnameseWords(xCoord)}, ${numberToVietnameseWords(yCoord)}`);
  s = s.replace(/(tọa độ|toạ độ|giao điểm|tiếp điểm|tâm|đỉnh|hình chiếu|trung điểm)\s*(?:là|=)?\s*\(\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/gi, (_, prefix, xCoord, yCoord, zCoord) => `${prefix} tọa độ ${numberToVietnameseWords(xCoord)}, ${numberToVietnameseWords(yCoord)}, ${numberToVietnameseWords(zCoord)}`);

  // 1d. Đọc khoảng và đoạn toán học (ngữ cảnh xét tính đơn điệu, liên tục, hoặc chứa vô cùng):
  s = s.replace(/[\(\[]\s*(?:âm vô cùng|-\s*vô cùng)\s*[;,]\s*(?:dương vô cùng|\+\s*vô cùng)\s*[\)\]]/gi, 'khoảng từ âm vô cùng đến dương vô cùng');
  s = s.replace(/\(\s*(?:âm vô cùng|-\s*vô cùng)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/gi, (_, b) => `khoảng từ âm vô cùng đến ${numberToVietnameseWords(b)}`);
  s = s.replace(/\[\s*(?:âm vô cùng|-\s*vô cùng)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)/gi, (_, b) => `khoảng từ âm vô cùng đến ${numberToVietnameseWords(b)}`);
  s = s.replace(/\(\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(?:dương vô cùng|\+\s*vô cùng)\s*\)/gi, (_, a) => `khoảng từ ${numberToVietnameseWords(a)} đến dương vô cùng`);
  s = s.replace(/\[\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(?:dương vô cùng|\+\s*vô cùng)\s*\)/gi, (_, a) => `nửa khoảng từ ${numberToVietnameseWords(a)} đến dương vô cùng`);
  s = s.replace(/\(\s*(?:âm vô cùng|-\s*vô cùng)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\]/gi, (_, b) => `nửa khoảng từ âm vô cùng đến ${numberToVietnameseWords(b)}`);
  
  // Khoảng rõ ràng có từ khóa đơn điệu đứng trước:
  s = s.replace(/(đồng biến|nghịch biến|đơn điệu|tăng|giảm|liên tục)\s+trên\s+(?:khoảng\s+)?\((-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\)/gi, (_, kw, a, b) => `${kw} trên khoảng từ ${numberToVietnameseWords(a)} đến ${numberToVietnameseWords(b)}`);
  s = s.replace(/(khoảng|thuộc khoảng)\s*\((-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\)/gi, (_, kw, a, b) => `${kw} từ ${numberToVietnameseWords(a)} đến ${numberToVietnameseWords(b)}`);
  s = s.replace(/\[(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\]/g, (_, a, b) => `đoạn từ ${numberToVietnameseWords(a)} đến ${numberToVietnameseWords(b)}`);
  s = s.replace(/(khoảng|đoạn)\s+(khoảng|đoạn)\s+từ/gi, '$1 từ');

  // Xóa triệt để từ "chia cho" vô tình gắn sau Phương án A/B/C/D
  s = s.replace(/(Phương án|Đáp án|Lựa chọn)\s*([A-Da-d])\s*(?:chia cho|chia|\/|:)\s*/gi, '$1 $2, ');
  s = s.replace(/(^|[\n.,;])\s*([A-Da-d])\s*(?:chia cho|chia|\/|:)\s*/gi, '$1 Phương án $2, ');

  // 1e. Hệ trục tọa độ
  s = s.replace(/\bOxyz\b/g, 'hệ tọa độ O x y z');
  s = s.replace(/\bOxy\b/g, 'hệ tọa độ O x y');
  s = s.replace(/\bOx\b/g, 'trục hoành O x');
  s = s.replace(/\bOy\b/g, 'trục tung O y');
  s = s.replace(/\bOz\b/g, 'trục cao O z');

  // 2. Chuyển đổi các tiền tố sư phạm phổ biến
  // "Câu 1" -> "Câu một", "Bài 2" -> "Bài hai", "Ví dụ 3" -> "Ví dụ ba"
  s = s.replace(/\b(Câu|câu)\s*(\d+)\b/g, (_, prefix, num) => `${prefix} ${numberToVietnameseWords(num)}`);
  s = s.replace(/\b(Bài|bài)\s*(\d+)\b/g, (_, prefix, num) => `${prefix} ${numberToVietnameseWords(num)}`);
  s = s.replace(/\b(Ví dụ|ví dụ)\s*(\d+)\b/g, (_, prefix, num) => `${prefix} ${numberToVietnameseWords(num)}`);
  s = s.replace(/\b(Đề|đề)\s*(\d+)\b/g, (_, prefix, num) => `${prefix} ${numberToVietnameseWords(num)}`);
  s = s.replace(/\b(Trang|trang)\s*(\d+)\b/g, (_, prefix, num) => `${prefix} ${numberToVietnameseWords(num)}`);
  s = s.replace(/\b(Phần|phần)\s*(\d+)\b/g, (_, prefix, num) => `${prefix} ${numberToVietnameseWords(num)}`);

  // 2b. Số thập phân, phần trăm và góc độ
  s = s.replace(/(\d+)[.,](\d+)\s*°/g, (_, a, b) => `${numberToVietnameseWords(a)} phẩy ${numberToVietnameseWords(b)} độ`);
  s = s.replace(/(\d+)\s*°/g, (_, num) => `${numberToVietnameseWords(num)} độ`);
  s = s.replace(/(\d+)\s*%/g, (_, num) => `${numberToVietnameseWords(num)} phần trăm`);
  s = s.replace(/(\d+)[.,](\d+)/g, (_, a, b) => `${numberToVietnameseWords(a)} phẩy ${numberToVietnameseWords(b)}`);

  // 2c. Phân số dạng a/b (ví dụ: 1/2, 3/4, -5/2)
  s = s.replace(/(-?\d+)\s*\/\s*(\d+)/g, (_, num, denom) => `${numberToVietnameseWords(num)} phần ${numberToVietnameseWords(denom)}`);

  // 3. Chuyển đổi công thức toán học và phép tính
  // Dấu bằng: "x = 2" -> "x bằng hai"
  s = s.replace(/\s*=\s*/g, ' bằng ');
  s = s.replace(/\s*!=\s*/g, ' khác ');
  s = s.replace(/\s*≠\s*/g, ' khác ');
  s = s.replace(/\s*\+\s*/g, ' cộng ');
  s = s.replace(/\s*-\s*(?=[\d\w])/g, ' trừ ');
  s = s.replace(/\s*[*×•]\s*/g, ' nhân ');
  // Ký hiệu phép chia toán học: ÷ hoặc dấu hai chấm chia giữa 2 số (ví dụ 6 : 2 = 3)
  s = s.replace(/\s*÷\s*/g, ' chia cho ');
  s = s.replace(/(\d+)\s*:\s*(\d+)/g, (_, a, b) => `${numberToVietnameseWords(a)} chia cho ${numberToVietnameseWords(b)}`);
  // Dấu hai chấm câu / liệt kê (như Phương án A:, Câu 1:) chuyển thành ngắt giọng tự nhiên, TUYỆT ĐỐI không đọc "chia cho"
  s = s.replace(/:\s*/g, ', ');

  // Xóa dứt điểm nếu "chia cho" xuất hiện sau nhãn phương án
  s = s.replace(/\b(Phương án|Đáp án|Lựa chọn)\s*([A-Da-d0-9]+)\s*chia cho\s*/gi, '$1 $2, ');

  // 3b. Số âm: -1 -> trừ một, -25 -> trừ hai mươi lăm
  s = s.replace(/(^|\s)-(\d+)($|\s|[,.;:!?\)])/g, (_, pre, n, post) => `${pre}trừ ${numberToVietnameseWords(n)}${post}`);

  // 4. Lượng giác & Logarit & Vectơ chuẩn tiếng Việt sư phạm
  s = s.replace(/\\sin\b|(?<![a-zA-Z])sin\b/g, ' sin ');
  s = s.replace(/\\cos\b|(?<![a-zA-Z])cos\b/g, ' cốt ');
  s = s.replace(/\\tan\b|(?<![a-zA-Z])tan\b/g, ' tang ');
  s = s.replace(/\\cot\b|(?<![a-zA-Z])cot\b/g, ' cô-tang ');
  s = s.replace(/\\ln\b|(?<![a-zA-Z])ln\b/g, ' lô-ga-rít tự nhiên của ');
  s = s.replace(/\\log_([a-zA-Z0-9]+)\b|log_([a-zA-Z0-9]+)\b/g, (_, b1, b2) => ` lô-ga-rít cơ số ${b1 || b2} của `);

  // 4b. Các biến đi kèm số: "12a" -> "mười hai a", "2x" -> "hai x", "x1" -> "x một"
  s = s.replace(/\b(\d+)([a-zA-Z])\b/g, (_, n, char) => `${numberToVietnameseWords(n)} ${char}`);
  s = s.replace(/\b([a-zA-Z])(\d+)\b/g, (_, char, n) => `${char} ${numberToVietnameseWords(n)}`);

  // 5. Chuyển đổi các chữ số đơn lẻ còn lại thành từ ngữ tiếng Việt
  s = s.replace(/(^|\s)(\d)($|\s|[,.;:!?])/g, (_, pre, d, post) => `${pre}${singleDigitToVietnamese(d)}${post}`);

  // 6. Chuyển đổi các số có 2 chữ số đứng độc lập
  s = s.replace(/(^|\s)(\d{2})($|\s|[,.;:!?])/g, (_, pre, n, post) => `${pre}${numberToVietnameseWords(n)}${post}`);

  return s;
}

/**
 * Smart Speech Preprocessor (Toán học & Ngắt nghỉ tự nhiên)
 * Chuyển toàn bộ ký hiệu toán và chữ số sang lời đọc tiếng Việt chuẩn xác
 */
export function preprocessSpeechText(rawText: string, isEnglishSubject: boolean = false): string {
  if (!rawText) return '';
  if (isEnglishSubject) {
    return cleanMathForVietnameseTTS(rawText, true);
  }

  // Khắc phục triệt để lỗi vỡ font tiếng Việt từ PDF/Scan trước khi chuyển thành lời đọc
  let t = cleanPdfVietnameseText(rawText);

  // 0a. Chuẩn hóa triệt để ký hiệu VÔ CÙNG (Infinity) - TUYỆT ĐỐI không đọc nhầm thành "phi" hay "in-phi-ty"
  t = t.replace(/(?:\\pm\s*\\infty|±\s*∞|±∞|\\pm\s*infty|±\s*oo|\+\/-\s*oo|\+\/-\s*infty)\b/gi, ' cộng trừ vô cùng ');
  t = t.replace(/(?:\+\s*\\infty|\+\s*∞|\+∞|\+\s*infty|\+\s*oo|\+oo)\b/gi, ' dương vô cùng ');
  t = t.replace(/(?:-\s*\\infty|-\s*∞|-∞|-\s*infty|-\s*oo|-oo)\b/gi, ' âm vô cùng ');
  t = t.replace(/\\(?:infty|infinity)\b|\b(?:infty|infinity)\b|∞/gi, ' vô cùng ');
  t = t.replace(/(^|[\s(;\[])\+oo(?=[\s);,\].]|$)/g, '$1dương vô cùng');
  t = t.replace(/(^|[\s(;\[])-oo(?=[\s);,\].]|$)/g, '$1âm vô cùng');
  t = t.replace(/(^|[\s(;\[])oo(?=[\s);,\].]|$)/g, '$1vô cùng');

  // 0b. Loại bỏ triệt để từ "chia cho" vô lý sau Phương án A/B/C/D
  t = t.replace(/(Phương án|Đáp án|Lựa chọn)\s*([A-Da-d])\s*chia cho\s*/gi, '$1 $2, ');
  t = t.replace(/(^|[\n.,;])\s*([A-Da-d])\s*chia cho\s*/gi, '$1 Phương án $2, ');
  t = t.replace(/(Phương án|Đáp án|Lựa chọn)\s*([A-Da-d])\s*[:]\s*/gi, '$1 $2, ');

  // 0c. Mở rộng từ viết tắt hành chính giáo dục & tiêu đề tài liệu chuẩn tiếng Việt
  t = t.replace(/\bTHPT\b/g, 'Trung học phổ thông');
  t = t.replace(/\bTHCS\b/g, 'Trung học cơ sở');
  t = t.replace(/\bTN\.THPT\b/gi, 'Tốt nghiệp Trung học phổ thông');
  t = t.replace(/\bBGH\b/g, 'Ban giám hiệu');
  t = t.replace(/\bGD&ĐT\b/gi, 'Giáo dục và Đào tạo');
  t = t.replace(/\bGD-ĐT\b/gi, 'Giáo dục và Đào tạo');
  t = t.replace(/\bHK\s*II\b/gi, 'Học kỳ hai');
  t = t.replace(/\bHK\s*I\b/gi, 'Học kỳ một');
  t = t.replace(/\bHK2\b/gi, 'Học kỳ hai');
  t = t.replace(/\bHK1\b/gi, 'Học kỳ một');
  t = t.replace(/\bNH\s*(\d{4})\s*[-–]\s*(\d{4})\b/gi, 'Năm học $1 đến $2');
  t = t.replace(/\bNH\b/g, 'Năm học');

  // Mở rộng ngày tháng: DD/MM/YYYY
  t = t.replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (_, d, m, y) => `ngày ${parseInt(d, 10)} tháng ${parseInt(m, 10)} năm ${y}`);

  // Mở rộng số La Mã ở đầu phần: I., II., III., IV., V., VI.
  t = t.replace(/(^|\n)\s*I\.\s+/g, '$1Phần một La Mã, ');
  t = t.replace(/(^|\n)\s*II\.\s+/g, '$1Phần hai La Mã, ');
  t = t.replace(/(^|\n)\s*III\.\s+/g, '$1Phần ba La Mã, ');
  t = t.replace(/(^|\n)\s*IV\.\s+/g, '$1Phần bốn La Mã, ');
  t = t.replace(/(^|\n)\s*V\.\s+/g, '$1Phần năm La Mã, ');
  t = t.replace(/(^|\n)\s*VI\.\s+/g, '$1Phần sáu La Mã, ');

  // Mở rộng mục đánh số: 1. -> Mục 1:
  t = t.replace(/(^|\n)\s*(\d+)\.\s+/g, (_, pre, num) => `${pre}Mục ${num}: `);

  // Mở rộng tỷ số: 498 / 11 lớp -> 498 trên 11 lớp
  t = t.replace(/(\d+)\s*\/\s*(\d+)\s*(lớp|học sinh|em)/gi, '$1 trên $2 $3');

  // 1. Remove LaTeX enclosing tags: $, $$, \( \), \[ \]
  t = t.replace(/\$\$(.+?)\$\$/gs, ' $1 ');
  t = t.replace(/\$([^\$]+)\$/g, ' $1 ');
  t = t.replace(/\\\((.+?)\\\)/g, ' $1 ');
  t = t.replace(/\\\[(.+?)\\\]/gs, ' $1 ');

  // 2. Clean common LaTeX formatting commands
  t = t.replace(/\\displaystyle/g, ' ');
  t = t.replace(/\\text\{([^}]+)\}/g, ' $1 ');
  t = t.replace(/\\mathrm\{([^}]+)\}/g, ' $1 ');
  t = t.replace(/\\mathbf\{([^}]+)\}/g, ' $1 ');
  t = t.replace(/\\mathbb\{R\}\s*\\setminus\s*\\?\{([^}]+)\}/g, ' tập R hiệu $1 ');
  t = t.replace(/(?:x\s*\\in|x\s*∈|x\s*thuộc)\s*(?:\\mathbb\{R\}|ℝ|\bIR\b)/g, ' x thuộc tập R ');
  t = t.replace(/\\mathbb\{R\}|ℝ|\bIR\b/g, ' tập R ');
  t = t.replace(/\\mathbb\{N\}\^\*|ℕ\*/g, ' tập N sao ');
  t = t.replace(/\\mathbb\{N\}|ℕ/g, ' tập N ');
  t = t.replace(/\\mathbb\{Z\}|ℤ/g, ' tập Z ');
  t = t.replace(/\\mathbb\{Q\}|ℚ/g, ' tập Q ');
  t = t.replace(/\\mathbb\{C\}|ℂ/g, ' tập C ');
  t = t.replace(/\\left\s*([(\[{|])/g, '$1');
  t = t.replace(/\\right\s*([)\]}|])/g, '$1');

  // 2b. Derivatives & Functions in Vietnamese: đọc từng chữ rõ ràng chuẩn sư phạm GDPT
  t = t.replace(/y\s*=\s*f\s*\(\s*x\s*\)/gi, ' y bằng f x ');
  t = t.replace(/f\s*\(\s*x\s*\)\s*=\s*/gi, ' f x bằng ');
  t = t.replace(/f'''\s*\(([a-zA-Z])\)/g, ' f ba phẩy $1 ');
  t = t.replace(/f''\s*\(([a-zA-Z])\)/g, ' f hai phẩy $1 ');
  t = t.replace(/f'\s*\(([a-zA-Z])\)/g, ' f phẩy $1 ');
  t = t.replace(/\by''\b/g, ' y hai phẩy ');
  t = t.replace(/\by'\b/g, ' y phẩy ');
  t = t.replace(/\bf\s*\(([a-zA-Z])\)/g, ' f $1 ');
  t = t.replace(/\bg\s*\(([a-zA-Z])\)/g, ' g $1 ');
  t = t.replace(/\bh\s*\(([a-zA-Z])\)/g, ' h $1 ');

  // 3. Fractions: \frac{a}{b} -> phân số a trên b
  t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, ' phân số $1 trên $2, ');

  // 4. Square roots: \sqrt{x}, \sqrt[3]{x}
  t = t.replace(/\\sqrt\[3\]\{([^}]+)\}/g, ' căn bậc ba của $1, ');
  t = t.replace(/\\sqrt\{([^}]+)\}/g, ' căn bậc hai của $1, ');
  t = t.replace(/∛([a-zA-Z0-9]+)/g, ' căn bậc ba của $1, ');
  t = t.replace(/√([a-zA-Z0-9]+)/g, ' căn bậc hai của $1, ');
  t = t.replace(/√\(([^)]+)\)/g, ' căn bậc hai của $1, ');

  // 4b. Parentheses powers: (x - 2)^2 -> mở ngoặc x trừ hai đóng ngoặc bình phương
  t = t.replace(/\(([^)]+)\)\^2/g, ' mở ngoặc $1 đóng ngoặc bình phương ');
  t = t.replace(/\(([^)]+)\)\^3/g, ' mở ngoặc $1 đóng ngoặc mũ ba ');
  t = t.replace(/\(([^)]+)\)\^\{([^}]+)\}/g, ' mở ngoặc $1 đóng ngoặc mũ $2 ');
  t = t.replace(/\(([^)]+)\)\^([a-zA-Z0-9]+)/g, ' mở ngoặc $1 đóng ngoặc mũ $2 ');

  // 5. Exponents: x^2 -> x bình phương, x^3 -> x mũ ba
  t = t.replace(/([a-zA-Z0-9_\)]+)\^2(?![0-9])/g, ' $1 bình phương ');
  t = t.replace(/([a-zA-Z0-9_\)]+)²(?![0-9])/g, ' $1 bình phương ');
  t = t.replace(/([a-zA-Z0-9_\)]+)\^3(?![0-9])/g, ' $1 mũ ba ');
  t = t.replace(/([a-zA-Z0-9_\)]+)³(?![0-9])/g, ' $1 mũ ba ');
  t = t.replace(/([a-zA-Z0-9_\)]+)\^\{([^}]+)\}/g, ' $1 mũ $2 ');
  t = t.replace(/([a-zA-Z0-9_\)]+)\^([a-zA-Z0-9]+)/g, ' $1 mũ $2 ');

  // 5b. Multiplication between variable and parenthesis: x(x - 2) -> x nhân, mở ngoặc
  t = t.replace(/([a-zA-Z0-9])\s*mở ngoặc/g, '$1 nhân, mở ngoặc');
  t = t.replace(/đóng ngoặc\s*(bình phương|mũ ba|mũ [a-zA-Z0-9]+)\s*mở ngoặc/g, 'đóng ngoặc $1, nhân, mở ngoặc');

  // 6. KÝ HIỆU VÔ CÙNG: Xử lý trước tiên để tránh bị các regex sau (như \in hay chỉ số dưới) cắt xén
  t = t.replace(/(?:\\pm\s*\\infty|±\s*∞|±∞)/g, ' cộng trừ vô cùng ');
  t = t.replace(/(?:\+\s*\\infty|\+\s*∞|\+∞)/g, ' dương vô cùng ');
  t = t.replace(/(?:-\s*\\infty|-\s*∞|-∞)/g, ' âm vô cùng ');
  t = t.replace(/(?:\\infty|∞)/g, ' vô cùng ');

  // Giới hạn lim x tiến về vô cùng hoặc giá trị
  t = t.replace(/\\?lim_\{?\s*([a-zA-Z0-9]+)\s*(?:\\to|->|→)\s*([^}]+)\}?/gi, (_, v, target) => ` giới hạn khi ${v} tiến đến ${target.trim()} của `);
  t = t.replace(/([a-zA-Z])\s*(?:\\to|->|→)\s*(?:dương vô cùng|\+\s*\\infty|\+∞)/g, ' $1 tiến đến dương vô cùng ');
  t = t.replace(/([a-zA-Z])\s*(?:\\to|->|→)\s*(?:âm vô cùng|-\s*\\infty|-∞)/g, ' $1 tiến đến âm vô cùng ');
  t = t.replace(/([a-zA-Z])\s*(?:\\to|->|→)\s*(?:vô cùng|\\infty|∞)/g, ' $1 tiến đến vô cùng ');
  t = t.replace(/\\?lim\b/gi, ' giới hạn lim ');

  // 6b. Subscripts: x_1, x_2
  t = t.replace(/([a-zA-Z])_0/g, ' $1 không ');
  t = t.replace(/([a-zA-Z])_1/g, ' $1 một ');
  t = t.replace(/([a-zA-Z])_2/g, ' $1 hai ');
  t = t.replace(/([a-zA-Z])_3/g, ' $1 ba ');
  t = t.replace(/([a-zA-Z])_\{([^}]+)\}/g, ' $1 $2 ');
  t = t.replace(/([a-zA-Z])_([a-zA-Z0-9]+)/g, ' $1 $2 ');

  // 7b. Math symbols với ranh giới ký tự chặt chẽ chống nuốt từ
  t = t.replace(/\\pm(?![a-zA-Z])/g, ' cộng trừ ');
  t = t.replace(/±/g, ' cộng trừ ');
  t = t.replace(/\\notin(?![a-zA-Z])/g, ' không thuộc ');
  t = t.replace(/∉/g, ' không thuộc ');
  t = t.replace(/\\in(?![a-zA-Z])/g, ' thuộc ');
  t = t.replace(/∈/g, ' thuộc ');
  t = t.replace(/\\subset(?![a-zA-Z])/g, ' tập con của ');
  t = t.replace(/\\cup(?![a-zA-Z])/g, ' hợp với ');
  t = t.replace(/\\cap(?![a-zA-Z])/g, ' giao với ');

  t = t.replace(/\\implies/g, ', suy ra, ');
  t = t.replace(/\\Rightarrow/g, ', suy ra, ');
  t = t.replace(/=>/g, ', suy ra, ');
  t = t.replace(/⇒/g, ', suy ra, ');

  t = t.replace(/\\iff/g, ', tương đương, ');
  t = t.replace(/\\Leftrightarrow/g, ', tương đương, ');
  t = t.replace(/<=>/g, ', tương đương, ');
  t = t.replace(/⇔/g, ', tương đương, ');

  t = t.replace(/\\le(?![a-zA-Z])/g, ' nhỏ hơn hoặc bằng ');
  t = t.replace(/\\leq(?![a-zA-Z])/g, ' nhỏ hơn hoặc bằng ');
  t = t.replace(/<=/g, ' nhỏ hơn hoặc bằng ');
  t = t.replace(/≤/g, ' nhỏ hơn hoặc bằng ');
  t = t.replace(/\\ge(?![a-zA-Z])/g, ' lớn hơn hoặc bằng ');
  t = t.replace(/\\geq(?![a-zA-Z])/g, ' lớn hơn hoặc bằng ');
  t = t.replace(/>=/g, ' lớn hơn hoặc bằng ');
  t = t.replace(/≥/g, ' lớn hơn hoặc bằng ');
  t = t.replace(/\\neq(?![a-zA-Z])/g, ' khác ');
  t = t.replace(/!=/g, ' khác ');
  t = t.replace(/≠/g, ' khác ');

  t = t.replace(/\\approx/g, ' xấp xỉ ');
  t = t.replace(/≈/g, ' xấp xỉ ');
  t = t.replace(/\\int(?![a-zA-Z])/g, ' tích phân ');
  t = t.replace(/∫/g, ' tích phân ');
  t = t.replace(/\\sum(?![a-zA-Z])/g, ' tổng xích-ma ');
  t = t.replace(/∑/g, ' tổng xích-ma ');
  t = t.replace(/\\emptyset|\\empty|∅/g, ' tập rỗng ');
  t = t.replace(/\\varphi\b/g, ' phi ');
  t = t.replace(/\\phi\b/g, ' phi ');
  t = t.replace(/\\alpha\b/g, ' an-pha ');
  t = t.replace(/\\beta\b/g, ' bê-ta ');
  t = t.replace(/\\gamma\b/g, ' ga-ma ');
  t = t.replace(/\\delta\b/g, ' đen-ta ');
  t = t.replace(/\\Delta\b/g, ' đen-ta ');
  t = t.replace(/\\theta\b/g, ' tê-ta ');
  t = t.replace(/\\lambda\b/g, ' lam-đa ');
  t = t.replace(/\\omega\b/g, ' ô-mê-ga ');
  t = t.replace(/\\Omega\b/g, ' ôm ');
  t = t.replace(/\\pi\b/g, ' pi ');
  t = t.replace(/\\forall(?![a-zA-Z])/g, ' với mọi ');
  t = t.replace(/∀/g, ' với mọi ');
  t = t.replace(/\\exists(?![a-zA-Z])/g, ' tồn tại ');
  t = t.replace(/∃/g, ' tồn tại ');

  // 8. BẮT BUỘC: Chuyển đổi toàn bộ chữ số rời rạc và công thức sang từ ngữ tiếng Việt
  t = convertDigitsAndMathToVietnamese(t);

  // 9. Ngắt nghỉ tự nhiên sau các mệnh đề sư phạm
  const pauseKeywords = [
    { pattern: /\b(ta có)\b/gi, replacement: '$1, ' },
    { pattern: /\b(do đó)\b/gi, replacement: '$1, ' },
    { pattern: /\b(vì vậy)\b/gi, replacement: '$1, ' },
    { pattern: /\b(xét hàm số)\b/gi, replacement: '$1, ' },
    { pattern: /\b(điều kiện xác định)\b/gi, replacement: '$1: ' },
    { pattern: /\b(tập xác định)\b/gi, replacement: '$1, ' },
    { pattern: /\b(kết luận)\b/gi, replacement: '$1: ' },
    { pattern: /\b(khi và chỉ khi)\b/gi, replacement: ', $1, ' },
  ];

  for (const { pattern, replacement } of pauseKeywords) {
    t = t.replace(pattern, replacement);
  }

  // 10. Dọn dẹp khoảng trắng và dấu câu thừa
  t = t.replace(/[,;]\s*[,;]+/g, ', ');
  t = t.replace(/:\s*:/g, ': ');
  t = t.replace(/\s+/g, ' ').trim();

  return t;
}

let isSpeechCancelled = false;

/**
 * Immediate stop of any active speech synthesis or Google Cloud / Gemini audio
 */
export function stopAllSpeech(): void {
  isSpeechCancelled = true;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
    } catch (_) {}
  }
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
      currentAudioElement.src = '';
    } catch (_) {}
    currentAudioElement = null;
  }
  stopActiveAudioContext();
}

/**
 * Alias cho nút "Dừng đọc" trên giao diện
 */
export const stopSpeaking = stopAllSpeech;

export interface SpeakOptions {
  preset?: VoiceTonePreset;
  subject?: string;
  isEnglish?: boolean;
  preferGemini?: boolean;
  preferWebSpeech?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

/**
 * Chia văn bản thành các câu hoặc phân đoạn tự nhiên (tối đa ~220 ký tự) để đọc liền mạch
 */
function splitIntoSentences(text: string, maxLen: number = 220): string[] {
  const parts: string[] = [];
  const rawSentences = text.split(/(?<=[.!?:;\n])\s+/);
  let current = '';

  for (const s of rawSentences) {
    if (!s.trim()) continue;
    if (current && (current.length + s.length + 1) > maxLen) {
      parts.push(current.trim());
      current = s;
    } else {
      current = current ? current + ' ' + s : s;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

/**
 * Phát âm thanh trực tiếp từ Google Translate TTS audio stream
 * Đảm bảo 100% mọi trình duyệt trên Vercel đều phát ra tiếng Việt chuẩn kể cả khi máy khách không có voice vi-VN và chưa nhập Gemini Key
 */
export async function speakWithGoogleTranslateStream(
  processedText: string,
  lang: 'vi' | 'en' = 'vi',
  playbackRate: number = 1.08,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): Promise<boolean> {
  if (!processedText || !processedText.trim()) return false;

  stopAllSpeech();
  isSpeechCancelled = false;
  unlockWebAudio();

  // Chia nhỏ theo câu ngắn (tối đa ~120 ký tự) để stream Google Translate ổn định và đọc dứt khoát
  const chunks = splitIntoSentences(processedText.trim(), 120);
  if (chunks.length === 0) return false;

  let started = false;
  let allChunksSuccess = true;

  for (let i = 0; i < chunks.length; i++) {
    if (isSpeechCancelled) {
      allChunksSuccess = false;
      break;
    }

    const chunk = chunks[i];
    const encoded = encodeURIComponent(chunk);
    const candidateUrls = [
      `/api/tts?lang=${lang}&text=${encoded}`,
      `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${lang}&dt=t&q=${encoded}`,
      `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encoded}`,
    ];

    let played = false;
    for (const streamUrl of candidateUrls) {
      if (isSpeechCancelled) break;
      played = await new Promise<boolean>((resolve) => {
        try {
          const audio = new Audio();
          currentAudioElement = audio;
          try {
            (audio as any).referrerPolicy = 'no-referrer';
          } catch (_) {}
          audio.playbackRate = playbackRate || 1.08;

          audio.onplay = () => {
            if (!started) {
              started = true;
              if (onStart && !isSpeechCancelled) onStart();
            }
          };

          audio.onended = () => {
            currentAudioElement = null;
            resolve(true);
          };

          audio.onerror = () => {
            currentAudioElement = null;
            resolve(false);
          };

          audio.src = streamUrl;
          const p = audio.play();
          if (p !== undefined) {
            p.catch(() => {
              currentAudioElement = null;
              resolve(false);
            });
          }
        } catch (_) {
          resolve(false);
        }
      });

      if (played) {
        break;
      }
    }

    if (!played && !isSpeechCancelled) {
      allChunksSuccess = false;
      break;
    }
  }

  if (allChunksSuccess) {
    if (onEnd && !isSpeechCancelled) onEnd();
    return true;
  }

  if (onError) onError(new Error('TTS audio stream encountered an issue.'));
  return false;
}

/**
 * Phát giọng đọc Google Cloud Text-To-Speech / Audio Stream
 * - Hỗ trợ 100% Tiếng Việt chuẩn ngữ âm sư phạm cho tất cả các môn (Toán, Lý, Hóa, Sinh, Văn, Sử, Địa, v.v.)
 * - Tự động nhận diện và phát âm tiếng Anh chuẩn bản ngữ cho riêng bộ môn Tiếng Anh / Anh Văn
 * - Hoạt động ổn định trên cả Web Vercel, Netlify lẫn AI Studio Preview
 */
export async function speakWithGoogleCloudTTS(
  processedText: string,
  preset: VoiceTonePreset = VOICE_TONE_PRESETS[0],
  lang: 'vi' | 'en' = 'vi',
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): Promise<boolean> {
  if (!processedText || !processedText.trim()) return false;

  stopAllSpeech();
  isSpeechCancelled = false;
  unlockWebAudio();

  let playbackRate = preset.rate || 1.05;
  const encoded = encodeURIComponent(processedText.trim());

  try {
    const audio = new Audio();
    currentAudioElement = audio;
    try {
      (audio as any).referrerPolicy = 'no-referrer';
    } catch (_) {}
    audio.playbackRate = playbackRate;

    audio.onplay = () => {
      if (!isSpeechCancelled && onStart) onStart();
    };

    audio.onended = () => {
      if (!isSpeechCancelled && onEnd) onEnd();
      currentAudioElement = null;
    };

    audio.onerror = () => {
      currentAudioElement = null;
      speakWithGoogleTranslateStream(processedText, lang, playbackRate, onStart, onEnd, onError);
    };

    audio.src = `/api/tts?lang=${lang}&text=${encoded}`;
    const p = audio.play();
    if (p !== undefined) {
      p.catch(() => {
        currentAudioElement = null;
        speakWithGoogleTranslateStream(processedText, lang, playbackRate, onStart, onEnd, onError);
      });
    }
    return true;
  } catch (err) {
    console.warn('speakWithGoogleCloudTTS error:', err);
    return speakWithGoogleTranslateStream(processedText, lang, playbackRate, onStart, onEnd, onError);
  }
}

/**
 * Web Speech API Fallback (Cố định vi-VN cho các môn tiếng Việt, en-US cho môn Anh Văn)
 * Khắc phục triệt để lỗi đọc giọng tiếng Anh lạ: nếu máy khách không có voice vi-VN,
 * tự động chuyển sang Google Translate TTS Stream tiếng Việt chuẩn 100%!
 */
export function speakWithWebSpeech(
  processedText: string,
  preset: VoiceTonePreset = VOICE_TONE_PRESETS[0],
  lang: 'vi' | 'en' = 'vi',
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    speakWithGoogleTranslateStream(processedText, lang, preset.rate || 1.0, onStart, onEnd, onError);
    return true;
  }

  try {
    let didCancel = false;
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
      didCancel = true;
    }
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // Đảm bảo getVoices() mới nhất
    let voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      cachedVoices = voices;
    }

    const isEn = lang === 'en';
    const targetLang = isEn ? 'en-US' : 'vi-VN';
    const matchedVoice = isEn ? getBestEnglishVoice() : getBestVietnameseVoice(preset.gender);

    // Nếu là tiếng Việt nhưng trình duyệt không có gói giọng tiếng Việt:
    // Trả về false ngay để speakText lập tức chuyển sang máy chủ TTS (/api/tts) tốc độ cao, không bị treo im lặng
    if (!isEn && !matchedVoice) {
      return false;
    }

    // Chia câu nhỏ nếu văn bản dài để tránh bug Chrome tự động ngắt sau 15 giây
    const textParts = splitIntoSentences(processedText.trim(), 160);
    if (textParts.length === 0) return false;

    let currentIndex = 0;
    let hasStarted = false;

    // Giữ tham chiếu tránh Chrome Garbage Collection hủy utterance
    const activeUtterances: SpeechSynthesisUtterance[] = [];
    (window as any)._activeUtterances = activeUtterances;

    const speakNext = () => {
      if (isSpeechCancelled || currentIndex >= textParts.length) {
        (window as any)._activeUtterances = null;
        if (onEnd && !isSpeechCancelled) onEnd();
        return;
      }

      const part = textParts[currentIndex];
      const utterance = new SpeechSynthesisUtterance(part);
      utterance.lang = targetLang;
      utterance.pitch = preset.pitch || 1.0;
      utterance.rate = preset.rate || 1.05;
      utterance.volume = 1.0;
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onstart = () => {
        if (!hasStarted) {
          hasStarted = true;
          if (onStart && !isSpeechCancelled) onStart();
        }
      };

      utterance.onend = () => {
        currentIndex++;
        speakNext();
      };

      utterance.onerror = (e) => {
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          console.warn('Web Speech chunk notice:', e);
          currentIndex++;
          speakNext();
        } else {
          if (onEnd) onEnd();
        }
      };

      activeUtterances.push(utterance);
      window.speechSynthesis.speak(utterance);
    };

    if (didCancel) {
      setTimeout(() => {
        if (!isSpeechCancelled) {
          speakNext();
        }
      }, 30);
    } else {
      speakNext();
    }
    return true;
  } catch (err) {
    console.error('Error starting Web Speech synthesis, falling back to Google TTS stream:', err);
    speakWithGoogleTranslateStream(processedText, lang, preset.rate || 1.0, onStart, onEnd, onError);
    return true;
  }
}

/**
 * Ultra-fast Text-to-Speech execution (<50ms).
 * ƯU TIÊN 1: Web Speech API tức thì trên trình duyệt (0ms độ trễ) nếu máy có giọng đọc phù hợp.
 * ƯU TIÊN 2: Máy chủ TTS stream (/api/tts) tốc độ cao (<100ms, 100% tiếng Việt chuẩn, không độ trễ).
 */
export function speakText(text: string, options: SpeakOptions = {}): boolean {
  if (!text || !text.trim()) return false;

  stopAllSpeech();
  unlockWebAudio();

  const isEnglish = !!options.isEnglish || 
    (typeof options.subject === 'string' && (
      options.subject.toLowerCase().includes('tiếng anh') || 
      options.subject.toLowerCase().includes('english') ||
      options.subject.toLowerCase().includes('anh văn') ||
      options.subject.toLowerCase().includes('ngoại ngữ')
    ));

  const lang: 'vi' | 'en' = isEnglish ? 'en' : 'vi';
  const preset = options.preset || VOICE_TONE_PRESETS[0];
  const processed = isEnglish ? cleanMathForVietnameseTTS(text, true) : preprocessSpeechText(text, false);

  if (!processed) return false;

  // 1. Kiểm tra audioCache nếu đã có sẵn thì phát tức thì 0ms
  const cacheKey = `${lang}:::${processed.trim()}`;
  if (audioCache.has(cacheKey)) {
    const cachedBuf = audioCache.get(cacheKey)!;
    playAudioBuffer(cachedBuf, options.onStart, options.onEnd);
    return true;
  }

  // 2. ƯU TIÊN 1: Phát tức thì (<50ms) bằng Web Speech API của trình duyệt nếu có giọng đọc tiếng Việt chuẩn
  if (typeof window !== 'undefined' && 'speechSynthesis' in window && options.preferGemini !== true) {
    try {
      const started = speakWithWebSpeech(processed, preset, lang, options.onStart, options.onEnd, options.onError);
      if (started) return true;
    } catch (_) {}
  }

  // 3. ƯU TIÊN 2: Máy chủ TTS stream (/api/tts) siêu tốc (<100ms, giọng tiếng Việt chuẩn, không độ trễ)
  speakWithGoogleCloudTTS(processed, preset, lang, options.onStart, options.onEnd, options.onError);
  return true;
}

/**
 * Generate highly expressive Gemini Audio stream/blob if Gemini API key is configured.
 * Hỗ trợ chuẩn xác:
 * - Nếu môn học là Tiếng Anh -> đọc chuẩn phát âm Tiếng Anh.
 * - Tất cả các môn khác (Toán học, Vật lí, Hóa học, Sinh học, Tin học...) -> đọc 100% bằng Tiếng Việt chuẩn mực.
 * - 5 sắc thái giọng AI cao cấp: Kore, Aoede, Puck, Charon, Fenrir.
 * - Có audioCache lưu đệm AudioBuffer theo text (0ms khi đọc lại).
 * - Bọc trong try-catch có timeout 4.5s (quá 4.5s hoặc lỗi là tự động đọc bằng Google Cloud/Translate TTS stream ngay).
 */
export async function speakWithGeminiAudio(
  text: string,
  preset: VoiceTonePreset = VOICE_TONE_PRESETS[0],
  onStart?: () => void,
  onEnd?: () => void,
  isEnglish: boolean = false,
  subject?: string,
  onError?: (err: any) => void
): Promise<boolean> {
  const apiKey = getEffectiveGeminiApiKey();
  const isEn = isEnglish || (typeof subject === 'string' && (
    subject.toLowerCase().includes('tiếng anh') || 
    subject.toLowerCase().includes('english') ||
    subject.toLowerCase().includes('anh văn') ||
    subject.toLowerCase().includes('ngoại ngữ')
  ));

  const processed = isEn ? cleanMathForVietnameseTTS(text, true) : preprocessSpeechText(text, false);
  if (!processed) return false;

  stopAllSpeech();
  isSpeechCancelled = false;
  unlockWebAudio();

  const ctx = getOrCreateAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const validVoices = ['Kore', 'Aoede', 'Puck', 'Charon', 'Fenrir'];
  let voiceName = preset.geminiVoice || 'Kore';
  if (!validVoices.includes(voiceName)) {
    voiceName = 'Kore';
  }

  // 1. Kiểm tra audioCache: nếu có sẵn thì phát tức thì 0ms qua AudioContext
  const cacheKey = `${voiceName}:::${processed.trim()}`;
  if (audioCache.has(cacheKey)) {
    const cachedBuf = audioCache.get(cacheKey)!;
    return playAudioBuffer(cachedBuf, onStart, onEnd);
  }

  // 2. Nếu có apiKey, gọi Gemini TTS để phát âm thanh AI truyền cảm tự nhiên chuẩn mực
  if (apiKey) {
    try {
      const bufferPromise = fetchGeminiAudioBuffer(processed, voiceName, apiKey);
      const timeoutPromise = new Promise<null>((res) => setTimeout(() => res(null), 4500));
      const buffer = await Promise.race([bufferPromise, timeoutPromise]);
      if (buffer && !isSpeechCancelled) {
        audioCache.set(cacheKey, buffer);
        return playAudioBuffer(buffer, onStart, onEnd);
      }
    } catch (err) {
      console.warn('Gemini Audio fetch failed, falling back to TTS stream:', err);
    }
  }

  if (isSpeechCancelled) return false;

  // 3. Fallback sang Google Cloud / Google Translate TTS stream tiếng Việt chuẩn 100%
  return speakWithGoogleCloudTTS(processed, preset, isEn ? 'en' : 'vi', onStart, onEnd, onError);
}

/**
 * Lọc sạch thẻ HTML và ký hiệu LaTeX sang văn bản thuần túy cho bộ máy đọc
 */
export function cleanHtmlAndLatex(raw: string, isEnglish: boolean = false): string {
  if (!raw) return '';
  // 1. Loại bỏ toàn bộ thẻ HTML (<p>, <span>, <div>, <br>, v.v.)
  let t = raw.replace(/<[^>]*>/g, ' ');
  // Giải mã các entity HTML thông dụng
  t = t
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, ' và ')
    .replace(/&lt;/gi, ' nhỏ hơn ')
    .replace(/&gt;/gi, ' lớn hơn ')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"');

  // 2. Chuyển đổi công thức toán, STEM và ký hiệu LaTeX sang lời đọc tiếng Việt chuẩn
  t = isEnglish ? cleanMathForVietnameseTTS(t, true) : preprocessSpeechText(t, false);

  // 3. Dọn dẹp khoảng trắng
  t = t.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t;
}

/**
 * Đọc toàn bộ nội dung câu hỏi trắc nghiệm kèm 4 đáp án A, B, C, D bằng giọng đọc AI tiếng Việt chuẩn mực:
 * - Chuẩn hóa toàn diện ký hiệu Toán, Lý, Hóa, Sinh, Tin học theo SGK GDPT 2018.
 * - Ưu tiên 1: AudioBuffer cache (0ms phát lại tức thì).
 * - Ưu tiên 2: Gemini TTS Audio với 5 giọng đọc AI cao cấp (Kore, Aoede, Puck, Charon, Fenrir).
 * - Ưu tiên 3: Google TTS Audio Stream đa endpoint (chạy 100% trên cả Web Vercel lẫn AI Studio Preview).
 * - Tuyệt đối không dùng Web Speech nếu máy khách không có voice vi-VN (tránh lỗi giọng đọc tiếng Anh lạ).
 */
export function speakQuestionContent(
  question: {
    id?: string;
    question: string;
    options: Array<{ key: string; text: string }>;
    explanation?: string;
    subject?: string;
  },
  options: SpeakOptions = {}
): boolean {
  if (!question) return false;

  unlockWebAudio();
  const ctx = getOrCreateAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const rawSubject = question.subject || options.subject || '';
  const isEnglish = !!options.isEnglish || 
    (typeof rawSubject === 'string' && (
      rawSubject.toLowerCase().includes('tiếng anh') || 
      rawSubject.toLowerCase().includes('english') ||
      rawSubject.toLowerCase().includes('anh văn') ||
      rawSubject.toLowerCase().includes('ngoại ngữ')
    ));

  let rawScript = '';
  const qText = question.question || (question as any).content || '';

  if (isEnglish) {
    const cleanQ = qText.trim().replace(/^Question\s*\d*\s*[:.]\s*/i, '').trim();
    rawScript = `Question: ${cleanQ}. `;
    if (Array.isArray(question.options) && question.options.length > 0) {
      question.options.forEach((opt, idx) => {
        const key = (typeof opt === 'object' && opt && opt.key ? opt.key : String.fromCharCode(65 + idx)).trim().toUpperCase();
        const text = (typeof opt === 'object' && opt && opt.text ? opt.text : (typeof opt === 'string' ? opt : '')).trim();
        if (text) {
          const cleanText = text
            .replace(/^[A-Da-d][.:)\-\/]\s*/, '')
            .replace(/^[:\-–—]\s*/, '')
            .trim();
          rawScript += `Option ${key}: ${cleanText}. `;
        }
      });
    }
  } else {
    const cleanQ = qText.trim().replace(/^câu\s*\d*\s*[:.]\s*/i, '').trim();
    rawScript = `Câu hỏi: ${cleanQ}. `;

    // Nhận diện ngữ cảnh đề bài: TỌA ĐỘ hay KHOẢNG ĐƠN ĐIỆU để hướng dẫn AI đọc chính xác
    const isCoordinateContext = /(tọa độ|toạ độ|giao điểm|tiếp điểm|tâm|đỉnh|hình chiếu|trung điểm|cực trị của đồ thị|cực đại của đồ thị|cực tiểu của đồ thị|điểm uốn|vectơ|véc-tơ|Oxy|Oxyz|mặt phẳng|không gian)/i.test(cleanQ);
    const isIntervalContext = /(đồng biến|nghịch biến|đơn điệu|liên tục|khoảng biến thiên|khoảng nghịch biến|khoảng đồng biến|trên khoảng)/i.test(cleanQ);

    if (Array.isArray(question.options) && question.options.length > 0) {
      question.options.forEach((opt, idx) => {
        const key = (typeof opt === 'object' && opt && opt.key ? opt.key : String.fromCharCode(65 + idx)).trim().toUpperCase();
        const text = (typeof opt === 'object' && opt && opt.text ? opt.text : (typeof opt === 'string' ? opt : '')).trim();
        if (text) {
          const keyPhonetic = key === 'A' ? 'A' : key === 'B' ? 'Bê' : key === 'C' ? 'Xê' : key === 'D' ? 'Dê' : key;
          let cleanText = text
            .replace(/^[A-Da-d][.:)\-\/]\s*/, '')
            .replace(/^[:\-–—/]\s*/, '')
            .replace(/^chia cho\s*/i, '')
            .trim();

          // Xử lý thông minh dạng ngoặc (a; b) hoặc (a; b; c) trong phương án trắc nghiệm:
          const tripletMatch = cleanText.match(/^\(?\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*[;,]\s*(-?\d+(?:[.,]\d+)?)\s*\)?$/i);
          const pairMatch = cleanText.match(/^\(?\s*(-?\d+(?:[.,]\d+)?|âm vô cùng|-\s*∞|\\-?\\infty)\s*[;,]\s*(-?\d+(?:[.,]\d+)?|dương vô cùng|\+\s*∞|\\\+?\\infty)\s*\)?$/i);

          if (tripletMatch) {
            cleanText = `tọa độ ${tripletMatch[1]}, ${tripletMatch[2]}, ${tripletMatch[3]}`;
          } else if (pairMatch) {
            const val1 = pairMatch[1].replace(/\\?-\s*(?:\\infty|∞)/g, 'âm vô cùng');
            const val2 = pairMatch[2].replace(/\\?\+?\s*(?:\\infty|∞)/g, 'dương vô cùng');
            const hasInf = /vô cùng/i.test(val1) || /vô cùng/i.test(val2);
            if (hasInf || isIntervalContext) {
              cleanText = `khoảng từ ${val1} đến ${val2}`;
            } else if (isCoordinateContext) {
              cleanText = `tọa độ ${val1}, ${val2}`;
            } else {
              cleanText = `${val1}, ${val2}`;
            }
          }

          rawScript += `Đáp án ${keyPhonetic}: ${cleanText}. `;
        }
      });
    }
  }

  // 1. Kiểm tra questionAudioCache theo question.id để phát ngay lập tức 0ms
  const qId = question.id;
  const preset = options.preset || VOICE_TONE_PRESETS[0];
  const voiceName = preset.geminiVoice || 'Kore';
  const qCacheKey = qId ? `${voiceName}:::${qId}` : null;

  if (qCacheKey && questionAudioCache.has(qCacheKey)) {
    const buf = questionAudioCache.get(qCacheKey)!;
    playAudioBuffer(buf, options.onStart, options.onEnd);
    return true;
  }

  // 2. Chuyển sang speakText để phát tiếng Việt truyền cảm, giàu ngữ điệu
  return speakText(rawScript, {
    ...options,
    subject: rawSubject,
    isEnglish,
    onStart: options.onStart,
    onEnd: options.onEnd,
    onError: options.onError,
  });
}

/**
 * Phát âm thanh nội dung câu hỏi tức thì (tương thích cả string và question object)
 */
export function speakQuestionImmediate(
  question: string | {
    id?: string;
    question?: string;
    content?: string;
    options?: Array<{ key?: string; text?: string } | string>;
    explanation?: string;
    subject?: string;
  },
  options: SpeakOptions = {}
): boolean {
  if (!question) return false;
  if (typeof question === 'string') {
    return speakText(question, options);
  }
  return speakQuestionContent(question as any, options);
}

/**
 * Gọi tên học sinh hoặc nhóm học sinh bằng giọng đọc AI đầy cảm hứng, chuẩn sư phạm
 */
export function speakStudentCalling(
  studentName: string,
  mode: 'call' | 'congratulate' | 'group' = 'call',
  otherNames: string[] = [],
  options: SpeakOptions = {}
): boolean {
  if (!studentName && otherNames.length === 0) return false;

  let text = '';
  if (mode === 'group' && otherNames.length > 0) {
    const allNames = [studentName, ...otherNames].filter(Boolean);
    text = `Xin mời nhóm các em: ${allNames.join(', ')} cùng lên bảng tham gia hoạt động!`;
  } else if (mode === 'congratulate') {
    text = `Nhiệt liệt chúc mừng em ${studentName} đã xuất sắc hoàn thành thử thách!`;
  } else {
    // Phổ biến ngẫu nhiên lời gọi tên tự nhiên, xướng tên học sinh tức thì
    const phrases = [
      `Xin mời em ${studentName} lên bảng phát biểu!`,
      `Mời bạn ${studentName} đứng lên trả lời câu hỏi nào!`,
      `Chúc mừng em ${studentName} đã được chọn! Mời em trả lời!`,
      `Xin mời bạn ${studentName} thực hiện phần thử thách nhé!`,
      `Xin mời em ${studentName}!`,
    ];
    const picked = phrases[Math.floor(Math.random() * phrases.length)];
    text = picked;
  }

  return speakText(text, options);
}

/**
 * AI MC / Giọng dẫn chương trình cho trò chơi học tập
 */
export function speakGameVoiceEvent(
  eventType: 'game_start' | 'correct' | 'wrong' | 'timeout' | 'winner' | 'question',
  customText?: string,
  options: SpeakOptions = {}
): boolean {
  let text = '';

  switch (eventType) {
    case 'game_start':
      text = customText || 'Trò chơi bắt đầu! Chúc các em tập trung cao độ và giành chiến thắng rực rỡ!';
      break;
    case 'correct': {
      const praises = [
        'Chính xác! Xuất sắc lắm!',
        'Tuyệt vời! Câu trả lời hoàn toàn chính xác!',
        'Đúng rồi! Bạn nhận được điểm thưởng!',
        'Xuất sắc! Bạn trả lời rất nhanh và chính xác!',
      ];
      text = customText || praises[Math.floor(Math.random() * praises.length)];
      break;
    }
    case 'wrong': {
      const encourages = [
        'Rất tiếc, câu trả lời chưa chính xác rồi!',
        'Chưa chính xác! Hãy cố gắng hơn ở câu hỏi tiếp theo nhé!',
        'Tiếc quá, chưa đúng rồi! Đừng nản lòng nhé!',
      ];
      text = customText || encourages[Math.floor(Math.random() * encourages.length)];
      break;
    }
    case 'timeout':
      text = customText || 'Đã hết thời gian suy nghĩ! Hãy cùng xem đáp án chính xác nhé!';
      break;
    case 'winner':
      text = customText || 'Nhiệt liệt chúc mừng quán quân đã giành chiến thắng chung cuộc xuất sắc ngày hôm nay!';
      break;
    case 'question':
      text = customText || '';
      break;
  }

  if (!text) return false;
  return speakText(text, options);
}
