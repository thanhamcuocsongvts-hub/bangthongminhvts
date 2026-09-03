/**
 * Utility to identify and filter out summary, statistics, and classification rows
 * (e.g. "KẾT QUẢ XẾP LOẠI", "XẾP LOẠI HỌC LỰC", "Tốt", "Khá", "Đạt", "Chưa đạt", "Thống kê", etc.)
 * that commonly appear at the bottom of Vietnamese school gradebooks and spreadsheets.
 */

export function isEvaluationOrSummaryRow(name: string = '', rowText: string = ''): boolean {
  const normName = (name || '').trim().toLowerCase();
  const normRow = (rowText || '').toLowerCase();

  if (!normName && !normRow) return false;

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
  ];

  for (const kw of summaryKeywords) {
    if (normName.includes(kw) || normRow.includes(kw)) {
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

  if (standaloneCategories.includes(normName)) {
    return true;
  }

  // 3. If a name has no space and matches any evaluation label
  if (!normName.includes(' ') && normName.length <= 10) {
    if (['tốt', 'khá', 'giỏi', 'đạt', 'yếu', 'kém'].includes(normName)) {
      return true;
    }
  }

  return false;
}
