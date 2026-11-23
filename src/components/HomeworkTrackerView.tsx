import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Users,
  Link2,
  Copy,
  Check,
  QrCode,
  Trash2,
  Lock,
  Unlock,
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  Search,
  Eye,
  ExternalLink,
  Plus,
  X,
  BarChart2,
  Activity,
  FileCheck,
  AlertCircle,
  Shuffle,
  Layers,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { HomeworkAssignment, HomeworkSubmission } from '../types';
import {
  deleteHomeworkAssignment,
  getHomeworkShareUrl,
  subscribeHomeworkAssignments,
  subscribeHomeworkSubmissions,
  updateHomeworkAssignmentStatus,
} from '../utils/homeworkService';
import { resolveStudentOnlineExam } from '../utils/quizDistribution';
import { QuizRichContentRenderer } from './QuizRichContentRenderer';
import { MathFormulaRenderer } from './MathFormulaRenderer';

interface HomeworkTrackerViewProps {
  teacherId: string;
  initialAssignmentId?: string;
  canCreateNew: boolean;
  onCreateNewAssignment: () => void;
  onPreviewStudent: (assignmentId: string) => void;
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  if (mins === 0) return `${rem}s`;
  return `${mins}p ${rem < 10 ? '0' : ''}${rem}s`;
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const HomeworkTrackerView: React.FC<HomeworkTrackerViewProps> = ({
  teacherId,
  initialAssignmentId,
  canCreateNew,
  onCreateNewAssignment,
  onPreviewStudent,
}) => {
  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [selectedId, setSelectedId] = useState<string>(initialAssignmentId || '');
  const [modeFilter, setModeFilter] = useState<'all' | 'class' | 'open_link'>('all');
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<'newest' | 'score_desc' | 'name'>('newest');
  const [detailTab, setDetailTab] = useState<'students' | 'questions'>('students');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showQRFor, setShowQRFor] = useState<HomeworkAssignment | null>(null);
  const [inspectSubmission, setInspectSubmission] = useState<HomeworkSubmission | null>(null);

  useEffect(() => {
    if (initialAssignmentId) {
      setSelectedId(initialAssignmentId);
    }
  }, [initialAssignmentId]);

  useEffect(() => {
    const unsub = subscribeHomeworkAssignments(teacherId, (list) => {
      setAssignments(list);
      setSelectedId((prev) => {
        if (prev && list.some((a) => a.id === prev)) return prev;
        return list[0]?.id || '';
      });
    });
    return () => unsub();
  }, [teacherId]);

  const selectedAssignment = useMemo(
    () => assignments.find((a) => a.id === selectedId) || null,
    [assignments, selectedId]
  );

