/**
 * DocumentViewer.tsx - Trình Đọc Tài Liệu & Kế Hoạch Ôn Tập Siêu Tốc
 * SmartBoard 75 Pro
 * 
 * Tính năng chính (Yêu cầu 3):
 * 1. Khi giáo viên quét chọn một đoạn văn bản trong tài liệu bằng chuột hoặc bút:
 *    - Thanh nổi [ 🔊 Đọc AI ] xuất hiện ngay tại vị trí con trỏ trong vòng 100ms.
 * 2. Khi bấm [ 🔊 Đọc AI ]:
 *    - Phát âm tiếng Việt ngay tức thì (< 150ms).
 *    - Sử dụng giọng đọc tự nhiên (Natural Voice vi-VN), ngữ điệu truyền cảm, nhấn nhá đúng dấu câu, không đơ cứng.
 * 3. Nút [ ⏹ Dừng ] để ngắt tiếng ngay lập tức khi giáo viên cần dừng lại giảng giải thêm cho học sinh.
 * 4. Tương thích với tất cả tài liệu: PDF, Word (.docx), Excel (.xlsx), Kế hoạch ôn tập.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2,
  Square,
  Sparkles,
  BookOpen,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Download,
  Share2,
  X,
  ChevronDown,
  Layers,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { LessonDoc, TextScale } from '../types';
import { UniversalDocumentViewer } from './UniversalDocumentViewer';
import {
  speakText,
  stopAllSpeech,
  VOICE_TONE_PRESETS,
  VoiceTonePreset,
  getBestVietnameseVoice,
} from '../utils/aiSpeechService';

export interface DocumentViewerProps {
  lesson: LessonDoc;
  textScale?: TextScale;
  onLaunchSlides?: () => void;
  onLaunchQuiz?: () => void;
  onOpenFile?: () => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  lesson,
  textScale = 'large',
  onLaunchSlides,
  onLaunchQuiz,
  onOpenFile,
}) => {
  const [selectedText, setSelectedText] = useState<string>('');
  const [toolbarCoords, setToolbarCoords] = useState<{ x: number; y: number; placeAbove: boolean } | null>(null);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [voicePreset, setVoicePreset] = useState<VoiceTonePreset>(VOICE_TONE_PRESETS[0]);
  const [showVoiceMenu, setShowVoiceMenu] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const floatingBarRef = useRef<HTMLDivElement>(null);

  // YÊU CẦU 3: Thanh nổi [ 🔊 Đọc AI ] xuất hiện ngay vị trí con trỏ trong 100ms
  useEffect(() => {
    let timer: any = null;

    const handleTextSelection = () => {
      if (timer) clearTimeout(timer);

      // Độ trễ siêu ngắn 40ms (<100ms) để lấy đúng bounding rect
      timer = setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          return;
        }

        const rawText = selection.toString().trim();
        if (!rawText || rawText.length < 2) {
          return;
        }

        try {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          if (rect.width === 0 && rect.height === 0) return;

          const placeAbove = rect.top > 80;
          const x = Math.max(140, Math.min(window.innerWidth - 140, rect.left + rect.width / 2));
          const y = placeAbove ? rect.top - 10 : rect.bottom + 10;

          setSelectedText(rawText);
          setToolbarCoords({ x, y, placeAbove });
        } catch (_) {}
      }, 40);
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (floatingBarRef.current && floatingBarRef.current.contains(e.target as Node)) {
        return;
      }
      setShowVoiceMenu(false);
      // If selection is cleared, hide floating bar
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) {
          setToolbarCoords(null);
          setSelectedText('');
        }
      }, 90);
    };

    document.addEventListener('mouseup', handleTextSelection, { passive: true });
    document.addEventListener('touchend', handleTextSelection, { passive: true });
    document.addEventListener('mousedown', handlePointerDown as any, { passive: true });

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('mouseup', handleTextSelection);
      document.removeEventListener('touchend', handleTextSelection);
      document.removeEventListener('mousedown', handlePointerDown as any);
      stopAllSpeech();
    };
  }, []);

  // YÊU CẦU 3: Phát âm tiếng Việt ngay tức thì (< 150ms), giọng tự nhiên vi-VN, truyền cảm
  const handleSpeak = useCallback((overridePreset?: VoiceTonePreset) => {
    if (!selectedText || !selectedText.trim()) return;

    const targetPreset = overridePreset || voicePreset;

    stopAllSpeech();
    setIsSpeaking(true);
    setShowVoiceMenu(false);

    speakText(selectedText, {
      preset: targetPreset,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  }, [selectedText, voicePreset]);

  // Nút [ ⏹ Dừng ] để ngắt tiếng tức thì khi giáo viên cần giảng giải thêm
  const handleStop = useCallback(() => {
    stopAllSpeech();
    setIsSpeaking(false);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full flex flex-col bg-slate-950 text-white overflow-hidden select-text">
      {/* Underlying Universal Viewer for PDF, Docx, PPTX, XLSX */}
      <UniversalDocumentViewer
        lesson={lesson}
        onLaunchSlides={onLaunchSlides}
        onLaunchQuiz={onLaunchQuiz}
        onOpenFile={onOpenFile}
      />

      {/* THANH NỔI [ 🔊 ĐỌC AI ] & [ ⏹ DỪNG ] XUẤT HIỆN TẠI CON TRỎ TRONG 100ms */}
      {toolbarCoords && selectedText && (
        <div
          ref={floatingBarRef}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="fixed z-50 flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/95 backdrop-blur-2xl border-2 border-emerald-400/80 shadow-2xl text-white animate-in zoom-in-95 duration-100 pointer-events-auto"
          style={{
            left: `${toolbarCoords.x}px`,
            top: `${toolbarCoords.y}px`,
            transform: toolbarCoords.placeAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
          }}
        >
          {/* Nút chính: 🔊 Đọc AI */}
          <button
            type="button"
            onClick={() => handleSpeak()}
            disabled={isSpeaking}
            className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer ${
              isSpeaking
                ? 'bg-emerald-600 text-white animate-pulse'
                : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:brightness-110 text-white ring-1 ring-emerald-300/60'
            }`}
            title="Đọc đoạn văn bản tiếng Việt vừa chọn bằng giọng tự nhiên truyền cảm"
          >
            <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? 'animate-bounce' : ''}`} />
            <span>{isSpeaking ? 'Đang đọc...' : '🔊 Đọc AI'}</span>
          </button>

          {/* Nút ⏹ Dừng để ngắt tiếng khi cần giảng giải thêm */}
          {isSpeaking && (
            <button
              type="button"
              onClick={handleStop}
              className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1 shadow-md cursor-pointer animate-in fade-in"
              title="Dừng đọc ngay lập tức"
            >
              <Square className="w-3 h-3 fill-current" />
              <span>⏹ Dừng</span>
            </button>
          )}

          {/* Chọn sắc thái giọng đọc truyền cảm */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowVoiceMenu((prev) => !prev)}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              title="Chọn sắc thái giọng truyền cảm (Cô giáo dịu dàng, Thầy giáo trầm ấm...)"
            >
              <span>{voicePreset.icon}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showVoiceMenu && (
              <div className="absolute left-0 bottom-full mb-2 w-60 bg-slate-900 border-2 border-emerald-500 rounded-2xl shadow-2xl p-1.5 z-50 text-white space-y-1">
                <div className="px-2 py-1 text-[10px] font-black uppercase text-emerald-400 tracking-wider border-b border-slate-800">
                  GIỌNG ĐỌC TỰ NHIÊN (vi-VN)
                </div>
                {VOICE_TONE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setVoicePreset(preset);
                      setShowVoiceMenu(false);
                      if (isSpeaking) {
                        handleStop();
                        setTimeout(() => handleSpeak(preset), 50);
                      }
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      voicePreset.id === preset.id ? 'bg-emerald-600 text-white font-bold' : 'hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span>{preset.icon}</span>
                      <span>{preset.name}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nút đóng thanh nổi */}
          <button
            type="button"
            onClick={() => {
              setToolbarCoords(null);
              setSelectedText('');
              handleStop();
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
            title="Đóng"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export const PdfViewer = DocumentViewer;
export default DocumentViewer;
