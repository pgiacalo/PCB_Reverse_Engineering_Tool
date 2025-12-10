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

// Application-wide default values for new projects
// These are hardcoded defaults that every new project starts with
export const LAYER_DEFAULTS = {
  brushColor: '#008080',
  brushSize: 6,
  topTraceColor: '#AA4499',
  bottomTraceColor: '#F781BF',
  topTraceSize: 6,
  bottomTraceSize: 6,
  viaSize: 18,
  viaColor: '#ff0000',
  topPadColor: '#0072B2',
  bottomPadColor: '#56B4E9',
  topPadSize: 18,
  bottomPadSize: 18,
  topTestPointColor: '#FFFF00', // Bright yellow
  bottomTestPointColor: '#FFFF00', // Bright yellow
  topTestPointSize: 18,
  bottomTestPointSize: 18,
  topComponentColor: '#8C564B',
  bottomComponentColor: '#9C755F',
  topComponentSize: 18,
  bottomComponentSize: 18,
  componentConnectionColor: '#E69F00',
  componentConnectionSize: 3,
  powerSize: 18,
  groundSize: 18,
};

export interface LayerSettingsState {
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
  topTestPointColor: string;
  bottomTestPointColor: string;
  topTestPointSize: number;
  bottomTestPointSize: number;
  topComponentColor: string;
  bottomComponentColor: string;
  topComponentSize: number;
  bottomComponentSize: number;
  componentConnectionColor: string;
  componentConnectionSize: number;
}

/**
 * Custom hook for managing layer-specific settings (colors, sizes)
 * All settings are stored in memory and saved/loaded from project files
 * No localStorage is used - every new project starts with LAYER_DEFAULTS
 */
