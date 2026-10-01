import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Download,
  Dices,
  Sparkles,
  Award,
  Search,
  CheckCircle2,
  UserPlus,
  BookOpen,
  Filter,
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  History,
  Columns,
  X,
  TrendingUp,
  GraduationCap,
  Calendar,
  Layers,
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  Smartphone,
  Zap,
} from 'lucide-react';
import { ClassRoom, ClassStudent, TeacherProfile, ConductRecord, SemesterScoreDetail } from '../types';
import { exportGradebookToExcel } from '../utils/exportUtils';
import { isEvaluationOrSummaryRow } from '../utils/studentFilter';
import { ImportStudentsModal } from './ImportStudentsModal';
import { StudentConductModal } from './StudentConductModal';
import { useDeviceDetection } from '../hooks/useDeviceDetection';

interface ClassGradebookProps {
  teacher: TeacherProfile;
  onUpdateTeacher: (updatedTeacher: TeacherProfile) => void;
  onLaunchRandomPicker: (classRoom: ClassRoom) => void;
  onForceSyncToCloud?: () => Promise<void> | void;
  onForcePullFromCloud?: () => Promise<void> | void;
  isCloudSyncing?: boolean;
  syncStatus?: 'synced' | 'syncing' | 'offline' | 'error';
}

type SemesterTab = 'hk1' | 'hk2' | 'year' | 'all';

// Helper to compute DTB for a semester
export function calculateSemesterDtb(sem?: SemesterScoreDetail | null): number | null {
  if (!sem) return null;
  const txScores = [sem.tx1, sem.tx2, sem.tx3, sem.tx4, sem.tx5].filter(
    (s): s is number => typeof s === 'number' && !isNaN(s)
  );
  let sum = txScores.reduce((a, b) => a + b, 0);
  let weights = txScores.length;

  if (typeof sem.gk === 'number' && !isNaN(sem.gk)) {
    sum += sem.gk * 2;
    weights += 2;
  }
  if (typeof sem.ck === 'number' && !isNaN(sem.ck)) {
    sum += sem.ck * 3;
    weights += 3;
  }

  if (weights === 0) return typeof sem.dtb === 'number' ? sem.dtb : null;
  return Math.round((sum / weights) * 10) / 10;
}

// Helper to compute Annual Average CN = (HK1 + 2*HK2)/3
export function calculateAnnualAvg(
  hk1Dtb: number | null,
  hk2Dtb: number | null,
  presetAvg?: number | null
): number | null {
  if (hk1Dtb !== null && hk2Dtb !== null) {
    return Math.round(((hk1Dtb + 2 * hk2Dtb) / 3) * 10) / 10;
  }
  if (hk1Dtb !== null && hk2Dtb === null) return hk1Dtb;
  if (hk2Dtb !== null && hk1Dtb === null) return hk2Dtb;
  return presetAvg ?? null;
}

// Classification by Score
export function getClassificationLabel(avg: number | null): string {
  if (avg === null || isNaN(avg)) return '-';
  if (avg >= 9.0) return 'Xuất sắc';
  if (avg >= 8.0) return 'Giỏi';
  if (avg >= 6.5) return 'Khá';
  if (avg >= 5.0) return 'Đạt';
  return 'Chưa đạt';
}

