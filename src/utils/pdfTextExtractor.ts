/**
 * PDF Vietnamese Text Normalizer & Extractor for SmartBoard 75 Pro
 * 
 * Khắc phục triệt để lỗi vỡ font tiếng Việt khi đọc tài liệu PDF:
 * 1. Chuẩn hóa bảng mã Unicode tiếng Việt về dựng sẵn (NFC).
 * 2. Loại bỏ mã CID, Private Use Area, glyph rác, ký tự điều khiển.
 * 3. Nối các từ tiếng Việt bị phân tách rời rạc từng ký tự (kerning/font mapping PDF).
 * 4. Chuẩn hóa dấu câu, ranh giới từ và khoảng trắng thừa.
 */

/**
 * Bộ làm sạch và chuẩn hóa văn bản PDF chuẩn tiếng Việt 100%
 */
export function cleanPdfVietnameseText(rawText: string): string {
  if (!rawText) return '';

  let text = rawText;

  // 1. Chuẩn hóa bảng mã Unicode tiếng Việt về dựng sẵn (NFC)
  text = text.normalize('NFC');

  // Loại bỏ các ký tự Private Use Area, CID font rác, Unicode Replacement \uFFFD và zero-width spaces
  text = text.replace(/[\uE000-\uF8FF\uFFF0-\uFFFF\uFFFD\u200B-\u200D\uFEFF]/g, ' ');
  text = text.replace(/\(cid:\d+\)/gi, ' ');

  // Sửa các dấu tổ hợp và lỗi ghép âm phổ biến trong font PDF Việt Nam cũ (TCVN3, VNI sót lại)
  text = text.replace(/\bĐ\s*ặ\s*c\b/gi, 'Đặc');
  text = text.replace(/\bHỌ\s*C\b/gi, 'HỌC');
  text = text.replace(/\bđộn\s*g\b/gi, 'động');
  text = text.replace(/\bK\s*hó\b/gi, 'Khó');
  text = text.replace(/\bQ\s*u\s*ả\s*n\b/gi, 'Quản');

  // Gộp các chữ số bị đứt gãy do kerning PDF (ví dụ: "20 2 5" -> "2025", "1 5" -> "15")
  text = text.replace(/(\d)\s+(\d)/g, '$1$2');
  text = text.replace(/(\d)\s+(\d)/g, '$1$2');

  // Gộp các số La Mã bị tách (ví dụ: "I I" -> "II", "I V" -> "IV")
  text = text.replace(/\b([IVXLCDM])\s+([IVXLCDM])\b/g, '$1$2');

  // Bảo vệ ranh giới từ thật sự (khi khoảng cách giữa các từ >= 2 khoảng trắng hoặc xuống dòng)
  text = text.replace(/\s{2,}/g, ' ___WORD_GAP___ ');

  // Bảo vệ các từ bình thường đã hoàn chỉnh (>= 2 ký tự tiếng Việt) không bị dính vào nhau
  text = text.replace(/([a-zA-ZÀ-ỹ]{2,})\s+(?=[a-zA-ZÀ-ỹ]{2,})/g, '$1___WORD_GAP___');
  text = text.replace(/([a-zA-ZÀ-ỹ]{2,})\s+(?=\d|[a-zA-ZÀ-ỹ]\s+___WORD_GAP___)/g, '$1___WORD_GAP___');

  // 2. Nối các từ tiếng Việt bị tách rời từng ký tự (Ví dụ: "N h ậ n   b i ế t" -> "Nhận biết")
  for (let i = 0; i < 3; i++) {
    text = text.replace(/([a-zA-ZÀ-ỹ])\s+([a-zA-ZÀ-ỹ])\s+([a-zA-ZÀ-ỹ])/g, '$1$2$3');
    text = text.replace(/([a-zA-ZÀ-ỹ])\s+([a-zA-ZÀ-ỹ])/g, '$1$2');
  }

  // Khôi phục lại ranh giới từ
  text = text.replace(/___WORD_GAP___/g, ' ');

  // 3. Loại bỏ toàn bộ ký tự điều khiển, ký tự Unicode rác ngoài bảng chữ cái tiếng Việt, số và dấu câu
  text = text.replace(/[^\p{L}\p{N}\p{P}\s]/gu, ' ');

  // 4. Chuẩn hóa các dấu câu và khoảng trắng thừa
  text = text.replace(/\s+/g, ' ').trim();

  // Chuẩn hóa dấu câu sư phạm (dấu hai chấm, phẩy, chấm, hỏi, than)
  text = text.replace(/\s+([,.:;?!])/g, '$1');
  text = text.replace(/([,.:;?!])(?=[^\s\d])/g, '$1 ');

  return text;
}

/**
 * Trích xuất và làm sạch toàn bộ văn bản từ đối tượng textContent của PDF.js
 */
export function extractCleanPdfText(textContent: any): string {
  if (!textContent || !textContent.items) return '';

  let raw = '';
  const items = textContent.items;

  for (let i = 0; i < items.length; i++) {
    const it = items[i] as any;
    const str = it.str || '';
    
    raw += str;
    
    if (it.hasEOL) {
      raw += '\n';
    } else if (str.length > 0 && !str.endsWith(' ')) {
      // Kiểm tra khoảng cách với item tiếp theo nếu có dữ liệu transform
      const nextIt = items[i + 1] as any;
      if (nextIt && it.transform && nextIt.transform) {
        const currentEndX = it.transform[4] + (it.width || 0);
        const nextStartX = nextIt.transform[4];
        const sameLine = Math.abs(it.transform[5] - nextIt.transform[5]) < 3;
        
        // Nếu cùng dòng và khoảng cách > 2px, chèn khoảng trắng phân cách từ
        if (sameLine && nextStartX - currentEndX > 2) {
          raw += ' ';
        }
      }
    }
  }

  return cleanPdfVietnameseText(raw);
}
