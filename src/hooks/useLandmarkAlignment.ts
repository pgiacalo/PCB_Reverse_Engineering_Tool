/**
 * Landmark Alignment Hook
 * 
 * Manages state and logic for manual 4-point landmark alignment.
 * 
 * Flow:
 * 1. User selects flip direction (horizontal/vertical)
 * 2. Flip is applied to bottom image
 * 3. User places 4 landmarks on top image
 * 4. User places 4 landmarks on bottom image (already flipped)
 * 5. Calculate alignment (translation, scale, rotation only - no flip!)
 */

import { useState, useCallback } from 'react';
import { calculateAlignmentNoFlip } from '../utils/landmarkAlignment';
import type { PCBImage } from './useImage';

export interface LandmarkPoint {
  x: number;
  y: number;
}

export type FlipDirection = 'horizontal' | 'vertical';

export type LandmarkStep = 'idle' | 'select-flip' | 'select-top' | 'select-bottom' | 'ready';

export interface UseLandmarkAlignmentProps {
  topImage: PCBImage | null;
  bottomImage: PCBImage | null;
  setBottomImage: React.Dispatch<React.SetStateAction<PCBImage | null>>;
}

export interface UseLandmarkAlignmentReturn {
  // State
  showDialog: boolean;
  step: LandmarkStep;
  topLandmarks: LandmarkPoint[];
  bottomLandmarks: LandmarkPoint[];
  flipApplied: FlipDirection | null;
  
  // Actions
  openDialog: () => void;
  closeDialog: () => void;
  applyFlip: (direction: FlipDirection) => void;
  startSelection: () => void;
  clearLandmarks: () => void;
  addLandmark: (point: LandmarkPoint) => void;
  calculateAndApply: () => void;
}

export function useLandmarkAlignment({
  topImage,
  bottomImage,
  setBottomImage
}: UseLandmarkAlignmentProps): UseLandmarkAlignmentReturn {
  const [showDialog, setShowDialog] = useState(false);
  const [step, setStep] = useState<LandmarkStep>('idle');
  const [topLandmarks, setTopLandmarks] = useState<LandmarkPoint[]>([]);
  const [bottomLandmarks, setBottomLandmarks] = useState<LandmarkPoint[]>([]);
  const [flipApplied, setFlipApplied] = useState<FlipDirection | null>(null);

  const openDialog = useCallback(() => {
    setShowDialog(true);
    setStep('idle');
    setTopLandmarks([]);
    setBottomLandmarks([]);
    setFlipApplied(null);
  }, []);

  const closeDialog = useCallback(() => {
    setShowDialog(false);
    setStep('idle');
    setTopLandmarks([]);
    setBottomLandmarks([]);
    setFlipApplied(null);
  }, []);

  // Apply flip to bottom image BEFORE landmark selection
  const applyFlip = useCallback((direction: FlipDirection) => {
    if (!bottomImage) return;
    
    console.log(`Applying ${direction} flip to bottom image`);
    
    setBottomImage(prev => {
      if (!prev) return null;
      return {
        ...prev,
        flipX: direction === 'horizontal' ? !prev.flipX : prev.flipX,
        flipY: direction === 'vertical' ? !prev.flipY : prev.flipY,
      };
    });
    
    setFlipApplied(direction);
    setStep('select-top');
  }, [bottomImage, setBottomImage]);

  const startSelection = useCallback(() => {
    setStep('select-top');
    setTopLandmarks([]);
    setBottomLandmarks([]);
  }, []);

  const clearLandmarks = useCallback(() => {
    // Keep flip applied, just clear landmarks
    setStep(flipApplied ? 'select-top' : 'idle');
    setTopLandmarks([]);
    setBottomLandmarks([]);
  }, [flipApplied]);

  const addLandmark = useCallback((point: LandmarkPoint) => {
    console.log('[Landmark] Adding landmark:', point, 'Step:', step);
    
    if (step === 'select-top') {
      setTopLandmarks(prev => {
        if (prev.length >= 4) {
          console.log('[Landmark] Top already has 4 landmarks');
          return prev;
        }
        const updated = [...prev, point];
        console.log('[Landmark] Top landmarks:', updated.length, '/4');
        
        // Auto-advance to bottom selection when we have 4 top landmarks
        if (updated.length === 4) {
          console.log('[Landmark] Switching to bottom selection');
          setTimeout(() => setStep('select-bottom'), 50);
        }
        return updated;
      });
    } else if (step === 'select-bottom') {
      setBottomLandmarks(prev => {
        if (prev.length >= 4) {
          console.log('[Landmark] Bottom already has 4 landmarks');
          return prev;
        }
        const updated = [...prev, point];
        console.log('[Landmark] Bottom landmarks:', updated.length, '/4');
        
        // Auto-advance to ready when we have 4 bottom landmarks
        if (updated.length === 4) {
          console.log('[Landmark] All landmarks collected - ready to calculate');
          setTimeout(() => setStep('ready'), 50);
        }
        return updated;
      });
    }
  }, [step]);

  const calculateAndApply = useCallback(() => {
    if (topLandmarks.length !== 4 || bottomLandmarks.length !== 4) {
      alert('Need exactly 4 landmarks on each image');
      return;
    }

    if (!topImage || !bottomImage) {
      alert('Both images must be loaded');
      return;
    }

    try {
      console.log('=== APPLYING LANDMARK ALIGNMENT (flip already applied) ===');
      console.log('Top landmarks:', topLandmarks);
      console.log('Bottom landmarks:', bottomLandmarks);
      
      // Calculate transformation (NO FLIP - flip was already applied!)
      // Just need translation, scale, and rotation
      const result = calculateAlignmentNoFlip(topLandmarks, bottomLandmarks);
      
      console.log('Calculated alignment:', result);
      
      // Apply transformation to bottom image
      setBottomImage(prev => {
        if (!prev) return null;
        
        console.log('Previous bottom image state:', {
          x: prev.x, y: prev.y, scale: prev.scale, rotation: prev.rotation
        });
        
        const newState = {
          ...prev,
          // Add rotation
          rotation: prev.rotation + result.rotation,
          // Multiply scale
          scale: prev.scale * result.scale,
          // Add translation
          x: prev.x + result.translateX,
          y: prev.y + result.translateY,
        };
        
        console.log('New bottom image state:', {
          x: newState.x, y: newState.y, scale: newState.scale, rotation: newState.rotation
        });
        
        return newState;
      });

      closeDialog();

      alert(
        `Alignment Applied!\n\n` +
        `Quality Score: ${result.quality.toFixed(0)}%\n` +
        `RMS Error: ${result.error.toFixed(1)} pixels\n\n` +
        `Transformations:\n` +
        `• Translation: (${result.translateX > 0 ? '+' : ''}${result.translateX.toFixed(1)}, ` +
        `${result.translateY > 0 ? '+' : ''}${result.translateY.toFixed(1)})\n` +
        `• Scale: ×${result.scale.toFixed(4)}\n` +
        `• Rotation: ${result.rotation > 0 ? '+' : ''}${result.rotation.toFixed(2)}°\n\n` +
        `Use the transparency slider to verify alignment.`
      );
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Landmark alignment error:', error);
      alert(`Failed to calculate alignment: ${errorMessage}`);
    }
  }, [topLandmarks, bottomLandmarks, topImage, bottomImage, setBottomImage, closeDialog]);

  return {
    showDialog,
    step,
    topLandmarks,
    bottomLandmarks,
    flipApplied,
    openDialog,
    closeDialog,
    applyFlip,
    startSelection,
    clearLandmarks,
    addLandmark,
    calculateAndApply
  };
}