export const ClassGradebook: React.FC<ClassGradebookProps> = ({
  teacher,
  onUpdateTeacher,
  onLaunchRandomPicker,
  onForceSyncToCloud,
  onForcePullFromCloud,
  isCloudSyncing = false,
  syncStatus = 'synced',
}) => {
  const classes = teacher?.classes || [];
  const { isMobile } = useDeviceDetection();
  const [mobileViewMode, setMobileViewMode] = useState<'cards' | 'table'>('cards');
  const [activeClassId, setActiveClassId] = useState<string>(classes[0]?.id || '');
  const [activeSemester, setActiveSemester] = useState<SemesterTab>('hk1');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [cloudSyncBanner, setCloudSyncBanner] = useState<string | null>(null);

  const handleManualSyncCloud = async () => {
    if (onForceSyncToCloud) {
      await onForceSyncToCloud();
      setCloudSyncBanner('☁️ Đã cập nhật và lưu trữ toàn bộ danh sách lớp lên Đám Mây thành công! Bạn có thể yên tâm mở trên máy tính ở trường học.');
      setTimeout(() => setCloudSyncBanner(null), 6000);
    }
  };

  const handleManualPullCloud = async () => {
    if (onForcePullFromCloud) {
      await onForcePullFromCloud();
      setCloudSyncBanner('🔄 Đã tải và cập nhật toàn bộ danh sách học sinh mới nhất từ Đám Mây về máy tính này!');
      setTimeout(() => setCloudSyncBanner(null), 6000);
    }
  };

  // Modals
  const [showAddStudentModal, setShowAddStudentModal] = useState<boolean>(false);
  const [showAddClassModal, setShowAddClassModal] = useState<boolean>(false);
  const [showDeleteClassModal, setShowDeleteClassModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showConductModal, setShowConductModal] = useState<boolean>(false);
  const [showAccumulateModal, setShowAccumulateModal] = useState<boolean>(false);
  const [accumulateTargetCol, setAccumulateTargetCol] = useState<'tx1' | 'tx2' | 'tx3' | 'gk'>('tx1');
  const [accumulateRatio, setAccumulateRatio] = useState<number>(0.5);
  const [resetBonusAfterApply, setResetBonusAfterApply] = useState<boolean>(false);
  const [showAddColumnModal, setShowAddColumnModal] = useState<boolean>(false);
  const [newColumnName, setNewColumnName] = useState<string>('');
  const [conductStudentId, setConductStudentId] = useState<string | undefined>(undefined);
  const [studentToDelete, setStudentToDelete] = useState<ClassStudent | null>(null);
  const [columnToDelete, setColumnToDelete] = useState<string | null>(null);

  // Form states
  const [newStudentName, setNewStudentName] = useState<string>('');
  const [newStudentCode, setNewStudentCode] = useState<string>('');
  const [newStudentGender, setNewStudentGender] = useState<string>('Nam');
  const [newStudentBirthDate, setNewStudentBirthDate] = useState<string>('');
  const [newStudentGroup, setNewStudentGroup] = useState<string>('Tổ 1');
  const [newClassName, setNewClassName] = useState<string>('');
  const [newClassGrade, setNewClassGrade] = useState<string>('Lớp 10');

  // Quick Score Editing Modal / State
  const [editingScore, setEditingScore] = useState<{
    studentId: string;
    studentName: string;
    targetSemester: 'hk1' | 'hk2';
    field: keyof SemesterScoreDetail;
    fieldName: string;
    currentValue?: number | null;
  } | null>(null);

  // Dedicated Mobile Ergonomic Quick Point Adjuster Modal
  const [quickPointStudent, setQuickPointStudent] = useState<ClassStudent | null>(null);

  const currentClass =
    classes.find((c) => c.id === activeClassId) || classes[0] || null;

  const [isExpandedView, setIsExpandedView] = useState<boolean>(true);

  // Auto-cleanup any stray summary or evaluation rows (e.g. "KẾT QUẢ XẾP LOẠI", "Tốt", "Khá", "Đạt", "Chưa đạt", "THỐNG KÊ") from existing class data
  useEffect(() => {
    if (!currentClass) return;
    const hasStraySummary = (currentClass.students || []).some((st) =>
      isEvaluationOrSummaryRow(st.name) || isEvaluationOrSummaryRow(st.code)
    );
    if (hasStraySummary) {
      const cleaned = (currentClass.students || []).filter(
        (st) => !isEvaluationOrSummaryRow(st.name) && !isEvaluationOrSummaryRow(st.code)
      );
      const updatedClasses = classes.map((c) =>
        c.id === currentClass.id ? { ...c, students: cleaned } : c
      );
      onUpdateTeacher({ ...teacher, classes: updatedClasses });
    }
  }, [currentClass, classes, teacher, onUpdateTeacher]);

  // Filter students based on search term and eliminate any stray summary/evaluation rows
  const filteredStudents = useMemo(() => {
    if (!currentClass) return [];
    const validStudents = (currentClass.students || []).filter(
      (st) => !isEvaluationOrSummaryRow(st.name) && !isEvaluationOrSummaryRow(st.code)
    );

    const q = searchTerm?.toLowerCase().trim();
    if (!q) return validStudents;

    return validStudents.filter((st) => {
      return (
        st.name?.toLowerCase().includes(q) ||
        st.code?.toLowerCase().includes(q) ||
        (st.group && st.group?.toLowerCase().includes(q)) ||
        (st.gender && st.gender?.toLowerCase().includes(q)) ||
        (st.birthDate && st.birthDate?.toLowerCase().includes(q)) ||
        (st.notes && st.notes?.toLowerCase().includes(q))
      );
    });
  }, [currentClass, searchTerm]);

  // Check for split name column in custom columns
  const splittedNameCol = useMemo(() => {
    if (!currentClass?.customColumns) return null;
    return currentClass.customColumns.find((col) => {
      const lower = col?.toLowerCase().trim();
      return (
        lower === 'tên' ||
        lower === 'ten' ||
        lower === 'first name' ||
        lower === 'firstname' ||
        lower === 'cột 4' ||
        lower === 'column 4'
      );
    });
  }, [currentClass]);

  // Statistics
  const totalStudents = currentClass?.students?.length || 0;
  const maleCount = (currentClass?.students || []).filter((s) => s.gender === 'Nam').length;
  const femaleCount = (currentClass?.students || []).filter((s) => s.gender === 'Nữ').length;

  // Average for current view
  const classStats = useMemo(() => {
    if (!currentClass || (!currentClass.students || currentClass.students.length === 0)) {
      return { avg: '-', excellentCount: 0, goodCount: 0, passCount: 0 };
    }

    const avgs: number[] = [];
    let excellentCount = 0;
    let goodCount = 0;
    let passCount = 0;

    (currentClass.students || []).forEach((st) => {
      let val: number | null = null;
      if (activeSemester === 'hk1') {
        val = calculateSemesterDtb(st.hk1);
      } else if (activeSemester === 'hk2') {
        val = calculateSemesterDtb(st.hk2);
      } else {
        const dtb1 = calculateSemesterDtb(st.hk1);
        const dtb2 = calculateSemesterDtb(st.hk2);
        val = calculateAnnualAvg(dtb1, dtb2, st.finalYearAvg);
      }

      if (val !== null) {
        avgs.push(val);
        if (val >= 8.0) excellentCount++;
        else if (val >= 6.5) goodCount++;
        else if (val >= 5.0) passCount++;
      }
    });

    const avgStr =
      avgs.length > 0 ? (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1) : '-';

    return { avg: avgStr, excellentCount, goodCount, passCount };
  }, [currentClass, activeSemester]);

  // Handle score change for HK1 or HK2
  const handleUpdateSemesterScore = (
    studentId: string,
    semKey: 'hk1' | 'hk2',
    field: keyof SemesterScoreDetail,
    value: number | null
  ) => {
    if (!currentClass) return;

    const updatedStudents = (currentClass.students || []).map((st) => {
      if (st.id !== studentId) return st;

      const currentSem = st[semKey] || {};
      const updatedSem: SemesterScoreDetail = {
        ...currentSem,
        [field]: value,
      };

      // Recalculate semester DTB
      const newSemDtb = calculateSemesterDtb(updatedSem);
      updatedSem.dtb = newSemDtb;

      // Auto update semester evaluation
      if (newSemDtb !== null) {
        updatedSem.evaluation = getClassificationLabel(newSemDtb);
      }

      // Determine new HK1 and HK2 DTB for annual average
      const dtb1 = semKey === 'hk1' ? newSemDtb : calculateSemesterDtb(st.hk1);
      const dtb2 = semKey === 'hk2' ? newSemDtb : calculateSemesterDtb(st.hk2);
      const newAnnualAvg = calculateAnnualAvg(dtb1, dtb2);
      const newAnnualEval = newAnnualAvg !== null ? getClassificationLabel(newAnnualAvg) : undefined;

      return {
        ...st,
        [semKey]: updatedSem,
        finalYearAvg: newAnnualAvg,
        yearEvaluation: newAnnualEval,
      };
    });

    const updatedClasses = classes.map((c) =>
      c.id === currentClass.id ? { ...c, students: updatedStudents } : c
    );

    onUpdateTeacher({
      ...teacher,
      classes: updatedClasses,
    });
  };

  // Direct student basic info update
  const handleStudentFieldChange = (
    studentId: string,
    field: keyof ClassStudent,
    value: any
  ) => {
    if (!currentClass) return;
    const updatedStudents = (currentClass.students || []).map((st) =>
      st.id === studentId ? { ...st, [field]: value } : st
    );

    const updatedClasses = classes.map((c) =>
      c.id === currentClass.id ? { ...c, students: updatedStudents } : c
    );

    onUpdateTeacher({
      ...teacher,
      classes: updatedClasses,
    });
  };

  // Adjust bonus points
  const handleAdjustBonus = (studentId: string, delta: number) => {
    if (!currentClass) return;
    const student = (currentClass.students || []).find((s) => s.id === studentId);
    if (!student) return;

    const newPts = (student.bonusPoints || 0) + delta;
    const newRecord: ConductRecord = {
      id: 'cd_' + Date.now(),
      type: delta > 0 ? 'reward' : 'violation',
      category: delta > 0 ? 'Phát biểu tốt (+1)' : 'Nhắc nhở (-1)',
      points: delta,
      week: 'Tuần này',
      period: 'Trong tiết học',
      date: new Date().toLocaleDateString('vi-VN'),
      createdAt: new Date().toISOString(),
    };

    const updatedStudents = (currentClass.students || []).map((st) =>
      st.id === studentId
        ? {
            ...st,
            bonusPoints: newPts,
            conductRecords: [newRecord, ...(st.conductRecords || [])],
          }
        : st
    );

    const updatedClasses = classes.map((c) =>
      c.id === currentClass.id ? { ...c, students: updatedStudents } : c
    );

    onUpdateTeacher({
      ...teacher,
      classes: updatedClasses,
    });
  };

  // Delete student
  const handleDeleteStudent = (studentId: string) => {
    if (!currentClass) return;

    const updatedStudents = (currentClass.students || []).filter((st) => st.id !== studentId);
    const updatedClasses = classes.map((c) =>
      c.id === currentClass.id ? { ...c, students: updatedStudents } : c
    );

    onUpdateTeacher({
      ...teacher,
      classes: updatedClasses,
    });
  };

  // Add 1 student
  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClass || !newStudentName.trim()) return;

    const newStudent: ClassStudent = {
      id: 'st_' + Date.now(),
      code: newStudentCode.trim() || `HS${1000 + (currentClass.students?.length || 0) + 1}`,
      name: newStudentName.trim(),
      gender: newStudentGender,
      birthDate: newStudentBirthDate.trim(),
      group: newStudentGroup.trim() || 'Tổ 1',
      hk1: { tx1: null, tx2: null, tx3: null, tx4: null, tx5: null, gk: null, ck: null, dtb: null },
      hk2: { tx1: null, tx2: null, tx3: null, tx4: null, tx5: null, gk: null, ck: null, dtb: null },
      bonusPoints: 0,
      isCalled: false,
    };

    const updatedClasses = classes.map((c) =>
      c.id === currentClass.id
        ? { ...c, students: [...c.students, newStudent] }
        : c
    );

    onUpdateTeacher({
      ...teacher,
      classes: updatedClasses,
    });

    setNewStudentName('');
    setNewStudentCode('');
    setNewStudentBirthDate('');
    setShowAddStudentModal(false);
  };

  // Add new class
  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    const newClass: ClassRoom = {
      id: 'class_' + Date.now(),
      name: newClassName.trim().toUpperCase(),
      grade: newClassGrade,
      academicYear: '2026 - 2027',
      subject: teacher?.subject || 'Khác',
      students: [],
      customColumns: [],
    };

    const updatedClasses = [...classes, newClass];
    onUpdateTeacher({
      ...teacher,
      classes: updatedClasses,
    });

    setActiveClassId(newClass.id);
    setNewClassName('');
    setShowAddClassModal(false);
  };

  // Delete current class
  const handleConfirmDeleteClass = () => {
    if (!currentClass) return;

    const remainingClasses = classes.filter((c) => c.id !== currentClass.id);
    onUpdateTeacher({
      ...teacher,
      classes: remainingClasses,
    });

    if (remainingClasses.length > 0) {
      setActiveClassId(remainingClasses[0].id);
    } else {
      setActiveClassId('');
    }

    setShowDeleteClassModal(false);
  };

  // Import batch of students with HK1 and HK2 automatically initialized
  const handleImportStudents = (
    imported: ClassStudent[],
    newClassName?: string,
    customColumns?: string[],
    replaceExisting?: boolean
  ) => {
    if (newClassName) {
      const newClass: ClassRoom = {
        id: 'class_' + Date.now(),
        name: newClassName.trim().toUpperCase(),
        grade: 'Lớp 10',
        academicYear: '2026 - 2027',
        subject: teacher?.subject || 'Khác',
        students: imported,
        customColumns: customColumns || [],
      };
      const updatedClasses = [...classes, newClass];
      onUpdateTeacher({
        ...teacher,
        classes: updatedClasses,
      });
      setActiveClassId(newClass.id);
    } else if (currentClass) {
      const baseStudents = replaceExisting ? [] : (currentClass.students || []);
      const updatedStudents = [...baseStudents, ...imported];
      const mergedCols = Array.from(
        new Set([...(currentClass.customColumns || []), ...(customColumns || [])])
      );

      const updatedClasses = classes.map((c) =>
        c.id === currentClass.id
          ? {
              ...c,
              students: updatedStudents,
              customColumns: mergedCols,
            }
          : c
      );

      onUpdateTeacher({
        ...teacher,
        classes: updatedClasses,
      });
    }

    if (onForceSyncToCloud) {
      onForceSyncToCloud();
      setCloudSyncBanner('☁️ Đã nạp thành công và tự động đồng bộ danh sách học sinh lên Đám Mây!');
      setTimeout(() => setCloudSyncBanner(null), 6000);
    }

    setShowImportModal(false);
  };

  // Auto-merge splitted Name column
  const handleAutoMergeNameColumn = (colName: string) => {
    if (!currentClass) return;

    const updatedStudents = (currentClass.students || []).map((st) => {
      const firstNameVal = st.customFields?.[colName];
      if (firstNameVal !== undefined && firstNameVal !== null) {
        const firstNameStr = String(firstNameVal).trim();
        if (firstNameStr && !st.name?.toLowerCase().endsWith(firstNameStr?.toLowerCase())) {
          const mergedName = `${st.name.trim()} ${firstNameStr}`.replace(/\s+/g, ' ');
          const updatedCustom = { ...st.customFields };
          delete updatedCustom[colName];
          return {
            ...st,
            name: mergedName,
            customFields: Object.keys(updatedCustom).length > 0 ? updatedCustom : undefined,
          };
        }
      }
      return st;
    });

    const updatedCols = (currentClass.customColumns || []).filter((c) => c !== colName);
    const updatedClasses = classes.map((c) =>
      c.id === currentClass.id
        ? {
            ...c,
            students: updatedStudents,
            customColumns: updatedCols,
          }
        : c
    );

    onUpdateTeacher({
      ...teacher,
      classes: updatedClasses,
    });
  };

  // Custom column additions
  const handleAddCustomColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClass || !newColumnName.trim()) return;

    const colName = newColumnName.trim();
    const existingCols = currentClass.customColumns || [];
    if (existingCols.includes(colName)) {
      alert('Cột này đã tồn tại trong bảng!');
      return;
    }

    const updatedCols = [...existingCols, colName];
    const updatedClasses = classes.map((c) =>
      c.id === currentClass.id ? { ...c, customColumns: updatedCols } : c
    );

    onUpdateTeacher({
      ...teacher,
      classes: updatedClasses,
    });

    setNewColumnName('');
    setShowAddColumnModal(false);
  };

  const handleDeleteCustomColumn = (colName: string) => {
    if (!currentClass) return;

    const updatedCols = (currentClass.customColumns || []).filter((c) => c !== colName);
    const updatedStudents = (currentClass.students || []).map((st) => {
      if (st.customFields && st.customFields[colName] !== undefined) {
        const custom = { ...st.customFields };
        delete custom[colName];
        return { ...st, customFields: custom };
      }
      return st;
    });

    const updatedClasses = classes.map((c) =>
      c.id === currentClass.id
        ? { ...c, customColumns: updatedCols, students: updatedStudents }
        : c
    );

    onUpdateTeacher({
      ...teacher,
      classes: updatedClasses,
    });
  };

  return (
    <div className="w-full h-full overflow-y-auto overflow-x-auto p-3 md:p-5 space-y-5 pb-16 select-none text-slate-800 animate-fade-in custom-scrollbar">
      {/* Cloud Sync Status Banner */}
      {cloudSyncBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs md:text-sm font-bold flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{cloudSyncBanner}</span>
          </div>
          <button
            onClick={() => setCloudSyncBanner(null)}
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner & Quick Class Actions */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 shadow-xs">
            <Users className="w-7 h-7 md:w-8 md:h-8" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Sổ Điểm & Quản Lý Lớp Học Cảm Ứng
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-black border border-indigo-200">
                Chuẩn Bộ GD&ĐT • HK1 & HK2
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-600 font-medium mt-0.5">
              Hỗ trợ đầy đủ bảng điểm Học Kỳ 1, Học Kỳ 2, Tự động tính Cả Năm (CN), nhập file Excel/Word đa năng và chấm điểm cảm ứng trực tiếp
            </p>
          </div>
        </div>

        {/* Global Class Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {currentClass && (
            <button
              onClick={() => {
                setConductStudentId(undefined);
                setShowConductModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs md:text-sm flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all active:scale-95 cursor-pointer"
              title="Ghi nhận vi phạm / khen thưởng học sinh"
            >
              <AlertTriangle className="w-4 h-4 text-amber-300" />
              <span>Ghi Nhận Thi Đua</span>
            </button>
          )}

          {currentClass && (
            <button
              onClick={() => setShowAccumulateModal(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs md:text-sm flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
              title="Tổng kết điểm thi đua nề nếp cộng dồn vào cột điểm"
            >
              <TrendingUp className="w-4 h-4 text-emerald-200" />
              <span>Tổng Kết Thi Đua Vào Điểm</span>
            </button>
          )}

          <button
            onClick={() => setShowImportModal(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs md:text-sm flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
            title="Tải lên danh sách học sinh từ file Excel, Word, PDF hoặc Ảnh chụp"
          >
            <FileSpreadsheet className="w-4 h-4 text-white" />
            <span>Nhập File / Ảnh DS Lớp</span>
          </button>

          {/* Nút Cập Nhật Lên Đám Mây theo yêu cầu đặc biệt của Giáo viên */}
          <button
            onClick={handleManualSyncCloud}
            disabled={isCloudSyncing}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-bold text-xs md:text-sm flex items-center gap-1.5 shadow-md shadow-indigo-500/25 transition-all active:scale-95 cursor-pointer"
            title="Cập nhật toàn bộ danh sách lớp và điểm số lên Đám Mây để mở được trên máy tính ở trường học"
          >
            <CloudUpload className={`w-4 h-4 ${isCloudSyncing ? 'animate-bounce' : ''}`} />
            <span>{isCloudSyncing ? 'Đang Đẩy Lên Mây...' : 'Cập Nhật Lên Đám Mây'}</span>
          </button>

          {onForcePullFromCloud && (
            <button
              onClick={handleManualPullCloud}
              disabled={isCloudSyncing}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-xs md:text-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              title="Tải danh sách học sinh mới nhất từ Đám Mây về máy tính này"
            >
              <CloudDownload className="w-4 h-4 text-indigo-600" />
              <span>Tải Từ Đám Mây</span>
            </button>
          )}

          {currentClass && (
            <button
              onClick={() => onLaunchRandomPicker(currentClass)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold text-xs md:text-sm flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
              title="Mở trò chơi vòng quay may mắn gọi học sinh từ lớp này"
            >
              <Dices className="w-4 h-4" />
              <span>Gọi Học Sinh</span>
            </button>
          )}

          {currentClass && (
            <button
              onClick={() => exportGradebookToExcel(currentClass, teacher)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs md:text-sm flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
              title="Xuất bảng điểm ra file Excel .xlsx gồm đầy đủ HK1, HK2 và Cả Năm"
            >
              <Download className="w-4 h-4" />
              <span>Xuất File Excel</span>
            </button>
          )}

          {/* Delete Class Button */}
          {currentClass && (
            <button
              onClick={() => setShowDeleteClassModal(true)}
              className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs md:text-sm flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              title={`Xóa hoàn toàn lớp ${currentClass.name}`}
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Xóa Lớp</span>
            </button>
          )}
        </div>
      </div>

      {/* Class Selector Bar & Toolbars */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
          {/* Class List Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 md:pb-0">
            <span className="text-xs font-bold uppercase text-slate-500 mr-1 shrink-0">LỚP:</span>
            {classes.map((cls) => {
              const isSelected = cls.id === currentClass?.id;
              return (
                <button
                  key={cls.id}
                  onClick={() => setActiveClassId(cls.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs md:text-sm font-black transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {cls.name} <span className="text-xs opacity-75 font-normal">({cls.students?.length || 0})</span>
                </button>
              );
            })}

            <button
              onClick={() => setShowAddClassModal(true)}
              className="px-3 py-1.5 rounded-xl bg-white border border-dashed border-indigo-400 text-indigo-600 hover:bg-indigo-50 text-xs font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Thêm Lớp</span>
            </button>
          </div>

          {/* Search, Add Student & Add Column */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm tên, mã HS, tổ..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
              />
            </div>

            {currentClass && (
              <button
                onClick={() => setShowAddColumnModal(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-1.5 shadow-2xs shrink-0 transition-colors cursor-pointer"
                title="Thêm cột điểm hoặc tiêu chí đánh giá mới vào bảng"
              >
                <Columns className="w-3.5 h-3.5 text-amber-700" />
                <span>+ Cột Mới</span>
              </button>
            )}

            {currentClass && (
              <button
                onClick={() => setShowAddStudentModal(true)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ 1 Học Sinh</span>
              </button>
            )}
          </div>
        </div>

        {/* Semester View Switcher (Học Kỳ 1, Học Kỳ 2, Tổng Hợp Cả Năm, Tất Cả Cột) */}
        {currentClass && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-xs font-black text-slate-500 uppercase px-2 shrink-0">Phiếu Điểm:</span>
              <button
                onClick={() => setActiveSemester('hk1')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeSemester === 'hk1'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Học Kỳ 1 (HK1)</span>
              </button>

              <button
                onClick={() => setActiveSemester('hk2')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeSemester === 'hk2'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Học Kỳ 2 (HK2)</span>
              </button>

              <button
                onClick={() => setActiveSemester('year')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeSemester === 'year'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Tổng Hợp Cả Năm (CN)</span>
              </button>

              <button
                onClick={() => setActiveSemester('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  activeSemester === 'all'
                    ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/20'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Tất Cả Cột & Mở Rộng</span>
              </button>
            </div>

            {/* Quick Stats Summary for Selected Semester */}
            <div className="flex items-center gap-3 text-xs text-slate-600 font-bold px-2">
              <span className="flex items-center gap-1 text-slate-700">
                Sĩ số: <strong className="text-slate-900">{totalStudents}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span className="flex items-center gap-1 text-emerald-700">
                ĐTB {activeSemester === 'hk1' ? 'HK1' : activeSemester === 'hk2' ? 'HK2' : 'Cả Năm'}:{' '}
                <strong className="font-mono text-sm font-black">{classStats.avg}</strong>
              </span>
              <span className="text-slate-300">|</span>
              <span className="text-indigo-700">
                {classStats.excellentCount} Giỏi • {classStats.goodCount} Khá • {classStats.passCount} Đạt
              </span>
            </div>
          </div>
        )}

        {/* Auto-Merge Splitted Name Alert Banner */}
        {currentClass && splittedNameCol && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 shadow-2xs">
            <div className="flex items-center gap-2.5 text-xs">
              <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <strong className="font-black text-amber-950">Phát hiện cột "{splittedNameCol}" chứa Tên học sinh bị tách riêng!</strong>
                <p className="text-amber-800 text-[11px]">
                  Bấm nút bên cạnh để tự động gộp phần Họ đệm (ví dụ: "Lê Thị Ngọc") và Tên ("Anh") thành Họ và Tên chuẩn ("Lê Thị Ngọc Anh").
                </p>
              </div>
            </div>
            <button
              onClick={() => handleAutoMergeNameColumn(splittedNameCol)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs shrink-0 transition-transform active:scale-95 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gộp Họ & Tên Tự Động (1 Chạm)</span>
            </button>
          </div>
        )}
      </div>

      {/* Mobile View Mode Switcher */}
      {isMobile && (
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full">
          <button
            onClick={() => setMobileViewMode('cards')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileViewMode === 'cards'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-4 h-4 text-indigo-600" />
            <span>Thẻ Điểm Di Động</span>
          </button>
          <button
            onClick={() => setMobileViewMode('table')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileViewMode === 'table'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Columns className="w-4 h-4 text-slate-500" />
            <span>Bảng Đầy Đủ</span>
          </button>
        </div>
      )}

      {/* Table controls toolbar: Full page toggle & horizontal scroll helper */}
      {(!isMobile || mobileViewMode === 'table') && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 text-sm">
              Danh Sách: {filteredStudents.length} Học Sinh
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">
              • Đã hỗ trợ cuộn dọc toàn bộ trang & cuộn ngang xem tất cả các cột điểm
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsExpandedView((v) => !v)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                isExpandedView
                  ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-400/30'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title="Chuyển chế độ xem bao quát toàn bộ học sinh không giới hạn chiều cao"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>{isExpandedView ? 'Chế Độ: Xem Bao Quát Toàn Bộ' : 'Chế Độ: Cố Định Khung Bảng'}</span>
            </button>
          </div>
        </div>
      )}

      {/* MOBILE STUDENT CARDS VIEW (Clean, Ergonomic, Touch-Friendly for phones) */}
      {isMobile && mobileViewMode === 'cards' ? (
        <div className="flex flex-col gap-2.5 pb-12">
          {filteredStudents.length === 0 ? (
            <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-xs text-slate-500">
              Không tìm thấy học sinh nào phù hợp.
            </div>
          ) : (
            filteredStudents.map((student, idx) => {
              const semData = activeSemester === 'hk2' ? student.hk2 : student.hk1;
              const dtbVal = activeSemester === 'year'
                ? calculateAnnualAvg(calculateSemesterDtb(student.hk1), calculateSemesterDtb(student.hk2), student.finalYearAvg)
                : calculateSemesterDtb(semData);
              const isAbsent = student.status === 'absent';

              return (
                <div
                  key={student.id}
                  className={`bg-white rounded-2xl p-3.5 border transition-all shadow-xs flex flex-col gap-2.5 ${
                    isAbsent ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200'
                  }`}
                >
                  {/* Card Header: STT, Avatar, Name & Attendance Toggle */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md shrink-0">
                        #{student.stt || idx + 1}
                      </span>
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-sm shrink-0">
                        {student.avatar || (student.gender === 'Nữ' ? '👧' : '👦')}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black text-slate-900 truncate">
                          {student.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Mã: {student.code} • {student.gender || 'HS'}
                        </div>
                      </div>
                    </div>

                    {/* Attendance Status Toggle Button */}
                    <button
                      onClick={() =>
                        handleStudentFieldChange(
                          student.id,
                          'status',
                          isAbsent ? 'active' : 'absent'
                        )
                      }
                      className={`px-2 py-1 rounded-xl text-[10px] font-bold shrink-0 transition-all cursor-pointer ${
                        isAbsent
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                      title="Bấm để đổi trạng thái Có mặt / Vắng"
                    >
                      {isAbsent ? '❌ Vắng' : '✓ Có mặt'}
                    </button>
                  </div>

                  {/* Score Info Strip */}
                  <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-medium">
                        ĐTB {activeSemester === 'hk2' ? 'HK2' : activeSemester === 'hk1' ? 'HK1' : 'CN'}:
                      </span>
                      <span
                        className={`font-mono font-black text-sm px-2 py-0.5 rounded-lg ${
                          dtbVal !== null && dtbVal >= 8.0
                            ? 'bg-emerald-100 text-emerald-800'
                            : dtbVal !== null && dtbVal >= 6.5
                            ? 'bg-indigo-100 text-indigo-800'
                            : dtbVal !== null && dtbVal >= 5.0
                            ? 'bg-amber-100 text-amber-800'
                            : dtbVal !== null
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {dtbVal !== null ? dtbVal : '-'}
                      </span>
                      {dtbVal !== null && (
                        <span className="text-[10px] font-bold text-slate-500">
                          ({getClassificationLabel(dtbVal)})
                        </span>
                      )}
                    </div>

                    {/* Current Regular Scores (TX1, TX2) */}
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <span className="text-[9px] text-slate-400">TX:</span>
                      <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-bold">
                        {semData?.tx1 ?? '-'}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-bold">
                        {semData?.tx2 ?? '-'}
                      </span>
                    </div>
                  </div>

                  {/* Ergonomic Mobile Score & Bonus Adjuster (Point 4) */}
                  <div className="flex flex-col gap-2 pt-1.5 border-t border-slate-100">
                    {/* Row 1: Direct Bonus Points (+ / -) with Current Total Badge & Chấm Điểm Button */}
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setQuickPointStudent(student)}
                        className="flex items-center gap-1.5 shrink-0 hover:opacity-85 active:scale-95 transition-transform cursor-pointer"
                        title="Chạm để mở bảng cộng trừ điểm nhanh"
                      >
                        <span className="text-[10px] font-black uppercase text-indigo-700">Thi đua:</span>
                        <span
                          className={`font-mono font-black text-xs px-2.5 py-0.5 rounded-lg border shadow-xs ${
                            (student.bonusPoints || 0) > 0
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : (student.bonusPoints || 0) < 0
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {(student.bonusPoints || 0) > 0 ? `+${student.bonusPoints}đ` : `${student.bonusPoints || 0}đ`}
                        </span>
                      </button>

                      {/* Quick Adjust Buttons: -1, +1, +2 & Big 'Chấm Điểm' Action */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if ('vibrate' in navigator) navigator.vibrate(25);
                            handleAdjustBonus(student.id, -1);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 active:scale-90 text-rose-800 font-mono font-black text-xs border border-rose-300 cursor-pointer transition-transform"
                          title="Trừ 1 điểm"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if ('vibrate' in navigator) navigator.vibrate(25);
                            handleAdjustBonus(student.id, 1);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 active:scale-90 text-emerald-800 font-mono font-black text-xs border border-emerald-300 cursor-pointer transition-transform"
                          title="Cộng 1 điểm"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if ('vibrate' in navigator) navigator.vibrate(25);
                            handleAdjustBonus(student.id, 2);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-90 text-white font-mono font-black text-xs shadow-xs cursor-pointer transition-transform"
                          title="Cộng 2 điểm"
                        >
                          +2
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickPointStudent(student)}
                          className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs shadow-xs active:scale-90 transition-transform cursor-pointer flex items-center gap-1"
                          title="Mở bảng cộng trừ điểm & chấm miệng chuyên sâu"
                        >
                          <Zap className="w-3.5 h-3.5 text-yellow-300" />
                          <span>Chấm Điểm</span>
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Quick Oral Score (Miệng: 7, 8, 9, 10) & Conduct */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-400">Chấm miệng TX:</span>
                        {[7, 8, 9, 10].map((score) => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => {
                              if ('vibrate' in navigator) navigator.vibrate(30);
                              handleUpdateSemesterScore(
                                student.id,
                                activeSemester === 'hk2' ? 'hk2' : 'hk1',
                                'tx1',
                                score
                              );
                            }}
                            className={`w-7 py-1 rounded-lg font-mono font-black text-xs border transition-all cursor-pointer active:scale-90 ${
                              semData?.tx1 === score
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border-slate-200'
                            }`}
                            title={`Chấm ${score} điểm`}
                          >
                            {score}
                          </button>
                        ))}
                      </div>

                      {/* Conduct Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setConductStudentId(student.id);
                          setShowConductModal(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200 flex items-center gap-1 cursor-pointer"
                        title="Ghi nhận nề nếp thi đua"
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>Nề nếp</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
      /* Main Gradebook Touch Table with Full 2D Scrolling & Sticky Headers */
      <div
        className={`${
          isExpandedView ? 'min-h-[500px]' : 'max-h-[calc(100vh-250px)]'
        } overflow-x-auto overflow-y-auto relative rounded-2xl border border-slate-200 bg-white shadow-xs smooth-touch-scroll custom-scrollbar`}
      >
        <table className="w-full text-left text-xs md:text-sm border-collapse min-w-[1200px]">
          {/* STICKY HEADER */}
          <thead className="sticky top-0 z-30 bg-slate-100 shadow-xs">
            <tr className="text-slate-700 font-extrabold text-xs uppercase tracking-wider border-b border-slate-200">
              {/* Frozen columns: STT, Mã HS, Họ & Tên */}
              <th className="py-3 px-2 text-center w-12 sticky left-0 bg-slate-100 z-40">STT</th>
              <th className="py-3 px-2 text-center w-28 sticky left-12 bg-slate-100 z-40">Mã HS</th>
              <th className="py-3 px-4 min-w-[240px] w-[260px] text-left sticky left-40 bg-slate-100 z-40 border-r border-slate-200 shadow-xs">
                Họ và Tên Học Sinh
              </th>
              <th className="py-3 px-2 text-center w-20">Giới tính</th>
              <th className="py-3 px-2 text-center w-28">Ngày sinh</th>
              <th className="py-3 px-2 text-center w-20">Tổ</th>

              {/* SEMESTER 1 (HK1) COLUMNS */}
              {activeSemester === 'hk1' && (
                <>
                  <th className="py-3 px-2 text-center w-16 text-blue-900 bg-blue-50/70 border-l border-blue-100" title="Đánh giá thường xuyên 1 (Kiểm tra miệng)">TX1</th>
                  <th className="py-3 px-2 text-center w-16 text-blue-900 bg-blue-50/70" title="Đánh giá thường xuyên 2 (Kiểm tra 15 phút)">TX2</th>
                  <th className="py-3 px-2 text-center w-16 text-blue-900 bg-blue-50/70" title="Đánh giá thường xuyên 3">TX3</th>
                  <th className="py-3 px-2 text-center w-16 text-blue-900 bg-blue-50/70" title="Đánh giá thường xuyên 4">TX4</th>
                  <th className="py-3 px-2 text-center w-16 text-blue-900 bg-blue-50/70" title="Đánh giá thường xuyên 5">TX5</th>
                  <th className="py-3 px-2 text-center w-20 text-indigo-900 bg-indigo-50/70 border-l border-indigo-100" title="Đánh giá giữa kỳ (Hệ số 2)">ĐĐGgk (x2)</th>
                  <th className="py-3 px-2 text-center w-20 text-indigo-900 bg-indigo-50/70" title="Đánh giá cuối kỳ (Hệ số 3)">ĐĐGck (x3)</th>
                  <th className="py-3 px-2 text-center w-24 text-blue-800 bg-blue-100/70 font-black border-l border-blue-200" title="Điểm trung bình môn học kỳ 1">ĐTB Môn HKI</th>
                  <th className="py-3 px-3 text-center w-28 text-emerald-800 font-bold">Xếp Loại HKI</th>
                  <th className="py-3 px-3 text-center w-28 text-amber-800" title="Điểm cộng / trừ thi đua">Thi Đua</th>
                </>
              )}

              {/* SEMESTER 2 (HK2) COLUMNS (Ảnh 2 standard: TX1-5, ĐĐGgk, ĐĐGck, ĐTB HKII, ĐTB HKI, ĐTB HKII, ĐTB CN, Xếp Loại CN, Thi Đua) */}
              {activeSemester === 'hk2' && (
                <>
                  <th className="py-3 px-2 text-center w-16 text-indigo-900 bg-indigo-50/70 border-l border-indigo-100" title="Đánh giá thường xuyên 1 (Kiểm tra miệng)">TX1</th>
                  <th className="py-3 px-2 text-center w-16 text-indigo-900 bg-indigo-50/70" title="Đánh giá thường xuyên 2 (Kiểm tra 15 phút)">TX2</th>
                  <th className="py-3 px-2 text-center w-16 text-indigo-900 bg-indigo-50/70" title="Đánh giá thường xuyên 3">TX3</th>
                  <th className="py-3 px-2 text-center w-16 text-indigo-900 bg-indigo-50/70" title="Đánh giá thường xuyên 4">TX4</th>
                  <th className="py-3 px-2 text-center w-16 text-indigo-900 bg-indigo-50/70" title="Đánh giá thường xuyên 5">TX5</th>
                  <th className="py-3 px-2 text-center w-20 text-purple-900 bg-purple-50/70 border-l border-purple-100" title="Đánh giá giữa kỳ (Hệ số 2)">ĐĐGgk (x2)</th>
                  <th className="py-3 px-2 text-center w-20 text-purple-900 bg-purple-50/70" title="Đánh giá cuối kỳ (Hệ số 3)">ĐĐGck (x3)</th>
                  <th className="py-3 px-2 text-center w-24 text-indigo-800 bg-indigo-100/70 font-black border-l border-indigo-200" title="Điểm trung bình môn học kỳ 2">ĐTB Môn HKII</th>
                  <th className="py-3 px-2 text-center w-20 text-blue-900 bg-blue-50/70" title="Điểm trung bình Học Kỳ 1">ĐTB HKI</th>
                  <th className="py-3 px-2 text-center w-20 text-indigo-900 bg-indigo-50/70" title="Điểm trung bình Học Kỳ 2">ĐTB HKII</th>
                  <th className="py-3 px-2 text-center w-24 text-emerald-950 bg-emerald-100/90 font-black border-l border-emerald-300" title="Điểm trung bình Cả Năm = (HK1 + 2*HK2)/3">ĐTB CẢ NĂM</th>
                  <th className="py-3 px-3 text-center w-28 text-emerald-900 font-bold bg-emerald-50/70">Xếp Loại CN</th>
                  <th className="py-3 px-3 text-center w-28 text-amber-800" title="Điểm cộng / trừ thi đua">Thi Đua</th>
                </>
              )}

              {/* ANNUAL SUMMARY (CN) COLUMNS */}
              {activeSemester === 'year' && (
                <>
                  <th className="py-3 px-2 text-center w-28 text-blue-900 bg-blue-50/70 border-l border-blue-100">ĐTB Học Kỳ I</th>
                  <th className="py-3 px-2 text-center w-28 text-indigo-900 bg-indigo-50/70">ĐTB Học Kỳ II</th>
                  <th className="py-3 px-2 text-center w-32 text-emerald-950 bg-emerald-100/90 font-black border-l-2 border-emerald-300">
                    ĐTB CẢ NĂM (CN)
                  </th>
                  <th className="py-3 px-3 text-center w-32 text-emerald-900 font-black bg-emerald-50/70">XẾP LOẠI CẢ NĂM</th>
                  <th className="py-3 px-3 text-center w-28 text-amber-800">Tổng Thi Đua</th>
                </>
              )}

              {/* ALL & CUSTOM EXTENDED COLUMNS */}
              {activeSemester === 'all' && (
                <>
                  <th className="py-3 px-2 text-center w-20 text-blue-900">ĐTB HK1</th>
                  <th className="py-3 px-2 text-center w-20 text-indigo-900">ĐTB HK2</th>
                  <th className="py-3 px-2 text-center w-24 text-emerald-900 font-black">ĐTB CN</th>
                  <th className="py-3 px-3 text-center w-24 text-amber-800">Thi Đua</th>

                  {(currentClass?.customColumns || []).map((colName) => (
                    <th key={colName} className="py-3 px-3 text-slate-800 bg-amber-50/70 border-l border-amber-100 w-32">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate" title={colName}>{colName}</span>
                        <button
                          type="button"
                          onClick={() => setColumnToDelete(colName)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer transition-colors"
                          title="Xóa cột này"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                  ))}
                </>
              )}

              <th className="py-3 px-3 text-center w-24">Ghi Nhận</th>
              <th className="py-3 px-4 w-44">Ghi Chú</th>
              <th className="py-3 px-2 text-center w-12">Xóa</th>
            </tr>
          </thead>

          {/* TABLE BODY */}
          <tbody className="divide-y divide-slate-100">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={18} className="py-12 px-4 text-center">
                  <div className="max-w-md mx-auto space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="font-bold text-slate-800 text-base">
                      {currentClass ? `Lớp ${currentClass.name} chưa có học sinh nào` : 'Chưa có lớp học nào'}
                    </div>
                    <p className="text-xs text-slate-500">
                      Thầy/Cô hãy bấm nút <strong className="text-indigo-600">"Nhập File / Ảnh DS Lớp"</strong> để tự động tải danh sách và điểm số đầy đủ 2 học kỳ từ Excel, Word hoặc ảnh chụp.
                    </p>
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowImportModal(true)}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Nhập File / Ảnh DS Lớp</span>
                      </button>
                      {currentClass && (
                        <button
                          type="button"
                          onClick={() => setShowAddStudentModal(true)}
                          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Thêm 1 Học Sinh</span>
                        </button>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredStudents.map((st, idx) => {
                const hk1 = st.hk1 || {};
                const hk2 = st.hk2 || {};
                const dtb1 = calculateSemesterDtb(hk1);
                const dtb2 = calculateSemesterDtb(hk2);
                const cnAvg = calculateAnnualAvg(dtb1, dtb2, st.finalYearAvg);
                const cnEval = st.yearEvaluation || getClassificationLabel(cnAvg);

                return (
                  <tr key={st.id} className="hover:bg-indigo-50/20 transition-colors group">
                    {/* STT (STICKY) */}
                    <td className="py-2.5 px-2 text-center font-bold text-slate-500 font-mono sticky left-0 bg-white group-hover:bg-indigo-50/20 z-20">
                      {idx + 1}
                    </td>

                    {/* Mã HS (STICKY) */}
                    <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700 text-xs sticky left-12 bg-white group-hover:bg-indigo-50/20 z-20">
                      {st.code}
                    </td>

                    {/* Họ và Tên (STICKY) */}
                    <td className="py-1 px-3 font-black text-slate-900 text-sm min-w-[240px] w-[260px] sticky left-40 bg-white group-hover:bg-indigo-50/20 z-20 border-r border-slate-200 shadow-xs">
                      <input
                        type="text"
                        value={st.name}
                        onChange={(e) => handleStudentFieldChange(st.id, 'name', e.target.value)}
                        className="w-full px-2 py-1 rounded-lg bg-transparent hover:bg-slate-100/70 focus:bg-white border border-transparent hover:border-slate-200 focus:border-indigo-500 font-black text-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                        title="Bấm vào để chỉnh sửa Họ và Tên học sinh"
                      />
                    </td>

                    {/* Giới tính */}
                    <td className="py-2 px-2 text-center text-xs">
                      <select
                        value={st.gender || ''}
                        onChange={(e) => handleStudentFieldChange(st.id, 'gender', e.target.value)}
                        className="px-1.5 py-1 rounded-md bg-slate-50 text-xs text-slate-700 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">-</option>
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                      </select>
                    </td>

                    {/* Ngày sinh */}
                    <td className="py-2 px-2 text-center text-xs">
                      <input
                        type="text"
                        value={st.birthDate || ''}
                        onChange={(e) => handleStudentFieldChange(st.id, 'birthDate', e.target.value)}
                        placeholder="DD/MM/YYYY"
                        className="w-24 px-1.5 py-1 text-center rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>

                    {/* Tổ */}
                    <td className="py-2 px-2 text-center text-xs">
                      <input
                        type="text"
                        value={st.group || ''}
                        onChange={(e) => handleStudentFieldChange(st.id, 'group', e.target.value)}
                        placeholder="Tổ 1"
                        className="w-16 px-1.5 py-1 text-center rounded-md bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>

                    {/* SEMESTER 1 (HK1) ROW FIELDS */}
                    {activeSemester === 'hk1' && (
                      <>
                        {(['tx1', 'tx2', 'tx3', 'tx4', 'tx5'] as const).map((field, fIdx) => (
                          <td key={field} className="py-1.5 px-1 text-center bg-blue-50/20">
                            <button
                              onClick={() =>
                                setEditingScore({
                                  studentId: st.id,
                                  studentName: st.name,
                                  targetSemester: 'hk1',
                                  field,
                                  fieldName: `ĐĐGtx ${fIdx + 1}`,
                                  currentValue: hk1[field],
                                })
                              }
                              className={`w-12 py-1 rounded-lg font-mono font-bold text-xs transition-all border ${
                                hk1[field] !== null && hk1[field] !== undefined
                                  ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                              }`}
                            >
                              {hk1[field] ?? '-'}
                            </button>
                          </td>
                        ))}

                        {/* ĐĐGgk (x2) */}
                        <td className="py-1.5 px-1 text-center bg-indigo-50/20 border-l border-indigo-100">
                          <button
                            onClick={() =>
                              setEditingScore({
                                studentId: st.id,
                                studentName: st.name,
                                targetSemester: 'hk1',
                                field: 'gk',
                                fieldName: 'ĐĐGgk (Giữa Kỳ - Hệ số 2)',
                                currentValue: hk1.gk,
                              })
                            }
                            className={`w-14 py-1 rounded-lg font-mono font-black text-xs transition-all border ${
                              hk1.gk !== null && hk1.gk !== undefined
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                                : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                            }`}
                          >
                            {hk1.gk ?? '-'}
                          </button>
                        </td>

                        {/* ĐĐGck (x3) */}
                        <td className="py-1.5 px-1 text-center bg-indigo-50/20">
                          <button
                            onClick={() =>
                              setEditingScore({
                                studentId: st.id,
                                studentName: st.name,
                                targetSemester: 'hk1',
                                field: 'ck',
                                fieldName: 'ĐĐGck (Cuối Kỳ - Hệ số 3)',
                                currentValue: hk1.ck,
                              })
                            }
                            className={`w-14 py-1 rounded-lg font-mono font-black text-xs transition-all border ${
                              hk1.ck !== null && hk1.ck !== undefined
                                ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                                : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                            }`}
                          >
                            {hk1.ck ?? '-'}
                          </button>
                        </td>

                        {/* ĐTB Môn HKI */}
                        <td className="py-2 px-2 text-center font-black font-mono text-sm text-blue-700 bg-blue-100/40 border-l border-blue-200">
                          {dtb1 !== null ? dtb1.toFixed(1) : '-'}
                        </td>

                        {/* Xếp Loại HKI */}
                        <td className="py-2 px-2 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              dtb1 !== null && dtb1 >= 8
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : dtb1 !== null && dtb1 >= 6.5
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : dtb1 !== null && dtb1 >= 5
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-50 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {hk1.evaluation || getClassificationLabel(dtb1)}
                          </span>
                        </td>

                        {/* Thi Đua */}
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span
                              className={`font-black font-mono text-xs px-2 py-0.5 rounded-md border ${
                                st.bonusPoints > 0
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : st.bonusPoints < 0
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                            >
                              {st.bonusPoints > 0 ? `+${st.bonusPoints}` : st.bonusPoints}
                            </span>
                            <button
                              onClick={() => handleAdjustBonus(st.id, 1)}
                              className="px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-black cursor-pointer"
                              title="Cộng 1 điểm thi đua"
                            >
                              +1
                            </button>
                            <button
                              onClick={() => handleAdjustBonus(st.id, -1)}
                              className="px-1.5 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[11px] font-black cursor-pointer"
                              title="Trừ 1 điểm thi đua"
                            >
                              -1
                            </button>
                          </div>
                        </td>
                      </>
                    )}

                    {/* SEMESTER 2 (HK2) ROW FIELDS */}
                    {activeSemester === 'hk2' && (
                      <>
                        {(['tx1', 'tx2', 'tx3', 'tx4', 'tx5'] as const).map((field, fIdx) => (
                          <td key={field} className="py-1.5 px-1 text-center bg-indigo-50/20">
                            <button
                              onClick={() =>
                                setEditingScore({
                                  studentId: st.id,
                                  studentName: st.name,
                                  targetSemester: 'hk2',
                                  field,
                                  fieldName: `ĐĐGtx ${fIdx + 1} (HK2)`,
                                  currentValue: hk2[field],
                                })
                              }
                              className={`w-12 py-1 rounded-lg font-mono font-bold text-xs transition-all border ${
                                hk2[field] !== null && hk2[field] !== undefined
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                                  : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                              }`}
                            >
                              {hk2[field] ?? '-'}
                            </button>
                          </td>
                        ))}

                        {/* ĐĐGgk (x2) */}
                        <td className="py-1.5 px-1 text-center bg-purple-50/20 border-l border-purple-100">
                          <button
                            onClick={() =>
                              setEditingScore({
                                studentId: st.id,
                                studentName: st.name,
                                targetSemester: 'hk2',
                                field: 'gk',
                                fieldName: 'ĐĐGgk HK2 (Giữa Kỳ - Hệ số 2)',
                                currentValue: hk2.gk,
                              })
                            }
                            className={`w-14 py-1 rounded-lg font-mono font-black text-xs transition-all border ${
                              hk2.gk !== null && hk2.gk !== undefined
                                ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                                : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                            }`}
                          >
                            {hk2.gk ?? '-'}
                          </button>
                        </td>

                        {/* ĐĐGck (x3) */}
                        <td className="py-1.5 px-1 text-center bg-purple-50/20">
                          <button
                            onClick={() =>
                              setEditingScore({
                                studentId: st.id,
                                studentName: st.name,
                                targetSemester: 'hk2',
                                field: 'ck',
                                fieldName: 'ĐĐGck HK2 (Cuối Kỳ - Hệ số 3)',
                                currentValue: hk2.ck,
                              })
                            }
                            className={`w-14 py-1 rounded-lg font-mono font-black text-xs transition-all border ${
                              hk2.ck !== null && hk2.ck !== undefined
                                ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
                                : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'
                            }`}
                          >
                            {hk2.ck ?? '-'}
                          </button>
                        </td>

                        {/* ĐTB Môn HKII */}
                        <td className="py-2 px-2 text-center font-black font-mono text-sm text-indigo-700 bg-indigo-100/40 border-l border-indigo-200">
                          {dtb2 !== null ? dtb2.toFixed(1) : '-'}
                        </td>

                        {/* ĐTB HKI */}
                        <td className="py-2 px-2 text-center font-bold font-mono text-xs text-blue-700 bg-blue-50/40">
                          {dtb1 !== null ? dtb1.toFixed(1) : '-'}
                        </td>

                        {/* ĐTB HKII */}
                        <td className="py-2 px-2 text-center font-bold font-mono text-xs text-indigo-700 bg-indigo-50/40">
                          {dtb2 !== null ? dtb2.toFixed(1) : '-'}
                        </td>

                        {/* ĐTB CẢ NĂM (CN) */}
                        <td className="py-2 px-2 text-center font-black font-mono text-sm text-emerald-950 bg-emerald-100/70 border-l border-emerald-300">
                          {cnAvg !== null ? cnAvg.toFixed(1) : '-'}
                        </td>

                        {/* Xếp Loại Cả Năm (CN) */}
                        <td className="py-2 px-2 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              cnAvg !== null && cnAvg >= 8
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : cnAvg !== null && cnAvg >= 6.5
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : cnAvg !== null && cnAvg >= 5
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-slate-50 text-slate-500 border border-slate-200'
                            }`}
                          >
                            {cnEval}
                          </span>
                        </td>

                        {/* Thi Đua */}
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span
                              className={`font-black font-mono text-xs px-2 py-0.5 rounded-md border ${
                                st.bonusPoints > 0
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : st.bonusPoints < 0
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                            >
                              {st.bonusPoints > 0 ? `+${st.bonusPoints}` : st.bonusPoints}
                            </span>
                            <button
                              onClick={() => handleAdjustBonus(st.id, 1)}
                              className="px-1.5 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-black cursor-pointer"
                            >
                              +1
                            </button>
                            <button
                              onClick={() => handleAdjustBonus(st.id, -1)}
                              className="px-1.5 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[11px] font-black cursor-pointer"
                            >
                              -1
                            </button>
                          </div>
                        </td>
                      </>
                    )}

                    {/* ANNUAL SUMMARY (CN) ROW FIELDS */}
                    {activeSemester === 'year' && (
                      <>
                        <td className="py-2 px-2 text-center font-bold font-mono text-sm text-blue-700 bg-blue-50/30 border-l border-blue-100">
                          {dtb1 !== null ? dtb1.toFixed(1) : '-'}
                        </td>
                        <td className="py-2 px-2 text-center font-bold font-mono text-sm text-indigo-700 bg-indigo-50/30">
                          {dtb2 !== null ? dtb2.toFixed(1) : '-'}
                        </td>
                        <td className="py-2 px-2 text-center font-black font-mono text-base text-emerald-800 bg-emerald-100/50 border-l-2 border-emerald-300">
                          {cnAvg !== null ? cnAvg.toFixed(1) : '-'}
                        </td>
                        <td className="py-2 px-3 text-center bg-emerald-50/30">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-black ${
                              cnAvg !== null && cnAvg >= 8
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : cnAvg !== null && cnAvg >= 6.5
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : cnAvg !== null && cnAvg >= 5
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {cnEval}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-bold text-xs">
                          {st.bonusPoints > 0 ? `+${st.bonusPoints}` : st.bonusPoints}
                        </td>
                      </>
                    )}

                    {/* ALL & CUSTOM COLUMNS */}
                    {activeSemester === 'all' && (
                      <>
                        <td className="py-2 px-2 text-center font-bold font-mono text-xs text-blue-700">{dtb1 ?? '-'}</td>
                        <td className="py-2 px-2 text-center font-bold font-mono text-xs text-indigo-700">{dtb2 ?? '-'}</td>
                        <td className="py-2 px-2 text-center font-black font-mono text-xs text-emerald-800">{cnAvg ?? '-'}</td>
                        <td className="py-2 px-2 text-center font-mono text-xs">{st.bonusPoints}</td>

                        {(currentClass?.customColumns || []).map((colName) => (
                          <td key={colName} className="py-2 px-2 bg-amber-50/30 border-l border-amber-100">
                            <input
                              type="text"
                              value={st.customFields?.[colName] !== undefined ? String(st.customFields[colName]) : ''}
                              onChange={(e) => {
                                const custom = { ...(st.customFields || {}) };
                                custom[colName] = e.target.value;
                                handleStudentFieldChange(st.id, 'customFields', custom);
                              }}
                              placeholder="-"
                              className="w-full px-2 py-1 rounded-md bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                          </td>
                        ))}
                      </>
                    )}

                    {/* Ghi Nhận Button */}
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => {
                          setConductStudentId(st.id);
                          setShowConductModal(true);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition-colors cursor-pointer"
                        title="Ghi nhận vi phạm / khen thưởng cho học sinh này"
                      >
                        Ghi Nhận
                      </button>
                    </td>

                    {/* Notes */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={st.notes || ''}
                        onChange={(e) => handleStudentFieldChange(st.id, 'notes', e.target.value)}
                        placeholder="Ghi chú đánh giá..."
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>

                    {/* Delete */}
                    <td className="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => setStudentToDelete(st)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Xóa học sinh"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Touchpad Quick Numeric Score Input Modal */}
      {editingScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs select-none">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-200 animate-scale-up space-y-4">
            <div>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200">
                {editingScore.targetSemester === 'hk1' ? 'Học Kỳ 1' : 'Học Kỳ 2'}
              </span>
              <h3 className="text-base font-black text-slate-900 mt-1">
                {editingScore.fieldName}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Học sinh: <strong className="text-slate-900">{editingScore.studentName}</strong>
              </p>
            </div>

            {/* Direct Score Buttons Grid */}
            <div className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
                <button
                  key={val}
                  onClick={() => {
                    handleUpdateSemesterScore(
                      editingScore.studentId,
                      editingScore.targetSemester,
                      editingScore.field,
                      val
                    );
                    setEditingScore(null);
                  }}
                  className="py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-600 hover:text-white font-mono font-black text-indigo-700 text-sm transition-colors border border-indigo-100 shadow-2xs cursor-pointer"
                >
                  {val}
                </button>
              ))}
              <button
                onClick={() => {
                  const curr = editingScore.currentValue ?? 5;
                  const newHalf = Math.min(10, curr + 0.5);
                  handleUpdateSemesterScore(
                    editingScore.studentId,
                    editingScore.targetSemester,
                    editingScore.field,
                    newHalf
                  );
                  setEditingScore(null);
                }}
                className="py-2.5 rounded-xl bg-amber-50 hover:bg-amber-600 hover:text-white font-mono font-black text-amber-800 text-xs transition-colors border border-amber-200 shadow-2xs cursor-pointer"
                title="Cộng 0.5 điểm"
              >
                +0.5
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  handleUpdateSemesterScore(
                    editingScore.studentId,
                    editingScore.targetSemester,
                    editingScore.field,
                    null
                  );
                  setEditingScore(null);
                }}
                className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
              >
                Xóa Điểm
              </button>
              <button
                onClick={() => setEditingScore(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Class Confirmation Modal */}
      {showDeleteClassModal && currentClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs select-none">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-200 animate-scale-up space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                Xác Nhận Xóa Lớp {currentClass.name}?
              </h3>
              <p className="text-xs md:text-sm text-slate-600 mt-1">
                Thầy/Cô có chắc chắn muốn xóa lớp <strong>{currentClass.name}</strong> (gồm{' '}
                <strong>{(currentClass.students?.length || 0)} học sinh</strong> và toàn bộ điểm số 2 học kỳ)?
                Hành động này không thể hoàn tác.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowDeleteClassModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                onClick={handleConfirmDeleteClass}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 cursor-pointer"
              >
                Đồng Ý Xóa Lớp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add 1 Student Modal */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs select-none">
          <form
            onSubmit={handleAddStudent}
            className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-200 animate-scale-up space-y-4"
          >
            <h3 className="text-base font-black text-slate-900">
              Thêm Học Sinh Vào Lớp {currentClass?.name}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Họ và Tên Học Sinh <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mã Học Sinh</label>
                  <input
                    type="text"
                    value={newStudentCode}
                    onChange={(e) => setNewStudentCode(e.target.value)}
                    placeholder="Tự động nếu để trống"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Giới Tính</label>
                  <select
                    value={newStudentGender}
                    onChange={(e) => setNewStudentGender(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Ngày Sinh</label>
                  <input
                    type="text"
                    value={newStudentBirthDate}
                    onChange={(e) => setNewStudentBirthDate(e.target.value)}
                    placeholder="15/08/2009"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tổ / Nhóm</label>
                  <input
                    type="text"
                    value={newStudentGroup}
                    onChange={(e) => setNewStudentGroup(e.target.value)}
                    placeholder="Tổ 1"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddStudentModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
              >
                Thêm Vào Lớp
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add New Class Modal */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs select-none">
          <form
            onSubmit={handleAddClass}
            className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-200 animate-scale-up space-y-4"
          >
            <h3 className="text-base font-black text-slate-900">Thêm Lớp Học Mới</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tên Lớp Học <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Ví dụ: 10A1, 11B2, 12C3..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Khối Lớp</label>
                <select
                  value={newClassGrade}
                  onChange={(e) => setNewClassGrade(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Lớp 6">Lớp 6</option>
                  <option value="Lớp 7">Lớp 7</option>
                  <option value="Lớp 8">Lớp 8</option>
                  <option value="Lớp 9">Lớp 9</option>
                  <option value="Lớp 10">Lớp 10</option>
                  <option value="Lớp 11">Lớp 11</option>
                  <option value="Lớp 12">Lớp 12</option>
                  <option value="Đại học / Khác">Đại học / Khác</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddClassModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
              >
                Tạo Lớp Ngay
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Custom Dynamic Column Modal */}
      {showAddColumnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs select-none">
          <form
            onSubmit={handleAddCustomColumn}
            className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-200 animate-scale-up space-y-4"
          >
            <h3 className="text-base font-black text-slate-900">
              Thêm Cột Mới Vào Lớp {currentClass?.name}
            </h3>
            <p className="text-xs text-slate-500">
              Thầy/Cô có thể thêm các cột như "Điểm Dự Án", "Thuyết Trình", "Chuyên Cần", "Nộp Bài Tập"...
            </p>

            <div>
              <label className="block font-bold text-slate-700 text-xs mb-1">
                Tên Cột Mới <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Ví dụ: Điểm Thuyết Trình"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddColumnModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
              >
                Thêm Cột
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Full Batch Import Modal */}
      {showImportModal && (
        <ImportStudentsModal
          isOpen={showImportModal}
          classRoom={currentClass}
          targetClassName={currentClass?.name}
          onClose={() => setShowImportModal(false)}
          onImportStudents={handleImportStudents}
        />
      )}

      {/* Conduct & Competition Modal */}
      {showConductModal && currentClass && (
        <StudentConductModal
          isOpen={showConductModal}
          onClose={() => setShowConductModal(false)}
          classRoom={currentClass}
          selectedStudentId={conductStudentId}
          onSaveConduct={(studentId, record) => {
            const updatedStudents = (currentClass.students || []).map((st) => {
              if (st.id === studentId) {
                const currentRecords = st.conductRecords || [];
                const newBonus = (st.bonusPoints || 0) + record.points;
                return {
                  ...st,
                  bonusPoints: newBonus,
                  conductRecords: [record, ...currentRecords],
                };
              }
              return st;
            });

            const updatedClasses = classes.map((c) =>
              c.id === currentClass.id ? { ...c, students: updatedStudents } : c
            );

            onUpdateTeacher({
              ...teacher,
              classes: updatedClasses,
            });
          }}
        />
      )}

      {/* Accumulate Conduct Points Modal */}
      {showAccumulateModal && currentClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in select-none">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-white/10 text-amber-300">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-black">Tổng Kết Điểm Thi Đua Vào Cột Điểm</h2>
                  <p className="text-xs text-emerald-100 font-medium">
                    Cộng / trừ điểm nề nếp thi đua vào sổ điểm của Lớp {currentClass.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAccumulateModal(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-slate-800">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1.5">
                  Chọn Cột Điểm Cần Cộng Dồn <span className="text-rose-500">*</span>
                </label>
                <select
                  value={accumulateTargetCol}
                  onChange={(e) => setAccumulateTargetCol(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="tx1">Điểm Thường Xuyên 1 (TX1 / Miệng)</option>
                  <option value="tx2">Điểm Thường Xuyên 2 (TX2 / 15 phút)</option>
                  <option value="tx3">Điểm Thường Xuyên 3 (TX3)</option>
                  <option value="gk">Điểm Giữa Kỳ (GK)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase mb-1.5">
                  Tỷ Lệ Quy Đổi Điểm
                </label>
                <select
                  value={accumulateRatio}
                  onChange={(e) => setAccumulateRatio(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value={1.0}>1 điểm thi đua = 1.0 điểm số (1:1)</option>
                  <option value={0.5}>1 điểm thi đua = 0.5 điểm số (2 thi đua = 1 điểm)</option>
                  <option value={0.2}>1 điểm thi đua = 0.2 điểm số (5 thi đua = 1 điểm)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  * Điểm sau cộng luôn được giới hạn an toàn từ 0.0 đến 10.0.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-600" />
                  <span>Xem trước ({(currentClass.students || []).filter(s => (s.bonusPoints || 0) !== 0).length} học sinh có điểm thi đua):</span>
                </div>
                <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-1 pt-1">
                  {(currentClass.students || []).filter(s => (s.bonusPoints || 0) !== 0).map((st) => {
                    const currentScore = (st as any)[accumulateTargetCol] ?? 0;
                    const delta = Math.round((st.bonusPoints || 0) * accumulateRatio * 10) / 10;
                    const nextScore = Math.max(0, Math.min(10, Math.round((currentScore + delta) * 10) / 10));
                    return (
                      <div key={st.id} className="flex items-center justify-between bg-white px-2.5 py-1 rounded-lg border border-amber-200/60 text-[11px]">
                        <span className="font-bold text-slate-800">{st.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={st.bonusPoints! > 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                            {st.bonusPoints! > 0 ? `+${st.bonusPoints}` : st.bonusPoints}đ thi đua
                          </span>
                          <span className="text-slate-400">➔</span>
                          <span className="font-black text-indigo-700">
                            {currentScore} ➔ {nextScore}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={resetBonusAfterApply}
                  onChange={(e) => setResetBonusAfterApply(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Đặt lại điểm thi đua về 0 sau khi cộng dồn thành công</span>
              </label>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAccumulateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const updatedStudents = (currentClass.students || []).map((st) => {
                      const bonus = st.bonusPoints || 0;
                      if (bonus === 0) return st;

                      const scoreDelta = Math.round(bonus * accumulateRatio * 10) / 10;
                      const currentScore = (st as any)[accumulateTargetCol] ?? 0;
                      const newScore = Math.max(0, Math.min(10, Math.round((currentScore + scoreDelta) * 10) / 10));

                      const updatedSemesterDetail = {
                        ...(st.semester1Details || {}),
                        [accumulateTargetCol]: newScore,
                      };

                      return {
                        ...st,
                        [accumulateTargetCol]: newScore,
                        semester1Details: updatedSemesterDetail,
                        bonusPoints: resetBonusAfterApply ? 0 : st.bonusPoints,
                      };
                    });

                    const updatedClasses = classes.map((c) =>
                      c.id === currentClass.id ? { ...c, students: updatedStudents } : c
                    );

                    onUpdateTeacher({
                      ...teacher,
                      classes: updatedClasses,
                    });

                    setShowAccumulateModal(false);
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md cursor-pointer transition-all active:scale-95"
                >
                  Xác Nhận Cộng Vào Cột Điểm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận xóa học sinh */}
      {studentToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Xác Nhận Xóa Học Sinh</h3>
                  <p className="text-xs text-slate-500">Gỡ bỏ khỏi danh sách lớp {currentClass?.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              Thầy/Cô có chắc chắn muốn xóa học sinh <span className="font-bold text-slate-900">"{studentToDelete.name}"</span> (Mã: {studentToDelete.code}) khỏi danh sách lớp không?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-bold transition-all cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetId = studentToDelete.id;
                  setStudentToDelete(null);
                  handleDeleteStudent(targetId);
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-md shadow-rose-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác Nhận Xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận xóa cột điểm tùy chỉnh */}
      {columnToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Xóa Cột Tùy Chỉnh</h3>
                  <p className="text-xs text-slate-500">Xóa cột khỏi sổ điểm</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setColumnToDelete(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              Thầy/Cô có chắc chắn muốn xóa cột <span className="font-bold text-slate-900">"{columnToDelete}"</span> khỏi bảng điểm? Dữ liệu đã nhập trong cột này sẽ bị gỡ bỏ.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setColumnToDelete(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-bold transition-all cursor-pointer"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetCol = columnToDelete;
                  setColumnToDelete(null);
                  handleDeleteCustomColumn(targetCol);
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold shadow-md shadow-rose-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác Nhận Xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* DEDICATED ERGONOMIC MOBILE QUICK POINT ADJUSTER MODAL */}
      {quickPointStudent && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-2 sm:p-4 select-none animate-fade-in"
          onClick={() => setQuickPointStudent(null)}
        >
          <div
            className="bg-white rounded-3xl p-5 shadow-2xl max-w-md w-full border border-slate-200 space-y-4 animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Student Info & Close */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                  {quickPointStudent.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    {quickPointStudent.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-bold mt-0.5">
                    <span className="font-mono text-indigo-600">{quickPointStudent.code || 'HS'}</span>
                    <span>•</span>
                    <span>{quickPointStudent.group || 'Tổ 1'}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setQuickPointStudent(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Thi Đua Points Badge */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-black uppercase text-slate-600">
                Điểm Thi Đua Hiện Tại:
              </span>
              <span
                className={`font-mono font-black text-lg px-3 py-1 rounded-xl shadow-xs border ${
                  (quickPointStudent.bonusPoints || 0) > 0
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : (quickPointStudent.bonusPoints || 0) < 0
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {(quickPointStudent.bonusPoints || 0) > 0
                  ? `+${quickPointStudent.bonusPoints}đ`
                  : `${quickPointStudent.bonusPoints || 0}đ`}
              </span>
            </div>

            {/* Main Ergonomic Plus / Minus Buttons */}
            <div className="space-y-2">
              <span className="text-xs font-black uppercase text-indigo-700 block">
                Cộng / Trừ Điểm Nhanh (1 Chạm):
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if ('vibrate' in navigator) navigator.vibrate(30);
                    handleAdjustBonus(quickPointStudent.id, 1);
                    setQuickPointStudent((prev) =>
                      prev ? { ...prev, bonusPoints: (prev.bonusPoints || 0) + 1 } : null
                    );
                  }}
                  className="py-3 px-2 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer flex flex-col items-center gap-0.5"
                >
                  <span className="text-lg font-black">+1 ĐIỂM</span>
                  <span className="text-[10px] font-bold opacity-90">Phát biểu tốt</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if ('vibrate' in navigator) navigator.vibrate(35);
                    handleAdjustBonus(quickPointStudent.id, 2);
                    setQuickPointStudent((prev) =>
                      prev ? { ...prev, bonusPoints: (prev.bonusPoints || 0) + 2 } : null
                    );
                  }}
                  className="py-3 px-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer flex flex-col items-center gap-0.5"
                >
                  <span className="text-lg font-black">+2 ĐIỂM</span>
                  <span className="text-[10px] font-bold opacity-90">Làm bài xuất sắc</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if ('vibrate' in navigator) navigator.vibrate(40);
                    handleAdjustBonus(quickPointStudent.id, 5);
                    setQuickPointStudent((prev) =>
                      prev ? { ...prev, bonusPoints: (prev.bonusPoints || 0) + 5 } : null
                    );
                  }}
                  className="py-3 px-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex flex-col items-center gap-0.5"
                >
                  <span className="text-lg font-black">+5 ĐIỂM</span>
                  <span className="text-[10px] font-bold opacity-90">Thắng trò chơi</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if ('vibrate' in navigator) navigator.vibrate(25);
                    handleAdjustBonus(quickPointStudent.id, -1);
                    setQuickPointStudent((prev) =>
                      prev ? { ...prev, bonusPoints: (prev.bonusPoints || 0) - 1 } : null
                    );
                  }}
                  className="py-2.5 px-2 rounded-2xl bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 font-black text-xs active:scale-95 transition-all cursor-pointer flex flex-col items-center gap-0.5"
                >
                  <span className="text-base font-black">-1 ĐIỂM</span>
                  <span className="text-[9.5px] font-bold opacity-80">Nhắc nhở</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if ('vibrate' in navigator) navigator.vibrate(30);
                    handleAdjustBonus(quickPointStudent.id, -2);
                    setQuickPointStudent((prev) =>
                      prev ? { ...prev, bonusPoints: (prev.bonusPoints || 0) - 2 } : null
                    );
                  }}
                  className="py-2.5 px-2 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs shadow-md shadow-rose-500/20 active:scale-95 transition-all cursor-pointer flex flex-col items-center gap-0.5"
                >
                  <span className="text-base font-black">-2 ĐIỂM</span>
                  <span className="text-[9.5px] font-bold opacity-90">Chưa làm bài</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if ('vibrate' in navigator) navigator.vibrate(20);
                    handleAdjustBonus(quickPointStudent.id, 0.5);
                    setQuickPointStudent((prev) =>
                      prev ? { ...prev, bonusPoints: (prev.bonusPoints || 0) + 0.5 } : null
                    );
                  }}
                  className="py-2.5 px-2 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-black text-xs active:scale-95 transition-all cursor-pointer flex flex-col items-center gap-0.5"
                >
                  <span className="text-base font-black">+0.5 Đ</span>
                  <span className="text-[9.5px] font-bold opacity-80">Khích lệ</span>
                </button>
              </div>
            </div>

            {/* Quick Oral Score (Chấm điểm miệng: 5, 6, 7, 8, 9, 10) */}
            <div className="space-y-1.5 pt-1 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 block">
                Chấm điểm miệng trực tiếp (TX1):
              </span>
              <div className="grid grid-cols-6 gap-1.5 font-mono font-black text-sm">
                {[5, 6, 7, 8, 9, 10].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => {
                      if ('vibrate' in navigator) navigator.vibrate(30);
                      handleUpdateSemesterScore(
                        quickPointStudent.id,
                        activeSemester === 'hk2' ? 'hk2' : 'hk1',
                        'tx1',
                        score
                      );
                    }}
                    className={`py-2 rounded-xl border text-center transition-all cursor-pointer active:scale-90 ${
                      quickPointStudent.scores?.[activeSemester === 'hk2' ? 'hk2' : 'hk1']?.tx1 === score
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-100 hover:bg-indigo-50 text-slate-800 border-slate-200'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation: Next / Prev Student */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const sList = currentClass?.students || [];
                  const idx = sList.findIndex((s) => s.id === quickPointStudent.id);
                  if (idx > 0) {
                    setQuickPointStudent(sList[idx - 1]);
                  } else if (sList.length > 0) {
                    setQuickPointStudent(sList[sList.length - 1]);
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                ← HS Trước
              </button>

              <button
                type="button"
                onClick={() => setQuickPointStudent(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black transition-all cursor-pointer"
              >
                Xong
              </button>

              <button
                type="button"
                onClick={() => {
                  const sList = currentClass?.students || [];
                  const idx = sList.findIndex((s) => s.id === quickPointStudent.id);
                  if (idx >= 0 && idx < sList.length - 1) {
                    setQuickPointStudent(sList[idx + 1]);
                  } else if (sList.length > 0) {
                    setQuickPointStudent(sList[0]);
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <span>HS Sau</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
