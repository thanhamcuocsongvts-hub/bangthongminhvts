import { ClassStudent } from '../types';
import { isEvaluationOrSummaryRow, normalizeVietnameseText } from './studentFilter';

export interface ParsedStudentRow {
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

export interface StudentParseResult {
  students: ParsedStudentRow[];
  columns: string[];
  detectedClassName?: string;
  detectedGrade?: string;
  headerRowIndex: number;
  nameMode: 'two_column' | 'single_column' | 'heuristic';
  totalRowsProcessed: number;
}

/**
 * Clean student name string: trims leading/trailing spaces,
 * collapses internal spaces, and removes accidental index prefixes like "1. ", "01 - "
 */
export function cleanStudentName(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/\u00a0/g, ' ') // Non-breaking space
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[0-9.\-_#\s]+/, ''); // remove leading index numbers like "1. " or "01 - "
}

/**
 * Check if a cell contains a valid positive integer STT from 1 upwards (1, 2, 3...)
 * Used to discard footer, header, and statistics rows.
 */
export function isValidPositiveIntegerStt(val: any): boolean {
  if (val === null || val === undefined || val === '') return false;
  if (typeof val === 'number') {
    return Number.isInteger(val) && val >= 1;
  }
  const str = String(val).trim();
  // Must be digits only (e.g. "1", "01", "2", "30", "120")
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    return !isNaN(num) && num >= 1;
  }
  return false;
}

/**
 * Extract class and grade information from early document lines or filename
 * E.g. "LỚP 11A1" -> { className: "11A1", grade: "Khối 11" }
 *      "Khối 11" -> { className: "Khối 11", grade: "Khối 11" }
 */
export function detectClassInfoFromText(text: string): { className?: string; grade?: string } {
  if (!text) return {};
  const normalized = text.replace(/\u00a0/g, ' ');

  // 1. Match specific class: "Lớp 11A1", "Lớp: 10B2", "Lớp 12A10", "LỚP 11 A1"
  const classMatch = normalized.match(/(?:l[ớo]p)\s*:?\s*([0-9]{1,2})\s*([A-Za-z0-9_\-\.]{1,8})/i);
  if (classMatch && classMatch[1] && classMatch[2]) {
    const gradeNum = classMatch[1];
    const section = classMatch[2].replace(/\s+/g, '').toUpperCase();
    const cleanClassName = `${gradeNum}${section}`;
    return {
      className: cleanClassName,
      grade: `Khối ${gradeNum}`,
    };
  }

  // 2. Match grade only: "Khối 11", "Khối: 10", "Khối 12"
  const gradeMatch = normalized.match(/(?:kh[ốo]i)\s*:?\s*([0-9]{1,2})/i);
  if (gradeMatch && gradeMatch[1]) {
    const gradeNum = gradeMatch[1];
    return {
      className: `Khối ${gradeNum}`,
      grade: `Khối ${gradeNum}`,
    };
  }

  // 3. Fallback check for standalone class pattern like "11A1" or "10B2" if near "Lớp"
  const standaloneMatch = normalized.match(/\b(1[0-2]|[1-9])[A-Za-z][0-9A-Za-z_\-]{0,4}\b/i);
  if (standaloneMatch && standaloneMatch[0]) {
    return {
      className: standaloneMatch[0].toUpperCase(),
    };
  }

  return {};
}

/**
 * Format birthDate values, including handling Excel serial date numbers
 */
export function formatBirthDateValue(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number') {
    // If it's an Excel serial date number between 1970 and 2035 (approx 25569 to 49310)
    if (val > 10000 && val < 60000) {
      try {
        const utcDays = Math.floor(val - 25569);
        const utcValue = utcDays * 86400;
        const dateInfo = new Date(utcValue * 1000);
        const day = String(dateInfo.getUTCDate()).padStart(2, '0');
        const month = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
        const year = dateInfo.getUTCFullYear();
        return `${day}/${month}/${year}`;
      } catch {
        return String(val);
      }
    }
    return String(val);
  }
  const str = String(val).trim();
  // If date in ISO format YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  return str;
}

/**
 * Parse score numbers (supports Vietnamese comma format "8,5" or dot "8.5")
 */
export function parseScoreValue(val: any): number | null {
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
}

