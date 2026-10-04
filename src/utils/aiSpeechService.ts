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
}

export const VOICE_TONE_PRESETS: VoiceTonePreset[] = [
  {
    id: 'nu_truyen_cam',
    name: 'Cô giáo dịu dàng',
    label: '👩‍🏫 Cô giáo dịu dàng',
    sub: 'Pitch: 1.05 • Rate: 1.0 • Vol: 1.0',
    description: 'Giọng truyền cảm, ấm áp, nhịp điệu sư phạm chuẩn mực',
    icon: '👩‍🏫',
    pitch: 1.05,
    rate: 1.0,
    volume: 1.0,
    gender: 'female',
  },
  {
    id: 'nam_tram_am',
    name: 'Thầy giáo trầm ấm',
    label: '👨‍🏫 Thầy giáo trầm ấm',
    sub: 'Pitch: 0.88 • Rate: 0.98 • Vol: 1.0',
    description: 'Giọng sư phạm đĩnh đạc, rõ từng từ, vang và chắc khỏe',
    icon: '👨‍🏫',
    pitch: 0.88,
    rate: 0.98,
    volume: 1.0,
    gender: 'male',
  },
  {
    id: 'mc_soi_dong',
    name: 'MC Sôi động / Năng động',
    label: '⚡ MC Sôi động / Năng động',
    sub: 'Pitch: 1.15 • Rate: 1.10 • Vol: 1.0',
    description: 'Giọng hoạt náo, vang rực rỡ, kích thích tinh thần lớp học',
    icon: '⚡',
    pitch: 1.15,
    rate: 1.10,
    volume: 1.0,
    gender: 'female',
  },
  {
    id: 'chuan_phat_thanh_vien',
    name: 'Phát thanh viên chuẩn',
    label: '🎙️ Phát thanh viên chuẩn',
    sub: 'Pitch: 1.00 • Rate: 1.00 • Vol: 1.0',
    description: 'Giọng thời sự to rõ, dứt khoát, chuẩn âm tiếng Việt phổ thông',
    icon: '🎙️',
    pitch: 1.0,
    rate: 1.0,
    volume: 1.0,
    gender: 'neutral',
  },
];

// Pre-cached voices for instantaneous (<150ms) access
let cachedVoices: SpeechSynthesisVoice[] = [];
let currentAudioElement: HTMLAudioElement | null = null;

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
 */
export function getBestVietnameseVoice(gender: 'female' | 'male' | 'neutral' = 'neutral'): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;

  let voices = cachedVoices;
  if (!voices || voices.length === 0) {
    voices = window.speechSynthesis.getVoices();
    cachedVoices = voices;
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
    return voices.find((v) => v.default) || voices[0] || null;
  }

  const naturalKeywords = ['natural', 'online', 'neural', 'neural2', 'wavenet'];

  if (gender === 'female') {
    // 1. Natural female (HoaiMy Natural, Microsoft HoaiMy, etc.)
    const naturalFemale = viVoices.find((v) => {
      const n = v.name.toLowerCase();
      return (
        (n.includes('hoaimy') || n.includes('hoài my') || n.includes('female') || n.includes('nữ') || n.includes('linh') || n.includes('mai')) &&
        naturalKeywords.some((k) => n.includes(k))
      );
    });
    if (naturalFemale) return naturalFemale;

    // 2. Named female
    const namedFemale = viVoices.find((v) => {
      const n = v.name.toLowerCase();
      return n.includes('hoaimy') || n.includes('hoài my') || n.includes('linh') || n.includes('mai') || n.includes('female') || n.includes('nữ');
    });
    if (namedFemale) return namedFemale;

    // 3. Google Tiếng Việt
    const googleVi = viVoices.find((v) => v.name.toLowerCase().includes('google'));
    if (googleVi) return googleVi;

    return viVoices[0];
  }

  if (gender === 'male') {
    // 1. Natural male (NamMinh Natural, Microsoft NamMinh, etc.)
    const naturalMale = viVoices.find((v) => {
      const n = v.name.toLowerCase();
      return (
        (n.includes('namminh') || n.includes('nam minh') || n.includes('male') || n.includes('nam') || n.includes('khoi') || n.includes('khôi')) &&
        naturalKeywords.some((k) => n.includes(k))
      );
    });
    if (naturalMale) return naturalMale;

    // 2. Named male
    const namedMale = viVoices.find((v) => {
      const n = v.name.toLowerCase();
      return n.includes('namminh') || n.includes('nam minh') || n.includes('khoi') || n.includes('khôi') || n.includes('male') || n.includes('nam');
    });
    if (namedMale) return namedMale;

    return viVoices[0];
  }

  // Neutral / General
  const naturalAny = viVoices.find((v) => naturalKeywords.some((k) => v.name.toLowerCase().includes(k)));
  if (naturalAny) return naturalAny;

  return viVoices[0];
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
 * Đọc số nguyên tiếng Việt chuẩn xác (1..999)
 */
