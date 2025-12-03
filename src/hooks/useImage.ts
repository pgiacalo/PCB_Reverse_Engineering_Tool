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
  const [isGrayscale, setIsGrayscale] = useState(false);
  const [isBlackAndWhiteEdges, setIsBlackAndWhiteEdges] = useState(false);
  const [isBlackAndWhiteInverted, setIsBlackAndWhiteInverted] = useState(false);

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
    isGrayscale,
    setIsGrayscale,
    isBlackAndWhiteEdges,
    setIsBlackAndWhiteEdges,
    isBlackAndWhiteInverted,
    setIsBlackAndWhiteInverted,
    
    // Actions
    loadTopImage,
    loadBottomImage,
    clearImages,
  };
}