/**
 * Detect column headers and map column indices for Vietnamese education spreadsheets
 * (supports VnEdu, SMAS, standard school gradebooks, and custom Excel/CSV exports).
 */
export function analyzeMatrixColumns(
  matrix: any[][],
  headerRowIndex: number
): {
  sttColIdx: number;
  codeColIdx: number;
  nameMode: 'two_column' | 'single_column' | 'heuristic';
  lastNameColIdx: number;
  firstNameColIdx: number;
  fullNameColIdx: number;
  genderColIdx: number;
  femaleColIdx: number;
  birthDateColIdx: number;
  groupColIdx: number;
  columnRoleMap: Record<number, { headerName: string; role: string }>;
  allHeaders: string[];
} {
  const headerRow = matrix[headerRowIndex] || [];
  const subHeaderRow = matrix[headerRowIndex + 1] || [];

  const allHeaders: string[] = [];
  const columnRoleMap: Record<number, { headerName: string; role: string }> = {};

  let sttColIdx = -1;
  let codeColIdx = -1;
  let lastNameColIdx = -1;
  let firstNameColIdx = -1;
  let fullNameColIdx = -1;
  let genderColIdx = -1;
  let femaleColIdx = -1;
  let birthDateColIdx = -1;
  let groupColIdx = -1;

  // Regex rules matching Vietnamese education conventions
  const isSttHeader = (t: string) => /^(stt|số\s*tt|no\.?|tt)$/i.test(t);
  const isCodeHeader = (t: string) => /mã\s*(hs|học\s*sinh|định\s*danh|số)?/i.test(t) || /^(code|id|sbd|số\s*báo\s*danh)$/i.test(t);
  
  // Rule for Họ và đệm: matches "Họ và đệm", "Họ và chữ đệm", "Họ và tên lót", "Họ tên lót", "Họ đệm", "Họ và", "Họ", "Họ lót"
  const isLastNameHeader = (t: string) =>
    /^(họ\s*(và|&)?\s*(đệm|chữ\s*đệm|tên\s*lót|lót)|họ\s*(và|&)|họ)$/i.test(t) ||
    /họ\s*(và|&)?\s*(đệm|lót|chữ\s*đệm)/i.test(t) ||
    t === 'họ' ||
    t === 'họ và' ||
    t === 'họ đệm';

  // Rule for Tên: matches "Tên", "Tên học sinh", "Tên HS", "First Name"
  const isFirstNameHeader = (t: string) =>
    /^tên(\s*(học\s*sinh|hs))?$/i.test(t) ||
    t === 'tên' ||
    t === 'ten' ||
    t === 'first name' ||
    t === 'firstname';

  // Rule for single full name header: "Họ và tên", "Họ tên", "Họ & tên", "Họ và tên học sinh"
  const isFullNameHeader = (t: string) => /họ\s*(và|&)?\s*tên/i.test(t) || t === 'họ và tên' || t === 'họ tên';

  // First pass: scan header row (and check sub-header row cells if merged)
  headerRow.forEach((cellVal, colIdx) => {
    let colName = cellVal ? String(cellVal).trim() : '';
    const subCellVal = subHeaderRow[colIdx] ? String(subHeaderRow[colIdx]).trim() : '';

    if (!colName && subCellVal) {
      colName = subCellVal;
    }
    if (!colName) {
      colName = `Cột ${colIdx + 1}`;
    }
    allHeaders.push(colName);

    const lower = colName.toLowerCase();
    const lowerSub = subCellVal.toLowerCase();

    let role = 'custom';

    if (isSttHeader(lower) || isSttHeader(lowerSub)) {
      role = 'stt';
      sttColIdx = colIdx;
    } else if (isCodeHeader(lower) || isCodeHeader(lowerSub)) {
      role = 'code';
      codeColIdx = colIdx;
    } else if (isLastNameHeader(lower) || isLastNameHeader(lowerSub)) {
      role = 'lastName';
      lastNameColIdx = colIdx;
    } else if (isFirstNameHeader(lower) || isFirstNameHeader(lowerSub)) {
      role = 'firstName';
      firstNameColIdx = colIdx;
    } else if (isFullNameHeader(lower) || isFullNameHeader(lowerSub)) {
      role = 'name';
      fullNameColIdx = colIdx;
    } else if (/^nữ$/i.test(lower) || /^nữ$/i.test(lowerSub)) {
      // Column 'Nữ' marked with 'x'
      role = 'female';
      femaleColIdx = colIdx;
    } else if (/giới\s*tính|phái|nam\/?nữ|gender/i.test(lower) || /giới\s*tính/i.test(lowerSub)) {
      role = 'gender';
      genderColIdx = colIdx;
    } else if (/ngày\s*sinh|năm\s*sinh|sinh\s*ngày|dob|birth/i.test(lower) || /ngày\s*sinh/i.test(lowerSub)) {
      role = 'birthDate';
      birthDateColIdx = colIdx;
    } else if (/^tổ(\s*\/|\s*nhóm)?$|^nhóm$/i.test(lower)) {
      role = 'group';
      groupColIdx = colIdx;
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
    } else if (/miệng|ktm|oral|kiểm tra miệng/i.test(lower)) {
      role = 'oralScore';
    } else if (/15\s*(p|phút)|kt\s*15|15'/i.test(lower)) {
      role = 'test15mScore';
    } else if (/1\s*tiết|45\s*(p|phút)|kt\s*45/i.test(lower)) {
      role = 'test1PeriodScore';
    } else if (/cuối\s*(kỳ|kì)/i.test(lower)) {
      role = 'finalScore';
    } else if (/thi\s*đua|cộng|thưởng|điểm\s*rèn\s*luyện/i.test(lower)) {
      role = 'bonusPoints';
    } else if (/nhận\s*xét|đánh\s*giá|xếp\s*loại|kết\s*quả/i.test(lower)) {
      role = 'evaluation';
    } else if (/ghi\s*chú|hạnh\s*kiểm|học\s*lực/i.test(lower)) {
      role = 'notes';
    }

    columnRoleMap[colIdx] = { headerName: colName, role };
  });

  // Second pass: Determine 2-column mode or 1-column mode
  let nameMode: 'two_column' | 'single_column' | 'heuristic' = 'single_column';

  // Condition 1: Both explicit "Họ và đệm" and "Tên" headers were found
  if (lastNameColIdx !== -1 && firstNameColIdx !== -1) {
    nameMode = 'two_column';
  }
  // Condition 2: "Họ và đệm" found, but next column was not explicitly marked as "Tên"
  else if (lastNameColIdx !== -1 && firstNameColIdx === -1) {
    const nextCol = lastNameColIdx + 1;
    if (nextCol < allHeaders.length) {
      firstNameColIdx = nextCol;
      columnRoleMap[nextCol] = { headerName: allHeaders[nextCol] || 'Tên', role: 'firstName' };
      nameMode = 'two_column';
    }
  }
  // Condition 3: "Họ và tên" header found, check if adjacent column holds "Tên"
  // (Common in Vietnamese Excel where "Họ và tên" was merged across 2 columns or adjacent column is "Tên")
  else if (fullNameColIdx !== -1) {
    const nextCol = fullNameColIdx + 1;
    const nextHeader = (allHeaders[nextCol] || '').toLowerCase();
    const isNextFirstName = isFirstNameHeader(nextHeader);

    // Sample data in next column to verify if it contains single-word Vietnamese names
    let singleWordCount = 0;
    let sampleTotal = 0;
    const startRow = headerRowIndex + 1;
    const endRow = Math.min(startRow + 15, matrix.length);

    for (let r = startRow; r < endRow; r++) {
      const val = matrix[r]?.[nextCol];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        sampleTotal++;
        const s = String(val).trim();
        // Single word, no spaces, not a number, length between 1 and 15
        if (!s.includes(' ') && !/^\d+$/.test(s) && !/^(nam|nữ|nu|tốt|khá|giỏi|đạt)$/i.test(s) && s.length <= 15) {
          singleWordCount++;
        }
      }
    }

    if (isNextFirstName || (sampleTotal >= 3 && singleWordCount / sampleTotal >= 0.7)) {
      // It's a 2-column layout!
      lastNameColIdx = fullNameColIdx;
      firstNameColIdx = nextCol;
      columnRoleMap[lastNameColIdx] = { headerName: allHeaders[lastNameColIdx] || 'Họ và đệm', role: 'lastName' };
      columnRoleMap[firstNameColIdx] = { headerName: allHeaders[firstNameColIdx] || 'Tên', role: 'firstName' };
      nameMode = 'two_column';
    } else {
      nameMode = 'single_column';
    }
  }
  // Condition 4: Fallback heuristic when headers are missing or generic:
  // e.g. STT at Col 0, Col 1 is Họ đệm, Col 2 is Tên
  else {
    // Check if Col 0 has STT numbers (1, 2, 3...)
    let sttMatchCount = 0;
    let col1MultiWord = 0;
    let col2SingleWord = 0;
    let sampleRows = 0;

    const startRow = headerRowIndex + 1;
    const endRow = Math.min(startRow + 15, matrix.length);

    for (let r = startRow; r < endRow; r++) {
      const row = matrix[r];
      if (!Array.isArray(row) || row.length < 3) continue;
      sampleRows++;

      if (isValidPositiveIntegerStt(row[0])) sttMatchCount++;
      const c1 = String(row[1] ?? '').trim();
      const c2 = String(row[2] ?? '').trim();

      if (c1.includes(' ') && c1.length >= 3 && !/^\d+$/.test(c1)) {
        col1MultiWord++;
      }
      if (!c2.includes(' ') && c2.length >= 1 && c2.length <= 15 && !/^\d+$/.test(c2) && !/^(nam|nữ)$/i.test(c2)) {
        col2SingleWord++;
      }
    }

    if (sampleRows >= 3 && sttMatchCount / sampleRows >= 0.6 && col1MultiWord / sampleRows >= 0.6 && col2SingleWord / sampleRows >= 0.6) {
      sttColIdx = 0;
      lastNameColIdx = 1;
      firstNameColIdx = 2;
      columnRoleMap[0] = { headerName: 'STT', role: 'stt' };
      columnRoleMap[1] = { headerName: 'Họ và đệm', role: 'lastName' };
      columnRoleMap[2] = { headerName: 'Tên', role: 'firstName' };
      nameMode = 'two_column';
    }
  }

  // Ensure STT column index is detected if column 0 has consecutive integers
  if (sttColIdx === -1 && matrix.length > headerRowIndex + 2) {
    let integerCount = 0;
    for (let r = headerRowIndex + 1; r < Math.min(headerRowIndex + 10, matrix.length); r++) {
      if (isValidPositiveIntegerStt(matrix[r]?.[0])) {
        integerCount++;
      }
    }
    if (integerCount >= 3) {
      sttColIdx = 0;
      columnRoleMap[0] = { headerName: allHeaders[0] || 'STT', role: 'stt' };
    }
  }

  return {
    sttColIdx,
    codeColIdx,
    nameMode,
    lastNameColIdx,
    firstNameColIdx,
    fullNameColIdx,
    genderColIdx,
    femaleColIdx,
    birthDateColIdx,
    groupColIdx,
    columnRoleMap,
    allHeaders,
  };
}

