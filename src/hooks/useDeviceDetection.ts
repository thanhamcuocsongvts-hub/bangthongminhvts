import { useState, useEffect } from 'react';

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktopOrTV: boolean;
  isLandscape: boolean;
  screenWidth: number;
  screenHeight: number;
}

export function useDeviceDetection(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isDesktopOrTV: true,
        isLandscape: true,
        screenWidth: 1920,
        screenHeight: 1080,
      };
    }
    const width = window.innerWidth;
    const height = window.innerHeight;
    const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    const isMobile = width < 768 || (height < 520 && width < 1000 && hasTouch);
    const isTablet = !isMobile && (width >= 768 && width < 1024);
    const isDesktopOrTV = width >= 1024 && !isMobile;
    const isLandscape = width > height;

    return {
      isMobile,
      isTablet,
      isDesktopOrTV,
      isLandscape,
      screenWidth: width,
      screenHeight: height,
    };
  });

  useEffect(() => {
    const handleUpdate = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
      const isMobile = width < 768 || (height < 520 && width < 1000 && hasTouch);
      const isTablet = !isMobile && (width >= 768 && width < 1024);
      const isDesktopOrTV = width >= 1024 && !isMobile;
      const isLandscape = width > height;

      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktopOrTV,
        isLandscape,
        screenWidth: width,
        screenHeight: height,
      });
    };

    window.addEventListener('resize', handleUpdate, { passive: true });
    window.addEventListener('orientationchange', handleUpdate, { passive: true });

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('orientationchange', handleUpdate);
    };
  }, []);

  return deviceInfo;
}
