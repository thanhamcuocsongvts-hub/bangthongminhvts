import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { QuizQuestion } from '../types';

/**
 * Parses raw text containing multiple-choice questions in Vietnamese standard format:
 * Câu 1: ...
 * A. ...
 * B. ...
 * C. ...
 * D. ...
 * Đáp án: A
 * Lời giải: ...
 */
export function parseQuestionsFromRawText(text: string): QuizQuestion[] {
  if (!text || !text.trim()) return [];

  const questions: QuizQuestion[] = [];
  // Split by "Câu 1:", "Câu 2.", "Bài 1:", "Question 1:" or double newlines with question identifiers
  const blocks = text.split(/(?:^|\n+)(?=(?:Câu|Bài|Question)\s*\d+[\.:\s])/i);

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    // Extract Question text
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    let questionTitle = '';
    let optA = '';
    let optB = '';
    let optC = '';
    let optD = '';
    let correctAnswer: 'A' | 'B' | 'C' | 'D' = 'A';
    let explanation = '';

    // Check lines
    let collecting = 'question';

    for (const line of lines) {
      // Check for Option A
      if (/^[A|a][\.:\)\s]\s*(.*)/.test(line)) {
        collecting = 'A';
        optA = line.replace(/^[A|a][\.:\)\s]\s*/, '').trim();
      } else if (/^[B|b][\.:\)\s]\s*(.*)/.test(line)) {
        collecting = 'B';
        optB = line.replace(/^[B|b][\.:\)\s]\s*/, '').trim();
      } else if (/^[C|c][\.:\)\s]\s*(.*)/.test(line)) {
        collecting = 'C';
        optC = line.replace(/^[C|c][\.:\)\s]\s*/, '').trim();
      } else if (/^[D|d][\.:\)\s]\s*(.*)/.test(line)) {
        collecting = 'D';
        optD = line.replace(/^[D|d][\.:\)\s]\s*/, '').trim();
      } else if (/(?:Đáp\s*án|Đ\/A|Key|Correct\s*Answer)[\.:\s]*([A-D])/i.test(line)) {
        const match = line.match(/(?:Đáp\s*án|Đ\/A|Key|Correct\s*Answer)[\.:\s]*([A-D])/i);
        if (match && match[1]) {
          correctAnswer = match[1].toUpperCase() as any;
        }
      } else if (/(?:Lời\s*giải|Hướng\s*dẫn|Giải\s*thích|Explanation)[\.:\s]*(.*)/i.test(line)) {
        collecting = 'explanation';
        explanation = line.replace(/(?:Lời\s*giải|Hướng\s*dẫn|Giải\s*thích|Explanation)[\.:\s]*/i, '').trim();
      } else {
        if (collecting === 'question') {
          questionTitle = (questionTitle ? questionTitle + ' ' : '') + line;
        } else if (collecting === 'A') {
          optA += ' ' + line;
        } else if (collecting === 'B') {
          optB += ' ' + line;
        } else if (collecting === 'C') {
          optC += ' ' + line;
        } else if (collecting === 'D') {
          optD += ' ' + line;
        } else if (collecting === 'explanation') {
          explanation += ' ' + line;
        }
      }
    }

    // Clean question title: remove leading "Câu 1:", "Bài 1."
    questionTitle = questionTitle.replace(/^(?:Câu|Bài|Question)\s*\d+[\.:\s]*/i, '').trim();

    if (questionTitle && (optA || optB || optC || optD)) {
      questions.push({
        id: `file_q_${Date.now()}_${i + 1}`,
        question: questionTitle,
        options: [
          { key: 'A', text: optA || 'Đáp án A' },
          { key: 'B', text: optB || 'Đáp án B' },
          { key: 'C', text: optC || 'Đáp án C' },
          { key: 'D', text: optD || 'Đáp án D' },
        ],
        correctAnswer,
        explanation: explanation || 'Lời giải chi tiết theo đề bài.',
        timeLimit: 30,
        difficulty: 'Thông hiểu',
      });
    }
  }

  return questions;
}

/**
 * Parse an uploaded file (.docx, .xlsx, .xls, .csv, .txt, .json) into QuizQuestion[]
 */
export async function parseQuizFromFile(file: File): Promise<QuizQuestion[]> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  // 1. JSON file
  if (ext === 'json') {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item, idx) => ({
          id: item.id || `json_q_${Date.now()}_${idx + 1}`,
          question: item.question || item.content || 'Câu hỏi',
          options: item.options || [
            { key: 'A', text: item.a || item.A || 'A' },
            { key: 'B', text: item.b || item.B || 'B' },
            { key: 'C', text: item.c || item.C || 'C' },
            { key: 'D', text: item.d || item.D || 'D' },
          ],
          correctAnswer: (item.correctAnswer || item.answer || item.key || 'A').toUpperCase() as any,
          explanation: item.explanation || item.explain || '',
          timeLimit: item.timeLimit || 30,
          difficulty: item.difficulty || 'Thông hiểu',
        }));
      } else if (parsed.questions && Array.isArray(parsed.questions)) {
        return parseQuizFromFile(new File([JSON.stringify(parsed.questions)], 'questions.json'));
      }
    } catch (e) {
      console.error('JSON parse error:', e);
    }
  }

  // 2. Excel file (.xlsx, .xls, .csv)
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (rows && rows.length > 0) {
      const questions: QuizQuestion[] = [];
      const startIdx = rows[0]?.some((cell: any) =>
        typeof cell === 'string' && /câu\s*hỏi|question|đáp\s*án/i.test(cell)
      )
        ? 1
        : 0;

      for (let i = startIdx; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 5) continue;

        const qText = String(row[0] || '').trim();
        if (!qText) continue;

        const optA = String(row[1] || '').trim();
        const optB = String(row[2] || '').trim();
        const optC = String(row[3] || '').trim();
        const optD = String(row[4] || '').trim();
        let rawAnswer = String(row[5] || 'A').trim().toUpperCase();
        if (!['A', 'B', 'C', 'D'].includes(rawAnswer)) rawAnswer = 'A';
        const expl = String(row[6] || '').trim();

        questions.push({
          id: `excel_q_${Date.now()}_${i + 1}`,
          question: qText.replace(/^(?:Câu|Bài)\s*\d+[\.:\s]*/i, ''),
          options: [
            { key: 'A', text: optA || 'Đáp án A' },
            { key: 'B', text: optB || 'Đáp án B' },
            { key: 'C', text: optC || 'Đáp án C' },
            { key: 'D', text: optD || 'Đáp án D' },
          ],
          correctAnswer: rawAnswer as 'A' | 'B' | 'C' | 'D',
          explanation: expl || 'Đáp án chính xác.',
          timeLimit: 30,
          difficulty: 'Thông hiểu',
        });
      }

      if (questions.length > 0) return questions;
    }
  }

  // 3. Word document (.docx)
  if (ext === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value;
    const parsed = parseQuestionsFromRawText(text);
    if (parsed.length > 0) return parsed;
  }

  // 4. Plain text or fallback
  const text = await file.text();
  return parseQuestionsFromRawText(text);
}