function numberToVietnameseWords(numStr: string): string {
  const n = parseInt(numStr, 10);
  if (isNaN(n)) return numStr;
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
  return numStr;
}

/**
 * Tiền xử lý chữ số & công thức toán học thuần tiếng Việt 100%
 * Biến các chữ số thành từ ngữ tiếng Việt để trình duyệt KHÔNG THỂ đọc tiếng Anh
 */
export function convertDigitsAndMathToVietnamese(raw: string): string {
  if (!raw) return '';
  let s = raw.trim();

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

  // 2. Chuyển đổi các tiền tố sư phạm phổ biến
  // "Câu 1" -> "Câu một", "Bài 2" -> "Bài hai", "Ví dụ 3" -> "Ví dụ ba"
  s = s.replace(/\b(Câu|câu)\s*(\d+)\b/g, (_, prefix, num) => `${prefix} ${numberToVietnameseWords(num)}`);
  s = s.replace(/\b(Bài|bài)\s*(\d+)\b/g, (_, prefix, num) => `${prefix} ${numberToVietnameseWords(num)}`);
  s = s.replace(/\b(Ví dụ|ví dụ)\s*(\d+)\b/g, (_, prefix, num) => `${prefix} ${numberToVietnameseWords(num)}`);
  s = s.replace(/\b(Đề|đề)\s*(\d+)\b/g, (_, prefix, num) => `${prefix} ${numberToVietnameseWords(num)}`);
  s = s.replace(/\b(Trang|trang)\s*(\d+)\b/g, (_, prefix, num) => `${prefix} ${numberToVietnameseWords(num)}`);
  s = s.replace(/\b(Phần|phần)\s*(\d+)\b/g, (_, prefix, num) => `${prefix} ${numberToVietnameseWords(num)}`);

  // 3. Chuyển đổi công thức toán học và phép tính
  // Dấu bằng: "x = 2" -> "x bằng hai"
  s = s.replace(/\s*=\s*/g, ' bằng ');
  s = s.replace(/\s*!=\s*/g, ' khác ');
  s = s.replace(/\s*≠\s*/g, ' khác ');
  s = s.replace(/\s*\+\s*/g, ' cộng ');
  s = s.replace(/\s*-\s*(?=[\d\w])/g, ' trừ ');
  s = s.replace(/\s*[*×•]\s*/g, ' nhân ');
  s = s.replace(/\s*[:/÷]\s*(?=[\d\w])/g, ' chia cho ');

  // 4. Các biến đi kèm số: "12a" -> "mười hai a", "2x" -> "hai x", "x1" -> "x một"
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
export function preprocessSpeechText(rawText: string): string {
  if (!rawText) return '';

  let t = rawText;

  // 1. Remove LaTeX enclosing tags: $, $$, \( \), \[ \]
  t = t.replace(/\$\$(.+?)\$\$/gs, ' $1 ');
  t = t.replace(/\$(.+?)\$/g, ' $1 ');
  t = t.replace(/\\\((.+?)\\\)/g, ' $1 ');
  t = t.replace(/\\\[(.+?)\\\]/gs, ' $1 ');

  // 2. Clean common LaTeX formatting commands
  t = t.replace(/\\displaystyle/g, ' ');
  t = t.replace(/\\text\{([^}]+)\}/g, ' $1 ');
  t = t.replace(/\\mathrm\{([^}]+)\}/g, ' $1 ');
  t = t.replace(/\\mathbf\{([^}]+)\}/g, ' $1 ');
  t = t.replace(/\\left\s*([(\[{|])/g, '$1');
  t = t.replace(/\\right\s*([)\]}|])/g, '$1');

  // 3. Fractions: \frac{a}{b} -> phân số a trên b
  t = t.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, ' phân số $1 trên $2, ');

  // 4. Square roots: \sqrt{x}, \sqrt[3]{x}
  t = t.replace(/\\sqrt\[3\]\{([^}]+)\}/g, ' căn bậc ba của $1, ');
  t = t.replace(/\\sqrt\{([^}]+)\}/g, ' căn bậc hai của $1, ');
  t = t.replace(/∛([a-zA-Z0-9]+)/g, ' căn bậc ba của $1, ');
  t = t.replace(/√([a-zA-Z0-9]+)/g, ' căn bậc hai của $1, ');
  t = t.replace(/√\(([^)]+)\)/g, ' căn bậc hai của $1, ');

  // 5. Exponents: x^2 -> x bình phương, x^3 -> x mũ ba
  t = t.replace(/([a-zA-Z0-9_\)]+)\^2(?![0-9])/g, ' $1 bình phương ');
  t = t.replace(/([a-zA-Z0-9_\)]+)²(?![0-9])/g, ' $1 bình phương ');
  t = t.replace(/([a-zA-Z0-9_\)]+)\^3(?![0-9])/g, ' $1 mũ ba ');
  t = t.replace(/([a-zA-Z0-9_\)]+)³(?![0-9])/g, ' $1 mũ ba ');
  t = t.replace(/([a-zA-Z0-9_\)]+)\^\{([^}]+)\}/g, ' $1 mũ $2 ');
  t = t.replace(/([a-zA-Z0-9_\)]+)\^([a-zA-Z0-9]+)/g, ' $1 mũ $2 ');

  // 6. Subscripts: x_1, x_2
  t = t.replace(/([a-zA-Z])_0/g, ' $1 không ');
  t = t.replace(/([a-zA-Z])_1/g, ' $1 một ');
  t = t.replace(/([a-zA-Z])_2/g, ' $1 hai ');
  t = t.replace(/([a-zA-Z])_3/g, ' $1 ba ');
  t = t.replace(/([a-zA-Z])_\{([^}]+)\}/g, ' $1 $2 ');
  t = t.replace(/([a-zA-Z])_([a-zA-Z0-9]+)/g, ' $1 $2 ');

  // 7. Math symbols
  t = t.replace(/\\pm/g, ' cộng trừ ');
  t = t.replace(/±/g, ' cộng trừ ');
  t = t.replace(/\\notin/g, ' không thuộc ');
  t = t.replace(/∉/g, ' không thuộc ');
  t = t.replace(/\\in/g, ' thuộc ');
  t = t.replace(/∈/g, ' thuộc ');

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

  t = t.replace(/\\approx/g, ' xấp xỉ ');
  t = t.replace(/≈/g, ' xấp xỉ ');
  t = t.replace(/\\infty/g, ' vô cực ');
  t = t.replace(/∞/g, ' vô cực ');
  t = t.replace(/\\int/g, ' tích phân ');
  t = t.replace(/∫/g, ' tích phân ');
  t = t.replace(/\\sum/g, ' tổng xích-ma ');
  t = t.replace(/∑/g, ' tổng xích-ma ');
  t = t.replace(/\\lim/g, ' giới hạn lim ');
  t = t.replace(/\\forall/g, ' với mọi ');
  t = t.replace(/∀/g, ' với mọi ');
  t = t.replace(/\\exists/g, ' tồn tại ');
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

