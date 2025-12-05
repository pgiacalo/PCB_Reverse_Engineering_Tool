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

