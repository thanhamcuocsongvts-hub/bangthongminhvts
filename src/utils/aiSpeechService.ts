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
  // 1. Kiểm tra localStorage: chỉ lấy nếu key hợp lệ (bắt đầu bằng "AIza" và độ dài > 30 ký tự)
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const storageKeys = [
        'gemini_api_key',
        'smartboard_gemini_api_key',
        'user_gemini_api_key',
        'custom_gemini_api_key',
        'ai_api_key',
        'VITE_GEMINI_API_KEY',
        'GEMINI_API_KEY',
      ];
      for (const k of storageKeys) {
        const val = localStorage.getItem(k);
        if (val && isValidGeminiApiKey(val)) {
          return val.trim();
        }
      }
    } catch (_) {}
  }

  // 2. process.env.GEMINI_API_KEY (cho môi trường AI Studio Preview)
  try {
    if (typeof process !== 'undefined' && process.env) {
      const pKey = process.env.GEMINI_API_KEY || (process.env as any).VITE_GEMINI_API_KEY;
      if (pKey && typeof pKey === 'string' && pKey.trim().length > 5) {
        return pKey.trim();
      }
    }
  } catch (_) {}

  // 3. import.meta.env.VITE_GEMINI_API_KEY (cho Vercel / Vite client)
  try {
    const viteKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (viteKey && typeof viteKey === 'string' && viteKey.trim().length > 5) {
      return viteKey.trim();
    }
  } catch (_) {}

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
let currentAudioElement: HTMLAudioElement | null = null;
let activeAudioSource: AudioBufferSourceNode | null = null;
let isAudioUnlocked = false;

/**
 * Bộ đệm âm thanh AudioBuffer theo nội dung text để phát tức thì (0ms) khi đọc lại
 */
