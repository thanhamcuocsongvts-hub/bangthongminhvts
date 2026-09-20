import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { LessonDoc, SubjectType, SlideItem, QuizQuestion, ExtractedDocSummary } from '../types';
import { parseDocxWithFullMathAndMedia, extractTextFromDocBinary } from './docxMathParser';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage, db } from '../lib/firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';

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
export async function parseUploadedFileToLesson(
  file: File,
  authorName?: string,
  teacherId?: string
): Promise<LessonDoc> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const title = file.name.replace(/\.[^/.]+$/, '');
  const sizeFormatted = file.size > 1024 * 1024
    ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(file.size / 1024)} KB`;
  
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

  // Cross-device Cloud Persistence: Upload file to Firebase Storage
  let serverFileUrl = '';
  if (auth.currentUser) {
    try {
      const storageRef = ref(storage, `TaiLieuGiaoVien/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
      // For very large files, uploadBytesResumable might be better, but uploadBytes works for ~20MB
      await uploadBytes(storageRef, file);
      serverFileUrl = await getDownloadURL(storageRef);
      
      // Also save to TaiLieuGiaoVien collection for consistency with the TeacherFileManager
      try {
        await addDoc(collection(db, 'TaiLieuGiaoVien'), {
          uid: auth.currentUser.uid,
          name: file.name,
          url: serverFileUrl,
          size: file.size,
          type: ext,
          createdAt: Timestamp.now()
        });
      } catch (e) {
        console.warn("Failed to save to TaiLieuGiaoVien collection", e);
      }
    } catch (err) {
      console.warn('Firebase document upload notice:', err);
    }
  }

  let effectiveFileUrl = serverFileUrl || fileDataUrl;

  // Microsoft Office Web Viewer requires a public URL, but tmpfiles is unreliable.
  // We will now rely on our robust internal DocumentViewer for all offline rendering.

  let rawText = '';
  let detectedSubject: SubjectType = 'Toán học';
  let detectedGrade = 'Lớp 12';
  let slides: SlideItem[] = [];
  const quizzes: QuizQuestion[] = [];
  let extractedSummary: ExtractedDocSummary | undefined = undefined;

  // 1. Auto-detect subject from filename
  const fnLower = file.name?.toLowerCase();
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
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const isZip = bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

      if (isZip) {
        const zip = await JSZip.loadAsync(buffer);
        const slideFiles = Object.keys(zip.files)
          .filter((f) => /^ppt\/slides\/slide\d+\.xml$/i.test(f))
          .sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
            const numB = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || '0', 10);
            return numA - numB;
          });

        if (slideFiles.length > 0) {
          const parsedSlides: SlideItem[] = [];
          const textRuns: string[] = [];

          for (let i = 0; i < slideFiles.length; i++) {
            const xml = await zip.files[slideFiles[i]].async('text');
            const paragraphs: string[] = [];
            const pRegex = /<a:p(?:\s+[^>]*)?>([\s\S]*?)<\/a:p>/gi;
            let pMatch;
            while ((pMatch = pRegex.exec(xml)) !== null) {
              const pXml = pMatch[1];
              const tRegex = /<a:t(?:\s+[^>]*)?>([\s\S]*?)<\/a:t>/gi;
              let tMatch;
              const textParts: string[] = [];
              while ((tMatch = tRegex.exec(pXml)) !== null) {
                if (tMatch[1]) textParts.push(tMatch[1]);
              }
              const pText = textParts.join('').trim();
              if (pText) paragraphs.push(pText);
            }

            const slideTitle = paragraphs[0] || `Slide ${i + 1}`;
            const subtitle = paragraphs.length > 1 && paragraphs[1].length < 120 ? paragraphs[1] : '';
            const contentLines = subtitle ? paragraphs.slice(2) : paragraphs.slice(1);
            const content = contentLines.length > 0 ? contentLines.join('\n') : (paragraphs[0] || '');

            parsedSlides.push({
              id: `slide_pptx_${Date.now()}_${i + 1}`,
              title: slideTitle,
              subtitle,
              content,
            });

            textRuns.push(`=== Slide ${i + 1}: ${slideTitle} ===\n${paragraphs.join('\n')}`);
          }

          slides = parsedSlides;
          rawText = textRuns.join('\n\n');
        }
      }
    } catch (e) {
      console.warn('PPTX slide extraction notice:', e);
    }
    if (!rawText) {
      rawText = `Bài thuyết trình PowerPoint: ${file.name} (${sizeFormatted})\nĐã nạp tệp trình chiếu thành công. Thầy/Cô có thể bắt đầu trình chiếu toàn màn hình trên Tivi 75" hoặc bấm "Tạo Slide Giảng Dạy" để AI trích xuất sang slide tương tác.`;
    }
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
          fileUrl: effectiveFileUrl,
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

  const newLessonDoc: LessonDoc = {
    id: 'lesson_' + Date.now(),
    title,
    subject: detectedSubject,
    grade: detectedGrade,
    lastModified: new Date().toISOString(),
    syncedToCloud: true,
    author: authorName || 'Giáo viên',
    rawText,
    slides,
    quizzes,
    fileUrl: effectiveFileUrl,
    fileType,
    fileName: file.name,
    fileSize: sizeFormatted,
  };

  if (extractedSummary) newLessonDoc.extractedSummary = extractedSummary;
  if (htmlContent) newLessonDoc.htmlContent = htmlContent;
  if (sheetData) newLessonDoc.sheetData = sheetData;

  return newLessonDoc;
}
