/**
 * Floating Selection Toolbar for SmartBoard 75 Pro
 * Renders the purple dashed bounding box with corner handles and
 * the floating action toolbar directly above the swept selection.
 * 
 * Features:
 * 1. Badge "Vùng chữ (X nét)"
 * 2. Font selector (Chữ Mẫu Tiểu Học BGD, Tập Viết Ô Ly, Vở Sạch Chữ Đẹp, etc.)
 * 3. Button "Bấm chọn: Chuyển Chữ Đẹp"
 * 4. Button "🔊 Đọc AI" (100% tiếng Việt, đọc số "Một, hai, ba, bốn")
 * 5. Dropdown 4 sắc thái giọng ngay cạnh nút Đọc AI
 * 6. Live OCR preview badge (<0.5s)
 * 7. Close button (X)
 */

import React, { useState } from 'react';
import {
  Sparkles,
  Feather,
  Wand2,
  Loader2,
  Volume2,
  ChevronDown,
  Square,
  X,
  Check,
} from 'lucide-react';
import { VOICE_TONE_PRESETS, VoiceTonePreset } from '../utils/aiSpeechService';

export interface FloatingSelectionToolbarProps {
  sweptSelection: {
    box: { minX: number; minY: number; maxX: number; maxY: number };
    strokeIds: string[];
    textIds: string[];
  };
  boardScrollX: number;
  boardScrollY: number;
  isMobile: boolean;
  calligraphyFont: string;
  setCalligraphyFont: (font: any) => void;
  isConvertingCalligraphy: boolean;
  onConvert: () => void;
  isSpeakingTTS: boolean;
  ttsVoicePreset: VoiceTonePreset;
  setTtsVoicePreset: (preset: VoiceTonePreset) => void;
  onSpeak: (preset?: VoiceTonePreset) => void;
  onStopTTS: () => void;
  onClose: () => void;
  recognizedTextPreview?: string | null;
}

