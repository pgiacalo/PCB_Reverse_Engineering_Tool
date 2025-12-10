/**
 * Copyright (c) 2025 Philip L. Giacalone
 * Author: Philip L. Giacalone
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

