/**
 * Copyright (c) 2025 Philip L. Giacalone. All Rights Reserved.
 *
 * This software and associated documentation files (the "Software") are the
 * proprietary and confidential property of Philip L. Giacalone.
 *
 * Unauthorized copying, modification, distribution, or use of this Software,
 * via any medium, is strictly prohibited and may be subject to civil and
 * criminal penalties.
 *
 * The Software is protected by copyright laws and international copyright
 * treaties, as well as other intellectual property laws and treaties.
 */

import { useState, useCallback } from 'react';

/**
 * Custom hook for managing view state (zoom, pan, constraints)
 * Camera is now stored in world coordinates for consistency with objects
 */
export function useView() {
  const [viewScale, setViewScale] = useState(1);
  // Camera center position in world coordinates (what the camera is looking at)
  const [cameraWorldCenter, setCameraWorldCenter] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // View rotation in degrees (applied to entire view, not individual objects)
  const [viewRotation, setViewRotation] = useState(0);
  // View horizontal flip (applied to entire view, not individual objects)
  const [viewFlipX, setViewFlipX] = useState(false);
  const [isShiftConstrained, setIsShiftConstrained] = useState(false);
  const [showBothLayers, setShowBothLayers] = useState(false);

  const resetView = useCallback(() => {
    setViewScale(1);
    setCameraWorldCenter({ x: 0, y: 0 });
    setViewRotation(0);
    setViewFlipX(false);
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

  // Pan by delta in canvas coordinates - convert to world coordinate change
  const pan = useCallback((deltaX: number, deltaY: number, currentViewScale: number) => {
    // Delta is in canvas coordinates, convert to world coordinates
    const worldDeltaX = deltaX / currentViewScale;
    const worldDeltaY = deltaY / currentViewScale;
    setCameraWorldCenter(prev => ({
      x: prev.x - worldDeltaX, // Negative because moving canvas right moves view left
      y: prev.y - worldDeltaY, // Negative because moving canvas down moves view up
    }));
  }, []);

  // Set camera center directly in world coordinates
  const setCameraCenter = useCallback((x: number, y: number) => {
    setCameraWorldCenter({ x, y });
  }, []);

  // Calculate viewPan from cameraWorldCenter (for backward compatibility during transition)
  // This will be used by drawing code until we fully refactor
  const getViewPan = useCallback((canvasCenterX: number, canvasCenterY: number): { x: number; y: number } => {
    return {
      x: canvasCenterX - cameraWorldCenter.x * viewScale,
      y: canvasCenterY - cameraWorldCenter.y * viewScale,
    };
  }, [cameraWorldCenter, viewScale]);

  return {
    // State
    viewScale,
    setViewScale,
    cameraWorldCenter,
    setCameraWorldCenter,
    viewRotation,
    setViewRotation,
    viewFlipX,
    setViewFlipX,
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
    setCameraCenter,
    getViewPan, // Helper to calculate viewPan for drawing
  };
}

