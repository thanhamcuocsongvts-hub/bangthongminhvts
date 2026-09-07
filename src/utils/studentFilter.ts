/**
 * Utility to identify and filter out summary, statistics, and classification rows
 * (e.g. "KẾT QUẢ XẾP LOẠI", "XẾP LOẠI HỌC LỰC", "Tốt", "Khá", "Đạt", "Chưa đạt", "Thống kê", etc.)
 * that commonly appear at the bottom of Vietnamese school gradebooks and spreadsheets.
 */

export function normalizeVietnameseText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\u00a0/g, ' ') // Non-breaking space from Excel/Word
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isEvaluationOrSummaryRow(name: string = '', rowText: string = ''): boolean {
  const normName = normalizeVietnameseText(name);
  const normRow = normalizeVietnameseText(rowText);

  if (!normName && !normRow) return false;

  // Clean prefixes like "1. ", "a. ", "- ", "* "
  const strippedName = normName
    .replace(/^(\d+[\.\-\)]|[a-z][\.\-\)]|[\-\*•\+])\s*/i, '')
    .trim();

  // 1. Explicit summary and classification keywords
  const summaryKeywords = [
    'kết quả xếp loại',
    'xếp loại kết quả',
    'xếp loại học lực',
    'xếp loại rèn luyện',
    'xếp loại hạnh kiểm',
    'xếp loại',
    'kết quả đánh giá',
    'kết quả học tập',
    'kết quả',
    'thống kê học kỳ',
    'thống kê cả năm',
    'thống kê',
    'tổng số học sinh',
    'tổng số',
    'tổng cộng',
    'tổng kết',
    'tổng hợp',
    'trung bình chung',
    'tỷ lệ %',
    'tỉ lệ %',
    'tỷ lệ',
    'tỉ lệ',
    'số lượng',
    'giáo viên chủ nhiệm',
    'giáo viên bộ môn',
    'gvcn',
    'ban giám hiệu',
    'hiệu trưởng',
    'người lập biểu',
    'người lập',
    'chữ ký',
    'ký tên',
    'đạt yêu cầu',
    'chưa đạt yêu cầu',
    'hoàn thành tốt',
    'chưa hoàn thành',
    'chưa đạt',
  ];

  for (const kw of summaryKeywords) {
    if (strippedName.includes(kw) || normRow.includes(kw)) {
      return true;
    }
  }

  // 2. Standalone evaluation categories that are not real Vietnamese human names
  // (e.g. Rows 46-49 labeled: "Tốt", "Khá", "Đạt", "Chưa đạt", "Giỏi", "Xuất sắc", "Trung bình", "Yếu", "Kém")
  const standaloneCategories = [
    'tốt',
    'khá',
    'giỏi',
    'đạt',
    'chưa đạt',
    'chưa dat',
    'xuất sắc',
    'trung bình',
    'yếu',
    'kém',
    'loại tốt',
    'loại khá',
    'loại giỏi',
    'loại đạt',
    'loại chưa đạt',
    'loại xuất sắc',
    'loại trung bình',
    'loại yếu',
    'loại kém',
    'học sinh giỏi',
    'học sinh khá',
    'học sinh trung bình',
    'học sinh yếu',
    'mức tốt',
    'mức khá',
    'mức đạt',
    'mức chưa đạt',
  ];

  // Direct match or match with trailing colon/numbers/parentheses: "Tốt:", "Tốt: 15", "Tốt (15)", "Tốt - 15%"
  const evalRegex = /^(tốt|khá|đạt|chưa\s*đạt|giỏi|xuất\s*sắc|trung\s*bình|yếu|kém|loại\s*(tốt|khá|đạt|chưa\s*đạt|giỏi|xuất\s*sắc|trung\s*bình|yếu|kém))(\s*[:\-\(\[\d%].*)?$/i;

  if (evalRegex.test(strippedName) || evalRegex.test(normName)) {
    return true;
  }

  if (standaloneCategories.includes(strippedName) || standaloneCategories.includes(normName)) {
    return true;
  }

  // 3. If a name has no space and matches any evaluation label
  if (!strippedName.includes(' ') && strippedName.length <= 10) {
    if (['tốt', 'khá', 'giỏi', 'đạt', 'yếu', 'kém'].includes(strippedName)) {
      return true;
    }
  }

  // Check rowText if it consists of evaluation statistics
  if (normRow) {
    if (/(tổng\s*số|thống\s*kê|kết\s*quả|xếp\s*loại)/i.test(normRow)) {
      return true;
    }
    if (evalRegex.test(normRow)) {
      return true;
    }
  }

  return false;
}

/**
 * Filter a student array to guarantee no evaluation / summary rows exist
 */
export function cleanStudentList<T extends { name?: string; code?: string }>(students: T[]): T[] {
  if (!Array.isArray(students)) return [];
  return students.filter((st) => {
    const name = st.name || '';
    const code = st.code || '';
    return !isEvaluationOrSummaryRow(name) && !isEvaluationOrSummaryRow(code);
  });
}

