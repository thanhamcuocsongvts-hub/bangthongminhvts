import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import pptxgen from 'pptxgenjs';
import { LessonDoc, RoomState, QuizQuestion, ClassRoom, TeacherProfile } from '../types';
import { fetchFileFromCloudStore } from './storageUtils';

/**
 * Universal safe blob saver working seamlessly on Desktop browsers, iOS Safari, Android Chrome, and WebViews
 */
export function saveBlobSafely(blob: Blob, filename: string) {
  try {
    saveAs(blob, filename);
  } catch (_) {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { document.body.removeChild(a); } catch (_) {}
        URL.revokeObjectURL(url);
      }, 3500);
    } catch (e) {
      console.error('Download error:', e);
    }
  }
}

/**
 * 1. Export Gradebook to Excel (.xlsx) with Semester 1 (HK1), Semester 2 (HK2), and Full Year (Cả Năm) sheets
 */
export function exportGradebookToExcel(classroom: ClassRoom, teacher: TeacherProfile) {
  const wb = XLSX.utils.book_new();

  // Helper to compute DTB for a semester
  const computeSemesterDtb = (sem: any) => {
    if (!sem) return '';
    if (typeof sem.dtb === 'number') return sem.dtb;
    const tx = [sem.tx1, sem.tx2, sem.tx3, sem.tx4, sem.tx5].filter((s): s is number => typeof s === 'number' && !isNaN(s));
    let sum = tx.reduce((a, b) => a + b, 0);
    let weights = tx.length;
    if (typeof sem.gk === 'number') { sum += sem.gk * 2; weights += 2; }
    if (typeof sem.ck === 'number') { sum += sem.ck * 3; weights += 3; }
    return weights > 0 ? (Math.round((sum / weights) * 10) / 10) : '';
  };

  // Sheet 1: Học Kỳ 1 (HK1)
  const hk1Rows = classroom.students.map((st, idx) => {
    const hk1 = st.hk1 || {};
    const dtb = computeSemesterDtb(hk1);
    const evalText = hk1.evaluation || (typeof dtb === 'number' ? (dtb >= 8 ? 'Giỏi' : dtb >= 6.5 ? 'Khá' : dtb >= 5 ? 'Đạt' : 'Chưa đạt') : '');
    return {
      'STT': idx + 1,
      'Mã Học Sinh': st.code,
      'Họ và Tên': st.name,
      'Giới Tính': st.gender || '',
      'Ngày Sinh': st.birthDate || '',
      'Tổ / Nhóm': st.group || '',
      'ĐĐGtx 1': hk1.tx1 ?? st.oralScore ?? '',
      'ĐĐGtx 2': hk1.tx2 ?? st.test15mScore ?? '',
      'ĐĐGtx 3': hk1.tx3 ?? '',
      'ĐĐGtx 4': hk1.tx4 ?? '',
      'ĐĐGtx 5': hk1.tx5 ?? '',
      'ĐĐGgk (x2)': hk1.gk ?? st.test1PeriodScore ?? '',
      'ĐĐGck (x3)': hk1.ck ?? st.finalScore ?? '',
      'ĐTB Môn HKI': dtb,
      'Điểm Thi Đua (+/-)': st.bonusPoints || 0,
      'Kết Quả / Nhận Xét': evalText,
      'Ghi Chú': st.notes || '',
    };
  });
  const wsHk1 = XLSX.utils.json_to_sheet(hk1Rows);
  XLSX.utils.book_append_sheet(wb, wsHk1, 'Học_Kỳ_1');

  // Sheet 2: Học Kỳ 2 (HK2)
  const hk2Rows = classroom.students.map((st, idx) => {
    const hk2 = st.hk2 || {};
    const dtb = computeSemesterDtb(hk2);
    const evalText = hk2.evaluation || (typeof dtb === 'number' ? (dtb >= 8 ? 'Giỏi' : dtb >= 6.5 ? 'Khá' : dtb >= 5 ? 'Đạt' : 'Chưa đạt') : '');
    return {
      'STT': idx + 1,
      'Mã Học Sinh': st.code,
      'Họ và Tên': st.name,
      'Giới Tính': st.gender || '',
      'Ngày Sinh': st.birthDate || '',
      'Tổ / Nhóm': st.group || '',
      'ĐĐGtx 1': hk2.tx1 ?? '',
      'ĐĐGtx 2': hk2.tx2 ?? '',
      'ĐĐGtx 3': hk2.tx3 ?? '',
      'ĐĐGtx 4': hk2.tx4 ?? '',
      'ĐĐGtx 5': hk2.tx5 ?? '',
      'ĐĐGgk (x2)': hk2.gk ?? '',
      'ĐĐGck (x3)': hk2.ck ?? '',
      'ĐTB Môn HKII': dtb,
      'Điểm Thi Đua (+/-)': st.bonusPoints || 0,
      'Kết Quả / Nhận Xét': evalText,
      'Ghi Chú': st.notes || '',
    };
  });
  const wsHk2 = XLSX.utils.json_to_sheet(hk2Rows);
  XLSX.utils.book_append_sheet(wb, wsHk2, 'Học_Kỳ_2');

  // Sheet 3: Tổng Hợp Cả Năm (CN)
  const cnRows = classroom.students.map((st, idx) => {
    const dtb1 = computeSemesterDtb(st.hk1);
    const dtb2 = computeSemesterDtb(st.hk2);
    let cnAvg = st.finalYearAvg;
    if ((cnAvg === null || cnAvg === undefined) && typeof dtb1 === 'number' && typeof dtb2 === 'number') {
      cnAvg = Math.round(((dtb1 + 2 * dtb2) / 3) * 10) / 10;
    }

    let yearEval = st.yearEvaluation;
    if (!yearEval && typeof cnAvg === 'number') {
      if (cnAvg >= 9.0) yearEval = 'Xuất sắc';
      else if (cnAvg >= 8.0) yearEval = 'Giỏi';
      else if (cnAvg >= 6.5) yearEval = 'Khá';
      else if (cnAvg >= 5.0) yearEval = 'Đạt';
      else yearEval = 'Chưa đạt';
    }

    return {
      'STT': idx + 1,
      'Mã Học Sinh': st.code,
      'Họ và Tên': st.name,
      'Giới Tính': st.gender || '',
      'Ngày Sinh': st.birthDate || '',
      'Tổ / Nhóm': st.group || '',
      'ĐTB Học Kỳ I': dtb1,
      'ĐTB Học Kỳ II': dtb2,
      'ĐTB Cả Năm (CN)': cnAvg ?? '',
      'Xếp Loại Cả Năm': yearEval || '',
      'Tổng Điểm Thi Đua': st.bonusPoints || 0,
      'Đánh Giá Chung': st.notes || (typeof cnAvg === 'number' && cnAvg >= 8 ? 'Hoàn thành xuất sắc' : 'Hoàn thành chương trình'),
    };
  });
  const wsCn = XLSX.utils.json_to_sheet(cnRows);
  XLSX.utils.book_append_sheet(wb, wsCn, 'Tổng_Hợp_Cả_Năm');

  // Sheet 4: Tất cả cột tùy chỉnh (nếu có)
  if (classroom.customColumns && classroom.customColumns.length > 0) {
    const customRows = classroom.students.map((st, idx) => {
      const rowObj: Record<string, any> = {
        'STT': idx + 1,
        'Mã Học Sinh': st.code,
        'Họ và Tên': st.name,
      };
      classroom.customColumns!.forEach((col) => {
        rowObj[col] = st.customFields?.[col] ?? '';
      });
      return rowObj;
    });
    const wsCustom = XLSX.utils.json_to_sheet(customRows);
    XLSX.utils.book_append_sheet(wb, wsCustom, 'Cột_Mở_Rộng');
  }

  const filename = `SoDiem_${classroom.name}_HK1_HK2_CaNam_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * 2. Export Quiz Live Analytics to Excel (.xlsx)
 */
export function exportQuizAnalyticsToExcel(roomState: RoomState, lesson: LessonDoc) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Student Ranking
  const studentsMap: Record<string, { name: string; correct: number; total: number; totalTime: number }> = {};
  
  roomState.activeStudents.forEach((st) => {
    studentsMap[st.id] = { name: st.name, correct: 0, total: 0, totalTime: 0 };
  });

  Object.entries(roomState.submissions).forEach(([qId, subs]) => {
    subs.forEach((sub) => {
      if (!studentsMap[sub.studentId]) {
        studentsMap[sub.studentId] = { name: sub.studentName, correct: 0, total: 0, totalTime: 0 };
      }
      studentsMap[sub.studentId].total += 1;
      if (sub.isCorrect) studentsMap[sub.studentId].correct += 1;
      studentsMap[sub.studentId].totalTime += sub.timeSpentSeconds;
    });
  });

  const rankingRows = Object.values(studentsMap)
    .sort((a, b) => b.correct - a.correct || a.totalTime - b.totalTime)
    .map((st, idx) => {
      const pct = st.total > 0 ? Math.round((st.correct / st.total) * 100) : 0;
      return {
        'Hạng': idx + 1,
        'Họ và Tên': st.name,
        'Số Câu Đúng': st.correct,
        'Tổng Số Câu': st.total,
        'Tỉ Lệ Đúng (%)': `${pct}%`,
        'Tổng Thời Gian (giây)': st.totalTime,
        'Xếp Loại': pct >= 80 ? 'Xuất sắc' : pct >= 50 ? 'Đạt' : 'Cần ôn thêm',
      };
    });

  const wsRank = XLSX.utils.json_to_sheet(rankingRows);
  XLSX.utils.book_append_sheet(wb, wsRank, 'Bảng_Xếp_Hạng');

  // Sheet 2: Question Stats
  const questionRows = ((roomState.questions || lesson.quizzes) || []).map((q, idx) => {
    const subs = (roomState.submissions && roomState.submissions[q.id]) || [];
    const correctCount = subs.filter((s) => s.isCorrect).length;
    const totalCount = subs.length;
    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    return {
      'STT Câu': idx + 1,
      'Nội Dung Câu Hỏi': (q.question || '').slice(0, 100),
      'Đáp Án Đúng': q.correctAnswer,
      'Số HS Trả Lời': totalCount,
      'Số HS Đúng': correctCount,
      'Độ Chính Xác (%)': `${accuracy}%`,
    };
  });

  const wsQuestions = XLSX.utils.json_to_sheet(questionRows);
  XLSX.utils.book_append_sheet(wb, wsQuestions, 'Thống_Kê_Từng_Câu');

  const filename = `KetQua_TracNghiem_${lesson.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}

/**
 * 3. Export Lesson / Questions to Word Document (.docx)
 */
export async function exportLessonToWord(lesson: LessonDoc, roomState?: RoomState | null) {
  const questions = (lesson.quizzes && lesson.quizzes.length > 0) ? lesson.quizzes : (roomState?.questions || []);
  
  if (questions.length > 0) {
    const { exportExamToWordDocx } = await import('./docxExportService');
    await exportExamToWordDocx({
      title: lesson.title,
      subject: lesson.subject,
      grade: lesson.grade,
      questions,
      teacherName: lesson.author || 'Tổ Bộ Môn',
    });
    return;
  }

  const createdDate = lesson.lastModified ? lesson.lastModified.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const docContent = lesson.rawText || (lesson.slides ? lesson.slides.map(s => `• ${s.title}: ${s.content}`).join('\n') : 'Chưa có nội dung tóm tắt chi tiết.');

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: lesson.title.toUpperCase(),
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Môn: ${lesson.subject}  |  Khối: ${lesson.grade}  |  Ngày: ${createdDate}`, italics: true }),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            text: 'I. NỘI DUNG TÓM TẮT BÀI GIẢNG',
            heading: HeadingLevel.HEADING_2,
          }),
          new Paragraph({
            text: docContent.slice(0, 2000),
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `GiaoAn_${lesson.title.replace(/\s+/g, '_')}.docx`);
}

/**
 * 4. Export Lesson to PowerPoint Presentation (.pptx)
 */
export async function exportLessonToPowerPoint(lesson: LessonDoc) {
  const pres = new pptxgen();

  // Slide 1: Title Slide
  const slide1 = pres.addSlide();
  slide1.background = { color: '0F172A' };
  slide1.addText(lesson.title, {
    x: 1,
    y: 2,
    w: 8,
    h: 1.5,
    fontSize: 28,
    bold: true,
    color: '38BDF8',
    align: 'center',
  });
  slide1.addText(`Môn: ${lesson.subject} | Khối: ${lesson.grade} | Năm học 2026 - 2027`, {
    x: 1,
    y: 3.8,
    w: 8,
    h: 0.8,
    fontSize: 16,
    color: '94A3B8',
    align: 'center',
  });

  // Slide 2: Lesson Content Summary
  const slide2 = pres.addSlide();
  slide2.addText('TÓM TẮT KIẾN THỨC TRỌNG TÂM', {
    x: 0.8,
    y: 0.6,
    w: 8.4,
    h: 0.6,
    fontSize: 22,
    bold: true,
    color: '1E293B',
  });
  const summaryText = lesson.rawText || (lesson.slides ? lesson.slides.map(s => `${s.title}: ${s.content}`).join('\n') : 'Nội dung bài học');
  slide2.addText(summaryText.slice(0, 500), {
    x: 0.8,
    y: 1.5,
    w: 8.4,
    h: 5.0,
    fontSize: 15,
    color: '334155',
    lineSpacing: 24,
  });

  // Slide 3+: Quiz Questions
  const questions = lesson.quizzes || [];
  questions.forEach((q, idx) => {
    const qSlide = pres.addSlide();
    qSlide.addText(`CÂU HỎI ${idx + 1}`, {
      x: 0.8,
      y: 0.6,
      w: 8.4,
      h: 0.6,
      fontSize: 20,
      bold: true,
      color: '4F46E5',
    });
    qSlide.addText(q.question, {
      x: 0.8,
      y: 1.3,
      w: 8.4,
      h: 1.2,
      fontSize: 16,
      bold: true,
      color: '0F172A',
    });

    const optTexts = q.options.map((opt, oIdx) => `${opt.key || String.fromCharCode(65 + oIdx)}. ${opt.text || opt}`).join('\n\n');
    qSlide.addText(optTexts, {
      x: 0.8,
      y: 2.8,
      w: 8.4,
      h: 2.8,
      fontSize: 15,
      color: '1E293B',
    });
  });

  await pres.writeFile({ fileName: `TrinhChieu_${lesson.title.replace(/\s+/g, '_')}.pptx` });
}

export const exportLessonToPPTX = exportLessonToPowerPoint;

/**
 * 5. Export HTML element / Board to PDF
 */
export async function exportElementToPdf(elementId: string, filename: string) {
  const el = document.getElementById(elementId);
  if (!el) {
    throw new Error(`Không tìm thấy phần tử HTML #${elementId} để xuất PDF`);
  }

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height],
  });

  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(`${filename}.pdf`);
}