  useEffect(() => {
    if (!selectedAssignment?.id) {
      setSubmissions([]);
      return;
    }
    const unsub = subscribeHomeworkSubmissions(selectedAssignment.id, (subs) => {
      setSubmissions(subs);
    });
    return () => unsub();
  }, [selectedAssignment?.id]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => (modeFilter === 'all' ? true : a.mode === modeFilter));
  }, [assignments, modeFilter]);

  const filteredSubmissions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = submissions.filter((s) => {
      if (!q) return true;
      return (
        s.studentName.toLowerCase().includes(q) ||
        (s.studentClassName || '').toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) => {
      if (sortBy === 'score_desc') return b.totalScore - a.totalScore;
      if (sortBy === 'name') return a.studentName.localeCompare(b.studentName, 'vi');
      return (b.submittedAt || '').localeCompare(a.submittedAt || '');
    });
  }, [submissions, searchTerm, sortBy]);

  // Missing students for class mode
  const pendingRosterStudents = useMemo(() => {
    if (!selectedAssignment || selectedAssignment.mode !== 'class' || !selectedAssignment.classRoster) {
      return [];
    }
    const submittedIds = new Set(
      submissions.map((s) => s.studentRosterId).filter(Boolean)
    );
    const submittedNames = new Set(
      submissions.map((s) => s.studentName.trim().toLowerCase())
    );
    return selectedAssignment.classRoster.filter(
      (st) =>
        !submittedIds.has(st.id) &&
        !submittedNames.has(st.name.trim().toLowerCase())
    );
  }, [selectedAssignment, submissions]);

  const kpis = useMemo(() => {
    if (submissions.length === 0) {
      return {
        avgScore: '0.0',
        maxScore: '0.0',
        avgTime: '0s',
        passRate: 0,
      };
    }
    const totalScoreSum = submissions.reduce((acc, s) => acc + (s.totalScore || 0), 0);
    const maxS = Math.max(...submissions.map((s) => s.totalScore || 0));
    const totalSecs = submissions.reduce((acc, s) => acc + (s.totalTimeSeconds || 0), 0);
    const passCount = submissions.filter((s) => (s.totalScore || 0) >= 5).length;
    return {
      avgScore: (totalScoreSum / submissions.length).toFixed(1),
      maxScore: maxS.toFixed(1),
      avgTime: formatDuration(totalSecs / submissions.length),
      passRate: Math.round((passCount / submissions.length) * 100),
    };
  }, [submissions]);

  const questionAnalytics = useMemo(() => {
    if (!selectedAssignment) return [];
    return selectedAssignment.questions.map((q, idx) => {
      const qId = q.id || `q_${idx + 1}`;
      let attempts = 0;
      let correct = 0;
      let totalTime = 0;
      submissions.forEach((sub) => {
        const detail = (sub.questionDetails || []).find(
          (d) => d.questionId === qId || d.questionIndex === idx
        );
        if (detail) {
          attempts += 1;
          if (detail.isCorrect) correct += 1;
          totalTime += detail.timeSpentSeconds || 0;
        }
      });
      const rate = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
      const avgTime = attempts > 0 ? Math.round(totalTime / attempts) : 0;
      return {
        index: idx,
        question: q,
        attempts,
        correct,
        rate,
        avgTime,
      };
    });
  }, [selectedAssignment, submissions]);

  const handleCopyShareLink = async (assignmentId: string) => {
    const url = getHomeworkShareUrl(assignmentId);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopiedId(assignmentId);
    setTimeout(() => setCopiedId(null), 2200);
  };

  const handleToggleStatus = async (assignment: HomeworkAssignment) => {
    const nextStatus = assignment.status === 'active' ? 'closed' : 'active';
    await updateHomeworkAssignmentStatus(assignment.id, nextStatus, teacherId);
  };

  const handleDeleteAssignment = async (assignment: HomeworkAssignment) => {
    if (!window.confirm(`Xóa bài giao "${assignment.title}"? Dữ liệu theo dõi sẽ bị ẩn khỏi danh sách.`)) {
      return;
    }
    await deleteHomeworkAssignment(assignment.id, teacherId);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-50 text-slate-900">
      {/* Left Sidebar: Assignment List */}
      <div className="w-full lg:w-[340px] xl:w-[370px] border-r border-slate-200 bg-white flex flex-col shrink-0 max-h-[42vh] lg:max-h-full">
        <div className="p-4 border-b border-slate-200 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-emerald-600" />
                <span>Đề Online Đã Giao ({assignments.length})</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Theo dõi điểm số &amp; quá trình làm bài
              </p>
            </div>
            {canCreateNew && (
              <button
                type="button"
                onClick={onCreateNewAssignment}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1 shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Giao Đề</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'class', label: 'Theo lớp' },
              { id: 'open_link', label: 'Link tự do' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setModeFilter(f.id as any)}
                className={`py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  modeFilter === f.id
                    ? 'bg-white text-slate-900 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredAssignments.length === 0 ? (
            <div className="p-6 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
              <ClipboardList className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="text-xs font-bold text-slate-700">
                Chưa có Đề online nào được giao
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Sau khi soạn đề trong mục &ldquo;Soạn Đề AI &amp; Ma Trận&rdquo;, bấm nút{' '}
                <strong>Đề Online</strong> để gửi theo lớp hoặc link tự do.
              </p>
              {canCreateNew && (
                <button
                  type="button"
                  onClick={onCreateNewAssignment}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer"
                >
                  Giao Đề Online Từ Đề Hiện Tại
                </button>
              )}
            </div>
          ) : (
            filteredAssignments.map((a) => {
              const isSelected = a.id === selectedAssignment?.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setSelectedId(a.id)}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-indigo-50/80 border-indigo-500 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black ${
                        a.mode === 'class'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {a.mode === 'class' ? (
                        <>
                          <Users className="w-3 h-3" />
                          <span>Lớp {a.className}</span>
                        </>
                      ) : (
                        <>
                          <Link2 className="w-3 h-3" />
                          <span>Link tự do</span>
                        </>
                      )}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        a.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {a.status === 'active' ? 'Đang mở' : 'Đã khóa'}
                    </span>
                  </div>

                  <div className="font-black text-xs text-slate-900 line-clamp-2 leading-snug">
                    {a.title}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 tabular-nums gap-2">
                    <span className="truncate">
                      {a.questions.length} câu · {a.durationMinutes > 0 ? `${a.durationMinutes}p` : 'Tự do'}
                      {a.antiCheatMode === 'variants_and_shuffle'
                        ? ` · ${a.variants?.length || a.variantCount || 2} mã đề`
                        : a.antiCheatMode === 'shuffle_original'
                        ? ' · Trộn đề'
                        : ''}
                    </span>
                    <span className="font-mono text-slate-400 shrink-0">{formatDateTime(a.createdAt)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Main Area: Assignment Detail & Submissions */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedAssignment ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 flex items-center justify-center mb-4 shadow-xs">
              <ClipboardList className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-1">
              Chọn Một Đề Online Để Xem Điểm &amp; Quá Trình Làm Bài
            </h3>
            <p className="text-xs text-slate-500 max-w-md mb-5">
              Giáo viên có thể kiểm tra điểm từng học sinh, mã đề đã trộn, tỷ lệ đúng từng câu hỏi, thời gian làm từng câu và lịch sử đổi đáp án của học sinh.
            </p>
            {canCreateNew && (
              <button
                type="button"
                onClick={onCreateNewAssignment}
                className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black flex items-center gap-2 shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Giao Đề Online Ngay</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
            {/* Assignment Header Card */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white font-mono text-xs font-black">
                      {selectedAssignment.code}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${
                        selectedAssignment.mode === 'class'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}
                    >
                      {selectedAssignment.mode === 'class'
                        ? `Giao theo lớp ${selectedAssignment.className}`
                        : 'Giao theo link tự do'}
                    </span>
                    {selectedAssignment.antiCheatMode === 'variants_and_shuffle' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-100 text-purple-800 text-xs font-black">
                        <Layers className="w-3.5 h-3.5" />
                        <span>
                          {selectedAssignment.variants?.length || selectedAssignment.variantCount || 2} Mã đề tương tự + Trộn
                        </span>
                      </span>
                    )}
                    {selectedAssignment.antiCheatMode === 'shuffle_original' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-800 text-xs font-black">
                        <Shuffle className="w-3.5 h-3.5" />
                        <span>Xáo trộn từ đề gốc</span>
                      </span>
                    )}
                    <span className="text-xs font-semibold text-slate-500">
                      {selectedAssignment.subject} · {selectedAssignment.grade}
                    </span>
                  </div>
                  <h2 className="text-lg md:text-xl font-black text-slate-900 leading-snug">
                    {selectedAssignment.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyShareLink(selectedAssignment.id)}
                    className={`px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      copiedId === selectedAssignment.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {copiedId === selectedAssignment.id ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span>
                      {copiedId === selectedAssignment.id ? 'Đã Sao Chép Link' : 'Sao Chép Link HS'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowQRFor(selectedAssignment)}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <QrCode className="w-4 h-4 text-slate-700" />
                    <span>Mã QR</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onPreviewStudent(selectedAssignment.id)}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <ExternalLink className="w-4 h-4 text-indigo-600" />
                    <span>Làm Thử (HS)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleStatus(selectedAssignment)}
                    className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap border ${
                      selectedAssignment.status === 'active'
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {selectedAssignment.status === 'active' ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Khóa Nộp Bài</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Mở Lại</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteAssignment(selectedAssignment)}
                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer"
                    title="Xóa bài tập này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 4 KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Lượt Đã Nộp</div>
                  <div className="text-2xl font-black text-slate-900 tabular-nums mt-0.5">
                    {submissions.length}
                    {selectedAssignment.mode === 'class' &&
                      selectedAssignment.classRoster &&
                      selectedAssignment.classRoster.length > 0 && (
                        <span className="text-sm font-bold text-slate-500">
                          {' '}
                          / {selectedAssignment.classRoster.length} HS
                        </span>
                      )}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                  <div className="text-[11px] font-bold text-emerald-800 uppercase">Điểm Trung Bình</div>
                  <div className="text-2xl font-black text-emerald-700 tabular-nums mt-0.5">
                    {kpis.avgScore} <span className="text-sm font-bold">/ 10</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200">
                  <div className="text-[11px] font-bold text-indigo-800 uppercase">
                    Cao Nhất / Đạt (≥5)
                  </div>
                  <div className="text-2xl font-black text-indigo-700 tabular-nums mt-0.5">
                    {kpis.maxScore}{' '}
                    <span className="text-xs font-bold text-indigo-600">({kpis.passRate}%)</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
                  <div className="text-[11px] font-bold text-amber-800 uppercase">Thời Gian TB</div>
                  <div className="text-2xl font-black text-amber-700 tabular-nums mt-0.5">
                    {kpis.avgTime}
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-Tabs: Student Scores & Process vs Question Accuracy */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="bg-white p-1 rounded-2xl border border-slate-200 inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDetailTab('students')}
                  className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap ${
                    detailTab === 'students'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Điểm &amp; Quá Trình Học Sinh ({submissions.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('questions')}
                  className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap ${
                    detailTab === 'questions'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <BarChart2 className="w-4 h-4" />
                  <span>Phân Tích Từng Câu ({selectedAssignment.questions.length})</span>
                </button>
              </div>

              {detailTab === 'students' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm tên học sinh..."
                      className="pl-8 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700"
                  >
                    <option value="newest">Mới nộp nhất</option>
                    <option value="score_desc">Điểm cao đến thấp</option>
                    <option value="name">Tên A → Z</option>
                  </select>
                </div>
              )}
            </div>

            {detailTab === 'students' ? (
              <div className="space-y-4">
                {/* Submissions Table */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                  {filteredSubmissions.length === 0 ? (
                    <div className="p-10 text-center space-y-2">
                      <Activity className="w-8 h-8 text-slate-400 mx-auto" />
                      <div className="text-sm font-black text-slate-800">
                        Chưa có học sinh nào nộp bài
                      </div>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Hãy bấm <strong>Sao Chép Link HS</strong> ở trên để gửi cho học sinh làm bài trên điện thoại hoặc máy tính.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                            <th className="py-3 px-4">Học Sinh</th>
                            <th className="py-3 px-3">Điểm (10)</th>
                            <th className="py-3 px-3">Số Câu Đúng</th>
                            <th className="py-3 px-3">Thời Gian Làm</th>
                            <th className="py-3 px-3">Nộp Lúc</th>
                            <th className="py-3 px-4 text-right">Quá Trình</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {filteredSubmissions.map((sub) => {
                            const isPass = sub.totalScore >= 5;
                            const totalChanges = (sub.questionDetails || []).reduce(
                              (sum, d) => sum + (d.changeCount || 0),
                              0
                            );
                            return (
                              <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                                    <span>{sub.studentName}</span>
                                    {sub.variantCode && sub.variantCode !== 'GỐC' && (
                                      <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-mono text-[10px] font-black">
                                        {sub.variantLabel || `Mã ${sub.variantCode}`}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {sub.studentClassName ? `Lớp ${sub.studentClassName} · ` : ''}
                                    Lần {sub.attemptNumber}
                                    {totalChanges > 0 ? ` · Sửa đáp án ${totalChanges} lần` : ''}
                                  </div>
                                </td>
                                <td className="py-3 px-3 tabular-nums">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-1 rounded-lg font-black text-sm ${
                                      isPass
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}
                                  >
                                    {sub.totalScore.toFixed(1)}
                                  </span>
                                </td>
                                <td className="py-3 px-3 tabular-nums font-bold text-slate-700">
                                  <span className="text-emerald-700">{sub.correctCount} đúng</span>
                                  <span className="text-slate-400"> / </span>
                                  <span>{sub.totalQuestions} câu</span>
                                </td>
                                <td className="py-3 px-3 tabular-nums font-semibold text-slate-700">
                                  {formatDuration(sub.totalTimeSeconds)}
                                </td>
                                <td className="py-3 px-3 tabular-nums text-slate-500">
                                  {formatDateTime(sub.submittedAt)}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setInspectSubmission(sub)}
                                    className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Xem Quá Trình</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Unsubmitted roster list for Class mode */}
                {selectedAssignment.mode === 'class' &&
                  selectedAssignment.classRoster &&
                  selectedAssignment.classRoster.length > 0 && (
                    <div className="p-4 rounded-3xl bg-white border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <span>
                            Học sinh lớp {selectedAssignment.className} chưa nộp bài ({pendingRosterStudents.length}/
                            {selectedAssignment.classRoster.length} em)
                          </span>
                        </h4>
                      </div>
                      {pendingRosterStudents.length === 0 ? (
                        <div className="text-xs font-bold text-emerald-700 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                          ✓ 100% học sinh trong danh sách lớp đã hoàn thành bài tập!
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {pendingRosterStudents.map((st) => (
                            <span
                              key={st.id}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700"
                            >
                              {st.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
              </div>
            ) : (
              /* Question-by-Question Accuracy Analytics */
              <div className="space-y-3">
                {questionAnalytics.map((item) => (
                  <div
                    key={item.index}
                    className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-black">
                          CÂU {item.index + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 tabular-nums">
                          TB {item.avgTime}s / câu
                        </span>
                      </div>
                      <div className="flex items-center gap-2 tabular-nums">
                        <span className="text-xs font-bold text-slate-600">
                          {item.correct}/{item.attempts} lượt đúng
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${
                            item.rate >= 70
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.rate >= 40
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.rate}% đúng
                        </span>
                      </div>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          item.rate >= 70
                            ? 'bg-emerald-500'
                            : item.rate >= 40
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${item.rate}%` }}
                      />
                    </div>

                    <div className="text-sm text-slate-800 font-semibold">
                      <QuizRichContentRenderer
                        content={item.question.question}
                        diagramType={item.question.diagramType}
                        diagramData={item.question.diagramData}
                        textClassName="text-sm text-slate-800 font-semibold"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: QR Code Quick Share */}
      {showQRFor && (
        <div className="fixed inset-0 z-[110] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white border border-slate-200 shadow-2xl text-center space-y-4">
            <h3 className="text-lg font-black text-slate-900">{showQRFor.title}</h3>
            <p className="text-xs text-slate-600">
              Học sinh quét mã QR hoặc mở link để làm Đề online
            </p>
            <div className="flex justify-center p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <QRCodeSVG
                value={getHomeworkShareUrl(showQRFor.id)}
                size={210}
                level="M"
                includeMargin={true}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyShareLink(showQRFor.id)}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs cursor-pointer"
              >
                {copiedId === showQRFor.id ? 'Đã Sao Chép Link!' : 'Sao Chép Link'}
              </button>
              <button
                type="button"
                onClick={() => setShowQRFor(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Inspect Student Homework Process */}
      {inspectSubmission && selectedAssignment && (
        <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-900">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
              <div>
                <div className="text-xs text-emerald-300 font-bold uppercase flex items-center gap-2 flex-wrap">
                  <span>Chi Tiết Quá Trình Làm Bài · Lần {inspectSubmission.attemptNumber}</span>
                  {inspectSubmission.variantLabel && inspectSubmission.variantCode !== 'GỐC' && (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 font-mono text-[10px]">
                      {inspectSubmission.variantLabel}
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-black">
                  {inspectSubmission.studentName}
                  {inspectSubmission.studentClassName
                    ? ` (Lớp ${inspectSubmission.studentClassName})`
                    : ''}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectSubmission(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
              {/* Overview Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[11px] font-bold text-emerald-800 uppercase">Điểm Số</div>
                  <div className="text-2xl font-black text-emerald-700 tabular-nums">
                    {inspectSubmission.totalScore.toFixed(1)} / 10
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Kết Quả Câu</div>
                  <div className="text-lg font-black text-slate-900 tabular-nums">
                    {inspectSubmission.correctCount} đúng · {inspectSubmission.wrongCount} sai
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200">
                  <div className="text-[11px] font-bold text-indigo-800 uppercase">Tổng Thời Gian</div>
                  <div className="text-xl font-black text-indigo-700 tabular-nums">
                    {formatDuration(inspectSubmission.totalTimeSeconds)}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                  <div className="text-[11px] font-bold text-amber-800 uppercase">Mốc Thời Gian</div>
                  <div className="text-xs font-bold text-amber-900 tabular-nums mt-1">
                    {formatDateTime(inspectSubmission.startedAt)} →{' '}
                    {formatDateTime(inspectSubmission.submittedAt)}
                  </div>
                </div>
              </div>

              {/* Activity Timeline (Quá trình thao tác làm bài) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-indigo-600" />
                  <span>Nhật Ký Quá Trình Làm Bài ({inspectSubmission.activityLog?.length || 0} bước)</span>
                </h4>
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {(inspectSubmission.activityLog || []).map((ev, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 text-xs bg-white px-3 py-2 rounded-xl border border-slate-200"
                    >
                      <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md tabular-nums shrink-0">
                        +{formatDuration(ev.elapsedSeconds)}
                      </span>
                      <span
                        className={`font-semibold flex-1 ${
                          ev.type === 'change_answer'
                            ? 'text-amber-800'
                            : ev.type === 'submit'
                            ? 'text-emerald-800 font-bold'
                            : 'text-slate-700'
                        }`}
                      >
                        {ev.detail}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {formatDateTime(ev.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-Question Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <span>Chi Tiết Bài Làm Từng Câu</span>
                </h4>

                {(() => {
                  const inspectedQuestions = resolveStudentOnlineExam(
                    selectedAssignment,
                    inspectSubmission.variantCode,
                    inspectSubmission.shuffleSeed
                  ).questions;
                  return (inspectSubmission.questionDetails || []).map((det, idx) => {
                    const q =
                      inspectedQuestions[det.questionIndex] ||
                      inspectedQuestions.find((item) => item.id === det.questionId) ||
                      selectedAssignment.questions[det.questionIndex] ||
                      selectedAssignment.questions[idx];
                  return (
                    <div
                      key={det.questionId || idx}
                      className={`p-4 rounded-2xl border space-y-2.5 ${
                        det.isCorrect
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : det.isPartiallyCorrect
                          ? 'bg-amber-50/40 border-amber-200'
                          : 'bg-rose-50/40 border-rose-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white text-xs font-black">
                            CÂU {idx + 1}
                          </span>
                          {det.isCorrect ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white text-xs font-black">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Đúng</span>
                            </span>
                          ) : det.isPartiallyCorrect ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500 text-white text-xs font-black">
                              <span>Đúng một phần</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-600 text-white text-xs font-black">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Sai</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-600 tabular-nums">
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            Thời gian: <strong>{formatDuration(det.timeSpentSeconds)}</strong>
                          </span>
                          {det.changeCount > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[11px]">
                              Đổi đáp án {det.changeCount} lần
                            </span>
                          )}
                        </div>
                      </div>

                      {q && (
                        <div className="text-sm font-semibold text-slate-900">
                          <MathFormulaRenderer content={q.question} />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200">
                          <span className="text-slate-500 font-bold block mb-0.5">Học sinh chọn:</span>
                          <span className="font-black text-slate-900">{det.selectedDisplay}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-emerald-200">
                          <span className="text-emerald-700 font-bold block mb-0.5">Đáp án đúng:</span>
                          <span className="font-black text-emerald-800">{det.correctDisplay}</span>
                        </div>
                      </div>
                    </div>
                  );
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
