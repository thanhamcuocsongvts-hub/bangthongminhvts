import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DEFAULT_LESSONS } from './data/defaultLessons';
import { DEFAULT_TEACHERS, ADMIN_TEACHER } from './data/defaultTeachers';
import {
  LessonDoc,
  RoomState,
  SlideItem,
  TextScale,
  ChatMessage,
  QuizQuestion,
  TeacherProfile,
  ClassRoom,
} from './types';
import { HeaderBar, ActiveTab } from './components/HeaderBar';
import { ClassroomBlackboardView } from './components/ClassroomBlackboardView';
import { PresentationView } from './components/PresentationView';
import { PPTPresentationMode } from './components/PPTPresentationMode';
import { DocumentReaderView } from './components/DocumentReaderView';
import { TouchWhiteboard } from './components/TouchWhiteboard';
import { FastWhiteboard } from './components/FastWhiteboard';
import { LiveQuizHub } from './components/LiveQuizHub';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { ClassGradebook } from './components/ClassGradebook';
import { DocumentLibrary } from './components/DocumentLibrary';
import { StorageManagementView } from './components/StorageManagementView';
import { ExamRoom } from './components/ExamRoom';
import { AITeacherAssistant } from './components/AITeacherAssistant';
import { ExportModal } from './components/ExportModal';
import { EducationalAuthScreen } from './components/EducationalAuthScreen';
import { EducationalGamesHub } from './components/EducationalGamesHub';
import { ExternalContentEmbedder } from './components/ExternalContentEmbedder';
import { AIQuizCreatorModal } from './components/AIQuizCreatorModal';
import { RandomStudentPickerModal } from './components/RandomStudentPickerModal';
import { TeacherProfileModal } from './components/TeacherProfileModal';
import { AIConfigModal } from './components/AIConfigModal';
import { AdminManagementModal } from './components/AdminManagementModal';
import { cleanStudentList } from './utils/studentFilter';
import { StudentMobilePortal } from './components/StudentMobilePortal';
import { QRCodeSVG } from 'qrcode.react';
import { loadLessonsFromDB, saveLessonsToDB, forceSyncLessonsToCloud, forcePullLessonsFromCloud, deleteLessonFromStorage } from './utils/storageUtils';
import { db, auth } from './lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { safeSetDoc } from './utils/firebaseSafe';
import { useDeviceDetection } from './hooks/useDeviceDetection';
import { PenTool, FolderOpen, Users, CheckSquare, Trophy, LogOut, Lock, Clock, User, ShieldCheck, Mail, Phone, School, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { TextToSpeechFloatingTooltip } from './components/TextToSpeechFloatingTooltip';

export default function App() {
  const { isMobile } = useDeviceDetection();
  // Check URL mode for student mobile access
  const [isStudentMode, setIsStudentMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'student';
  });

  const [studentRoomPin, setStudentRoomPin] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || '758899';
  });

  const syncTeachersToCloud = async (newTeachers: any[], immediate: boolean = false) => {
    setSyncStatus('syncing');
    if ((window as any).teacherSyncTimeout) clearTimeout((window as any).teacherSyncTimeout);

    const runSync = async () => {
      if (!navigator.onLine) {
        setSyncStatus('offline');
        return;
      }
      try {
        const sanitized = JSON.parse(JSON.stringify(newTeachers));
        await safeSetDoc(doc(db, 'global_store', 'smartboard_data'), { teachers: sanitized, updatedAt: new Date().toISOString() }, { merge: true });
        fetch('/api/teachers/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teachers: sanitized }),
        }).catch(() => {});
        setSyncStatus('synced');
      } catch (e) {
        console.warn('Sync to Firestore notice:', e);
        setSyncStatus('synced');
      }
    };

    if (immediate) {
      await runSync();
    } else {
      (window as any).teacherSyncTimeout = setTimeout(runSync, 1000);
    }
  };

  const pullTeachersFromCloud = async () => {
    setSyncStatus('syncing');
    try {
      const snap = await getDoc(doc(db, 'global_store', 'smartboard_data'));
      if (snap.exists() && snap.data().teachers) {
        const cloudTeachers = snap.data().teachers;
        setTeachers(cloudTeachers);
        localStorage.setItem('smartboard_teachers', JSON.stringify(cloudTeachers));
        setSyncStatus('synced');
        return;
      }
      const res = await fetch('/api/teachers/sync');
      if (res.ok) {
        const data = await res.json();
        if (data.teachers) {
          setTeachers(data.teachers);
          localStorage.setItem('smartboard_teachers', JSON.stringify(data.teachers));
          setSyncStatus('synced');
        }
      }
    } catch (e) {
      console.warn('Pull teachers error:', e);
      setSyncStatus('error');
    }
  };


  useEffect(() => {
    // Auto anonymous login to enable Firebase Storage uploads
    if (auth) { signInAnonymously(auth).catch(e => console.warn('Anon auth failed:', e)); }
  }, []);
  
  // Teachers State & Persistence
  const [teachers, setTeachers] = useState<TeacherProfile[]>(() => {
    const saved = localStorage.getItem('smartboard_teachers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const sanitized = parsed.map((t) => ({
            ...t,
            classes: (t.classes || []).map((c: any) => ({
              ...c,
              students: cleanStudentList(c.students || []),
            })),
          }));
          if (!sanitized.some((t: TeacherProfile) => t.id === 'teacher_admin_root' || t.username === 'admin')) {
            sanitized.unshift(ADMIN_TEACHER);
          }
          return sanitized;
        }
      } catch (e) {
        console.error('Failed to parse saved teachers', e);
      }
    }
    return DEFAULT_TEACHERS;
  });

  const [activeTeacherId, setActiveTeacherId] = useState<string>(() => {
    return localStorage.getItem('smartboard_active_teacher') || '';
  });

  const [isGuestMode, setIsGuestMode] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline' | 'error'>('synced');
  const [guestTeacherData, setGuestTeacherData] = useState<TeacherProfile | null>(null);

  const activeTeacher = isGuestMode 
    ? guestTeacherData 
    : (teachers || []).find((t) => t.id === activeTeacherId) || null;

  const pendingTeachersCount = useMemo(() => {
    return (teachers || []).filter((t) => t.status === 'pending').length;
  }, [teachers]);

  // Guest mode cleanup on exit
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isGuestMode) {
        // We do not save guest data anywhere, it is naturally lost.
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isGuestMode]);

  // Sync teachers across devices (PC <-> Mobile)
  useEffect(() => {
    const handleOnline = () => setSyncStatus('synced');
    const handleOffline = () => setSyncStatus('offline');
    const handleSyncStatus = (e: any) => setSyncStatus(e.detail);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sync-status', handleSyncStatus);
    
    if (!navigator.onLine) setSyncStatus('offline');
    // Subscribe to realtime updates
    const unsub = onSnapshot(doc(db, 'global_store', 'smartboard_data'), (docSnap) => {
       if (docSnap.exists() && docSnap.data().teachers) {
          const cloudTeachers = docSnap.data().teachers;
          // Trust the cloud as the absolute source of truth for cross-device sync
          setTeachers(cloudTeachers);
          localStorage.setItem('smartboard_teachers', JSON.stringify(cloudTeachers));
       }
    }, (err) => {
       console.warn('[Smartboard] Data onSnapshot notice:', err?.message);
    });

    const unsubLessons = onSnapshot(doc(db, 'global_store', 'smartboard_lessons'), (docSnap) => {
       if (docSnap.exists() && docSnap.data().lessons) {
          const cloudLessons = docSnap.data().lessons;
          if (Array.isArray(cloudLessons)) {
            // Read fresh set of deleted lessons to prevent resurrecting deleted documents
            let delIds = new Set<string>();
            let delTitles = new Set<string>();
            try {
              const savedDel = localStorage.getItem('smartboard_deleted_lessons');
              if (savedDel) {
                const p = JSON.parse(savedDel);
                delIds = new Set(p.ids || []);
                delTitles = new Set(p.titles || []);
              }
            } catch {}

            const nonDeletedCloud = cloudLessons.filter((c: any) => {
              if (!c || !c.id) return false;
              if (delIds.has(c.id)) return false;
              const titleKey = c.title?.trim().toLowerCase();
              if (titleKey && delTitles.has(titleKey)) return false;
              const fileKey = c.fileName?.trim().toLowerCase();
              if (fileKey && delTitles.has(fileKey)) return false;
              return true;
            });

            setLessons((prev) => {
              const localMap = new Map<string, any>();
              prev.forEach((l) => localMap.set(l.id, l));

              const cloudIds = new Set(nonDeletedCloud.map((c: any) => c.id));

              // 1. Merge cloud lessons, preserving local rich data (dataUrls, rawText, slides)
              const mergedCloud = nonDeletedCloud.map((cloudL: any) => {
                if (localMap.has(cloudL.id)) {
                  const localL = localMap.get(cloudL.id);
                  return {
                    ...cloudL,
                    fileUrl: localL.fileUrl || cloudL.fileUrl,
                    rawText: localL.rawText || cloudL.rawText,
                    slides: (localL.slides && localL.slides.length > 0) ? localL.slides : cloudL.slides,
                  };
                }
                return cloudL;
              });

              // 2. CRITICAL BUGFIX: Never drop local user-uploaded/opened lessons, unless explicitly deleted
              const localOnly = prev.filter(
                (l) =>
                  !cloudIds.has(l.id) &&
                  !delIds.has(l.id) &&
                  (!l.title || !delTitles.has(l.title.trim().toLowerCase())) &&
                  (!l.fileName || !delTitles.has(l.fileName.trim().toLowerCase()))
              );
              const allLessons = [...localOnly, ...mergedCloud];

              try {
                localStorage.setItem('smartboard_lessons', JSON.stringify(allLessons));
              } catch {}
              // NOTE: Do not call saveLessonsToDB here to avoid infinite onSnapshot write loops
              return allLessons;
            });
          }
       }
       setIsLessonsLoaded(true);
    }, (err) => {
       console.warn('[Smartboard] Lessons onSnapshot notice:', err?.message);
       setIsLessonsLoaded(true);
    });

    return () => {
      unsub();
      unsubLessons();
    };
  }, []);

  // Lessons State & Persistence
  const [lessons, setLessons] = useState<LessonDoc[]>(() => {
    const saved = localStorage.getItem('smartboard_lessons');
    if (saved) {
      try {
        const parsed: any[] = JSON.parse(saved);
        // Automatically sanitize any binary artifacts or invalid entries from prior uploads
        return parsed
          .filter((les) => les && les.id && typeof les.title === 'string' && les.title.trim().length > 0 && !('username' in les) && !('classes' in les))
          .map((les: LessonDoc) => {
            let cleanRaw = les.rawText || '';
            if (
              cleanRaw.startsWith('%PDF-') ||
              cleanRaw.includes('/Filter/FlateDecode') ||
              cleanRaw.includes('obj\n<<') ||
              cleanRaw.includes('/Type/XObject')
            ) {
              cleanRaw = `Tài liệu: ${les.title}\nĐịnh dạng: Tệp PDF (${les.fileSize || 'Tệp đính kèm'})\n• Tệp đã sẵn sàng hiển thị trên SmartBoard 75 Pro.\n• Thầy/Cô có thể xem trực tiếp tệp gốc hoặc bật Chế Độ Chia Đôi Bảng (Split View).`;
            }
            const cleanSlides = (les.slides || []).filter((s) => {
              const c = s.content || '';
              return !c.startsWith('%PDF-') && !c.includes('/Filter/FlateDecode') && !c.includes('obj\n<<');
            });
            return {
              ...les,
              rawText: cleanRaw,
              slides: cleanSlides,
            };
          });
      } catch (e) {
        console.error('Failed to parse saved lessons', e);
      }
    }
    return DEFAULT_LESSONS;
  });

  const [activeLessonId, setActiveLessonId] = useState<string>(() => {
    return localStorage.getItem('smartboard_active_lesson') || (DEFAULT_LESSONS[0]?.id || '');
  });

  const [activeOpenedLesson, setActiveOpenedLesson] = useState<LessonDoc | null>(() => {
    const saved = localStorage.getItem('smartboard_active_lesson_obj');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return null;
  });

  const emptyFallbackLesson: LessonDoc = {
    id: 'empty_lesson',
    title: 'Chưa có tài liệu bài giảng',
    subject: activeTeacher?.subject || 'Khác',
    grade: 'Lớp 10',
    lastModified: new Date().toISOString(),
    syncedToCloud: true,
    author: activeTeacher?.name || 'Giáo viên',
    rawText: 'Chưa có tài liệu nào được mở. Thầy/Cô hãy tải lên tài liệu (Word, Excel, PDF, JSON) hoặc chọn từ danh sách để bắt đầu bài giảng.',
    slides: [],
    quizzes: [],
  };

  const currentLesson = useMemo(() => {
    if (activeOpenedLesson) {
      const found = (lessons || []).find((l) => l.id === activeOpenedLesson.id);
      return found ? { ...activeOpenedLesson, ...found } : activeOpenedLesson;
    }
    const found = (lessons || []).find((l) => l.id === activeLessonId);
    if (found) return found;
    if (lessons && lessons.length > 0) return lessons[0];
    return emptyFallbackLesson;
  }, [activeOpenedLesson, lessons, activeLessonId]);

  // Active Tab & Display Settings (Defaults to Classroom Blackboard on TV, PC and Mobile)
  const [activeTab, setActiveTab] = useState<ActiveTab>('whiteboard');
  const [textScale, setTextScale] = useState<TextScale>('large'); // Default 125% for 75" TV
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showQRModal, setShowQRModal] = useState<boolean>(false);
  const [showTeacherAuthModal, setShowTeacherAuthModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [showRandomPickerModal, setShowRandomPickerModal] = useState<boolean>(false);
  const [pickerClassroom, setPickerClassroom] = useState<ClassRoom | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isGeneratingAIQuiz, setIsGeneratingAIQuiz] = useState<boolean>(false);
  const [showAIQuizModal, setShowAIQuizModal] = useState<boolean>(false);
  const [showAIConfigModal, setShowAIConfigModal] = useState<boolean>(false);

  // AI Chat Messages
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: 'Xin chào Thầy/Cô! Tôi là Trợ Lý AI trên SmartBoard 75 Pro. Tôi đã nạp toàn bộ tài liệu bài giảng hiện tại và sẵn sàng hỗ trợ giải đáp thắc mắc, trích xuất định lý trọng tâm hoặc tạo nhanh câu hỏi trắc nghiệm tức thì ngay trong giờ dạy.',
      timestamp: 'Vừa xong',
    },
  ]);
  const [isAILoading, setIsAILoading] = useState<boolean>(false);
  const [isLessonsLoaded, setIsLessonsLoaded] = useState<boolean>(false);

  // Load lessons from Cloud Server & high-capacity IndexedDB on mount
  useEffect(() => {
    loadLessonsFromDB()
      .then((dbLessons) => {
        if (dbLessons && dbLessons.length > 0) {
          setLessons((prev) => {
            const validDb = dbLessons.filter(
              (l: any) => l && l.id && typeof l.title === 'string' && l.title.trim().length > 0 && !('username' in l) && !('classes' in l)
            );
            const dbIds = new Set(validDb.map((d: any) => d.id));
            const freshLocal = prev.filter((p) => !dbIds.has(p.id) && p && p.id && !('username' in p));
            return [...freshLocal, ...validDb];
          });
        }
      })
      .catch((err) => {
        console.warn('IndexedDB initial load note:', err);
      })
      .finally(() => setIsLessonsLoaded(true));
  }, []);

    // Save to LocalStorage & IndexedDB (Bypassing browser 5MB quota with IndexedDB)
  useEffect(() => {
    if (isGuestMode || !isLessonsLoaded) return;
    try {
      localStorage.setItem('smartboard_lessons', JSON.stringify(lessons));
    } catch (e) {
      console.warn('localStorage quota exceeded, stored in IndexedDB capacity storage', e);
    }
    saveLessonsToDB(lessons).catch((err) => {
      console.error('Failed to sync to IndexedDB:', err);
    });
  }, [lessons, isGuestMode, isLessonsLoaded]);

  useEffect(() => {
    if (isGuestMode) return;
    localStorage.setItem('smartboard_active_lesson', activeLessonId);
  }, [activeLessonId, isGuestMode]);

  // Open temporary lesson for presentation without saving to Document Library
  const handleOpenTemporaryLesson = useCallback((lesson: LessonDoc) => {
    setActiveOpenedLesson(lesson);
    setActiveLessonId(lesson.id);
  }, []);

  // Explicitly Save Lesson to Document Library (Kho bài giảng)
  const handleSaveToLibrary = useCallback((lessonToSave: LessonDoc) => {
    const docWithAuthor: LessonDoc = {
      ...lessonToSave,
      author: activeTeacher?.name || lessonToSave.author || 'Giáo viên',
      lastModified: new Date().toISOString(),
    };
    setActiveOpenedLesson(docWithAuthor);
    setActiveLessonId(docWithAuthor.id);
    try {
      localStorage.setItem('smartboard_active_lesson', docWithAuthor.id);
      localStorage.setItem('smartboard_active_lesson_obj', JSON.stringify({
        id: docWithAuthor.id,
        title: docWithAuthor.title,
        fileName: docWithAuthor.fileName,
        fileUrl: docWithAuthor.fileUrl,
        fileType: docWithAuthor.fileType,
        subject: docWithAuthor.subject,
        grade: docWithAuthor.grade,
        slides: docWithAuthor.slides,
        rawText: docWithAuthor.rawText,
      }));
    } catch {}
    setLessons((prev) => {
      const idx = prev.findIndex((l) => l.id === docWithAuthor.id);
      let next: LessonDoc[];
      if (idx >= 0) {
        next = prev.map((l) => (l.id === docWithAuthor.id ? { ...l, ...docWithAuthor } : l));
      } else {
        next = [docWithAuthor, ...prev];
      }
      try {
        localStorage.setItem('smartboard_lessons', JSON.stringify(next));
      } catch {}
      saveLessonsToDB(next).catch(() => {});
      return next;
    });
  }, [activeTeacher]);

  // Clean library from corrupted or redundant items
  const handleCleanLibrary = useCallback(() => {
    setLessons((prev) => {
      const valid = (prev || []).filter(
        (l) => l && l.id && typeof l.title === 'string' && l.title.trim().length > 0 && !('username' in l) && !('classes' in l)
      );
      const seen = new Set<string>();
      const deduped: LessonDoc[] = [];
      for (const item of valid) {
        const key = item.title.trim().toLowerCase();
        if (key === 'tài liệu bài giảng đính kèm.' && (!item.slides || item.slides.length === 0) && !item.fileUrl) {
          continue;
        }
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(item);
        }
      }
      try {
        localStorage.setItem('smartboard_lessons', JSON.stringify(deduped));
      } catch {}
      saveLessonsToDB(deduped).catch(() => {});
      return deduped;
    });
  }, []);

  // Centralized Lesson Delete Handler: Permanently cleans from memory, storage, backend & cloud
  const handleDeleteLesson = useCallback(async (id: string, lessonTitle?: string) => {
    // 1. Resolve lesson being deleted
    const target = lessons.find((l) => l.id === id);
    const titleKey = (lessonTitle || target?.title || '').trim().toLowerCase();
    const fileKey = (target?.fileName || '').trim().toLowerCase();

    // 2. Persistently record in smartboard_deleted_lessons so onSnapshot will never bring it back
    try {
      let delIds: string[] = [];
      let delTitles: string[] = [];
      const saved = localStorage.getItem('smartboard_deleted_lessons');
      if (saved) {
        const p = JSON.parse(saved);
        delIds = p.ids || [];
        delTitles = p.titles || [];
      }
      if (!delIds.includes(id)) delIds.push(id);
      if (titleKey && !delTitles.includes(titleKey)) delTitles.push(titleKey);
      if (fileKey && !delTitles.includes(fileKey)) delTitles.push(fileKey);
      localStorage.setItem('smartboard_deleted_lessons', JSON.stringify({ ids: delIds, titles: delTitles }));
    } catch {}

    // 3. Clear active opened lesson if matching
    if (activeOpenedLesson && (activeOpenedLesson.id === id || (titleKey && activeOpenedLesson.title?.trim().toLowerCase() === titleKey))) {
      setActiveOpenedLesson(null);
      try {
        localStorage.removeItem('smartboard_active_lesson_obj');
      } catch {}
    }

    // 4. Update local lessons state
    let remainingLessons: LessonDoc[] = [];
    setLessons((prev) => {
      const next = prev.filter(
        (l) =>
          l.id !== id &&
          (!titleKey || l.title?.trim().toLowerCase() !== titleKey) &&
          (!fileKey || l.fileName?.trim().toLowerCase() !== fileKey)
      );
      remainingLessons = next;
      if (activeLessonId === id) {
        const nextId = next.length > 0 ? next[0].id : '';
        setActiveLessonId(nextId);
        try {
          localStorage.setItem('smartboard_active_lesson', nextId);
        } catch {}
      }
      try {
        localStorage.setItem('smartboard_lessons', JSON.stringify(next));
      } catch {}
      return next;
    });

    // 5. Permanently remove from IndexedDB, server API, and Firestore global_store immediately
    try {
      await deleteLessonFromStorage(id, remainingLessons, lessonTitle || target?.title, target?.fileName);
    } catch (storageErr) {
      console.warn('Permanent lesson storage cleanup notice:', storageErr);
    }
  }, [lessons, activeOpenedLesson, activeLessonId]);

  // Centralized Lesson Selector (Selects active lesson without auto-saving foreign files into library)
  const handleSelectLesson = useCallback((lesson: LessonDoc) => {
    setActiveOpenedLesson(lesson);
    setActiveLessonId(lesson.id);
    try {
      localStorage.setItem('smartboard_active_lesson', lesson.id);
      localStorage.setItem('smartboard_active_lesson_obj', JSON.stringify({
        id: lesson.id,
        title: lesson.title,
        fileName: lesson.fileName,
        fileUrl: lesson.fileUrl,
        fileType: lesson.fileType,
        subject: lesson.subject,
        grade: lesson.grade,
        slides: lesson.slides,
        rawText: lesson.rawText,
      }));
    } catch {}
  }, []);

  // Check if current lesson is saved in library
  const isCurrentLessonSavedInLibrary = useMemo(() => {
    return Boolean(currentLesson && lessons.some((l) => l.id === currentLesson.id));
  }, [currentLesson, lessons]);

  useEffect(() => {
    if (isGuestMode) return;
    localStorage.setItem('smartboard_teachers', JSON.stringify(teachers));
  }, [teachers, isGuestMode]);

  useEffect(() => {
    if (isGuestMode) return;
    localStorage.setItem('smartboard_active_teacher', activeTeacherId);
  }, [activeTeacherId, isGuestMode]);

  // Fetch Room State from backend periodically
  const fetchRoom = useCallback(async (pin: string = '758899') => {
    try {
      const res = await fetch(`/api/rooms/${pin}`);
      if (res.ok) {
        const data = await res.json();
        setRoomState(data);
      }
    } catch (e) {
      console.warn('Could not fetch room', e);
    }
  }, []);

  useEffect(() => {
    fetchRoom('758899');
    const interval = setInterval(() => fetchRoom('758899'), 2500);
    return () => clearInterval(interval);
  }, [fetchRoom]);

  // Fullscreen toggle & Listener
  useEffect(() => {
    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    document.addEventListener('webkitfullscreenchange', handleFSChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFSChange);
      document.removeEventListener('webkitfullscreenchange', handleFSChange);
    };
  }, []);

  useEffect(() => {
    const handleToggle = () => handleToggleFullscreen();
    window.addEventListener('toggle-app-fullscreen', handleToggle);
    return () => window.removeEventListener('toggle-app-fullscreen', handleToggle);
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  // Sync Room with active lesson questions when switching lesson
  useEffect(() => {
    if (currentLesson && currentLesson.quizzes?.length > 0) {
      fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: '758899',
          title: currentLesson.title,
          questions: currentLesson.quizzes,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.room) setRoomState(data.room);
        })
        .catch((e) => console.warn('Sync room error', e));
    }
  }, [activeLessonId, currentLesson]);

  // Real Cloud Sync to Server & Firestore
  const handleSyncToCloud = async () => {
    setIsSyncingCloud(true);
    try {
      await forceSyncLessonsToCloud(lessons);
      setSyncStatus('synced');
    } catch (err) {
      console.error('Cloud sync error:', err);
      setSyncStatus('error');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handlePullLessonsFromCloud = async () => {
    setIsSyncingCloud(true);
    try {
      const pulled = await forcePullLessonsFromCloud();
      if (pulled && pulled.length > 0) {
        setLessons(pulled);
      }
      setSyncStatus('synced');
    } catch (err) {
      console.error('Cloud pull error:', err);
      setSyncStatus('error');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Send message to AI Backend with specific Scope (Page, Slide, Chapter, or Full Document)
  const handleSendAIMessage = async (text: string, customContext?: string, scopeTitle?: string) => {
    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: scopeTitle ? `[Phạm vi: ${scopeTitle}]\n${text}` : text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setIsAILoading(true);

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          contextText: customContext || currentLesson.rawText,
          topic: scopeTitle ? `${currentLesson.title} (${scopeTitle})` : currentLesson.title,
        }),
      });

      const data = await res.json();
      const aiReply = data.reply || 'Không nhận được câu trả lời từ máy chủ AI.';

      const botMsg: ChatMessage = {
        id: 'msg_ai_' + Date.now(),
        sender: 'assistant',
        text: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, botMsg]);
    } catch (e: any) {
      const errorMsg: ChatMessage = {
        id: 'msg_err_' + Date.now(),
        sender: 'assistant',
        text: 'Lỗi kết nối AI: ' + (e.message || 'Vui lòng kiểm tra lại mạng.'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAILoading(false);
    }
  };

  // Generate instant quiz from active lesson content using AI
  const handleCreateAIQuiz = async () => {
    try {
      setIsGeneratingAIQuiz(true);
      const res = await fetch('/api/ai/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: currentLesson.rawText,
          count: 3,
          subject: currentLesson.subject,
        }),
      });

      const data = await res.json();
      const generatedQuestions: QuizQuestion[] = data.questions || [];

      if (generatedQuestions.length > 0) {
        const updatedQuizzes = [...(currentLesson.quizzes || []), ...generatedQuestions];
        const updatedLessons = lessons.map((l) =>
          l.id === currentLesson.id ? { ...l, quizzes: updatedQuizzes } : l
        );
        setLessons(updatedLessons);

        await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pin: '758899',
            title: currentLesson.title,
            questions: updatedQuizzes,
          }),
        });

        fetchRoom('758899');
        setActiveTab('quiz');
      }
    } catch (e) {
      console.error('Create AI Quiz error:', e);
      alert('Không thể tạo câu hỏi trắc nghiệm tự động. Vui lòng thử lại.');
    } finally {
      setIsGeneratingAIQuiz(false);
    }
  };

  // Update teacher data (e.g. from Gradebook)
    const handleUpdateActiveTeacher = (updatedTeacher: TeacherProfile) => {
    if (isGuestMode) {
      setGuestTeacherData(updatedTeacher);
      return;
    }
    setTeachers((prev) => {
      const next = prev.map((t) => (t.id === updatedTeacher.id ? updatedTeacher : t));
      localStorage.setItem('smartboard_teachers', JSON.stringify(next));
      syncTeachersToCloud(next);

      // CRITICAL: Synchronize directly with the server so other computers/devices instantly get the class and student list!
      syncTeachersToCloud(next);
      return next;
    });
  };

  // Delete Teacher (Admin)
  const handleDeleteTeacher = (teacherId: string) => {
    setTeachers((prev) => {
      const next = prev.filter((t) => t.id !== teacherId);
      localStorage.setItem('smartboard_teachers', JSON.stringify(next));
      syncTeachersToCloud(next);
      return next;
    });
    if (activeTeacherId === teacherId) {
      setActiveTeacherId('');
      localStorage.removeItem('smartboard_active_teacher');
    }
  };

  // Reset Password for Teacher (Admin)
  const handleResetPassword = (teacherId: string, newPassword: string = '123456') => {
    setTeachers((prev) => {
      const next = prev.map((t) => (t.id === teacherId ? { ...t, password: newPassword } : t));
      localStorage.setItem('smartboard_teachers', JSON.stringify(next));
      syncTeachersToCloud(next);
      return next;
    });
  };

  // Logout Teacher
  const handleLogout = () => {
    if (isGuestMode) {
      setIsGuestMode(false);
      setGuestTeacherData(null);
    }
    setActiveTeacherId('');
    localStorage.removeItem('smartboard_active_teacher');
    setShowTeacherAuthModal(false);
  };

  // Add bonus points or oral score from Random Student Picker
  const handleAddBonusPointFromPicker = (studentId: string, amount: number) => {
    if (!activeTeacher) return;
    const targetClass = pickerClassroom || activeTeacher.classes?.[0];
    if (!targetClass) return;

    const updatedStudents = (targetClass.students || []).map((st) =>
      st.id === studentId
        ? {
            ...st,
            bonusPoints: (st.bonusPoints || 0) + amount,
            isCalled: true,
          }
        : st
    );

    const updatedClasses = (activeTeacher.classes || []).map((c) =>
      c.id === targetClass.id ? { ...c, students: updatedStudents } : c
    );

    handleUpdateActiveTeacher({
      ...activeTeacher,
      classes: updatedClasses,
    });
  };

  const handleSetOralScoreFromPicker = (studentId: string, score: number) => {
    if (!activeTeacher) return;
    const targetClass = pickerClassroom || activeTeacher.classes?.[0];
    if (!targetClass) return;

    const updatedStudents = (targetClass.students || []).map((st) =>
      st.id === studentId
        ? {
            ...st,
            oralScore: score,
            isCalled: true,
          }
        : st
    );

    const updatedClasses = (activeTeacher.classes || []).map((c) =>
      c.id === targetClass.id ? { ...c, students: updatedStudents } : c
    );

    handleUpdateActiveTeacher({
      ...activeTeacher,
      classes: updatedClasses,
    });
  };

  // Switch to student mobile portal
  if (isStudentMode) {
    return (
      <StudentMobilePortal
        initialPin={studentRoomPin}
        onExitStudentMode={() => {
          setIsStudentMode(false);
          const url = new URL(window.location.href);
          url.searchParams.delete('mode');
          url.searchParams.delete('room');
          window.history.pushState({}, '', url.toString());
        }}
      />
    );
  }

  // If not logged in, show educational login/register portal
  if (!activeTeacher) {
    return (
            <EducationalAuthScreen
        isModal={false}
        teachers={teachers}
        activeTeacher={null}
        onSelectTeacher={(t) => {
          setActiveTeacherId(t.id);
          localStorage.setItem('smartboard_active_teacher', t.id);
          setActiveTab('whiteboard');
        }}
        onAddNewTeacher={(newT) => {
          setTeachers((prev) => {
            const next = [...prev, newT];
            localStorage.setItem('smartboard_teachers', JSON.stringify(next));
            syncTeachersToCloud(next);
            return next;
          });
          
          setActiveTeacherId(newT.id);
          localStorage.setItem('smartboard_active_teacher', newT.id);
          setActiveTab('whiteboard');
        }}
        onLogout={handleLogout}
        onGuestLogin={() => {
          setIsGuestMode(true);
          setGuestTeacherData({
            id: 'guest',
            name: 'Khách (Dùng thử)',
            username: 'guest',
            email: 'guest@smartboard.local',
            phone: '',
            subject: 'Khác',
            school: '',
            avatar: '👤',
            classes: [],
            createdAt: new Date().toISOString(),
          });
          setActiveTab('whiteboard');
        }}
      />
    );
  }

  // YÊU CẦU NGƯỜI DÙNG: "Chổ tài khoản bị khóa không bấm vào được. hãy mở để có thể bấm đăng xuất và xem thông tin"
  // Khi tài khoản ở trạng thái 'pending' (chờ duyệt) hoặc 'locked' (tạm khóa):
  // Hiển thị giao diện thông báo trạng thái tài khoản trang trọng, ĐẦY ĐỦ các nút bấm để ĐĂNG XUẤT, XEM THÔNG TIN, HOẶC ĐĂNG NHẬP ADMIN ĐỂ DUYỆT!
  if (!isGuestMode && activeTeacher && activeTeacher.role !== 'admin' && (activeTeacher.status === 'pending' || activeTeacher.status === 'locked')) {
    const isPending = activeTeacher.status === 'pending';
    return (
      <div className="w-screen min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white flex flex-col justify-between p-4 sm:p-6 md:p-10 select-none overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10 max-w-4xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-white shadow-md">
              <School className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="text-[10px] font-black tracking-widest text-indigo-400 uppercase">
                SMARTBOARD 75 PRO
              </div>
              <div className="text-base font-black text-white">
                Cổng Quản Lý Hồ Sơ Giáo Viên
              </div>
            </div>
          </div>

          {/* Teacher Badge & Quick Logout */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs transition-all cursor-pointer shadow-xs active:scale-95"
              title="Bấm để xem hồ sơ giáo viên"
            >
              <span className="text-base">{activeTeacher.avatar || '👨‍🏫'}</span>
              <span className="truncate max-w-[120px] font-black">{activeTeacher.name}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition-all cursor-pointer shadow-md shadow-rose-600/30 active:scale-95"
              title="Đăng xuất khỏi tài khoản này ngay"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng Xuất</span>
            </button>
          </div>
        </div>

        {/* Central Status Card */}
        <div className="max-w-2xl mx-auto w-full my-auto py-8">
          <div className="bg-white text-slate-800 rounded-3xl border border-slate-200/80 shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Status Header Badge */}
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-md ${
                isPending ? 'bg-amber-100 text-amber-600 border border-amber-300 ring-4 ring-amber-400/20' : 'bg-rose-100 text-rose-600 border border-rose-300 ring-4 ring-rose-400/20'
              }`}>
                {isPending ? <Clock className="w-8 h-8 text-amber-600 animate-pulse" /> : <Lock className="w-8 h-8 text-rose-600" />}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {isPending ? 'Tài Khoản Đang Chờ Phê Duyệt' : 'Tài Khoản Đang Bị Tạm Khóa'}
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    isPending ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-rose-100 text-rose-900 border border-rose-300'
                  }`}>
                    {isPending ? 'CHỜ ADMIN DUYỆT' : 'TẠM KHÓA'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                  {isPending
                    ? 'Hồ sơ giáo viên của Thầy/Cô đã được ghi nhận trên SmartBoard và đang chờ Quản trị viên (Admin) xét duyệt để kích hoạt giảng dạy.'
                    : 'Tài khoản của Thầy/Cô đang trong trạng thái tạm khóa. Vui lòng liên hệ Quản trị viên hoặc quản lý nhà trường để mở khóa.'}
                </p>
              </div>
            </div>

            {/* Profile Information Box (Xem thông tin) */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3">
              <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="flex items-center gap-1.5 text-indigo-700">
                  <User className="w-4 h-4" />
                  THÔNG TIN TÀI KHOẢN GIÁO VIÊN
                </span>
                <span className="text-[11px] text-slate-400 font-normal">
                  Mã: {activeTeacher.id}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div
                  onClick={() => setShowProfileModal(true)}
                  className="p-2 -m-1 rounded-xl hover:bg-indigo-50/80 transition-all cursor-pointer group border border-transparent hover:border-indigo-200"
                  title="Bấm để xem & chỉnh sửa hồ sơ giáo viên"
                >
                  <span className="text-slate-400 group-hover:text-indigo-600 font-medium flex items-center justify-between">
                    <span>Họ và Tên:</span>
                    <span className="text-[10px] text-indigo-500 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Xem hồ sơ &rarr;</span>
                  </span>
                  <div className="font-bold text-slate-900 group-hover:text-indigo-700 text-sm mt-0.5">{activeTeacher.name}</div>
                </div>

                <div>
                  <span className="text-slate-400 font-medium">Tên đăng nhập (Username):</span>
                  <div className="font-bold text-indigo-700 font-mono mt-0.5">{activeTeacher.username || activeTeacher.id}</div>
                </div>

                <div>
                  <span className="text-slate-400 font-medium">Bộ môn giảng dạy:</span>
                  <div className="font-bold text-slate-800 mt-0.5">{activeTeacher.subject}</div>
                </div>

                <div>
                  <span className="text-slate-400 font-medium">Đơn vị trường học:</span>
                  <div className="font-bold text-slate-800 mt-0.5">{activeTeacher.school || 'Trường THPT'}</div>
                </div>

                <div>
                  <span className="text-slate-400 font-medium">Địa chỉ Email:</span>
                  <div className="font-bold text-slate-800 mt-0.5">{activeTeacher.email}</div>
                </div>

                <div>
                  <span className="text-slate-400 font-medium">Số điện thoại:</span>
                  <div className="font-bold text-slate-800 mt-0.5">{activeTeacher.phone || 'Chưa cập nhật'}</div>
                </div>
              </div>
            </div>

            {/* Action Buttons Section */}
            <div className="space-y-2.5 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Button 1: Xem & Sửa Thông Tin */}
                <button
                  type="button"
                  onClick={() => setShowProfileModal(true)}
                  className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/25 active:scale-98 transition-all cursor-pointer"
                >
                  <User className="w-4 h-4" />
                  <span>Xem & Cập Nhật Hồ Sơ</span>
                </button>

                {/* Button 2: Đăng Xuất */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-3 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black text-xs flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng Xuất Tài Khoản</span>
                </button>
              </div>

              {/* Button 3: Chuyển sang tài khoản Quản trị viên để duyệt ngay */}
              <button
                type="button"
                onClick={() => {
                  setActiveTeacherId('teacher_admin_root');
                  localStorage.setItem('smartboard_active_teacher', 'teacher_admin_root');
                  setShowAdminModal(true);
                }}
                className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-98 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Đăng Nhập Quản Trị Viên (Admin) Để Phê Duyệt Ngay</span>
              </button>

              {/* Button 4: Dùng thử Guest */}
              <button
                type="button"
                onClick={() => {
                  setIsGuestMode(true);
                  setGuestTeacherData({
                    id: 'guest',
                    name: 'Khách (Dùng thử)',
                    username: 'guest',
                    email: 'guest@smartboard.local',
                    phone: '',
                    subject: 'Khác',
                    school: '',
                    avatar: '👤',
                    classes: [],
                    createdAt: new Date().toISOString(),
                  });
                  setActiveTab('whiteboard');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span>Dùng Thử Bảng Thông Minh Ngay (Chế độ Khách)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-indigo-200/60 pb-2">
          Hệ Thống Bảng Tương Tác Giảng Dạy & Sổ Điểm Sư Phạm 75 Inch • Phát triển bởi Thầy Trịnh Tuấn Kiệt
        </div>

        {/* Include modals if triggered */}
        {showProfileModal && (
          <TeacherProfileModal
            isOpen={showProfileModal}
            onClose={() => setShowProfileModal(false)}
            teacher={activeTeacher}
            onUpdateTeacher={handleUpdateActiveTeacher}
            onLogout={handleLogout}
            onOpenAccountSwitcher={() => {
              setShowProfileModal(false);
              setShowTeacherAuthModal(true);
            }}
            onOpenAdminPanel={() => {
              setShowProfileModal(false);
              setShowAdminModal(true);
            }}
          />
        )}

        {showAdminModal && (
          <AdminManagementModal
            isOpen={showAdminModal}
            onClose={() => setShowAdminModal(false)}
            teachers={teachers}
            activeTeacher={activeTeacher}
            onDeleteTeacher={(id) => {
              const next = teachers.filter((t) => t.id !== id);
              setTeachers(next);
              localStorage.setItem('smartboard_teachers', JSON.stringify(next));
              syncTeachersToCloud(next);
            }}
            onResetPassword={(id, newPassword) => {
              const next = teachers.map((t) => (t.id === id ? { ...t, password: newPassword || '123456' } : t));
              setTeachers(next);
              localStorage.setItem('smartboard_teachers', JSON.stringify(next));
              syncTeachersToCloud(next);
            }}
            onUpdateTeacher={(updated) => {
              const next = teachers.map((t) => (t.id === updated.id ? updated : t));
              setTeachers(next);
              localStorage.setItem('smartboard_teachers', JSON.stringify(next));
              syncTeachersToCloud(next);
            }}
            onAddNewTeacher={(newT) => {
              setTeachers((prev) => {
                const next = [...prev, newT];
                localStorage.setItem('smartboard_teachers', JSON.stringify(next));
                syncTeachersToCloud(next);
                return next;
              });
            }}
            onSelectTeacher={(t) => {
              setActiveTeacherId(t.id);
              localStorage.setItem('smartboard_active_teacher', t.id);
              setShowAdminModal(false);
            }}
          />
        )}
      </div>
    );
  }

  const joinUrl = `${window.location.origin}/?mode=student&room=${roomState?.pin || '758899'}`;

  return (
    <div className="w-screen h-dvh flex flex-col bg-[#f8fafc] text-slate-800 overflow-hidden select-none">
      {/* 75-Inch Top Navigation Header Bar */}
      <HeaderBar
        syncStatus={syncStatus}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        textScale={textScale}
        onTextScaleChange={setTextScale}
        roomPin={roomState?.pin || '758899'}
        onOpenQR={() => setShowQRModal(true)}
        onOpenExport={() => setShowExportModal(true)}
        onOpenTeacherAuth={() => setShowTeacherAuthModal(true)}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenAdmin={() => setShowAdminModal(true)}
        onOpenRandomPicker={() => {
          setPickerClassroom(activeTeacher?.classes?.[0] || null);
          setShowRandomPickerModal(true);
        }}
        onSwitchToStudentView={() => setIsStudentMode(true)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        activeLessonTitle={currentLesson.title}
        activeTeacher={activeTeacher || null}
        onLogout={handleLogout}
        onOpenAIConfig={() => setShowAIConfigModal(true)}
        pendingTeachersCount={pendingTeachersCount}
      />

      {/* Main Interactive Screen Content */}
      <main className={`flex-1 ${
        activeTab === 'whiteboard' || activeTab === 'fast-whiteboard'
          ? 'p-2 sm:p-3 md:p-4 overflow-hidden bg-white'
          : isMobile
          ? 'p-2.5 pb-24 overflow-y-auto bg-[#f8fafc]'
          : 'p-3 md:p-4 overflow-hidden bg-[#f8fafc]'
      } relative`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full h-full"
          >
            {/* Tab 2: Document Reader View (Open Doc directly & AI Key Points) */}
            {activeTab === 'reader' && (
              <DocumentReaderView
                lesson={currentLesson}
                textScale={textScale}
                allLessons={lessons}
                onSelectLesson={handleSelectLesson}
                onAddNewLesson={handleSaveToLibrary}
                onOpenTemporaryLesson={handleOpenTemporaryLesson}
                onSaveToLibrary={handleSaveToLibrary}
                isSavedInLibrary={isCurrentLessonSavedInLibrary}
                onUpdateLesson={(updatedDoc) => {
                  setActiveOpenedLesson(updatedDoc);
                  if (lessons.some((l) => l.id === updatedDoc.id)) {
                    setLessons((prev) =>
                      prev.map((l) => (l.id === updatedDoc.id ? updatedDoc : l))
                    );
                  }
                }}
                onDeleteLesson={(id) => {
                  handleDeleteLesson(id);
                  setActiveTab('whiteboard');
                }}
                onLaunchSlides={() => setActiveTab('whiteboard')}
                onLaunchQuiz={() => setActiveTab('quiz')}
                onSendToAIChat={() => {}}
              />
            )}

            {/* Tab 3: Authentic Classroom Blackboard (Bảng Xanh Sư Phạm 75 Pro) */}
            {activeTab === 'whiteboard' && (
              <ClassroomBlackboardView
                classroom={activeTeacher?.classes?.[0] || null}
                activeTeacher={activeTeacher || null}
                lessons={lessons.filter(l => l.author === activeTeacher?.name) || []}
                activeLessonId={activeLessonId}
                onSelectLesson={(id) => {
                  const target = lessons.find((l) => l.id === id);
                  if (target) {
                    handleSelectLesson(target);
                  } else {
                    setActiveLessonId(id);
                  }
                }}
                onAddLesson={handleSaveToLibrary}
                onOpenTemporaryLesson={handleOpenTemporaryLesson}
                onSaveToLibrary={handleSaveToLibrary}
                isSavedInLibrary={isCurrentLessonSavedInLibrary}
                onUpdateLesson={(updatedDoc) => {
                  setActiveOpenedLesson(updatedDoc);
                  if (lessons.some((l) => l.id === updatedDoc.id)) {
                    setLessons((prev) =>
                      prev.map((l) => (l.id === updatedDoc.id ? updatedDoc : l))
                    );
                  }
                }}
                onDeleteLesson={(id) => {
                  handleDeleteLesson(id);
                }}
                onSwitchToPresentation={() => setActiveTab('whiteboard')}
                onSwitchToReader={() => setActiveTab('reader')}
                onSwitchToFastWhiteboard={() => setActiveTab('fast-whiteboard')}
                onOpenRandomPicker={() => {
                  setPickerClassroom(activeTeacher?.classes?.[0] || null);
                  setShowRandomPickerModal(true);
                }}
              />
            )}

            {/* Tab: Fast Whiteboard (4K 120Hz Zero Latency Interactive Surface) */}
            {activeTab === 'fast-whiteboard' && (
              <div className="w-full h-full relative">
                <FastWhiteboard
                  theme="chalkboard"
                  className="rounded-2xl shadow-xl border border-slate-700/50"
                  onBack={() => setActiveTab('whiteboard')}
                />
              </div>
            )}

            {/* Tab 4: Live Quiz Hub & Classroom Submission (with embedded Analytics) */}
            {activeTab === 'quiz' && (
              <LiveQuizHub
                roomState={roomState}
                textScale={textScale}
                onRefreshRoom={() => fetchRoom(roomState?.pin || '758899')}
                onOpenExportModal={() => setShowExportModal(true)}
                onControlRoom={async (idx, isLive) => {
                  await fetch(`/api/rooms/${roomState?.pin || '758899'}/control`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ activeQuestionIndex: idx, isLive }),
                  });
                  fetchRoom(roomState?.pin || '758899');
                }}
                onResetRoom={async () => {
                  await fetch(`/api/rooms/${roomState?.pin || '758899'}/reset`, {
                    method: 'POST',
                  });
                  fetchRoom(roomState?.pin || '758899');
                }}
                onCreateAIQuiz={() => setShowAIQuizModal(true)}
                isLoadingAIQuiz={isGeneratingAIQuiz}
                currentLesson={currentLesson}
                onApplyQuestions={async (newQuestions, quizTitle) => {
                  const updatedLessons = lessons.map((l) =>
                    l.id === currentLesson.id
                      ? {
                          ...l,
                          title: quizTitle || l.title,
                          quizzes: newQuestions,
                          lastModified: new Date().toISOString(),
                        }
                      : l
                  );
                  setLessons(updatedLessons);

                  // Cập nhật ngay lập tức vào roomState React state không có độ trễ
                  setRoomState((prev) => ({
                    ...(prev || {
                      pin: '758899',
                      title: quizTitle || currentLesson.title,
                      submissions: {},
                      isLive: true,
                      activeQuestionIndex: 0,
                      startedAt: new Date().toISOString(),
                      activeStudents: [],
                      questions: [],
                    }),
                    title: quizTitle || currentLesson.title,
                    questions: newQuestions,
                    activeQuestionIndex: 0,
                    isLive: true,
                  }));

                  // Lưu ngay vào localStorage
                  try {
                    localStorage.setItem('smartboard_live_exam_questions', JSON.stringify(newQuestions));
                  } catch (_) {}

                  // Đồng bộ an toàn vào Firestore
                  try {
                    const roomPin = roomState?.pin || '758899';
                    const roomRef = doc(db, 'rooms', roomPin);
                    safeSetDoc(roomRef, {
                      pin: roomPin,
                      title: quizTitle || currentLesson.title,
                      questions: newQuestions,
                      activeQuestionIndex: 0,
                      isLive: true,
                      updatedAt: new Date().toISOString(),
                    }, { merge: true }).catch(() => {});
                  } catch (_) {}

                  await fetch('/api/rooms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      pin: roomState?.pin || '758899',
                      title: quizTitle || currentLesson.title,
                      questions: newQuestions,
                    }),
                  }).catch((e) => console.warn('Sync room error', e));

                  await fetchRoom(roomState?.pin || '758899');
                }}
              />
            )}

            {/* Tab: Educational Games Arena (Gamification 4-in-1: Grand Prix, Lucky Wheel, Mystery Puzzle, Millionaire) */}
            {activeTab === 'games' && (
              <EducationalGamesHub
                questions={currentLesson.quizzes}
                lessonTitle={currentLesson.title}
                lessonSubject={currentLesson.subject}
                lessonContent={currentLesson.rawText}
                classroom={activeTeacher?.classes?.[0] || null}
                onOpenAIQuizCreator={() => setShowAIQuizModal(true)}
                onUpdateQuestions={(newQuestions) => {
                  const updatedLessons = lessons.map((l) =>
                    l.id === currentLesson.id ? { ...l, quizzes: newQuestions } : l
                  );
                  setLessons(updatedLessons);
                  fetch('/api/rooms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      pin: '758899',
                      title: currentLesson.title,
                      questions: newQuestions,
                    }),
                  }).catch((e) => console.warn('Sync room error', e));
                }}
              />
            )}

            {/* Tab: Educational Simulation / External Embed (GeoGebra 3D, PhET, YouTube) */}
            {activeTab === 'embed' && (
              <ExternalContentEmbedder />
            )}

            {/* Tab 6: Class Gradebook & Student Management */}
            {activeTab === 'gradebook' && (
              <ClassGradebook
                teacher={activeTeacher}
                onUpdateTeacher={handleUpdateActiveTeacher}
                onLaunchRandomPicker={(cls) => {
                  setPickerClassroom(cls);
                  setShowRandomPickerModal(true);
                }}
                onForceSyncToCloud={() => syncTeachersToCloud(teachers, true)}
                onForcePullFromCloud={pullTeachersFromCloud}
                isCloudSyncing={syncStatus === 'syncing'}
                syncStatus={syncStatus}
              />
            )}

            {/* Tab 7: Kho Lưu Trữ & Đồng Bộ Cloud Đa Thiết Bị */}
            {activeTab === 'documents' && (
              <StorageManagementView
                activeTeacher={activeTeacher}
                lessons={lessons}
                activeLessonId={activeLessonId}
                onSelectLesson={(id) => {
                  const sel = lessons.find((l) => l.id === id);
                  if (sel) {
                    handleSelectLesson(sel);
                  } else {
                    setActiveLessonId(id);
                  }
                  setActiveTab('reader');
                }}
                onAddLesson={(newDoc) => {
                  handleSaveToLibrary(newDoc);
                }}
                onCleanLibrary={handleCleanLibrary}
                onSyncToCloud={handleSyncToCloud}
                onPullFromCloud={handlePullLessonsFromCloud}
                isSyncing={isSyncingCloud}
                onDeleteLesson={handleDeleteLesson}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Teacher Authentication / Profile Switcher Modal */}
      {showTeacherAuthModal && (
        <EducationalAuthScreen
          isModal={true}
          onClose={() => setShowTeacherAuthModal(false)}
          teachers={teachers}
          activeTeacher={activeTeacher}
          onSelectTeacher={(t) => {
            setActiveTeacherId(t.id);
            localStorage.setItem('smartboard_active_teacher', t.id);
            setShowTeacherAuthModal(false);
          }}
          onAddNewTeacher={(newT) => {
            setTeachers((prev) => {
              const next = [...prev, newT];
              localStorage.setItem('smartboard_teachers', JSON.stringify(next));
      syncTeachersToCloud(next);
              try { localStorage.setItem('smartboard_lessons', JSON.stringify(next)); } catch {}
                    saveLessonsToDB(next).catch(() => {});
                    return next;
            });
            
            setActiveTeacherId(newT.id);
            localStorage.setItem('smartboard_active_teacher', newT.id);
            setShowTeacherAuthModal(false);
          }}
          onLogout={handleLogout}
          onGuestLogin={() => {
            setIsGuestMode(true);
            setGuestTeacherData({
              id: 'guest',
              name: 'Khách (Dùng thử)',
              username: 'guest',
              email: 'guest@smartboard.local',
              phone: '',
              subject: 'Khác',
              school: '',
              avatar: '👤',
              classes: [],
              createdAt: new Date().toISOString(),
            });
            setShowTeacherAuthModal(false);
          }}
        />
      )}

      {/* Teacher Profile & Self Password Change Modal */}
      {showProfileModal && (
        <TeacherProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          teacher={activeTeacher}
          onUpdateTeacher={handleUpdateActiveTeacher}
          onLogout={handleLogout}
          onOpenAccountSwitcher={() => {
            setShowProfileModal(false);
            setShowTeacherAuthModal(true);
          }}
          onOpenAdminPanel={() => {
            setShowProfileModal(false);
            setShowAdminModal(true);
          }}
        />
      )}

      {/* Full Admin Management Panel Modal */}
      {showAdminModal && (
        <AdminManagementModal
          isOpen={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          teachers={teachers}
          activeTeacher={activeTeacher}
          onDeleteTeacher={(id) => {
            const next = teachers.filter((t) => t.id !== id);
            setTeachers(next);
            localStorage.setItem('smartboard_teachers', JSON.stringify(next));
            syncTeachersToCloud(next);
            
            // Xóa tài liệu liên quan
            const teacherToDelete = teachers.find(x => x.id === id);
            const nextLessons = lessons.filter(l => l.author !== teacherToDelete?.name);
            if (nextLessons.length !== lessons.length) {
              setLessons(nextLessons);
              saveLessonsToDB(nextLessons).catch(()=>{});
            }
          }}
          onResetPassword={(id, newPassword) => {
            const next = teachers.map((t) => t.id === id ? { ...t, password: newPassword || '123456' } : t);
            setTeachers(next);
            localStorage.setItem('smartboard_teachers', JSON.stringify(next));
      syncTeachersToCloud(next);
          }}
          onUpdateTeacher={(updated) => {
            const next = teachers.map((t) => (t.id === updated.id ? updated : t));
            setTeachers(next);
            localStorage.setItem('smartboard_teachers', JSON.stringify(next));
      syncTeachersToCloud(next);
            
            
          }}
          onAddNewTeacher={(newT) => {
            setTeachers((prev) => {
              const next = [...prev, newT];
              localStorage.setItem('smartboard_teachers', JSON.stringify(next));
      syncTeachersToCloud(next);
              try { localStorage.setItem('smartboard_lessons', JSON.stringify(next)); } catch {}
                    saveLessonsToDB(next).catch(() => {});
                    return next;
            });
            
          }}
          
          
          onSelectTeacher={(t) => {
            setActiveTeacherId(t.id);
            localStorage.setItem('smartboard_active_teacher', t.id);
            setShowAdminModal(false);
          }}
        />
      )}

      {/* Lucky Random Student Picker Game Modal */}
      {(pickerClassroom || activeTeacher?.classes?.[0]) && (
        <RandomStudentPickerModal
          isOpen={showRandomPickerModal}
          onClose={() => setShowRandomPickerModal(false)}
          classroom={
            activeTeacher?.classes?.find((c) => c.id === pickerClassroom?.id) ||
            activeTeacher?.classes?.[0] ||
            pickerClassroom!
          }
          allClasses={activeTeacher?.classes || []}
          onSelectClassroom={(cls) => setPickerClassroom(cls)}
          onAddBonusPoint={handleAddBonusPointFromPicker}
          onSetOralScore={handleSetOralScoreFromPicker}
        />
      )}

      {/* AI Quiz Creator Modal */}
      {showAIQuizModal && (
        <AIQuizCreatorModal
          currentLesson={currentLesson}
          onClose={() => setShowAIQuizModal(false)}
          onApplyQuestions={async (newQuestions, quizTitle, replace) => {
            if (!newQuestions || newQuestions.length === 0) return;
            const updatedQuizzes = replace ? newQuestions : [...(currentLesson.quizzes || []), ...newQuestions];
            const updatedLessons = lessons.map((l) =>
              l.id === currentLesson.id
                ? {
                    ...l,
                    title: quizTitle || l.title,
                    quizzes: updatedQuizzes,
                    lastModified: new Date().toISOString(),
                  }
                : l
            );
            setLessons(updatedLessons);

            await fetch('/api/rooms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                pin: '758899',
                title: quizTitle || currentLesson.title,
                questions: updatedQuizzes,
              }),
            }).catch((e) => console.warn('Sync room error', e));

            await fetchRoom('758899');
            setShowAIQuizModal(false);
            if (activeTab !== 'games') {
              setActiveTab('quiz');
            }
          }}
        />
      )}

      {/* Export Modal (Word .docx, PowerPoint .pptx, Excel .xlsx, PDF, HD Image, Slide Backup) */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        lesson={currentLesson}
        roomState={roomState}
        teacher={activeTeacher || null}
        classroom={activeTeacher?.classes?.[0] || null}
      />

      {/* Gemini AI & API Key Configuration Modal */}
      <AIConfigModal
        isOpen={showAIConfigModal}
        onClose={() => setShowAIConfigModal(false)}
      />

      {/* Global QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-8 rounded-3xl bg-white border border-slate-200 shadow-2xl flex flex-col items-center text-center">
            <h3 className="text-2xl font-black text-slate-900 mb-2">QUÉT MÃ THAM GIA LỚP HỌC</h3>
            <p className="text-slate-600 text-base mb-6">
              Học sinh dùng điện thoại hoặc iPad quét mã QR dưới đây để làm bài trắc nghiệm tức thì.
            </p>

            <div className="p-5 rounded-2xl bg-white border-2 border-slate-100 shadow-lg mb-6">
              <QRCodeSVG value={joinUrl} size={240} level="H" includeMargin={true} />
            </div>

            <div className="space-y-1 mb-6 w-full">
              <div className="text-xs uppercase tracking-widest text-slate-500 font-bold">MÃ PIN TRUY CẬP:</div>
              <div className="text-4xl md:text-5xl font-mono font-black text-emerald-600 tracking-widest bg-slate-50 px-6 py-2.5 rounded-2xl border border-slate-200">
                {roomState?.pin || '758899'}
              </div>
            </div>

            <div className="flex items-center gap-3 w-full">
              <button
                onClick={() => {
                  window.open(joinUrl, '_blank');
                  setShowQRModal(false);
                }}
                className="flex-1 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base transition-all shadow-md shadow-indigo-600/20"
              >
                Mở Tab Học Sinh
              </button>
              <button
                onClick={() => setShowQRModal(false)}
                className="px-6 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-base transition-all border border-slate-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MOBILE PHONE BOTTOM NAVIGATION BAR (< 768px) */}
      {isMobile && !isStudentMode && !isFullscreen && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1 py-1.5 flex items-center justify-around shadow-2xl select-none"
          style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
        >
          {[
            { id: 'whiteboard' as ActiveTab, label: 'Bảng Viết', icon: <PenTool className="w-5 h-5" />, activeColor: 'text-emerald-600' },
            { id: 'documents' as ActiveTab, label: 'Lưu Trữ', icon: <FolderOpen className="w-5 h-5" />, activeColor: 'text-amber-600' },
            { id: 'gradebook' as ActiveTab, label: 'Lớp Học', icon: <Users className="w-5 h-5" />, activeColor: 'text-blue-600' },
            { id: 'quiz' as ActiveTab, label: 'Trắc Nghiệm', icon: <CheckSquare className="w-5 h-5" />, activeColor: 'text-orange-500' },
          ].map((item) => {
            const isActive = activeTab === item.id || (item.id === 'documents' && activeTab === 'reader');
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer ${
                  isActive ? `${item.activeColor} font-black scale-105` : 'text-slate-400 hover:text-slate-600 font-medium'
                }`}
              >
                <div className={`p-1 rounded-xl ${isActive ? 'bg-slate-100 shadow-xs' : ''}`}>
                  {item.icon}
                </div>
                <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Instant < 100ms Natural Voice Vietnamese Text-To-Speech Floating Tooltip */}
      <TextToSpeechFloatingTooltip />
    </div>
  );
}
