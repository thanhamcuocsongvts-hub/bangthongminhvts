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
    id: 'mc_the_thao',
    name: 'MC Bình Luận Viên Trực Tiếp (Cao trào, đếm ngược)',
    label: '🔥 Bình Luận Viên (Đua điểm số)',
    sub: 'Kịch tính • Cao trào • Hồi hộp',
    description: 'Phong cách bình luận viên thể thao trực tiếp kịch tính, tạo không khí đua tài nghẹt thở từng giây',
    icon: '🔥',
    pitch: 1.10,
    rate: 1.18,
    volume: 1.0,
    gender: 'male',
    geminiVoice: 'Fenrir',
  },
  {
    id: 'mc_truyen_hinh',
    name: 'MC Đài Truyền Hình (Đẳng cấp, thanh lịch, chuẩn mực)',
    label: '📺 MC Truyền Hình (Chuyên nghiệp)',
    sub: 'Đẳng cấp • Cuốn hút • Chuẩn mực',
    description: 'Giọng MC phát thanh truyền hình quốc gia: âm vực vang sáng, rõ ràng, phong thái đĩnh đạc và cuốn hút',
    icon: '📺',
    pitch: 1.08,
    rate: 1.08,
    volume: 1.0,
    gender: 'male',
    geminiVoice: 'Puck',
  },
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
    id: 'nam_tram_am',
    name: 'Giọng Nam (Thầy giáo trầm ấm, đĩnh đạc)',
    label: '👨‍🏫 Giọng Nam (Thầy giáo)',
    sub: 'Trầm ấm • Đĩnh đạc • Chuẩn phát thanh',
    description: 'Giọng thầy giáo trầm ấm, uy nghiêm, phát âm rõ ràng từng âm tiết tiếng Việt',
    icon: '👨‍🏫',
    pitch: 0.88,
    rate: 0.98,
    volume: 1.0,
    gender: 'male',
    geminiVoice: 'Charon',
  },
  {
    id: 'hoc_sinh',
    name: 'Giọng Học Sinh (Trong trẻo, sôi nổi, tự tin)',
    label: '🎒 Giọng Học Sinh (Sôi nổi)',
    sub: 'Trong trẻo • Vui tươi • Hồn nhiên',
    description: 'Giọng em học sinh trong trẻo, hồn nhiên, phát biểu bài sôi nổi và tràn đầy năng lượng',
    icon: '🎒',
    pitch: 1.28,
    rate: 1.08,
    volume: 1.0,
    gender: 'female',
    geminiVoice: 'Puck',
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
export function preprocessSpeechText(rawText: string): string {
  if (!rawText) return '';

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
 * Phát giọng đọc Google Cloud Text-To-Speech
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

  const encoded = encodeURIComponent(processedText.trim());
  const candidateUrls = [
    `/api/tts?lang=${lang}&text=${encoded}`,
  ];

  let playSucceeded = false;

  for (const audioUrl of candidateUrls) {
    if (isSpeechCancelled) break;
    let objectUrlToRevoke: string | null = null;
    try {
      // Tải trước Blob qua fetch để xử lý dứt điểm các lỗi mạng, CORS và buffering của Audio element
      let playUrl = audioUrl;
      try {
        const fetchRes = await fetch(audioUrl);
        if (fetchRes.ok) {
          const blob = await fetchRes.blob();
          if (blob.size > 200) {
            objectUrlToRevoke = URL.createObjectURL(blob);
            playUrl = objectUrlToRevoke;
          }
        }
      } catch (fErr) {
        console.warn('TTS prefetch fallback to direct URL:', fErr);
      }

      const audio = new Audio();
      (audio as any).referrerPolicy = 'no-referrer';
      currentAudioElement = audio;
      audio.src = playUrl;

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
      audio.playbackRate = playbackRate;

      audio.onplay = () => {
        if (!isSpeechCancelled && onStart) onStart();
      };

      const res = await new Promise<boolean>((resolve) => {
        audio.onended = () => {
          if (objectUrlToRevoke) {
            try { URL.revokeObjectURL(objectUrlToRevoke); } catch (_) {}
          }
          if (!isSpeechCancelled && onEnd) onEnd();
          currentAudioElement = null;
          resolve(true);
        };
        audio.onerror = (e) => {
          if (objectUrlToRevoke) {
            try { URL.revokeObjectURL(objectUrlToRevoke); } catch (_) {}
          }
          console.warn('Google Cloud TTS audio playback notice:', e);
          resolve(false);
        };
        audio.play().catch((playErr) => {
          if (objectUrlToRevoke) {
            try { URL.revokeObjectURL(objectUrlToRevoke); } catch (_) {}
          }
          console.warn('Audio play error, falling back:', playErr);
          resolve(false);
        });
      });

      if (res) {
        playSucceeded = true;
        break;
      }
    } catch (_) {
      if (objectUrlToRevoke) {
        try { URL.revokeObjectURL(objectUrlToRevoke); } catch (_) {}
      }
      continue;
    }
  }

  if (playSucceeded) {
    return true;
  }

  // Fallback Web Speech API có kiểm tra voice và ngôn ngữ
  if (!isSpeechCancelled) {
    return speakWithWebSpeech(processedText, preset, lang, onStart, onEnd, onError);
  }
  return false;
}

/**
 * Web Speech API Fallback (Cố định vi-VN cho các môn tiếng Việt, en-US cho môn Anh Văn)
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
    if (onError) onError(new Error('Web Speech API is not supported in this browser.'));
    return false;
  }

  try {
    const matchedVoice = lang === 'en' ? getBestEnglishVoice() : getBestVietnameseVoice(preset.gender);
    
    // NGUYÊN TẮC QUAN TRỌNG:
    // Nếu môn Toán / tiếng Việt mà máy người dùng không có voice tiếng Việt cài sẵn,
    // TUYỆT ĐỐI KHÔNG dùng voice tiếng Anh mặc định của hệ thống để đọc (gây phát âm ngọng / tiếng Anh kỳ lạ)!
    if (lang === 'vi' && !matchedVoice) {
      console.warn('Không tìm thấy voice tiếng Việt trong Web Speech API; không dùng voice tiếng Anh thay thế.');
      if (onError) onError(new Error('No Vietnamese voice available'));
      return false;
    }

    const utterance = new SpeechSynthesisUtterance(processedText);
    utterance.lang = lang === 'en' ? 'en-US' : 'vi-VN';
    utterance.pitch = preset.pitch;
    utterance.rate = preset.rate;
    utterance.volume = 1.0;
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
 * Hỗ trợ tiếng Anh riêng cho bộ môn Tiếng Anh / Anh Văn.
 */
export function speakText(text: string, options: SpeakOptions = {}): boolean {
  if (!text || !text.trim()) return false;

  stopAllSpeech();

  const isEnglish = !!options.isEnglish || 
    (typeof options.subject === 'string' && (
      options.subject.toLowerCase().includes('anh') || 
      options.subject.toLowerCase().includes('english')
    ));

  const lang: 'vi' | 'en' = isEnglish ? 'en' : 'vi';
  const preset = options.preset || VOICE_TONE_PRESETS[0];
  const processed = isEnglish ? text.trim() : preprocessSpeechText(text);

  if (!processed) return false;

  // Khởi động phát giọng đọc Google Cloud TTS
  speakWithGoogleCloudTTS(processed, preset, lang, options.onStart, options.onEnd, options.onError);
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
    subject?: string;
  },
  options: SpeakOptions = {}
): boolean {
  if (!question || !question.question) return false;

  const isEnglish = !!options.isEnglish || 
    (typeof question.subject === 'string' && (
      question.subject.toLowerCase().includes('anh') || 
      question.subject.toLowerCase().includes('english')
    )) ||
    (typeof options.subject === 'string' && (
      options.subject.toLowerCase().includes('anh') || 
      options.subject.toLowerCase().includes('english')
    ));

  const parts: string[] = [];

  if (isEnglish) {
    const cleanQuestion = (question.question || '').trim().replace(/^Question\s*\d*\s*[:.]\s*/i, '').trim();
    parts.push(`Question: ${cleanQuestion}.`);
    if (Array.isArray(question.options) && question.options.length > 0) {
      question.options.forEach((opt) => {
        const key = (opt.key || '').trim().toUpperCase();
        const text = opt.text || '';
        if (text.trim()) {
          const cleanText = text.trim()
            .replace(/^[A-Da-d][.:)\-\/]\s*/, '')
            .replace(/^[:\-–—]\s*/, '')
            .trim();
          parts.push(`Option ${key}, ${cleanText}.`);
        }
      });
    }
  } else {
    const cleanQuestion = (question.question || '').trim().replace(/^câu\s*\d*\s*[:.]\s*/i, '').trim();
    parts.push(`Câu hỏi, ${cleanQuestion}.`);
    if (Array.isArray(question.options) && question.options.length > 0) {
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
          parts.push(`Phương án ${keyPhonetic}, ${cleanText}.`);
        }
      });
    }
  }

  const script = parts.join(' ');
  return speakText(script, {
    ...options,
    isEnglish,
    subject: question.subject || options.subject,
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
