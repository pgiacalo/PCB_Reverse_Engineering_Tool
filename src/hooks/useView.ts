import { useState, useCallback } from 'react';

/**
 * Custom hook for managing view state (zoom, pan, constraints)
 */
export function useView() {
  const [viewScale, setViewScale] = useState(1);
  const [viewPan, setViewPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isShiftConstrained, setIsShiftConstrained] = useState(false);
  const [showBothLayers, setShowBothLayers] = useState(false);

  const resetView = useCallback(() => {
    setViewScale(1);
    setViewPan({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback((factor: number = 1.2) => {
    setViewScale(prev => prev * factor);
  }, []);

  const zoomOut = useCallback((factor: number = 1.2) => {
    setViewScale(prev => prev / factor);
  }, []);

  const setZoom = useCallback((scale: number) => {
    setViewScale(scale);
  }, []);

  const pan = useCallback((deltaX: number, deltaY: number) => {
    setViewPan(prev => ({
      x: prev.x + deltaX,
      y: prev.y + deltaY,
    }));
  }, []);

  const setPan = useCallback((x: number, y: number) => {
    setViewPan({ x, y });
  }, []);

  return {
    // State
    viewScale,
    setViewScale,
    viewPan,
    setViewPan,
    isShiftConstrained,
    setIsShiftConstrained,
    showBothLayers,
    setShowBothLayers,
    
    // Actions
    resetView,
    zoomIn,
    zoomOut,
    setZoom,
    pan,
    setPan,
  };
}

