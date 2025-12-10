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
 * Custom hook for managing image transform state and operations
 */
export function useTransform() {
  const [selectedImageForTransform, setSelectedImageForTransform] = useState<'top' | 'bottom' | 'both' | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformStartPos, setTransformStartPos] = useState<{ x: number; y: number } | null>(null);
  const [transformMode, setTransformMode] = useState<'nudge' | 'scale' | 'rotate' | 'slant' | 'keystone'>('nudge');

  const startTransform = useCallback((image: 'top' | 'bottom' | 'both', startPos: { x: number; y: number }) => {
    setSelectedImageForTransform(image);
    setIsTransforming(true);
    setTransformStartPos(startPos);
  }, []);

  const stopTransform = useCallback(() => {
    setIsTransforming(false);
    setSelectedImageForTransform(null);
    setTransformStartPos(null);
  }, []);

  return {
    // State
    selectedImageForTransform,
    setSelectedImageForTransform,
    isTransforming,
    setIsTransforming,
    transformStartPos,
    setTransformStartPos,
    transformMode,
    setTransformMode,
    
    // Actions
    startTransform,
    stopTransform,
  };
}

