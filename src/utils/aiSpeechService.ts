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
    id: 'nam_tram_am',
    name: 'Giọng Nam (Thầy giáo trầm ấm)',
    label: '👨‍🏫 Giọng Nam (Thầy giáo)',
    sub: 'Trầm ấm • Đĩnh đạc • Chuẩn phát thanh',
    description: 'Giọng thầy giáo trầm ấm, uy nghiêm, phát âm rõ ràng từng âm tiết tiếng Việt',
    icon: '👨‍🏫',
    pitch: 0.88,
    rate: 0.98,
    volume: 1.0,
    gender: 'male',
    geminiVoice: 'Fenrir',
  },
  {
    id: 'nu_diu_dang',
    name: 'Giọng Nữ (Cô giáo dịu dàng)',
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
    id: 'hoc_sinh',
    name: 'Giọng Học Sinh (Trong trẻo, vui tươi)',
    label: '🎒 Giọng Học Sinh',
    sub: 'Trong trẻo • Vui tươi • Hồn nhiên',
    description: 'Giọng em học sinh trong trẻo, hồn nhiên, phát biểu bài sôi nổi và tràn đầy năng lượng',
    icon: '🎒',
    pitch: 1.28,
    rate: 1.06,
    volume: 1.0,
    gender: 'female',
    geminiVoice: 'Puck',
  },
  {
    id: 'podcast',
    name: 'Giọng Đọc Podcast (Sâu lắng, tự sự)',
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
    return null;
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
 * Đọc số nguyên tiếng Việt chuẩn xác (1..999,999)
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

  // Khắc phục triệt để lỗi vỡ font tiếng Việt từ PDF/Scan trước khi chuyển thành lời đọc
  let t = cleanPdfVietnameseText(rawText);

  // 0. Mở rộng từ viết tắt hành chính giáo dục & tiêu đề tài liệu chuẩn tiếng Việt
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
 * Phát giọng đọc Google Cloud Text-To-Speech Tiếng Việt (100% Chuẩn Ngữ Âm Bản Địa)
 * Hỗ trợ 4 phong cách giọng: Nam trầm ấm, Nữ dịu dàng, Học sinh vui tươi, Podcast tự sự
 */
export async function speakWithGoogleCloudTTS(
  processedText: string,
  preset: VoiceTonePreset = VOICE_TONE_PRESETS[0],
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): Promise<boolean> {
  const sentences = splitIntoSentences(processedText, 220);
  if (sentences.length === 0) return false;

  stopAllSpeech();
  isSpeechCancelled = false;

  let currentIndex = 0;

  return new Promise((resolve) => {
    const playNext = async () => {
      if (isSpeechCancelled || currentIndex >= sentences.length) {
        if (!isSpeechCancelled && onEnd) onEnd();
        currentAudioElement = null;
        resolve(true);
        return;
      }

      const sentence = sentences[currentIndex];
      currentIndex++;

      try {
        const url = `/api/tts?text=${encodeURIComponent(sentence)}`;
        const audio = new Audio(url);
        currentAudioElement = audio;

        // Tinh chỉnh tốc độ theo 4 sắc thái:
        // Nam: 0.96x, Nữ: 1.0x, Học sinh: 1.08x, Podcast: 0.90x
        if (preset.id === 'hoc_sinh') {
          audio.playbackRate = 1.08;
        } else if (preset.id === 'podcast') {
          audio.playbackRate = 0.90;
        } else if (preset.id === 'nam_tram_am') {
          audio.playbackRate = 0.96;
        } else {
          audio.playbackRate = 1.0;
        }

        audio.onplay = () => {
          if (currentIndex === 1 && onStart) onStart();
        };

        audio.onended = () => {
          if (!isSpeechCancelled) {
            playNext();
          }
        };

        audio.onerror = (e) => {
          console.warn('Google Cloud TTS network error, fallback to Web Speech:', e);
          currentAudioElement = null;
          // Fallback to Web Speech
          speakWithWebSpeech(sentence, preset, onStart, onEnd, onError);
          resolve(false);
        };

        await audio.play();
      } catch (playErr) {
        console.warn('Audio play exception, fallback to Web Speech:', playErr);
        currentAudioElement = null;
        speakWithWebSpeech(processedText, preset, onStart, onEnd, onError);
        resolve(false);
      }
    };

    playNext();
  });
}

/**
 * Web Speech API Fallback (Chỉ gán giọng tiếng Việt, tuyệt đối không dùng giọng tiếng Anh)
 */
export function speakWithWebSpeech(
  processedText: string,
  preset: VoiceTonePreset = VOICE_TONE_PRESETS[0],
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onError) onError(new Error('Web Speech API is not supported in this browser.'));
    return false;
  }

  try {
    const utterance = new SpeechSynthesisUtterance(processedText);
    utterance.lang = 'vi-VN';
    utterance.pitch = preset.pitch;
    utterance.rate = preset.rate;
    utterance.volume = 1.0;

    const matchedVoice = getBestVietnameseVoice(preset.gender);
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => {
      if (onStart) onStart();
    };

    utterance.onend = () => {
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('Web Speech synthesis error:', e);
        if (onError) onError(e);
      } else {
        if (onEnd) onEnd();
      }
    };

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.error('Error starting Web Speech synthesis:', err);
    if (onError) onError(err);
    return false;
  }
}