export const exportElementToPDF = exportElementToPdf;

/**
 * 6. Export Element to HD Image (.png)
 */
export async function exportElementToHDImage(elementId: string, filename: string) {
  const el = document.getElementById(elementId);
  if (!el) {
    throw new Error(`Không tìm thấy phần tử HTML #${elementId} để xuất ảnh HD`);
  }

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
  });

  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

/**
 * 7. Export Lesson as JSON file
 */
export function exportLessonJSON(lesson: LessonDoc) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(lesson, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `BaiGiang_${lesson.title.replace(/\s+/g, '_')}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * 8. Export/Download Original Uploaded File (Word .docx, PDF, PowerPoint .pptx, Excel .xlsx, Image, etc.)
 * Ensures that whatever file format was uploaded, clicking download gives back the EXACT ORIGINAL FILE
 * with its correct filename and extension, rather than a .json file.
 */
export async function exportOriginalLessonFile(lesson: LessonDoc): Promise<void> {
  // 1. Determine clean original filename
  let filename = lesson.fileName || lesson.title;
  const extMap: Record<string, string> = {
    docx: 'docx',
    pdf: 'pdf',
    pptx: 'pptx',
    xlsx: 'xlsx',
    image: 'png',
    text: 'txt',
  };

  // If filename doesn't include an extension, append according to fileType
  if (!filename.includes('.')) {
    const ext = lesson.fileType ? extMap[lesson.fileType] || 'docx' : 'docx';
    filename = `${filename}.${ext}`;
  }

  // 1. Ưu tiên 1: Tải file nguyên bản từ Cloud Storage (Firestore chunks hoặc IndexedDB)
  // Đảm bảo hoạt động trên mọi điện thoại, máy tính, giữ nguyên 100% byte và dung lượng thực
  const lookupIds = [lesson.id, lesson.fileName, lesson.fileUrl?.replace('firestore://files/', '')].filter(Boolean) as string[];
  for (const lId of lookupIds) {
    try {
      const cloudRes = await fetchFileFromCloudStore(lId);
      if (cloudRes?.blob && cloudRes.blob.size > 0) {
        saveBlobSafely(cloudRes.blob, filename);
        return;
      }
    } catch (_) {}
  }

  // 2. Ưu tiên 2: Tải trực tiếp từ máy chủ (/api/documents/download/...)
  let uploadFilename = '';
  if (lesson.fileUrl) {
    if (lesson.fileUrl.startsWith('/uploads/')) {
      uploadFilename = lesson.fileUrl.replace(/^\/uploads\//, '');
    } else if (lesson.fileUrl.includes('/uploads/')) {
      uploadFilename = lesson.fileUrl.split('/uploads/')[1];
    }
  }

  const candidateServerTargets = [
    uploadFilename,
    lesson.fileName,
    lesson.id,
    filename,
  ].filter(Boolean) as string[];

  for (const target of candidateServerTargets) {
    try {
      const downloadApiUrl = `/api/documents/download/${encodeURIComponent(target)}?name=${encodeURIComponent(filename)}&id=${encodeURIComponent(lesson.id || '')}`;
      const res = await fetch(downloadApiUrl);
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const blob = await res.blob();
          if (blob.size > 0) {
            saveBlobSafely(blob, filename);
            return;
          }
        }
      }
    } catch (_) {}
  }

  // 3. Nếu lesson có fileUrl là HTTP/HTTPS công khai (không phải blob local)
  if (lesson.fileUrl && !lesson.fileUrl.startsWith('blob:') && !lesson.fileUrl.startsWith('firestore:')) {
    try {
      const response = await fetch(lesson.fileUrl);
      if (response.ok) {
        const blob = await response.blob();
        if (blob.size > 0 && !blob.type.includes('json')) {
          saveBlobSafely(blob, filename);
          return;
        }
      }
    } catch (_) {}
  }

  // 4. Nếu là bảng tính Excel (.xls hoặc .xlsx):
  if (lesson.fileType === 'xlsx' || lesson.fileType === 'xls' || filename.endsWith('.xls') || filename.endsWith('.xlsx')) {
    const wb = XLSX.utils.book_new();
    const isXls = filename.endsWith('.xls') || lesson.fileType === 'xls';
    if (lesson.sheetData && lesson.sheetData.sheetNames?.length > 0) {
      lesson.sheetData.sheetNames.forEach((name) => {
        const data = lesson.sheetData!.sheets[name] || [];
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, name);
      });
    } else {
      const cleanTitle = (lesson.title || filename.replace(/\.[^/.]+$/, '')).replace(/_/g, ' ');
      const rows = [
        [cleanTitle.toUpperCase()],
        [`Đồng bộ: ${new Date().toLocaleString('vi-VN')} • Tác giả: ${lesson.author || 'Giáo viên'}`],
        [],
        ['STT', 'Mã', 'Họ và Tên / Nội dung', 'Môn học', 'Ghi chú'],
        [1, 'ITEM01', cleanTitle, lesson.subject || 'Toán học', 'Khả dụng trên điện thoại và máy tính'],
        [2, 'ITEM02', 'Tài liệu: ' + (lesson.fileName || filename), 'Lớp: ' + (lesson.grade || '12'), 'Định dạng ' + (isXls ? 'XLS' : 'XLSX')]
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'So_Diem');
    }
    const wbout = XLSX.write(wb, { bookType: isXls ? 'biff8' : 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: isXls ? 'application/vnd.ms-excel' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveBlobSafely(blob, filename);
    return;
  }

  // 5. Fallback an toàn cho Word, PowerPoint, PDF
  if (lesson.fileType === 'docx' || !lesson.fileType) {
    await exportLessonToWord(lesson);
    return;
  }
  if (lesson.fileType === 'pptx') {
    await exportLessonToPowerPoint(lesson);
    return;
  }
  if (lesson.fileType === 'pdf') {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(lesson.title, 14, 20);
    doc.setFontSize(12);
    const split = doc.splitTextToSize(lesson.rawText || '', 180);
    doc.text(split, 14, 30);
    doc.save(filename);
    return;
  }

  // Cuối cùng: xuất JSON
  exportLessonJSON(lesson);
}

