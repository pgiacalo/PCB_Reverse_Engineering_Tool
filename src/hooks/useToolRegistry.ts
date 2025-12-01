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
  drawingMode?: 'trace' | 'via' | 'pad';
  icon?: string;
  shortcut?: string;
  tooltip?: string;
  colorReflective?: boolean;
  settings: ToolSettings;
  layerSettings: Map<Layer, ToolSettings>;
  defaultLayer?: 'top' | 'bottom';
}

// Helper functions to load/save per-tool settings from localStorage
// These are currently unused but may be needed if createToolRegistry is moved here
// @ts-expect-error - intentionally unused for now
const _loadToolSettings = (toolId: string, defaultColor: string, defaultSize: number): ToolSettings => {
  const colorKey = `tool_${toolId}_color`;
  const sizeKey = `tool_${toolId}_size`;
  const savedColor = localStorage.getItem(colorKey);
  const savedSize = localStorage.getItem(sizeKey);
  return {
    color: savedColor || defaultColor,
    size: savedSize ? parseInt(savedSize, 10) : defaultSize,
  };
};

// @ts-expect-error - intentionally unused for now
const _loadToolLayerSettings = (toolId: string, layer: Layer, defaultColor: string, defaultSize: number): ToolSettings => {
  const colorKey = `tool_${toolId}_${layer}_color`;
  const sizeKey = `tool_${toolId}_${layer}_size`;
  const savedColor = localStorage.getItem(colorKey);
  const savedSize = localStorage.getItem(sizeKey);
  return {
    color: savedColor || defaultColor,
    size: savedSize ? parseInt(savedSize, 10) : defaultSize,
  };
};

const saveToolSettings = (toolId: string, color: string, size: number) => {
  const colorKey = `tool_${toolId}_color`;
  const sizeKey = `tool_${toolId}_size`;
  localStorage.setItem(colorKey, color);
  localStorage.setItem(sizeKey, String(size));
};

// @ts-expect-error - intentionally unused for now
const _saveToolLayerSettings = (toolId: string, layer: Layer, color: string, size: number) => {
  const colorKey = `tool_${toolId}_${layer}_color`;
  const sizeKey = `tool_${toolId}_${layer}_size`;
  localStorage.setItem(colorKey, color);
  localStorage.setItem(sizeKey, String(size));
};

/**
 * Custom hook for managing tool registry and tool state
 * Note: This hook requires the createToolRegistry function to be passed in
 * since it depends on constants that may not be available in this module
 */
export function useToolRegistry(
  createToolRegistry: () => Map<string, ToolDefinition>,
  currentTool: Tool,
  drawingMode: 'trace' | 'via' | 'pad',
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
  topComponentColor: string,
  bottomComponentColor: string,
  topComponentSize: number,
  bottomComponentSize: number,
  traceToolLayer: 'top' | 'bottom',
  padToolLayer: 'top' | 'bottom',
  componentToolLayer: 'top' | 'bottom'
) {
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
  useEffect(() => {
    setToolRegistry(prev => {
      const currentToolDef = getCurrentToolDef(prev);
      const currentToolId = currentToolDef?.id || null;
      const prevToolId = prevToolIdRef.current;
      const updated = new Map(prev);
      
      // Save previous tool's settings to localStorage before switching
      if (prevToolId && prevToolId !== currentToolId) {
        const prevToolDef = prev.get(prevToolId);
        if (prevToolDef) {
          saveToolSettings(prevToolId, prevBrushColorRef.current, prevBrushSizeRef.current);
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

