import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, Square, ChevronDown, Sparkles, Check, Mic2 } from 'lucide-react';
import {
  VOICE_TONE_PRESETS,
  VoiceTonePreset,
  speakText,
  stopAllSpeech,
  speakWithGeminiAudio,
} from '../utils/aiSpeechService';
import { isGeminiConfigured } from '../utils/geminiClient';

// Re-export for backwards compatibility across existing components
export { VOICE_TONE_PRESETS };
export type { VoiceTonePreset };

export const TextToSpeechFloatingTooltip: React.FC = () => {
  const [selectedText, setSelectedText] = useState<string>('');
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; placeAbove: boolean } | null>(null);
  const [selectedTone, setSelectedTone] = useState<VoiceTonePreset>(VOICE_TONE_PRESETS[0]);
  const [showToneDropdown, setShowToneDropdown] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [useGeminiAudio, setUseGeminiAudio] = useState<boolean>(false);

  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const hasGemini = isGeminiConfigured();

  // Instant response to text selection across the whole application (<150ms)
  useEffect(() => {
    let debounceTimer: any = null;

    const handleSelection = () => {
      // Clear previous timer for fast response
      if (debounceTimer) clearTimeout(debounceTimer);

      // Fast check immediately
      debounceTimer = setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          return;
        }

        const text = selection.toString().trim();
        if (!text || text.length < 2) {
          return;
        }

        try {
          const range = selection.getRangeAt(0);
          const clientRects = range.getClientRects();
          const rect = clientRects.length > 0 ? clientRects[0] : range.getBoundingClientRect();

          if (!rect || (rect.width === 0 && rect.height === 0)) return;

          // Position tooltip centered above the selection (or below if close to viewport top)
          const placeAbove = rect.top > 75;
          const x = Math.max(160, Math.min(window.innerWidth - 160, rect.left + rect.width / 2));
          const y = placeAbove ? rect.top - 14 : rect.bottom + 14;

          setSelectedText(text);
          setTooltipPos({ x, y, placeAbove });
        } catch (_) {}
      }, 15);
    };

    const handlePointerDown = (e: PointerEvent | MouseEvent) => {
      // If user clicked outside tooltip, check if selection was cleared
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setShowToneDropdown(false);
        setTimeout(() => {
          const selection = window.getSelection();
          if (!selection || selection.isCollapsed || !selection.toString().trim()) {
            setTooltipPos(null);
            setSelectedText('');
          }
        }, 120);
      }
    };

    // Ultra-fast pointer & selection listeners
    document.addEventListener('selectionchange', handleSelection);
    document.addEventListener('pointerup', handleSelection, { passive: true });
    document.addEventListener('mouseup', handleSelection, { passive: true });
    document.addEventListener('touchend', handleSelection, { passive: true });
    document.addEventListener('keyup', handleSelection, { passive: true });
    document.addEventListener('pointerdown', handlePointerDown as any, { passive: true });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener('selectionchange', handleSelection);
      document.removeEventListener('pointerup', handleSelection);
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('touchend', handleSelection);
      document.removeEventListener('keyup', handleSelection);
      document.removeEventListener('pointerdown', handlePointerDown as any);
      stopAllSpeech();
    };
  }, []);

  const handleSpeak = useCallback(
    async (presetToUse?: VoiceTonePreset) => {
      if (!selectedText || !selectedText.trim()) return;

      const preset = presetToUse || selectedTone;

      // Immediately cancel any previous speech (<1ms) to eliminate delay and prevent stacking
      stopAllSpeech();
      setIsSpeaking(true);
      setShowToneDropdown(false);

      if (useGeminiAudio && hasGemini) {
        await speakWithGeminiAudio(
          selectedText,
          preset,
          () => setIsSpeaking(true),
          () => setIsSpeaking(false)
        );
      } else {
        speakText(selectedText, {
          preset,
          onStart: () => setIsSpeaking(true),
          onEnd: () => setIsSpeaking(false),
          onError: () => setIsSpeaking(false),
        });
      }
    },
    [hasGemini, selectedText, selectedTone, useGeminiAudio]
  );

  const handleStop = useCallback(() => {
    stopAllSpeech();
    setIsSpeaking(false);
  }, []);

  if (!tooltipPos || !selectedText) {
    return null;
  }

  return (
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        left: `${tooltipPos.x}px`,
        top: `${tooltipPos.y}px`,
        transform: tooltipPos.placeAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
        zIndex: 99999,
      }}
      className="pointer-events-auto select-none animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="flex items-center gap-1.5 p-1.5 px-2.5 bg-slate-900/98 backdrop-blur-2xl border-2 border-emerald-500/60 rounded-2xl shadow-2xl text-white text-xs font-semibold">
        {/* Nút 1: [🔊 Đọc AI] */}
        <button
          onClick={() => handleSpeak()}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black transition-all shadow-md cursor-pointer ${
            isSpeaking
              ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white animate-pulse ring-2 ring-emerald-300'
              : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white active:scale-95'
          }`}
          title="Đọc to đoạn văn bản vừa chọn bằng AI SmartBoard"
        >
          <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-bounce' : ''}`} />
          <span className="whitespace-nowrap">{isSpeaking ? 'Đang đọc...' : '🔊 Đọc AI'}</span>
        </button>

        {/* Nút 2: Menu Popover / Dropdown 4 Sắc Thái Giọng AI */}
        <div className="relative">
          <button
            onClick={() => setShowToneDropdown((prev) => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-750 border border-emerald-500/40 text-emerald-200 text-xs font-bold cursor-pointer transition-all hover:border-emerald-400"
            title="Chọn nhanh sắc thái giọng đọc AI"
          >
            <span className="text-sm">{selectedTone.icon}</span>
            <span className="max-w-[125px] truncate">{selectedTone.name}</span>
            <ChevronDown className={`w-3.5 h-3.5 text-emerald-400 transition-transform ${showToneDropdown ? 'rotate-180' : ''}`} />
          </button>

          {/* Popover / Dropdown 4 Sắc Thái Giọng Chuẩn */}
          {showToneDropdown && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 bg-slate-950/98 backdrop-blur-2xl border-2 border-emerald-500/70 rounded-2xl shadow-2xl p-2 z-50 text-white space-y-1.5 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between px-2 py-1 border-b border-white/10">
                <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                  4 SẮC THÁI GIỌNG AI (vi-VN)
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono">
                  100% Âm lượng
                </span>
              </div>

              {VOICE_TONE_PRESETS.map((preset) => {
                const isSelected = selectedTone.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedTone(preset);
                      setShowToneDropdown(false);
                      if (isSpeaking) {
                        setTimeout(() => handleSpeak(preset), 40);
                      }
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs transition-all flex flex-col gap-0.5 cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold shadow-md ring-1 ring-emerald-400'
                        : 'hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>{preset.icon}</span>
                        <span>{preset.name}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-300" />}
                    </div>
                    <p className="text-[10px] opacity-80 line-clamp-1">{preset.description}</p>
                    <span className="text-[9px] opacity-60 font-mono">{preset.sub}</span>
                  </button>
                );
              })}

              {/* Tùy chọn Gemini Speech nếu đã cấu hình API Key */}
              {hasGemini && (
                <div className="pt-1.5 border-t border-white/10 mt-1">
                  <label className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer">
                    <span className="text-[10px] text-amber-300 font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400 animate-spin" />
                      Giọng Gemini Siêu Biểu Cảm
                    </span>
                    <input
                      type="checkbox"
                      checked={useGeminiAudio}
                      onChange={(e) => setUseGeminiAudio(e.target.checked)}
                      className="accent-emerald-500 rounded"
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Nút 3: Dừng đọc */}
        {isSpeaking && (
          <button
            onClick={handleStop}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black transition-all shadow-md active:scale-95 cursor-pointer"
            title="Dừng đọc văn bản ngay lập tức"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span className="whitespace-nowrap">Dừng</span>
          </button>
        )}
      </div>
    </div>
  );
};
