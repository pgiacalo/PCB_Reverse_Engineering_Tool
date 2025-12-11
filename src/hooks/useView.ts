/**
 * Copyright (c) 2025 Philip L. Giacalone
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
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
  const [isShiftConstrained, setIsShiftConstrained] = useState(false);
  const [showBothLayers, setShowBothLayers] = useState(false);

  const resetView = useCallback(() => {
    setViewScale(1);
    setCameraWorldCenter({ x: 0, y: 0 });
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

