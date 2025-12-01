import { useState, useCallback } from 'react';

interface PersistedDefaults {
  brushColor: string;
  brushSize: number;
  topTraceColor: string;
  bottomTraceColor: string;
  topTraceSize: number;
  bottomTraceSize: number;
  viaSize: number;
  viaColor: string;
  topPadColor: string;
  bottomPadColor: string;
  topPadSize: number;
  bottomPadSize: number;
  topComponentColor: string;
  bottomComponentColor: string;
  topComponentSize: number;
  bottomComponentSize: number;
  componentConnectionColor: string;
  componentConnectionSize: number;
  powerSize: number;
  groundSize: number;
}

/**
 * Custom hook for managing layer-specific settings (colors, sizes)
 */
export function useLayerSettings() {
  // Load persisted defaults from localStorage
  const loadPersistedDefaults = useCallback((): PersistedDefaults => {
    return {
      brushColor: localStorage.getItem('defaultBrushColor') || '#008080',
      brushSize: parseInt(localStorage.getItem('defaultBrushSize') || '6', 10),
      topTraceColor: localStorage.getItem('defaultTopTraceColor') || '#AA4499',
      bottomTraceColor: localStorage.getItem('defaultBottomTraceColor') || '#F781BF',
      topTraceSize: parseInt(localStorage.getItem('defaultTopTraceSize') || '6', 10),
      bottomTraceSize: parseInt(localStorage.getItem('defaultBottomTraceSize') || '6', 10),
      viaSize: parseInt(localStorage.getItem('defaultViaSize') || '18', 10),
      viaColor: localStorage.getItem('defaultViaColor') || '#ff0000',
      topPadColor: localStorage.getItem('defaultTopPadColor') || '#0072B2',
      bottomPadColor: localStorage.getItem('defaultBottomPadColor') || '#56B4E9',
      topPadSize: parseInt(localStorage.getItem('defaultTopPadSize') || '18', 10),
      bottomPadSize: parseInt(localStorage.getItem('defaultBottomPadSize') || '18', 10),
      topComponentColor: localStorage.getItem('defaultTopComponentColor') || '#8C564B',
      bottomComponentColor: localStorage.getItem('defaultBottomComponentColor') || '#9C755F',
      topComponentSize: parseInt(localStorage.getItem('defaultTopComponentSize') || '18', 10),
      bottomComponentSize: parseInt(localStorage.getItem('defaultBottomComponentSize') || '18', 10),
      componentConnectionColor: localStorage.getItem('defaultComponentConnectionColor') || 'rgba(0, 150, 255, 0.6)',
      componentConnectionSize: parseInt(localStorage.getItem('defaultComponentConnectionSize') || '3', 10),
      powerSize: parseInt(localStorage.getItem('defaultPowerSize') || '18', 10),
      groundSize: parseInt(localStorage.getItem('defaultGroundSize') || '18', 10),
    };
  }, []);

  const persistedDefaults = loadPersistedDefaults();
  
  const [brushColor, setBrushColor] = useState(persistedDefaults.brushColor);
  const [brushSize, setBrushSize] = useState(persistedDefaults.brushSize);
  const [topTraceColor, setTopTraceColor] = useState(persistedDefaults.topTraceColor);
  const [bottomTraceColor, setBottomTraceColor] = useState(persistedDefaults.bottomTraceColor);
  const [topTraceSize, setTopTraceSize] = useState(persistedDefaults.topTraceSize);
  const [bottomTraceSize, setBottomTraceSize] = useState(persistedDefaults.bottomTraceSize);
  const [topPadColor, setTopPadColor] = useState(persistedDefaults.topPadColor);
  const [bottomPadColor, setBottomPadColor] = useState(persistedDefaults.bottomPadColor);
  const [topPadSize, setTopPadSize] = useState(persistedDefaults.topPadSize);
  const [bottomPadSize, setBottomPadSize] = useState(persistedDefaults.bottomPadSize);
  const [topComponentColor, setTopComponentColor] = useState(persistedDefaults.topComponentColor);
  const [bottomComponentColor, setBottomComponentColor] = useState(persistedDefaults.bottomComponentColor);
  const [topComponentSize, setTopComponentSize] = useState(persistedDefaults.topComponentSize);
  const [bottomComponentSize, setBottomComponentSize] = useState(persistedDefaults.bottomComponentSize);
  const [componentConnectionColor, setComponentConnectionColor] = useState(persistedDefaults.componentConnectionColor);
  const [componentConnectionSize, setComponentConnectionSize] = useState(persistedDefaults.componentConnectionSize);

  // Save defaults to localStorage
  const saveDefaultSize = useCallback((type: 'via' | 'pad' | 'trace' | 'component' | 'componentConnection' | 'power' | 'ground' | 'brush', size: number, layer?: 'top' | 'bottom') => {
    if (type === 'trace' && layer) {
      if (layer === 'top') {
        localStorage.setItem('defaultTopTraceSize', String(size));
      } else {
        localStorage.setItem('defaultBottomTraceSize', String(size));
      }
    } else if (type === 'pad' && layer) {
      if (layer === 'top') {
        localStorage.setItem('defaultTopPadSize', String(size));
      } else {
        localStorage.setItem('defaultBottomPadSize', String(size));
      }
    } else if (type === 'component' && layer) {
      if (layer === 'top') {
        localStorage.setItem('defaultTopComponentSize', String(size));
      } else {
        localStorage.setItem('defaultBottomComponentSize', String(size));
      }
    } else if (type === 'componentConnection') {
      localStorage.setItem('defaultComponentConnectionSize', String(size));
    } else if (type === 'via') {
      localStorage.setItem('defaultViaSize', String(size));
    } else if (type === 'power') {
      localStorage.setItem('defaultPowerSize', String(size));
    } else if (type === 'ground') {
      localStorage.setItem('defaultGroundSize', String(size));
    } else if (type === 'brush') {
      localStorage.setItem('defaultBrushSize', String(size));
    }
  }, []);

  const saveDefaultColor = useCallback((type: 'via' | 'pad' | 'trace' | 'component' | 'componentConnection' | 'brush', color: string, layer?: 'top' | 'bottom') => {
    if (type === 'trace' && layer) {
      if (layer === 'top') {
        localStorage.setItem('defaultTopTraceColor', color);
      } else {
        localStorage.setItem('defaultBottomTraceColor', color);
      }
    } else if (type === 'pad' && layer) {
      if (layer === 'top') {
        localStorage.setItem('defaultTopPadColor', color);
      } else {
        localStorage.setItem('defaultBottomPadColor', color);
      }
    } else if (type === 'component' && layer) {
      if (layer === 'top') {
        localStorage.setItem('defaultTopComponentColor', color);
      } else {
        localStorage.setItem('defaultBottomComponentColor', color);
      }
    } else if (type === 'componentConnection') {
      localStorage.setItem('defaultComponentConnectionColor', color);
    } else if (type === 'via') {
      localStorage.setItem('defaultViaColor', color);
    } else if (type === 'brush') {
      localStorage.setItem('defaultBrushColor', color);
    }
  }, []);

  return {
    // State
    brushColor,
    setBrushColor,
    brushSize,
    setBrushSize,
    topTraceColor,
    setTopTraceColor,
    bottomTraceColor,
    setBottomTraceColor,
    topTraceSize,
    setTopTraceSize,
    bottomTraceSize,
    setBottomTraceSize,
    topPadColor,
    setTopPadColor,
    bottomPadColor,
    setBottomPadColor,
    topPadSize,
    setTopPadSize,
    bottomPadSize,
    setBottomPadSize,
    topComponentColor,
    setTopComponentColor,
    bottomComponentColor,
    setBottomComponentColor,
    topComponentSize,
    setTopComponentSize,
    bottomComponentSize,
    setBottomComponentSize,
    componentConnectionColor,
    setComponentConnectionColor,
    componentConnectionSize,
    setComponentConnectionSize,
    
    // Actions
    saveDefaultSize,
    saveDefaultColor,
  };
}