export const FloatingSelectionToolbar: React.FC<FloatingSelectionToolbarProps> = ({
  sweptSelection,
  boardScrollX,
  boardScrollY,
  isMobile,
  calligraphyFont,
  setCalligraphyFont,
  isConvertingCalligraphy,
  onConvert,
  isSpeakingTTS,
  ttsVoicePreset,
  setTtsVoicePreset,
  onSpeak,
  onStopTTS,
  onClose,
  recognizedTextPreview,
}) => {
  const [showVoiceMenu, setShowVoiceMenu] = useState<boolean>(false);

  const strokeCount = sweptSelection.strokeIds.length;
  const textCount = sweptSelection.textIds.length;
  const countLabel = strokeCount > 0 ? `${strokeCount} nét` : `${textCount} khối chữ`;

  return (
    <>
      {/* 1. Purple Dashed Bounding Box with Corner Circular Handles */}
      <div
        className="absolute pointer-events-none border-2 border-purple-400 border-dashed rounded-xl z-30 transition-all duration-75 shadow-lg bg-purple-500/5"
        style={{
          left: `${sweptSelection.box.minX - boardScrollX}px`,
          top: `${sweptSelection.box.minY - boardScrollY}px`,
          width: `${Math.max(24, sweptSelection.box.maxX - sweptSelection.box.minX)}px`,
          height: `${Math.max(24, sweptSelection.box.maxY - sweptSelection.box.minY)}px`,
        }}
      >
        {/* Top-Left Badge: Vùng chữ (X nét) */}
        <div className="absolute -top-3 left-3 px-2 py-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full text-[10px] font-bold text-white shadow-lg flex items-center gap-1 border border-purple-300/40">
          <Sparkles className="w-3 h-3 text-amber-300" />
          <span>Vùng chữ ({countLabel})</span>
          {recognizedTextPreview && (
            <span className="ml-1 pl-1 border-l border-white/30 text-amber-200 font-mono">
              "{recognizedTextPreview}"
            </span>
          )}
        </div>

        {/* 4 Corner Circular Handles */}
        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full bg-purple-500 border border-white shadow-sm" />
        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-purple-500 border border-white shadow-sm" />
        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 rounded-full bg-purple-500 border border-white shadow-sm" />
        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 rounded-full bg-purple-500 border border-white shadow-sm" />
      </div>

      {/* 2. Floating Action Toolbar (Centered above the swept selection) */}
      <div
        className={
          isMobile
            ? 'fixed bottom-20 left-2 right-2 z-50 flex items-center justify-between gap-1.5 bg-slate-950/98 backdrop-blur-2xl border-2 border-purple-400/80 rounded-2xl p-2 shadow-2xl text-white animate-in slide-in-from-bottom-4 duration-200 pointer-events-auto'
            : 'absolute z-50 flex flex-wrap items-center gap-2 bg-slate-950/95 backdrop-blur-2xl border-2 border-purple-400/80 rounded-2xl p-2 md:p-2.5 shadow-2xl text-white animate-in zoom-in-95 duration-150 pointer-events-auto'
        }
        style={
          isMobile
            ? undefined
            : {
                left: `${Math.max(12, Math.min(window.innerWidth - 440, sweptSelection.box.minX - boardScrollX))}px`,
                top: `${Math.max(
                  12,
                  sweptSelection.box.minY - boardScrollY > 64
                    ? sweptSelection.box.minY - boardScrollY - 60
                    : sweptSelection.box.maxY - boardScrollY + 12
                )}px`,
              }
        }
      >
        {/* Quick Font Selector */}
        <div className="flex items-center gap-1 bg-white/10 px-2 py-1.5 rounded-xl border border-white/15 shrink-0 max-w-[130px] sm:max-w-none">
          <Feather className="w-3.5 h-3.5 text-purple-300 shrink-0" />
          <select
            value={calligraphyFont}
            onChange={(e) => setCalligraphyFont(e.target.value as any)}
            className="bg-transparent text-white text-[11px] font-bold focus:outline-none cursor-pointer truncate"
          >
            <option value="tieuhoc_chuan" className="bg-slate-900 text-white">🌟 Chữ Mẫu Tiểu Học BGD (Playwrite VN)</option>
            <option value="tieuhoc_oly" className="bg-slate-900 text-white">📐 Tập Viết Kẻ Ô Ly (Guides)</option>
            <option value="luyenchu" className="bg-slate-900 text-white">✨ Vở Sạch Chữ Đẹp (Charm - Ảnh 3)</option>
            <option value="tapviet" className="bg-slate-900 text-white">📖 Tập Viết Nét Tròn (HP001)</option>
            <option value="primary" className="bg-slate-900 text-white">📝 Nét Phấn Học Trò</option>
            <option value="handwriting" className="bg-slate-900 text-white">✒️ Bút Mài Giáo Viên</option>
            <option value="calligraphy" className="bg-slate-900 text-white">🌸 Thư Pháp Mềm Mại</option>
            <option value="cursive" className="bg-slate-900 text-white">✍️ Nét Cọ Bay Bổng</option>
          </select>
        </div>

        {/* Action Button: Bấm chọn: Chuyển Chữ Đẹp */}
        <button
          onClick={onConvert}
          disabled={isConvertingCalligraphy}
          className="flex-1 sm:flex-none px-3.5 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:brightness-110 active:scale-95 text-white font-black text-xs rounded-xl shadow-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all ring-2 ring-purple-300/50 shrink-0"
        >
          {isConvertingCalligraphy ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
              <span>Đang chuyển...</span>
            </>
          ) : (
            <>
              <Wand2 className="w-3.5 h-3.5 text-amber-300 animate-bounce" />
              <span>{isMobile ? 'Chuyển Đẹp' : 'Bấm chọn: Chuyển Chữ Đẹp'}</span>
            </>
          )}
        </button>

        {/* Nút [🔊 Đọc AI] và Menu chọn 4 sắc thái giọng ngay cạnh */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onSpeak()}
            disabled={isSpeakingTTS || isConvertingCalligraphy}
            className={`px-3 py-2 rounded-xl text-white font-black text-xs shadow-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all shrink-0 ${
              isSpeakingTTS
                ? 'bg-emerald-600 animate-pulse ring-2 ring-emerald-300'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 ring-2 ring-emerald-400/50'
            }`}
            title="Đọc chữ viết tay hoặc số trên vùng chọn bằng tiếng Việt 100%"
          >
            <Volume2 className={`w-3.5 h-3.5 ${isSpeakingTTS ? 'animate-bounce' : ''}`} />
            <span>{isSpeakingTTS ? 'Đang đọc...' : '🔊 Đọc AI'}</span>
          </button>

          {/* Menu Dropdown 4 Sắc Thái Giọng AI */}
          <div className="relative">
            <button
              onClick={() => setShowVoiceMenu((prev) => !prev)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              title="Chọn sắc thái giọng đọc AI"
            >
              <span className="text-xs">{ttsVoicePreset.icon || '🎙️'}</span>
              <span className="hidden sm:inline max-w-[80px] truncate">{ttsVoicePreset.name.split('/')[0]}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showVoiceMenu ? 'rotate-180' : ''}`} />
            </button>

            {showVoiceMenu && (
              <div className="absolute left-0 bottom-full mb-2 w-64 bg-slate-900/98 backdrop-blur-2xl border-2 border-emerald-500/70 rounded-2xl shadow-2xl p-2 z-50 text-white space-y-1.5 animate-in fade-in">
                <div className="px-2 py-1 text-[10px] font-black uppercase text-emerald-300 tracking-wider border-b border-white/10 flex items-center justify-between">
                  <span>4 SẮC THÁI GIỌNG AI (vi-VN)</span>
                  <span className="text-[9px] text-amber-300 font-mono">100% Tiếng Việt</span>
                </div>
                {VOICE_TONE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setTtsVoicePreset(preset);
                      setShowVoiceMenu(false);
                      if (isSpeakingTTS) {
                        onStopTTS();
                        setTimeout(() => onSpeak(preset), 50);
                      }
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs transition-all flex flex-col gap-0.5 cursor-pointer ${
                      ttsVoicePreset.id === preset.id
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold ring-1 ring-emerald-400'
                        : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 font-bold">
                        <span>{preset.icon}</span>
                        <span>{preset.name}</span>
                      </span>
                      {ttsVoicePreset.id === preset.id && <Check className="w-3.5 h-3.5 text-amber-300" />}
                    </div>
                    <span className="text-[9.5px] opacity-70 font-mono">{preset.sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nút Dừng đọc nếu đang phát âm */}
          {isSpeakingTTS && (
            <button
              onClick={onStopTTS}
              className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer transition-colors"
              title="Dừng đọc"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
        </div>

        {/* Nút Đóng / Hủy quét vùng chọn */}
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/15 rounded-xl text-slate-400 hover:text-white cursor-pointer transition-colors shrink-0"
          title="Hủy quét"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </>
  );
};
