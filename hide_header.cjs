const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `    <div className="w-screen h-screen flex flex-col bg-[#f8fafc] text-slate-800 overflow-hidden select-none">
      {/* 75-Inch Top Navigation Header Bar */}
      {(!isFullscreen || activeTab !== 'presentation') && (
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
        />
      )}

      {/* Main Interactive Screen Content */}`;

code = code.replace(/    <div className="w-screen h-screen flex flex-col bg-\[#f8fafc\] text-slate-800 overflow-hidden select-none">[\s\S]*?\{\/\* Main Interactive Screen Content \*\/\}/, replacement);
fs.writeFileSync('src/App.tsx', code);
