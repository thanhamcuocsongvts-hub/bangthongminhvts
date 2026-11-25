import { useEffect, useState } from 'react';

export interface CasioGlobalState {
  isOpen: boolean;
  isDocked: boolean;
}

export function getCasioGlobalState(): CasioGlobalState {
  if (typeof document === 'undefined') {
    return { isOpen: false, isDocked: false };
  }
  return {
    isOpen: document.documentElement.dataset.casioOpen === 'true',
    isDocked: document.documentElement.dataset.casioDocked === 'true',
  };
}

export function toggleCasioCalculator(
  mode: 'side_by_side' | 'standalone' | 'auto' = 'side_by_side'
) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('toggle-casio-calculator', { detail: { mode } }));
}

export function useCasioGlobalState(): CasioGlobalState {
  const [state, setState] = useState<CasioGlobalState>(getCasioGlobalState);

  useEffect(() => {
    setState(getCasioGlobalState());
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CasioGlobalState>).detail;
      if (detail) {
        setState({
          isOpen: Boolean(detail.isOpen),
          isDocked: Boolean(detail.isDocked),
        });
      } else {
        setState(getCasioGlobalState());
      }
    };
    window.addEventListener('casio-state-changed', handler);
    return () => window.removeEventListener('casio-state-changed', handler);
  }, []);

  return state;
}
