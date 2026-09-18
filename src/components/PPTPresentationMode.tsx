import React, { useState } from 'react';
import { PPTXViewer } from './PPTXViewer';
import { TeacherFileManager } from './TeacherFileManager';
import { MonitorPlay, X } from 'lucide-react';
import { LessonDoc } from '../types';

interface PPTPresentationModeProps {
  onSelectLesson: (lesson: LessonDoc) => void;
  activeLessonUrl?: string;
  activeLessonTitle?: string;
}

export const PPTPresentationMode: React.FC<PPTPresentationModeProps> = ({ 
  onSelectLesson, 
  activeLessonUrl,
  activeLessonTitle
}) => {
  const [showFileManager, setShowFileManager] = useState(!activeLessonUrl);

  // Consider it a PPT if the title ends with .ppt or .pptx, or if it explicitly has a pptx fileType.
  const isPPT = activeLessonUrl && (
    activeLessonTitle?.toLowerCase().endsWith('.ppt') || 
    activeLessonTitle?.toLowerCase().endsWith('.pptx') || 
    activeLessonUrl.includes('.ppt')
  );

  return (
    <div className="w-full h-full bg-slate-950 flex flex-col relative overflow-hidden rounded-2xl border border-slate-800 shadow-2xl">
      {!isPPT || showFileManager ? (
        <div className="w-full h-full flex flex-col items-center justify-center p-4">
          <div className="max-w-4xl w-full">
             <div className="mb-4 flex items-center justify-between">
               <h2 className="text-2xl font-black text-white flex items-center gap-3">
                 <MonitorPlay className="w-8 h-8 text-orange-500" />
                 Trình Chiếu PowerPoint Chuyên Nghiệp
               </h2>
               {isPPT && (
                 <button onClick={() => setShowFileManager(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold border border-slate-700">
                   Quay lại file đang chiếu
                 </button>
               )}
             </div>
             <p className="text-slate-400 mb-6">
               Hỗ trợ trình chiếu các định dạng <strong>.ppt, .pptx</strong> với đầy đủ hiệu ứng chuyển cảnh (Animations/Transitions) như trên phần mềm Microsoft PowerPoint. Vui lòng chọn tài liệu từ Kho Đám Mây của bạn.
             </p>
             <TeacherFileManager onSelectFile={(lesson) => {
               onSelectLesson(lesson);
               setShowFileManager(false);
             }} />
          </div>
        </div>
      ) : (
        <div className="w-full h-full relative">
          <div className="absolute top-4 left-4 z-50 flex gap-2">
            <button 
              onClick={() => setShowFileManager(true)}
              className="px-4 py-2 bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md text-white text-sm font-bold rounded-xl border border-slate-700 shadow-2xl flex items-center gap-2 transition-all"
            >
              <MonitorPlay className="w-4 h-4 text-orange-400" />
              Chọn File Khác
            </button>
          </div>
          <PPTXViewer url={activeLessonUrl} />
        </div>
      )}
    </div>
  );
};
