import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Users,
  Trash2,
  Plus,
  Loader2,
  FileUp,
  ClipboardPaste,
  Columns,
  Table as TableIcon,
  HelpCircle,
  Eye,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { ClassStudent, ClassRoom, SubjectType } from '../types';

interface ImportStudentsModalProps {
  isOpen?: boolean;
  classRoom?: ClassRoom | null;
  targetClassName?: string;
  onClose: () => void;
  onImportStudents: (
    students: ClassStudent[],
    newClassName?: string,
    customColumns?: string[],
    replaceExisting?: boolean
  ) => void;
}

interface ParsedStudentRow {
  code: string;
  name: string;
  gender?: string;
  birthDate?: string;
  group?: string;
  tx1?: number | null;
  tx2?: number | null;
  tx3?: number | null;
  tx4?: number | null;
  tx5?: number | null;
  gk?: number | null;
  ck?: number | null;
  dtb?: number | null;
  evaluation?: string;
  hk1Dtb?: number | null;
  hk2Dtb?: number | null;
  cnDtb?: number | null;
  oralScore?: number | null;
  test15mScore?: number | null;
  test1PeriodScore?: number | null;
  finalScore?: number | null;
  bonusPoints?: number;
  notes?: string;
  customFields?: Record<string, string | number | null | undefined>;
}

