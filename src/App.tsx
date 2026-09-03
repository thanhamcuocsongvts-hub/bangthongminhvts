import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DEFAULT_LESSONS } from './data/defaultLessons';
import { DEFAULT_TEACHERS } from './data/defaultTeachers';
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
import { DocumentReaderView } from './components/DocumentReaderView';
import { TouchWhiteboard } from './components/TouchWhiteboard';
import { LiveQuizHub } from './components/LiveQuizHub';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { ClassGradebook } from './components/ClassGradebook';
import { DocumentLibrary } from './components/DocumentLibrary';
import { AITeacherAssistant } from './components/AITeacherAssistant';
import { ExportModal } from './components/ExportModal';
import { EducationalAuthScreen } from './components/EducationalAuthScreen';
import { EducationalGamesHub } from './components/EducationalGamesHub';
import { ExternalContentEmbedder } from './components/ExternalContentEmbedder';
import { AIQuizCreatorModal } from './components/AIQuizCreatorModal';
import { RandomStudentPickerModal } from './components/RandomStudentPickerModal';
import { StudentMobilePortal } from './components/StudentMobilePortal';
import { QRCodeSVG } from 'qrcode.react';
import { loadLessonsFromDB, saveLessonsToDB } from './utils/storageUtils';

export default function App() {
  // Check URL mode for student mobile access
  const [isStudentMode, setIsStudentMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'student';
  });

  const [studentRoomPin, setStudentRoomPin] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || '758899';
  });

  // Teachers State & Persistence
  const [teachers, setTeachers] = useState<TeacherProfile[]>(() => {
    const saved = localStorage.getItem('smartboard_teachers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Failed to parse saved teachers', e);
      }
    }
    return DEFAULT_TEACHERS;
  });

  const [activeTeacherId, setActiveTeacherId] = useState<string>(() => {
    return localStorage.getItem('smartboard_active_teacher') || '';
  });

  const activeTeacher =
    (teachers || []).find((t) => t.id === activeTeacherId) || null;

  // Sync teachers across devices (PC <-> Mobile)
  useEffect(() => {
    // 1. Push local teachers to server if any exist
    if (teachers && teachers.length > 0) {
      fetch('/api/teachers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teachers }),
      }).catch((e) => console.warn('Sync teachers to server warning:', e));
    }
    // 2. Fetch server teachers so mobile gets all accounts registered from PC
    fetch('/api/teachers')
      .then((res) => res.json())
      .then((data) => {
        if (data.teachers && Array.isArray(data.teachers) && data.teachers.length > 0) {
          setTeachers((prev) => {
            const map = new Map<string, TeacherProfile>();
            prev.forEach((t) => map.set(t.id, t));
            data.teachers.forEach((t: TeacherProfile) => {
              if (!map.has(t.id)) {
                map.set(t.id, t);
              } else {
                const existing = map.get(t.id)!;
                map.set(t.id, {
                  ...existing,
                  ...t,
                  classes: (t.classes && t.classes.length > 0) ? t.classes : existing.classes,
                });
              }
            });
            const merged = Array.from(map.values());
            localStorage.setItem('smartboard_teachers', JSON.stringify(merged));
            return merged;
          });
        }
      })
      .catch((e) => console.warn('Fetch teachers error:', e));
  }, []);

  // Lessons State & Persistence
  const [lessons, setLessons] = useState<LessonDoc[]>(() => {
    const saved = localStorage.getItem('smartboard_lessons');
    if (saved) {
      try {
        const parsed: LessonDoc[] = JSON.parse(saved);
        // Automatically sanitize any binary artifacts from prior uploads
        return parsed.map((les) => {
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

  const currentLesson =
    (lessons || []).find((l) => l.id === activeLessonId) || lessons?.[0] || emptyFallbackLesson;

  // Active Tab & Display Settings (Defaults to Classroom Blackboard upon login)
  const [activeTab, setActiveTab] = useState<ActiveTab>('whiteboard');
  const [textScale, setTextScale] = useState<TextScale>('large'); // Default 125% for 75" TV
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showQRModal, setShowQRModal] = useState<boolean>(false);
  const [showTeacherAuthModal, setShowTeacherAuthModal] = useState<boolean>(false);
  const [showRandomPickerModal, setShowRandomPickerModal] = useState<boolean>(false);
  const [pickerClassroom, setPickerClassroom] = useState<ClassRoom | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isGeneratingAIQuiz, setIsGeneratingAIQuiz] = useState<boolean>(false);
  const [showAIQuizModal, setShowAIQuizModal] = useState<boolean>(false);

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

  // Load lessons from high-capacity IndexedDB on mount
  useEffect(() => {
    loadLessonsFromDB()
      .then((dbLessons) => {
        if (dbLessons && dbLessons.length > 0) {
          setLessons(dbLessons);
        }
      })
      .catch((err) => {
        console.warn('IndexedDB initial load note:', err);
      });
  }, []);

  // Save to LocalStorage & IndexedDB (Bypassing browser 5MB quota with IndexedDB)
  useEffect(() => {
    try {
      localStorage.setItem('smartboard_lessons', JSON.stringify(lessons));
    } catch (e) {
      console.warn('localStorage quota exceeded, stored in IndexedDB capacity storage', e);
    }
    saveLessonsToDB(lessons).catch((err) => {
      console.error('Failed to sync to IndexedDB:', err);
    });
  }, [lessons]);

  useEffect(() => {
    localStorage.setItem('smartboard_active_lesson', activeLessonId);
  }, [activeLessonId]);

  useEffect(() => {
    localStorage.setItem('smartboard_teachers', JSON.stringify(teachers));
  }, [teachers]);

  useEffect(() => {
    localStorage.setItem('smartboard_active_teacher', activeTeacherId);
  }, [activeTeacherId]);

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

  // Fullscreen toggle
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Sync Room with active lesson questions when switching lesson
  useEffect(() => {
    if (currentLesson && currentLesson.quizzes.length > 0) {
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

  // Cloud Sync Simulation
  const handleSyncToCloud = async () => {
    setIsSyncingCloud(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      setLessons((prev) =>
        prev.map((l) => ({
          ...l,
          syncedToCloud: true,
          lastModified: new Date().toISOString(),
        }))
      );
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
        const updatedQuizzes = [...currentLesson.quizzes, ...generatedQuestions];
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
    setTeachers((prev) => {
      const next = prev.map((t) => (t.id === updatedTeacher.id ? updatedTeacher : t));
      localStorage.setItem('smartboard_teachers', JSON.stringify(next));
      return next;
    });
  };

  // Delete Teacher (Admin)
  const handleDeleteTeacher = (teacherId: string) => {
    setTeachers((prev) => {
      const next = prev.filter((t) => t.id !== teacherId);
      localStorage.setItem('smartboard_teachers', JSON.stringify(next));
      return next;
    });
    if (activeTeacherId === teacherId) {
      setActiveTeacherId('');
      localStorage.removeItem('smartboard_active_teacher');
    }
  };

  // Reset Password for Teacher (Admin)
  const handleResetPassword = (teacherId: string) => {
    setTeachers((prev) => {
      const next = prev.map((t) => (t.id === teacherId ? { ...t, password: '' } : t));
      localStorage.setItem('smartboard_teachers', JSON.stringify(next));
      return next;
    });
  };

  // Logout Teacher
  const handleLogout = () => {
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
            return next;
          });
          fetch('/api/teachers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newT),
          }).catch((e) => console.warn('Sync new teacher error:', e));
          setActiveTeacherId(newT.id);
          localStorage.setItem('smartboard_active_teacher', newT.id);
          setActiveTab('whiteboard');
        }}
        onLogout={handleLogout}
      />
    );
  }

  const joinUrl = `${window.location.origin}/?mode=student&room=${roomState?.pin || '758899'}`;

  return (
    <div className="w-screen h-screen flex flex-col bg-[#f8fafc] text-slate-800 overflow-hidden select-none">
      {/* 75-Inch Top Navigation Header Bar */}
      <HeaderBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        textScale={textScale}
        onTextScaleChange={setTextScale}
        roomPin={roomState?.pin || '758899'}
        onOpenQR={() => setShowQRModal(true)}
        onOpenExport={() => setShowExportModal(true)}
        onOpenTeacherAuth={() => setShowTeacherAuthModal(true)}
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
      />

      {/* Main Interactive Screen Content */}
      <main className="flex-1 p-3 md:p-4 overflow-hidden relative bg-[#f8fafc]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="w-full h-full"
          >
            {/* Tab 1: Presentation Mode */}
            {activeTab === 'presentation' && (
              <PresentationView
                lesson={currentLesson}
                textScale={textScale}
                onLaunchQuiz={() => setActiveTab('quiz')}
                onAskAIAboutSlide={(slide) => {
                  setActiveTab('ai_chat');
                  handleSendAIMessage(
                    `Học sinh đang theo dõi slide "${slide.title}": ${slide.content}. Hãy giải thích cặn kẽ và cho thêm ví dụ trực quan về phần này.`
                  );
                }}
                onOpenExportModal={() => setShowExportModal(true)}
              />
            )}

            {/* Tab 2: Document Reader View (Open Doc directly & AI Key Points) */}
            {activeTab === 'reader' && (
              <DocumentReaderView
                lesson={currentLesson}
                textScale={textScale}
                onUpdateLesson={(updatedDoc) => {
                  setLessons((prev) =>
                    prev.map((l) => (l.id === updatedDoc.id ? updatedDoc : l))
                  );
                }}
                onDeleteLesson={(id) => {
                  setLessons((prev) => {
                    const next = prev.filter((l) => l.id !== id);
                    if (next.length > 0) {
                      setActiveLessonId(next[0].id);
                    }
                    return next;
                  });
                  setActiveTab('whiteboard');
                }}
                onLaunchSlides={() => setActiveTab('presentation')}
                onLaunchQuiz={() => setActiveTab('quiz')}
                onSendToAIChat={(prompt) => {
                  setActiveTab('ai_chat');
                  handleSendAIMessage(prompt);
                }}
              />
            )}

            {/* Tab 3: Authentic Classroom Blackboard (Bảng Xanh Sư Phạm 75 Pro) */}
            {activeTab === 'whiteboard' && (
              <ClassroomBlackboardView
                classroom={activeTeacher?.classes?.[0] || null}
                activeTeacher={activeTeacher || null}
                lessons={lessons || []}
                activeLessonId={activeLessonId}
                onSelectLesson={setActiveLessonId}
                onAddLesson={(newDoc) => {
                  setLessons((prev) => [newDoc, ...prev]);
                  setActiveLessonId(newDoc.id);
                }}
                onUpdateLesson={(updatedDoc) => {
                  setLessons((prev) =>
                    prev.map((l) => (l.id === updatedDoc.id ? updatedDoc : l))
                  );
                }}
                onDeleteLesson={(id) => {
                  setLessons((prev) => {
                    const next = prev.filter((l) => l.id !== id);
                    if (next.length > 0) {
                      setActiveLessonId(next[0].id);
                    }
                    return next;
                  });
                }}
                onSwitchToPresentation={() => setActiveTab('presentation')}
                onSwitchToReader={() => setActiveTab('reader')}
                onOpenRandomPicker={() => {
                  setPickerClassroom(activeTeacher?.classes?.[0] || null);
                  setShowRandomPickerModal(true);
                }}
              />
            )}

            {/* Tab 4: Live Quiz Hub & Classroom Submission */}
            {activeTab === 'quiz' && (
              <LiveQuizHub
                roomState={roomState}
                textScale={textScale}
                onRefreshRoom={() => fetchRoom(roomState?.pin || '758899')}
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
              />
            )}

            {/* Tab: Educational Games Arena (Gamification 4-in-1: Grand Prix, Lucky Wheel, Mystery Puzzle, Millionaire) */}
            {activeTab === 'games' && (
              <EducationalGamesHub
                questions={currentLesson.quizzes}
                classroom={activeTeacher?.classes?.[0] || null}
                onOpenAIQuizCreator={() => setShowAIQuizModal(true)}
              />
            )}

            {/* Tab: Educational Simulation / External Embed (GeoGebra 3D, PhET, YouTube) */}
            {activeTab === 'embed' && (
              <ExternalContentEmbedder />
            )}

            {/* Tab 5: Analytics Dashboard & Learning Insights */}
            {activeTab === 'analytics' && (
              <AnalyticsDashboard
                lesson={currentLesson}
                roomState={roomState}
                onOpenExportModal={() => setShowExportModal(true)}
                onAskAIAboutResults={(summary) => {
                  setActiveTab('ai_chat');
                  handleSendAIMessage(summary);
                }}
              />
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
              />
            )}

            {/* Tab 7: Document Library & Cloud Sync */}
            {activeTab === 'documents' && (
              <DocumentLibrary
                lessons={lessons}
                activeLessonId={activeLessonId}
                onSelectLesson={(id) => {
                  setActiveLessonId(id);
                  setActiveTab('presentation');
                }}
                onAddLesson={(newDoc) => {
                  setLessons((prev) => [newDoc, ...prev]);
                  setActiveLessonId(newDoc.id);
                }}
                onDeleteLesson={(id) => {
                  setLessons((prev) => prev.filter((l) => l.id !== id));
                }}
                onSyncToCloud={handleSyncToCloud}
                isSyncing={isSyncingCloud}
              />
            )}

            {/* Tab 8: AI Teacher Assistant & Instant Knowledge Extraction */}
            {activeTab === 'ai_chat' && (
              <AITeacherAssistant
                lesson={currentLesson}
                textScale={textScale}
                messages={chatMessages}
                onSendMessage={handleSendAIMessage}
                isLoading={isAILoading}
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
              return next;
            });
            fetch('/api/teachers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newT),
            }).catch((e) => console.warn('Sync new teacher error:', e));
            setActiveTeacherId(newT.id);
            localStorage.setItem('smartboard_active_teacher', newT.id);
            setShowTeacherAuthModal(false);
          }}
          onDeleteTeacher={handleDeleteTeacher}
          onResetPassword={handleResetPassword}
          onLogout={handleLogout}
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
          onApplyQuestions={async (newQuestions, quizTitle) => {
            if (!newQuestions || newQuestions.length === 0) return;
            const updatedQuizzes = [...currentLesson.quizzes, ...newQuestions];
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

            fetchRoom('758899');
            setShowAIQuizModal(false);
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
    </div>
  );
}