export function useLayerSettings() {
  // Explicitly type as string/number to allow any valid value, not just the literal defaults
  const [brushColor, setBrushColor] = useState<string>(LAYER_DEFAULTS.brushColor);
  const [brushSize, setBrushSize] = useState<number>(LAYER_DEFAULTS.brushSize);
  const [topTraceColor, setTopTraceColor] = useState<string>(LAYER_DEFAULTS.topTraceColor);
  const [bottomTraceColor, setBottomTraceColor] = useState<string>(LAYER_DEFAULTS.bottomTraceColor);
  const [topTraceSize, setTopTraceSize] = useState<number>(LAYER_DEFAULTS.topTraceSize);
  const [bottomTraceSize, setBottomTraceSize] = useState<number>(LAYER_DEFAULTS.bottomTraceSize);
  const [topPadColor, setTopPadColor] = useState<string>(LAYER_DEFAULTS.topPadColor);
  const [bottomPadColor, setBottomPadColor] = useState<string>(LAYER_DEFAULTS.bottomPadColor);
  const [topPadSize, setTopPadSize] = useState<number>(LAYER_DEFAULTS.topPadSize);
  const [bottomPadSize, setBottomPadSize] = useState<number>(LAYER_DEFAULTS.bottomPadSize);
  const [topTestPointColor, setTopTestPointColor] = useState<string>(LAYER_DEFAULTS.topTestPointColor);
  const [bottomTestPointColor, setBottomTestPointColor] = useState<string>(LAYER_DEFAULTS.bottomTestPointColor);
  const [topTestPointSize, setTopTestPointSize] = useState<number>(LAYER_DEFAULTS.topTestPointSize);
  const [bottomTestPointSize, setBottomTestPointSize] = useState<number>(LAYER_DEFAULTS.bottomTestPointSize);
  const [topComponentColor, setTopComponentColor] = useState<string>(LAYER_DEFAULTS.topComponentColor);
  const [bottomComponentColor, setBottomComponentColor] = useState<string>(LAYER_DEFAULTS.bottomComponentColor);
  const [topComponentSize, setTopComponentSize] = useState<number>(LAYER_DEFAULTS.topComponentSize);
  const [bottomComponentSize, setBottomComponentSize] = useState<number>(LAYER_DEFAULTS.bottomComponentSize);
  const [componentConnectionColor, setComponentConnectionColor] = useState<string>(LAYER_DEFAULTS.componentConnectionColor);
  const [componentConnectionSize, setComponentConnectionSize] = useState<number>(LAYER_DEFAULTS.componentConnectionSize);

  // Reset all settings to defaults (called when creating a new project)
  const resetToDefaults = useCallback(() => {
    setBrushColor(LAYER_DEFAULTS.brushColor);
    setBrushSize(LAYER_DEFAULTS.brushSize);
    setTopTraceColor(LAYER_DEFAULTS.topTraceColor);
    setBottomTraceColor(LAYER_DEFAULTS.bottomTraceColor);
    setTopTraceSize(LAYER_DEFAULTS.topTraceSize);
    setBottomTraceSize(LAYER_DEFAULTS.bottomTraceSize);
    setTopPadColor(LAYER_DEFAULTS.topPadColor);
    setBottomPadColor(LAYER_DEFAULTS.bottomPadColor);
    setTopPadSize(LAYER_DEFAULTS.topPadSize);
    setBottomPadSize(LAYER_DEFAULTS.bottomPadSize);
    setTopTestPointColor(LAYER_DEFAULTS.topTestPointColor);
    setBottomTestPointColor(LAYER_DEFAULTS.bottomTestPointColor);
    setTopTestPointSize(LAYER_DEFAULTS.topTestPointSize);
    setBottomTestPointSize(LAYER_DEFAULTS.bottomTestPointSize);
    setTopComponentColor(LAYER_DEFAULTS.topComponentColor);
    setBottomComponentColor(LAYER_DEFAULTS.bottomComponentColor);
    setTopComponentSize(LAYER_DEFAULTS.topComponentSize);
    setBottomComponentSize(LAYER_DEFAULTS.bottomComponentSize);
    setComponentConnectionColor(LAYER_DEFAULTS.componentConnectionColor);
    setComponentConnectionSize(LAYER_DEFAULTS.componentConnectionSize);
  }, []);

  // Load settings from a project file
  const loadFromProject = useCallback((settings: Partial<LayerSettingsState>) => {
    if (settings.brushColor !== undefined) setBrushColor(settings.brushColor);
    if (settings.brushSize !== undefined) setBrushSize(settings.brushSize);
    if (settings.topTraceColor !== undefined) setTopTraceColor(settings.topTraceColor);
    if (settings.bottomTraceColor !== undefined) setBottomTraceColor(settings.bottomTraceColor);
    if (settings.topTraceSize !== undefined) setTopTraceSize(settings.topTraceSize);
    if (settings.bottomTraceSize !== undefined) setBottomTraceSize(settings.bottomTraceSize);
    if (settings.topPadColor !== undefined) setTopPadColor(settings.topPadColor);
    if (settings.bottomPadColor !== undefined) setBottomPadColor(settings.bottomPadColor);
    if (settings.topPadSize !== undefined) setTopPadSize(settings.topPadSize);
    if (settings.bottomPadSize !== undefined) setBottomPadSize(settings.bottomPadSize);
    if (settings.topTestPointColor !== undefined) setTopTestPointColor(settings.topTestPointColor);
    if (settings.bottomTestPointColor !== undefined) setBottomTestPointColor(settings.bottomTestPointColor);
    if (settings.topTestPointSize !== undefined) setTopTestPointSize(settings.topTestPointSize);
    if (settings.bottomTestPointSize !== undefined) setBottomTestPointSize(settings.bottomTestPointSize);
    if (settings.topComponentColor !== undefined) setTopComponentColor(settings.topComponentColor);
    if (settings.bottomComponentColor !== undefined) setBottomComponentColor(settings.bottomComponentColor);
    if (settings.topComponentSize !== undefined) setTopComponentSize(settings.topComponentSize);
    if (settings.bottomComponentSize !== undefined) setBottomComponentSize(settings.bottomComponentSize);
    if (settings.componentConnectionColor !== undefined) setComponentConnectionColor(settings.componentConnectionColor);
    if (settings.componentConnectionSize !== undefined) setComponentConnectionSize(settings.componentConnectionSize);
  }, []);

  // No-op functions - settings are now only saved in project file
  // Kept for compatibility with existing code that calls these
  const saveDefaultSize = useCallback((_type: 'via' | 'pad' | 'testPoint' | 'trace' | 'component' | 'componentConnection' | 'power' | 'ground' | 'brush', _size: number, _layer?: 'top' | 'bottom') => {
    // No-op: Settings are now saved in project file, not localStorage
  }, []);

  const saveDefaultColor = useCallback((_type: 'via' | 'pad' | 'testPoint' | 'trace' | 'component' | 'componentConnection' | 'brush', _color: string, _layer?: 'top' | 'bottom') => {
    // No-op: Settings are now saved in project file, not localStorage
  }, []);

  // Get current settings for saving to project file
  const getCurrentSettings = useCallback((): LayerSettingsState => {
    return {
      brushColor,
      brushSize,
      topTraceColor,
      bottomTraceColor,
      topTraceSize,
      bottomTraceSize,
      viaSize: LAYER_DEFAULTS.viaSize, // Include via settings
      viaColor: LAYER_DEFAULTS.viaColor,
      topPadColor,
      bottomPadColor,
      topPadSize,
      bottomPadSize,
      topTestPointColor,
      bottomTestPointColor,
      topTestPointSize,
      bottomTestPointSize,
      topComponentColor,
      bottomComponentColor,
      topComponentSize,
      bottomComponentSize,
      componentConnectionColor,
      componentConnectionSize,
    };
  }, [
    brushColor, brushSize, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize,
    topPadColor, bottomPadColor, topPadSize, bottomPadSize,
    topTestPointColor, bottomTestPointColor, topTestPointSize, bottomTestPointSize,
    topComponentColor, bottomComponentColor, topComponentSize, bottomComponentSize,
    componentConnectionColor, componentConnectionSize,
  ]);

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
    topTestPointColor,
    setTopTestPointColor,
    bottomTestPointColor,
    setBottomTestPointColor,
    topTestPointSize,
    setTopTestPointSize,
    bottomTestPointSize,
    setBottomTestPointSize,
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
    resetToDefaults,
    loadFromProject,
    getCurrentSettings,
    saveDefaultSize,  // No-op
    saveDefaultColor, // No-op
  };
}