/**
 * Immediate stop of any active speech synthesis or Gemini audio
 */
export function stopAllSpeech(): void {
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
  preferGemini?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

/**
 * Ultra-fast Text-to-Speech execution (<150ms).
 * CỐ ĐỊNH 100% TIẾNG VIỆT (vi-VN) - LUÔN GÁN VOICE TIẾNG VIỆT
 */
export function speakText(text: string, options: SpeakOptions = {}): boolean {
  if (!text || !text.trim()) return false;

  // Immediate cancellation to prevent delay or overlapping
  stopAllSpeech();

  const preset = options.preset || VOICE_TONE_PRESETS[0];
  const processed = preprocessSpeechText(text);

  if (!processed) return false;

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (options.onError) {
      options.onError(new Error('Web Speech API is not supported in this browser.'));
    }
    return false;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(processed);
    
    // Yêu cầu 1: Cấu hình cố định utterance.lang = 'vi-VN' tuyệt đối
    utterance.lang = 'vi-VN';
    utterance.pitch = preset.pitch;
    utterance.rate = preset.rate;
    // Maximum volume for 75" interactive smartboard speakers
    utterance.volume = 1.0;

    // Yêu cầu 1: Luôn lọc và gán voice tiếng Việt
    const allVoices = window.speechSynthesis.getVoices();
    const viVoices = allVoices.filter(
      (v) => (v.lang && (v.lang.toLowerCase().includes('vi') || v.lang.includes('VIE'))) ||
             (v.name && (v.name.toLowerCase().includes('vietnam') || v.name.toLowerCase().includes('tiếng việt')))
    );

    const matchedVoice = getBestVietnameseVoice(preset.gender);
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    } else if (viVoices.length > 0) {
      utterance.voice = viVoices[0]; // Ưu tiên giọng tiếng Việt tìm thấy
    }

    utterance.onstart = () => {
      if (options.onStart) options.onStart();
    };

    utterance.onend = () => {
      if (options.onEnd) options.onEnd();
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('Speech synthesis notice:', e);
        if (options.onError) options.onError(e);
      } else {
        if (options.onEnd) options.onEnd();
      }
    };

    // Immediate dispatch (<150ms)
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.error('Error starting speech synthesis:', err);
    if (options.onError) options.onError(err);
    return false;
  }
}