/**
 * Ultra-fast Text-to-Speech execution (<150ms).
 * ƯU TIÊN 1: Google Cloud Text-To-Speech Tiếng Việt chuẩn 100%, rõ ràng, truyền cảm.
 * ƯU TIÊN 2: Web Speech API vi-VN (không đọc giọng tiếng Anh).
 */
export function speakText(text: string, options: SpeakOptions = {}): boolean {
  if (!text || !text.trim()) return false;

  stopAllSpeech();

  const preset = options.preset || VOICE_TONE_PRESETS[0];
  const processed = preprocessSpeechText(text);

  if (!processed) return false;

  // Khởi động phát giọng đọc Google Cloud TTS Tiếng Việt
  speakWithGoogleCloudTTS(processed, preset, options.onStart, options.onEnd, options.onError);
  return true;
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
    
    let tonePrompt = 'Giọng đọc tiếng Việt tự nhiên, rõ ràng, giàu cảm xúc';
    let voiceName = preset.geminiVoice || 'Fenrir';

    if (preset.id === 'nam_tram_am') {
      tonePrompt = 'Giọng nam giáo viên Việt Nam trầm ấm, đĩnh đạc, phát âm to rõ từng từ, chuẩn phát thanh viên';
      voiceName = 'Fenrir';
    } else if (preset.id === 'nu_diu_dang') {
      tonePrompt = 'Giọng nữ cô giáo Việt Nam dịu dàng, ấm áp, truyền cảm, nhịp điệu sư phạm chuẩn mực êm ái';
      voiceName = 'Kore';
    } else if (preset.id === 'hoc_sinh') {
      tonePrompt = 'Giọng em học sinh Việt Nam trong trẻo, hồn nhiên, vui tươi, phát biểu sôi nổi và tràn đầy năng lượng';
      voiceName = 'Puck';
    } else if (preset.id === 'podcast') {
      tonePrompt = 'Giọng đọc Podcast Radio nghệ thuật sâu lắng, tự sự, nhịp điệu thư thái, trầm bổng giàu cảm xúc';
      voiceName = 'Charon';
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Hãy đọc to bằng TIẾNG VIỆT với sắc thái "${tonePrompt}". Phát âm chuẩn âm, ngữ điệu tự nhiên, ngắt nghỉ đúng dấu câu theo đoạn văn sau:\n\n"${processed}"`,
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName,
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

/**
 * Đọc toàn bộ nội dung câu hỏi trắc nghiệm kèm 4 đáp án A, B, C, D bằng giọng đọc AI tiếng Việt chuẩn mực
 */
export function speakQuestionContent(
  question: {
    question: string;
    options: Array<{ key: string; text: string }>;
    explanation?: string;
  },
  options: SpeakOptions = {}
): boolean {
  if (!question || !question.question) return false;

  const parts: string[] = [];
  parts.push(`Câu hỏi: ${question.question}.`);

  if (Array.isArray(question.options) && question.options.length > 0) {
    question.options.forEach((opt) => {
      const key = opt.key || '';
      const text = opt.text || '';
      if (text.trim()) {
        parts.push(`Phương án ${key}: ${text}.`);
      }
    });
  }

  const script = parts.join(' ');
  return speakText(script, options);
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
