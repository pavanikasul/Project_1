'use client';

import { useState, useEffect, useCallback } from 'react';

export const useProctoring = (onViolation: (type: string) => void) => {
  const [violations, setViolations] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(true);

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden) {
      onViolation('Tab Switching Detected');
      setViolations(v => v + 1);
    }
  }, [onViolation]);

  const handleFullscreenChange = useCallback(() => {
    if (!document.fullscreenElement) {
      setIsFullscreen(false);
      onViolation('Fullscreen Exit Detected');
      setViolations(v => v + 1);
    } else {
      setIsFullscreen(true);
    }
  }, [onViolation]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Initial fullscreen request is usually done via button click, 
    // but we track the state here.

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [handleVisibilityChange, handleFullscreenChange]);

  const requestFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    }
  };

  return { violations, isFullscreen, requestFullscreen };
};