/**
 * Generate highly expressive Gemini Audio stream/blob if Gemini API key is configured.
 */
export async function speakWithGeminiAudio(
  text: string,
  preset: VoiceTonePreset = VOICE_TONE_PRESETS[0],
  onStart?: () => void,
  onEnd?: () => void
): Promise<boolean> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return speakText(text, { preset, onStart, onEnd });
  }

  stopAllSpeech();

  const processed = preprocessSpeechText(text);
  if (!processed) return false;

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const tonePrompt =
      preset.gender === 'male'
        ? 'Giọng nam giáo viên trầm ấm, đĩnh đạc, rõ chữ'
        : preset.id === 'mc_soi_dong'
        ? 'Giọng nữ MC sôi động, tươi vui, hào hứng'
        : 'Giọng nữ cô giáo dịu dàng, truyền cảm, ấm áp';

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Hãy đóng vai giáo viên Việt Nam với sắc thái "${tonePrompt}". Đọc to, rõ ràng, dứt khoát thuần tiếng Việt đoạn văn sau:\n\n"${processed}"`,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: preset.gender === 'male' ? 'Fenrir' : 'Kore',
            },
          },
        },
      } as any,
    });

    const candidates = response.candidates;
    const parts = candidates?.[0]?.content?.parts;
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

    if (audioBase64) {
      const binary = atob(audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      const audioUrl = URL.createObjectURL(blob);

      const audio = new Audio(audioUrl);
      audio.volume = 1.0;
      currentAudioElement = audio;

      audio.onplay = () => {
        if (onStart) onStart();
      };
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioElement = null;
        if (onEnd) onEnd();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioElement = null;
        speakText(text, { preset, onStart, onEnd });
      };

      await audio.play();
      return true;
    } else {
      return speakText(text, { preset, onStart, onEnd });
    }
  } catch (err) {
    console.warn('Gemini Audio fallback to Web Speech:', err);
    return speakText(text, { preset, onStart, onEnd });
  }
}
