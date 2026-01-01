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