export const ImportStudentsModal: React.FC<ImportStudentsModalProps> = ({
  isOpen = true,
  classRoom,
  targetClassName,
  onClose,
  onImportStudents,
}) => {
  if (isOpen === false) return null;

  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'preview'>('upload');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Extracted Data
  const [extractedStudents, setExtractedStudents] = useState<ParsedStudentRow[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [detectedClassName, setDetectedClassName] = useState<string>('');

  // Target Class Configuration
  const [targetMode, setTargetMode] = useState<'current' | 'new'>(
    classRoom ? 'current' : 'new'
  );
  const [customClassName, setCustomClassName] = useState<string>(
    targetClassName || classRoom?.name || '10A1'
  );
  const [replaceExisting, setReplaceExisting] = useState<boolean>(false);

  // Direct Paste textarea
  const [pastedText, setPastedText] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Helper to parse score numbers (e.g. "8.5" or "8,5" or 9)
  const parseScoreValue = (val: any): number | null => {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') {
      return val >= 0 && val <= 10 ? val : null;
    }
    if (typeof val === 'string') {
      const normalized = val.trim().replace(',', '.');
      const num = parseFloat(normalized);
      if (!isNaN(num) && num >= 0 && num <= 10) {
        return num;
      }
    }
    return null;
  };

  // Helper to clean student name
  const cleanName = (val: any): string => {
    if (!val) return '';
    return String(val)
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^[0-9.\-_#\s]+/, ''); // remove leading index numbers like "1. " or "01 - "
  };

  // Process raw 2D array (from Excel, CSV, TSV) into structured students and detect all columns
  const process2DDataMatrix = (matrix: any[][], sourceFileName?: string) => {
    if (!matrix || matrix.length === 0) {
      throw new Error('Tệp không có dữ liệu');
    }

    // 1. Detect Class Name from early title lines (e.g. "LỚP 10A1" or "BẢNG ĐIỂM LỚP 12B3")
    let foundClassName = '';
    for (let i = 0; i < Math.min(6, matrix.length); i++) {
      const lineStr = (matrix[i] || []).join(' ');
      const match = lineStr.match(/l[ớo]p\s*([0-9]{1,2}[A-Za-z0-9_-]{1,6})/i);
      if (match && match[1]) {
        foundClassName = match[1].toUpperCase();
        break;
      }
    }
    if (!foundClassName && sourceFileName) {
      const match = sourceFileName.match(/([0-9]{1,2}[A-Za-z0-9_-]{1,6})/i);
      if (match && match[1]) {
        foundClassName = match[1].toUpperCase();
      }
    }
    if (foundClassName) {
      setDetectedClassName(foundClassName);
      setCustomClassName(foundClassName);
    }

    // 2. Find the Header Row (search first 12 rows for keywords)
    let headerRowIndex = 0;
    let maxKeywordScore = -1;

    const keywords = [
      'stt', 'mã', 'họ', 'tên', 'họ và tên', 'họ tên', 'giới tính', 'phái',
      'ngày sinh', 'năm sinh', 'tổ', 'nhóm', 'miệng', 'ktm', '15p', '15 phút',
      '1 tiết', 'giữa kỳ', 'giữa kì', 'cuối kỳ', 'cuối kì', 'học kỳ', 'học kì',
      'điểm', 'tb', 'đtb', 'thi đua', 'cộng', 'ghi chú', 'nhận xét', 'sđt'
    ];

    for (let r = 0; r < Math.min(12, matrix.length); r++) {
      const row = matrix[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      let score = 0;
      row.forEach((cell) => {
        if (typeof cell === 'string') {
          const lower = cell.toLowerCase().trim();
          keywords.forEach((kw) => {
            if (lower.includes(kw)) score += 2;
          });
        }
      });

      if (score > maxKeywordScore && score >= 2) {
        maxKeywordScore = score;
        headerRowIndex = r;
      }
    }

    // If no explicit keyword header found, pick the first row with >= 2 non-empty text cells
    if (maxKeywordScore <= 0) {
      for (let r = 0; r < Math.min(5, matrix.length); r++) {
        const nonEmpties = (matrix[r] || []).filter((c) => c !== null && c !== undefined && String(c).trim() !== '');
        if (nonEmpties.length >= 2) {
          headerRowIndex = r;
          break;
        }
      }
    }

    const headerRow = matrix[headerRowIndex] || [];
    const allHeaders: string[] = [];

    // Map each column index to a field role
    const columnMap: Record<
      number,
      {
        headerName: string;
        role:
          | 'stt'
          | 'code'
          | 'name'
          | 'lastName'
          | 'firstName'
          | 'gender'
          | 'birthDate'
          | 'group'
          | 'tx1'
          | 'tx2'
          | 'tx3'
          | 'tx4'
          | 'tx5'
          | 'gk'
          | 'ck'
          | 'dtb'
          | 'evaluation'
          | 'hk1'
          | 'hk2'
          | 'cn'
          | 'oralScore'
          | 'test15mScore'
          | 'test1PeriodScore'
          | 'finalScore'
          | 'bonusPoints'
          | 'notes'
          | 'custom';
      }
    > = {};

    // First pass: identify all headers
    headerRow.forEach((cellVal, colIdx) => {
      let colName = cellVal ? String(cellVal).trim() : `Cột ${colIdx + 1}`;
      if (!colName) colName = `Cột ${colIdx + 1}`;
      allHeaders.push(colName);

      const lower = colName.toLowerCase();

      let role: any = 'custom';

      if (/^(stt|số tt|no\.?|tt)$/i.test(lower)) {
        role = 'stt';
      } else if (
        /mã\s*(hs|học sinh|định danh|số)?/i.test(lower) ||
        /^(code|id|sbd|số báo danh)$/i.test(lower)
      ) {
        role = 'code';
      } else if (
        /họ\s*(đệm|lót|và tên đệm|và tên lót|và chữ đệm|và đệm)/i.test(lower) ||
        lower === 'họ' ||
        lower === 'họ đệm' ||
        lower === 'họ và đệm'
      ) {
        role = 'lastName';
      } else if (
        /^tên(\s*học sinh|\s*hs)?$/i.test(lower) ||
        lower === 'tên' ||
        lower === 'ten' ||
        lower === 'first name' ||
        lower === 'firstname'
      ) {
        role = 'firstName';
      } else if (
        /họ\s*(và|&)?\s*tên/i.test(lower)
      ) {
        role = 'name';
      } else if (/giới\s*tính|phái|nam\/?nữ|gender/i.test(lower)) {
        role = 'gender';
      } else if (/ngày\s*sinh|năm\s*sinh|sinh\s*ngày|dob|birth/i.test(lower)) {
        role = 'birthDate';
      } else if (/^tổ(\s*\/|\s*nhóm)?$|^nhóm$/i.test(lower)) {
        role = 'group';
      } else if (/^(tx1|tx\.1|đđgtx1|đđgtx\s*1|tx\s*1)$/i.test(lower)) {
        role = 'tx1';
      } else if (/^(tx2|tx\.2|đđgtx2|đđgtx\s*2|tx\s*2)$/i.test(lower)) {
        role = 'tx2';
      } else if (/^(tx3|tx\.3|đđgtx3|đđgtx\s*3|tx\s*3)$/i.test(lower)) {
        role = 'tx3';
      } else if (/^(tx4|tx\.4|đđgtx4|đđgtx\s*4|tx\s*4)$/i.test(lower)) {
        role = 'tx4';
      } else if (/^(tx5|tx\.5|đđgtx5|đđgtx\s*5|tx\s*5)$/i.test(lower)) {
        role = 'tx5';
      } else if (/^(đđggk|gk|giữa\s*kỳ|giữa\s*kì|định\s*kỳ|kt\s*giữa\s*kỳ)$/i.test(lower)) {
        role = 'gk';
      } else if (/^(đđgck|ck|cuối\s*kỳ|cuối\s*kì|thi\s*hk|thi\s*cuối\s*kỳ|điểm\s*thi)$/i.test(lower)) {
        role = 'ck';
      } else if (/^(dtbmhk|đtb\s*mhk|đtb\s*môn|đtbm|dtb)$/i.test(lower)) {
        role = 'dtb';
      } else if (/^(hki|hk1|học\s*kỳ\s*1|học\s*kì\s*1|đtb\s*hk1|đtb\s*hki)$/i.test(lower)) {
        role = 'hk1';
      } else if (/^(hkii|hk2|học\s*kỳ\s*2|học\s*kì\s*2|đtb\s*hk2|đtb\s*hkii)$/i.test(lower)) {
        role = 'hk2';
      } else if (/^(cn|cả\s*năm|đtb\s*cn|đtb\s*cả\s*năm|tb\s*cả\s*năm)$/i.test(lower)) {
        role = 'cn';
      } else if (
        /miệng|ktm|oral|kiểm tra miệng/i.test(lower) &&
        !lower.includes('15') &&
        !lower.includes('tiết')
      ) {
        role = 'oralScore';
      } else if (
        /15\s*(p|phút)|kt\s*15|15'/i.test(lower)
      ) {
        role = 'test15mScore';
      } else if (
        /1\s*tiết|45\s*(p|phút)|kt\s*45/i.test(lower)
      ) {
        role = 'test1PeriodScore';
      } else if (
        /cuối\s*(kỳ|kì)/i.test(lower)
      ) {
        role = 'finalScore';
      } else if (
        /thi\s*đua|cộng|thưởng|điểm\s*rèn\s*luyện/i.test(lower)
      ) {
        role = 'bonusPoints';
      } else if (
        /nhận\s*xét|đánh\s*giá|xếp\s*loại|kết\s*quả/i.test(lower)
      ) {
        role = 'evaluation';
      } else if (
        /ghi\s*chú|hạnh\s*kiểm|học\s*lực/i.test(lower)
      ) {
        role = 'notes';
      }

      columnMap[colIdx] = { headerName: colName, role };
    });

    // Check adjacent column after 'name' or 'lastName' to see if it represents 'firstName' (Tên)
    // Common in Vietnamese Excel: Col 3 = "Họ và tên" (e.g. Lê Thị Ngọc), Col 4 = "Tên" or "Cột 4" (e.g. Anh)
    Object.keys(columnMap).forEach((colIdxStr) => {
      const idx = parseInt(colIdxStr, 10);
      const cur = columnMap[idx];
      const next = columnMap[idx + 1];
      if (cur && (cur.role === 'name' || cur.role === 'lastName') && next && next.role === 'custom') {
        // Sample next column values to see if they are 1-word Vietnamese names
        let singleWordCount = 0;
        let totalSampled = 0;
        for (let r = headerRowIndex + 1; r < Math.min(headerRowIndex + 12, matrix.length); r++) {
          const val = matrix[r]?.[idx + 1];
          if (val !== null && val !== undefined && String(val).trim()) {
            totalSampled++;
            const str = String(val).trim();
            if (!str.includes(' ') && str.length >= 1 && str.length <= 15 && !/^\d+$/.test(str)) {
              singleWordCount++;
            }
          }
        }
        if (totalSampled > 0 && singleWordCount / totalSampled >= 0.7) {
          // This column is definitely the first name (Tên)
          next.role = 'firstName';
        }
      }
    });

    // Extract student rows
    const parsedRows: ParsedStudentRow[] = [];

    for (let r = headerRowIndex + 1; r < matrix.length; r++) {
      const row = matrix[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      // Skip summary / signature rows
      const rowStr = row.join(' ').toLowerCase();
      if (
        rowStr.includes('tổng cộng') ||
        rowStr.includes('trung bình chung') ||
        rowStr.includes('giáo viên chủ nhiệm') ||
        rowStr.includes('chữ ký') ||
        rowStr.includes('ban giám hiệu')
      ) {
        continue;
      }

      let code = '';
      let fullName = '';
      let lastName = '';
      let firstName = '';
      let gender = '';
      let birthDate = '';
      let group = '';
      let tx1: number | null = null;
      let tx2: number | null = null;
      let tx3: number | null = null;
      let tx4: number | null = null;
      let tx5: number | null = null;
      let gk: number | null = null;
      let ck: number | null = null;
      let dtb: number | null = null;
      let evaluation = '';
      let hk1Dtb: number | null = null;
      let hk2Dtb: number | null = null;
      let cnDtb: number | null = null;
      let oralScore: number | null = null;
      let test15mScore: number | null = null;
      let test1PeriodScore: number | null = null;
      let finalScore: number | null = null;
      let bonusPoints: number | undefined = undefined;
      let notes = '';
      const customFields: Record<string, any> = {};

      row.forEach((cellVal, colIdx) => {
        if (cellVal === null || cellVal === undefined) return;
        const mapping = columnMap[colIdx];
        const valStr = String(cellVal).trim();
        if (!valStr) return;

        if (mapping) {
          switch (mapping.role) {
            case 'code':
              code = valStr;
              break;
            case 'name':
              fullName = valStr;
              break;
            case 'lastName':
              lastName = valStr;
              break;
            case 'firstName':
              firstName = valStr;
              break;
            case 'gender':
              gender = /^(nữ|nu|female|f)$/i.test(valStr)
                ? 'Nữ'
                : /^(nam|male|m)$/i.test(valStr)
                ? 'Nam'
                : valStr;
              break;
            case 'birthDate':
              birthDate = valStr;
              break;
            case 'group':
              group = valStr.startsWith('Tổ') ? valStr : `Tổ ${valStr}`;
              break;
            case 'tx1':
              tx1 = parseScoreValue(cellVal);
              break;
            case 'tx2':
              tx2 = parseScoreValue(cellVal);
              break;
            case 'tx3':
              tx3 = parseScoreValue(cellVal);
              break;
            case 'tx4':
              tx4 = parseScoreValue(cellVal);
              break;
            case 'tx5':
              tx5 = parseScoreValue(cellVal);
              break;
            case 'gk':
              gk = parseScoreValue(cellVal);
              break;
            case 'ck':
              ck = parseScoreValue(cellVal);
              break;
            case 'dtb':
              dtb = parseScoreValue(cellVal);
              break;
            case 'hk1':
              hk1Dtb = parseScoreValue(cellVal);
              break;
            case 'hk2':
              hk2Dtb = parseScoreValue(cellVal);
              break;
            case 'cn':
              cnDtb = parseScoreValue(cellVal);
              break;
            case 'evaluation':
              evaluation = valStr;
              break;
            case 'oralScore':
              oralScore = parseScoreValue(cellVal);
              break;
            case 'test15mScore':
              test15mScore = parseScoreValue(cellVal);
              break;
            case 'test1PeriodScore':
              test1PeriodScore = parseScoreValue(cellVal);
              break;
            case 'finalScore':
              finalScore = parseScoreValue(cellVal);
              break;
            case 'bonusPoints': {
              const num = parseFloat(valStr.replace(',', '.'));
              if (!isNaN(num)) bonusPoints = num;
              break;
            }
            case 'notes':
              notes = valStr;
              break;
            case 'custom':
              customFields[mapping.headerName] = cellVal;
              break;
            default:
              break;
          }
        }
      });

      // Assemble full student name (combine Họ đệm + Tên)
      let finalName = '';
      if (fullName && firstName) {
        finalName = cleanName(`${fullName} ${firstName}`);
      } else if (lastName && firstName) {
        finalName = cleanName(`${lastName} ${firstName}`);
      } else if (fullName) {
        finalName = cleanName(fullName);
      } else if (lastName) {
        finalName = cleanName(lastName);
      } else if (firstName) {
        finalName = cleanName(firstName);
      }

      // Check if customFields has a column holding first name (e.g., 'Cột 4' or 'Tên')
      Object.keys(customFields).forEach((ck) => {
        const val = String(customFields[ck] || '').trim();
        const lowerHeader = ck.toLowerCase();
        if (
          (lowerHeader.includes('tên') || lowerHeader.includes('cột') || lowerHeader.includes('column')) &&
          val &&
          !val.includes(' ') &&
          val.length >= 1 &&
          val.length <= 15 &&
          !/^\d+$/.test(val)
        ) {
          // If finalName does not already end with this first name
          if (finalName && !finalName.toLowerCase().endsWith(val.toLowerCase())) {
            finalName = cleanName(`${finalName} ${val}`);
            delete customFields[ck];
          }
        }
      });

      // If still no name, find any cell in row that looks like a Vietnamese name
      if (!finalName) {
        for (let colIdx = 0; colIdx < row.length; colIdx++) {
          const cell = row[colIdx];
          if (typeof cell === 'string') {
            const trimmed = cleanName(cell);
            if (
              trimmed.length >= 3 &&
              !/^\d+$/.test(trimmed) &&
              !/^(nam|nữ|tốt|khá|giỏi)$/i.test(trimmed) &&
              trimmed.includes(' ')
            ) {
              finalName = trimmed;
              break;
            }
          }
        }
      }

      if (finalName && finalName.length >= 2) {
        // Calculate semester 1 DTB if components are provided
        const txScores = [tx1, tx2, tx3, tx4, tx5].filter((s): s is number => typeof s === 'number' && !isNaN(s));
        let semesterDtb = dtb;
        if (semesterDtb === null && (txScores.length > 0 || gk !== null || ck !== null)) {
          let sum = txScores.reduce((a, b) => a + b, 0);
          let weights = txScores.length;
          if (gk !== null && typeof gk === 'number') {
            sum += gk * 2;
            weights += 2;
          }
          if (ck !== null && typeof ck === 'number') {
            sum += ck * 3;
            weights += 3;
          }
          if (weights > 0) {
            semesterDtb = Math.round((sum / weights) * 10) / 10;
          }
        }

        // Auto evaluate
        let autoEval = evaluation;
        if (!autoEval && typeof semesterDtb === 'number') {
          if (semesterDtb >= 9.0) autoEval = 'Xuất sắc';
          else if (semesterDtb >= 8.0) autoEval = 'Giỏi';
          else if (semesterDtb >= 6.5) autoEval = 'Khá';
          else if (semesterDtb >= 5.0) autoEval = 'Đạt';
          else autoEval = 'Chưa đạt';
        }

        // Calculate final year avg if HK1 and HK2 are known
        let yearAvg = cnDtb;
        if (yearAvg === null && typeof hk1Dtb === 'number' && typeof hk2Dtb === 'number') {
          yearAvg = Math.round(((hk1Dtb + 2 * hk2Dtb) / 3) * 10) / 10;
        }

        parsedRows.push({
          code: code || `HS${1000 + parsedRows.length + 1}`,
          name: finalName,
          gender: gender || undefined,
          birthDate: birthDate || undefined,
          group: group || undefined,
          tx1,
          tx2,
          tx3,
          tx4,
          tx5,
          gk,
          ck,
          dtb: semesterDtb,
          evaluation: autoEval || undefined,
          hk1Dtb: hk1Dtb ?? semesterDtb,
          hk2Dtb,
          cnDtb: yearAvg,
          oralScore: oralScore ?? tx1 ?? (txScores[0] ?? null),
          test15mScore: test15mScore ?? tx2 ?? (txScores[1] ?? null),
          test1PeriodScore: test1PeriodScore ?? gk,
          finalScore: finalScore ?? ck,
          bonusPoints,
          notes: notes || undefined,
          customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
        });
      }
    }

    if (parsedRows.length === 0) {
      throw new Error('Không trích xuất được học sinh nào từ cấu trúc bảng.');
    }

    setDetectedColumns(allHeaders);
    setExtractedStudents(parsedRows);
    setActiveTab('preview');
  };

  // Process Excel Files (.xlsx, .xls, .csv)
  const handleProcessExcel = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawJson: any[][] = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        blankrows: false,
      });

      process2DDataMatrix(rawJson, file.name || firstSheetName);
    } catch (err: any) {
      console.error('Excel parse error:', err);
      // Fallback to text reading and AI parsing
      try {
        const text = await file.text();
        await callAIParsing({ rawText: text });
      } catch (e: any) {
        setErrorMessage('Không thể đọc file Excel: ' + (err.message || 'Lỗi không xác định'));
      }
    }
  };

  // Handle Pasted TSV / CSV / Text Lines
  const handleProcessPastedText = () => {
    if (!pastedText.trim()) {
      setErrorMessage('Vui lòng dán nội dung bảng danh sách hoặc văn bản vào ô');
      return;
    }

    try {
      const lines = pastedText.trim().split(/\r?\n/);
      const matrix: string[][] = lines.map((line) => {
        if (line.includes('\t')) return line.split('\t');
        if (line.includes(';') && !line.includes(',')) return line.split(';');
        if (line.includes('|')) return line.split('|').map((s) => s.trim());
        if (line.includes(',') && line.split(',').length >= 3) return line.split(',').map((s) => s.trim());
        return [line.trim()];
      });

      // If matrix is just 1 column with names, use heuristic
      if (matrix.every((r) => r.length <= 1)) {
        const students: ParsedStudentRow[] = [];
        matrix.forEach((r, idx) => {
          const name = cleanName(r[0]);
          if (name && name.length >= 2) {
            students.push({
              code: `HS${1000 + idx + 1}`,
              name,
            });
          }
        });
        if (students.length > 0) {
          setDetectedColumns(['STT', 'Mã HS', 'Họ và Tên']);
          setExtractedStudents(students);
          setActiveTab('preview');
          return;
        }
      }

      process2DDataMatrix(matrix, 'Dữ liệu dán');
    } catch (err: any) {
      console.error('Paste parse error:', err);
      // Fallback to AI
      callAIParsing({ rawText: pastedText });
    }
  };

  // Call Server AI to parse Students from Image, PDF, or Word Text
  const callAIParsing = async (payload: {
    rawText?: string;
    imageBase64?: string;
    mimeType?: string;
  }) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/ai/parse-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error('Máy chủ AI không phản hồi');
      }

      const data = await res.json();
      const list: ParsedStudentRow[] = data.students || [];

      if (list.length > 0) {
        if (data.className) {
          setDetectedClassName(data.className);
          setCustomClassName(data.className);
        }
        if (data.columns && data.columns.length > 0) {
          setDetectedColumns(data.columns);
        } else {
          setDetectedColumns([
            'STT',
            'Mã HS',
            'Họ và Tên',
            'Giới tính',
            'Ngày sinh',
            'Tổ',
            'Điểm Miệng',
            'Điểm 15P',
            'Điểm 1 Tiết',
            'Điểm Cuối Kỳ',
            'Ghi Chú',
          ]);
        }
        setExtractedStudents(list);
        setActiveTab('preview');
      } else {
        setErrorMessage(
          'AI không tìm thấy học sinh nào trong tệp này. Vui lòng thử tệp khác hoặc kiểm tra lại định dạng.'
        );
      }
    } catch (err: any) {
      console.error('AI parse students error:', err);
      setErrorMessage('Lỗi nhận diện bằng AI: ' + (err.message || 'Vui lòng thử lại'));
    } finally {
      setIsLoading(false);
    }
  };

  // Handle File Change / Drop
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setFileName(file.name);
    setErrorMessage(null);
    setIsLoading(true);

    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    try {
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv' || ext === 'tsv') {
        await handleProcessExcel(file);
      } else if (ext === 'docx') {
        // High-Speed Local Word Extraction
        const arrayBuffer = await file.arrayBuffer();
        const [textResult, htmlResult] = await Promise.all([
          mammoth.extractRawText({ arrayBuffer }),
          mammoth.convertToHtml({ arrayBuffer }),
        ]);

        let parsedLocally = false;
        // Check if Word contains an HTML table
        if (htmlResult.value && htmlResult.value.includes('<table')) {
          try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlResult.value, 'text/html');
            const tables = Array.from(doc.querySelectorAll('table'));
            if (tables.length > 0) {
              const longestTable = tables.reduce((prev, curr) =>
                curr.querySelectorAll('tr').length > prev.querySelectorAll('tr').length ? curr : prev
              );
              const rows = Array.from(longestTable.querySelectorAll('tr'));
              const matrix: string[][] = rows.map((tr) =>
                Array.from(tr.querySelectorAll('th, td')).map((cell) => cell.textContent?.trim() || '')
              );
              if (matrix.length >= 2) {
                process2DDataMatrix(matrix, file.name);
                parsedLocally = true;
              }
            }
          } catch (localTableErr) {
            console.warn('Word table parse fallback:', localTableErr);
          }
        }

        // If no table or table parsing failed, check line by line in raw text
        if (!parsedLocally && textResult.value) {
          const rawLines = textResult.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          const studentCandidates: ParsedStudentRow[] = [];
          
          rawLines.forEach((line, idx) => {
            const parts = line.split(/\t|\s{2,}/).map((p) => p.trim()).filter(Boolean);
            if (parts.length >= 2) {
              const nameCandidate = cleanName(parts[1] || parts[0]);
              if (nameCandidate && nameCandidate.length >= 3 && !/^(stt|mã|họ|tên|ngày|điểm)/i.test(nameCandidate)) {
                studentCandidates.push({
                  code: `HS${1000 + studentCandidates.length + 1}`,
                  name: nameCandidate,
                  gender: parts.find((p) => /^(nam|nữ|nu)$/i.test(p)) || undefined,
                  birthDate: parts.find((p) => /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(p)) || undefined,
                });
              }
            } else if (line.length >= 4 && !/^(lớp|trường|danh sách|bảng điểm|môn)/i.test(line)) {
              const cleaned = cleanName(line);
              if (cleaned.length >= 3 && cleaned.includes(' ')) {
                studentCandidates.push({
                  code: `HS${1000 + studentCandidates.length + 1}`,
                  name: cleaned,
                });
              }
            }
          });

          if (studentCandidates.length >= 3) {
            setDetectedColumns(['STT', 'Mã HS', 'Họ và Tên', 'Giới tính', 'Ngày sinh']);
            setExtractedStudents(studentCandidates);
            setActiveTab('preview');
            parsedLocally = true;
          }
        }

        if (!parsedLocally) {
          // Fallback to Gemini Server Parsing
          await callAIParsing({ rawText: (textResult.value || '').slice(0, 25000) });
        }
      } else if (file.type.startsWith('image/')) {
        // Image file: Convert to Base64 and send to Gemini Vision
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result as string;
          await callAIParsing({
            imageBase64: base64,
            mimeType: file.type || 'image/jpeg',
          });
        };
        reader.readAsDataURL(file);
      } else {
        // Text / TXT / MD / CSV
        const text = await file.text();
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const matrix = lines.map((l) => {
          if (l.includes('\t')) return l.split('\t');
          if (l.includes(',') && l.split(',').length >= 3) return l.split(',');
          if (l.includes(';') && l.split(';').length >= 3) return l.split(';');
          return [l];
        });

        if (matrix.length > 2 && matrix.some((r) => r.length >= 2)) {
          process2DDataMatrix(matrix, file.name);
        } else {
          await callAIParsing({ rawText: text.slice(0, 25000) });
        }
      }
    } catch (err: any) {
      console.error('File load error:', err);
      setErrorMessage('Không thể đọc file: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Confirm Import into Gradebook
  const handleConfirmImport = () => {
    if (extractedStudents.length === 0) return;

    const students: ClassStudent[] = extractedStudents.map((st, idx) => {
      // Build HK1
      const hk1Detail = {
        tx1: st.tx1 ?? st.oralScore ?? null,
        tx2: st.tx2 ?? st.test15mScore ?? null,
        tx3: st.tx3 ?? null,
        tx4: st.tx4 ?? null,
        tx5: st.tx5 ?? null,
        gk: st.gk ?? st.test1PeriodScore ?? null,
        ck: st.ck ?? st.finalScore ?? null,
        dtb: st.dtb ?? st.hk1Dtb ?? null,
        evaluation: st.evaluation || (st.dtb && st.dtb >= 8 ? 'Giỏi' : st.dtb && st.dtb >= 6.5 ? 'Khá' : 'Đạt'),
      };

      // Build HK2 (if provided or empty ready for input)
      const hk2Detail = {
        tx1: null,
        tx2: null,
        tx3: null,
        tx4: null,
        tx5: null,
        gk: null,
        ck: null,
        dtb: st.hk2Dtb ?? null,
        evaluation: undefined,
      };

      let finalYearAvg = st.cnDtb ?? null;
      if (finalYearAvg === null && hk1Detail.dtb !== null && hk2Detail.dtb !== null) {
        finalYearAvg = Math.round(((hk1Detail.dtb + 2 * hk2Detail.dtb) / 3) * 10) / 10;
      }

      let yearEval = undefined;
      if (finalYearAvg !== null) {
        if (finalYearAvg >= 9.0) yearEval = 'Xuất sắc';
        else if (finalYearAvg >= 8.0) yearEval = 'Giỏi';
        else if (finalYearAvg >= 6.5) yearEval = 'Khá';
        else if (finalYearAvg >= 5.0) yearEval = 'Đạt';
        else yearEval = 'Chưa đạt';
      }

      return {
        id: 'st_' + Date.now() + '_' + idx,
        code: st.code || `HS${1000 + idx + 1}`,
        name: st.name.trim(),
        gender: st.gender,
        birthDate: st.birthDate,
        group: st.group || `Tổ ${(idx % 4) + 1}`,
        hk1: hk1Detail,
        hk2: hk2Detail,
        finalYearAvg,
        yearEvaluation: yearEval,
        oralScore: st.oralScore ?? st.tx1 ?? null,
        test15mScore: st.test15mScore ?? st.tx2 ?? null,
        test1PeriodScore: st.test1PeriodScore ?? st.gk ?? null,
        finalScore: st.finalScore ?? st.ck ?? null,
        bonusPoints: st.bonusPoints || 0,
        notes: st.notes,
        customFields: st.customFields,
        isCalled: false,
      };
    });

    // Find any custom columns not in the standard set
    const standardColumnNames = [
      'stt', 'mã hs', 'mã học sinh', 'họ và tên', 'họ tên', 'tên',
      'giới tính', 'ngày sinh', 'tổ', 'điểm miệng', 'điểm 15p',
      'điểm 1 tiết', 'điểm cuối kỳ', 'điểm thi', 'điểm tb', 'ghi chú'
    ];

    const extraCols: string[] = [];
    detectedColumns.forEach((col) => {
      const lower = col.toLowerCase().trim();
      if (!standardColumnNames.includes(lower) && !extraCols.includes(col)) {
        extraCols.push(col);
      }
    });

    onImportStudents(
      students,
      targetMode === 'new' ? customClassName.trim().toUpperCase() : undefined,
      extraCols,
      replaceExisting
    );
    onClose();
  };

  // Row update handlers
  const handleUpdateField = (
    index: number,
    field: keyof ParsedStudentRow,
    value: any
  ) => {
    const updated = [...extractedStudents];
    updated[index] = { ...updated[index], [field]: value };
    setExtractedStudents(updated);
  };

  const handleUpdateCustomField = (
    index: number,
    colName: string,
    value: any
  ) => {
    const updated = [...extractedStudents];
    const row = updated[index];
    const custom = { ...(row.customFields || {}) };
    custom[colName] = value;
    updated[index] = { ...row, customFields: custom };
    setExtractedStudents(updated);
  };

  const handleRemoveStudent = (index: number) => {
    setExtractedStudents(extractedStudents.filter((_, i) => i !== index));
  };

  const handleAddManualRow = () => {
    setExtractedStudents([
      ...extractedStudents,
      {
        code: `HS${1000 + extractedStudents.length + 1}`,
        name: 'Học sinh mới',
        gender: 'Nam',
        group: 'Tổ 1',
      },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 select-none animate-fade-in">
      <div className="w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-2xl space-y-5 max-h-[94vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                  Nhập File Danh Sách & Bảng Điểm Lớp Học
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold border border-emerald-200">
                  Đầy Đủ Cột
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Tự động nhận diện STT, Mã HS, Họ tên, Giới tính, Ngày sinh, Tổ, Điểm Miệng, 15P, 1 Tiết, Điểm Cuối Kỳ & Toàn bộ các cột trong file
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Navigation (Upload vs Direct Paste) */}
        {activeTab !== 'preview' && (
          <div className="px-6 shrink-0">
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 border border-slate-200/80 w-fit">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'upload'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-4 h-4" />
                <span>Tải Tệp Lên (Excel, Word, Ảnh)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('paste')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'paste'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardPaste className="w-4 h-4" />
                <span>Dán Trực Tiếp Bảng Điểm (Copy-Paste)</span>
              </button>
            </div>
          </div>
        )}

        {/* Body Content */}
        <div className="px-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: File Upload */}
          {activeTab === 'upload' && (
            <div className="space-y-5">
              {/* Drag and Drop Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 md:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                  isLoading
                    ? 'border-indigo-400 bg-indigo-50/50'
                    : 'border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/30 bg-slate-50/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,.doc,.docx,.pdf,.txt,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {isLoading ? (
                  <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="w-14 h-14 text-indigo-600 animate-spin" />
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">
                        Đang đọc và phân tích cấu trúc cột trong file...
                      </h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Hệ thống đang trích xuất tất cả các cột điểm, thông tin học sinh và lớp học
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-100/80 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
                      <Upload className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">
                        Kéo thả tệp hoặc Bấm để tải lên
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md">
                        Hỗ trợ file bảng điểm Excel (.xlsx, .csv), file Word (.docx), PDF hoặc <strong className="text-indigo-600 font-bold">ảnh chụp sổ điểm</strong>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel (.xlsx, .csv, .xls)
                      </span>
                      <span className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-blue-600" /> Word (.docx) & PDF
                      </span>
                      <span className="px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-purple-600" /> Ảnh chụp sổ điểm (AI Vision)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Sample Data Fast Loader */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Thử nghiệm nhanh với bảng điểm mẫu có đầy đủ cột:</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Bao gồm Mã HS, Họ tên, Giới tính, Ngày sinh, Tổ, Điểm Miệng, 15P, 1 Tiết, Điểm Thi và Ghi chú
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const sampleColumns = [
                      'STT',
                      'Mã HS',
                      'Họ và Tên',
                      'Giới tính',
                      'Ngày sinh',
                      'Tổ',
                      'Điểm Miệng',
                      'Điểm 15P',
                      'Điểm 1 Tiết',
                      'Điểm Cuối Kỳ',
                      'Điểm Thi Đua',
                      'Ghi Chú',
                    ];
                    const sampleStudents: ParsedStudentRow[] = [
                      { code: 'HS1001', name: 'Nguyễn Văn An', gender: 'Nam', birthDate: '15/03/2009', group: 'Tổ 1', oralScore: 9.0, test15mScore: 8.5, test1PeriodScore: 9.0, finalScore: 9.5, bonusPoints: 3, notes: 'Hăng hái phát biểu' },
                      { code: 'HS1002', name: 'Trần Thị Bảo Bình', gender: 'Nữ', birthDate: '22/07/2009', group: 'Tổ 1', oralScore: 8.5, test15mScore: 9.0, test1PeriodScore: 8.5, finalScore: 9.0, bonusPoints: 2, notes: 'Tiếp thu bài nhanh' },
                      { code: 'HS1003', name: 'Lê Hoàng Cường', gender: 'Nam', birthDate: '10/01/2009', group: 'Tổ 2', oralScore: 7.0, test15mScore: 8.0, test1PeriodScore: 7.5, finalScore: 8.0, bonusPoints: 1, notes: 'Cần chú ý bài tập' },
                      { code: 'HS1004', name: 'Phạm Thu Dung', gender: 'Nữ', birthDate: '05/11/2009', group: 'Tổ 2', oralScore: 9.5, test15mScore: 9.5, test1PeriodScore: 10.0, finalScore: 9.5, bonusPoints: 4, notes: 'Xuất sắc' },
                      { code: 'HS1005', name: 'Đặng Quốc Đạt', gender: 'Nam', birthDate: '18/09/2009', group: 'Tổ 3', oralScore: 8.0, test15mScore: 7.5, test1PeriodScore: 8.0, finalScore: 8.5, bonusPoints: 0, notes: 'Đi học đúng giờ' },
                      { code: 'HS1006', name: 'Vũ Hải Đăng', gender: 'Nam', birthDate: '30/04/2009', group: 'Tổ 3', oralScore: 8.5, test15mScore: 8.5, test1PeriodScore: 9.0, finalScore: 8.5, bonusPoints: 2, notes: 'Làm bài đầy đủ' },
                      { code: 'HS1007', name: 'Hoàng Mai Giang', gender: 'Nữ', birthDate: '14/02/2009', group: 'Tổ 4', oralScore: 9.0, test15mScore: 9.0, test1PeriodScore: 8.5, finalScore: 9.0, bonusPoints: 3, notes: 'Chăm chỉ' },
                      { code: 'HS1008', name: 'Đỗ Minh Hạnh', gender: 'Nữ', birthDate: '28/06/2009', group: 'Tổ 4', oralScore: 7.5, test15mScore: 8.0, test1PeriodScore: 8.0, finalScore: 7.5, bonusPoints: 1, notes: 'Cố gắng phát biểu' },
                    ];
                    setDetectedColumns(sampleColumns);
                    setExtractedStudents(sampleStudents);
                    setCustomClassName('10A1');
                    setActiveTab('preview');
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Nạp Bảng Điểm Mẫu</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Direct Paste (Copy-Paste from Excel/Word/Sheets) */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-slate-700">
                  Dán nội dung bảng sao chép từ Excel / Google Sheets / Word:
                </label>
                <textarea
                  rows={8}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder={`Ví dụ sao chép trực tiếp từ Excel (Ctrl + C rồi Ctrl + V):\nSTT\tMã HS\tHọ và tên\tGiới tính\tNgày sinh\tĐiểm Miệng\tĐiểm 15P\tĐiểm 1 Tiết\n1\tHS1001\tNguyễn Văn An\tNam\t15/03/2009\t9.0\t8.5\t9.0\n2\tHS1002\tTrần Thị Bảo Bình\tNữ\t22/07/2009\t8.5\t9.0\t8.5`}
                  className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-300 font-mono text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-y"
                />
              </div>

              {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleProcessPastedText}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Phân Tích & Hiển Thị Đầy Đủ Cột</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Full-Column Preview Table */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              {/* Success Badge & Stats */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-black text-emerald-950">
                      Đã nhận diện thành công {extractedStudents.length} học sinh & {detectedColumns.length} cột dữ liệu
                    </div>
                    <div className="text-xs text-emerald-700 flex items-center gap-2 mt-0.5">
                      <span>Nguồn: {fileName || 'Dữ liệu đã phân tích'}</span>
                      {detectedClassName && (
                        <span className="font-bold bg-emerald-200/80 px-2 py-0.5 rounded-md text-emerald-900">
                          Phát hiện lớp: {detectedClassName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-3 py-1.5 rounded-xl bg-white border border-emerald-300 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs"
                >
                  Chọn tệp khác
                </button>
              </div>

              {/* Target Class Settings */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-black uppercase text-slate-700 tracking-wider">
                  CÀI ĐẶT ĐÍCH NHẬP DỮ LIỆU:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      targetMode === 'current'
                        ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetMode"
                      checked={targetMode === 'current'}
                      onChange={() => setTargetMode('current')}
                      className="mt-0.5 text-indigo-600"
                    />
                    <div>
                      <div className="text-xs font-bold">
                        Nhập vào lớp đang mở ({classRoom?.name || targetClassName || 'Lớp hiện tại'})
                      </div>
                      <div className="text-[11px] font-normal text-slate-500">
                        Bổ sung thêm học sinh và cột điểm vào lớp đang chọn
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      targetMode === 'new'
                        ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetMode"
                      checked={targetMode === 'new'}
                      onChange={() => setTargetMode('new')}
                      className="mt-0.5 text-indigo-600"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-bold flex items-center justify-between">
                        <span>Tạo một lớp học mới hoàn toàn</span>
                        <input
                          type="text"
                          value={customClassName}
                          onChange={(e) => setCustomClassName(e.target.value.toUpperCase())}
                          placeholder="VD: 10A1"
                          onClick={(e) => e.stopPropagation()}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs font-black w-24 text-center focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="text-[11px] font-normal text-slate-500">
                        Tạo danh sách lớp mới theo tên trên
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Preview Table displaying ALL columns */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
                <div className="bg-slate-100 p-3 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TableIcon className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-black uppercase text-slate-800">
                      BẢNG XEM TRƯỚC ĐẦY ĐỦ CÁC CỘT (CÓ THỂ CHỈNH SỬA TRỰC TIẾP)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Nhấp vào bất kỳ ô nào để sửa trực tiếp trước khi nạp
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[900px]">
                    <thead className="bg-slate-50 text-slate-700 font-extrabold sticky top-0 border-b border-slate-200 z-10">
                      <tr>
                        <th className="p-3 w-12 text-center">STT</th>
                        <th className="p-3 w-24">Mã HS</th>
                        <th className="p-3 w-48">Họ và Tên Học Sinh *</th>
                        <th className="p-3 w-20 text-center">Giới tính</th>
                        <th className="p-3 w-24 text-center">Ngày sinh</th>
                        <th className="p-3 w-20 text-center">Tổ</th>
                        <th className="p-3 w-20 text-center text-indigo-800">Điểm Miệng</th>
                        <th className="p-3 w-20 text-center text-indigo-800">Điểm 15P</th>
                        <th className="p-3 w-20 text-center text-indigo-800">Điểm 1 Tiết</th>
                        <th className="p-3 w-20 text-center text-indigo-800">Điểm CK</th>
                        <th className="p-3 w-36">Ghi Chú</th>

                        {/* Render any detected custom extra columns */}
                        {detectedColumns
                          .filter((col) => {
                            const lower = col.toLowerCase().trim();
                            const standardKeys = [
                              'stt', 'mã hs', 'mã học sinh', 'mã', 'họ và tên',
                              'họ tên', 'tên', 'giới tính', 'ngày sinh', 'tổ',
                              'điểm miệng', 'miệng', 'điểm 15p', '15p',
                              'điểm 1 tiết', '1 tiết', 'điểm cuối kỳ', 'điểm ck',
                              'điểm tb', 'ghi chú'
                            ];
                            return !standardKeys.includes(lower);
                          })
                          .map((colName) => (
                            <th key={colName} className="p-3 w-28 text-slate-700 bg-amber-50/70 border-l border-amber-100">
                              {colName}
                            </th>
                          ))}

                        <th className="p-3 w-14 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {extractedStudents.map((st, idx) => (
                        <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                          {/* STT */}
                          <td className="p-2.5 text-center font-bold text-slate-500 font-mono">
                            {idx + 1}
                          </td>

                          {/* Code */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={st.code}
                              onChange={(e) => handleUpdateField(idx, 'code', e.target.value)}
                              className="w-full px-2 py-1 rounded-md bg-slate-50 hover:bg-white focus:bg-white border border-transparent focus:border-indigo-400 font-mono font-bold text-slate-700 text-xs"
                            />
                          </td>

                          {/* Name */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={st.name}
                              onChange={(e) => handleUpdateField(idx, 'name', e.target.value)}
                              className="w-full px-2 py-1 rounded-md bg-slate-50 hover:bg-white focus:bg-white border border-transparent focus:border-indigo-400 font-bold text-slate-900 text-xs"
                            />
                          </td>

                          {/* Gender */}
                          <td className="p-2 text-center">
                            <select
                              value={st.gender || ''}
                              onChange={(e) => handleUpdateField(idx, 'gender', e.target.value)}
                              className="px-1.5 py-1 rounded-md bg-slate-50 text-xs text-slate-700 border border-transparent focus:border-indigo-400"
                            >
                              <option value="">-</option>
                              <option value="Nam">Nam</option>
                              <option value="Nữ">Nữ</option>
                            </select>
                          </td>

                          {/* BirthDate */}
                          <td className="p-2 text-center">
                            <input
                              type="text"
                              value={st.birthDate || ''}
                              onChange={(e) => handleUpdateField(idx, 'birthDate', e.target.value)}
                              placeholder="DD/MM/YYYY"
                              className="w-full px-1.5 py-1 text-center rounded-md bg-slate-50 hover:bg-white focus:bg-white border border-transparent focus:border-indigo-400 text-xs text-slate-700"
                            />
                          </td>

                          {/* Group */}
                          <td className="p-2 text-center">
                            <input
                              type="text"
                              value={st.group || ''}
                              onChange={(e) => handleUpdateField(idx, 'group', e.target.value)}
                              placeholder="Tổ 1"
                              className="w-full px-1.5 py-1 text-center rounded-md bg-slate-50 hover:bg-white focus:bg-white border border-transparent focus:border-indigo-400 text-xs font-bold text-slate-700"
                            />
                          </td>

                          {/* Oral Score */}
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              value={st.oralScore ?? ''}
                              onChange={(e) =>
                                handleUpdateField(
                                  idx,
                                  'oralScore',
                                  e.target.value === '' ? null : parseFloat(e.target.value)
                                )
                              }
                              placeholder="-"
                              className="w-16 px-1.5 py-1 text-center rounded-md bg-slate-50 hover:bg-white focus:bg-white border border-transparent focus:border-indigo-400 font-mono font-bold text-indigo-700 text-xs"
                            />
                          </td>

                          {/* 15m Score */}
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              value={st.test15mScore ?? ''}
                              onChange={(e) =>
                                handleUpdateField(
                                  idx,
                                  'test15mScore',
                                  e.target.value === '' ? null : parseFloat(e.target.value)
                                )
                              }
                              placeholder="-"
                              className="w-16 px-1.5 py-1 text-center rounded-md bg-slate-50 hover:bg-white focus:bg-white border border-transparent focus:border-indigo-400 font-mono font-bold text-indigo-700 text-xs"
                            />
                          </td>

                          {/* 1 Period Score */}
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              value={st.test1PeriodScore ?? ''}
                              onChange={(e) =>
                                handleUpdateField(
                                  idx,
                                  'test1PeriodScore',
                                  e.target.value === '' ? null : parseFloat(e.target.value)
                                )
                              }
                              placeholder="-"
                              className="w-16 px-1.5 py-1 text-center rounded-md bg-slate-50 hover:bg-white focus:bg-white border border-transparent focus:border-indigo-400 font-mono font-bold text-indigo-700 text-xs"
                            />
                          </td>

                          {/* Final Score */}
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              value={st.finalScore ?? ''}
                              onChange={(e) =>
                                handleUpdateField(
                                  idx,
                                  'finalScore',
                                  e.target.value === '' ? null : parseFloat(e.target.value)
                                )
                              }
                              placeholder="-"
                              className="w-16 px-1.5 py-1 text-center rounded-md bg-slate-50 hover:bg-white focus:bg-white border border-transparent focus:border-indigo-400 font-mono font-bold text-indigo-700 text-xs"
                            />
                          </td>

                          {/* Notes */}
                          <td className="p-2">
                            <input
                              type="text"
                              value={st.notes || ''}
                              onChange={(e) => handleUpdateField(idx, 'notes', e.target.value)}
                              placeholder="Ghi chú..."
                              className="w-full px-2 py-1 rounded-md bg-slate-50 hover:bg-white focus:bg-white border border-transparent focus:border-indigo-400 text-xs text-slate-700"
                            />
                          </td>

                          {/* Custom Columns */}
                          {detectedColumns
                            .filter((col) => {
                              const lower = col.toLowerCase().trim();
                              const standardKeys = [
                                'stt', 'mã hs', 'mã học sinh', 'mã', 'họ và tên',
                                'họ tên', 'tên', 'giới tính', 'ngày sinh', 'tổ',
                                'điểm miệng', 'miệng', 'điểm 15p', '15p',
                                'điểm 1 tiết', '1 tiết', 'điểm cuối kỳ', 'điểm ck',
                                'điểm tb', 'ghi chú'
                              ];
                              return !standardKeys.includes(lower);
                            })
                            .map((colName) => (
                              <td key={colName} className="p-2 bg-amber-50/40 border-l border-amber-100">
                                <input
                                  type="text"
                                  value={st.customFields?.[colName] !== undefined ? String(st.customFields[colName]) : ''}
                                  onChange={(e) => handleUpdateCustomField(idx, colName, e.target.value)}
                                  className="w-full px-2 py-1 rounded-md bg-white border border-amber-200 text-xs text-slate-800"
                                />
                              </td>
                            ))}

                          {/* Remove */}
                          <td className="p-2 text-center">
                            <button
                              onClick={() => handleRemoveStudent(idx)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Xóa dòng này"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleAddManualRow}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm 1 Học Sinh</span>
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                  >
                    Hủy & Chọn Tệp Khác
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Xác Nhận Nạp {extractedStudents.length} Học Sinh Vào{' '}
                      {targetMode === 'new' ? `Lớp ${customClassName}` : 'Lớp Đang Chọn'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
