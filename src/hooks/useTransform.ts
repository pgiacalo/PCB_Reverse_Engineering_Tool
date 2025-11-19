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

