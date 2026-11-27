export type SlideTransitionMode = 'slide' | 'fade' | 'zoom' | 'rise' | 'flip';
export type SlideDirection = 'next' | 'prev';
export type SlideTransitionSpeed = 'gentle' | 'smooth' | 'moderate';

export interface SlideTransitionOption {
  id: SlideTransitionMode;
  label: string;
  shortLabel: string;
  description: string;
}

export interface SlideTransitionSpeedOption {
  id: SlideTransitionSpeed;
  label: string;
  shortLabel: string;
  durationMs: number;
}

export const SLIDE_TRANSITION_OPTIONS: SlideTransitionOption[] = [
  {
    id: 'slide',
    label: 'Trượt ngang',
    shortLabel: 'Trượt',
    description: 'Chuyển cảnh ngang chậm rãi, rất nhẹ mắt',
  },
  {
    id: 'fade',
    label: 'Mờ dần',
    shortLabel: 'Fade',
    description: 'Hòa tan siêu êm, hoàn toàn không dịch chuyển',
  },
  {
    id: 'zoom',
    label: 'Thu phóng',
    shortLabel: 'Zoom',
    description: 'Phóng nhẹ dịu mắt giúp học sinh tập trung',
  },
  {
    id: 'rise',
    label: 'Nâng cảnh',
    shortLabel: 'Nâng cảnh',
    description: 'Trôi lên từ từ êm ái, dễ theo dõi',
  },
  {
    id: 'flip',
    label: 'Lật 3D',
    shortLabel: 'Lật 3D',
    description: 'Xoay phối cảnh nhẹ nhàng, chậm rãi',
  },
];

export const SLIDE_TRANSITION_SPEED_OPTIONS: SlideTransitionSpeedOption[] = [
  {
    id: 'gentle',
    label: 'Siêu chậm (2.0s)',
    shortLabel: 'Siêu chậm',
    durationMs: 2000,
  },
  {
    id: 'smooth',
    label: 'Chậm dịu (1.4s)',
    shortLabel: 'Chậm dịu',
    durationMs: 1400,
  },
  {
    id: 'moderate',
    label: 'Vừa êm (0.95s)',
    shortLabel: 'Vừa êm',
    durationMs: 950,
  },
];

const VALID_MODES = new Set<SlideTransitionMode>(['slide', 'fade', 'zoom', 'rise', 'flip']);
const VALID_SPEEDS = new Set<SlideTransitionSpeed>(['gentle', 'smooth', 'moderate']);
const SPEED_STORAGE_KEY = 'smartboard_slide_transition_speed';
const ENABLED_STORAGE_KEY = 'smartboard_slide_transitions_enabled';

export function isValidSlideTransition(val: unknown): val is SlideTransitionMode {
  return typeof val === 'string' && VALID_MODES.has(val as SlideTransitionMode);
}

export function isValidSlideTransitionSpeed(val: unknown): val is SlideTransitionSpeed {
  return typeof val === 'string' && VALID_SPEEDS.has(val as SlideTransitionSpeed);
}

export function getSavedSlideTransition(
  storageKey: string,
  fallback: SlideTransitionMode = 'slide'
): SlideTransitionMode {
  try {
    const saved = localStorage.getItem(storageKey);
    if (isValidSlideTransition(saved)) return saved;
  } catch {
    // Ignore storage access errors
  }
  return fallback;
}

export function saveSlideTransition(storageKey: string, mode: SlideTransitionMode): void {
  try {
    localStorage.setItem(storageKey, mode);
  } catch {
    // Ignore storage access errors
  }
}

export function getTransitionSpeedMs(speed: SlideTransitionSpeed): number {
  const found = SLIDE_TRANSITION_SPEED_OPTIONS.find((s) => s.id === speed);
  return found ? found.durationMs : 1400;
}

export function applySlideTransitionSpeedCss(speed: SlideTransitionSpeed): void {
  if (typeof document === 'undefined') return;
  const ms = getTransitionSpeedMs(speed);
  const root = document.documentElement;
  root.style.setProperty('--slide-tr-duration', `${ms}ms`);
  root.style.setProperty('--slide-tr-flip-duration', `${ms + 200}ms`);
  root.style.setProperty('--slide-step-duration', `${Math.max(700, Math.round(ms * 0.68))}ms`);
}

export function getSavedSlideTransitionSpeed(
  fallback: SlideTransitionSpeed = 'smooth'
): SlideTransitionSpeed {
  try {
    const saved = localStorage.getItem(SPEED_STORAGE_KEY);
    if (isValidSlideTransitionSpeed(saved)) return saved;
  } catch {
    // Ignore storage access errors
  }
  return fallback;
}

export function saveSlideTransitionSpeed(speed: SlideTransitionSpeed): void {
  try {
    localStorage.setItem(SPEED_STORAGE_KEY, speed);
  } catch {
    // Ignore storage access errors
  }
  applySlideTransitionSpeedCss(speed);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smartboard_slide_speed_changed', { detail: speed }));
  }
}

export function applySlideTransitionsEnabledAttr(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-slide-transitions', enabled ? 'on' : 'off');
}

export function getSavedSlideTransitionsEnabled(fallback = true): boolean {
  try {
    const saved = localStorage.getItem(ENABLED_STORAGE_KEY);
    if (saved === 'false') return false;
    if (saved === 'true') return true;
  } catch {
    // Ignore storage access errors
  }
  return fallback;
}

export function saveSlideTransitionsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage access errors
  }
  applySlideTransitionsEnabledAttr(enabled);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('smartboard_slide_enabled_changed', { detail: enabled }));
  }
}

// Initialize CSS custom properties & enabled attribute immediately on load
if (typeof document !== 'undefined') {
  applySlideTransitionSpeedCss(getSavedSlideTransitionSpeed('smooth'));
  applySlideTransitionsEnabledAttr(getSavedSlideTransitionsEnabled(true));
}

export function getTransitionOption(mode: SlideTransitionMode): SlideTransitionOption {
  return SLIDE_TRANSITION_OPTIONS.find((opt) => opt.id === mode) || SLIDE_TRANSITION_OPTIONS[0];
}

export function cycleSlideTransition(current: SlideTransitionMode): SlideTransitionMode {
  const idx = SLIDE_TRANSITION_OPTIONS.findIndex((opt) => opt.id === current);
  const nextIdx = idx === -1 ? 0 : (idx + 1) % SLIDE_TRANSITION_OPTIONS.length;
  return SLIDE_TRANSITION_OPTIONS[nextIdx].id;
}

export function getSlideTransitionClass(
  mode: SlideTransitionMode,
  direction: SlideDirection = 'next',
  enabled: boolean = getSavedSlideTransitionsEnabled(true)
): string {
  if (!enabled) return '';
  switch (mode) {
    case 'fade':
      return 'animate-slide-tr-fade';
    case 'zoom':
      return 'animate-slide-tr-zoom';
    case 'rise':
      return 'animate-slide-tr-rise';
    case 'flip':
      return direction === 'prev' ? 'animate-slide-tr-flip-prev' : 'animate-slide-tr-flip-next';
    case 'slide':
    default:
      return direction === 'prev' ? 'animate-slide-tr-left' : 'animate-slide-tr-right';
  }
}