export const audioCache = new Map<string, AudioBuffer>();

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
        model: 'gemini-2.5-flash-preview-tts',
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
      // Dự phòng sang gemini-2.5-flash nếu preview bận
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
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

  if (!voices || voices.length === 0) return null;

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

  let s = text;

  // 1. Dịch các ký hiệu hàm số và đạo hàm chuẩn SGK GDPT 2018:
  // y = f(x) -> "y bằng ép ích"
  s = s.replace(/y\s*=\s*f\s*\(\s*x\s*\)/gi, ' y bằng ép ích ');
  // f'(x) -> "ép phẩy ích"
  s = s.replace(/f\s*'\s*\(\s*x\s*\)/gi, ' ép phẩy ích ');
  // f(x) -> "ép ích"
  s = s.replace(/f\s*\(\s*x\s*\)/gi, ' ép ích ');
  // y' -> "y phẩy"
  s = s.replace(/\by\s*'/gi, ' y phẩy ');
  // g'(x) -> "gờ phẩy ích", g(x) -> "gờ ích"
  s = s.replace(/g\s*'\s*\(\s*x\s*\)/gi, ' gờ phẩy ích ');
  s = s.replace(/g\s*\(\s*x\s*\)/gi, ' gờ ích ');

  // 2. Ký hiệu tập hợp số thực \mathbb{R} hoặc ℝ -> "tập hợp e-rờ"
  s = s.replace(/\\mathbb\{R\}|ℝ|\bIR\b/g, ' tập hợp e-rờ ');

  // 3. Ký hiệu vô cùng:
  // Ký hiệu +\infty -> đọc là "dương vô cùng"; -\infty -> đọc là "âm vô cùng"
  s = s.replace(/(?:-\s*\\infty|-\s*∞|-oo)\b/gi, ' âm vô cùng ');
  s = s.replace(/(?:\+\s*\\infty|\+\s*∞|\+oo)\b/gi, ' dương vô cùng ');
  s = s.replace(/(?:\\infty|∞|oo)\b/gi, ' vô cùng ');

  // 4. Khoảng, đoạn, nửa khoảng toán học chuẩn thuật ngữ GDPT 2018
  // (đặt lên TRƯỚC các quy tắc thay thế dấu ngoặc và dấu chấm phẩy đơn lẻ):
  // Nửa khoảng [a; b) -> đọc là "nửa khoảng a, b"
  s = s.replace(/\[\s*([^;()[\]]+?)\s*;\s*([^;()[\]]+?)\s*\)/g, ' nửa khoảng $1, $2 ');
  // Nửa khoảng (a; b] -> đọc là "nửa khoảng a, b"
  s = s.replace(/\(\s*([^;()[\]]+?)\s*;\s*([^;()[\]]+?)\s*\]/g, ' nửa khoảng $1, $2 ');
  // Đoạn [a; b] -> đọc là "đoạn a, b"
  s = s.replace(/\[\s*([^;()[\]]+?)\s*;\s*([^;()[\]]+?)\s*\]/g, ' đoạn $1, $2 ');
  // Khoảng (a; b) -> đọc là "khoảng a, b"
  s = s.replace(/\(\s*([^;()[\]]+?)\s*;\s*([^;()[\]]+?)\s*\)/g, ' khoảng $1, $2 ');

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

  // 1c. Đọc khoảng và đoạn toán học: (-1; 0) -> khoảng từ trừ một đến không, (-∞; 1) -> khoảng từ âm vô cùng đến một
  s = s.replace(/[\(\[]\s*(?:âm vô cùng|-\s*vô cùng)\s*;\s*(?:dương vô cùng|\+\s*vô cùng)\s*[\)\]]/gi, 'khoảng từ âm vô cùng đến dương vô cùng');
  s = s.replace(/\(\s*(?:âm vô cùng|-\s*vô cùng)\s*;\s*(-?\d+(?:[.,]\d+)?)\s*\)/gi, (_, b) => `khoảng từ âm vô cùng đến ${numberToVietnameseWords(b)}`);
  s = s.replace(/\[\s*(?:âm vô cùng|-\s*vô cùng)\s*;\s*(-?\d+(?:[.,]\d+)?)\s*\)/gi, (_, b) => `khoảng từ âm vô cùng đến ${numberToVietnameseWords(b)}`);
  s = s.replace(/\(\s*(-?\d+(?:[.,]\d+)?)\s*;\s*(?:dương vô cùng|\+\s*vô cùng)\s*\)/gi, (_, a) => `khoảng từ ${numberToVietnameseWords(a)} đến dương vô cùng`);
  s = s.replace(/\[\s*(-?\d+(?:[.,]\d+)?)\s*;\s*(?:dương vô cùng|\+\s*vô cùng)\s*\)/gi, (_, a) => `nửa khoảng từ ${numberToVietnameseWords(a)} đến dương vô cùng`);
  s = s.replace(/\(\s*(?:âm vô cùng|-\s*vô cùng)\s*;\s*(-?\d+(?:[.,]\d+)?)\s*\]/gi, (_, b) => `nửa khoảng từ âm vô cùng đến ${numberToVietnameseWords(b)}`);
  s = s.replace(/\((-?\d+(?:[.,]\d+)?)\s*;\s*(-?\d+(?:[.,]\d+)?)\)/g, (_, a, b) => `khoảng từ ${numberToVietnameseWords(a)} đến ${numberToVietnameseWords(b)}`);
  s = s.replace(/\[(-?\d+(?:[.,]\d+)?)\s*;\s*(-?\d+(?:[.,]\d+)?)\]/g, (_, a, b) => `đoạn từ ${numberToVietnameseWords(a)} đến ${numberToVietnameseWords(b)}`);
  s = s.replace(/\((-?\d+)\s*;\s*([+\-]?\s*vô cùng|dương vô cùng|âm vô cùng)\)/gi, (_, a, b) => `khoảng từ ${numberToVietnameseWords(a)} đến ${b}`);
  s = s.replace(/\(([+\-]?\s*vô cùng|âm vô cùng)\s*;\s*(-?\d+)\)/gi, (_, a, b) => `khoảng từ ${a} đến ${numberToVietnameseWords(b)}`);
  s = s.replace(/(khoảng|đoạn)\s+(khoảng|đoạn)\s+từ/gi, '$1 từ');

  // Xóa triệt để từ "chia cho" vô tình gắn sau Phương án A/B/C/D
  s = s.replace(/(Phương án|Đáp án|Lựa chọn)\s*([A-Da-d])\s*(?:chia cho|chia|\/|:)\s*/gi, '$1 $2, ');
  s = s.replace(/(^|[\n.,;])\s*([A-Da-d])\s*(?:chia cho|chia|\/|:)\s*/gi, '$1 Phương án $2, ');

  // 1d. Tọa độ điểm hình học: A(1; 2), M(x0; y0), O(0; 0)
  s = s.replace(/([A-Z])\s*\(\s*0\s*;\s*0\s*\)/g, 'điểm $1 gốc tọa độ không không');
  s = s.replace(/([A-Z])\s*\(\s*(-?\d+)\s*;\s*(-?\d+)\s*\)/g, (_, pt, xCoord, yCoord) => `điểm ${pt} tọa độ ${numberToVietnameseWords(xCoord)}, ${numberToVietnameseWords(yCoord)}`);
  s = s.replace(/([A-Z])\s*\(\s*(-?\d+)\s*;\s*(-?\d+)\s*;\s*(-?\d+)\s*\)/g, (_, pt, xCoord, yCoord, zCoord) => `điểm ${pt} tọa độ ${numberToVietnameseWords(xCoord)}, ${numberToVietnameseWords(yCoord)}, ${numberToVietnameseWords(zCoord)}`);

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
  t = t.replace(/\\mathbb\{R\}/g, ' tập số thực R ');
  t = t.replace(/\\mathbb\{N\}/g, ' tập số tự nhiên N ');
  t = t.replace(/\\mathbb\{Z\}/g, ' tập số nguyên Z ');
  t = t.replace(/\\mathbb\{Q\}/g, ' tập số hữu tỉ Q ');
  t = t.replace(/\\mathbb\{C\}/g, ' tập số phức C ');
  t = t.replace(/\\left\s*([(\[{|])/g, '$1');
  t = t.replace(/\\right\s*([)\]}|])/g, '$1');

  // 2b. Derivatives & Functions in Vietnamese
  t = t.replace(/f''\(([a-zA-Z])\)/g, ' đạo hàm cấp hai f hai phẩy của $1 ');
  t = t.replace(/f'\(([a-zA-Z])\)/g, ' đạo hàm f phẩy của $1 ');
  t = t.replace(/\by''\b/g, ' y hai phẩy ');
  t = t.replace(/\by'\b/g, ' y phẩy ');
  t = t.replace(/\bf\(([a-zA-Z])\)/g, ' f của $1 ');
  t = t.replace(/\bg\(([a-zA-Z])\)/g, ' g của $1 ');
  t = t.replace(/\bh\(([a-zA-Z])\)/g, ' h của $1 ');

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
      window.speechSynthesis.cancel();
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
}

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
  playbackRate: number = 1.0,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): Promise<boolean> {
  if (!processedText || !processedText.trim()) return false;

  stopAllSpeech();
  isSpeechCancelled = false;
  unlockWebAudio();

  // Chia nhỏ theo câu ngắn (tối đa ~100 ký tự) để stream Google Translate ổn định và không bị ngắt
  const chunks = splitIntoSentences(processedText.trim(), 100);
  if (chunks.length === 0) return false;

  let started = false;
  let allChunksSuccess = true;

  for (let i = 0; i < chunks.length; i++) {
    if (isSpeechCancelled) {
      allChunksSuccess = false;
      break;
    }

    const chunk = chunks[i];
    const streamUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(chunk)}`;

    const played = await new Promise<boolean>((resolve) => {
      try {
        const audio = new Audio();
        // TUYỆT ĐỐI KHÔNG gán crossOrigin để tránh bị chặn CORS trên trình duyệt web
        currentAudioElement = audio;
        audio.playbackRate = playbackRate;

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
          p.catch(() => resolve(false));
        }
      } catch (_) {
        resolve(false);
      }
    });

    if (!played && !isSpeechCancelled) {
      allChunksSuccess = false;
      break;
    }
  }

  if (allChunksSuccess) {
    if (onEnd && !isSpeechCancelled) onEnd();
    return true;
  }

  if (onError) onError(new Error('Google Translate TTS stream encountered an issue.'));
  return false;
}

/**
 * Phát giọng đọc Google Cloud Text-To-Speech / Audio Stream
 * - Hỗ trợ 100% Tiếng Việt chuẩn ngữ âm sư phạm cho tất cả các môn (Toán, Lý, Hóa, Sinh, Văn, Sử, Địa, v.v.)
 * - Tự động nhận diện và phát âm tiếng Anh chuẩn bản ngữ cho riêng bộ môn Tiếng Anh / Anh Văn
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

  // Tinh chỉnh tốc độ theo sắc thái MC và sư phạm
  let playbackRate = preset.rate || 1.0;
  if (preset.id === 'mc_chuyen_nghiep' || preset.id === 'mc_ai_la_trieu_phu') {
    playbackRate = 1.15;
  } else if (preset.id === 'mc_olympia' || preset.id === 'mc_the_thao') {
    playbackRate = 1.18;
  } else if (preset.id === 'mc_nu_nang_dong') {
    playbackRate = 1.14;
  } else if (preset.id === 'mc_truyen_hinh') {
    playbackRate = 1.08;
  } else if (preset.id === 'hoc_sinh') {
    playbackRate = 1.08;
  } else if (preset.id === 'podcast') {
    playbackRate = 0.92;
  } else if (preset.id === 'nam_tram_am') {
    playbackRate = 0.98;
  }

  // Phương án 1: Thử gọi qua endpoint server /api/tts nếu đang chạy full-stack
  const encoded = encodeURIComponent(processedText.trim());
  let serverPlayed = false;
  try {
    const audio = new Audio();
    currentAudioElement = audio;
    audio.playbackRate = playbackRate;

    audio.onplay = () => {
      if (!isSpeechCancelled && onStart) onStart();
    };

    serverPlayed = await new Promise<boolean>((resolve) => {
      audio.onended = () => {
        if (!isSpeechCancelled && onEnd) onEnd();
        currentAudioElement = null;
        resolve(true);
      };
      audio.onerror = () => {
        currentAudioElement = null;
        resolve(false);
      };

      audio.src = `/api/tts?lang=${lang}&text=${encoded}`;
      const p = audio.play();
      if (p !== undefined) {
        p.catch(() => resolve(false));
      }
    });
  } catch (_) {
    serverPlayed = false;
  }

  if (serverPlayed) {
    return true;
  }

  // Phương án 2: Khi chạy trên web Vercel không có backend Node, dùng Google Translate TTS Stream trực tiếp
  const streamOk = await speakWithGoogleTranslateStream(
    processedText,
    lang,
    playbackRate,
    onStart,
    onEnd,
    onError
  );

  if (streamOk) {
    return true;
  }

  // Phương án 3: Web Speech API dự phòng nếu có voice phù hợp
  if (!isSpeechCancelled) {
    return speakWithWebSpeech(processedText, preset, lang, onStart, onEnd, onError);
  }
  return false;
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
    window.speechSynthesis.cancel();
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

    // BẮT BUỘC: Nếu không phải tiếng Anh mà máy khách KHÔNG có voice vi-VN trong hệ điều hành,
    // TUYỆT ĐỐI không gọi window.speechSynthesis vì trình duyệt sẽ dùng giọng tiếng Anh đọc tiếng Việt!
    // Lập tức fallback sang Google Translate TTS Stream tiếng Việt chuẩn 100%!
    if (!isEn && !matchedVoice) {
      console.info('Client browser lacks vi-VN voice. Fallback to Google Translate TTS audio stream.');
      speakWithGoogleTranslateStream(processedText, 'vi', preset.rate || 1.0, onStart, onEnd, onError);
      return true;
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
      utterance.pitch = preset.pitch;
      utterance.rate = preset.rate;
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

    speakNext();
    return true;
  } catch (err) {
    console.error('Error starting Web Speech synthesis, falling back to Google TTS stream:', err);
    speakWithGoogleTranslateStream(processedText, lang, preset.rate || 1.0, onStart, onEnd, onError);
    return true;
  }
}

/**
 * Ultra-fast Text-to-Speech execution (<150ms).
 * ƯU TIÊN 1: Gemini TTS nếu có Key (từ localStorage -> VITE_GEMINI_API_KEY -> process.env.GEMINI_API_KEY).
 * ƯU TIÊN 2: Google Cloud / Google Translate TTS Stream trực tiếp 100% tiếng Việt chuẩn.
 * Hỗ trợ tiếng Anh riêng cho bộ môn Tiếng Anh / Anh Văn.
 */
export function speakText(text: string, options: SpeakOptions = {}): boolean {
  if (!text || !text.trim()) return false;

  stopAllSpeech();

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

  // Kiểm tra nếu có Gemini API Key từ localStorage -> VITE_GEMINI_API_KEY -> process.env.GEMINI_API_KEY
  const effectiveKey = getEffectiveGeminiApiKey();
  if (effectiveKey && options.preferWebSpeech !== true) {
    speakWithGeminiAudio(processed, preset, options.onStart, options.onEnd, isEnglish, options.subject);
    return true;
  }

  // Khởi động phát giọng đọc Google Cloud TTS / Stream trực tiếp
  speakWithGoogleCloudTTS(processed, preset, lang, options.onStart, options.onEnd, options.onError);
  return true;
}

/**
 * Generate highly expressive Gemini Audio stream/blob if Gemini API key is configured.
 * Hỗ trợ chuẩn xác:
 * - Nếu môn học là Tiếng Anh -> đọc chuẩn phát âm Tiếng Anh.
 * - Tất cả các môn khác (Toán học, Vật lí, Hóa học...) -> bắt buộc đọc 100% bằng Tiếng Việt miền Nam/Bắc chuẩn xác.
 */
/**
 * Generate highly expressive Gemini Audio stream/blob if Gemini API key is configured.
 * Hỗ trợ chuẩn xác:
 * - Nếu môn học là Tiếng Anh -> đọc chuẩn phát âm Tiếng Anh.
 * - Tất cả các môn khác (Toán học, Vật lí, Hóa học...) -> bắt buộc đọc 100% bằng Tiếng Việt miền Nam/Bắc chuẩn xác.
 * - Model: gemini-2.5-flash-preview-tts (không truyền systemInstruction vào config để tránh lỗi 400).
 * - Tối ưu độ trễ với audioCache (0ms khi đọc lại) và AudioContext warm-up.
 * - Bắt lỗi êm ái, chuyển mượt sang giọng đọc Neural Tiếng Việt dự phòng, TUYỆT ĐỐI KHÔNG throw error.
 */
export async function speakWithGeminiAudio(
  text: string,
  preset: VoiceTonePreset = VOICE_TONE_PRESETS[0],
  onStart?: () => void,
  onEnd?: () => void,
  isEnglish: boolean = false,
  subject?: string
): Promise<boolean> {
  const apiKey = getEffectiveGeminiApiKey();
  if (!apiKey) {
    return speakText(text, { preset, onStart, onEnd, isEnglish, subject, preferWebSpeech: true });
  }

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

  // Khởi tạo sẵn (warm-up) AudioContext ở cấp module và gọi audioCtx.resume() ngay khi người dùng bấm
  const ctx = getOrCreateAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const validVoices = ['Kore', 'Aoede', 'Puck', 'Charon', 'Fenrir'];
  let voiceName = preset.geminiVoice || 'Kore';
  if (!validVoices.includes(voiceName)) {
    voiceName = 'Kore';
  }

  // Kiểm tra audioCache: nếu có sẵn thì phát tức thì 0ms
  const cacheKey = `${voiceName}:::${processed.trim()}`;
  if (audioCache.has(cacheKey)) {
    const cachedBuf = audioCache.get(cacheKey)!;
    return playAudioBuffer(cachedBuf, onStart, onEnd);
  }

  try {
    const buffer = await fetchGeminiAudioBuffer(processed, voiceName, apiKey);
    if (isSpeechCancelled) return false;
    if (buffer) {
      return playAudioBuffer(buffer, onStart, onEnd);
    }
    return speakWithGoogleCloudTTS(processed, preset, isEn ? 'en' : 'vi', onStart, onEnd);
  } catch (err) {
    console.warn('Gemini Audio caught error, smoothly transitioning to fallback:', err);
    return speakWithGoogleCloudTTS(processed, preset, isEn ? 'en' : 'vi', onStart, onEnd);
  }
}

/**
 * Đọc toàn bộ nội dung câu hỏi trắc nghiệm kèm 4 đáp án A, B, C, D bằng giọng đọc AI tiếng Việt chuẩn mực:
 * - Tối ưu tốc độ phản hồi (giảm độ trễ từ 5s xuống dưới 1s) trong hàm gọi Gemini TTS:
 *   + audioCache lưu đệm âm thanh theo nội dung: đọc lại câu đã có phát ngay tức thì (0ms).
 *   + Khởi tạo sẵn (warm-up) AudioContext ở cấp module và gọi audioCtx.resume() ngay khi người dùng bấm nút.
 *   + Tách văn bản thành 2 phần: Phần 1 (Câu dẫn đề bài) và Phần 2 (Các phương án A, B, C, D).
 *     Gọi API tạo âm thanh cho Phần 1 trước để phát ngay lập tức sau ~1 giây (<1s).
 *     Trong lúc đang phát Phần 1 thì tải ngầm (prefetch) Phần 2 và nối tiếp vào hàng đợi phát mượt mà.
 * - Chống rung/lag: Không gọi hàm TTS lặp lại nhiều lần liên tiếp gây chồng luồng âm thanh.
 */
export function speakQuestionContent(
  question: {
    question: string;
    options: Array<{ key: string; text: string }>;
    explanation?: string;
    subject?: string;
  },
  options: SpeakOptions = {}
): boolean {
  if (!question || !question.question) return false;

  // Dừng mọi luồng âm thanh đang phát để đảm bảo không bao giờ chồng luồng gây rung/lag
  stopAllSpeech();
  isSpeechCancelled = false;

  // Khởi tạo sẵn và gọi audioCtx.resume() ngay khi người dùng bấm nút để loại bỏ hoàn toàn độ trễ
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

  let part1Text = '';
  let part2Text = '';

  if (isEnglish) {
    const cleanQuestion = (question.question || '').trim().replace(/^Question\s*\d*\s*[:.]\s*/i, '').trim();
    part1Text = `Question: ${cleanQuestion}.`;
    if (Array.isArray(question.options) && question.options.length > 0) {
      const optParts: string[] = [];
      question.options.forEach((opt) => {
        const key = (opt.key || '').trim().toUpperCase();
        const text = opt.text || '';
        if (text.trim()) {
          const cleanText = text.trim()
            .replace(/^[A-Da-d][.:)\-\/]\s*/, '')
            .replace(/^[:\-–—]\s*/, '')
            .trim();
          optParts.push(`Option ${key}: ${cleanText}.`);
        }
      });
      part2Text = optParts.join(' ');
    }
  } else {
    const cleanQuestion = (question.question || '').trim().replace(/^câu\s*\d*\s*[:.]\s*/i, '').trim();
    part1Text = `Câu hỏi: ${cleanQuestion}.`;
    if (Array.isArray(question.options) && question.options.length > 0) {
      const optParts: string[] = [];
      question.options.forEach((opt) => {
        const key = (opt.key || '').trim().toUpperCase();
        const text = opt.text || '';
        if (text.trim()) {
          const keyPhonetic = key === 'A' ? 'A' : key === 'B' ? 'Bê' : key === 'C' ? 'Xê' : key === 'D' ? 'Dê' : key;
          const cleanText = text.trim()
            .replace(/^[A-Da-d][.:)\-\/]\s*/, '')
            .replace(/^[:\-–—/]\s*/, '')
            .replace(/^chia cho\s*/i, '')
            .trim();
          optParts.push(`Đáp án ${keyPhonetic}: ${cleanText}.`);
        }
      });
      part2Text = optParts.join(' ');
    }
  }

  const effectiveKey = getEffectiveGeminiApiKey();
  const preset = options.preset || VOICE_TONE_PRESETS[0];

  // Tối ưu hóa siêu tốc phản hồi (<1s) với Gemini TTS:
  // Tách Phần 1 (Câu dẫn đề bài) phát trước trong ~1s, đồng thời tải ngầm (prefetch) Phần 2 (Các đáp án)
  if (effectiveKey && options.preferWebSpeech !== true) {
    const validVoices = ['Kore', 'Aoede', 'Puck', 'Charon', 'Fenrir'];
    let voiceName = preset.geminiVoice || 'Kore';
    if (!validVoices.includes(voiceName)) {
      voiceName = 'Kore';
    }

    const p1Processed = isEnglish ? cleanMathForVietnameseTTS(part1Text, true) : preprocessSpeechText(part1Text, false);
    const p2Processed = part2Text ? (isEnglish ? cleanMathForVietnameseTTS(part2Text, true) : preprocessSpeechText(part2Text, false)) : '';

    // Khởi động tải ngầm (prefetch) Phần 2 ngay lập tức
    const part2Promise = p2Processed
      ? fetchGeminiAudioBuffer(p2Processed, voiceName, effectiveKey)
      : Promise.resolve(null);

    // Kiểm tra cache Phần 1: Nếu câu hỏi đã có trong cache thì phát ngay tức thì (0ms)
    const p1CacheKey = `${voiceName}:::${p1Processed.trim()}`;
    const p1Cached = audioCache.get(p1CacheKey);

    const playFullSequence = async (p1Buffer: AudioBuffer | null) => {
      if (isSpeechCancelled) return;
      if (!p1Buffer) {
        // Dự phòng mượt sang Google Cloud TTS nếu Phần 1 không tạo được âm thanh
        const fullScript = `${part1Text} ${part2Text}`.trim();
        speakWithGoogleCloudTTS(fullScript, preset, isEnglish ? 'en' : 'vi', options.onStart, options.onEnd);
        return;
      }

      // Phát Phần 1 ngay lập tức sau <1s (hoặc 0ms nếu có trong cache)
      await playAudioBuffer(p1Buffer, options.onStart, async () => {
        if (isSpeechCancelled) return;
        if (!p2Processed) {
          if (options.onEnd) options.onEnd();
          return;
        }

        // Khi Phần 1 đang phát, Phần 2 đã được tải ngầm (prefetch) xong -> phát nối tiếp mượt mà ngay
        try {
          const p2Buffer = await part2Promise;
          if (isSpeechCancelled) return;
          if (p2Buffer) {
            await playAudioBuffer(p2Buffer, undefined, options.onEnd);
          } else {
            speakWithGoogleCloudTTS(p2Processed, preset, isEnglish ? 'en' : 'vi', undefined, options.onEnd);
          }
        } catch (_) {
          if (options.onEnd) options.onEnd();
        }
      });
    };

    if (p1Cached) {
      // Phát tức thì 0ms!
      playFullSequence(p1Cached);
      return true;
    }

    // Tải Phần 1 với độ trễ thấp (<1s vì câu dẫn ngắn) và phát ngay
    fetchGeminiAudioBuffer(p1Processed, voiceName, effectiveKey)
      .then((p1Buffer) => {
        playFullSequence(p1Buffer);
      })
      .catch((err) => {
        console.warn('Gemini stream p1 catch, falling back to Google Cloud TTS:', err);
        const fullScript = `${part1Text} ${part2Text}`.trim();
        speakWithGoogleCloudTTS(fullScript, preset, isEnglish ? 'en' : 'vi', options.onStart, options.onEnd);
      });

    return true;
  }

  // Fallback: Gộp toàn bộ nội dung thành MỘT chuỗi hoàn chỉnh duy nhất để đọc 1 lần duy nhất
  const fullScript = `${part1Text} ${part2Text}`.trim();
  return speakText(fullScript, {
    ...options,
    isEnglish,
    subject: rawSubject,
  });
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
    // Phổ biến ngẫu nhiên lời gọi tên tự nhiên
    const phrases = [
      `Xin mời em ${studentName} lên bảng trả lời câu hỏi!`,
      `Thầy cô xin mời bạn ${studentName} đứng lên phát biểu bài nào!`,
      `Chúc mừng em ${studentName} đã được chọn! Mời em chuẩn bị trả lời!`,
      `Xin mời bạn ${studentName} tiếp tục phần thử thách của lớp nhé!`,
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
