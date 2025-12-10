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

import { useState, useCallback, useRef, useEffect } from 'react';

export type Tool = 'none' | 'select' | 'draw' | 'erase' | 'transform' | 'magnify' | 'pan' | 'component' | 'ground' | 'power' | 'center' | 'componentConnection';
export type Layer = 'top' | 'bottom';

export interface ToolSettings {
  color: string;
  size: number;
}

export interface ToolDefinition {
  id: string;
  name: string;
  toolType: Tool;
  drawingMode?: 'trace' | 'via' | 'pad' | 'testPoint';
  icon?: string;
  shortcut?: string;
  tooltip?: string;
  colorReflective?: boolean;
  settings: ToolSettings;
  layerSettings: Map<Layer, ToolSettings>;
  defaultLayer?: 'top' | 'bottom';
}

/**
 * Custom hook for managing tool registry and tool state
 * Note: This hook requires the createToolRegistry function to be passed in
 * since it depends on constants that may not be available in this module
 * 
 * All tool settings are stored in memory only and saved/loaded from project files.
 * No localStorage is used - every new project starts with default settings.
 */
export function useToolRegistry(
  createToolRegistry: () => Map<string, ToolDefinition>,
  currentTool: Tool,
  drawingMode: 'trace' | 'via' | 'pad' | 'testPoint',
  brushColor: string,
  brushSize: number,
  topTraceColor: string,
  bottomTraceColor: string,
  topTraceSize: number,
  bottomTraceSize: number,
  topPadColor: string,
  bottomPadColor: string,
  topPadSize: number,
  bottomPadSize: number,
  // Props kept for API compatibility but not used
  topTestPointColor: string,
  bottomTestPointColor: string,
  topTestPointSize: number,
  bottomTestPointSize: number,
  topComponentColor: string,
  bottomComponentColor: string,
  topComponentSize: number,
  bottomComponentSize: number,
  traceToolLayer: 'top' | 'bottom',
  padToolLayer: 'top' | 'bottom',
  testPointToolLayer: 'top' | 'bottom',
  componentToolLayer: 'top' | 'bottom'
) {
  // Suppress unused parameter warnings
  void topTestPointColor;
  void bottomTestPointColor;
  void topTestPointSize;
  void bottomTestPointSize;
  void topComponentColor;
  void bottomComponentColor;
  void topComponentSize;
  void bottomComponentSize;
  void traceToolLayer;
  void padToolLayer;
  void testPointToolLayer;
  void componentToolLayer;
  
  const [toolRegistry, setToolRegistry] = useState<Map<string, ToolDefinition>>(() => createToolRegistry());
  const prevToolIdRef = useRef<string | null>(null);
  const prevBrushColorRef = useRef<string>(brushColor);
  const prevBrushSizeRef = useRef<number>(brushSize);

  // Helper to get current tool definition
  const getCurrentToolDef = useCallback((registry: Map<string, ToolDefinition>) => {
    if (currentTool === 'draw' && drawingMode === 'trace') return registry.get('trace');
    if (currentTool === 'draw' && drawingMode === 'via') return registry.get('via');
    if (currentTool === 'draw' && drawingMode === 'pad') return registry.get('pad');
    if (currentTool === 'component') return registry.get('component');
    if (currentTool === 'power') return registry.get('power');
    if (currentTool === 'ground') return registry.get('ground');
    return null;
  }, [currentTool, drawingMode]);

  // Update tool registry when tool changes or settings change
  // Tool settings are stored in memory only (no localStorage)
  useEffect(() => {
    setToolRegistry(prev => {
      const currentToolDef = getCurrentToolDef(prev);
      const currentToolId = currentToolDef?.id || null;
      const prevToolId = prevToolIdRef.current;
      const updated = new Map(prev);
      
      // Save previous tool's settings to the registry (in memory only)
      if (prevToolId && prevToolId !== currentToolId) {
        const prevToolDef = prev.get(prevToolId);
        if (prevToolDef) {
          updated.set(prevToolId, {
            ...prevToolDef,
            settings: { color: prevBrushColorRef.current, size: prevBrushSizeRef.current }
          });
        }
      }
      
      // Restore new tool's settings from registry
      if (currentToolDef && currentToolId !== prevToolId) {
        if (currentTool === 'draw' && drawingMode === 'trace') {
          const layer = traceToolLayer || 'top';
          const traceColor = layer === 'top' ? topTraceColor : bottomTraceColor;
          const traceSize = layer === 'top' ? topTraceSize : bottomTraceSize;
          prevBrushColorRef.current = traceColor;
          prevBrushSizeRef.current = traceSize;
          updated.set('trace', { ...currentToolDef, settings: { color: traceColor, size: traceSize } });
        } else if (currentTool === 'draw' && drawingMode === 'pad') {
          const layer = padToolLayer || 'top';
          const padColor = layer === 'top' ? topPadColor : bottomPadColor;
          const padSize = layer === 'top' ? topPadSize : bottomPadSize;
          prevBrushColorRef.current = padColor;
          prevBrushSizeRef.current = padSize;
          updated.set('pad', { ...currentToolDef, settings: { color: padColor, size: padSize } });
        } else if (currentTool === 'component') {
          const layer = componentToolLayer || 'top';
          const componentColor = layer === 'top' ? topComponentColor : bottomComponentColor;
          const componentSize = layer === 'top' ? topComponentSize : bottomComponentSize;
          prevBrushColorRef.current = componentColor;
          prevBrushSizeRef.current = componentSize;
          updated.set('component', { ...currentToolDef, settings: { color: componentColor, size: componentSize } });
        } else {
          prevBrushColorRef.current = currentToolDef.settings.color;
          prevBrushSizeRef.current = currentToolDef.settings.size;
        }
      }
      
      prevToolIdRef.current = currentToolId;
      return updated;
    });
  }, [
    currentTool,
    drawingMode,
    brushColor,
    brushSize,
    topTraceColor,
    bottomTraceColor,
    topTraceSize,
    bottomTraceSize,
    topPadColor,
    bottomPadColor,
    topPadSize,
    bottomPadSize,
    topComponentColor,
    bottomComponentColor,
    topComponentSize,
    bottomComponentSize,
    traceToolLayer,
    padToolLayer,
    componentToolLayer,
    getCurrentToolDef,
  ]);

  const updateToolSettings = useCallback((toolId: string, settings: ToolSettings) => {
    setToolRegistry(prev => {
      const updated = new Map(prev);
      const toolDef = updated.get(toolId);
      if (toolDef) {
        updated.set(toolId, { ...toolDef, settings });
      }
      return updated;
    });
  }, []);

  const updateToolLayerSettings = useCallback((toolId: string, layer: Layer, settings: ToolSettings) => {
    setToolRegistry(prev => {
      const updated = new Map(prev);
      const toolDef = updated.get(toolId);
      if (toolDef) {
        const layerSettings = new Map(toolDef.layerSettings);
        layerSettings.set(layer, settings);
        updated.set(toolId, { ...toolDef, layerSettings });
      }
      return updated;
    });
  }, []);

  return {
    toolRegistry,
    setToolRegistry,
    updateToolSettings,
    updateToolLayerSettings,
    getCurrentToolDef,
  };
}