/**
 * Main parser function to process any 2D matrix (Excel, CSV, TSV, Word table, PDF table)
 * into a structured list of students according to Vietnamese education standards.
 */
export function parseStudentDataMatrix(
  matrix: any[][],
  sourceName?: string
): StudentParseResult {
  if (!matrix || matrix.length === 0) {
    throw new Error('Tệp không có dữ liệu để phân tích');
  }

  // 1. Detect Class and Grade from document header lines or source filename
  let detectedClassName = '';
  let detectedGrade = '';

  for (let i = 0; i < Math.min(15, matrix.length); i++) {
    const lineStr = (matrix[i] || []).join(' ');
    const detected = detectClassInfoFromText(lineStr);
    if (detected.className && !detectedClassName) {
      detectedClassName = detected.className;
    }
    if (detected.grade && !detectedGrade) {
      detectedGrade = detected.grade;
    }
    if (detectedClassName && detectedGrade) break;
  }

  // If not found in lines, check source filename
  if (!detectedClassName && sourceName) {
    const fromName = detectClassInfoFromText(sourceName);
    if (fromName.className) detectedClassName = fromName.className;
    if (fromName.grade) detectedGrade = fromName.grade;
  }

  // 2. Find the Header Row (search first 15 rows for keywords)
  let headerRowIndex = 0;
  let maxKeywordScore = -1;

  const keywords = [
    'stt', 'mã', 'họ', 'tên', 'họ và tên', 'họ tên', 'họ và đệm', 'họ đệm',
    'giới tính', 'phái', 'nữ', 'ngày sinh', 'năm sinh', 'tổ', 'nhóm',
    'miệng', 'ktm', '15p', '15 phút', '1 tiết', 'giữa kỳ', 'giữa kì',
    'cuối kỳ', 'cuối kì', 'học kỳ', 'học kì', 'đđgtx', 'đđggk', 'đđgck',
    'dtbmhk', 'điểm', 'tb', 'đtb', 'thi đua', 'cộng', 'ghi chú', 'nhận xét'
  ];

  for (let r = 0; r < Math.min(15, matrix.length); r++) {
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

  // If no explicit keyword header found, find the first row with >= 2 non-empty text cells
  if (maxKeywordScore <= 0) {
    for (let r = 0; r < Math.min(8, matrix.length); r++) {
      const nonEmpties = (matrix[r] || []).filter(
        (c) => c !== null && c !== undefined && String(c).trim() !== ''
      );
      if (nonEmpties.length >= 2) {
        headerRowIndex = r;
        break;
      }
    }
  }

  // 3. Analyze Column Roles & 2-column or 1-column Name structure
  const analysis = analyzeMatrixColumns(matrix, headerRowIndex);
  const {
    sttColIdx,
    codeColIdx,
    nameMode,
    lastNameColIdx,
    firstNameColIdx,
    fullNameColIdx,
    genderColIdx,
    femaleColIdx,
    birthDateColIdx,
    groupColIdx,
    columnRoleMap,
    allHeaders,
  } = analysis;

  // 4. Extract student rows
  const parsedStudents: ParsedStudentRow[] = [];
  const startRow = headerRowIndex + 1;

  for (let r = startRow; r < matrix.length; r++) {
    const row = matrix[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    // Check if entire row is empty
    const nonEmpties = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== '');
    if (nonEmpties.length === 0) continue;

    // Fast text representation of entire row
    const rowStr = row.map((c) => String(c ?? '')).join(' ');
    const lowerRowStr = rowStr.toLowerCase();

    // Skip summary / signature / statistics / evaluation rows
    // (e.g. "KẾT QUẢ XẾP LOẠI", "THỐNG KÊ HỌC KỲ 1", "Số học sinh đạt...", "TỔNG CỘNG")
    if (
      isEvaluationOrSummaryRow('', rowStr) ||
      lowerRowStr.includes('thống kê') ||
      lowerRowStr.includes('số học sinh đạt') ||
      lowerRowStr.includes('số học sinh') ||
      lowerRowStr.includes('tổng cộng') ||
      lowerRowStr.includes('tổng số') ||
      lowerRowStr.includes('tổng hợp') ||
      lowerRowStr.includes('trung bình chung') ||
      lowerRowStr.includes('kết quả xếp loại') ||
      lowerRowStr.includes('xếp loại') ||
      lowerRowStr.includes('giáo viên chủ nhiệm') ||
      lowerRowStr.includes('giáo viên bộ môn') ||
      lowerRowStr.includes('gvcn') ||
      lowerRowStr.includes('chữ ký') ||
      lowerRowStr.includes('ký tên') ||
      lowerRowStr.includes('ban giám hiệu') ||
      lowerRowStr.includes('hiệu trưởng') ||
      lowerRowStr.includes('người lập')
    ) {
      continue;
    }

    // MANDATORY REQUIREMENT:
    // "Chỉ lấy các dòng có STT là số nguyên hợp lệ từ 1 trở đi."
    // If an STT column is present, enforce positive integer check!
    if (sttColIdx !== -1) {
      const sttCell = row[sttColIdx];
      if (!isValidPositiveIntegerStt(sttCell)) {
        // Not a valid student row (could be subheader, group title like "Tổ 1", or footer)
        continue;
      }
    }

    // 5. Build Full Name:
    // Core logic:
    // If 2-column: Họ và tên đầy đủ = (Giá trị cột Họ đệm).trim() + " " + (Giá trị cột Tên).trim()
    // If 1-column: Giữ nguyên giá trị của cột đó
    let finalFullName = '';

    if (nameMode === 'two_column' && lastNameColIdx !== -1 && firstNameColIdx !== -1) {
      const rawLastName = cleanStudentName(row[lastNameColIdx]);
      const rawFirstName = cleanStudentName(row[firstNameColIdx]);

      if (rawLastName && rawFirstName) {
        // Prevent duplicate appending if rawLastName already ends with rawFirstName
        if (rawLastName.toLowerCase().endsWith(rawFirstName.toLowerCase())) {
          finalFullName = rawLastName;
        } else {
          finalFullName = `${rawLastName} ${rawFirstName}`.trim();
        }
      } else if (rawLastName) {
        finalFullName = rawLastName;
      } else if (rawFirstName) {
        finalFullName = rawFirstName;
      }
    } else if (nameMode === 'single_column' && fullNameColIdx !== -1) {
      finalFullName = cleanStudentName(row[fullNameColIdx]);
    } else {
      // Heuristic fallback: check firstNameCol and lastNameCol or any column holding name
      const rawLastName = lastNameColIdx !== -1 ? cleanStudentName(row[lastNameColIdx]) : '';
      const rawFirstName = firstNameColIdx !== -1 ? cleanStudentName(row[firstNameColIdx]) : '';

      if (rawLastName && rawFirstName) {
        finalFullName = `${rawLastName} ${rawFirstName}`.trim();
      } else if (fullNameColIdx !== -1) {
        finalFullName = cleanStudentName(row[fullNameColIdx]);
      } else if (rawLastName) {
        finalFullName = rawLastName;
      } else if (rawFirstName) {
        finalFullName = rawFirstName;
      }
    }

    // Fallback search across row cells for Vietnamese name if still empty
    if (!finalFullName) {
      for (let c = 0; c < row.length; c++) {
        if (c === sttColIdx) continue;
        const cell = row[c];
        if (typeof cell === 'string') {
          const cleaned = cleanStudentName(cell);
          if (
            cleaned.length >= 3 &&
            cleaned.includes(' ') &&
            !/^\d+$/.test(cleaned) &&
            !/^(nam|nữ|tốt|khá|giỏi|đạt)$/i.test(cleaned) &&
            !isEvaluationOrSummaryRow(cleaned)
          ) {
            finalFullName = cleaned;
            break;
          }
        }
      }
    }

    // Skip if name is invalid or matches evaluation categories
    if (!finalFullName || finalFullName.length < 2) continue;
    if (isEvaluationOrSummaryRow(finalFullName, rowStr)) continue;

    // 6. Extract other student attributes
    let code = codeColIdx !== -1 ? String(row[codeColIdx] ?? '').trim() : '';
    if (!code) {
      const sttVal = sttColIdx !== -1 ? row[sttColIdx] : null;
      if (isValidPositiveIntegerStt(sttVal)) {
        code = `HS${String(sttVal).padStart(2, '0')}`;
      } else {
        code = `HS${1000 + parsedStudents.length + 1}`;
      }
    }

    // Gender
    let gender = '';
    if (femaleColIdx !== -1) {
      // Column 'Nữ' marked with 'x' or 'X'
      const femaleVal = String(row[femaleColIdx] ?? '').trim().toLowerCase();
      if (femaleVal === 'x' || femaleVal === '1' || femaleVal === 'nữ' || femaleVal === 'nu') {
        gender = 'Nữ';
      } else {
        gender = 'Nam';
      }
    } else if (genderColIdx !== -1) {
      const val = String(row[genderColIdx] ?? '').trim();
      if (/^(nữ|nu|female|f)$/i.test(val)) gender = 'Nữ';
      else if (/^(nam|male|m)$/i.test(val)) gender = 'Nam';
      else gender = val;
    }

    // Birth Date
    let birthDate = '';
    if (birthDateColIdx !== -1) {
      birthDate = formatBirthDateValue(row[birthDateColIdx]);
    }

    // Group / Tổ
    let group = '';
    if (groupColIdx !== -1) {
      const val = String(row[groupColIdx] ?? '').trim();
      if (val) {
        group = val.startsWith('Tổ') ? val : `Tổ ${val}`;
      }
    }

    // Extract Scores & Custom Fields
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
      if (
        colIdx === sttColIdx ||
        colIdx === lastNameColIdx ||
        colIdx === firstNameColIdx ||
        colIdx === fullNameColIdx ||
        colIdx === codeColIdx ||
        colIdx === genderColIdx ||
        colIdx === femaleColIdx ||
        colIdx === birthDateColIdx ||
        colIdx === groupColIdx
      ) {
        return;
      }

      const mapping = columnRoleMap[colIdx];
      const valStr = String(cellVal).trim();
      if (!valStr) return;

      if (mapping) {
        switch (mapping.role) {
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

    // Calculate Semester 1 DTB if not directly provided
    const txScores = [tx1, tx2, tx3, tx4, tx5].filter(
      (s): s is number => typeof s === 'number' && !isNaN(s)
    );
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

    // Auto evaluate rank if missing
    let autoEval = evaluation;
    if (!autoEval && typeof semesterDtb === 'number') {
      if (semesterDtb >= 9.0) autoEval = 'Xuất sắc';
      else if (semesterDtb >= 8.0) autoEval = 'Giỏi';
      else if (semesterDtb >= 6.5) autoEval = 'Khá';
      else if (semesterDtb >= 5.0) autoEval = 'Đạt';
      else autoEval = 'Chưa đạt';
    }

    parsedStudents.push({
      code,
      name: finalFullName,
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
      cnDtb,
      oralScore: oralScore ?? tx1 ?? (txScores[0] ?? null),
      test15mScore: test15mScore ?? tx2 ?? (txScores[1] ?? null),
      test1PeriodScore: test1PeriodScore ?? gk,
      finalScore: finalScore ?? ck,
      bonusPoints,
      notes: notes || undefined,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
    });
  }

  if (parsedStudents.length === 0) {
    throw new Error('Không tìm thấy dòng học sinh hợp lệ nào từ bảng điểm.');
  }

  return {
    students: parsedStudents,
    columns: allHeaders,
    detectedClassName: detectedClassName || undefined,
    detectedGrade: detectedGrade || undefined,
    headerRowIndex,
    nameMode,
    totalRowsProcessed: matrix.length,
  };
}

/**
 * Extract 2D matrix from PDF files using pdfjs-dist by grouping text items by horizontal lines (Y coordinates)
 */
export async function extractMatrixFromPdf(
  fileOrBuffer: File | ArrayBuffer,
  pdfjsLibInstance: any
): Promise<{ matrix: string[][]; rawText: string; titleText: string }> {
  const arrayBuffer =
    fileOrBuffer instanceof ArrayBuffer ? fileOrBuffer : await fileOrBuffer.arrayBuffer();

  const loadingTask = pdfjsLibInstance.getDocument({
    data: new Uint8Array(arrayBuffer),
  });
  const pdfDoc = await loadingTask.promise;

  const rows: { y: number; page: number; items: { x: number; text: string }[] }[] = [];
  let rawText = '';
  let titleText = '';

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();

    content.items.forEach((item: any) => {
      const str = (item.str || '').trim();
      if (!str) return;

      rawText += str + ' ';
      if (pageNum === 1 && rows.length < 15) {
        titleText += str + ' ';
      }

      const x = item.transform ? item.transform[4] : 0;
      const y = item.transform ? Math.round(item.transform[5]) : 0;

      // Find an existing row within tolerance of 4 pixels
      let matchedRow = rows.find(
        (r) => r.page === pageNum && Math.abs(r.y - y) <= 4
      );

      if (!matchedRow) {
        matchedRow = { y, page: pageNum, items: [] };
        rows.push(matchedRow);
      }

      matchedRow.items.push({ x, text: str });
    });
  }

  // Sort rows: first by page ascending, then by y descending (top to bottom of page)
  rows.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return b.y - a.y;
  });

  // Construct 2D matrix
  const matrix: string[][] = rows.map((r) => {
    // Sort items left-to-right (x ascending)
    r.items.sort((a, b) => a.x - b.x);
    return r.items.map((it) => it.text);
  });

  return { matrix, rawText, titleText };
}
