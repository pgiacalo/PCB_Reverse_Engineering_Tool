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

export interface PCBImage {
  url: string;
  name: string;
  width: number;
  height: number;
  dataUrl?: string;
  filePath?: string; // File path relative to project directory (preferred for new projects)
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  skewX?: number;
  skewY?: number;
  keystoneV?: number;
  keystoneH?: number;
  bitmap?: ImageBitmap | null;
  brightness?: number; // Brightness adjustment: 0-200 (100 = normal)
  contrast?: number; // Contrast adjustment: 0-200 (100 = normal)
}

export type ViewMode = 'top' | 'bottom' | 'overlay';

/**
 * Custom hook for managing PCB image state and view settings
 */
export function useImage() {
  const [topImage, setTopImage] = useState<PCBImage | null>(null);
  const [bottomImage, setBottomImage] = useState<PCBImage | null>(null);
  const [currentView, setCurrentView] = useState<ViewMode>('overlay');
  const [transparency, setTransparency] = useState(50);
  const [isTransparencyCycling, setIsTransparencyCycling] = useState(false);
  const [transparencyCycleSpeed, setTransparencyCycleSpeed] = useState(2000); // Cycle period in ms (500-8000)
  const [isGrayscale, setIsGrayscale] = useState(false);

  const loadTopImage = useCallback((image: PCBImage) => {
    setTopImage(image);
  }, []);

  const loadBottomImage = useCallback((image: PCBImage) => {
    setBottomImage(image);
  }, []);

  const clearImages = useCallback(() => {
    setTopImage(null);
    setBottomImage(null);
  }, []);

  return {
    // State
    topImage,
    setTopImage,
    bottomImage,
    setBottomImage,
    currentView,
    setCurrentView,
    transparency,
    setTransparency,
    isTransparencyCycling,
    setIsTransparencyCycling,
    transparencyCycleSpeed,
    setTransparencyCycleSpeed,
    isGrayscale,
    setIsGrayscale,
    
    // Actions
    loadTopImage,
    loadBottomImage,
    clearImages,
  };
}

