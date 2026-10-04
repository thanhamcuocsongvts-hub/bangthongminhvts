/**
 * Hook for Text-To-Speech (TTS) integration on SmartBoard 75 Pro
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  VOICE_TONE_PRESETS,
  VoiceTonePreset,
  speakText,
  stopAllSpeech,
  speakWithGeminiAudio,
} from '../utils/aiSpeechService';
import { isGeminiConfigured } from '../utils/geminiClient';

export function useTextToSpeech(initialPresetId: string = 'nu_truyen_cam') {
  const [currentPreset, setCurrentPreset] = useState<VoiceTonePreset>(() => {
    return (
      VOICE_TONE_PRESETS.find((p) => p.id === initialPresetId) ||
      VOICE_TONE_PRESETS[0]
    );
  });
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [useGeminiSpeech, setUseGeminiSpeech] = useState<boolean>(false);
  const activeTextRef = useRef<string>('');

  const hasGemini = isGeminiConfigured();

  // Stop playback
  const stop = useCallback(() => {
    stopAllSpeech();
    setIsSpeaking(false);
    activeTextRef.current = '';
  }, []);

  // Speak text with ultra-fast latency (<150ms)
  const speak = useCallback(
    async (text: string, overridePreset?: VoiceTonePreset) => {
      if (!text || !text.trim()) return;

      const preset = overridePreset || currentPreset;
      activeTextRef.current = text;
      setIsSpeaking(true);

      if (useGeminiSpeech && hasGemini) {
        await speakWithGeminiAudio(
          text,
          preset,
          () => setIsSpeaking(true),
          () => {
            setIsSpeaking(false);
            activeTextRef.current = '';
          }
        );
      } else {
        speakText(text, {
          preset,
          onStart: () => setIsSpeaking(true),
          onEnd: () => {
            setIsSpeaking(false);
            activeTextRef.current = '';
          },
          onError: () => {
            setIsSpeaking(false);
            activeTextRef.current = '';
          },
        });
      }
    },
    [currentPreset, hasGemini, useGeminiSpeech]
  );

  const toggle = useCallback(
    (text: string, overridePreset?: VoiceTonePreset) => {
      if (isSpeaking) {
        stop();
      } else {
        speak(text, overridePreset);
      }
    },
    [isSpeaking, speak, stop]
  );

  useEffect(() => {
    return () => {
      stopAllSpeech();
    };
  }, []);

  return {
    isSpeaking,
    currentPreset,
    setPreset: setCurrentPreset,
    speak,
    stop,
    toggle,
    presets: VOICE_TONE_PRESETS,
    useGeminiSpeech,
    setUseGeminiSpeech,
    hasGemini,
  };
}
