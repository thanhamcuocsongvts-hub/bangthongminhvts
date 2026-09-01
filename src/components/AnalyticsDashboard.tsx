import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Award,
  AlertTriangle,
  Users,
  CheckCircle2,
  XCircle,
  FileDown,
  Download,
  Share2,
  Sparkles,
} from 'lucide-react';
import { LessonDoc, RoomState } from '../types';

interface AnalyticsDashboardProps {
  lesson: LessonDoc;
  roomState: RoomState | null;
  onOpenExportModal: () => void;
  onAskAIAboutResults: (summaryText: string) => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  lesson,
  roomState,
  onOpenExportModal,
  onAskAIAboutResults,
}) => {
  const questions = roomState?.questions || lesson.quizzes || [];
  const submissions = roomState?.submissions || {};

  // Compute metrics
  let totalSubmissionsCount = 0;
  let totalCorrectCount = 0;

  const questionStats = questions.map((q, idx) => {
    const subs = submissions[q.id] || [];
    const count = subs.length;
    const correctCount = subs.filter((s) => s.isCorrect).length;
    const accuracy = count > 0 ? Math.round((correctCount / count) * 100) : 0;

    totalSubmissionsCount += count;
    totalCorrectCount += correctCount;

    // Count options
    const optCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    subs.forEach((s) => {
      if (optCounts[s.selectedOption] !== undefined) {
        optCounts[s.selectedOption]++;
      }
    });

    return {
      id: q.id,
      index: idx + 1,
      name: `Câu ${idx + 1}`,
      question: q.question,
      correctAnswer: q.correctAnswer,
      accuracy,
      totalCount: count,
      correctCount,
      wrongCount: count - correctCount,
      optCounts,
      explanation: q.explanation,
    };
  });

  const overallAccuracy =
    totalSubmissionsCount > 0 ? Math.round((totalCorrectCount / totalSubmissionsCount) * 100) : 0;

  // Pie chart data
  const pieData = [
    { name: 'Trả lời đúng', value: totalCorrectCount, color: '#10b981' },
    { name: 'Trả lời sai', value: Math.max(0, totalSubmissionsCount - totalCorrectCount), color: '#f43f5e' },
  ];

  // Aggregate student scorecards
  const studentMap: Record<
    string,
    { id: string; name: string; correct: number; total: number; totalTime: number }
  > = {};

  Object.entries(submissions).forEach(([_, subs]) => {
    if (Array.isArray(subs)) {
      subs.forEach((sub) => {
        if (!studentMap[sub.studentId]) {
          studentMap[sub.studentId] = {
            id: sub.studentId,
            name: sub.studentName,
            correct: 0,
            total: 0,
            totalTime: 0,
          };
        }
        studentMap[sub.studentId].total++;
        if (sub.isCorrect) studentMap[sub.studentId].correct++;
        studentMap[sub.studentId].totalTime += sub.timeSpentSeconds;
      });
    }
  });

  const studentList = Object.values(studentMap).sort(
    (a, b) => b.correct - a.correct || a.totalTime - b.totalTime
  );

  // Identify hardest question (lowest accuracy)
  const hardestQuestion = [...questionStats]
    .filter((q) => q.totalCount > 0)
    .sort((a, b) => a.accuracy - b.accuracy)[0];

  const handleAskAI = () => {
    const summary = `Báo cáo kết quả trắc nghiệm bài: ${lesson.title}.
Độ chính xác toàn lớp: ${overallAccuracy}%.
Số câu hỏi: ${questions.length}.
Câu hỏi học sinh sai nhiều nhất: ${hardestQuestion ? `Câu ${hardestQuestion.index}: "${hardestQuestion.question}" (Đúng ${hardestQuestion.accuracy}%)` : 'Không có'}.
Hãy phân tích nguyên nhân lỗi sai thường gặp và gợi ý giáo viên phương pháp củng cố kiến thức cho học sinh.`;

    onAskAIAboutResults(summary);
  };

  return (
    <div id="analytics-report-view" className="relative w-full h-[calc(100vh-100px)] flex flex-col bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-md p-6 md:p-8 space-y-6 overflow-y-auto">
      {/* Top Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 text-sm font-bold uppercase tracking-wider mb-1">
            <TrendingUp className="w-5 h-5" />
            <span>BÁO CÁO PHÂN TÍCH KẾT QUẢ HỌC TẬP TỨC THÌ</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900">{lesson.title}</h1>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleAskAI}
            className="px-4 py-2.5 rounded-xl bg-purple-50 border border-purple-200 hover:bg-purple-100 text-purple-700 text-sm font-bold flex items-center gap-2 transition-all shadow-xs"
          >
            <Sparkles className="w-5 h-5 text-purple-600" />
            <span>AI Đánh Giá & Gợi Ý Sư Phạm</span>
          </button>

          <button
            onClick={onOpenExportModal}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20"
          >
            <FileDown className="w-5 h-5" />
            <span>Xuất Báo Cáo (Word / PDF)</span>
          </button>
        </div>
      </div>

      {/* Top 3 Metric Highlight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1: Overall Accuracy */}
        <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs uppercase font-extrabold tracking-wider text-slate-500 mb-1">
              ĐỘ CHÍNH XÁC TRUNG BÌNH
            </div>
            <div className="text-4xl font-black text-emerald-600 font-mono">
              {overallAccuracy}%
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {totalCorrectCount}/{totalSubmissionsCount} câu trả lời đúng
            </div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>
        </div>

        {/* Metric 2: Participating Students */}
        <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs uppercase font-extrabold tracking-wider text-slate-500 mb-1">
              HỌC SINH THAM GIA LÀM BÀI
            </div>
            <div className="text-4xl font-black text-indigo-600 font-mono">
              {studentList.length}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Kết nối qua màn hình Tivi 75"
            </div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-xs">
            <Users className="w-8 h-8" />
          </div>
        </div>

        {/* Metric 3: Needs Attention */}
        <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-xs uppercase font-extrabold tracking-wider text-slate-500 mb-1">
              CÂU CẦN GIẢNG LẠI
            </div>
            <div className="text-2xl font-black text-amber-600 truncate max-w-[180px]">
              {hardestQuestion ? `Câu ${hardestQuestion.index} (${hardestQuestion.accuracy}%)` : 'Chưa có'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {hardestQuestion ? 'Tỉ lệ đúng thấp nhất' : 'Dữ liệu đang cập nhật'}
            </div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs">
            <AlertTriangle className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Chart Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Accuracy per Question Bar Chart */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-50 border border-slate-200 shadow-xs flex flex-col">
          <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
            <span>Biểu đồ Tỉ lệ Đúng từng Câu hỏi (%)</span>
          </h3>

          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={questionStats} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#475569', fontSize: 14, fontWeight: 'bold' }} />
                <YAxis stroke="#64748b" domain={[0, 100]} tick={{ fill: '#475569', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#cbd5e1',
                    borderRadius: '12px',
                    color: '#0f172a',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(val: any) => [`${val}%`, 'Độ chính xác']}
                />
                <Bar dataKey="accuracy" fill="#4f46e5" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Accuracy Proportion Pie Chart */}
        <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 shadow-xs flex flex-col items-center">
          <h3 className="text-lg font-black text-slate-900 mb-2">Tỉ lệ Đúng / Sai Toàn Lớp</h3>
          <div className="w-full h-64 flex items-center justify-center">
            {totalSubmissionsCount === 0 ? (
              <div className="text-slate-400 text-sm">Chưa có bài nộp</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderColor: '#cbd5e1',
                      borderRadius: '12px',
                      color: '#0f172a',
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Individual Student Performance Table */}
      <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <span>Bảng Điểm Chi Tiết Từng Học Sinh</span>
          </h3>
          <span className="text-xs text-slate-500 font-semibold">{studentList.length} học sinh</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase bg-white text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 rounded-l-xl">Hạng</th>
                <th className="py-3 px-4">Họ và Tên Học Sinh</th>
                <th className="py-3 px-4">Số Câu Đúng</th>
                <th className="py-3 px-4">Tỉ lệ Đạt</th>
                <th className="py-3 px-4">Tổng Thời Gian</th>
                <th className="py-3 px-4 rounded-r-xl">Đánh Giá</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
              {studentList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Chưa có học sinh nào nộp bài trắc nghiệm.
                  </td>
                </tr>
              ) : (
                studentList.map((st, idx) => {
                  const pct = Math.round((st.correct / (st.total || 1)) * 100);
                  return (
                    <tr key={st.id || idx} className="hover:bg-white transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                        #{idx + 1}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {st.name}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span className="text-emerald-600 font-bold">{st.correct}</span> / {st.total}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className={`h-full ${pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold text-slate-600">{pct}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {st.totalTime}s
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            pct >= 80
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : pct >= 50
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {pct >= 80 ? 'Xuất sắc' : pct >= 50 ? 'Đạt yêu cầu' : 'Cần hỗ trợ thêm'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
