import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { LessonDoc, SubjectType, SlideItem, QuizQuestion, ExtractedDocSummary } from '../types';
import { parseDocxWithFullMathAndMedia, extractTextFromDocBinary } from './docxMathParser';

if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
  } catch (e) {
    console.warn('PDF Worker init notice:', e);
  }
}

/**
 * Remove raw PDF stream binary artifacts or corrupted characters if present
 */
export function cleanDocumentText(text: string): string {
  if (!text) return '';

  // If text starts with %PDF or contains raw PDF object streams or bytecode
  if (
    text.startsWith('%PDF-') ||
    text.includes('obj\n<<') ||
    text.includes('endobj') ||
    text.includes('stream\n') ||
    text.includes('/Filter/FlateDecode') ||
    text.includes('/Type/XObject')
  ) {
    return '';
  }

  // Remove control characters except normal whitespace
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Parse any uploaded file (PDF, Word, Excel, PowerPoint, Image, Text, JSON)
 * into a rich, structured LessonDoc for SmartBoard 75 Pro.
 * 
 * NOTE: Does NOT force full AI translation on upload! 
 * Instantly loads the file with full fidelity for multiple viewing modes (PDF Viewer, Split Screen, etc.).
 * AI extraction is performed on-demand when requested by the teacher.
 */
export async function parseUploadedFileToLesson(file: File): Promise<LessonDoc> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const title = file.name.replace(/\.[^/.]+$/, '');
  
  // Read file as persistent Base64 Data URL or Blob URL for large files (> 20MB)
  const readAsDataUrl = (): Promise<string> => {
    if (file.size > 20 * 1024 * 1024) {
      return Promise.resolve(URL.createObjectURL(file));
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) || '');
      reader.onerror = () => resolve(URL.createObjectURL(file));
      reader.readAsDataURL(file);
    });
  };

  const fileDataUrl = await readAsDataUrl();

  let rawText = '';
  let detectedSubject: SubjectType = 'Toán học';
  let detectedGrade = 'Lớp 12';
  const slides: SlideItem[] = [];
  const quizzes: QuizQuestion[] = [];
  const extractedSummary: ExtractedDocSummary | undefined = undefined;

  // 1. Auto-detect subject from filename
  const fnLower = file.name.toLowerCase();
  if (fnLower.includes('sinh') || fnLower.includes('bio')) detectedSubject = 'Sinh học';
  else if (fnLower.includes('lý') || fnLower.includes('phys') || fnLower.includes('vat ly')) detectedSubject = 'Vật lý';
  else if (fnLower.includes('hóa') || fnLower.includes('chem') || fnLower.includes('hoa hoc')) detectedSubject = 'Hóa học';
  else if (fnLower.includes('văn') || fnLower.includes('ngữ văn') || fnLower.includes('van hoc')) detectedSubject = 'Ngữ văn';
  else if (fnLower.includes('sử') || fnLower.includes('hist') || fnLower.includes('lich su')) detectedSubject = 'Lịch sử';
  else if (fnLower.includes('địa') || fnLower.includes('geo') || fnLower.includes('dia ly')) detectedSubject = 'Địa lý';
  else if (fnLower.includes('anh') || fnLower.includes('eng') || fnLower.includes('tieng anh')) detectedSubject = 'Tiếng Anh';
  else if (fnLower.includes('tin') || fnLower.includes('it') || fnLower.includes('tin hoc')) detectedSubject = 'Tin học';
  else if (fnLower.includes('toán') || fnLower.includes('math') || fnLower.includes('giai tich') || fnLower.includes('hinh hoc')) detectedSubject = 'Toán học';

  // 2. Auto-detect grade from filename
  if (fnLower.includes('12') || fnLower.includes('lop 12') || fnLower.includes('k12')) detectedGrade = 'Lớp 12';
  else if (fnLower.includes('11') || fnLower.includes('lop 11') || fnLower.includes('k11')) detectedGrade = 'Lớp 11';
  else if (fnLower.includes('10') || fnLower.includes('lop 10') || fnLower.includes('k10')) detectedGrade = 'Lớp 10';
  else if (fnLower.includes('9') || fnLower.includes('lop 9')) detectedGrade = 'Lớp 9';

  let fileType: 'pdf' | 'docx' | 'image' | 'xlsx' | 'pptx' | 'text' | 'other' = 'other';
  const sizeFormatted = file.size > 1024 * 1024 
    ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
    : `${(file.size / 1024).toFixed(0)} KB`;

  let htmlContent: string | undefined = undefined;
  let sheetData: { sheetNames: string[]; sheets: Record<string, any[][]> } | undefined = undefined;

  // 3. Process according to file type
  if (ext === 'pdf') {
    fileType = 'pdf';
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      const maxPages = Math.min(pdf.numPages, 15);
      const textParts: string[] = [];

      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ')
          .trim();
        if (pageText) {
          textParts.push(`--- Trang ${i} ---\n${pageText}`);
        }
      }

      if (textParts.length > 0) {
        rawText = textParts.join('\n\n');
      } else {
        rawText = `Tài liệu: ${file.name}\nĐịnh dạng: Tệp PDF (${sizeFormatted}, ${pdf.numPages} trang)\n• Tệp đã sẵn sàng hiển thị trực tiếp với độ phân giải cao trên SmartBoard 75 Pro.`;
      }
    } catch (pdfErr) {
      console.warn('PDF text extraction notice:', pdfErr);
      rawText = `Tài liệu: ${file.name}\nĐịnh dạng: Tệp PDF (${sizeFormatted})\n• Tệp đã sẵn sàng hiển thị trực tiếp trên SmartBoard 75 Pro.`;
    }
  } else if (ext === 'docx' || ext === 'doc') {
    fileType = 'docx';
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      if (ext === 'doc') {
        const docRes = extractTextFromDocBinary(arrayBuffer);
        rawText = cleanDocumentText(docRes.text);
        htmlContent = docRes.html;
      } else {
        // Try deep OMML math, table and image parser first
        try {
          const deepRes = await parseDocxWithFullMathAndMedia(arrayBuffer);
          if (deepRes.html && deepRes.html.length > 30) {
            htmlContent = deepRes.html;
            rawText = cleanDocumentText(deepRes.rawText);
          }
        } catch (deepErr) {
          console.warn('Deep docx math parser notice, trying Mammoth fallback:', deepErr);
        }

        // If deep parser didn't produce html, fallback to Mammoth with embedded images
        if (!htmlContent) {
          const [textRes, htmlRes] = await Promise.all([
            mammoth.extractRawText({ arrayBuffer }),
            mammoth.convertToHtml(
              { arrayBuffer },
              {
                convertImage: mammoth.images.imgElement((image) => {
                  return image.read('base64').then((imageBuffer) => {
                    return {
                      src: `data:${image.contentType};base64,${imageBuffer}`,
                    };
                  });
                }),
              }
            ),
          ]);
          rawText = cleanDocumentText(textRes.value ? textRes.value.trim() : '');
          htmlContent = htmlRes.value ? htmlRes.value : undefined;
        }
      }
    } catch (e) {
      console.warn('Word document parse fallback', e);
      rawText = `Tài liệu Word: ${file.name} (${sizeFormatted})`;
    }
  } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    fileType = 'xlsx';
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetNames = workbook.SheetNames || ['Sheet1'];
      const sheets: Record<string, any[][]> = {};
      sheetNames.forEach((sName) => {
        const ws = workbook.Sheets[sName];
        if (ws) {
          sheets[sName] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        }
      });
      sheetData = { sheetNames, sheets };

      const firstSheetName = sheetNames[0];
      const rawJson: any[] = sheets[firstSheetName] || [];
      rawText = rawJson
        .map((row) => (Array.isArray(row) ? row.filter((c) => c !== undefined && c !== null).join(' | ') : ''))
        .filter((r) => r.trim().length > 0)
        .join('\n');
    } catch (e) {
      console.warn('Excel parse fallback', e);
      rawText = `Bảng tính Excel: ${file.name}`;
    }
  } else if (ext === 'pptx' || ext === 'ppt') {
    fileType = 'pptx';
    rawText = `Bài thuyết trình PowerPoint: ${file.name} (${sizeFormatted})\nĐã nạp tệp trình chiếu. Thầy/Cô có thể bấm "Tạo Slide Giảng Dạy" để AI trích xuất nội dung sang slide tương tác 75".`;
  } else if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'svg'].includes(ext)) {
    fileType = 'image';
    rawText = `Hình ảnh tài liệu: ${file.name} (${sizeFormatted})\nĐã sẵn sàng hiển thị và phóng to trên màn hình tương tác.`;
  } else if (ext === 'json') {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed.title) {
        return {
          ...parsed,
          id: 'lesson_' + Date.now(),
          lastModified: new Date().toISOString(),
          syncedToCloud: true,
          fileUrl: fileDataUrl,
          fileType: 'text',
          fileName: file.name,
          fileSize: sizeFormatted,
        };
      }
    } catch {
      rawText = cleanDocumentText(text);
    }
  } else {
    // Plain text / Markdown
    fileType = 'text';
    const text = await file.text();
    rawText = cleanDocumentText(text);
  }

  return {
    id: 'lesson_' + Date.now(),
    title,
    subject: detectedSubject,
    grade: detectedGrade,
    lastModified: new Date().toISOString(),
    syncedToCloud: true,
    author: 'Giáo viên',
    rawText,
    slides,
    quizzes,
    fileUrl: fileDataUrl,
    fileType,
    fileName: file.name,
    fileSize: sizeFormatted,
    extractedSummary,
    htmlContent,
    sheetData,
  };
}
