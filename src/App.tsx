import React, { useState, useRef, useCallback } from 'react';
import { rectTransformedBounds, mergeBounds, type Bounds } from './utils/geometry';
import { PenLine, MousePointer } from 'lucide-react';
import { createComponent } from './utils/components';
import { 
  COMPONENT_TYPE_INFO, 
  DEFAULT_VIA_COLOR, 
  DEFAULT_TRACE_COLOR, 
  DEFAULT_COMPONENT_COLOR, 
  DEFAULT_GROUND_COLOR,
  DEFAULT_PAD_COLOR,
  DEFAULT_POWER_COLOR,
  VIA,
  COMPONENT_ICON
} from './constants';
import { generatePointId, setPointIdCounter, getPointIdCounter, truncatePoint } from './utils/coordinates';
import { generateSimpleSchematic } from './utils/schematic';
import { formatTimestamp } from './utils/fileOperations';
import type { ComponentType, PCBComponent, DrawingStroke as ImportedDrawingStroke } from './types';
import './App.css';

interface PCBImage {
  url: string;
  name: string;
  width: number;
  height: number;
  // Persistable image content for Save/Load (data URL)
  dataUrl?: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  // Skew (keystone) angles in radians; applied as affine shear
  skewX?: number;
  skewY?: number;
  // Keystone (perspective-like taper) in radians for vertical and horizontal
  keystoneV?: number;
  keystoneH?: number;
  bitmap?: ImageBitmap | null;
}

interface DrawingPoint {
  id?: number; // globally unique point ID (used for netlist connections) - only assigned when point connects to a via or pad
  x: number;
  y: number;
}

interface DrawingStroke {
  id: string;
  points: DrawingPoint[];
  color: string;
  size: number;
  layer: 'top' | 'bottom';
  type?: 'trace' | 'via' | 'pad';
  viaType?: string; // For vias: "Via (Signal)", "Via (Ground)", "Via (+5VDC Power Node)", etc.
  padType?: string; // For pads: "Pad (Signal)", "Pad (Ground)", "Pad (+5VDC Power Node)", etc.
}

// Independent stacks for saved/managed drawing objects
interface Via {
  id?: string; // stroke ID (for deletion/selection tracking)
  pointId?: number; // globally unique point ID (for netlist connections)
  x: number;
  y: number;
  size: number;
  color: string;
}

interface Pad {
  id?: string; // stroke ID (for deletion/selection tracking)
  pointId?: number; // globally unique point ID (for netlist connections)
  x: number;
  y: number;
  size: number;
  color: string;
  layer: 'top' | 'bottom'; // Pad layer (unlike vias which are shared)
}

interface TraceSegment {
  id?: string; // stroke ID (for deletion/selection tracking)
  startPointId?: number; // globally unique point ID for start point (for netlist connections)
  endPointId?: number; // globally unique point ID for end point (for netlist connections)
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  size: number;
  color: string;
}

// PCBComponent is now imported from './types'
interface GroundSymbol {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  type?: string; // Type of ground symbol (e.g., "GND", "AGND", "DGND", etc.)
  pointId?: number; // globally unique point ID (for netlist connections)
}
interface PowerBus {
  id: string;
  name: string; // e.g., "3.3VDC", "+5V", "+12V", "AC_120V"
  voltage: string; // e.g., "3.3VDC", "+5V", "+12V", "AC_120V"
  color: string; // Display color for this power bus
}

interface PowerSymbol {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  powerBusId: string; // Reference to which power bus this node belongs to
  layer: 'top' | 'bottom'; // Layer on which the power node is placed
  type?: string; // Type of power symbol (e.g., "VCC", "VDD", "VSS", etc.)
  pointId?: number; // globally unique point ID (for netlist connections)
}
type ViewMode = 'top' | 'bottom' | 'overlay';
type Tool = 'none' | 'select' | 'draw' | 'erase' | 'transform' | 'magnify' | 'pan' | 'component' | 'ground' | 'power';

// Helper function to get default abbreviation from component type
const getDefaultAbbreviation = (componentType: ComponentType): string => {
  const info = COMPONENT_TYPE_INFO[componentType];
  if (!info || !info.prefix || info.prefix.length < 1) {
    return '?';
  }
  // Use just the first letter of the first prefix
  const firstPrefix = info.prefix[0];
  return firstPrefix.substring(0, 1).toUpperCase();
};

// Tool settings interface
interface ToolSettings {
  color: string;
  size: number;
}

// Layer type
type Layer = 'top' | 'bottom';

// Tool definition interface - each tool has its own attributes including settings
interface ToolDefinition {
  id: string; // Unique identifier: 'select', 'trace', 'via', 'component', 'ground', etc.
  name: string; // Display name
  toolType: Tool; // The underlying tool type
  drawingMode?: 'trace' | 'via' | 'pad'; // For draw tools, which mode
  icon?: string; // Icon/symbol for the tool
  shortcut?: string; // Keyboard shortcut
  tooltip?: string; // Tooltip text
  colorReflective?: boolean; // Whether icon color reflects brush color
  settings: ToolSettings; // Legacy: current/default settings (for backward compatibility)
  layerSettings: Map<Layer, ToolSettings>; // Layer-specific settings: Map<Layer, {color, size}>
  defaultLayer?: 'top' | 'bottom'; // Default layer preference
}

// Helper functions to load/save per-tool settings from localStorage
const loadToolSettings = (toolId: string, defaultColor: string, defaultSize: number): ToolSettings => {
  const colorKey = `tool_${toolId}_color`;
  const sizeKey = `tool_${toolId}_size`;
  const savedColor = localStorage.getItem(colorKey);
  const savedSize = localStorage.getItem(sizeKey);
  return {
    color: savedColor || defaultColor,
    size: savedSize ? parseInt(savedSize, 10) : defaultSize,
  };
};

const saveToolSettings = (toolId: string, color: string, size: number): void => {
  localStorage.setItem(`tool_${toolId}_color`, color);
  localStorage.setItem(`tool_${toolId}_size`, String(size));
};

// Helper functions to load/save layer-specific tool settings from localStorage
const loadToolLayerSettings = (toolId: string, layer: Layer, defaultColor: string, defaultSize: number): ToolSettings => {
  const colorKey = `tool_${toolId}_${layer}_color`;
  const sizeKey = `tool_${toolId}_${layer}_size`;
  const savedColor = localStorage.getItem(colorKey);
  const savedSize = localStorage.getItem(sizeKey);
  return {
    color: savedColor || defaultColor,
    size: savedSize ? parseInt(savedSize, 10) : defaultSize,
  };
};

const saveToolLayerSettings = (toolId: string, layer: Layer, color: string, size: number): void => {
  localStorage.setItem(`tool_${toolId}_${layer}_color`, color);
  localStorage.setItem(`tool_${toolId}_${layer}_size`, String(size));
};

// Helper functions for tool registry (prepared for future use)
// These functions are part of the generalized tool registry system but not yet used
// @ts-ignore - Reserved for future use in generalized tool system
const _getToolColor = (registry: Map<string, ToolDefinition>, toolId: string, layer: Layer): string => {
  const toolDef = registry.get(toolId);
  if (!toolDef) return '#000000';
  const layerSettings = toolDef.layerSettings.get(layer);
  return layerSettings?.color || toolDef.settings.color || '#000000';
};

// @ts-ignore - Reserved for future use
const _getToolSize = (registry: Map<string, ToolDefinition>, toolId: string, layer: Layer): number => {
  const toolDef = registry.get(toolId);
  if (!toolDef) return 10;
  const layerSettings = toolDef.layerSettings.get(layer);
  return layerSettings?.size || toolDef.settings.size || 10;
};

// @ts-ignore - Reserved for future use
const _setToolColor = (registry: Map<string, ToolDefinition>, toolId: string, layer: Layer, color: string): Map<string, ToolDefinition> => {
  const updated = new Map(registry);
  const toolDef = updated.get(toolId);
  if (!toolDef) return updated;
  
  const layerSettings = new Map(toolDef.layerSettings);
  const currentLayerSettings = layerSettings.get(layer) || { color: toolDef.settings.color, size: toolDef.settings.size };
  layerSettings.set(layer, { ...currentLayerSettings, color });
  
  updated.set(toolId, { ...toolDef, layerSettings });
  saveToolLayerSettings(toolId, layer, color, currentLayerSettings.size);
  return updated;
};

// @ts-ignore - Reserved for future use
const _setToolSize = (registry: Map<string, ToolDefinition>, toolId: string, layer: Layer, size: number): Map<string, ToolDefinition> => {
  const updated = new Map(registry);
  const toolDef = updated.get(toolId);
  if (!toolDef) return updated;
  
  const layerSettings = new Map(toolDef.layerSettings);
  const currentLayerSettings = layerSettings.get(layer) || { color: toolDef.settings.color, size: toolDef.settings.size };
  layerSettings.set(layer, { ...currentLayerSettings, size });
  
  updated.set(toolId, { ...toolDef, layerSettings });
  saveToolLayerSettings(toolId, layer, currentLayerSettings.color, size);
  return updated;
};

// Tool registry - centralized definition of all tools with their attributes
// Settings are loaded from localStorage with fallback to defaults
const createToolRegistry = (): Map<string, ToolDefinition> => {
  const registry = new Map<string, ToolDefinition>();
  
  // Default layer-specific colors and sizes (from user requirements)
  const DEFAULT_PAD_COLORS = { top: '#0072B2', bottom: '#56B4E9' };
  const DEFAULT_PAD_SIZES = { top: VIA.DEFAULT_SIZE, bottom: VIA.DEFAULT_SIZE };
  const DEFAULT_TRACE_COLORS = { top: '#AA4499', bottom: '#F781BF' };
  const DEFAULT_TRACE_SIZES = { top: 6, bottom: 6 };
  const DEFAULT_COMPONENT_COLORS = { top: '#6A3D9A', bottom: '#9467BD' };
  const DEFAULT_COMPONENT_SIZES = { top: 18, bottom: 18 };
  
  registry.set('select', {
    id: 'select',
    name: 'Select',
    toolType: 'select',
    icon: '⊕',
    shortcut: 'S',
    tooltip: 'Select objects or groups',
    colorReflective: false,
    settings: loadToolSettings('select', '#ff0000', 10),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('select', 'top', '#ff0000', 10)],
      ['bottom', loadToolLayerSettings('select', 'bottom', '#ff0000', 10)],
    ] as [Layer, ToolSettings][]),
  });
  
  registry.set('via', {
    id: 'via',
    name: 'Via',
    toolType: 'draw',
    drawingMode: 'via',
    icon: '◎',
    shortcut: 'V',
    tooltip: 'Place via connection',
    colorReflective: true,
    settings: loadToolSettings('via', DEFAULT_VIA_COLOR, VIA.DEFAULT_SIZE),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('via', 'top', DEFAULT_VIA_COLOR, VIA.DEFAULT_SIZE)],
      ['bottom', loadToolLayerSettings('via', 'bottom', DEFAULT_VIA_COLOR, VIA.DEFAULT_SIZE)],
    ] as [Layer, ToolSettings][]),
    defaultLayer: 'top',
  });
  
  registry.set('pad', {
    id: 'pad',
    name: 'Pad',
    toolType: 'draw',
    drawingMode: 'pad',
    icon: '▢',
    shortcut: 'P',
    tooltip: 'Place pad connection',
    colorReflective: true,
    settings: loadToolSettings('pad', DEFAULT_PAD_COLOR, VIA.DEFAULT_SIZE),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('pad', 'top', DEFAULT_PAD_COLORS.top, DEFAULT_PAD_SIZES.top)],
      ['bottom', loadToolLayerSettings('pad', 'bottom', DEFAULT_PAD_COLORS.bottom, DEFAULT_PAD_SIZES.bottom)],
    ] as [Layer, ToolSettings][]),
    defaultLayer: 'top',
  });
  
  registry.set('trace', {
    id: 'trace',
    name: 'Trace',
    toolType: 'draw',
    drawingMode: 'trace',
    icon: '╱',
    shortcut: 'T',
    tooltip: 'Draw copper traces',
    colorReflective: true,
    settings: loadToolSettings('trace', DEFAULT_TRACE_COLOR, 2),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('trace', 'top', DEFAULT_TRACE_COLORS.top, DEFAULT_TRACE_SIZES.top)],
      ['bottom', loadToolLayerSettings('trace', 'bottom', DEFAULT_TRACE_COLORS.bottom, DEFAULT_TRACE_SIZES.bottom)],
    ] as [Layer, ToolSettings][]),
    defaultLayer: 'top',
  });
  
  registry.set('component', {
    id: 'component',
    name: 'Component',
    toolType: 'component',
    icon: '▭',
    shortcut: 'C',
    tooltip: 'Place component',
    colorReflective: true,
    settings: loadToolSettings('component', DEFAULT_COMPONENT_COLOR, COMPONENT_ICON.DEFAULT_SIZE),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('component', 'top', DEFAULT_COMPONENT_COLORS.top, DEFAULT_COMPONENT_SIZES.top)],
      ['bottom', loadToolLayerSettings('component', 'bottom', DEFAULT_COMPONENT_COLORS.bottom, DEFAULT_COMPONENT_SIZES.bottom)],
    ] as [Layer, ToolSettings][]),
    defaultLayer: 'top',
  });
  
  registry.set('power', {
    id: 'power',
    name: 'Power',
    toolType: 'power',
    icon: '⊕',
    shortcut: 'W',
    tooltip: 'Place power node',
    colorReflective: true,
    settings: loadToolSettings('power', DEFAULT_POWER_COLOR, 26),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('power', 'top', DEFAULT_POWER_COLOR, 26)],
      ['bottom', loadToolLayerSettings('power', 'bottom', DEFAULT_POWER_COLOR, 26)],
    ] as [Layer, ToolSettings][]),
    defaultLayer: 'top',
  });
  
  registry.set('ground', {
    id: 'ground',
    name: 'Ground',
    toolType: 'ground',
    icon: '⏚',
    shortcut: 'G',
    tooltip: 'Place ground symbol',
    colorReflective: true,
    settings: loadToolSettings('ground', DEFAULT_GROUND_COLOR, 26),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('ground', 'top', DEFAULT_GROUND_COLOR, 26)],
      ['bottom', loadToolLayerSettings('ground', 'bottom', DEFAULT_GROUND_COLOR, 26)],
    ] as [Layer, ToolSettings][]),
    defaultLayer: 'top',
  });
  
  registry.set('erase', {
    id: 'erase',
    name: 'Erase',
    toolType: 'erase',
    icon: '▭',
    shortcut: 'E',
    tooltip: 'Erase objects',
    colorReflective: false,
    settings: loadToolSettings('erase', '#f5a3b3', 5),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('erase', 'top', '#f5a3b3', 5)],
      ['bottom', loadToolLayerSettings('erase', 'bottom', '#f5a3b3', 5)],
    ] as [Layer, ToolSettings][]),
  });
  
  registry.set('pan', {
    id: 'pan',
    name: 'Move',
    toolType: 'pan',
    icon: '✋',
    shortcut: 'H',
    tooltip: 'Pan the view',
    colorReflective: false,
    settings: loadToolSettings('pan', '#ff0000', 10),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('pan', 'top', '#ff0000', 10)],
      ['bottom', loadToolLayerSettings('pan', 'bottom', '#ff0000', 10)],
    ] as [Layer, ToolSettings][]),
  });
  
  registry.set('magnify', {
    id: 'magnify',
    name: 'Zoom',
    toolType: 'magnify',
    icon: '🔍+',
    shortcut: 'Z',
    tooltip: 'Zoom In (or Zoom Out)',
    colorReflective: false,
    settings: loadToolSettings('magnify', '#ff0000', 10),
    layerSettings: new Map([
      ['top', loadToolLayerSettings('magnify', 'top', '#ff0000', 10)],
      ['bottom', loadToolLayerSettings('magnify', 'bottom', '#ff0000', 10)],
    ] as [Layer, ToolSettings][]),
  });
  
  return registry;
};

function App() {
  const CONTENT_BORDER = 40; // fixed border (in canvas pixels) where nothing is drawn
  const [topImage, setTopImage] = useState<PCBImage | null>(null);
  const [bottomImage, setBottomImage] = useState<PCBImage | null>(null);
  const [currentView, setCurrentView] = useState<ViewMode>('overlay');
  const [transparency, setTransparency] = useState(50);
  const [isTransparencyCycling, setIsTransparencyCycling] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool>('none');
  // Load persisted defaults from localStorage
  const loadPersistedDefaults = useCallback(() => {
    const defaults = {
      brushColor: localStorage.getItem('defaultBrushColor') || '#008080',
      brushSize: parseInt(localStorage.getItem('defaultBrushSize') || '6', 10),
      topTraceColor: localStorage.getItem('defaultTopTraceColor') || '#AA4499',
      bottomTraceColor: localStorage.getItem('defaultBottomTraceColor') || '#F781BF',
      topTraceSize: parseInt(localStorage.getItem('defaultTopTraceSize') || '6', 10),
      bottomTraceSize: parseInt(localStorage.getItem('defaultBottomTraceSize') || '6', 10),
      viaSize: parseInt(localStorage.getItem('defaultViaSize') || '26', 10),
      viaColor: localStorage.getItem('defaultViaColor') || '#ff0000',
      topPadColor: localStorage.getItem('defaultTopPadColor') || '#0072B2',
      bottomPadColor: localStorage.getItem('defaultBottomPadColor') || '#56B4E9',
      topPadSize: parseInt(localStorage.getItem('defaultTopPadSize') || '26', 10),
      bottomPadSize: parseInt(localStorage.getItem('defaultBottomPadSize') || '26', 10),
      topComponentColor: localStorage.getItem('defaultTopComponentColor') || '#8C564B',
      bottomComponentColor: localStorage.getItem('defaultBottomComponentColor') || '#9C755F',
      topComponentSize: parseInt(localStorage.getItem('defaultTopComponentSize') || '18', 10),
      bottomComponentSize: parseInt(localStorage.getItem('defaultBottomComponentSize') || '18', 10),
      powerSize: parseInt(localStorage.getItem('defaultPowerSize') || '18', 10),
      groundSize: parseInt(localStorage.getItem('defaultGroundSize') || '18', 10),
    };
    return defaults;
  }, []);

  // Save defaults to localStorage
  const saveDefaultSize = useCallback((type: 'via' | 'pad' | 'trace' | 'component' | 'power' | 'ground' | 'brush', size: number, layer?: 'top' | 'bottom') => {
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

  const saveDefaultColor = useCallback((type: 'via' | 'pad' | 'trace' | 'component' | 'brush', color: string, layer?: 'top' | 'bottom') => {
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
    } else if (type === 'via') {
      localStorage.setItem('defaultViaColor', color);
    } else if (type === 'brush') {
      localStorage.setItem('defaultBrushColor', color);
    }
  }, []);

  const persistedDefaults = loadPersistedDefaults();
  const [brushColor, setBrushColor] = useState(persistedDefaults.brushColor);
  const [brushSize, setBrushSize] = useState(persistedDefaults.brushSize);
  // Trace colors per layer
  const [topTraceColor, setTopTraceColor] = useState(persistedDefaults.topTraceColor);
  const [bottomTraceColor, setBottomTraceColor] = useState(persistedDefaults.bottomTraceColor);
  // Trace sizes per layer
  const [topTraceSize, setTopTraceSize] = useState(persistedDefaults.topTraceSize);
  const [bottomTraceSize, setBottomTraceSize] = useState(persistedDefaults.bottomTraceSize);
  // Pad colors and sizes per layer
  const [topPadColor, setTopPadColor] = useState(persistedDefaults.topPadColor);
  const [bottomPadColor, setBottomPadColor] = useState(persistedDefaults.bottomPadColor);
  const [topPadSize, setTopPadSize] = useState(persistedDefaults.topPadSize);
  const [bottomPadSize, setBottomPadSize] = useState(persistedDefaults.bottomPadSize);
  // Component colors and sizes per layer
  const [topComponentColor, setTopComponentColor] = useState(persistedDefaults.topComponentColor);
  const [bottomComponentColor, setBottomComponentColor] = useState(persistedDefaults.bottomComponentColor);
  const [topComponentSize, setTopComponentSize] = useState(persistedDefaults.topComponentSize);
  const [bottomComponentSize, setBottomComponentSize] = useState(persistedDefaults.bottomComponentSize);
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  // Tool registry - centralized tool definitions with settings as attributes
  const [toolRegistry, setToolRegistry] = useState<Map<string, ToolDefinition>>(() => createToolRegistry());
  
  const [drawingStrokes, setDrawingStrokes] = useState<DrawingStroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<DrawingPoint[]>([]);
  const [tracePreviewMousePos, setTracePreviewMousePos] = useState<{ x: number; y: number } | null>(null);
  const [selectedImageForTransform, setSelectedImageForTransform] = useState<'top' | 'bottom' | 'both' | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformStartPos, setTransformStartPos] = useState<{ x: number; y: number } | null>(null);
  const [transformMode, setTransformMode] = useState<'nudge' | 'scale' | 'rotate' | 'slant' | 'keystone'>('nudge');
  const [isGrayscale, setIsGrayscale] = useState(false);
  const [isBlackAndWhiteEdges, setIsBlackAndWhiteEdges] = useState(false);
  const [isBlackAndWhiteInverted, setIsBlackAndWhiteInverted] = useState(false);
  const [selectedDrawingLayer, setSelectedDrawingLayer] = useState<'top' | 'bottom'>('top');
  const [showBothLayers, setShowBothLayers] = useState(false);
  const [isShiftConstrained, setIsShiftConstrained] = useState(false);
  const [viewScale, setViewScale] = useState(1);
  const [viewPan, setViewPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [drawingMode, setDrawingMode] = useState<'trace' | 'via' | 'pad'>('trace');
  
  // Save current settings when switching away from a tool and restore new tool's settings
  const prevToolIdRef = React.useRef<string | null>(null);
  const prevBrushColorRef = React.useRef<string>(brushColor);
  const prevBrushSizeRef = React.useRef<number>(brushSize);
  
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
  
  React.useEffect(() => {
    // Use functional update to avoid dependency on toolRegistry
    setToolRegistry(prev => {
      const currentToolDef = getCurrentToolDef(prev);
      const currentToolId = currentToolDef?.id || null;
      const prevToolId = prevToolIdRef.current;
      const updated = new Map(prev);
      
      // Save previous tool's settings to localStorage before switching
      if (prevToolId && prevToolId !== currentToolId) {
        const prevToolDef = prev.get(prevToolId);
        if (prevToolDef) {
          // Save to localStorage
          saveToolSettings(prevToolId, prevBrushColorRef.current, prevBrushSizeRef.current);
          // Update registry
          updated.set(prevToolId, {
            ...prevToolDef,
            settings: { color: prevBrushColorRef.current, size: prevBrushSizeRef.current }
          });
        }
      }
      
      // Restore new tool's settings from registry (which loads from localStorage)
      // For trace, pad, and component tools, use layer-specific colors
      if (currentToolDef && currentToolId !== prevToolId) {
        if (currentTool === 'draw' && drawingMode === 'trace') {
          // Use layer-specific trace colors
          const layer = traceToolLayer || 'top';
          const traceColor = layer === 'top' ? topTraceColor : bottomTraceColor;
          const traceSize = layer === 'top' ? topTraceSize : bottomTraceSize;
          setBrushColor(traceColor);
          setBrushSize(traceSize);
          prevBrushColorRef.current = traceColor;
          prevBrushSizeRef.current = traceSize;
          // Update toolRegistry to reflect current layer's color
          updated.set('trace', { ...currentToolDef, settings: { color: traceColor, size: traceSize } });
        } else if (currentTool === 'draw' && drawingMode === 'pad') {
          // Use layer-specific pad colors
          const layer = padToolLayer || 'top';
          const padColor = layer === 'top' ? topPadColor : bottomPadColor;
          const padSize = layer === 'top' ? topPadSize : bottomPadSize;
          setBrushColor(padColor);
          setBrushSize(padSize);
          prevBrushColorRef.current = padColor;
          prevBrushSizeRef.current = padSize;
          // Update toolRegistry to reflect current layer's color
          updated.set('pad', { ...currentToolDef, settings: { color: padColor, size: padSize } });
        } else if (currentTool === 'component') {
          // Use layer-specific component colors
          const layer = componentToolLayer || 'top';
          const componentColor = layer === 'top' ? topComponentColor : bottomComponentColor;
          const componentSize = layer === 'top' ? topComponentSize : bottomComponentSize;
          setBrushColor(componentColor);
          setBrushSize(componentSize);
          prevBrushColorRef.current = componentColor;
          prevBrushSizeRef.current = componentSize;
          // Update toolRegistry to reflect current layer's color
          updated.set('component', { ...currentToolDef, settings: { color: componentColor, size: componentSize } });
        } else {
          // For other tools, use registry settings
          const settings = currentToolDef.settings;
          setBrushColor(settings.color);
          setBrushSize(settings.size);
          prevBrushColorRef.current = settings.color;
          prevBrushSizeRef.current = settings.size;
        }
      }
      
      prevToolIdRef.current = currentToolId;
      return updated;
    });
  }, [currentTool, drawingMode, getCurrentToolDef, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize, topPadColor, bottomPadColor, topPadSize, bottomPadSize, topComponentColor, bottomComponentColor, topComponentSize, bottomComponentSize]); // Only depend on tool changes
  
  // Update tool-specific settings when color/size changes (for the active tool)
  // This persists to localStorage and updates the registry
  // Also saves layer-specific defaults for trace, pad, and component tools
  React.useEffect(() => {
    setToolRegistry(prev => {
      const currentToolDef = getCurrentToolDef(prev);
      
      if (currentToolDef) {
        // Save to localStorage
        saveToolSettings(currentToolDef.id, brushColor, brushSize);
        
        // Also save layer-specific defaults for trace, pad, and component
        if (currentTool === 'draw' && drawingMode === 'trace') {
          const layer = traceToolLayer || 'top';
          if (layer === 'top') {
            setTopTraceColor(brushColor);
            setTopTraceSize(brushSize);
            saveDefaultColor('trace', brushColor, 'top');
            saveDefaultSize('trace', brushSize, 'top');
          } else {
            setBottomTraceColor(brushColor);
            setBottomTraceSize(brushSize);
            saveDefaultColor('trace', brushColor, 'bottom');
            saveDefaultSize('trace', brushSize, 'bottom');
          }
        } else if (currentTool === 'draw' && drawingMode === 'pad') {
          const layer = padToolLayer || 'top';
          if (layer === 'top') {
            setTopPadColor(brushColor);
            setTopPadSize(brushSize);
            saveDefaultColor('pad', brushColor, 'top');
            saveDefaultSize('pad', brushSize, 'top');
          } else {
            setBottomPadColor(brushColor);
            setBottomPadSize(brushSize);
            saveDefaultColor('pad', brushColor, 'bottom');
            saveDefaultSize('pad', brushSize, 'bottom');
          }
        } else if (currentTool === 'component') {
          const layer = componentToolLayer || 'top';
          if (layer === 'top') {
            setTopComponentColor(brushColor);
            setTopComponentSize(brushSize);
            saveDefaultColor('component', brushColor, 'top');
            saveDefaultSize('component', brushSize, 'top');
          } else {
            setBottomComponentColor(brushColor);
            setBottomComponentSize(brushSize);
            saveDefaultColor('component', brushColor, 'bottom');
            saveDefaultSize('component', brushSize, 'bottom');
          }
        }
        
        // Update registry
        const updated = new Map(prev);
        updated.set(currentToolDef.id, {
          ...currentToolDef,
          settings: { color: brushColor, size: brushSize }
        });
        prevBrushColorRef.current = brushColor;
        prevBrushSizeRef.current = brushSize;
        return updated;
      }
      return prev;
    });
  }, [brushColor, brushSize, currentTool, drawingMode, getCurrentToolDef, saveDefaultColor, saveDefaultSize]);
  
  // Show power bus selector when power tool is selected
  React.useEffect(() => {
    if (currentTool === 'power') {
      setShowPowerBusSelector(true);
      setSelectedPowerBusId(null); // Reset selection when tool is selected
    } else {
      setShowPowerBusSelector(false);
      setSelectedPowerBusId(null);
    }
  }, [currentTool]);
  
  const [canvasCursor, setCanvasCursor] = useState<string | undefined>(undefined);
  const [, setViaOrderTop] = useState<string[]>([]);
  const [, setViaOrderBottom] = useState<string[]>([]);
  
  // Lock states
  const [areImagesLocked, setAreImagesLocked] = useState(false);
  const [areViasLocked, setAreViasLocked] = useState(false);
  const [arePadsLocked, setArePadsLocked] = useState(false);
  const [areTracesLocked, setAreTracesLocked] = useState(false);
  const [areComponentsLocked, setAreComponentsLocked] = useState(false);
  const [areGroundNodesLocked, setAreGroundNodesLocked] = useState(false);
  const [arePowerNodesLocked, setArePowerNodesLocked] = useState(false);
  const [, setTraceOrderTop] = useState<string[]>([]);
  const [, setTraceOrderBottom] = useState<string[]>([]);
  // Independent lists (stacks) derived from drawingStrokes
  const [vias, setVias] = useState<Via[]>([]);
  // @ts-ignore - Reserved for future use: pads extracted from drawingStrokes
  const [pads, setPads] = useState<Pad[]>([]);
  const [tracesTop, setTracesTop] = useState<TraceSegment[]>([]);
  const [tracesBottom, setTracesBottom] = useState<TraceSegment[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentStrokeRef = useRef<DrawingPoint[]>([]);
  const lastTraceClickTimeRef = useRef<number>(0);
  const isDoubleClickingTraceRef = useRef<boolean>(false);
  // Note: Point IDs are now generated globally via generatePointId() from coordinates.ts
  // This ensures globally unique IDs across all vias, traces, and connection points
  const [componentsTop, setComponentsTop] = useState<PCBComponent[]>([]);
  const [componentsBottom, setComponentsBottom] = useState<PCBComponent[]>([]);
  const [selectedComponentIds, setSelectedComponentIds] = useState<Set<string>>(new Set());
  const [selectedPowerIds, setSelectedPowerIds] = useState<Set<string>>(new Set());
  const [selectedGroundIds, setSelectedGroundIds] = useState<Set<string>>(new Set());
  const [componentEditor, setComponentEditor] = useState<{
    visible: boolean;
    layer: 'top' | 'bottom';
    id: string;
    designator: string;
    abbreviation: string;
    manufacturer: string;
    partNumber: string;
    pinCount: number;
    x: number;
    y: number;
  } | null>(null);
  // Pin connection mode: when a pin is clicked in the editor, track which component and pin
  const [connectingPin, setConnectingPin] = useState<{ componentId: string; pinIndex: number } | null>(null);
  // Component dialog drag state
  const [componentDialogPosition, setComponentDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingDialog, setIsDraggingDialog] = useState(false);
  const [dialogDragOffset, setDialogDragOffset] = useState<{ x: number; y: number } | null>(null);
  // Power properties editor
  const [powerEditor, setPowerEditor] = useState<{
    visible: boolean;
    id: string;
    layer: 'top' | 'bottom';
    x: number;
    y: number;
    size: number;
    color: string;
    powerBusId: string;
  } | null>(null);
  const hScrollRef = useRef<HTMLDivElement>(null);
  const vScrollRef = useRef<HTMLDivElement>(null);
  const hScrollContentRef = useRef<HTMLDivElement>(null);
  const vScrollContentRef = useRef<HTMLDivElement>(null);
  const fileInputTopRef = useRef<HTMLInputElement>(null);
  const fileInputBottomRef = useRef<HTMLInputElement>(null);
  const openProjectRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const transparencyCycleRafRef = useRef<number | null>(null);
  const transparencyCycleStartRef = useRef<number | null>(null);
  const isSyncingScrollRef = useRef<boolean>(false);
  const contentOriginXRef = useRef<number>(0);
  const contentOriginYRef = useRef<number>(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ startCX: number; startCY: number; panX: number; panY: number } | null>(null);
  const panClientStartRef = useRef<{ startClientX: number; startClientY: number; panX: number; panY: number } | null>(null);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 960, height: 600 });
  const [openMenu, setOpenMenu] = useState<'file' | 'transform' | 'tools' | 'about' | null>(null);
  // Removed unused showSetSizeSubmenu state
  // Set Size dialog state
  const [setSizeDialog, setSetSizeDialog] = useState<{ visible: boolean; size: number }>({ visible: false, size: 6 });
  const setSizeInputRef = useRef<HTMLInputElement>(null);
  // Auto Save dialog state
  const [autoSaveDialog, setAutoSaveDialog] = useState<{ visible: boolean; interval: number | null }>({ visible: false, interval: 5 });
  const [autoSavePromptDialog, setAutoSavePromptDialog] = useState<{ visible: boolean; source: 'new' | 'open' | null }>({ visible: false, source: null });
  const [debugDialog, setDebugDialog] = useState<{ visible: boolean; text: string }>({ visible: false, text: '' });
  const [errorDialog, setErrorDialog] = useState<{ visible: boolean; title: string; message: string }>({ visible: false, title: '', message: '' });
  const [newProjectDialog, setNewProjectDialog] = useState<{ visible: boolean }>({ visible: false });
  const newProjectYesButtonRef = useRef<HTMLButtonElement>(null);
  // New project setup dialog (for project name and directory selection)
  const [newProjectSetupDialog, setNewProjectSetupDialog] = useState<{ 
    visible: boolean; 
    projectName: string; 
    locationPath: string; 
    locationHandle: FileSystemDirectoryHandle | null;
  }>({ 
    visible: false, 
    projectName: '', 
    locationPath: '',
    locationHandle: null,
  });
  const newProjectNameInputRef = useRef<HTMLInputElement>(null);
  // Save As dialog (for file name and directory selection)
  const [saveAsDialog, setSaveAsDialog] = useState<{ 
    visible: boolean; 
    filename: string; 
    locationPath: string; 
    locationHandle: FileSystemDirectoryHandle | null;
  }>({ 
    visible: false, 
    filename: '', 
    locationPath: '',
    locationHandle: null,
  });
  const saveAsFilenameInputRef = useRef<HTMLInputElement>(null);
  // Auto Save state - default to disabled, user must enable it
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [autoSaveInterval, setAutoSaveInterval] = useState<number | null>(1); // Interval in minutes, default 1 minute
  const [autoSaveDirHandle, setAutoSaveDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [autoSaveBaseName, setAutoSaveBaseName] = useState<string>('');
  const autoSaveIntervalRef = useRef<number | null>(null);
  // Track if there have been changes since the last auto save
  const hasChangesSinceLastAutoSaveRef = useRef<boolean>(false);
  // Track previous autoSaveEnabled state to detect when it transitions from disabled to enabled
  const prevAutoSaveEnabledRef = useRef<boolean>(false);
  // Track current project file path/name
  const [currentProjectFilePath, setCurrentProjectFilePath] = useState<string>('');
  // Project directory and name for new projects
  const [projectDirHandle, setProjectDirHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [projectName, setProjectName] = useState<string>('pcb_project');
  // Track auto-saved file history for navigation
  const [autoSaveFileHistory, setAutoSaveFileHistory] = useState<string[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(-1);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const topThumbRef = useRef<HTMLCanvasElement>(null);
  const bottomThumbRef = useRef<HTMLCanvasElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  // Layer visibility toggles
  const [showTopImage, setShowTopImage] = useState(true);
  const [showBottomImage, setShowBottomImage] = useState(true);
  const [showViasLayer, setShowViasLayer] = useState(true);
  const [showTopTracesLayer, setShowTopTracesLayer] = useState(true);
  const [showBottomTracesLayer, setShowBottomTracesLayer] = useState(true);
  const [showTopPadsLayer, setShowTopPadsLayer] = useState(true);
  const [showBottomPadsLayer, setShowBottomPadsLayer] = useState(true);
  const [showTopComponents, setShowTopComponents] = useState(true);
  const [showBottomComponents, setShowBottomComponents] = useState(true);
  // Power layer
  const [showPowerLayer, setShowPowerLayer] = useState(true);
  const [powers, setPowers] = useState<PowerSymbol[]>([]);
  // Power bus definitions
  const [powerBuses, setPowerBuses] = useState<PowerBus[]>([
    { id: 'default-3v3', name: '+3.3V', voltage: '+3.3VDC', color: '#ff6600' },
    { id: 'default-5v', name: '+5V', voltage: '+5VDC', color: '#ff0000' },
  ]);
  const [showPowerBusManager, setShowPowerBusManager] = useState(false);
  const [showPowerBusSelector, setShowPowerBusSelector] = useState(false);
  const [selectedPowerBusId, setSelectedPowerBusId] = useState<string | null>(null);
  // Ground layer
  const [showGroundLayer, setShowGroundLayer] = useState(true);
  const [grounds, setGrounds] = useState<GroundSymbol[]>([]);
  
  // Helper function to determine via type based on Node ID connections
  // Rules:
  // 1. If via has no POWER or GROUND node at same Node ID → "Via (Signal)"
  // 2. If via has POWER node at same Node ID → "Via (+5VDC Power Node)" etc.
  // 3. If via has GROUND node at same Node ID → "Via (Ground)"
  const determineViaType = useCallback((nodeId: number, powerBuses: PowerBus[]): string => {
    // Check for power node at this Node ID
    const powerNode = powers.find(p => p.pointId === nodeId);
    if (powerNode) {
      const bus = powerBuses.find(b => b.id === powerNode.powerBusId);
      const powerType = bus ? bus.voltage : (powerNode.type || 'Power Node');
      return `Via (${powerType})`;
    }
    
    // Check for ground node at this Node ID
    const groundNode = grounds.find(g => g.pointId === nodeId);
    if (groundNode) {
      const groundType = groundNode.type || 'Ground';
      return `Via (${groundType})`;
    }
    
    // No power or ground connection → Via (Signal)
    return 'Via (Signal)';
  }, [powers, grounds]);

  // Helper function to determine pad type based on Node ID connections (same logic as vias)
  // Rules:
  // 1. If pad has no POWER or GROUND node at same Node ID → "Pad (Signal)"
  // 2. If pad has POWER node at same Node ID → "Pad (+5VDC Power Node)" etc.
  // 3. If pad has GROUND node at same Node ID → "Pad (Ground)"
  const determinePadType = useCallback((nodeId: number, powerBuses: PowerBus[]): string => {
    // Check for power node at this Node ID
    const powerNode = powers.find(p => p.pointId === nodeId);
    if (powerNode) {
      const bus = powerBuses.find(b => b.id === powerNode.powerBusId);
      const powerType = bus ? bus.voltage : (powerNode.type || 'Power Node');
      return `Pad (${powerType})`;
    }
    
    // Check for ground node at this Node ID
    const groundNode = grounds.find(g => g.pointId === nodeId);
    if (groundNode) {
      const groundType = groundNode.type || 'Ground';
      return `Pad (${groundType})`;
    }
    
    // No power or ground connection → Pad (Signal)
    return 'Pad (Signal)';
  }, [powers, grounds]);
  
  // Tool-specific layer defaults (persist until tool re-selected)
  const [traceToolLayer, setTraceToolLayer] = useState<'top' | 'bottom'>('top');
  // Show chooser popovers only when tool is (re)selected
  const [showTraceLayerChooser, setShowTraceLayerChooser] = useState(false);
  const traceChooserRef = useRef<HTMLDivElement>(null);
  // Pad layer chooser (like trace layer chooser)
  const [padToolLayer, setPadToolLayer] = useState<'top' | 'bottom'>('top');
  const [showPadLayerChooser, setShowPadLayerChooser] = useState(false);
  const padChooserRef = useRef<HTMLDivElement>(null);
  // Component type selection (appears after clicking to set position)
  const [showComponentTypeChooser, setShowComponentTypeChooser] = useState(false);
  const [showComponentLayerChooser, setShowComponentLayerChooser] = useState(false);
  const [selectedComponentType, setSelectedComponentType] = useState<ComponentType | null>(null);
  const componentTypeChooserRef = useRef<HTMLDivElement>(null);
  const componentLayerChooserRef = useRef<HTMLDivElement>(null);
  // Component layer chooser (like pad/trace layer chooser)
  const [componentToolLayer, setComponentToolLayer] = useState<'top' | 'bottom'>('top');
  // Store pending component position (set by click, used when type is selected)
  const [pendingComponentPosition, setPendingComponentPosition] = useState<{ x: number; y: number; layer: 'top' | 'bottom' } | null>(null);
  
  const [isSnapDisabled, setIsSnapDisabled] = useState(false); // Control key disables snap-to
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectStart, setSelectStart] = useState<{ x: number; y: number } | null>(null);
  const [selectRect, setSelectRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  // (Open Project uses native picker or hidden input; no overlay)

  const handleImageLoad = useCallback(async (file: File, type: 'top' | 'bottom') => {
    try {
      const bitmap = await createImageBitmap(file);
      const url = URL.createObjectURL(file);
      // Also keep a persistable data URL for Save/Load
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      const imageData: PCBImage = {
        url,
        name: file.name,
        width: bitmap.width,
        height: bitmap.height,
        dataUrl,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        flipX: false,
        flipY: false,
        skewX: 0,
        skewY: 0,
        keystoneV: 0,
        keystoneH: 0,
        bitmap,
      };
      if (type === 'top') {
        setTopImage(imageData);
      } else {
        setBottomImage(imageData);
      }
    } catch (err) {
      console.error('Failed to load image', err);
    }
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Stop propagation to prevent document-level handlers from interfering
    e.stopPropagation();
    e.preventDefault(); // Also prevent default to ensure our handler runs first
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dprX = canvas.width / rect.width;
    const dprY = canvas.height / rect.height;
    // Use offset within the element for robustness
    const offX = (e.nativeEvent as any).offsetX as number | undefined;
    const offY = (e.nativeEvent as any).offsetY as number | undefined;
    const cssX = typeof offX === 'number' ? offX : (e.clientX - rect.left);
    const cssY = typeof offY === 'number' ? offY : (e.clientY - rect.top);
    const canvasX = cssX * dprX;
    const canvasY = cssY * dprY;
    // Convert to content world coords (subtract fixed border first)
    const contentCanvasX = canvasX - CONTENT_BORDER;
    const contentCanvasY = canvasY - CONTENT_BORDER;
    const x = (contentCanvasX - viewPan.x) / viewScale;
    const y = (contentCanvasY - viewPan.y) / viewScale;

    if (currentTool === 'select') {
      // If in pin connection mode, connect the pin to the nearest via/pad
      if (connectingPin) {
        let bestDist = Infinity;
        
        // Search all vias and pads for the nearest one using the same hit detection as selection
        // Use the globally unique point ID directly (no "node-" prefix needed)
        let bestPointId: number | null = null;
        let bestStroke: DrawingStroke | null = null;
        const hitTolerance = Math.max(6 / viewScale, 4); // Same as selection logic
        
        // Get the component's layer to enforce layer constraint
        const component = [...componentsTop, ...componentsBottom].find(c => c.id === connectingPin.componentId);
        const componentLayer = component?.layer || 'top';
        
        for (const s of drawingStrokes) {
          if ((s.type === 'via' || s.type === 'pad') && s.points.length > 0) {
            // Vias can be connected from any layer (they connect both layers)
            // Pads can only be connected if they're on the same layer as the component
            if (s.type === 'pad') {
              const padLayer = s.layer || 'top';
              if (padLayer !== componentLayer) {
                continue; // Skip pads on different layers
              }
            }
            
            const c = s.points[0];
            const radius = Math.max(1, s.size / 2);
            const d = Math.hypot(c.x - x, c.y - y);
            // Use the same hit detection logic as selection: max(radius, hit tolerance)
            const hitDistance = Math.max(radius, hitTolerance);
            if (d <= hitDistance && d < bestDist) {
              bestDist = d;
              // Use the globally unique point ID directly
              bestPointId = c.id ?? null;
              bestStroke = s;
            }
          }
        }
        
        // Debug: log which via/pad we found
        if (bestStroke) {
          console.log(`\n[PIN CONNECTION] Found via!`);
          console.log(`  Stroke ID: ${bestStroke.id}`);
          console.log(`  Point ID: ${bestPointId}`);
          console.log(`  Point coordinates: x=${bestStroke.points[0].x.toFixed(2)}, y=${bestStroke.points[0].y.toFixed(2)}`);
          console.log(`  Click coordinates: x=${x.toFixed(2)}, y=${y.toFixed(2)}`);
          console.log(`  Distance: ${bestDist.toFixed(2)}`);
          console.log(`  Via size: ${bestStroke.size}, radius: ${Math.max(1, bestStroke.size / 2)}`);
        } else {
          console.log(`\n[PIN CONNECTION] No via found!`);
          console.log(`  Click coordinates: x=${x.toFixed(2)}, y=${y.toFixed(2)}`);
          console.log(`  Hit tolerance: ${hitTolerance.toFixed(2)}`);
          console.log(`  Total vias in drawingStrokes: ${drawingStrokes.filter(s => s.type === 'via').length}`);
        }
        
        // TODO: Also search pads when pad system is implemented
        
        if (bestPointId !== null && bestPointId !== undefined) {
          console.log(`\n[PIN CONNECTION] Proceeding with connection...`);
          console.log(`  bestPointId is valid: ${bestPointId} (type: ${typeof bestPointId})`);
          
          // Update the component's pin connection using the point ID directly
          const pointIdString = String(bestPointId);
          const pinIndex = connectingPin.pinIndex;
          const componentId = connectingPin.componentId;
          
          console.log(`\n=== PIN CONNECTION START ===`);
          console.log(`Connecting pin ${pinIndex} (Pin ${pinIndex + 1}) of component ${componentId} to point ID ${pointIdString}`);
          
          // Find which layer the component is on FIRST, then update only that layer
          const compTop = componentsTop.find(c => c.id === componentId);
          const compBottom = componentsBottom.find(c => c.id === componentId);
          
          if (compTop) {
            console.log(`Component found in TOP layer`);
            setComponentsTop(prev => {
              const comp = prev.find(c => c.id === componentId);
              if (!comp) {
                console.error(`Component ${componentId} not found in TOP layer during update!`);
                return prev;
              }
              
              console.log(`BEFORE update: pinConnections =`, comp.pinConnections);
              
              // Always create a fresh copy of the pinConnections array to avoid reference issues
              const existingConnections = comp.pinConnections || [];
              const currentConnections = existingConnections.length > 0 
                ? [...existingConnections] 
                : new Array(comp.pinCount).fill('');
              
              // Ensure array is correct size
              let newPinConnections: string[];
              if (currentConnections.length !== comp.pinCount) {
                newPinConnections = new Array(comp.pinCount).fill('');
                for (let i = 0; i < Math.min(currentConnections.length, comp.pinCount); i++) {
                  newPinConnections[i] = currentConnections[i] || '';
                }
              } else {
                // Create a fresh copy to avoid mutating the original
                newPinConnections = [...currentConnections];
              }
              
              // Update the specific pin connection
              newPinConnections[pinIndex] = pointIdString;
              
              console.log(`Updating pin ${pinIndex} with value: ${pointIdString}`);
              console.log(`New pinConnections array:`, newPinConnections);
              
              const updated = prev.map(c => {
                if (c.id === componentId) {
                  const updatedComp = { ...c, pinConnections: newPinConnections };
                  return updatedComp;
                }
                return c;
              });
              
              const finalComp = updated.find(c => c.id === componentId);
              console.log(`AFTER update: pinConnections =`, finalComp?.pinConnections);
              console.log(`Pin ${pinIndex} value: ${finalComp?.pinConnections[pinIndex]}`);
              console.log(`=== PIN CONNECTION COMPLETE (TOP) ===\n`);
              return updated;
            });
          } else if (compBottom) {
            console.log(`Component found in BOTTOM layer`);
            setComponentsBottom(prev => {
              const comp = prev.find(c => c.id === componentId);
              if (!comp) {
                console.error(`Component ${componentId} not found in BOTTOM layer during update!`);
                return prev;
              }
              
              console.log(`BEFORE update: pinConnections =`, comp.pinConnections);
              
              // Always create a fresh copy of the pinConnections array to avoid reference issues
              const existingConnections = comp.pinConnections || [];
              const currentConnections = existingConnections.length > 0 
                ? [...existingConnections] 
                : new Array(comp.pinCount).fill('');
              
              // Ensure array is correct size
              let newPinConnections: string[];
              if (currentConnections.length !== comp.pinCount) {
                newPinConnections = new Array(comp.pinCount).fill('');
                for (let i = 0; i < Math.min(currentConnections.length, comp.pinCount); i++) {
                  newPinConnections[i] = currentConnections[i] || '';
                }
              } else {
                // Create a fresh copy to avoid mutating the original
                newPinConnections = [...currentConnections];
              }
              
              // Update the specific pin connection
              newPinConnections[pinIndex] = pointIdString;
              
              console.log(`Updating pin ${pinIndex} with value: ${pointIdString}`);
              console.log(`New pinConnections array:`, newPinConnections);
              
              const updated = prev.map(c => {
                if (c.id === componentId) {
                  const updatedComp = { ...c, pinConnections: newPinConnections };
                  return updatedComp;
                }
                return c;
              });
              
              const finalComp = updated.find(c => c.id === componentId);
              console.log(`AFTER update: pinConnections =`, finalComp?.pinConnections);
              console.log(`Pin ${pinIndex} value: ${finalComp?.pinConnections[pinIndex]}`);
              console.log(`=== PIN CONNECTION COMPLETE (BOTTOM) ===\n`);
              return updated;
            });
          } else {
            console.error(`Component ${componentId} not found in either TOP or BOTTOM layer!`);
            console.log(`Available TOP components:`, componentsTop.map(c => c.id));
            console.log(`Available BOTTOM components:`, componentsBottom.map(c => c.id));
          }
          
          // Clear pin connection mode AFTER a short delay to allow state update to complete
          setTimeout(() => {
            setConnectingPin(null);
          }, 0);
          return;
        } else {
          // No via/pad found nearby, cancel connection mode
          setConnectingPin(null);
        }
      }
      
      // If clicking a component, select it (single click = select, double click = edit)
      const hitSize = 10; // half box for hit test
      const hitComponent = (() => {
        for (const c of componentsTop) {
          if (x >= c.x - hitSize && x <= c.x + hitSize && y >= c.y - hitSize && y <= c.y + hitSize) {
            return { layer: 'top' as const, comp: c };
          }
        }
        for (const c of componentsBottom) {
          if (x >= c.x - hitSize && x <= c.x + hitSize && y >= c.y - hitSize && y <= c.y + hitSize) {
            return { layer: 'bottom' as const, comp: c };
          }
        }
        return null;
      })();
      if (hitComponent) {
        const { comp } = hitComponent;
        if (e.shiftKey) {
          // Shift-click: add to selection (toggle)
          setSelectedComponentIds(prev => {
            const next = new Set(prev);
            if (next.has(comp.id)) {
              next.delete(comp.id);
            } else {
              next.add(comp.id);
            }
            return next;
          });
          // Keep other selections when Shift-clicking
        } else {
          // Regular click: select only this component (replace all selections)
          setSelectedComponentIds(new Set([comp.id]));
          // Clear other selections
          setSelectedIds(new Set());
          setSelectedPowerIds(new Set());
          setSelectedGroundIds(new Set());
        }
        return;
      }
      
      // Check for power node hit
      const hitTolerance = Math.max(6 / viewScale, 4);
      let hitPower: PowerSymbol | null = null;
      for (const p of powers) {
        const radius = Math.max(6, p.size / 2);
        const lineExtension = radius * 0.8;
        const hitRadius = radius + lineExtension; // Include extended lines in hit detection
        const d = Math.hypot(p.x - x, p.y - y);
        // Check if click is within circle or on extended lines (vertical or horizontal)
        const onVerticalLine = Math.abs(x - p.x) <= hitTolerance && Math.abs(y - p.y) <= hitRadius;
        const onHorizontalLine = Math.abs(y - p.y) <= hitTolerance && Math.abs(x - p.x) <= hitRadius;
        const inCircle = d <= Math.max(radius, hitTolerance);
        if (inCircle || onVerticalLine || onHorizontalLine) {
          hitPower = p;
          break;
        }
      }
      if (hitPower) {
        if (e.shiftKey) {
          // Shift-click: toggle selection
          setSelectedPowerIds(prev => {
            const next = new Set(prev);
            if (next.has(hitPower!.id)) {
              next.delete(hitPower!.id);
            } else {
              next.add(hitPower!.id);
            }
            return next;
          });
        } else {
          // Regular click: select only this power node
          setSelectedPowerIds(new Set([hitPower.id]));
        }
        // Clear other selections
        setSelectedIds(new Set());
        setSelectedComponentIds(new Set());
        setSelectedGroundIds(new Set());
        return;
      }
      
      // Check for ground node hit
      let hitGround: GroundSymbol | null = null;
      for (const g of grounds) {
        const radius = Math.max(6, (g.size || 18) / 2);
        const lineExtension = radius * 0.8;
        const hitRadius = radius + lineExtension; // Include extended lines in hit detection
        const d = Math.hypot(g.x - x, g.y - y);
        // Check if click is within circle or on extended lines (vertical or horizontal)
        const onVerticalLine = Math.abs(x - g.x) <= hitTolerance && Math.abs(y - g.y) <= hitRadius;
        const onHorizontalLine = Math.abs(y - g.y) <= hitTolerance && Math.abs(x - g.x) <= hitRadius;
        const inCircle = d <= Math.max(radius, hitTolerance);
        if (inCircle || onVerticalLine || onHorizontalLine) {
          hitGround = g;
          break;
        }
      }
      if (hitGround) {
        if (e.shiftKey) {
          // Shift-click: add to selection (toggle)
          setSelectedGroundIds(prev => {
            const next = new Set(prev);
            if (next.has(hitGround!.id)) {
              next.delete(hitGround!.id);
            } else {
              next.add(hitGround!.id);
            }
            return next;
          });
          // Keep other selections when Shift-clicking
        } else {
          // Regular click: select only this ground node (replace all selections)
          setSelectedGroundIds(new Set([hitGround.id]));
          // Clear other selections
          setSelectedIds(new Set());
          setSelectedComponentIds(new Set());
          setSelectedPowerIds(new Set());
        }
        // Don't start rectangle selection - we've already selected the ground node
        return;
      }
      
      // Check if clicking on empty space - clear selection immediately
      // But first check if we hit a via or pad (for rectangle selection)
      const hitToleranceSelect = Math.max(6 / viewScale, 4);
      let hitStroke: DrawingStroke | null = null;
      for (const s of drawingStrokes) {
        if ((s.type === 'via' || s.type === 'pad') && s.points.length > 0) {
          // Only consider visible vias/pads
          if (!showViasLayer) continue;
          
          const c = s.points[0];
          const r = Math.max(1, s.size / 2);
          const d = Math.hypot(c.x - x, c.y - y);
          if (d <= Math.max(r, hitToleranceSelect)) {
            hitStroke = s;
            break; // Found a hit, selection will be finalized on mouse up
          }
        }
      }
      
      // If we didn't hit anything (no via, no component, no power, no ground), clear selection and start rectangle selection
      if (!hitStroke) {
        // Clear selection immediately when clicking on empty space (unless Shift is held for multi-select)
        if (!e.shiftKey) {
          setSelectedIds(new Set());
          setSelectedComponentIds(new Set());
          setSelectedPowerIds(new Set());
          setSelectedGroundIds(new Set());
        }
      }
      
      // Store whether Shift was pressed at mouseDown for use in mouseUp
      // We'll pass this through the selectStart state
      setIsSelecting(true);
      setSelectStart({ x, y, shiftKey: e.shiftKey } as any);
      setSelectRect({ x, y, width: 0, height: 0 });
      return;
    } else if (currentTool === 'magnify') {
      const factor = e.shiftKey ? 0.5 : 2;
      const newScale = Math.max(0.25, Math.min(8, viewScale * factor));
      // Keep clicked world point under cursor after zoom: pan' = canvasPt - newScale * world
      const newPanX = contentCanvasX - newScale * x;
      const newPanY = contentCanvasY - newScale * y;
      setViewScale(newScale);
      setViewPan({ x: newPanX, y: newPanY });
      return;
    } else if (currentTool === 'pan') {
      // Start panning in content-canvas coordinates
      panStartRef.current = { startCX: contentCanvasX, startCY: contentCanvasY, panX: viewPan.x, panY: viewPan.y };
      // Also track client coordinates for out-of-canvas drags
      panClientStartRef.current = { startClientX: e.clientX, startClientY: e.clientY, panX: viewPan.x, panY: viewPan.y };
      setIsPanning(true);
      return;
    } else if (currentTool === 'draw') {
      // Helper: snap to nearest VIA, PAD, POWER, or GROUND node when drawing traces
      // All node types can be snapped to from any layer (blind vias not supported yet)
      // Returns both coordinates and the Node ID of the snapped object (if any)
      const snapToNearestViaCenter = (wx: number, wy: number): { x: number; y: number; nodeId?: number } => {
        let bestDist = Infinity;
        let bestCenter: { x: number; y: number; id?: number } | null = null;
        // Search all vias and pads - all can be snapped to from any layer (blind vias not supported yet)
        const SNAP_THRESHOLD_WORLD = 15; // Fixed world-space distance (not affected by zoom)
        for (const s of drawingStrokes) {
          if (s.type === 'via') {
            // Vias can be snapped to from any layer (they go through both layers)
            const c = s.points[0];
            const d = Math.hypot(c.x - wx, c.y - wy);
            if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) { 
              bestDist = d; 
              bestCenter = c; 
            }
          } else if (s.type === 'pad') {
            // Pads can be snapped to from any layer (blind vias not supported yet)
            const c = s.points[0];
            const d = Math.hypot(c.x - wx, c.y - wy);
            if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) {
              bestDist = d;
              bestCenter = c;
            }
          }
        }
        // Also check power and ground nodes (they can be snapped to from any layer)
        for (const p of powers) {
          if (p.pointId !== undefined) {
            const d = Math.hypot(p.x - wx, p.y - wy);
            if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) {
              bestDist = d;
              bestCenter = { x: p.x, y: p.y, id: p.pointId };
            }
          }
        }
        for (const g of grounds) {
          if (g.pointId !== undefined) {
            const d = Math.hypot(g.x - wx, g.y - wy);
            if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) {
              bestDist = d;
              bestCenter = { x: g.x, y: g.y, id: g.pointId };
            }
          }
        }
        // Truncate coordinates to 3 decimal places for exact matching
        const result = bestCenter ?? { x: wx, y: wy };
        const truncated = truncatePoint(result);
        return { 
          x: truncated.x, 
          y: truncated.y, 
          nodeId: bestCenter?.id 
        };
      };

      if (drawingMode === 'via') {
        // Add a filled circle representing a via at click location
        // Read directly from localStorage to ensure we have the latest values
        // This is critical for immediate drawing after tool selection
        const viaDef = toolRegistry.get('via');
        const savedColor = localStorage.getItem('tool_via_color');
        const savedSize = localStorage.getItem('tool_via_size');
        const viaColor = savedColor || viaDef?.settings.color || DEFAULT_VIA_COLOR;
        const viaSize = savedSize ? parseInt(savedSize, 10) : (viaDef?.settings.size || VIA.DEFAULT_SIZE);
        // Truncate coordinates to 3 decimal places for exact matching
        const truncatedPos = truncatePoint({ x, y });
        const center = { id: generatePointId(), x: truncatedPos.x, y: truncatedPos.y };
        const viaStroke: DrawingStroke = {
          id: `${Date.now()}-via`,
          points: [center],
          color: viaColor,
          size: viaSize,
          layer: selectedDrawingLayer,
          type: 'via',
          viaType: 'Via (Signal)', // Default: Via (Signal) (no power/ground connection)
        };
        setDrawingStrokes(prev => [...prev, viaStroke]);
        if (selectedDrawingLayer === 'top') {
          setViaOrderTop(prev => [...prev, viaStroke.id]);
        } else {
          setViaOrderBottom(prev => [...prev, viaStroke.id]);
        }
        return;
      }

      if (drawingMode === 'pad') {
        // Only place pad if a layer has been selected (like trace tool)
        if (!padToolLayer) {
          return; // Wait for user to select a layer
        }
        
        // Add a square representing a pad at click location
        // Use layer-specific colors and sizes
        const padColor = padToolLayer === 'top' ? topPadColor : bottomPadColor;
        const padSize = padToolLayer === 'top' ? topPadSize : bottomPadSize;
        // Truncate coordinates to 3 decimal places for exact matching
        const truncatedPos = truncatePoint({ x, y });
        const center = { id: generatePointId(), x: truncatedPos.x, y: truncatedPos.y };
        const padStroke: DrawingStroke = {
          id: `${Date.now()}-pad`,
          points: [center],
          color: padColor,
          size: padSize,
          layer: padToolLayer, // Use padToolLayer instead of selectedDrawingLayer
          type: 'pad',
          padType: 'Pad (Signal)', // Default: Pad (Signal) (no power/ground connection)
        };
        setDrawingStrokes(prev => [...prev, padStroke]);
        return;
      }

      // Traces mode: connected segments by clicks, snapping to via centers unless Option/Alt key is held
      // All vias, pads, power nodes, and ground nodes can be snapped to from any layer (blind vias not supported yet)
      
      // Check if this is the second click of a double-click (ignore it)
      if (isDoubleClickingTraceRef.current) {
        // Double-click event already fired, ignore this second click
        return;
      }
      
      const snapped = (drawingMode === 'trace' && !isSnapDisabled) ? snapToNearestViaCenter(x, y) : { x: truncatePoint({ x, y }).x, y: truncatePoint({ x, y }).y };
      // IMPORTANT: Only assign Node ID if we snapped to a via or pad (or power/ground node).
      // Other trace points are just x,y coordinates without Node IDs.
      // From a reverse engineering perspective, only nodes (vias/pads/power/ground) have value
      // in creating a schematic, as they define the network of parts, connections, voltages, etc.
      const pt: DrawingPoint = snapped.nodeId !== undefined 
        ? { id: snapped.nodeId, x: snapped.x, y: snapped.y }
        : { x: snapped.x, y: snapped.y };
      setCurrentStroke(prev => (prev.length === 0 ? [pt] : [...prev, pt]));
      lastTraceClickTimeRef.current = Date.now();
      // Clear preview mouse position when adding a point
      setTracePreviewMousePos(null);
      // Do not start drag drawing when in traces mode; use click-to-add points
      setIsDrawing(false);
      setIsShiftConstrained(false);
    } else if (currentTool === 'erase') {
      // Check if there are locked items on the current layer that would prevent erasing
      const hasLockedItemsOnLayer = drawingStrokes.some(s => 
        s.layer === selectedDrawingLayer && (
          (s.type === 'via' && areViasLocked) ||
          (s.type === 'pad' && arePadsLocked) ||
          (s.type === 'trace' && areTracesLocked)
        )
      );
      if (hasLockedItemsOnLayer) {
        const lockedTypes: string[] = [];
        if (areViasLocked && drawingStrokes.some(s => s.layer === selectedDrawingLayer && s.type === 'via')) lockedTypes.push('vias');
        if (arePadsLocked && drawingStrokes.some(s => s.layer === selectedDrawingLayer && s.type === 'pad')) lockedTypes.push('pads');
        if (areTracesLocked && drawingStrokes.some(s => s.layer === selectedDrawingLayer && s.type === 'trace')) lockedTypes.push('traces');
        if (lockedTypes.length > 0) {
          alert(`Cannot erase: ${lockedTypes.join(', ')} are locked on the ${selectedDrawingLayer} layer. Unlock them to erase.`);
        }
      }
      setIsDrawing(true);
      setCurrentStroke([{ id: generatePointId(), x, y }]);
      console.log('Starting erase at:', x, y, 'selectedDrawingLayer:', selectedDrawingLayer, 'total strokes:', drawingStrokes.length);
    } else if (currentTool === 'transform' && selectedImageForTransform) {
      // Don't start transforming if images are locked
      if (areImagesLocked) {
        alert('Cannot transform: Images are locked. Unlock images to transform them.');
        return;
      }
      setIsTransforming(true);
      setTransformStartPos({ x, y });
    } else if (currentTool === 'component') {
      // Only place component if a type has been selected (like power tool)
      if (!selectedComponentType) {
        return; // Wait for user to select a component type
      }
      
      // Truncate coordinates to 3 decimal places for exact matching
      const truncatedPos = truncatePoint({ x, y });
      // Use layer-specific colors and sizes for components
      const componentColor = componentToolLayer === 'top' ? topComponentColor : bottomComponentColor;
      const componentSize = componentToolLayer === 'top' ? topComponentSize : bottomComponentSize;
      const comp = createComponent(
        selectedComponentType,
        componentToolLayer, // Use componentToolLayer instead of selectedDrawingLayer
        truncatedPos.x,
        truncatedPos.y,
        componentColor,
        componentSize
      );
      
      // Initialize abbreviation to default based on component type prefix
      (comp as any).abbreviation = getDefaultAbbreviation(selectedComponentType);
      
      // Add component to appropriate layer
      if (componentToolLayer === 'top') {
        setShowTopComponents(true);
        setComponentsTop(prev => [...prev, comp]);
      } else {
        setShowBottomComponents(true);
        setComponentsBottom(prev => [...prev, comp]);
      }
      
      // Don't open properties dialog automatically - user will double-click to edit
      // Don't switch back to select tool - stay in component tool for multiple placements
      return;
    } else if (currentTool === 'power') {
      // Only place power node if a bus has been selected
      if (!selectedPowerBusId) {
        return; // Wait for user to select a power bus
      }
      
      // Snap to nearest via, pad, or trace point unless Option/Alt key is held
      // Returns both coordinates and the Node ID of the snapped object (if any)
      const snapToNearestPoint = (wx: number, wy: number): { x: number; y: number; nodeId?: number } => {
        let bestDist = Infinity;
        let bestPoint: { x: number; y: number; id?: number } | null = null;
        const SNAP_THRESHOLD_WORLD = 15; // Fixed world-space distance (not affected by zoom)
        for (const s of drawingStrokes) {
          if (s.type === 'via' || s.type === 'pad') {
            // Vias and pads can be snapped to from any layer
            const c = s.points[0];
            const d = Math.hypot(c.x - wx, c.y - wy);
            if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) {
              bestDist = d;
              bestPoint = c;
            }
          } else if (s.type === 'trace') {
            // Check all trace points
            for (const point of s.points) {
              const d = Math.hypot(point.x - wx, point.y - wy);
              if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) {
                bestDist = d;
                bestPoint = point;
              }
            }
          }
        }
        // Truncate coordinates to 3 decimal places for exact matching
        const result = bestPoint ?? { x: wx, y: wy };
        const truncated = truncatePoint(result);
        return {
          x: truncated.x,
          y: truncated.y,
          nodeId: bestPoint?.id
        };
      };
      const snapped = !isSnapDisabled ? snapToNearestPoint(x, y) : { x: truncatePoint({ x, y }).x, y: truncatePoint({ x, y }).y };
      
      // Find the selected power bus
      const bus = powerBuses.find(b => b.id === selectedPowerBusId);
      if (bus) {
        const nodeId = snapped.nodeId ?? generatePointId();
        const powerType = `${bus.voltage} Power Node`;
        
        // Check for conflict: if there's already a ground node at this Node ID, show error
        const existingGround = grounds.find(g => g.pointId === nodeId);
        if (existingGround) {
          setErrorDialog({
            visible: true,
            title: 'Node ID Conflict',
            message: `Cannot place power node: A ground node already exists at this Node ID (${nodeId}). Power and ground nodes cannot share the same Node ID.`,
          });
          return;
        }
        
        // Place power node immediately
        const p: PowerSymbol = {
          id: `power-${Date.now()}-${Math.random()}`,
          x: snapped.x,
          y: snapped.y,
          color: '#ff0000', // Power symbols are always red
          size: brushSize,
          powerBusId: bus.id,
          layer: selectedDrawingLayer,
          type: powerType, // Auto-populate type with voltage
          pointId: nodeId, // Use existing Node ID if snapped, otherwise generate new one
        };
        setPowers(prev => [...prev, p]);
        
        // Update via and pad types if we snapped to an existing via or pad
        if (snapped.nodeId !== undefined) {
          const newViaType = determineViaType(snapped.nodeId, powerBuses);
          const newPadType = determinePadType(snapped.nodeId, powerBuses);
          setDrawingStrokes(prev => prev.map(s => {
            if (s.type === 'via' && s.points.length > 0 && s.points[0].id === snapped.nodeId) {
              return { ...s, viaType: newViaType };
            } else if (s.type === 'pad' && s.points.length > 0 && s.points[0].id === snapped.nodeId) {
              return { ...s, padType: newPadType };
            }
            return s;
          }));
        }
      }
      return;
    } else if (currentTool === 'ground') {
      // Ground tool: place ground symbol at click location
      // Snap to nearest via, pad, or trace point unless Option/Alt key is held
      // Returns both coordinates and the Node ID of the snapped object (if any)
      const snapToNearestPoint = (wx: number, wy: number): { x: number; y: number; nodeId?: number } => {
        let bestDist = Infinity;
        let bestPoint: { x: number; y: number; id?: number } | null = null;
        const SNAP_THRESHOLD_WORLD = 15; // Fixed world-space distance (not affected by zoom)
        for (const s of drawingStrokes) {
          if (s.type === 'via' || s.type === 'pad') {
            // Vias and pads can be snapped to from any layer
            const c = s.points[0];
            const d = Math.hypot(c.x - wx, c.y - wy);
            if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) {
              bestDist = d;
              bestPoint = c;
            }
          } else if (s.type === 'trace') {
            // Check all trace points
            for (const point of s.points) {
              const d = Math.hypot(point.x - wx, point.y - wy);
              if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) {
                bestDist = d;
                bestPoint = point;
              }
            }
          }
        }
        // Truncate coordinates to 3 decimal places for exact matching
        const result = bestPoint ?? { x: wx, y: wy };
        const truncated = truncatePoint(result);
        return {
          x: truncated.x,
          y: truncated.y,
          nodeId: bestPoint?.id
        };
      };
      const snapped = !isSnapDisabled ? snapToNearestPoint(x, y) : { x: truncatePoint({ x, y }).x, y: truncatePoint({ x, y }).y };
      const nodeId = snapped.nodeId ?? generatePointId();
      const groundType = 'Ground';
      
      // Check for conflict: if there's already a power node at this Node ID, show error
      const existingPower = powers.find(p => p.pointId === nodeId);
      if (existingPower) {
        setErrorDialog({
          visible: true,
          title: 'Node ID Conflict',
          message: `Cannot place ground node: A power node (${existingPower.type || 'Power Node'}) already exists at this Node ID (${nodeId}). Power and ground nodes cannot share the same Node ID.`,
        });
        return;
      }
      
      // If we snapped to an existing object, use its Node ID; otherwise generate a new one
      const g: GroundSymbol = {
        id: `gnd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        x: snapped.x,
        y: snapped.y,
        color: '#000000', // Ground symbols are always black
        size: toolRegistry.get('ground')?.settings.size || 18,
        type: groundType, // Auto-populate type
        pointId: nodeId, // Use existing Node ID if snapped, otherwise generate new one
      };
      setGrounds(prev => [...prev, g]);
      
      // Update via and pad types if we snapped to an existing via or pad
      if (snapped.nodeId !== undefined) {
        const newViaType = determineViaType(snapped.nodeId, powerBuses);
        const newPadType = determinePadType(snapped.nodeId, powerBuses);
        setDrawingStrokes(prev => prev.map(s => {
          if (s.type === 'via' && s.points.length > 0 && s.points[0].id === snapped.nodeId) {
            return { ...s, viaType: newViaType };
          } else if (s.type === 'pad' && s.points.length > 0 && s.points[0].id === snapped.nodeId) {
            return { ...s, padType: newPadType };
          }
          return s;
        }));
      }
      return;
    }
  }, [currentTool, selectedImageForTransform, brushSize, brushColor, drawingMode, selectedDrawingLayer, drawingStrokes, viewScale, viewPan.x, viewPan.y, isSnapDisabled, selectedPowerBusId, powerBuses, selectedComponentType, toolRegistry, padToolLayer, traceToolLayer, powers, grounds, determineViaType, determinePadType, showViasLayer]);

  const handleCanvasWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    if (currentTool !== 'magnify') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dprX = canvas.width / rect.width;
    const dprY = canvas.height / rect.height;
    const offX = (e.nativeEvent as any).offsetX as number | undefined;
    const offY = (e.nativeEvent as any).offsetY as number | undefined;
    const cssX = typeof offX === 'number' ? offX : (e.clientX - rect.left);
    const cssY = typeof offY === 'number' ? offY : (e.clientY - rect.top);
    const canvasX = cssX * dprX;
    const canvasY = cssY * dprY;
    const worldX = ((canvasX - CONTENT_BORDER) - viewPan.x) / viewScale;
    const worldY = ((canvasY - CONTENT_BORDER) - viewPan.y) / viewScale;

    const stepIn = 1.2; // zoom in factor per wheel step
    const stepOut = 1 / stepIn;
    const factor = e.deltaY < 0 ? stepIn : stepOut;
    const newScale = Math.max(0.25, Math.min(8, viewScale * factor));
    const newPanX = (canvasX - CONTENT_BORDER) - newScale * worldX;
    const newPanY = (canvasY - CONTENT_BORDER) - newScale * worldY;
    setViewScale(newScale);
    setViewPan({ x: newPanX, y: newPanY });
  }, [currentTool, viewScale, viewPan.x, viewPan.y]);

  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle trace finalization
    // On double-click, the first click already added the final point
    // The second click should be ignored - just finalize with current points
    if (currentTool === 'draw' && drawingMode === 'trace') {
      isDoubleClickingTraceRef.current = true;
      let pts = currentStroke;
      
      // Remove duplicate consecutive points (same coordinates)
      if (pts.length > 1) {
        const deduplicated: DrawingPoint[] = [pts[0]];
        for (let i = 1; i < pts.length; i++) {
          const prev = deduplicated[deduplicated.length - 1];
          const curr = pts[i];
          // Only add if coordinates are different (allowing for floating point precision)
          if (Math.abs(prev.x - curr.x) > 0.001 || Math.abs(prev.y - curr.y) > 0.001) {
            deduplicated.push(curr);
          }
        }
        pts = deduplicated;
      }
      
      if (pts.length >= 1) {
        // Use layer-specific colors and sizes for traces
        const layer = traceToolLayer || 'top';
        const traceColor = layer === 'top' ? topTraceColor : bottomTraceColor;
        const traceSize = layer === 'top' ? topTraceSize : bottomTraceSize;
        const newStroke: DrawingStroke = {
          id: `${Date.now()}-trace`,
          points: pts,
          color: traceColor,
          size: traceSize,
          layer: layer,
          type: 'trace',
        };
        setDrawingStrokes(prev => [...prev, newStroke]);
        if (layer === 'top') {
          setTraceOrderTop(prev => [...prev, newStroke.id]);
        } else {
          setTraceOrderBottom(prev => [...prev, newStroke.id]);
        }
        setCurrentStroke([]);
        setTracePreviewMousePos(null);
        // Reset double-click flag after a short delay
        setTimeout(() => {
          isDoubleClickingTraceRef.current = false;
        }, 300);
        return;
      }
    }
    
    // Handle component double-click to open properties editor
    // Works in both select tool and component tool
    if (currentTool === 'select' || currentTool === 'component') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dprX = canvas.width / rect.width;
      const dprY = canvas.height / rect.height;
      const offX = (e.nativeEvent as any).offsetX as number | undefined;
      const offY = (e.nativeEvent as any).offsetY as number | undefined;
      const cssX = typeof offX === 'number' ? offX : (e.clientX - rect.left);
      const cssY = typeof offY === 'number' ? offY : (e.clientY - rect.top);
      const canvasX = cssX * dprX;
      const canvasY = cssY * dprY;
      const contentCanvasX = canvasX - CONTENT_BORDER;
      const contentCanvasY = canvasY - CONTENT_BORDER;
      const x = (contentCanvasX - viewPan.x) / viewScale;
      const y = (contentCanvasY - viewPan.y) / viewScale;
      
      const hitSize = 10;
      const hitComponent = (() => {
        for (const c of componentsTop) {
          if (x >= c.x - hitSize && x <= c.x + hitSize && y >= c.y - hitSize && y <= c.y + hitSize) {
            return { layer: 'top' as const, comp: c };
          }
        }
        for (const c of componentsBottom) {
          if (x >= c.x - hitSize && x <= c.x + hitSize && y >= c.y - hitSize && y <= c.y + hitSize) {
            return { layer: 'bottom' as const, comp: c };
          }
        }
        return null;
      })();
      
      // Check for power node hit
      const hitTolerance = Math.max(6 / viewScale, 4);
      let hitPower: PowerSymbol | null = null;
      for (const p of powers) {
        const radius = Math.max(6, p.size / 2);
        const lineExtension = radius * 0.8;
        const hitRadius = radius + lineExtension; // Include extended lines in hit detection
        const d = Math.hypot(p.x - x, p.y - y);
        // Check if click is within circle or on extended lines (vertical or horizontal)
        const onVerticalLine = Math.abs(x - p.x) <= hitTolerance && Math.abs(y - p.y) <= hitRadius;
        const onHorizontalLine = Math.abs(y - p.y) <= hitTolerance && Math.abs(x - p.x) <= hitRadius;
        const inCircle = d <= Math.max(radius, hitTolerance);
        if (inCircle || onVerticalLine || onHorizontalLine) {
          hitPower = p;
          break;
        }
      }
      
      if (hitPower) {
        setSelectedPowerIds(new Set([hitPower.id]));
        setPowerEditor({
          visible: true,
          id: hitPower.id,
          layer: hitPower.layer,
          x: hitPower.x,
          y: hitPower.y,
          size: hitPower.size,
          color: hitPower.color,
          powerBusId: hitPower.powerBusId,
        });
        return;
      }
      
      if (hitComponent) {
        const { layer, comp } = hitComponent;
        setSelectedComponentIds(new Set([comp.id]));
        // Get abbreviation, defaulting to component type prefix if not set or is empty
        let abbreviation = ('abbreviation' in comp && (comp as any).abbreviation) ? String((comp as any).abbreviation) : '';
        if (!abbreviation || abbreviation.trim() === '' || abbreviation === '****' || abbreviation === '*') {
          abbreviation = getDefaultAbbreviation(comp.componentType);
        }
        
        setComponentEditor({
          visible: true,
          layer,
          id: comp.id,
          designator: comp.designator || comp.componentType || '',
          abbreviation: abbreviation,
          manufacturer: 'manufacturer' in comp ? (comp as any).manufacturer || '' : '',
          partNumber: 'partNumber' in comp ? (comp as any).partNumber || '' : '',
          pinCount: comp.pinCount,
          x: comp.x,
          y: comp.y,
        });
      }
    }
  }, [currentTool, drawingMode, brushColor, brushSize, selectedDrawingLayer, componentsTop, componentsBottom, powers, viewScale, viewPan.x, viewPan.y, selectedComponentType, showComponentTypeChooser, isSnapDisabled, drawingStrokes, selectedImageForTransform, isPanning, pendingComponentPosition, connectingPin, toolRegistry, currentStroke, traceToolLayer, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize]);

  // Helper to finalize an in-progress trace via keyboard or clicks outside canvas
  const finalizeTraceIfAny = useCallback(() => {
    const pts = currentStrokeRef.current;
    if (currentTool === 'draw' && drawingMode === 'trace' && pts.length >= 2) {
      // Remove duplicate consecutive points (same coordinates)
      let deduplicated: DrawingPoint[] = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const prev = deduplicated[deduplicated.length - 1];
        const curr = pts[i];
        // Only add if coordinates are different (allowing for floating point precision)
        if (Math.abs(prev.x - curr.x) > 0.001 || Math.abs(prev.y - curr.y) > 0.001) {
          deduplicated.push(curr);
        }
      }
      
      // Use traceToolLayer and layer-specific colors
      const layer = traceToolLayer || 'top';
      const traceColor = layer === 'top' ? topTraceColor : bottomTraceColor;
      const traceSize = layer === 'top' ? topTraceSize : bottomTraceSize;
      const newStroke: DrawingStroke = {
        id: `${Date.now()}-trace`,
        points: deduplicated,
        color: traceColor,
        size: traceSize,
        layer: layer,
        type: 'trace',
      };
      setDrawingStrokes(prev => [...prev, newStroke]);
      if (layer === 'top') {
        setTraceOrderTop(prev => [...prev, newStroke.id]);
      } else {
        setTraceOrderBottom(prev => [...prev, newStroke.id]);
      }
      setCurrentStroke([]);
      setTracePreviewMousePos(null);
    } else {
      // If only a single point was placed, treat it as a dot trace
      if (currentTool === 'draw' && drawingMode === 'trace' && pts.length === 1) {
        // Use traceToolLayer and layer-specific colors
        const layer = traceToolLayer || 'top';
        const traceColor = layer === 'top' ? topTraceColor : bottomTraceColor;
        const traceSize = layer === 'top' ? topTraceSize : bottomTraceSize;
        const newStroke: DrawingStroke = {
          id: `${Date.now()}-trace-dot`,
          points: pts,
          color: traceColor,
          size: traceSize,
          layer: layer,
          type: 'trace',
        };
        setDrawingStrokes(prev => [...prev, newStroke]);
        if (layer === 'top') {
          setTraceOrderTop(prev => [...prev, newStroke.id]);
        } else {
          setTraceOrderBottom(prev => [...prev, newStroke.id]);
        }
        setCurrentStroke([]);
      }
    }
  }, [currentTool, drawingMode, traceToolLayer, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize, setDrawingStrokes]);

  const snapConstrainedPoint = useCallback((start: DrawingPoint, x: number, y: number): { x: number; y: number } => {
    const dx = x - start.x;
    const dy = y - start.y;
    if (dx === 0 && dy === 0) return { x, y };
    // Determine nearest orientation among 0°, 45°, 90° based on initial direction
    const angle = Math.atan2(dy, dx) * 180 / Math.PI; // -180..180
    const abs180 = ((angle % 180) + 180) % 180; // 0..180
    // Nearest among 0,45,90
    const candidates = [0, 45, 90];
    let best = 0;
    let bestDiff = 1e9;
    for (const c of candidates) {
      const d = Math.abs(abs180 - c);
      if (d < bestDiff) { bestDiff = d; best = c; }
    }
    if (best === 0) {
      // Horizontal
      return { x, y: start.y };
    } else if (best === 90) {
      // Vertical
      return { x: start.x, y };
    } else {
      // 45°: choose +45 vs -45 by sign of dx,dy
      const mag = Math.min(Math.abs(dx), Math.abs(dy));
      const sx = dx >= 0 ? 1 : -1;
      const sy = dy >= 0 ? 1 : -1;
      return { x: start.x + sx * mag, y: start.y + sy * mag };
    }
  }, []);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const canvas = canvasRef.current!;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const canvasX = screenX * scaleX;
    const canvasY = screenY * scaleY;
    const contentCanvasX = canvasX - CONTENT_BORDER;
    const contentCanvasY = canvasY - CONTENT_BORDER;
    const x = (contentCanvasX - viewPan.x) / viewScale;
    const y = (contentCanvasY - viewPan.y) / viewScale;

    // Track mouse position for trace preview line
    if (currentTool === 'draw' && drawingMode === 'trace' && currentStroke.length > 0) {
      // Helper function to snap to nearest via/pad/power/ground (same as in handleCanvasMouseDown)
      const snapToNearestViaCenter = (wx: number, wy: number): { x: number; y: number; nodeId?: number } => {
        let bestDist = Infinity;
        let bestCenter: { x: number; y: number; id?: number } | null = null;
        // Search all vias and pads - all can be snapped to from any layer (blind vias not supported yet)
        const SNAP_THRESHOLD_WORLD = 15;
        for (const s of drawingStrokes) {
          if (s.type === 'via') {
            // Vias can be snapped to from any layer (they go through both layers)
            const c = s.points[0];
            const d = Math.hypot(c.x - wx, c.y - wy);
            if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) { 
              bestDist = d; 
              bestCenter = c; 
            }
          } else if (s.type === 'pad') {
            // Pads can be snapped to from any layer (blind vias not supported yet)
            const c = s.points[0];
            const d = Math.hypot(c.x - wx, c.y - wy);
            if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) {
              bestDist = d;
              bestCenter = c;
            }
          }
        }
        // Also check power and ground nodes (they can be snapped to from any layer)
        for (const p of powers) {
          if (p.pointId !== undefined) {
            const d = Math.hypot(p.x - wx, p.y - wy);
            if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) {
              bestDist = d;
              bestCenter = { x: p.x, y: p.y, id: p.pointId };
            }
          }
        }
        for (const g of grounds) {
          if (g.pointId !== undefined) {
            const d = Math.hypot(g.x - wx, g.y - wy);
            if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) {
              bestDist = d;
              bestCenter = { x: g.x, y: g.y, id: g.pointId };
            }
          }
        }
        const result = bestCenter ?? { x: wx, y: wy };
        const truncated = truncatePoint(result);
        return { 
          x: truncated.x, 
          y: truncated.y, 
          nodeId: bestCenter?.id 
        };
      };
      const snapped = !isSnapDisabled ? snapToNearestViaCenter(x, y) : { x: truncatePoint({ x, y }).x, y: truncatePoint({ x, y }).y };
      setTracePreviewMousePos({ x: snapped.x, y: snapped.y });
    } else {
      setTracePreviewMousePos(null);
    }

    if (currentTool === 'select' && isSelecting && selectStart) {
      const sx = selectStart.x;
      const sy = selectStart.y;
      setSelectRect({ x: Math.min(sx, x), y: Math.min(sy, y), width: Math.abs(x - sx), height: Math.abs(y - sy) });
    } else if (currentTool === 'pan' && isPanning && panStartRef.current) {
      const { startCX, startCY, panX, panY } = panStartRef.current;
      const dx = contentCanvasX - startCX;
      const dy = contentCanvasY - startCY;
      setViewPan({ x: panX + dx, y: panY + dy });
    } else if (isDrawing && currentStroke.length > 0) {
      if (currentTool === 'draw') {
        if (isShiftConstrained) {
          const startPt = currentStroke[0];
          const snapped = snapConstrainedPoint(startPt, x, y);
          // Truncate coordinates to 3 decimal places for exact matching
          const truncatedSnapped = truncatePoint(snapped);
          const pt = { id: generatePointId(), x: truncatedSnapped.x, y: truncatedSnapped.y };
          setCurrentStroke([startPt, pt]);
        } else {
          // Truncate coordinates to 3 decimal places for exact matching
          const truncatedPos = truncatePoint({ x, y });
          setCurrentStroke(prev => [...prev, { id: generatePointId(), x: truncatedPos.x, y: truncatedPos.y }]);
        }
      } else if (currentTool === 'erase') {
        setCurrentStroke(prev => [...prev, { id: generatePointId(), x, y }]);
        setDrawingStrokes(prev => {
          const filtered = prev.filter(stroke => {
            // Don't erase locked vias, pads, or traces
            if (stroke.type === 'via' && areViasLocked) return true;
            if (stroke.type === 'pad' && arePadsLocked) return true;
            if (stroke.type === 'trace' && areTracesLocked) return true;
            
            // Only check strokes on the selected drawing layer
            if (stroke.layer !== selectedDrawingLayer) return true;
            
            // Square eraser hit-test (axis-aligned)
            const half = brushSize / 2;
            const minX = x - half;
            const maxX = x + half;
            const minY = y - half;
            const maxY = y + half;

            const pointInSquare = (px: number, py: number) => (px >= minX && px <= maxX && py >= minY && py <= maxY);

            // Cohen–Sutherland line-rectangle intersection
            const segIntersectsSquare = (x1: number, y1: number, x2: number, y2: number) => {
              const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;
              const outCode = (px: number, py: number) => {
                let code = INSIDE;
                if (px < minX) code |= LEFT;
                else if (px > maxX) code |= RIGHT;
                if (py < minY) code |= BOTTOM;
                else if (py > maxY) code |= TOP;
                return code;
              };
              let xA = x1, yA = y1, xB = x2, yB = y2;
              let codeA = outCode(xA, yA);
              let codeB = outCode(xB, yB);
              while (true) {
                if ((codeA | codeB) === 0) return true;       // both inside
                if ((codeA & codeB) !== 0) return false;      // share outside region
                const codeOut = codeA !== 0 ? codeA : codeB;
                let xI = 0, yI = 0;
                if (codeOut & TOP) {
                  xI = xA + (xB - xA) * (maxY - yA) / (yB - yA);
                  yI = maxY;
                } else if (codeOut & BOTTOM) {
                  xI = xA + (xB - xA) * (minY - yA) / (yB - yA);
                  yI = minY;
                } else if (codeOut & RIGHT) {
                  yI = yA + (yB - yA) * (maxX - xA) / (xB - xA);
                  xI = maxX;
                } else {
                  yI = yA + (yB - yA) * (minX - xA) / (xB - xA);
                  xI = minX;
                }
                if (codeOut === codeA) {
                  xA = xI; yA = yI; codeA = outCode(xA, yA);
                } else {
                  xB = xI; yB = yI; codeB = outCode(xB, yB);
                }
              }
            };

            let hasIntersection = false;
            if (stroke.points.length === 1) {
              const p0 = stroke.points[0];
              hasIntersection = pointInSquare(p0.x, p0.y);
            } else {
              for (let i = 0; i < stroke.points.length - 1; i++) {
                const p1 = stroke.points[i];
                const p2 = stroke.points[i + 1];
                if (segIntersectsSquare(p1.x, p1.y, p2.x, p2.y)) { hasIntersection = true; break; }
              }
            }
            
            if (hasIntersection) {
              console.log('Erasing stroke at position:', x, y, 'brushSize:', brushSize, 'selectedLayer:', selectedDrawingLayer);
            }
            
            return !hasIntersection;
          });
          
          console.log('Strokes before:', prev.length, 'after:', filtered.length);
          // Sync ordered lists with kept IDs
          const kept = new Set(filtered.map(s => s.id));
          setViaOrderTop(order => order.filter(id => kept.has(id)));
          setViaOrderBottom(order => order.filter(id => kept.has(id)));
          setTraceOrderTop(order => order.filter(id => kept.has(id)));
          setTraceOrderBottom(order => order.filter(id => kept.has(id)));
          return filtered;
        });
        // Also erase power symbols intersecting the eraser square
        // Don't erase power nodes if locked
        if (!arePowerNodesLocked) {
          setPowers(prev => {
            const half = brushSize / 2;
            const minX = x - half;
            const maxX = x + half;
            const minY = y - half;
            const maxY = y + half;
            const intersects = (p: PowerSymbol): boolean => {
              const radius = p.size / 2;
              const bbMinX = p.x - radius;
              const bbMaxX = p.x + radius;
              const bbMinY = p.y - radius;
              const bbMaxY = p.y + radius;
              const disjoint = maxX < bbMinX || minX > bbMaxX || maxY < bbMinY || minY > bbMaxY;
              return !disjoint;
            };
            return prev.filter(g => !intersects(g));
          });
        }
        // Also erase ground symbols intersecting the eraser square
        // Don't erase ground if locked
        if (!areGroundNodesLocked) {
          setGrounds(prev => {
            const half = brushSize / 2;
            const minX = x - half;
            const maxX = x + half;
            const minY = y - half;
            const maxY = y + half;
            const intersects = (g: GroundSymbol): boolean => {
              const radius = Math.max(6, (g.size || 18) / 2);
              const lineExtension = radius * 0.8;
              const hitRadius = radius + lineExtension; // Include extended lines
              const bbMinX = g.x - hitRadius;
              const bbMaxX = g.x + hitRadius;
              const bbMinY = g.y - hitRadius;
              const bbMaxY = g.y + hitRadius;
              const disjoint = maxX < bbMinX || minX > bbMaxX || maxY < bbMinY || minY > bbMaxY;
              return !disjoint;
            };
            const kept = prev.filter(g => !intersects(g));
            return kept;
          });
        }
      }
    } else if (isTransforming && transformStartPos && selectedImageForTransform) {
      // Don't allow transforms if images are locked
      if (areImagesLocked) {
        alert('Cannot transform: Images are locked. Unlock images to transform them.');
        return;
      }
      const deltaX = x - transformStartPos.x;
      const deltaY = y - transformStartPos.y;
      
      if (selectedImageForTransform === 'top' && topImage) {
        setTopImage(prev => prev ? {
          ...prev,
          x: prev.x + deltaX,
          y: prev.y + deltaY
        } : null);
      } else if (selectedImageForTransform === 'bottom' && bottomImage) {
        setBottomImage(prev => prev ? {
          ...prev,
          x: prev.x + deltaX,
          y: prev.y + deltaY
        } : null);
      } else if (selectedImageForTransform === 'both') {
        // Apply transform to both images
        if (topImage) {
          setTopImage(prev => prev ? {
            ...prev,
            x: prev.x + deltaX,
            y: prev.y + deltaY
          } : null);
        }
        if (bottomImage) {
          setBottomImage(prev => prev ? {
            ...prev,
            x: prev.x + deltaX,
            y: prev.y + deltaY
          } : null);
        }
      }
      
      setTransformStartPos({ x, y });
    }
  }, [isDrawing, currentStroke, currentTool, brushSize, isTransforming, transformStartPos, selectedImageForTransform, topImage, bottomImage, isShiftConstrained, snapConstrainedPoint, selectedDrawingLayer, setDrawingStrokes, viewScale, viewPan.x, viewPan.y, isSelecting, selectStart, areImagesLocked, areViasLocked, arePadsLocked, areTracesLocked, arePowerNodesLocked, areGroundNodesLocked]);

  const handleCanvasMouseUp = useCallback(() => {
    // Finalize selection if active
    if (currentTool === 'select' && isSelecting) {
      const rectSel = selectRect;
      const start = selectStart;
      setIsSelecting(false);
      setSelectStart(null);
      setSelectRect(null);
      if (rectSel && start) {
        const tiny = rectSel.width < 3 && rectSel.height < 3;
        const withinRect = (px: number, py: number) => {
          const minX = rectSel.x;
          const minY = rectSel.y;
          const maxX = rectSel.x + rectSel.width;
          const maxY = rectSel.y + rectSel.height;
          return px >= minX && px <= maxX && py >= minY && py <= maxY;
        };
        const segIntersectsRect = (x1: number, y1: number, x2: number, y2: number, minX: number, minY: number, maxX: number, maxY: number) => {
          const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;
          const outCode = (px: number, py: number) => {
            let code = INSIDE;
            if (px < minX) code |= LEFT;
            else if (px > maxX) code |= RIGHT;
            if (py < minY) code |= BOTTOM;
            else if (py > maxY) code |= TOP;
            return code;
          };
          let xA = x1, yA = y1, xB = x2, yB = y2;
          let codeA = outCode(xA, yA);
          let codeB = outCode(xB, yB);
          while (true) {
            if ((codeA | codeB) === 0) return true;
            if ((codeA & codeB) !== 0) return false;
            const codeOut = codeA !== 0 ? codeA : codeB;
            let xI = 0, yI = 0;
            if (codeOut & TOP) {
              xI = xA + (xB - xA) * (maxY - yA) / (yB - yA);
              yI = maxY;
            } else if (codeOut & BOTTOM) {
              xI = xA + (xB - xA) * (minY - yA) / (yB - yA);
              yI = minY;
            } else if (codeOut & RIGHT) {
              yI = yA + (yB - yA) * (maxX - xA) / (xB - xA);
              xI = maxX;
            } else {
              yI = yA + (yB - yA) * (minX - xA) / (xB - xA);
              xI = minX;
            }
            if (codeOut === codeA) {
              xA = xI; yA = yI; codeA = outCode(xA, yA);
            } else {
              xB = xI; yB = yI; codeB = outCode(xB, yB);
            }
          }
        };
        const minX = rectSel.x, minY = rectSel.y, maxX = rectSel.x + rectSel.width, maxY = rectSel.y + rectSel.height;
        const hitTolerance = Math.max(6 / viewScale, 4);
        const pointToSegDist = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
          const dx = x2 - x1, dy = y2 - y1;
          if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
          const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
          const cx = x1 + t * dx, cy = y1 + t * dy;
          return Math.hypot(px - cx, py - cy);
        };
        // For click selection (tiny rect), find the single nearest hit
        // For rectangle selection, find all hits
        // Get Shift key state from mouseDown (stored in selectStart)
        const shiftWasPressed = (start as any)?.shiftKey === true;
        const next = new Set<string>(shiftWasPressed ? Array.from(selectedIds) : []);
        const nextComps = new Set<string>(shiftWasPressed ? Array.from(selectedComponentIds) : []);
        const nextPowers = new Set<string>(shiftWasPressed ? Array.from(selectedPowerIds) : []);
        const nextGrounds = new Set<string>(shiftWasPressed ? Array.from(selectedGroundIds) : []);
        
        if (tiny) {
          // Click selection: find the single nearest via, pad, or trace
          let bestHit: { id: string; dist: number } | null = null;
          for (const s of drawingStrokes) {
            // Check visibility before considering this stroke
            let isVisible = false;
            if (s.type === 'via' || s.type === 'pad') {
              isVisible = showViasLayer;
            } else {
              // Trace or default type
              isVisible = s.layer === 'top' ? showTopTracesLayer : showBottomTracesLayer;
            }
            if (!isVisible) continue;
            
            let dist = Infinity;
            if (s.type === 'via' || s.type === 'pad') {
              const c = s.points[0];
              const r = Math.max(1, s.size / 2);
              dist = Math.hypot(c.x - start.x, c.y - start.y);
              if (dist <= Math.max(r, hitTolerance)) {
                if (!bestHit || dist < bestHit.dist) {
                  bestHit = { id: s.id, dist };
                }
              }
            } else {
              for (let i = 0; i < s.points.length - 1; i++) {
                const p1 = s.points[i], p2 = s.points[i + 1];
                const d = pointToSegDist(start.x, start.y, p1.x, p1.y, p2.x, p2.y);
                if (d <= Math.max(hitTolerance, s.size / 2)) {
                  if (!bestHit || d < bestHit.dist) {
                    bestHit = { id: s.id, dist: d };
                  }
                  break;
                }
              }
            }
          }
          // Only add the single best hit (or nothing if no hit)
          if (bestHit) {
            next.add(bestHit.id);
          }
        } else {
          // Rectangle selection: find all hits
          for (const s of drawingStrokes) {
            // Check visibility before considering this stroke
            let isVisible = false;
            if (s.type === 'via' || s.type === 'pad') {
              isVisible = showViasLayer;
            } else {
              // Trace or default type
              isVisible = s.layer === 'top' ? showTopTracesLayer : showBottomTracesLayer;
            }
            if (!isVisible) continue;
            
            let hit = false;
            if (s.type === 'via' || s.type === 'pad') {
              const c = s.points[0];
              hit = withinRect(c.x, c.y);
            } else {
              for (let i = 0; i < s.points.length - 1; i++) {
                const p1 = s.points[i], p2 = s.points[i + 1];
                if (segIntersectsRect(p1.x, p1.y, p2.x, p2.y, minX, minY, maxX, maxY) ||
                    (withinRect(p1.x, p1.y) && withinRect(p2.x, p2.y))) { hit = true; break; }
              }
            }
            if (hit) next.add(s.id);
          }
        }
        // Components hit-test (reuse minX/minY/maxX/maxY)
        const compInRect = (c: PCBComponent) => {
          const size = Math.max(10, c.size || 18);
          const half = size / 2;
          return (c.x - half) <= maxX && (c.x + half) >= minX && (c.y - half) <= maxY && (c.y + half) >= minY;
        };
        if (tiny) {
          const clickInComp = (c: PCBComponent) => {
            const size = Math.max(10, c.size || 18);
            const half = size / 2;
            return (start.x >= c.x - half && start.x <= c.x + half && start.y >= c.y - half && start.y <= c.y + half);
          };
          if (showTopComponents) {
            componentsTop.forEach(c => { if (clickInComp(c)) nextComps.add(c.id); });
          }
          if (showBottomComponents) {
            componentsBottom.forEach(c => { if (clickInComp(c)) nextComps.add(c.id); });
          }
        } else {
          if (showTopComponents) {
            componentsTop.forEach(c => { if (compInRect(c)) nextComps.add(c.id); });
          }
          if (showBottomComponents) {
            componentsBottom.forEach(c => { if (compInRect(c)) nextComps.add(c.id); });
          }
        }
        // Power nodes hit-test
        const powerInRect = (p: PowerSymbol) => {
          const radius = Math.max(6, p.size / 2);
          const lineExtension = radius * 0.8;
          const hitRadius = radius + lineExtension; // Include extended lines in selection
          return (p.x - hitRadius) <= maxX && (p.x + hitRadius) >= minX && (p.y - hitRadius) <= maxY && (p.y + hitRadius) >= minY;
        };
        if (showPowerLayer) {
          if (tiny) {
            // Click selection: find nearest power node
            let bestPowerHit: { id: string; dist: number } | null = null;
            for (const p of powers) {
              const radius = Math.max(6, p.size / 2);
              const lineExtension = radius * 0.8;
              const hitRadius = radius + lineExtension;
              const d = Math.hypot(p.x - start.x, p.y - start.y);
              // Check if click is within circle or on extended lines
              const onVerticalLine = Math.abs(start.x - p.x) <= hitTolerance && Math.abs(start.y - p.y) <= hitRadius;
              const onHorizontalLine = Math.abs(start.y - p.y) <= hitTolerance && Math.abs(start.x - p.x) <= hitRadius;
              const inCircle = d <= Math.max(radius, hitTolerance);
              if (inCircle || onVerticalLine || onHorizontalLine) {
                const dist = Math.min(d, Math.abs(start.x - p.x) + Math.abs(start.y - p.y)); // Use Manhattan distance for line hits
                if (!bestPowerHit || dist < bestPowerHit.dist) {
                  bestPowerHit = { id: p.id, dist };
                }
              }
            }
            if (bestPowerHit) {
              nextPowers.add(bestPowerHit.id);
            }
          } else {
            // Rectangle selection: find all power nodes in rect
            powers.forEach(p => { if (powerInRect(p)) nextPowers.add(p.id); });
          }
        }
        // Ground nodes hit-test
        const groundInRect = (g: GroundSymbol) => {
          const radius = Math.max(6, (g.size || 18) / 2);
          const lineExtension = radius * 0.8;
          const hitRadius = radius + lineExtension; // Include extended lines in selection
          return (g.x - hitRadius) <= maxX && (g.x + hitRadius) >= minX && (g.y - hitRadius) <= maxY && (g.y + hitRadius) >= minY;
        };
        if (showGroundLayer) {
          if (tiny) {
            // Click selection: find nearest ground node
            let bestGroundHit: { id: string; dist: number } | null = null;
            for (const g of grounds) {
              const radius = Math.max(6, (g.size || 18) / 2);
              const lineExtension = radius * 0.8;
              const hitRadius = radius + lineExtension;
              const d = Math.hypot(g.x - start.x, g.y - start.y);
              // Check if click is within circle or on extended lines
              const onVerticalLine = Math.abs(start.x - g.x) <= hitTolerance && Math.abs(start.y - g.y) <= hitRadius;
              const onHorizontalLine = Math.abs(start.y - g.y) <= hitTolerance && Math.abs(start.x - g.x) <= hitRadius;
              const inCircle = d <= Math.max(radius, hitTolerance);
              if (inCircle || onVerticalLine || onHorizontalLine) {
                const dist = Math.min(d, Math.abs(start.x - g.x) + Math.abs(start.y - g.y)); // Use Manhattan distance for line hits
                if (!bestGroundHit || dist < bestGroundHit.dist) {
                  bestGroundHit = { id: g.id, dist };
                }
              }
            }
            if (bestGroundHit) {
              nextGrounds.add(bestGroundHit.id);
            }
          } else {
            // Rectangle selection: find all ground nodes in rect
            grounds.forEach(g => { if (groundInRect(g)) nextGrounds.add(g.id); });
          }
        }
        // Always update selections - if Shift wasn't pressed and nothing was found,
        // the selections should already be empty (cleared in mouseDown)
        setSelectedIds(next);
        setSelectedComponentIds(nextComps);
        setSelectedPowerIds(nextPowers);
        setSelectedGroundIds(nextGrounds);
      }
    }
    if (isDrawing && currentStroke.length > 0) {
      if (currentTool === 'draw' && drawingMode !== 'trace') {
        // Freehand drawing (not trace-click mode)
        const newStroke: DrawingStroke = {
          id: Date.now().toString(),
          points: currentStroke,
          color: brushColor,
          size: brushSize,
          layer: selectedDrawingLayer,
          type: 'trace',
        };
        setDrawingStrokes(prev => [...prev, newStroke]);
        if (selectedDrawingLayer === 'top') {
          setTraceOrderTop(prev => [...prev, newStroke.id]);
        } else {
          setTraceOrderBottom(prev => [...prev, newStroke.id]);
        }
      }
      // For erasing, we don't store the stroke - it directly removes other strokes
      setCurrentStroke([]);
    }
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      panClientStartRef.current = null;
    }
    setIsDrawing(false);
    setIsTransforming(false);
    setTransformStartPos(null);
    setIsShiftConstrained(false);
  }, [isDrawing, currentStroke, currentTool, brushColor, brushSize, selectedDrawingLayer, selectRect, selectStart, isSelecting, drawingStrokes, viewScale, isShiftPressed, selectedIds, powers, grounds, componentsTop, componentsBottom, selectedComponentIds, selectedPowerIds, selectedGroundIds, showViasLayer, showTopTracesLayer, showBottomTracesLayer, showTopComponents, showBottomComponents, showPowerLayer, showGroundLayer]);

  // Allow panning to continue even when the pointer leaves the canvas while the button is held
  React.useEffect(() => {
    if (!(currentTool === 'pan' && isPanning && panClientStartRef.current)) return;
    const onMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const { startClientX, startClientY, panX, panY } = panClientStartRef.current!;
      const dx = (e.clientX - startClientX) * scaleX;
      const dy = (e.clientY - startClientY) * scaleY;
      setViewPan({ x: panX + dx, y: panY + dy });
    };
    const onUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
      panClientStartRef.current = null;
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
    };
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    return () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
    };
  }, [currentTool, isPanning]);


  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Clip to content area (exclude fixed border), then translate origin to content top-left
    ctx.save();
    ctx.beginPath();
    ctx.rect(CONTENT_BORDER, CONTENT_BORDER, canvas.width - 2 * CONTENT_BORDER, canvas.height - 2 * CONTENT_BORDER);
    ctx.clip();
    ctx.translate(CONTENT_BORDER, CONTENT_BORDER);
    // Apply global view transform once (pan then scale)
    ctx.translate(viewPan.x, viewPan.y);
    ctx.scale(viewScale, viewScale);

    // Helper to create an edge-detected (black & white) canvas from a CanvasImageSource
    const createEdgeCanvas = (source: CanvasImageSource, invert: boolean): HTMLCanvasElement => {
      const w = (source as any).width as number;
      const h = (source as any).height as number;
      const offscreen = document.createElement('canvas');
      offscreen.width = w;
      offscreen.height = h;
      const octx = offscreen.getContext('2d');
      if (!octx) return offscreen;
      octx.drawImage(source, 0, 0, w, h);
      const srcData = octx.getImageData(0, 0, w, h);
      const src = srcData.data;

      // Convert to grayscale luminance
      const gray = new Uint8ClampedArray(w * h);
      for (let i = 0; i < w * h; i++) {
        const r = src[i * 4 + 0];
        const g = src[i * 4 + 1];
        const b = src[i * 4 + 2];
        // luminance (rounded)
        gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      }

      const gxKernel = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const gyKernel = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
      const mag = new Float32Array(w * h);

      // Convolution (Sobel)
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let gx = 0;
          let gy = 0;
          let k = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const ix = x + kx;
              const iy = y + ky;
              const val = gray[iy * w + ix];
              gx += val * gxKernel[k];
              gy += val * gyKernel[k];
              k++;
            }
          }
          const m = Math.sqrt(gx * gx + gy * gy);
          mag[y * w + x] = m;
        }
      }

      // Normalize and threshold
      let maxVal = 0;
      for (let i = 0; i < mag.length; i++) {
        if (mag[i] > maxVal) maxVal = mag[i];
      }
      const outData = octx.createImageData(w, h);
      const out = outData.data;
      const threshold = 0.20; // keep stronger edges (20% of max)
      for (let i = 0; i < w * h; i++) {
        const normalized = maxVal > 0 ? mag[i] / maxVal : 0;
        const edge = normalized >= threshold ? 255 : 0; // white edges on black background
        const value = invert ? 255 - edge : edge;
        out[i * 4 + 0] = value;
        out[i * 4 + 1] = value;
        out[i * 4 + 2] = value;
        out[i * 4 + 3] = 255;
      }
      octx.putImageData(outData, 0, 0);
      return offscreen;
    };

    // Draw with perspective-like keystone using slice warping via offscreen canvases
    const drawImageWithKeystone = (
      ctxTarget: CanvasRenderingContext2D,
      source: CanvasImageSource,
      srcW: number,
      srcH: number,
      keystoneV: number,
      keystoneH: number,
      destW: number,
      destH: number,
    ) => {
      const base = document.createElement('canvas');
      base.width = srcW;
      base.height = srcH;
      const bctx = base.getContext('2d', { willReadFrequently: true })!;
      bctx.clearRect(0, 0, srcW, srcH);
      bctx.drawImage(source as any, 0, 0, srcW, srcH);

      let current = base;

      if (Math.abs(keystoneV) > 1e-6) {
        const tanV = Math.tan(keystoneV);
        const topScale = Math.max(0.2, 1 - tanV);
        const bottomScale = Math.max(0.2, 1 + tanV);
        const maxScale = Math.max(topScale, bottomScale);
        const newW = Math.max(1, Math.ceil(srcW * maxScale));
        const temp = document.createElement('canvas');
        temp.width = newW;
        temp.height = srcH;
        const tctx = temp.getContext('2d', { willReadFrequently: true })!;
        tctx.clearRect(0, 0, newW, srcH);
        for (let y = 0; y < srcH; y++) {
          const t = srcH <= 1 ? 0 : (y / (srcH - 1));
          const scaleRow = topScale * (1 - t) + bottomScale * t;
          const dw = Math.max(1, srcW * scaleRow);
          const dx = (newW - dw) / 2;
          tctx.drawImage(current, 0, y, srcW, 1, dx, y, dw, 1);
        }
        current = temp;
      }

      if (Math.abs(keystoneH) > 1e-6) {
        const tanH = Math.tan(keystoneH);
        const leftScale = Math.max(0.2, 1 - tanH);
        const rightScale = Math.max(0.2, 1 + tanH);
        const maxScale = Math.max(leftScale, rightScale);
        const newH = Math.max(1, Math.ceil(srcH * maxScale));
        const temp2 = document.createElement('canvas');
        temp2.width = current.width;
        temp2.height = newH;
        const tctx2 = temp2.getContext('2d', { willReadFrequently: true })!;
        tctx2.clearRect(0, 0, temp2.width, newH);
        for (let x = 0; x < current.width; x++) {
          const t = current.width <= 1 ? 0 : (x / (current.width - 1));
          const scaleCol = leftScale * (1 - t) + rightScale * t;
          const dh = Math.max(1, srcH * scaleCol);
          const dy = (newH - dh) / 2;
          tctx2.drawImage(current, x, 0, 1, current.height, x, dy, 1, dh);
        }
        current = temp2;
      }

      ctxTarget.drawImage(current, -destW / 2, -destH / 2, destW, destH);
    };

    // Draw images with transformations and apply view transform per draw
    const overlayMode = showTopImage && showBottomImage;
    if (topImage && topImage.bitmap && showTopImage) {
      const bmp = topImage.bitmap;
      ctx.save();
      ctx.globalAlpha = 1;
      // Apply grayscale filter if enabled and not in edge mode
      if (isGrayscale && !isBlackAndWhiteEdges) {
        ctx.filter = 'grayscale(100%)';
      } else {
        ctx.filter = 'none';
      }
      // Apply per-image transformations
      const contentWidth = canvas.width - 2 * CONTENT_BORDER;
      const contentHeight = canvas.height - 2 * CONTENT_BORDER;
      const centerX = contentWidth / 2;
      const centerY = contentHeight / 2;
      ctx.translate(centerX + topImage.x, centerY + topImage.y);
      ctx.rotate((topImage.rotation * Math.PI) / 180);
      // Apply skew (keystone) if any
      if (topImage.skewX || topImage.skewY) {
        const sx = Math.tan(topImage.skewX || 0);
        const sy = Math.tan(topImage.skewY || 0);
        ctx.transform(1, sy, sx, 1, 0, 0);
      }
      ctx.scale(topImage.scale * (topImage.flipX ? -1 : 1), topImage.scale * (topImage.flipY ? -1 : 1));
      const scaledWidth = bmp.width * 1; // already accounted by ctx.scale above
      const scaledHeight = bmp.height * 1;
      const sourceToDraw: CanvasImageSource = isBlackAndWhiteEdges ? createEdgeCanvas(bmp, isBlackAndWhiteInverted) : bmp;
      if ((topImage.keystoneV && Math.abs(topImage.keystoneV) > 1e-6) || (topImage.keystoneH && Math.abs(topImage.keystoneH) > 1e-6)) {
        drawImageWithKeystone(ctx, sourceToDraw, bmp.width, bmp.height, topImage.keystoneV || 0, topImage.keystoneH || 0, scaledWidth, scaledHeight);
      } else {
        ctx.drawImage(sourceToDraw, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
      }
      ctx.restore();
    }

    if (bottomImage && bottomImage.bitmap && showBottomImage) {
      const bmp = bottomImage.bitmap;
      ctx.save();
      ctx.globalAlpha = overlayMode ? (transparency / 100) : 1;
      if (isGrayscale && !isBlackAndWhiteEdges) {
        ctx.filter = 'grayscale(100%)';
      } else {
        ctx.filter = 'none';
      }
      // Apply per-image transformations
      const contentWidth = canvas.width - 2 * CONTENT_BORDER;
      const contentHeight = canvas.height - 2 * CONTENT_BORDER;
      const centerX = contentWidth / 2;
      const centerY = contentHeight / 2;
      ctx.translate(centerX + bottomImage.x, centerY + bottomImage.y);
      ctx.rotate((bottomImage.rotation * Math.PI) / 180);
      // Apply skew (keystone) if any
      if (bottomImage.skewX || bottomImage.skewY) {
        const sx = Math.tan(bottomImage.skewX || 0);
        const sy = Math.tan(bottomImage.skewY || 0);
        ctx.transform(1, sy, sx, 1, 0, 0);
      }
      ctx.scale(bottomImage.scale * (bottomImage.flipX ? -1 : 1), bottomImage.scale * (bottomImage.flipY ? -1 : 1));
      const scaledWidth = bmp.width * 1;
      const scaledHeight = bmp.height * 1;
      const sourceToDrawB: CanvasImageSource = isBlackAndWhiteEdges ? createEdgeCanvas(bmp, isBlackAndWhiteInverted) : bmp;
      if ((bottomImage.keystoneV && Math.abs(bottomImage.keystoneV) > 1e-6) || (bottomImage.keystoneH && Math.abs(bottomImage.keystoneH) > 1e-6)) {
        drawImageWithKeystone(ctx, sourceToDrawB, bmp.width, bmp.height, bottomImage.keystoneV || 0, bottomImage.keystoneH || 0, scaledWidth, scaledHeight);
      } else {
        ctx.drawImage(sourceToDrawB, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
      }
      ctx.restore();
    }

    // Always draw strokes on top (respecting view transform applied above)
    drawStrokes(ctx);
    // Draw ground symbols (if visible)
    if (showPowerLayer && powers.length > 0) {
      const drawPower = (p: PowerSymbol) => {
        ctx.save();
        // Find the power bus to get its voltage
        const bus = powerBuses.find(b => b.id === p.powerBusId);
        const isSelected = selectedPowerIds.has(p.id);
        const powerColor = '#ff0000'; // Power symbols are always red
        ctx.strokeStyle = powerColor;
        ctx.lineWidth = Math.max(1, (isSelected ? 3 : 2) / Math.max(viewScale, 0.001));
        ctx.lineCap = 'round';
        const radius = Math.max(6, p.size / 2);
        const lineExtension = radius * 0.8; // Lines extend outside the circle
        
        // Draw selection highlight if selected
        if (isSelected) {
          ctx.strokeStyle = '#0066ff';
          ctx.lineWidth = Math.max(1, 4 / Math.max(viewScale, 0.001));
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius + lineExtension + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Draw empty circle (not filled)
        ctx.strokeStyle = powerColor;
        ctx.lineWidth = Math.max(1, (isSelected ? 3 : 2) / Math.max(viewScale, 0.001));
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw vertical line extending above and below the circle
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - radius - lineExtension);
        ctx.lineTo(p.x, p.y + radius + lineExtension);
        ctx.stroke();
        
        // Draw horizontal line extending left and right of the circle
        ctx.beginPath();
        ctx.moveTo(p.x - radius - lineExtension, p.y);
        ctx.lineTo(p.x + radius + lineExtension, p.y);
        ctx.stroke();
        
        // Draw voltage label if bus is found
        if (bus) {
          ctx.fillStyle = powerColor;
          ctx.font = `${Math.max(10, radius * 0.8)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(bus.voltage, p.x, p.y + radius + lineExtension + 12);
        }
        ctx.restore();
      };
      powers.forEach(drawPower);
    }
    if (showGroundLayer && grounds.length > 0) {
      const drawGround = (g: GroundSymbol) => {
        ctx.save();
        const isSelected = selectedGroundIds.has(g.id);
        const groundColor = '#000000'; // Ground symbols are always black
        ctx.strokeStyle = groundColor;
        ctx.lineWidth = Math.max(1, (isSelected ? 3 : 2) / Math.max(viewScale, 0.001));
        ctx.lineCap = 'round';
        const radius = Math.max(6, (g.size || 18) / 2);
        const lineExtension = radius * 0.8; // Lines extend outside the circle
        
        // Draw selection highlight if selected
        if (isSelected) {
          ctx.strokeStyle = '#0066ff';
          ctx.lineWidth = Math.max(1, 4 / Math.max(viewScale, 0.001));
          ctx.beginPath();
          ctx.arc(g.x, g.y, radius + lineExtension + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Draw empty circle (not filled)
        ctx.strokeStyle = groundColor;
        ctx.lineWidth = Math.max(1, (isSelected ? 3 : 2) / Math.max(viewScale, 0.001));
        ctx.beginPath();
        ctx.arc(g.x, g.y, radius, 0, Math.PI * 2);
        ctx.stroke();
        
        // Draw vertical line extending above and below the circle
        ctx.beginPath();
        ctx.moveTo(g.x, g.y - radius - lineExtension);
        ctx.lineTo(g.x, g.y + radius + lineExtension);
        ctx.stroke();
        
        // Draw horizontal line extending left and right of the circle
        ctx.beginPath();
        ctx.moveTo(g.x - radius - lineExtension, g.y);
        ctx.lineTo(g.x + radius + lineExtension, g.y);
        ctx.stroke();
        
        ctx.restore();
      };
      grounds.forEach(drawGround);
    }
    // Draw components
    const drawComponent = (c: PCBComponent) => {
      const size = Math.max(10, c.size || 18);
      const half = size / 2;
      ctx.save();
      ctx.strokeStyle = c.color || '#111';
      ctx.lineWidth = Math.max(1, 2 / Math.max(viewScale, 0.001));
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.rect(c.x - half, c.y - half, size, size);
      ctx.fill();
      ctx.stroke();
      // Draw abbreviation text (default based on component type prefix)
      let abbreviation = ('abbreviation' in c && (c as any).abbreviation) ? 
        String((c as any).abbreviation).trim() : '';
      if (!abbreviation || abbreviation === '' || abbreviation === '****' || abbreviation === '*' || abbreviation === '?') {
        abbreviation = getDefaultAbbreviation(c.componentType);
      }
      ctx.fillStyle = c.color || '#111';
      ctx.font = `bold ${Math.max(8, size * 0.35)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(abbreviation, c.x, c.y);
      
      // Check if all pins are connected - if so, underline the abbreviation
      const pinConnections = c.pinConnections || [];
      const allPinsConnected = pinConnections.length > 0 && 
        pinConnections.length === c.pinCount && 
        pinConnections.every(conn => conn && conn.trim() !== '');
      
      if (allPinsConnected) {
        // Measure text width to draw underline
        const textMetrics = ctx.measureText(abbreviation);
        const textWidth = textMetrics.width;
        const underlineY = c.y + (size * 0.35) / 2 + 2; // Position below text
        ctx.strokeStyle = c.color || '#111';
        ctx.lineWidth = Math.max(1, 2 / Math.max(viewScale, 0.001));
        ctx.beginPath();
        ctx.moveTo(c.x - textWidth / 2, underlineY);
        ctx.lineTo(c.x + textWidth / 2, underlineY);
        ctx.stroke();
      }
      
      // selection highlight
      const isSelected = selectedComponentIds.has(c.id);
      if (isSelected) {
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = '#00bfff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(c.x - half - 3, c.y - half - 3, size + 6, size + 6);
        ctx.setLineDash([]);
      }
      ctx.restore();
    };
    if (showTopComponents) componentsTop.forEach(drawComponent);
    if (showBottomComponents) componentsBottom.forEach(drawComponent);
    // Draw active selection rectangle in view space for perfect alignment
    if (currentTool === 'select' && selectRect) {
      ctx.save();
      // Use bright cyan with semi-transparent fill
      const dash = Math.max(2, 6 / Math.max(0.0001, viewScale));
      ctx.strokeStyle = '#00bfff';
      ctx.fillStyle = 'rgba(0, 191, 255, 0.15)';
      ctx.lineWidth = Math.max(1, 1.5 / Math.max(0.0001, viewScale));
      ctx.setLineDash([dash, dash]);
      ctx.beginPath();
      ctx.rect(selectRect.x, selectRect.y, selectRect.width, selectRect.height);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    // Restore after view scaling
    ctx.restore();
  }, [topImage, bottomImage, transparency, drawingStrokes, currentStroke, isDrawing, currentTool, brushColor, brushSize, isGrayscale, isBlackAndWhiteEdges, isBlackAndWhiteInverted, selectedImageForTransform, selectedDrawingLayer, viewScale, viewPan.x, viewPan.y, showTopImage, showBottomImage, showViasLayer, showTopTracesLayer, showBottomTracesLayer, showTopPadsLayer, showBottomPadsLayer, showTopComponents, showBottomComponents, componentsTop, componentsBottom, showPowerLayer, powers, showGroundLayer, grounds, selectRect, selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, traceToolLayer, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize, drawingMode, tracePreviewMousePos]);

  // Resize scrollbar extents based on transformed image bounds
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvasContainerRef.current;
    const hContent = hScrollContentRef.current;
    const vContent = vScrollContentRef.current;
    if (!canvas || !container || !hContent || !vContent) return;

    let bounds: Bounds | null = null;
    const contentWidth = canvas.width - 2 * CONTENT_BORDER;
    const contentHeight = canvas.height - 2 * CONTENT_BORDER;
    const centerX = contentWidth / 2;
    const centerY = contentHeight / 2;
    const addImageBounds = (img: typeof topImage | typeof bottomImage) => {
      if (!img || !img.bitmap) return;
      const rawW = img.bitmap.width;
      const rawH = img.bitmap.height;
      // Keystone: approximate by scaling width/height by max edge scale
      const tanV = img.keystoneV ? Math.tan(img.keystoneV) : 0;
      const tanH = img.keystoneH ? Math.tan(img.keystoneH) : 0;
      const topScale = Math.max(0.2, 1 - tanV);
      const bottomScale = Math.max(0.2, 1 + tanV);
      const leftScale = Math.max(0.2, 1 - tanH);
      const rightScale = Math.max(0.2, 1 + tanH);
      const kScaleW = Math.max(topScale, bottomScale);
      const kScaleH = Math.max(leftScale, rightScale);
      const wK = rawW * kScaleW;
      const hK = rawH * kScaleH;

      // Slant (skew) extents: shear before rotation
      const sx = img.skewX ? Math.tan(img.skewX) : 0; // horizontal shear
      const sy = img.skewY ? Math.tan(img.skewY) : 0; // vertical shear
      const absScale = Math.abs(img.scale);
      const wSheared = Math.abs(absScale) * wK + Math.abs(sx) * Math.abs(absScale) * hK;
      const hSheared = Math.abs(sy) * Math.abs(absScale) * wK + Math.abs(absScale) * hK;

      // Use unit scale in bounds since dimensions already include scale magnitude
      const b = rectTransformedBounds(
        wSheared,
        hSheared,
        centerX,
        centerY,
        img.x,
        img.y,
        1,
        1,
        img.rotation
      );
      bounds = mergeBounds(bounds, b);
    };
    addImageBounds(topImage);
    addImageBounds(bottomImage);

    if (!bounds) {
      // No images; set minimal scroll extents
      hContent.style.width = `${container.clientWidth}px`;
      vContent.style.height = `${container.clientHeight}px`;
      return;
    }
    const nb = bounds as Bounds;
    const widthWorld = nb.maxX - nb.minX;
    const heightWorld = nb.maxY - nb.minY;
    const widthScreen = widthWorld * viewScale;
    const heightScreen = heightWorld * viewScale;

    const EDGE_PAD = 8; // small pad to ensure the very edges are reachable
    const desiredW = Math.max(container.clientWidth, Math.ceil(widthScreen) + EDGE_PAD * 2);
    const desiredH = Math.max(container.clientHeight, Math.ceil(heightScreen) + EDGE_PAD * 2);
    hContent.style.width = `${desiredW}px`;
    vContent.style.height = `${desiredH}px`;
    // Update content origin (position of left/top edge in screen space when viewPan=0)
    contentOriginXRef.current = nb.minX * viewScale - EDGE_PAD;
    contentOriginYRef.current = nb.minY * viewScale - EDGE_PAD;
    // After content size changes, sync scrollbars to current pan
    const h = hScrollRef.current;
    const v = vScrollRef.current;
    isSyncingScrollRef.current = true;
    if (h) {
      const maxX = Math.max(0, h.scrollWidth - h.clientWidth);
      const desired = Math.max(0, Math.min(maxX, -(viewPan.x + contentOriginXRef.current)));
      h.scrollLeft = desired;
    }
    if (v) {
      const maxY = Math.max(0, v.scrollHeight - v.clientHeight);
      const desired = Math.max(0, Math.min(maxY, -(viewPan.y + contentOriginYRef.current)));
      v.scrollTop = desired;
    }
    requestAnimationFrame(() => { isSyncingScrollRef.current = false; });
  }, [topImage, bottomImage, viewScale, viewPan.x, viewPan.y, canvasSize.width, canvasSize.height]);

  // Responsive canvas sizing: fill available space while keeping 1.6:1 aspect ratio
  React.useEffect(() => {
    const computeSize = () => {
      const container = canvasContainerRef.current;
      if (!container) return;
      
      // ASPECT = width / height, so 1.6 means 1.6x wider than tall (e.g., 1600x1000)
      const ASPECT = 1.6;
      
      // The toolbar and layers panel are absolutely positioned INSIDE the container,
      // so we use the FULL container dimensions, but leave some padding
      const PADDING = 24; // 12px on each side
      const availableW = container.clientWidth - PADDING;
      const availableH = container.clientHeight - PADDING;
      
      // Calculate dimensions based on aspect ratio
      // If we use full height, how wide would it be?
      const widthIfHeightLimited = Math.floor(availableH * ASPECT);
      // If we use full width, how tall would it be?
      const heightIfWidthLimited = Math.floor(availableW / ASPECT);
      
      let width, height;
      if (widthIfHeightLimited <= availableW) {
        // Height is the limiting factor - use full height
        width = widthIfHeightLimited;
        height = availableH;
      } else {
        // Width is the limiting factor - use full width
        width = availableW;
        height = heightIfWidthLimited;
      }
      
      // Ensure minimum usable size
      width = Math.max(600, width);
      height = Math.max(375, height);
      
      setCanvasSize(prev => (prev.width === width && prev.height === height) ? prev : { width, height });
    };
    computeSize();
    window.addEventListener('resize', computeSize);
    return () => window.removeEventListener('resize', computeSize);
  }, []);

  const drawStrokes = useCallback((ctx: CanvasRenderingContext2D) => {
    // Pass 1: draw traces first (so vias and pads appear on top)
    drawingStrokes.forEach(stroke => {
      if (stroke.type === 'via' || stroke.type === 'pad') return;
      let shouldShowStroke = false;
      if (stroke.layer === 'top') shouldShowStroke = showTopTracesLayer;
      else if (stroke.layer === 'bottom') shouldShowStroke = showBottomTracesLayer;
      if (!shouldShowStroke) return;

      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        const r = Math.max(0.5, stroke.size / 2);
        if (selectedIds.has(stroke.id)) {
          ctx.strokeStyle = '#00bfff';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.fillStyle = stroke.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        if (selectedIds.has(stroke.id)) {
          ctx.strokeStyle = '#00bfff';
          ctx.lineWidth = stroke.size + 4;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          stroke.points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = 1;

        ctx.beginPath();
        stroke.points.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();

        // Draw points at each vertex
        for (const pt of stroke.points) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, stroke.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // Pass 2: draw vias and pads on top of traces
    drawingStrokes.forEach(stroke => {
      if (stroke.type === 'via') {
        if (!showViasLayer) return;
      } else if (stroke.type === 'pad') {
        // Check pad visibility based on layer
        if (stroke.layer === 'top' && !showTopPadsLayer) return;
        if (stroke.layer === 'bottom' && !showBottomPadsLayer) return;
      } else {
        return;
      }
      const c = stroke.points[0];
      
      // Selection highlight
      if (selectedIds.has(stroke.id)) {
        if (stroke.type === 'via') {
          const rOuter = Math.max(0.5, stroke.size / 2) + 3;
          ctx.strokeStyle = '#00bfff';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(c.x, c.y, rOuter, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (stroke.type === 'pad') {
          const halfSize = Math.max(0.5, stroke.size / 2) + 3;
          ctx.strokeStyle = '#00bfff';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(c.x - halfSize, c.y - halfSize, stroke.size + 6, stroke.size + 6);
          ctx.setLineDash([]);
        }
      }
      
      if (stroke.type === 'via') {
        // Draw via with annulus (filled ring with open hole) and bullseye crosshairs
        const rOuter = Math.max(0.5, stroke.size / 2);
        const rInner = rOuter * 0.5;
        const crosshairLength = rOuter * 0.7;
        
        // Draw annulus (filled ring with open hole in the middle)
        // Use even-odd fill rule to create a hole in the middle
        ctx.fillStyle = stroke.color;
        ctx.beginPath();
        // Outer circle
        ctx.arc(c.x, c.y, rOuter, 0, Math.PI * 2);
        // Inner circle (creates the hole with even-odd fill rule)
        ctx.arc(c.x, c.y, rInner, 0, Math.PI * 2);
        ctx.fill('evenodd');
        
        // Draw medium gray crosshairs
        ctx.strokeStyle = '#808080'; // Medium gray
        ctx.lineWidth = 1;
        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(c.x - crosshairLength, c.y);
        ctx.lineTo(c.x + crosshairLength, c.y);
        ctx.stroke();
        // Vertical line
        ctx.beginPath();
        ctx.moveTo(c.x, c.y - crosshairLength);
        ctx.lineTo(c.x, c.y + crosshairLength);
        ctx.stroke();
      } else if (stroke.type === 'pad') {
        // Draw pad as square annulus (square with square hole in the middle) - similar to via but square
        const halfSize = Math.max(0.5, stroke.size / 2);
        const outerSize = stroke.size;
        const innerSize = outerSize * 0.5; // Inner square is half the size
        const crosshairLength = halfSize * 0.7;
        
        // Draw square annulus using even-odd fill rule to create a hole in the middle
        ctx.fillStyle = stroke.color;
        ctx.beginPath();
        // Outer square
        ctx.rect(c.x - halfSize, c.y - halfSize, outerSize, outerSize);
        // Inner square (creates the hole with even-odd fill rule)
        ctx.rect(c.x - innerSize / 2, c.y - innerSize / 2, innerSize, innerSize);
        ctx.fill('evenodd');
        
        // Draw medium gray crosshairs
        ctx.strokeStyle = '#808080'; // Medium gray
        ctx.lineWidth = 1;
        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(c.x - crosshairLength, c.y);
        ctx.lineTo(c.x + crosshairLength, c.y);
        ctx.stroke();
        // Vertical line
        ctx.beginPath();
        ctx.moveTo(c.x, c.y - crosshairLength);
        ctx.lineTo(c.x, c.y + crosshairLength);
        ctx.stroke();
      }
    });

    // Draw current stroke if it's on the appropriate layer and visible
    if (currentStroke.length > 0) {
      const currentLayer = selectedDrawingLayer; // Use the selected drawing layer
      let shouldShowCurrentStroke = true;
      if (currentTool === 'draw') {
        if (drawingMode === 'via') {
          shouldShowCurrentStroke = showViasLayer;
        } else {
          shouldShowCurrentStroke = currentLayer === 'top' ? showTopTracesLayer : showBottomTracesLayer;
        }
      }
        
      if (shouldShowCurrentStroke) {
        if (currentTool === 'draw') {
          if (drawingMode === 'via') {
            const center = currentStroke[currentStroke.length - 1];
            const rOuter = Math.max(0.5, brushSize / 2);
            const rInner = rOuter * 0.5;
            const crosshairLength = rOuter * 0.7;
            
            // Draw annulus using even-odd fill rule
            ctx.fillStyle = brushColor;
            ctx.beginPath();
            // Outer circle
            ctx.arc(center.x, center.y, rOuter, 0, Math.PI * 2);
            // Inner circle (creates the hole with even-odd fill rule)
            ctx.arc(center.x, center.y, rInner, 0, Math.PI * 2);
            ctx.fill('evenodd');
            
            // Draw medium gray crosshairs
            ctx.strokeStyle = '#808080'; // Medium gray
            ctx.lineWidth = 1;
            // Horizontal line
            ctx.beginPath();
            ctx.moveTo(center.x - crosshairLength, center.y);
            ctx.lineTo(center.x + crosshairLength, center.y);
            ctx.stroke();
            // Vertical line
            ctx.beginPath();
            ctx.moveTo(center.x, center.y - crosshairLength);
            ctx.lineTo(center.x, center.y + crosshairLength);
            ctx.stroke();
          } else if (drawingMode === 'pad') {
            const center = currentStroke[currentStroke.length - 1];
            const halfSize = Math.max(0.5, brushSize / 2);
            const outerSize = brushSize;
            const innerSize = outerSize * 0.5; // Inner square is half the size
            const crosshairLength = halfSize * 0.7;
            
            // Draw square annulus using even-odd fill rule
            ctx.fillStyle = brushColor;
            ctx.beginPath();
            // Outer square
            ctx.rect(center.x - halfSize, center.y - halfSize, outerSize, outerSize);
            // Inner square (creates the hole with even-odd fill rule)
            ctx.rect(center.x - innerSize / 2, center.y - innerSize / 2, innerSize, innerSize);
            ctx.fill('evenodd');
            
            // Draw medium gray crosshairs
            ctx.strokeStyle = '#808080'; // Medium gray
            ctx.lineWidth = 1;
            // Horizontal line
            ctx.beginPath();
            ctx.moveTo(center.x - crosshairLength, center.y);
            ctx.lineTo(center.x + crosshairLength, center.y);
            ctx.stroke();
            // Vertical line
            ctx.beginPath();
            ctx.moveTo(center.x, center.y - crosshairLength);
            ctx.lineTo(center.x, center.y + crosshairLength);
            ctx.stroke();
          } else {
            // For traces, use layer-specific colors
            const layer = traceToolLayer || 'top';
            const traceColor = layer === 'top' ? topTraceColor : bottomTraceColor;
            const traceSize = layer === 'top' ? topTraceSize : bottomTraceSize;
            if (currentStroke.length === 1) {
              const p = currentStroke[0];
              const r = Math.max(0.5, traceSize / 2);
              ctx.fillStyle = traceColor;
              ctx.beginPath();
              ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
              ctx.fill();
              // Draw preview line from first point to mouse position
              if (tracePreviewMousePos) {
                ctx.strokeStyle = traceColor;
                ctx.lineWidth = traceSize;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.globalAlpha = 0.6; // Semi-transparent preview
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(tracePreviewMousePos.x, tracePreviewMousePos.y);
                ctx.stroke();
                ctx.globalAlpha = 1;
              }
            } else {
              ctx.strokeStyle = traceColor;
              ctx.lineWidth = traceSize;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.globalAlpha = 1;

              ctx.beginPath();
              currentStroke.forEach((point, index) => {
                if (index === 0) {
                  ctx.moveTo(point.x, point.y);
                } else {
                  ctx.lineTo(point.x, point.y);
                }
              });
              ctx.stroke();
              // Draw preview line from last point to mouse position
              if (tracePreviewMousePos && currentStroke.length > 0) {
                const lastPoint = currentStroke[currentStroke.length - 1];
                ctx.globalAlpha = 0.6; // Semi-transparent preview
                ctx.beginPath();
                ctx.moveTo(lastPoint.x, lastPoint.y);
                ctx.lineTo(tracePreviewMousePos.x, tracePreviewMousePos.y);
                ctx.stroke();
                ctx.globalAlpha = 1;
              }
            }
          }
        } else if (currentTool === 'erase') {
          // Show eraser path as a semi-transparent red line
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
          ctx.lineWidth = brushSize;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.globalAlpha = 0.5;

          ctx.beginPath();
          currentStroke.forEach((point, index) => {
            if (index === 0) {
              ctx.moveTo(point.x, point.y);
            } else {
              ctx.lineTo(point.x, point.y);
            }
          });
          ctx.stroke();
        }
      }
    }
  }, [drawingStrokes, selectedIds, showTopTracesLayer, showBottomTracesLayer, showViasLayer, showTopPadsLayer, showBottomPadsLayer, currentStroke, currentTool, drawingMode, brushColor, brushSize, selectedDrawingLayer, traceToolLayer, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize, tracePreviewMousePos]);

  // Transformation functions
  const updateImageTransform = useCallback((type: 'top' | 'bottom' | 'both', updates: Partial<PCBImage>) => {
    // Don't allow transforms if images are locked
    if (areImagesLocked) {
      alert('Cannot transform: Images are locked. Unlock images to transform them.');
      return;
    }
    if (type === 'top' && topImage) {
      setTopImage(prev => prev ? { ...prev, ...updates } : null);
    } else if (type === 'bottom' && bottomImage) {
      setBottomImage(prev => prev ? { ...prev, ...updates } : null);
    } else if (type === 'both') {
      // Apply to both images
      if (topImage) {
        setTopImage(prev => prev ? { ...prev, ...updates } : null);
      }
      if (bottomImage) {
        setBottomImage(prev => prev ? { ...prev, ...updates } : null);
      }
    }
  }, [topImage, bottomImage, areImagesLocked]);

  const resetImageTransform = useCallback(() => {
    // Reset only the selected image to its original transform
    if (!selectedImageForTransform) return;
    updateImageTransform(selectedImageForTransform, {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      flipX: false,
      flipY: false,
      skewX: 0,
      skewY: 0,
      keystoneV: 0,
      keystoneH: 0,
    });
    // Also restore color mode (global)
    setIsGrayscale(false);
    setIsBlackAndWhiteEdges(false);
    setIsBlackAndWhiteInverted(false);
  }, [updateImageTransform, selectedImageForTransform]);

  // Enhanced keyboard functionality for sliders, drawing undo, and image transformation
  // Helper functions for size changes
  const increaseSize = useCallback(() => {
    if (selectedIds.size > 0 || selectedComponentIds.size > 0 || selectedPowerIds.size > 0 || selectedGroundIds.size > 0) {
      // Check if any selected items are locked
      if (selectedIds.size > 0) {
        const selectedStrokes = drawingStrokes.filter(s => selectedIds.has(s.id));
        const hasLockedVias = areViasLocked && selectedStrokes.some(s => s.type === 'via');
        const hasLockedTraces = areTracesLocked && selectedStrokes.some(s => s.type === 'trace');
        const hasLockedPads = arePadsLocked && selectedStrokes.some(s => s.type === 'pad');
        if (hasLockedVias) {
          alert('Cannot change size: Vias are locked. Unlock vias to change their size.');
          return;
        }
        if (hasLockedTraces) {
          alert('Cannot change size: Traces are locked. Unlock traces to change their size.');
          return;
        }
        if (hasLockedPads) {
          alert('Cannot change size: Pads are locked. Unlock pads to change their size.');
          return;
        }
      }
      if (selectedComponentIds.size > 0 && areComponentsLocked) {
        alert('Cannot change size: Components are locked. Unlock components to change their size.');
        return;
      }
      if (selectedPowerIds.size > 0 && arePowerNodesLocked) {
        alert('Cannot change size: Power nodes are locked. Unlock power nodes to change their size.');
        return;
      }
      if (selectedGroundIds.size > 0 && areGroundNodesLocked) {
        alert('Cannot change size: Ground nodes are locked. Unlock ground nodes to change their size.');
        return;
      }
      
      // Determine object types from selected items to persist defaults
      // Note: selectedStrokes, hasVias, and hasTraces are reserved for future use
      // const selectedStrokes = drawingStrokes.filter(s => selectedIds.has(s.id));
      // const hasVias = selectedStrokes.some(s => s.type === 'via');
      // const hasTraces = selectedStrokes.some(s => s.type === 'trace');
      
      setDrawingStrokes(prev => prev.map(s => {
        if (selectedIds.has(s.id)) {
          const newSize = s.size + 1;
          // Persist default size for this object type
          if (s.type === 'via') {
            saveDefaultSize('via', newSize);
          } else if (s.type === 'pad') {
            saveDefaultSize('pad', newSize);
          } else if (s.type === 'trace') {
            saveDefaultSize('trace', newSize, s.layer);
          }
          return { ...s, size: newSize };
        }
        return s;
      }));
      if (selectedComponentIds.size > 0) {
        const newSize = (selectedComponentIds.size > 0 ? (componentsTop.find(c => selectedComponentIds.has(c.id))?.size || 18) : 18) + 1;
        saveDefaultSize('component', newSize);
        setComponentsTop(prev => prev.map(c => selectedComponentIds.has(c.id) ? { ...c, size: (c.size || 18) + 1 } : c));
        setComponentsBottom(prev => prev.map(c => selectedComponentIds.has(c.id) ? { ...c, size: (c.size || 18) + 1 } : c));
      }
      if (selectedPowerIds.size > 0) {
        const newSize = (powers.find(p => selectedPowerIds.has(p.id))?.size || 18) + 1;
        saveDefaultSize('power', newSize);
        setPowers(prev => prev.map(p => selectedPowerIds.has(p.id) ? { ...p, size: p.size + 1 } : p));
      }
      if (selectedGroundIds.size > 0) {
        const newSize = (grounds.find(g => selectedGroundIds.has(g.id))?.size || 18) + 1;
        saveDefaultSize('ground', newSize);
        setGrounds(prev => prev.map(g => selectedGroundIds.has(g.id) ? { ...g, size: (g.size || 18) + 1 } : g));
      }
    } else {
      setBrushSize(b => {
        const newSize = Math.min(40, b + 1);
        // The useEffect hook will automatically save to localStorage via saveToolSettings
        // when brushSize changes, so we don't need to call saveDefaultSize here
        return newSize;
      });
    }
  }, [selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, drawingStrokes, areViasLocked, areTracesLocked, areComponentsLocked, arePowerNodesLocked, areGroundNodesLocked, currentTool, drawingMode, selectedDrawingLayer, saveDefaultSize]);

  const decreaseSize = useCallback(() => {
    if (selectedIds.size > 0 || selectedComponentIds.size > 0 || selectedPowerIds.size > 0 || selectedGroundIds.size > 0) {
      // Check if any selected items are locked
      if (selectedIds.size > 0) {
        const selectedStrokes = drawingStrokes.filter(s => selectedIds.has(s.id));
        const hasLockedVias = areViasLocked && selectedStrokes.some(s => s.type === 'via');
        const hasLockedTraces = areTracesLocked && selectedStrokes.some(s => s.type === 'trace');
        const hasLockedPads = arePadsLocked && selectedStrokes.some(s => s.type === 'pad');
        if (hasLockedVias) {
          alert('Cannot change size: Vias are locked. Unlock vias to change their size.');
          return;
        }
        if (hasLockedTraces) {
          alert('Cannot change size: Traces are locked. Unlock traces to change their size.');
          return;
        }
        if (hasLockedPads) {
          alert('Cannot change size: Pads are locked. Unlock pads to change their size.');
          return;
        }
      }
      if (selectedComponentIds.size > 0 && areComponentsLocked) {
        alert('Cannot change size: Components are locked. Unlock components to change their size.');
        return;
      }
      if (selectedPowerIds.size > 0 && arePowerNodesLocked) {
        alert('Cannot change size: Power nodes are locked. Unlock power nodes to change their size.');
        return;
      }
      if (selectedGroundIds.size > 0 && areGroundNodesLocked) {
        alert('Cannot change size: Ground nodes are locked. Unlock ground nodes to change their size.');
        return;
      }
      
      // Determine object types from selected items to persist defaults
      setDrawingStrokes(prev => prev.map(s => {
        if (selectedIds.has(s.id)) {
          const newSize = Math.max(1, s.size - 1);
          // Persist default size for this object type
          if (s.type === 'via') {
            saveDefaultSize('via', newSize);
          } else if (s.type === 'pad') {
            saveDefaultSize('pad', newSize);
          } else if (s.type === 'trace') {
            saveDefaultSize('trace', newSize, s.layer);
          }
          return { ...s, size: newSize };
        }
        return s;
      }));
      if (selectedComponentIds.size > 0) {
        const newSize = Math.max(1, (componentsTop.find(c => selectedComponentIds.has(c.id))?.size || 18) - 1);
        saveDefaultSize('component', newSize);
        setComponentsTop(prev => prev.map(c => selectedComponentIds.has(c.id) ? { ...c, size: Math.max(1, (c.size || 18) - 1) } : c));
        setComponentsBottom(prev => prev.map(c => selectedComponentIds.has(c.id) ? { ...c, size: Math.max(1, (c.size || 18) - 1) } : c));
      }
      if (selectedPowerIds.size > 0) {
        const newSize = Math.max(1, (powers.find(p => selectedPowerIds.has(p.id))?.size || 18) - 1);
        saveDefaultSize('power', newSize);
        setPowers(prev => prev.map(p => selectedPowerIds.has(p.id) ? { ...p, size: Math.max(1, p.size - 1) } : p));
      }
      if (selectedGroundIds.size > 0) {
        const newSize = Math.max(1, (grounds.find(g => selectedGroundIds.has(g.id))?.size || 18) - 1);
        saveDefaultSize('ground', newSize);
        setGrounds(prev => prev.map(g => selectedGroundIds.has(g.id) ? { ...g, size: Math.max(1, (g.size || 18) - 1) } : g));
      }
    } else {
      setBrushSize(b => {
        const newSize = Math.max(1, b - 1);
        // The useEffect hook will automatically save to localStorage via saveToolSettings
        // when brushSize changes, so we don't need to call saveDefaultSize here
        return newSize;
      });
    }
  }, [selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, drawingStrokes, areViasLocked, areTracesLocked, areComponentsLocked, arePowerNodesLocked, areGroundNodesLocked, currentTool, drawingMode, selectedDrawingLayer, saveDefaultSize]);

  // Handle applying size from Set Size dialog
  const handleSetSizeApply = useCallback(() => {
    const sz = setSizeDialog.size;
    
    if (selectedIds.size > 0 || selectedComponentIds.size > 0 || selectedPowerIds.size > 0 || selectedGroundIds.size > 0) {
      // Check if any selected items are locked
      if (selectedIds.size > 0) {
        const selectedStrokes = drawingStrokes.filter(s => selectedIds.has(s.id));
        const hasLockedVias = areViasLocked && selectedStrokes.some(s => s.type === 'via');
        const hasLockedPads = arePadsLocked && selectedStrokes.some(s => s.type === 'pad');
        const hasLockedTraces = areTracesLocked && selectedStrokes.some(s => s.type === 'trace');
        if (hasLockedVias || hasLockedPads || hasLockedTraces) {
          alert('Cannot change size: selected items are locked.');
          return;
        }
      }
      if (selectedComponentIds.size > 0 && areComponentsLocked) {
        alert('Cannot change size: selected components are locked.');
        return;
      }
      if (selectedPowerIds.size > 0 && arePowerNodesLocked) {
        alert('Cannot change size: selected power nodes are locked.');
        return;
      }
      if (selectedGroundIds.size > 0 && areGroundNodesLocked) {
        alert('Cannot change size: selected ground nodes are locked.');
        return;
      }
      
      // Determine object types from selected items to persist defaults
      // Note: selectedStrokes, hasVias, and hasTraces are reserved for future use
      // const selectedStrokes = drawingStrokes.filter(s => selectedIds.has(s.id));
      // const hasVias = selectedStrokes.some(s => s.type === 'via');
      // const hasTraces = selectedStrokes.some(s => s.type === 'trace');
      
      setDrawingStrokes(prev => prev.map(s => {
        if (selectedIds.has(s.id)) {
          // Persist default size for this object type
          if (s.type === 'via') {
            saveDefaultSize('via', sz);
            // Update toolRegistry
            setToolRegistry(prev => {
              const updated = new Map(prev);
              const viaDef = updated.get('via');
              if (viaDef) {
                updated.set('via', { ...viaDef, settings: { ...viaDef.settings, size: sz } });
              }
              return updated;
            });
          } else if (s.type === 'pad') {
            saveDefaultSize('pad', sz);
            // Update toolRegistry
            setToolRegistry(prev => {
              const updated = new Map(prev);
              const padDef = updated.get('pad');
              if (padDef) {
                updated.set('pad', { ...padDef, settings: { ...padDef.settings, size: sz } });
              }
              return updated;
            });
          } else if (s.type === 'trace') {
            saveDefaultSize('trace', sz, s.layer);
          }
          return { ...s, size: sz };
        }
        return s;
      }));
      if (selectedComponentIds.size > 0) {
        saveDefaultSize('component', sz);
        setComponentsTop(prev => prev.map(c => selectedComponentIds.has(c.id) ? { ...c, size: sz } : c));
        setComponentsBottom(prev => prev.map(c => selectedComponentIds.has(c.id) ? { ...c, size: sz } : c));
      }
      if (selectedPowerIds.size > 0) {
        saveDefaultSize('power', sz);
        setPowers(prev => prev.map(p => selectedPowerIds.has(p.id) ? { ...p, size: sz } : p));
      }
      if (selectedGroundIds.size > 0) {
        saveDefaultSize('ground', sz);
        setGrounds(prev => prev.map(g => selectedGroundIds.has(g.id) ? { ...g, size: sz } : g));
      }
    } else {
      setBrushSize(sz);
      // The useEffect hook will automatically save to localStorage via saveToolSettings
      // when brushSize changes, so we don't need to manually save here
      // Legacy support: also save using old system for backward compatibility
      if (currentTool === 'draw' && drawingMode === 'trace') {
        if (selectedDrawingLayer === 'top') {
          setTopTraceSize(sz);
          saveDefaultSize('trace', sz, 'top');
        } else {
          setBottomTraceSize(sz);
          saveDefaultSize('trace', sz, 'bottom');
        }
      } else if (currentTool === 'draw' && drawingMode === 'via') {
        saveDefaultSize('via', sz);
      } else if (currentTool === 'draw' && drawingMode === 'pad') {
        saveDefaultSize('pad', sz);
      } else if (currentTool === 'component') {
        saveDefaultSize('component', sz);
      } else if (currentTool === 'power') {
        saveDefaultSize('power', sz);
      } else if (currentTool === 'ground') {
        saveDefaultSize('ground', sz);
      } else {
        saveDefaultSize('brush', sz);
      }
    }
    
    setSetSizeDialog({ visible: false, size: 6 });
  }, [setSizeDialog.size, selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, drawingStrokes, areViasLocked, areTracesLocked, areComponentsLocked, arePowerNodesLocked, areGroundNodesLocked, currentTool, drawingMode, selectedDrawingLayer, saveDefaultSize, toolRegistry, setToolRegistry]);

  // Handle auto-save prompt dialog - Enable button
  const handleAutoSavePromptEnable = useCallback(() => {
    // Close the prompt dialog and open the auto-save interval selection dialog
    setAutoSavePromptDialog({ visible: false, source: null });
    setAutoSaveDialog({ visible: true, interval: 5 }); // Default to 5 minutes
  }, []);

  // Handle auto-save prompt dialog - Skip button
  const handleAutoSavePromptSkip = useCallback(() => {
    // Just close the prompt dialog
    setAutoSavePromptDialog({ visible: false, source: null });
  }, []);

  // Handle applying auto-save interval from dialog
  const handleAutoSaveApply = useCallback(async () => {
    const interval = autoSaveDialog.interval;
    
    // If interval is null, disable auto-save
    if (interval === null) {
      setAutoSaveEnabled(false);
      setAutoSaveInterval(null);
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
      setAutoSaveDialog({ visible: false, interval: 5 });
      console.log('Auto save: Disabled');
      return;
    }
    
    // Use project name (should be set from New Project or Open Project)
    if (!projectName) {
      alert('Please create a new project (File -> New Project) or open an existing project (File -> Open Project) first.');
      return;
    }
    
    // If we don't have auto-save directory/base name set up, set them up
    let dirHandleToUse = projectDirHandle;
    if (!dirHandleToUse) {
      // This only happens when opening a project (can't get directory from file handle)
      // Prompt user once to select the project directory
      const w = window as any;
      if (typeof w.showDirectoryPicker === 'function') {
        try {
          dirHandleToUse = await w.showDirectoryPicker();
          setProjectDirHandle(dirHandleToUse);
        } catch (e) {
          if ((e as any)?.name !== 'AbortError') {
            console.error('Failed to get directory:', e);
            alert('Failed to select project directory.');
          }
          return; // User cancelled
        }
      } else {
        alert('Directory picker is not supported in this browser.');
        return;
      }
    }
    
    // Use project directory for auto-save (same directory as project.json)
    setAutoSaveDirHandle(dirHandleToUse);
    // Use project name as base name for auto-save files
    const cleanBaseName = projectName.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    setAutoSaveBaseName(cleanBaseName);
    
    // Update refs immediately so performAutoSave can use them
    autoSaveDirHandleRef.current = dirHandleToUse;
    autoSaveBaseNameRef.current = cleanBaseName;
    
    // Set interval and enable auto-save
    setAutoSaveInterval(interval);
    setAutoSaveEnabled(true);
    
    // Mark that we have changes so initial save will happen
    hasChangesSinceLastAutoSaveRef.current = true;
    
    // Close dialog
    setAutoSaveDialog({ visible: false, interval: 5 });
    
    // Perform initial save immediately after state updates
    setTimeout(() => {
      console.log(`Auto save: Enabled with interval ${interval} minutes`);
      performAutoSave();
    }, 200);
  }, [autoSaveDialog.interval, projectName, projectDirHandle]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // FIRST: Handle Escape key for checkboxes/radio buttons before other checks
    if (e.key === 'Escape') {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && (
        (activeElement.tagName === 'INPUT' && (activeElement as HTMLInputElement).type === 'checkbox') ||
        (activeElement.tagName === 'INPUT' && (activeElement as HTMLInputElement).type === 'radio')
      )) {
        activeElement.blur();
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    
    // Check if user is typing in an input field, textarea, or contenteditable
    // This must be checked BEFORE any other keyboard shortcuts to allow normal typing
    // But exclude checkboxes and radio buttons (handled above for Escape, allow normal behavior for other keys)
    const activeElement = document.activeElement;
    if (activeElement && (
      (activeElement.tagName === 'INPUT' && 
       (activeElement as HTMLInputElement).type !== 'checkbox' && 
       (activeElement as HTMLInputElement).type !== 'radio') ||
      activeElement.tagName === 'TEXTAREA' ||
      (activeElement as HTMLElement).isContentEditable
    )) {
      // Allow all normal input field behavior - don't intercept any keys
      // This includes underscore, dash, and all other characters
      return;
    }
    
    // In read-only mode (viewing file history), only allow Zoom (Z key) shortcut
    // Check currentFileIndexRef to get the latest value without causing re-renders
    const isReadOnly = currentFileIndexRef.current > 0;
    
    // Allow Zoom (Z key) even in read-only mode
    if (isReadOnly && (e.key !== 'z' && e.key !== 'Z')) {
      // Block all other shortcuts in read-only mode
      return;
    }
    
    // Size change shortcuts: + and - keys
    if (e.key === '+' || e.key === '=') {
      // + key (or = key on keyboards where + requires Shift)
      e.preventDefault();
      e.stopPropagation();
      increaseSize();
      return;
    }
    if (e.key === '-' || e.key === '_') {
      // - key (or _ key on keyboards where - requires Shift)
      e.preventDefault();
      e.stopPropagation();
      decreaseSize();
      return;
    }
    
    // Detailed Information: Display properties of selected objects (Cmd+I / Ctrl+I)
    if (e.key === 'I' || e.key === 'i') {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        
        const debugInfo: string[] = [];
        
        // Check selected drawing strokes (vias, traces)
        if (selectedIds.size > 0) {
          // Drawing strokes are now displayed in formatted UI sections below
          // No need to add to debugInfo text
        }
        
        // Components, Power, and Ground symbols are now displayed in formatted UI sections below
        // No need to add to debugInfo text
        
        if (selectedIds.size === 0 && selectedComponentIds.size === 0 && selectedPowerIds.size === 0 && selectedGroundIds.size === 0) {
          debugInfo.push('\nNo objects selected.');
        }
        
        const debugText = debugInfo.join('\n');
        console.log(debugText);
        // Update dialog if already open, otherwise open it
        setDebugDialog({ visible: true, text: debugText });
        return;
      }
    }
    
    // Reset view and selection (O key)
    if (e.key === 'O' || e.key === 'o') {
      // Ignore if user is typing in an input field, textarea, or contenteditable
      // But allow shortcuts when focus is on checkboxes, radio buttons, or range sliders
      const active = document.activeElement as HTMLElement | null;
      const isEditing =
        !!active &&
        ((active.tagName === 'INPUT' && 
          (active as HTMLInputElement).type !== 'range' &&
          (active as HTMLInputElement).type !== 'checkbox' &&
          (active as HTMLInputElement).type !== 'radio') ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable);
      if (isEditing) {
        return; // Don't trigger shortcut when typing in input fields
      }
      
      e.preventDefault();
      e.stopPropagation();
      // Reset view settings
      setViewScale(1);
      // Don't reset image offsets - preserve their alignment
      // Only reset the view pan to center the images in the visible area
      // Center the image in the actual visible canvas area (excluding toolbar/layers overlay)
      // Get the canvas element's actual visible size and position on screen
      const canvas = canvasRef.current;
      const container = canvasContainerRef.current;
      let panX = 0;
      let panY = 0;
      if (canvas && container) {
        // Get the actual visible bounding rectangles
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const contentWidth = canvas.width - 2 * CONTENT_BORDER;
        const contentHeight = canvas.height - 2 * CONTENT_BORDER;
        
        // Toolbar and layers panel positions (absolute within container)
        // Toolbar: left: 6, width: 44
        // Layers panel: left: 56, width: 168
        const LAYERS_LEFT = 56;
        const LAYERS_WIDTH = 168;
        const LEFT_OVERLAY = LAYERS_LEFT + LAYERS_WIDTH + 6; // End of layers panel + gap (230px)
        
        // Calculate the visible area (canvas area not covered by toolbar/layers)
        // The canvas starts at the container's left edge, but the left portion is covered
        const canvasLeftOffset = canvasRect.left - containerRect.left; // Canvas position relative to container
        const visibleAreaStart = LEFT_OVERLAY - canvasLeftOffset; // Where visible area starts in canvas coordinates
        const visibleAreaWidth = canvasRect.width - Math.max(0, visibleAreaStart); // Visible width
        
        // The visible center is at: visibleAreaStart + visibleAreaWidth / 2 (in screen pixels)
        // But we need it relative to the canvas element's top-left
        const visibleCenterXScreen = visibleAreaStart + visibleAreaWidth / 2;
        const visibleCenterYScreen = canvasRect.height / 2; // Vertical center of canvas
        
        // Image center in canvas content coordinates
        const imageCenterX = contentWidth / 2;
        const imageCenterY = contentHeight / 2;
        
        // Convert visible center from screen pixels to canvas content coordinates
        const scaleX = canvasRect.width / canvas.width;
        const scaleY = canvasRect.height / canvas.height;
        
        // Visible center in canvas pixels (relative to canvas top-left)
        const visibleCenterXCanvas = visibleCenterXScreen / scaleX;
        const visibleCenterYCanvas = visibleCenterYScreen / scaleY;
        
        // Convert to content coordinates (after CONTENT_BORDER offset)
        const visibleCenterContentX = visibleCenterXCanvas - CONTENT_BORDER;
        const visibleCenterContentY = visibleCenterYCanvas - CONTENT_BORDER;
        
        // Pan to align image center with visible center
        panX = visibleCenterContentX - imageCenterX;
        panY = visibleCenterContentY - imageCenterY;
      }
      // Reset browser zoom to 100%
      if (document.body) {
        document.body.style.zoom = '1';
      }
      if (document.documentElement) {
        document.documentElement.style.zoom = '1';
      }
      setViewPan({ x: panX, y: panY });
      setCurrentView('overlay');
      // Clear all selections
      setSelectedIds(new Set());
      setSelectedComponentIds(new Set());
      setSelectedPowerIds(new Set());
      setSelectedGroundIds(new Set());
      // Set tool to Select
      setCurrentTool('select');
      return;
    }
    
    // Option/Alt key: Disable snap-to while drawing
    if (e.key === 'Alt' || e.altKey) {
      setIsSnapDisabled(true);
    }
    
    // Escape key: Always return to Select tool (checkbox/radio blur handled at start of function)
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      // Switch to Select tool
      setCurrentTool('select');
      // Close any open choosers/dialogs
      setShowTraceLayerChooser(false);
      setShowPadLayerChooser(false);
      setShowComponentLayerChooser(false);
      setShowComponentTypeChooser(false);
      setShowPowerBusSelector(false);
      setShowColorPicker(false);
      // Clear any pending component position
      setPendingComponentPosition(null);
      return;
    }
    // Finalize an in-progress trace with Enter/Return
    if ((e.key === 'Enter') && currentTool === 'draw' && drawingMode === 'trace') {
      finalizeTraceIfAny();
      return;
    }
    // Delete selected items (strokes, components, power nodes, ground nodes)
    if ((e.key === 'Delete' || e.key === 'Backspace') && (selectedIds.size > 0 || selectedComponentIds.size > 0 || selectedPowerIds.size > 0 || selectedGroundIds.size > 0)) {
      e.preventDefault();
      e.stopPropagation();
      
      // Handle each type independently so one locked type doesn't prevent deleting others
      if (selectedIds.size > 0) {
        // Filter out locked vias and traces
        const selectedStrokes = drawingStrokes.filter(s => selectedIds.has(s.id));
        const hasLockedVias = areViasLocked && selectedStrokes.some(s => s.type === 'via');
        const hasLockedTraces = areTracesLocked && selectedStrokes.some(s => s.type === 'trace');
        const hasLockedPads = arePadsLocked && selectedStrokes.some(s => s.type === 'pad');
        if (hasLockedVias) {
          alert('Cannot delete: Vias are locked. Unlock vias to delete them.');
        } else if (hasLockedTraces) {
          alert('Cannot delete: Traces are locked. Unlock traces to delete them.');
        } else if (hasLockedPads) {
          alert('Cannot delete: Pads are locked. Unlock pads to delete them.');
        } else {
          setDrawingStrokes(prev => prev.filter(s => !selectedIds.has(s.id)));
          setSelectedIds(new Set());
        }
      }
      if (selectedComponentIds.size > 0) {
        // Don't delete if components are locked
        if (areComponentsLocked) {
          alert('Cannot delete: Components are locked. Unlock components to delete them.');
        } else {
          setComponentsTop(prev => prev.filter(c => !selectedComponentIds.has(c.id)));
          setComponentsBottom(prev => prev.filter(c => !selectedComponentIds.has(c.id)));
          setSelectedComponentIds(new Set());
        }
      }
      if (selectedPowerIds.size > 0) {
        // Don't delete if power nodes are locked
        if (arePowerNodesLocked) {
          alert('Cannot delete: Power nodes are locked. Unlock power nodes to delete them.');
        } else {
          setPowers(prev => prev.filter(p => !selectedPowerIds.has(p.id)));
          setSelectedPowerIds(new Set());
        }
      }
      if (selectedGroundIds.size > 0) {
        // Don't delete if ground is locked
        if (areGroundNodesLocked) {
          alert('Cannot delete: Ground nodes are locked. Unlock ground nodes to delete them.');
        } else {
          setGrounds(prev => prev.filter(g => !selectedGroundIds.has(g.id)));
          setSelectedGroundIds(new Set());
        }
      }
      return;
    }
    // Drawing undo: Cmd/Ctrl+Z removes last stroke on the selected layer
    // Also handles Power and Ground tool undo
    // Only handle undo keys here; let other keys pass through to tool shortcuts
    if ((currentTool === 'draw' || currentTool === 'erase' || currentTool === 'power' || currentTool === 'ground') && 
        (e.key === 'z' || e.key === 'Z') && 
        (e.metaKey || e.ctrlKey) && 
        !e.shiftKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      
      // Power tool undo: remove last power symbol in reverse order
      if (currentTool === 'power') {
        setPowers(prev => {
          if (prev.length === 0) return prev;
          return prev.slice(0, -1); // Remove last power symbol
        });
        return;
      }
      
      // Ground tool undo: remove last ground symbol in reverse order
      if (currentTool === 'ground') {
        setGrounds(prev => {
          if (prev.length === 0) return prev;
          return prev.slice(0, -1); // Remove last ground symbol
        });
        return;
      }
      
      // Special handling for trace mode: undo last segment instead of entire trace
      if (currentTool === 'draw' && drawingMode === 'trace') {
          // ALWAYS check in-progress trace first (most recent action)
          // Check both state (source of truth) and ref (backup) to catch all cases
          const statePoints = currentStroke;
          const refPoints = currentStrokeRef.current;
          // Prefer state (source of truth), but use ref if state is empty (handles timing edge cases)
          const inProgressPoints = statePoints.length > 0 ? statePoints : refPoints;
          
          // If a trace is in progress, remove the last point (undo last segment)
          // This is the most recent action, so it takes priority over completed traces
          if (inProgressPoints.length > 0) {
            if (inProgressPoints.length > 1) {
              // Remove last point, keeping the trace in progress
              setCurrentStroke(prev => prev.slice(0, -1));
            } else {
              // Only one point left, cancel the trace
              setCurrentStroke([]);
            }
            return;
          }
          
          // No trace in progress - find the MOST RECENT completed trace (last in array)
          // and remove its last segment, then restore it to currentStroke so user can continue
          setDrawingStrokes(prev => {
            // Search backwards from the end to find the most recent trace
            for (let i = prev.length - 1; i >= 0; i--) {
              const s = prev[i];
              // Check if it's a trace on the current layer
              if (s.type === 'trace' && s.layer === selectedDrawingLayer && s.points.length >= 2) {
                if (s.points.length > 2) {
                  // Remove last point (undo last segment)
                  const remainingPoints = s.points.slice(0, -1);
                  // Restore the remaining points to currentStroke so user can continue drawing
                  // Remove the trace from drawingStrokes since it's now back in currentStroke
                  setCurrentStroke(remainingPoints);
                  return [...prev.slice(0, i), ...prev.slice(i + 1)];
                } else {
                  // Only 2 points left (one segment), remove entire trace
                  return [...prev.slice(0, i), ...prev.slice(i + 1)];
                }
              }
            }
            return prev;
          });
          return;
        }
        
        // For vias and other tools: remove last point if in progress, or remove entire stroke
        if (isDrawing && currentStroke.length > 0) {
          setCurrentStroke([]);
          return;
        }
        
        // Remove the last stroke of the current type on the selected layer
        if (currentTool === 'draw' && (drawingMode === 'via' || drawingMode === 'pad')) {
          setDrawingStrokes(prev => {
            for (let i = prev.length - 1; i >= 0; i--) {
              const s = prev[i];
              if (s.layer === selectedDrawingLayer && s.type === drawingMode) {
                return [...prev.slice(0, i), ...prev.slice(i + 1)];
              }
            }
            return prev;
          });
        } else if (currentTool === 'erase') {
        }
        return;
      }

    // Toolbar tool shortcuts (no modifiers; ignore when typing in inputs/textareas/contenteditable)
    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      // Ignore if user is typing in an input field, textarea, or contenteditable
      // But allow shortcuts when focus is on checkboxes, radio buttons, or range sliders
      const active = document.activeElement as HTMLElement | null;
      const isEditing =
        !!active &&
        ((active.tagName === 'INPUT' && 
          (active as HTMLInputElement).type !== 'range' &&
          (active as HTMLInputElement).type !== 'checkbox' &&
          (active as HTMLInputElement).type !== 'radio') ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable);
      if (!isEditing) {
        switch (e.key) {
          case 's':
          case 'S':
            e.preventDefault();
            setCurrentTool('select');
            return;
          case 'w':
          case 'W':
            e.preventDefault();
            setCurrentTool('power');
            return;
          case 'g':
          case 'G':
            e.preventDefault();
            setCurrentTool('ground');
            return;
          case 'v':
          case 'V':
            e.preventDefault();
            setDrawingMode('via');
            setCurrentTool('draw');
            // The useEffect hook will load via tool settings automatically
            return;
          case 'p':
          case 'P':
            e.preventDefault();
            setDrawingMode('pad');
            setCurrentTool('draw');
            // Default to Top layer, but use last choice if available
            const padLayerToUse = padToolLayer || 'top';
            setSelectedDrawingLayer(padLayerToUse);
            // The useEffect hook will load pad tool settings automatically
            setShowPadLayerChooser(true);
            return;
          case 't':
          case 'T':
            e.preventDefault();
            setDrawingMode('trace');
            setCurrentTool('draw');
            // Default to Top layer, but use last choice if available
            const layerToUse = traceToolLayer || 'top';
            setSelectedDrawingLayer(layerToUse);
            // The useEffect hook will load trace tool settings automatically
            setShowTraceLayerChooser(true);
            return;
          case 'c':
          case 'C':
            e.preventDefault();
            setCurrentTool('component');
            // Use current global layer setting (selectedDrawingLayer is the source of truth)
            // Show layer chooser first (like trace/pad pattern)
            setShowComponentLayerChooser(true);
            setShowComponentTypeChooser(false);
            setSelectedComponentType(null);
            return;
          case 'e':
          case 'E':
            e.preventDefault();
            setCurrentTool('erase');
            return;
          case 'h':
          case 'H':
            e.preventDefault();
            setCurrentTool('pan');
            return;
          case 'z':
          case 'Z':
            // If not Cmd/Ctrl+Z (handled above), select Zoom tool (default to zoom-in)
            if (!(e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              setIsShiftPressed(false);
              setCurrentTool('magnify');
              return;
            }
            break;
        }
      }
    }

    // Check if we're in transform mode with an image selected
    if (currentTool === 'transform' && selectedImageForTransform) {
      // Only handle arrow keys in transform mode; let other keys pass through for tool shortcuts
      const isArrowKey = e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown';
      
      if (!isArrowKey) {
        // Not an arrow key - let it pass through to tool shortcuts
        return;
      }

      // Prevent default and stop propagation for arrow keys so focused radios/sliders don't consume them
      e.preventDefault();
      e.stopPropagation();

      // If a radio input has focus, blur it so arrows won't switch selection
      const active = document.activeElement as HTMLElement | null;
      if (active && active.tagName === 'INPUT') {
        const input = active as HTMLInputElement;
        if (input.type === 'radio') {
          input.blur();
        }
      }

      if (transformMode === 'nudge') {
        // Nudging: single pixel movement
        let deltaX = 0;
        let deltaY = 0;

        switch (e.key) {
          case 'ArrowLeft':
            deltaX = -1;
            break;
          case 'ArrowRight':
            deltaX = 1;
            break;
          case 'ArrowUp':
            deltaY = -1;
            break;
          case 'ArrowDown':
            deltaY = 1;
            break;
          default:
            return;
        }

        if (selectedImageForTransform === 'top' && topImage) {
          setTopImage(prev => prev ? {
            ...prev,
            x: prev.x + deltaX,
            y: prev.y + deltaY
          } : null);
        } else if (selectedImageForTransform === 'bottom' && bottomImage) {
          setBottomImage(prev => prev ? {
            ...prev,
            x: prev.x + deltaX,
            y: prev.y + deltaY
          } : null);
        } else if (selectedImageForTransform === 'both') {
          // Apply to both images
          if (topImage) {
            setTopImage(prev => prev ? {
              ...prev,
              x: prev.x + deltaX,
              y: prev.y + deltaY
            } : null);
          }
          if (bottomImage) {
            setBottomImage(prev => prev ? {
              ...prev,
              x: prev.x + deltaX,
              y: prev.y + deltaY
            } : null);
          }
        }
      } else if (transformMode === 'scale') {
        // Scaling: 1% for up/down, 0.1% for left/right
        let scaleDelta = 0;

        switch (e.key) {
          case 'ArrowUp':
            scaleDelta = 0.01; // Increase by 1%
            break;
          case 'ArrowDown':
            scaleDelta = -0.01; // Decrease by 1%
            break;
          case 'ArrowRight':
            scaleDelta = 0.001; // Increase by 0.1%
            break;
          case 'ArrowLeft':
            scaleDelta = -0.001; // Decrease by 0.1%
            break;
          default:
            return;
        }

        if (selectedImageForTransform === 'top' && topImage) {
          setTopImage(prev => prev ? {
            ...prev,
            scale: Math.max(0.1, Math.min(3, prev.scale + scaleDelta))
          } : null);
        } else if (selectedImageForTransform === 'bottom' && bottomImage) {
          setBottomImage(prev => prev ? {
            ...prev,
            scale: Math.max(0.1, Math.min(3, prev.scale + scaleDelta))
          } : null);
        } else if (selectedImageForTransform === 'both') {
          // Apply to both images
          if (topImage) {
            setTopImage(prev => prev ? {
              ...prev,
              scale: Math.max(0.1, Math.min(3, prev.scale + scaleDelta))
            } : null);
          }
          if (bottomImage) {
            setBottomImage(prev => prev ? {
              ...prev,
              scale: Math.max(0.1, Math.min(3, prev.scale + scaleDelta))
            } : null);
          }
        }
      } else if (transformMode === 'rotate') {
        // Rotation: 1 degree for up/down, 0.1 degree for left/right
        let rotationDelta = 0;

        switch (e.key) {
          case 'ArrowUp':
            rotationDelta = 1; // Increase by 1 degree
            break;
          case 'ArrowDown':
            rotationDelta = -1; // Decrease by 1 degree
            break;
          case 'ArrowRight':
            rotationDelta = 0.1; // Increase by 0.1 degree
            break;
          case 'ArrowLeft':
            rotationDelta = -0.1; // Decrease by 0.1 degree
            break;
          default:
            return;
        }

        if (selectedImageForTransform === 'top' && topImage) {
          setTopImage(prev => prev ? {
            ...prev,
            rotation: prev.rotation + rotationDelta
          } : null);
        } else if (selectedImageForTransform === 'bottom' && bottomImage) {
          setBottomImage(prev => prev ? {
            ...prev,
            rotation: prev.rotation + rotationDelta
          } : null);
        } else if (selectedImageForTransform === 'both') {
          // Apply to both images
          if (topImage) {
            setTopImage(prev => prev ? {
              ...prev,
              rotation: prev.rotation + rotationDelta
            } : null);
          }
          if (bottomImage) {
            setBottomImage(prev => prev ? {
              ...prev,
              rotation: prev.rotation + rotationDelta
            } : null);
          }
        }
      } else if (transformMode === 'slant') {
        // Keystone (skew): Up/Down adjust vertical skew, Left/Right adjust horizontal; all at ±0.5°
        let skewXDeltaDeg = 0; // horizontal shear
        let skewYDeltaDeg = 0; // vertical shear

        switch (e.key) {
          case 'ArrowUp':
            skewYDeltaDeg = -0.5;
            break;
          case 'ArrowDown':
            skewYDeltaDeg = 0.5;
            break;
          case 'ArrowLeft':
            skewXDeltaDeg = -0.5;
            break;
          case 'ArrowRight':
            skewXDeltaDeg = 0.5;
            break;
          default:
            break;
        }

        if (skewXDeltaDeg !== 0 || skewYDeltaDeg !== 0) {
          const toRad = (deg: number) => (deg * Math.PI) / 180;
          const clamp = (v: number) => Math.max(-0.7, Math.min(0.7, v)); // clamp to ~±40° to avoid extremes
          if (selectedImageForTransform === 'top' && topImage) {
            setTopImage(prev => prev ? {
              ...prev,
              skewX: clamp((prev.skewX || 0) + toRad(skewXDeltaDeg)),
              skewY: clamp((prev.skewY || 0) + toRad(skewYDeltaDeg)),
            } : null);
          } else if (selectedImageForTransform === 'bottom' && bottomImage) {
            setBottomImage(prev => prev ? {
              ...prev,
              skewX: clamp((prev.skewX || 0) + toRad(skewXDeltaDeg)),
              skewY: clamp((prev.skewY || 0) + toRad(skewYDeltaDeg)),
            } : null);
          } else if (selectedImageForTransform === 'both') {
            // Apply to both images
            if (topImage) {
              setTopImage(prev => prev ? {
                ...prev,
                skewX: clamp((prev.skewX || 0) + toRad(skewXDeltaDeg)),
                skewY: clamp((prev.skewY || 0) + toRad(skewYDeltaDeg)),
              } : null);
            }
            if (bottomImage) {
              setBottomImage(prev => prev ? {
                ...prev,
                skewX: clamp((prev.skewX || 0) + toRad(skewXDeltaDeg)),
                skewY: clamp((prev.skewY || 0) + toRad(skewYDeltaDeg)),
              } : null);
            }
          }
        }
      } else if (transformMode === 'keystone') {
        // Perspective-like keystone: Up/Down = vertical keystone, Left/Right = horizontal keystone; ±0.5°
        let kHDeltaDeg = 0; // horizontal keystone
        let kVDeltaDeg = 0; // vertical keystone

        switch (e.key) {
          case 'ArrowUp':
            kVDeltaDeg = -0.5;
            break;
          case 'ArrowDown':
            kVDeltaDeg = 0.5;
            break;
          case 'ArrowLeft':
            kHDeltaDeg = -0.5;
            break;
          case 'ArrowRight':
            kHDeltaDeg = 0.5;
            break;
          default:
            break;
        }

        if (kHDeltaDeg !== 0 || kVDeltaDeg !== 0) {
          const toRad = (deg: number) => (deg * Math.PI) / 180;
          const clamp = (v: number) => Math.max(-0.35, Math.min(0.35, v)); // clamp to ~±20° to avoid extremes
          if (selectedImageForTransform === 'top' && topImage) {
            setTopImage(prev => prev ? {
              ...prev,
              keystoneH: clamp((prev.keystoneH || 0) + toRad(kHDeltaDeg)),
              keystoneV: clamp((prev.keystoneV || 0) + toRad(kVDeltaDeg)),
            } : null);
          } else if (selectedImageForTransform === 'bottom' && bottomImage) {
            setBottomImage(prev => prev ? {
              ...prev,
              keystoneH: clamp((prev.keystoneH || 0) + toRad(kHDeltaDeg)),
              keystoneV: clamp((prev.keystoneV || 0) + toRad(kVDeltaDeg)),
            } : null);
          } else if (selectedImageForTransform === 'both') {
            // Apply to both images
            if (topImage) {
              setTopImage(prev => prev ? {
                ...prev,
                keystoneH: clamp((prev.keystoneH || 0) + toRad(kHDeltaDeg)),
                keystoneV: clamp((prev.keystoneV || 0) + toRad(kVDeltaDeg)),
              } : null);
            }
            if (bottomImage) {
              setBottomImage(prev => prev ? {
                ...prev,
                keystoneH: clamp((prev.keystoneH || 0) + toRad(kHDeltaDeg)),
                keystoneV: clamp((prev.keystoneV || 0) + toRad(kVDeltaDeg)),
              } : null);
            }
          }
        }
      }
    } else {
      // Handle slider controls with arrow keys
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'range') {
        const slider = target as HTMLInputElement;
        const currentValue = Number(slider.value);
        const min = Number(slider.min);
        const max = Number(slider.max);
        const step = Number(slider.step) || 1;

        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            const newValueLeft = Math.max(min, currentValue - step);
            slider.value = newValueLeft.toString();
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            break;
          case 'ArrowRight':
            e.preventDefault();
            const newValueRight = Math.min(max, currentValue + step);
            slider.value = newValueRight.toString();
            slider.dispatchEvent(new Event('input', { bubbles: true }));
            break;
        }
      }
    }
  }, [currentTool, selectedImageForTransform, transformMode, topImage, bottomImage, selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, drawingStrokes, componentsTop, componentsBottom, powers, grounds, powerBuses, drawingMode, finalizeTraceIfAny, traceToolLayer, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize]);

  // Clear image selection when switching away from transform tool
  React.useEffect(() => {
    if (currentTool !== 'transform') {
      setSelectedImageForTransform(null);
    }
  }, [currentTool]);

  // Add keyboard event listener for arrow keys
  React.useEffect(() => {
    // Use capture to intercept before default handling on focused controls (e.g., radios)
    window.addEventListener('keydown', handleKeyDown, true);
    const onKeyUp = (e: KeyboardEvent) => {
      // Option/Alt key released: Re-enable snap-to
      if (e.key === 'Alt') {
        setIsSnapDisabled(false);
      }
    };
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [handleKeyDown, selectedPowerIds, selectedGroundIds, arePowerNodesLocked, areGroundNodesLocked, powers, grounds, increaseSize, decreaseSize]);

  // Consolidated initialization function - sets all application defaults
  // This is used on app startup, browser refresh, and when creating a new project
  const initializeApplicationDefaults = useCallback(() => {
    // Reset trace colors and sizes to defaults
    setTopTraceColor('#AA4499');
    setBottomTraceColor('#F781BF');
    setTopTraceSize(6);
    setBottomTraceSize(6);
    // Save trace defaults to localStorage
    saveDefaultColor('trace', '#AA4499', 'top');
    saveDefaultColor('trace', '#F781BF', 'bottom');
    saveDefaultSize('trace', 6, 'top');
    saveDefaultSize('trace', 6, 'bottom');
    // Reset pad colors and sizes to defaults
    setTopPadColor('#0072B2');
    setBottomPadColor('#56B4E9');
    setTopPadSize(26);
    setBottomPadSize(26);
    // Save pad defaults to localStorage
    saveDefaultColor('pad', '#0072B2', 'top');
    saveDefaultColor('pad', '#56B4E9', 'bottom');
    saveDefaultSize('pad', 26, 'top');
    saveDefaultSize('pad', 26, 'bottom');
    // Reset component colors and sizes to defaults
    setTopComponentColor('#6A3D9A');
    setBottomComponentColor('#9467BD');
    setTopComponentSize(18);
    setBottomComponentSize(18);
    // Save component defaults to localStorage
    saveDefaultColor('component', '#6A3D9A', 'top');
    saveDefaultColor('component', '#9467BD', 'bottom');
    saveDefaultSize('component', 18, 'top');
    saveDefaultSize('component', 18, 'bottom');
    setTraceToolLayer('top'); // Reset to top layer
    // Set brush color and size to match top layer trace defaults
    setBrushColor('#AA4499');
    setBrushSize(6);
    // Reset power buses to defaults
    setPowerBuses([
      { id: 'powerbus-1', name: '+3.3VDC', voltage: '+3.3VDC', color: '#ff0000' },
      { id: 'powerbus-2', name: '+5VDC', voltage: '+5VDC', color: '#ff0000' },
    ]);
    // Reset locks
    setAreImagesLocked(false);
    setAreViasLocked(false);
    setAreTracesLocked(false);
    setAreComponentsLocked(false);
    setAreGroundNodesLocked(false);
    setArePowerNodesLocked(false);
    // Reset view and tool settings
    setSelectedDrawingLayer('top');
    setCurrentTool('select');
    setTransparency(50);
    setIsTransparencyCycling(false);
    setCurrentView('overlay');
    // Reset point ID counter
    setPointIdCounter(1);
  }, [saveDefaultColor, saveDefaultSize]);

  // Initialize application with default keyboard shortcuts (o and s)
  // This function performs the same initialization as when the app first loads
  const initializeApplication = useCallback(() => {
    // First, set all defaults
    initializeApplicationDefaults();
    // Use setTimeout to ensure DOM is ready and refs are available
    setTimeout(() => {
      // Execute 'o' shortcut: Reset view and selection
      setViewScale(1);
      const canvas = canvasRef.current;
      const container = canvasContainerRef.current;
      let panX = 0;
      let panY = 0;
      if (canvas && container) {
        // Get the actual visible bounding rectangles
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const contentWidth = canvas.width - 2 * CONTENT_BORDER;
        const contentHeight = canvas.height - 2 * CONTENT_BORDER;
        
        // Toolbar and layers panel positions (absolute within container)
        // Toolbar: left: 6, width: 44
        // Layers panel: left: 56, width: 168
        const LAYERS_LEFT = 56;
        const LAYERS_WIDTH = 168;
        const LEFT_OVERLAY = LAYERS_LEFT + LAYERS_WIDTH + 6; // End of layers panel + gap (230px)
        
        // Calculate the visible area (canvas area not covered by toolbar/layers)
        // The canvas starts at the container's left edge, but the left portion is covered
        const canvasLeftOffset = canvasRect.left - containerRect.left; // Canvas position relative to container
        const visibleAreaStart = LEFT_OVERLAY - canvasLeftOffset; // Where visible area starts in canvas coordinates
        const visibleAreaWidth = canvasRect.width - Math.max(0, visibleAreaStart); // Visible width
        
        // The visible center is at: visibleAreaStart + visibleAreaWidth / 2 (in screen pixels)
        // But we need it relative to the canvas element's top-left
        const visibleCenterXScreen = visibleAreaStart + visibleAreaWidth / 2;
        const visibleCenterYScreen = canvasRect.height / 2; // Vertical center of canvas
        
        // Image center in canvas content coordinates
        const imageCenterX = contentWidth / 2;
        const imageCenterY = contentHeight / 2;
        
        // Convert visible center from screen pixels to canvas content coordinates
        const scaleX = canvasRect.width / canvas.width;
        const scaleY = canvasRect.height / canvas.height;
        
        // Visible center in canvas pixels (relative to canvas top-left)
        const visibleCenterXCanvas = visibleCenterXScreen / scaleX;
        const visibleCenterYCanvas = visibleCenterYScreen / scaleY;
        
        // Convert to content coordinates (after CONTENT_BORDER offset)
        const visibleCenterContentX = visibleCenterXCanvas - CONTENT_BORDER;
        const visibleCenterContentY = visibleCenterYCanvas - CONTENT_BORDER;
        
        // Pan to align image center with visible center
        panX = visibleCenterContentX - imageCenterX;
        panY = visibleCenterContentY - imageCenterY;
      }
      // Reset browser zoom to 100%
      if (document.body) {
        document.body.style.zoom = '1';
      }
      if (document.documentElement) {
        document.documentElement.style.zoom = '1';
      }
      setViewPan({ x: panX, y: panY });
      // Clear all selections
      setSelectedIds(new Set());
      setSelectedComponentIds(new Set());
      setSelectedPowerIds(new Set());
      setSelectedGroundIds(new Set());
    }, 100); // Small delay to ensure DOM is ready
  }, [initializeApplicationDefaults]);

  // Initialize application on first load
  React.useEffect(() => {
    initializeApplication();
  }, []); // Run only once on mount


  // Update debug dialog when selection changes (if dialog is open)
  React.useEffect(() => {
    if (!debugDialog.visible) return;
    
    const debugInfo: string[] = [];
    
    // Check selected drawing strokes (vias, traces)
    if (selectedIds.size > 0) {
      // Drawing strokes are now displayed in formatted UI sections below
      // No need to add to debugInfo text
    }
    
    // Components, Power, and Ground symbols are now displayed in formatted UI sections below
    // No need to add to debugInfo text
    
    if (selectedIds.size === 0 && selectedComponentIds.size === 0 && selectedPowerIds.size === 0 && selectedGroundIds.size === 0) {
      debugInfo.push('\nNo objects selected.');
    }
    
    const debugText = debugInfo.join('\n');
    setDebugDialog(prev => ({ ...prev, text: debugText }));
  }, [debugDialog.visible, selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, drawingStrokes, componentsTop, componentsBottom, powers, grounds, powerBuses]);

  // Finalize trace when clicking outside the canvas (e.g., menus, tools, layer panel)
  React.useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      // If click originated on the canvas, ignore (canvas handlers will manage)
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Don't close component layer chooser if click is on the chooser itself
      if (componentLayerChooserRef.current && componentLayerChooserRef.current.contains(e.target as Node)) {
        return;
      }
      if (e.target instanceof Node && canvas.contains(e.target)) return;
      // Otherwise, finalize any in-progress trace
      finalizeTraceIfAny();
      // Also hide tool layer choosers when clicking anywhere outside them
      if (showTraceLayerChooser) {
        const el = traceChooserRef.current;
        if (!el || !(e.target instanceof Node) || !el.contains(e.target)) {
          setShowTraceLayerChooser(false);
        }
      }
      if (showComponentLayerChooser) {
        const el2 = componentLayerChooserRef.current;
        if (!el2 || !(e.target instanceof Node) || !el2.contains(e.target)) {
          setShowComponentLayerChooser(false);
          // Switch back to select tool if layer chooser is closed
          setCurrentTool('select');
        }
      }
      if (showComponentTypeChooser) {
        const el3 = componentTypeChooserRef.current;
        if (!el3 || !(e.target instanceof Node) || !el3.contains(e.target)) {
          setShowComponentTypeChooser(false);
          setPendingComponentPosition(null);
        }
      }
      // Close color picker when clicking outside it
      if (showColorPicker) {
        const colorPickerEl = colorPickerRef.current;
        const colorPickerButton = (e.target as HTMLElement)?.closest('button[title="Color Picker"]');
        if (!colorPickerButton && (!colorPickerEl || !(e.target instanceof Node) || !colorPickerEl.contains(e.target))) {
          setShowColorPicker(false);
        }
      }
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    return () => document.removeEventListener('mousedown', onDocMouseDown, true);
  }, [finalizeTraceIfAny, showTraceLayerChooser, showPadLayerChooser, showComponentLayerChooser, showComponentTypeChooser, showColorPicker]);

  // Document-level handler for pin connections (works even when dialog is open)
  React.useEffect(() => {
    const handlePinConnectionClick = (e: MouseEvent) => {
      // Only handle if we're in pin connection mode
      if (!connectingPin) return;
      
      // Don't handle if clicking on the component editor dialog content
      const dialogElement = document.querySelector('[data-component-editor-dialog]');
      if (dialogElement && e.target instanceof Node && dialogElement.contains(e.target)) {
        // Check if it's a button or input - allow those to work normally
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input')) {
          return; // Let the dialog handle its own buttons/inputs
        }
        // If clicking on dialog background, allow it to pass through
      }
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX;
      const clickY = e.clientY;
      
      // Check if click is within canvas bounds
      if (clickX < rect.left || clickX > rect.right || clickY < rect.top || clickY > rect.bottom) {
        return; // Click outside canvas
      }
      
      // Convert click coordinates to canvas coordinates
      const dprX = canvas.width / rect.width;
      const dprY = canvas.height / rect.height;
      const cssX = clickX - rect.left;
      const cssY = clickY - rect.top;
      const canvasX = cssX * dprX;
      const canvasY = cssY * dprY;
      const contentCanvasX = canvasX - CONTENT_BORDER;
      const contentCanvasY = canvasY - CONTENT_BORDER;
      const x = (contentCanvasX - viewPan.x) / viewScale;
      const y = (contentCanvasY - viewPan.y) / viewScale;
      
      // Find nearest via or pad
      let bestDist = Infinity;
      let bestPointId: number | null = null;
      let bestStroke: DrawingStroke | null = null;
      const hitTolerance = Math.max(6 / viewScale, 4);
      
      // Get the component's layer to enforce layer constraint
      const component = [...componentsTop, ...componentsBottom].find(c => c.id === connectingPin.componentId);
      const componentLayer = component?.layer || 'top';
      
      for (const s of drawingStrokes) {
        if ((s.type === 'via' || s.type === 'pad') && s.points.length > 0) {
          // Vias can be connected from any layer (they connect both layers)
          // Pads can only be connected if they're on the same layer as the component
          if (s.type === 'pad') {
            const padLayer = s.layer || 'top';
            if (padLayer !== componentLayer) {
              continue; // Skip pads on different layers
            }
          }
          
          const c = s.points[0];
          const radius = Math.max(1, s.size / 2);
          const d = Math.hypot(c.x - x, c.y - y);
          const hitDistance = Math.max(radius, hitTolerance);
          if (d <= hitDistance && d < bestDist) {
            bestDist = d;
            bestPointId = c.id ?? null;
            bestStroke = s;
          }
        }
      }
      
      if (bestPointId !== null && bestPointId !== undefined && bestStroke) {
        console.log(`\n[PIN CONNECTION - DOCUMENT HANDLER] Found via!`);
        console.log(`  Point ID: ${bestPointId}`);
        console.log(`  Connecting pin ${connectingPin.pinIndex + 1} of component ${connectingPin.componentId}`);
        
        const pointIdString = String(bestPointId);
        const pinIndex = connectingPin.pinIndex;
        const componentId = connectingPin.componentId;
        
        // Find which layer the component is on
        const compTop = componentsTop.find(c => c.id === componentId);
        const compBottom = componentsBottom.find(c => c.id === componentId);
        
        if (compTop) {
          setComponentsTop(prev => {
            const comp = prev.find(c => c.id === componentId);
            if (!comp) return prev;
            
            // Always create a fresh copy of the pinConnections array to avoid reference issues
            const existingConnections = comp.pinConnections || [];
            const currentConnections = existingConnections.length > 0 
              ? [...existingConnections] 
              : new Array(comp.pinCount).fill('');
            
            // Ensure array is correct size
            let newPinConnections: string[];
            if (currentConnections.length !== comp.pinCount) {
              newPinConnections = new Array(comp.pinCount).fill('');
              for (let i = 0; i < Math.min(currentConnections.length, comp.pinCount); i++) {
                newPinConnections[i] = currentConnections[i] || '';
              }
            } else {
              // Create a fresh copy to avoid mutating the original
              newPinConnections = [...currentConnections];
            }
            
            // Update the specific pin connection
            newPinConnections[pinIndex] = pointIdString;
            
            console.log(`Updated pin ${pinIndex} with value: ${pointIdString}`);
            console.log(`New pinConnections:`, newPinConnections);
            
            return prev.map(c => c.id === componentId ? { ...c, pinConnections: newPinConnections } : c);
          });
        } else if (compBottom) {
          setComponentsBottom(prev => {
            const comp = prev.find(c => c.id === componentId);
            if (!comp) return prev;
            
            // Always create a fresh copy of the pinConnections array to avoid reference issues
            const existingConnections = comp.pinConnections || [];
            const currentConnections = existingConnections.length > 0 
              ? [...existingConnections] 
              : new Array(comp.pinCount).fill('');
            
            // Ensure array is correct size
            let newPinConnections: string[];
            if (currentConnections.length !== comp.pinCount) {
              newPinConnections = new Array(comp.pinCount).fill('');
              for (let i = 0; i < Math.min(currentConnections.length, comp.pinCount); i++) {
                newPinConnections[i] = currentConnections[i] || '';
              }
            } else {
              // Create a fresh copy to avoid mutating the original
              newPinConnections = [...currentConnections];
            }
            
            // Update the specific pin connection
            newPinConnections[pinIndex] = pointIdString;
            
            console.log(`Updated pin ${pinIndex} with value: ${pointIdString}`);
            console.log(`New pinConnections:`, newPinConnections);
            
            return prev.map(c => c.id === componentId ? { ...c, pinConnections: newPinConnections } : c);
          });
        }
        
        // Clear pin connection mode
        setTimeout(() => {
          setConnectingPin(null);
        }, 0);
      } else {
        console.log(`[PIN CONNECTION - DOCUMENT HANDLER] No via found at click location`);
      }
    };
    
    if (connectingPin) {
      // Use capture phase to catch clicks before they're blocked by dialog
      document.addEventListener('mousedown', handlePinConnectionClick, true);
      return () => document.removeEventListener('mousedown', handlePinConnectionClick, true);
    }
  }, [connectingPin, componentsTop, componentsBottom, drawingStrokes, viewScale, viewPan.x, viewPan.y]);

  // Handle component dialog dragging
  React.useEffect(() => {
    if (!isDraggingDialog) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dialogDragOffset) return;
      setComponentDialogPosition({
        x: e.clientX - dialogDragOffset.x,
        y: e.clientY - dialogDragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDraggingDialog(false);
      setDialogDragOffset(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDialog, dialogDragOffset]);

  // Initialize dialog position when it opens (center of screen)
  React.useEffect(() => {
    if (componentEditor && componentEditor.visible && componentDialogPosition === null) {
      setComponentDialogPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
    } else if (!componentEditor || !componentEditor.visible) {
      // Reset position when dialog closes
      setComponentDialogPosition(null);
    }
  }, [componentEditor, componentDialogPosition]);

  // Double-click reset function for sliders
  const handleSliderDoubleClick = useCallback((sliderType: string) => {
    switch (sliderType) {
      case 'transparency':
        setTransparency(50);
        break;
      case 'brushSize':
        setBrushSize(3);
        break;
    }
  }, []);

  // Transparency auto-cycle (0% → 100% → 0%) with 1s period while checked
  React.useEffect(() => {
    if (isTransparencyCycling) {
      transparencyCycleStartRef.current = performance.now();
      setTransparency(0);
      const tick = (now: number) => {
        const start = transparencyCycleStartRef.current || now;
        const periodMs = 1000;
        const phase = ((now - start) % periodMs) / periodMs; // 0..1
        const tri = 1 - Math.abs(1 - 2 * phase); // 0→1→0 over 1s
        setTransparency(Math.round(tri * 100));
        transparencyCycleRafRef.current = requestAnimationFrame(tick);
      };
      transparencyCycleRafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (transparencyCycleRafRef.current) {
        cancelAnimationFrame(transparencyCycleRafRef.current);
        transparencyCycleRafRef.current = null;
      }
    };
  }, [isTransparencyCycling]);

  // Dynamic custom cursor that reflects tool, mode, color and brush size
  React.useEffect(() => {
    const kind: 'trace' | 'via' | 'pad' | 'erase' | 'magnify' | 'ground' | 'component' | 'power' | 'default' =
      currentTool === 'erase'
        ? 'erase'
        : currentTool === 'magnify'
        ? 'magnify'
        : currentTool === 'ground'
        ? 'ground'
        : currentTool === 'power'
        ? 'power'
        : currentTool === 'component'
        ? 'component'
        : currentTool === 'draw'
        ? (drawingMode === 'via' ? 'via' : drawingMode === 'pad' ? 'pad' : 'trace')
        : 'default';
    if (kind === 'default') { setCanvasCursor(undefined); return; }
    const scale = Math.max(1, viewScale);
    const diameterPx = kind === 'magnify' ? 18 : kind === 'component' ? Math.max(16, Math.round(brushSize * scale)) : kind === 'power' || kind === 'ground' ? Math.max(12, Math.round(brushSize * scale)) : Math.max(6, Math.round(brushSize * scale));
    const pad = 4;
    const size = diameterPx + pad * 2 + (kind === 'magnify' ? 8 : 0); // extra room for handle/plus
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) { setCanvasCursor(undefined); return; }
    const cx = size / 2;
    const cy = size / 2;
    const r = diameterPx / 2;
    ctx.clearRect(0,0,size,size);
    
    if (kind === 'via') {
      // Draw annulus (filled ring with open hole in the middle)
      const rOuter = r;
      const rInner = r * 0.5;
      const crosshairLength = r * 0.7;
      
      // Use via color from toolRegistry
      const viaDef = toolRegistry.get('via');
      const viaColor = viaDef?.settings.color || persistedDefaults.viaColor || brushColor;
      
      // Draw annulus using even-odd fill rule
      ctx.fillStyle = viaColor;
      ctx.beginPath();
      // Outer circle
      ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
      // Inner circle (creates the hole with even-odd fill rule)
      ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
      ctx.fill('evenodd');
      
      // Draw medium gray crosshairs
      ctx.strokeStyle = '#808080'; // Medium gray
      ctx.lineWidth = 1;
      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(cx - crosshairLength, cy);
      ctx.lineTo(cx + crosshairLength, cy);
      ctx.stroke();
      // Vertical line
      ctx.beginPath();
      ctx.moveTo(cx, cy - crosshairLength);
      ctx.lineTo(cx, cy + crosshairLength);
      ctx.stroke();
    } else if (kind === 'pad') {
      // Use pad color from toolRegistry (layer-specific colors are used when drawing)
      const padDef = toolRegistry.get('pad');
      const padColor = padDef?.settings.color || topPadColor || brushColor;
      
      // Draw pad as square annulus (square with square hole) - similar to via but square
      const outerSize = r * 2;
      const innerSize = outerSize * 0.5; // Inner square is half the size
      const crosshairLength = r * 0.7;
      
      // Draw square annulus using even-odd fill rule
      ctx.fillStyle = padColor;
      ctx.beginPath();
      // Outer square
      ctx.rect(cx - r, cy - r, outerSize, outerSize);
      // Inner square (creates the hole with even-odd fill rule)
      ctx.rect(cx - innerSize / 2, cy - innerSize / 2, innerSize, innerSize);
      ctx.fill('evenodd');
      
      // Draw medium gray crosshairs
      ctx.strokeStyle = '#808080'; // Medium gray
      ctx.lineWidth = 1;
      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(cx - crosshairLength, cy);
      ctx.lineTo(cx + crosshairLength, cy);
      ctx.stroke();
      // Vertical line
      ctx.beginPath();
      ctx.moveTo(cx, cy - crosshairLength);
      ctx.lineTo(cx, cy + crosshairLength);
      ctx.stroke();
    } else if (kind === 'trace') {
      // Use layer-specific trace colors (like pad pattern)
      const traceDef = toolRegistry.get('trace');
      const traceColor = traceDef?.settings.color || (traceToolLayer === 'top' ? topTraceColor : bottomTraceColor) || brushColor;
      ctx.fillStyle = traceColor;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'erase') {
      // Draw tilted pink eraser matching toolbar icon shape
      const width = Math.max(brushSize * 0.75, 8); // Width of eraser
      const height = Math.max(brushSize * 0.5, 6); // Height of eraser
      const tipHeight = Math.max(brushSize * 0.2, 2); // Tip height
      
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-35 * Math.PI / 180); // Rotate -35 degrees to match toolbar icon
      
      // Draw main eraser body (rounded rectangle)
      ctx.fillStyle = '#f5a3b3'; // Pink color matching toolbar
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1.5;
      const radius = 1.5;
      const x = -width / 2;
      const y = -height / 2;
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Draw eraser tip (darker pink)
      ctx.fillStyle = '#f18ea4'; // Darker pink for tip
      ctx.beginPath();
      ctx.rect(-width / 2, height / 2 - tipHeight, width, tipHeight);
      ctx.fill();
      
      ctx.restore();
    } else if (kind === 'magnify') {
      // Magnifying glass with +/- sign, handle to bottom-right
      const lensR = r;
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      // Lens
      ctx.beginPath();
      ctx.arc(cx - 2, cy - 2, lensR, 0, Math.PI * 2);
      ctx.stroke();
      // Handle
      const hx1 = cx + lensR * 0.6;
      const hy1 = cy + lensR * 0.6;
      const hx2 = hx1 + 6;
      const hy2 = hy1 + 6;
      ctx.beginPath();
      ctx.moveTo(hx1, hy1);
      ctx.lineTo(hx2, hy2);
      ctx.stroke();
      // +/- sign
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 2);
      ctx.lineTo(cx + 2, cy - 2);
      ctx.stroke();
      if (!isShiftPressed) {
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy - 6);
        ctx.lineTo(cx - 2, cy + 2);
        ctx.stroke();
      }
    } else if (kind === 'ground') {
      // Draw ground symbol cursor: empty black circle with extending vertical and horizontal lines
      ctx.strokeStyle = '#000000'; // Ground symbols are always black
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const lineExtension = r * 0.8; // Lines extend outside the circle
      
      // Draw empty circle (not filled)
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw vertical line extending above and below the circle
      ctx.beginPath();
      ctx.moveTo(cx, cy - r - lineExtension);
      ctx.lineTo(cx, cy + r + lineExtension);
      ctx.stroke();
      
      // Draw horizontal line extending left and right of the circle
      ctx.beginPath();
      ctx.moveTo(cx - r - lineExtension, cy);
      ctx.lineTo(cx + r + lineExtension, cy);
      ctx.stroke();
    } else if (kind === 'power') {
      // Draw power symbol cursor: empty red circle with extending vertical and horizontal lines
      ctx.strokeStyle = '#ff0000'; // Power symbols are always red
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const lineExtension = r * 0.8; // Lines extend outside the circle
      
      // Draw empty circle (not filled)
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw vertical line extending above and below the circle
      ctx.beginPath();
      ctx.moveTo(cx, cy - r - lineExtension);
      ctx.lineTo(cx, cy + r + lineExtension);
      ctx.stroke();
      
      // Draw horizontal line extending left and right of the circle
      ctx.beginPath();
      ctx.moveTo(cx - r - lineExtension, cy);
      ctx.lineTo(cx + r + lineExtension, cy);
      ctx.stroke();
    } else if (kind === 'component') {
      // Draw square component icon with abbreviation text
      // Use layer-specific component colors based on componentToolLayer (like pad pattern)
      // Priority: componentToolLayer -> toolRegistry -> fallback
      const layer = componentToolLayer || 'top';
      const componentDef = toolRegistry.get('component');
      // Use layer-specific color based on componentToolLayer (this is the source of truth)
      const componentColor = (layer === 'top' ? topComponentColor : bottomComponentColor) || componentDef?.settings.color || brushColor;
      const compSize = diameterPx;
      const half = compSize / 2;
      // Draw square
      ctx.strokeStyle = componentColor;
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.rect(cx - half, cy - half, compSize, compSize);
      ctx.fill();
      ctx.stroke();
      // Draw abbreviation text (use selected type if available, otherwise show generic '?')
      const abbrev = selectedComponentType ? getDefaultAbbreviation(selectedComponentType) : '?';
      ctx.fillStyle = componentColor;
      ctx.font = `bold ${Math.max(8, compSize * 0.35)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(abbrev, cx, cy);
    }
    const url = `url(${canvas.toDataURL()}) ${Math.round(cx)} ${Math.round(cy)}, crosshair`;
    setCanvasCursor(url);
  }, [currentTool, drawingMode, brushColor, brushSize, viewScale, isShiftPressed, selectedComponentType, selectedPowerBusId, powerBuses, toolRegistry, persistedDefaults, traceToolLayer, topTraceColor, bottomTraceColor, componentToolLayer, topComponentColor, bottomComponentColor]);

  // Redraw canvas when dependencies change
  React.useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Redraw when canvas size changes
  React.useEffect(() => {
    drawCanvas();
  }, [canvasSize.width, canvasSize.height]);

  // Save trace size to layer-specific state when brushSize changes (only for trace tool, no selection)
  // NOTE: We do NOT automatically update selected strokes when brushSize changes.
  // Selected strokes should only be updated when the user explicitly changes their size (via +/- keys or Set Size dialog).
  React.useEffect(() => {
    // IMPORTANT: Only update layer-specific trace size when there's NO selection
    // If no selection and trace tool is active, save size to the appropriate layer
    // Only save if the size is valid (>= 1) to avoid saving invalid values
    if (selectedIds.size === 0 && currentTool === 'draw' && drawingMode === 'trace' && brushSize >= 1) {
      if (selectedDrawingLayer === 'top') {
        setTopTraceSize(brushSize);
      } else {
        setBottomTraceSize(brushSize);
      }
    }
    // REMOVED: Automatic update of selected strokes when brushSize changes
    // This was causing selected objects to change size when switching tools
    // The buggy line was: setDrawingStrokes(prev => prev.map(s => selectedIds.has(s.id) ? { ...s, size: brushSize } : s));
    // Selected strokes should only be updated via explicit user actions (increaseSize/decreaseSize functions)
  }, [brushSize, currentTool, drawingMode, selectedDrawingLayer, selectedIds]);

  // Selection size slider removed; size can be set via Tools menu

  // Update via and pad types when power/ground nodes change
  // This ensures via and pad types are always correct based on Node ID connections
  React.useEffect(() => {
    setDrawingStrokes(prev => prev.map(stroke => {
      if (stroke.type === 'via' && stroke.points.length > 0 && stroke.points[0].id !== undefined) {
        const nodeId = stroke.points[0].id;
        const newViaType = determineViaType(nodeId, powerBuses);
        // Only update if type changed to avoid unnecessary re-renders
        if (stroke.viaType !== newViaType) {
          return { ...stroke, viaType: newViaType };
        }
      } else if (stroke.type === 'pad' && stroke.points.length > 0 && stroke.points[0].id !== undefined) {
        const nodeId = stroke.points[0].id;
        const newPadType = determinePadType(nodeId, powerBuses);
        // Only update if type changed to avoid unnecessary re-renders
        if (stroke.padType !== newPadType) {
          return { ...stroke, padType: newPadType };
        }
      }
      return stroke;
    }));
  }, [powers, grounds, powerBuses, determineViaType, determinePadType]);

  // Print function - prints only the canvas area
  const handlePrint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Get the canvas as a data URL
    const dataUrl = canvas.toDataURL('image/png');
    
    // Create a new window with just the canvas image
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the canvas.');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>PCB Drawing</title>
          <style>
            @media print {
              @page {
                margin: 0;
                size: auto;
              }
              body {
                margin: 0;
                padding: 0;
              }
            }
            body {
              margin: 0;
              padding: 20px;
              display: flex;
              justify-content: center;
              align-items: center;
              background: white;
            }
            img {
              max-width: 100%;
              height: auto;
              display: block;
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" alt="PCB Drawing" onload="window.setTimeout(function() { window.print(); }, 250);" />
        </body>
      </html>
    `);
    printWindow.document.close();
  }, []);

  // Track Shift key for Magnify icon +/- hint
  React.useEffect(() => {
    const onDown = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftPressed(true); };
    const onUp = (e: KeyboardEvent) => { if (e.key === 'Shift') setIsShiftPressed(false); };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // Close menus when clicking outside
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuBarRef.current) return;
      if (!menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // Draw small thumbnails for layer preview/selection
  React.useEffect(() => {
    const drawThumb = (ref: React.RefObject<HTMLCanvasElement | null>, img: PCBImage | null) => {
      const canvas = ref.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, W, H);
      if (img?.bitmap) {
        const bmp = img.bitmap;
        const scale = Math.min(W / bmp.width, H / bmp.height);
        const dw = Math.max(1, Math.floor(bmp.width * scale));
        const dh = Math.max(1, Math.floor(bmp.height * scale));
        const dx = Math.floor((W - dw) / 2);
        const dy = Math.floor((H - dh) / 2);
        ctx.drawImage(bmp, dx, dy, dw, dh);
      }
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    };
    drawThumb(topThumbRef, topImage);
    drawThumb(bottomThumbRef, bottomImage);
  }, [topImage, bottomImage]);

  // Maintain independent stacks for vias, pads, and trace segments in insertion order
  // Preserve point IDs for netlist generation
  React.useEffect(() => {
    const vAll: Via[] = [];
    const pAll: Pad[] = [];
    const tTop: TraceSegment[] = [];
    const tBot: TraceSegment[] = [];
    for (const s of drawingStrokes) {
      if (s.type === 'via' && s.points.length >= 1) {
        const c = s.points[0];
        const v: Via = { 
          id: s.id, // stroke ID for deletion/selection
          pointId: c.id, // globally unique point ID for netlist connections
          x: c.x, 
          y: c.y, 
          size: s.size, 
          color: s.color 
        };
        vAll.push(v); // Vias are physical holes shared by both layers
      } else if (s.type === 'pad' && s.points.length >= 1) {
        const c = s.points[0];
        const p: Pad = { 
          id: s.id, // stroke ID for deletion/selection
          pointId: c.id, // globally unique point ID for netlist connections
          x: c.x, 
          y: c.y, 
          size: s.size, 
          color: s.color,
          layer: s.layer || 'top' // Pad layer (top or bottom)
        };
        pAll.push(p);
      } else if (s.type === 'trace' && s.points.length >= 2) {
        for (let i = 0; i < s.points.length - 1; i++) {
          const p1 = s.points[i];
          const p2 = s.points[i + 1];
          const seg: TraceSegment = { 
            id: s.id, // stroke ID for deletion/selection
            startPointId: p1.id, // globally unique point ID for start point
            endPointId: p2.id, // globally unique point ID for end point
            x1: p1.x, 
            y1: p1.y, 
            x2: p2.x, 
            y2: p2.y, 
            size: s.size, 
            color: s.color 
          };
          if (s.layer === 'top') tTop.push(seg); else tBot.push(seg);
        }
      }
    }
    setVias(vAll);
    setPads(pAll);
    setTracesTop(tTop);
    setTracesBottom(tBot);
  }, [drawingStrokes]);

  // Ref to access current drawingStrokes in callbacks (for auto-save cleanup)
  const drawingStrokesRef = useRef(drawingStrokes);
  drawingStrokesRef.current = drawingStrokes;

  // Build project data object (used by both saveProject and autoSave)
  const buildProjectData = useCallback(() => {
    const now = new Date();
    // Use ISO 8601 format for standard datetime (e.g., "2025-11-16T01:27:14.123Z")
    const savedAt = now.toISOString();
    // Generate timestamp for filename using the new format: YYYY_MM_DD-HH-mm-ss
    const ts = formatTimestamp();
    const project = {
      version: 1,
      fileType: 'PCB_REVERSE_ENGINEERING_AUTOSAVE', // Identifier for auto-saved files
      savedAt: savedAt,
      view: {
        currentView,
        viewScale,
        viewPan,
        showBothLayers,
        selectedDrawingLayer,
      },
      images: {
        top: topImage ? {
          name: topImage.name,
          width: topImage.width,
          height: topImage.height,
          dataUrl: topImage.dataUrl ?? topImage.url, // prefer embedded content
          x: topImage.x, y: topImage.y,
          scale: topImage.scale,
          rotation: topImage.rotation,
          flipX: topImage.flipX, flipY: topImage.flipY,
          skewX: topImage.skewX, skewY: topImage.skewY,
          keystoneV: topImage.keystoneV, keystoneH: topImage.keystoneH,
        } : null,
        bottom: bottomImage ? {
          name: bottomImage.name,
          width: bottomImage.width,
          height: bottomImage.height,
          dataUrl: bottomImage.dataUrl ?? bottomImage.url,
          x: bottomImage.x, y: bottomImage.y,
          scale: bottomImage.scale,
          rotation: bottomImage.rotation,
          flipX: bottomImage.flipX, flipY: bottomImage.flipY,
          skewX: bottomImage.skewX, skewY: bottomImage.skewY,
          keystoneV: bottomImage.keystoneV, keystoneH: bottomImage.keystoneH,
        } : null,
      },
      drawing: {
        // Filter out single-point traces (traces must have at least 2 points to form a line)
        // Keep vias (which are single points by design) and traces with 2+ points
        // Use ref to get latest value (important for auto-save which cleans up before saving)
        drawingStrokes: drawingStrokesRef.current.filter(s => {
          if (s.type === 'trace' && s.points.length < 2) {
            return false; // Remove single-point traces
          }
          return true; // Keep vias and valid traces
        }),
        vias,
        tracesTop,
        tracesBottom,
        componentsTop,
        componentsBottom,
        grounds,
        powers,
      },
      powerBuses, // Save power bus definitions
      pointIdCounter: getPointIdCounter(), // Save the point ID counter to preserve uniqueness
      traceColors: {
        top: topTraceColor,
        bottom: bottomTraceColor,
      },
      traceSizes: {
        top: topTraceSize,
        bottom: bottomTraceSize,
      },
      padColors: {
        top: topPadColor,
        bottom: bottomPadColor,
      },
      padSizes: {
        top: topPadSize,
        bottom: bottomPadSize,
      },
      componentColors: {
        top: topComponentColor,
        bottom: bottomComponentColor,
      },
      componentSizes: {
        top: topComponentSize,
        bottom: bottomComponentSize,
      },
      traceToolLayer, // Save last layer choice
      toolSettings: {
        // Convert Map to plain object for JSON serialization
        trace: toolRegistry.get('trace')?.settings || { color: '#ff0000', size: 10 },
        via: toolRegistry.get('via')?.settings || { color: '#ff0000', size: 26 },
        pad: toolRegistry.get('pad')?.settings || { color: '#ff0000', size: 26 },
        component: toolRegistry.get('component')?.settings || { color: '#ff0000', size: 18 },
        ground: toolRegistry.get('ground')?.settings || { color: '#000000', size: 18 },
        power: toolRegistry.get('power')?.settings || { color: '#ff0000', size: 18 },
      },
      locks: {
        areImagesLocked,
        areViasLocked,
        arePadsLocked,
        areTracesLocked,
        areComponentsLocked,
        areGroundNodesLocked,
        arePowerNodesLocked,
      },
      visibility: {
        showViasLayer,
        showTopPadsLayer,
        showBottomPadsLayer,
        showTopTracesLayer,
        showBottomTracesLayer,
        showTopComponents,
        showBottomComponents,
        showPowerLayer,
        showGroundLayer,
      },
      autoSave: {
        enabled: autoSaveEnabled,
        interval: autoSaveInterval,
        baseName: autoSaveBaseName,
      },
      projectInfo: {
        name: projectName,
        // Note: directory handle cannot be serialized, but project name is stored for persistence
      },
    };
    return { project, timestamp: ts };
  }, [currentView, viewScale, viewPan, showBothLayers, selectedDrawingLayer, topImage, bottomImage, drawingStrokes, vias, tracesTop, tracesBottom, componentsTop, componentsBottom, grounds, toolRegistry, areImagesLocked, areViasLocked, arePadsLocked, areTracesLocked, areComponentsLocked, areGroundNodesLocked, arePowerNodesLocked, powerBuses, getPointIdCounter, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize, topPadColor, bottomPadColor, topPadSize, bottomPadSize, topComponentColor, bottomComponentColor, topComponentSize, bottomComponentSize, traceToolLayer, autoSaveEnabled, autoSaveInterval, autoSaveBaseName, projectName, showViasLayer, showTopPadsLayer, showBottomPadsLayer, showTopTracesLayer, showBottomTracesLayer, showTopComponents, showBottomComponents, showPowerLayer, showGroundLayer]);

  // Ref to store the latest buildProjectData function to avoid recreating performAutoSave
  const buildProjectDataRef = useRef(buildProjectData);
  buildProjectDataRef.current = buildProjectData;

  // Refs to store latest auto save configuration
  const autoSaveDirHandleRef = useRef(autoSaveDirHandle);
  autoSaveDirHandleRef.current = autoSaveDirHandle;
  const autoSaveBaseNameRef = useRef(autoSaveBaseName);
  autoSaveBaseNameRef.current = autoSaveBaseName;
  // Ref to store the setter for current project file path so we can update it from auto save
  const setCurrentProjectFilePathRef = useRef(setCurrentProjectFilePath);
  setCurrentProjectFilePathRef.current = setCurrentProjectFilePath;
  // Ref to access current project file path in callbacks
  const currentProjectFilePathRef = useRef(currentProjectFilePath);
  currentProjectFilePathRef.current = currentProjectFilePath;
  // Refs to access current state values in callbacks
  const autoSaveFileHistoryRef = useRef<string[]>([]);
  autoSaveFileHistoryRef.current = autoSaveFileHistory;
  const currentFileIndexRef = useRef<number>(-1);
  currentFileIndexRef.current = currentFileIndex;

  // Auto Save function - saves to a file handle with timestamped filename
  // Use refs to avoid recreating this function on every state change
  const performAutoSave = useCallback(async () => {
    console.log('Auto save: performAutoSave called');
    let dirHandle = autoSaveDirHandleRef.current;
    let baseName = autoSaveBaseNameRef.current;
    
    console.log(`Auto save: dirHandle=${dirHandle ? 'set' : 'missing'}, baseName=${baseName || 'missing'}`);
    
    // If directory handle is missing but we have a current project file, try to get directory
    const currentFilePath = currentProjectFilePathRef.current;
    console.log(`Auto save: currentFilePath=${currentFilePath || 'none'}`);
    
    // Don't prompt for directory here - it requires a user gesture
    // Directory should be set when file is opened (which is a user gesture)
    if (!dirHandle || !baseName) {
      console.warn(`Auto save: Missing directory handle (${!dirHandle}) or base name (${!baseName}). Please use File -> Auto Save -> Enable to set up auto save.`);
      // Disable auto save if configuration is incomplete
      setAutoSaveEnabled(false);
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
      return;
    }
    
    // Only save if there have been changes since the last save
    if (!hasChangesSinceLastAutoSaveRef.current) {
      console.log('Auto save: Skipping - no changes since last save');
      return;
    }
    
    // Clean up single-point traces before saving
    // Remove traces that have less than 2 points (traces need at least 2 points to form a line)
    // Keep vias (which are single points by design)
    const currentDrawingStrokes = drawingStrokesRef.current;
    const singlePointTraces = currentDrawingStrokes.filter(s => s.type === 'trace' && s.points.length < 2);
    if (singlePointTraces.length > 0) {
      console.log(`Auto save: Cleaning up ${singlePointTraces.length} single-point trace(s) before save`);
      singlePointTraces.forEach(s => console.log(`  - Removing single-point trace ${s.id}`));
      const cleanedDrawingStrokes = currentDrawingStrokes.filter(s => {
        if (s.type === 'trace' && s.points.length < 2) {
          return false; // Remove single-point traces
        }
        return true; // Keep vias and valid traces
      });
      // Update state to remove single-point traces
      setDrawingStrokes(cleanedDrawingStrokes);
      // Update ref immediately so buildProjectData uses cleaned version
      drawingStrokesRef.current = cleanedDrawingStrokes;
    }
    
    console.log('Auto save: Starting save...');
    // Use ref to get latest buildProjectData without causing dependency changes
    // buildProjectData will use the cleaned drawingStrokes from the ref
    const { project, timestamp } = buildProjectDataRef.current();
    const filename = `${baseName}_${timestamp}.json`;
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    
    try {
      // Get or create history directory
      let historyDirHandle: FileSystemDirectoryHandle;
      try {
        historyDirHandle = await dirHandle.getDirectoryHandle('history', { create: true });
      } catch (e) {
        console.error('Failed to get/create history directory:', e);
        return;
      }
      
      // Before saving new file, check if there's a previous auto-saved file in root directory
      // and move it to history/
      try {
        // Look for auto-saved files in root directory by checking file content
        const rootFiles: string[] = [];
        for await (const name of (dirHandle as any).keys()) {
          try {
            // Skip directories and the file we're about to create
            if (name === 'history' || name === filename) {
              continue;
            }
            
            const fileHandle = await dirHandle.getFileHandle(name);
            const file = await fileHandle.getFile();
            
            // Only check .json files
            if (!name.endsWith('.json')) {
              continue;
            }
            
            // Read file content to check if it's a PCB project file
            const fileContent = await file.text();
            try {
              const parsed = JSON.parse(fileContent);
              // Check if this is a PCB project file (has version field)
              // Move it to history if it's either:
              // 1. An auto-saved file (has fileType field), OR
              // 2. A manually saved/opened project file (has version but no fileType)
              if (parsed.version && (
                parsed.fileType === 'PCB_REVERSE_ENGINEERING_AUTOSAVE' ||
                !parsed.fileType // Manually saved files don't have fileType
              )) {
                rootFiles.push(name);
                console.log(`Auto save: Found PCB project file in root: ${name} (${parsed.fileType ? 'auto-saved' : 'manually saved'})`);
              }
            } catch (parseError) {
              // Not valid JSON, skip
              continue;
            }
          } catch (e) {
            // Skip if not a file or doesn't exist
            continue;
          }
        }
        
        // Move any existing auto-saved files from root to history
        for (const oldFilename of rootFiles) {
          try {
            const oldFileHandle = await dirHandle.getFileHandle(oldFilename);
            const oldFile = await oldFileHandle.getFile();
            const oldFileContent = await oldFile.text();
            
            // Write to history directory
            const historyFileHandle = await historyDirHandle.getFileHandle(oldFilename, { create: true });
            const historyWritable = await historyFileHandle.createWritable();
            await historyWritable.write(new Blob([oldFileContent], { type: 'application/json' }));
            await historyWritable.close();
            
            // Remove from root directory
            await dirHandle.removeEntry(oldFilename);
            console.log(`Auto save: Moved ${oldFilename} from root to history/`);
          } catch (e) {
            console.warn(`Auto save: Failed to move ${oldFilename} to history:`, e);
            // Continue with other files even if one fails
          }
        }
      } catch (e) {
        console.warn('Auto save: Error checking for old files in root:', e);
        // Continue with save even if moving old files fails
      }
      
      // Save new file to root directory (most recent file stays in root)
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      console.log(`Auto save: Successfully saved ${filename} to root directory`);
      
      // Update the displayed file path to reflect the current auto-saved file
      setCurrentProjectFilePathRef.current(filename);
      // Refresh file history and update index
      const history = autoSaveFileHistoryRef.current;
      const newHistory = [filename, ...history.filter(f => f !== filename)].sort((a, b) => b.localeCompare(a));
      setAutoSaveFileHistory(newHistory);
      autoSaveFileHistoryRef.current = newHistory;
      setCurrentFileIndex(0); // Newest file is at index 0
      currentFileIndexRef.current = 0;
      // Reset the changes flag after successful save
      hasChangesSinceLastAutoSaveRef.current = false;
    } catch (e) {
      console.error('Auto save failed:', e);
    }
  }, []); // Empty dependencies - function never changes

  // Save project state as JSON (including embedded images)
  const saveProject = useCallback(async () => {
    const { project } = buildProjectData();
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    // If we have a project directory handle and name, use them (from New Project or previous save)
    // Standard IDE pattern: save as project.json inside the project folder
    if (projectDirHandle && projectName) {
      try {
        const filename = 'project.json'; // Standard name inside project folder
        const fileHandle = await projectDirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        setCurrentProjectFilePath(filename);
        console.log(`Project saved: ${projectName}/${filename}`);
        return;
      } catch (e) {
        console.error('Failed to save to project directory:', e);
        // Directory handle may have been revoked - clear it so user can select a new one
        setProjectDirHandle(null);
        // Fall through to prompt user for directory
      }
    }
    
    // If we have a project name but no directory handle, prompt for directory
    if (projectName && !projectDirHandle) {
      const w = window as any;
      if (typeof w.showDirectoryPicker === 'function') {
        try {
          const dirHandle = await w.showDirectoryPicker();
          setProjectDirHandle(dirHandle);
          // Now save using the new directory handle
          const filename = `${projectName}.json`;
          const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          setCurrentProjectFilePath(filename);
          console.log(`Project saved: ${filename} in selected directory`);
          return;
        } catch (e) {
          if ((e as any)?.name !== 'AbortError') {
            console.error('Failed to get directory:', e);
          }
          // Fall through to file picker
        }
      }
    }

    // Fallback: use file picker (original behavior)
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const ts = `${now.getFullYear()}_${pad2(now.getMonth() + 1)}_${pad2(now.getDate())}_${pad2(now.getHours())}_${pad2(now.getMinutes())}_${pad2(now.getSeconds())}`;
    const filename = `pcb_project_${ts}.json`;

    // Prefer File System Access API when available (lets user choose folder/create folder)
    const w = window as any;
    if (typeof w.showSaveFilePicker === 'function') {
      try {
        const handle: FileSystemFileHandle = await w.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'PCB Project', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        // Update current project file path
        const savedFilename: string = handle.name;
        try {
          // Try to get the full path from the file handle
          const file = await handle.getFile();
          setCurrentProjectFilePath(file.name);
        } catch (e) {
          // If we can't get the full path, just use the filename
          setCurrentProjectFilePath(savedFilename);
        }
        
        // Extract project name from filename and store it
        const filenameFromHandle = savedFilename;
        const projectNameFromFile = filenameFromHandle.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
        if (projectNameFromFile) {
          setProjectName(projectNameFromFile);
          localStorage.setItem('pcb_project_name', projectNameFromFile);
        }
        
        // Note: We can't get the directory handle from FileSystemFileHandle directly
        // The directory handle will need to be set when creating a new project or when user selects it
        // For now, we'll clear it so user can select directory on next save if needed
        // setProjectDirHandle(null); // Don't clear - keep existing if we have one
        
        // For new files, set up auto save with default settings
        // Extract directory and base name from the saved file
        try {
          // Get the directory handle - we need to get it from the file's parent
          // Since FileSystemFileHandle doesn't expose parent directly,
          // we'll need to prompt user or use a workaround
          // For now, set base name from filename
          const baseName = handle.name.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
          setAutoSaveBaseName(baseName);
          
          // Try to get directory handle - we'll need user to select it
          // For auto save to work, we need the directory handle
          // We'll set it up when auto save first runs if not already set
          if (!autoSaveDirHandle) {
            console.log('Auto save: Directory handle not set. Will prompt on first auto save.');
          }
          
          // Auto save is disabled by default - user must enable it manually
          // Don't automatically enable auto save for new files
        } catch (e) {
          console.warn('Could not set up auto save for new file:', e);
        }
        
        return;
      } catch (e) {
        // If user cancels, fall back to download is unnecessary; just return
        if ((e as any)?.name === 'AbortError') return;
        console.warn('showSaveFilePicker failed, falling back to download', e);
      }
    }
    // Fallback: regular download (browser save dialog)
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      document.body.removeChild(a);
    }, 0);
  }, [buildProjectData]);

  // Export netlist function
  // exportNetlist function removed - menu item was commented out and function is unused
  // If needed in the future, uncomment the menu item and restore this function

  // Export simple schematic function
  const exportSimpleSchematic = useCallback(async () => {
    // Generate schematic
    const allComponents = [...componentsTop, ...componentsBottom];
    // Type assertion: The local DrawingStroke type has optional point.id, but the imported
    // type requires it. The generateSimpleSchematic function handles undefined IDs safely
    // by checking point.id !== undefined before using it.
    const schematicContent = generateSimpleSchematic(
      allComponents,
      drawingStrokes as ImportedDrawingStroke[],
      powers,
      grounds,
      powerBuses
    );

    // Create blob
    const blob = new Blob([schematicContent], { type: 'text/plain' });

    // Determine filename
    const baseName = projectName || 'pcb_project';
    const filename = `${baseName}.kicad_sch`;

    // Try to use File System Access API
    const w = window as any;
    if (typeof w.showSaveFilePicker === 'function') {
      try {
        const handle = await w.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'KiCad Schematic', accept: { 'text/plain': ['kicad_sch'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        console.log(`Simple schematic exported: ${handle.name}`);
        return;
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return;
        console.warn('showSaveFilePicker failed, falling back to download', e);
      }
    }

    // Fallback: regular download
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      document.body.removeChild(a);
    }, 0);
  }, [componentsTop, componentsBottom, drawingStrokes, powers, grounds, powerBuses, projectName]);

  // Manage auto save interval (must be after performAutoSave is defined)
  // Note: We don't include performAutoSave in dependencies to avoid resetting interval on every state change
  // Autosave is only active when the most recent file is the current file (currentFileIndex === 0)
  React.useEffect(() => {
    // Clear existing interval if any
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = null;
    }

    // Set up new interval if auto save is enabled
    // Note: Removed file history navigation restrictions - auto save always works when enabled
    const wasAutoSaveEnabled = prevAutoSaveEnabledRef.current;
    prevAutoSaveEnabledRef.current = autoSaveEnabled;
    
      // Set up auto save interval if enabled and interval is set
      // Only set up interval if we have both directory handle and base name
      if (autoSaveEnabled && autoSaveInterval) {
        const intervalMs = autoSaveInterval * 60 * 1000; // Convert minutes to milliseconds
        
        // Only set up interval if we have both directory handle and base name
        if (autoSaveDirHandle && autoSaveBaseName) {
          console.log(`Auto save: Setting up interval for ${autoSaveInterval} minute(s) (${intervalMs}ms)`);
          
          // Only perform initial save when autosave transitions from disabled to enabled
          if (!wasAutoSaveEnabled) {
            // Mark that we have changes so the initial save will happen
            hasChangesSinceLastAutoSaveRef.current = true;
            // Perform initial save immediately after a short delay to ensure state is updated
            setTimeout(() => {
              performAutoSave();
            }, 100);
          }
          
          // Set up the interval - use the latest performAutoSave via closure
          if (autoSaveIntervalRef.current) {
            clearInterval(autoSaveIntervalRef.current);
            autoSaveIntervalRef.current = null;
          }
          autoSaveIntervalRef.current = window.setInterval(() => {
            console.log('Auto save: Interval triggered, calling performAutoSave...');
            console.log(`  - hasChangesSinceLastAutoSave: ${hasChangesSinceLastAutoSaveRef.current}`);
            console.log(`  - dirHandle: ${autoSaveDirHandleRef.current ? 'set' : 'missing'}`);
            console.log(`  - baseName: ${autoSaveBaseNameRef.current || 'missing'}`);
            performAutoSave();
          }, intervalMs);
          console.log(`Auto save: Interval set up for ${intervalMs}ms (${autoSaveInterval} minutes)`);
          console.log(`  - Directory handle: ${autoSaveDirHandle ? 'set' : 'missing'}`);
          console.log(`  - Base name: ${autoSaveBaseName || 'missing'}`);
        } else {
          // Auto save is enabled but directory handle or base name is missing
          // Disable auto save and clear interval
          console.warn(`Auto save: Cannot set up interval - missing directory handle (${!autoSaveDirHandle}) or base name (${!autoSaveBaseName}). Disabling auto save.`);
          setAutoSaveEnabled(false);
          if (autoSaveIntervalRef.current) {
            clearInterval(autoSaveIntervalRef.current);
            autoSaveIntervalRef.current = null;
          }
        }
      } else if (!autoSaveEnabled) {
        // Reset the previous state ref when autosave is disabled
        prevAutoSaveEnabledRef.current = false;
      }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
    };
    // Only depend on configuration, not performAutoSave itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSaveEnabled, autoSaveInterval, autoSaveDirHandle, autoSaveBaseName]);

  // Track changes to project data for auto save
  // Only track changes if auto save is enabled
  // Use a ref to track if this is the first run after enabling auto save
  const isFirstRunAfterEnableRef = useRef<boolean>(false);
  
  React.useEffect(() => {
    // Skip if auto save is not enabled (don't track changes when disabled)
    if (!autoSaveEnabled) {
      isFirstRunAfterEnableRef.current = false;
      return;
    }
    
    // On first run after enabling, skip (initial save is handled by enable action)
    if (isFirstRunAfterEnableRef.current) {
      isFirstRunAfterEnableRef.current = false;
      console.log('Auto save: Skipping change tracking on first run after enable (initial save handled separately)');
      return;
    }
    
    // Track changes if auto save is enabled
    hasChangesSinceLastAutoSaveRef.current = true;
    console.log('Auto save: Change detected, marking for save', {
      topImage: !!topImage,
      bottomImage: !!bottomImage,
      drawingStrokesCount: drawingStrokes.length,
      componentsTopCount: componentsTop.length,
      componentsBottomCount: componentsBottom.length,
      powersCount: powers.length,
      groundsCount: grounds.length,
      powerBusesCount: powerBuses.length,
      areImagesLocked,
      areViasLocked,
      areTracesLocked,
      areComponentsLocked,
      areGroundNodesLocked,
      arePowerNodesLocked,
    });
  }, [
    topImage,
    bottomImage,
    drawingStrokes,
    componentsTop,
    componentsBottom,
    powers,
    grounds,
    powerBuses,
    topTraceColor,
    bottomTraceColor,
    topTraceSize,
    bottomTraceSize,
    areImagesLocked,
    areViasLocked,
    areTracesLocked,
    areComponentsLocked,
    areGroundNodesLocked,
    arePowerNodesLocked,
    autoSaveEnabled, // Need to include this to check if enabled, but we skip on first run
  ]);
  
  // Mark first run when auto save is enabled
  React.useEffect(() => {
    if (autoSaveEnabled) {
      isFirstRunAfterEnableRef.current = true;
      console.log('Auto save: Enabled, marking first run');
    } else {
      isFirstRunAfterEnableRef.current = false;
    }
  }, [autoSaveEnabled]);

  // Reset change tracking when auto save is disabled or a new project is created
  React.useEffect(() => {
    if (!autoSaveEnabled) {
      hasChangesSinceLastAutoSaveRef.current = false;
    }
  }, [autoSaveEnabled]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    return !!(
      topImage ||
      bottomImage ||
      drawingStrokes.length > 0 ||
      componentsTop.length > 0 ||
      componentsBottom.length > 0 ||
      powers.length > 0 ||
      grounds.length > 0
    );
  }, [topImage, bottomImage, drawingStrokes, componentsTop, componentsBottom, powers, grounds]);

  // Load project name from localStorage on startup
  React.useEffect(() => {
    const savedProjectName = localStorage.getItem('pcb_project_name');
    if (savedProjectName) {
      setProjectName(savedProjectName);
    }
  }, []);

  // Create a new project (reset all state)
  // This function opens a dialog following standard IDE pattern
  const newProject = useCallback(() => {
    setNewProjectSetupDialog({ 
      visible: true, 
      projectName: '',
      locationPath: '',
      locationHandle: null,
    });
  }, []);

  // Handle browsing for project location (parent directory)
  const handleNewProjectBrowseLocation = useCallback(async () => {
    const w = window as any;
    if (typeof w.showDirectoryPicker === 'function') {
      try {
        const locationHandle = await w.showDirectoryPicker();
        // Try to get a display name for the path (browser limitation - we can't get full path)
        // Store the handle and update the dialog
        setNewProjectSetupDialog(prev => ({
          ...prev,
          locationHandle,
          locationPath: locationHandle.name || 'Selected folder',
        }));
        localStorage.setItem('pcb_project_location_path', locationHandle.name || '');
      } catch (e) {
        if ((e as any)?.name !== 'AbortError') {
          console.error('Failed to get directory:', e);
          alert('Failed to select location directory.');
        }
      }
    } else {
      alert('Directory picker is not supported in this browser. Please use a modern browser like Chrome or Edge.');
    }
  }, []);

  // Handle creating the project (standard IDE pattern)
  const handleNewProjectCreate = useCallback(async () => {
    const projectNameInput = newProjectSetupDialog.projectName.trim();
    if (!projectNameInput) {
      alert('Please enter a project name.');
      return;
    }
    const cleanProjectName = projectNameInput.replace(/[^a-zA-Z0-9_-]/g, '_') || 'pcb_project';
    
    if (!newProjectSetupDialog.locationHandle) {
      alert('Please select a location for the project.');
      return;
    }
    
    const parentDirHandle = newProjectSetupDialog.locationHandle;
    
    // Create project folder inside the selected location (standard IDE pattern)
    let projectDirHandle: FileSystemDirectoryHandle;
    try {
      projectDirHandle = await parentDirHandle.getDirectoryHandle(cleanProjectName, { create: true });
    } catch (e) {
      console.error('Failed to create project folder:', e);
      alert(`Failed to create project folder "${cleanProjectName}". See console for details.`);
      return;
    }
    
    // Close the dialog
    setNewProjectSetupDialog({ visible: false, projectName: '', locationPath: '', locationHandle: null });
    
    // Store project name and project directory handle (not parent)
    setProjectName(cleanProjectName);
    setProjectDirHandle(projectDirHandle);
    localStorage.setItem('pcb_project_name', cleanProjectName);
    localStorage.setItem('pcb_project_location_path', parentDirHandle.name || '');
    
    // Reset all state
    setTopImage(null);
    setBottomImage(null);
    setDrawingStrokes([]);
    setComponentsTop([]);
    setComponentsBottom([]);
    setPowers([]);
    setGrounds([]);
    setSelectedIds(new Set());
    setSelectedComponentIds(new Set());
    setSelectedPowerIds(new Set());
    setSelectedGroundIds(new Set());
    setCurrentView('overlay');
    setViewScale(1);
    setViewPan({ x: 0, y: 0 });
    // Reset change tracking for auto save
    hasChangesSinceLastAutoSaveRef.current = false;
    // Clear current project file path
    setCurrentProjectFilePath('');
    // Disable auto save for new project
    setAutoSaveEnabled(false);
    setAutoSaveInterval(null);
    setAutoSaveDirHandle(null);
    setAutoSaveBaseName('');
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current);
      autoSaveIntervalRef.current = null;
    }
    // Use consolidated initialization function for all defaults
    initializeApplicationDefaults();
    
    // Save the project file immediately (standard name: project.json)
    try {
      const { project } = buildProjectData();
      const filename = 'project.json'; // Standard IDE pattern: project.json inside project folder
      const json = JSON.stringify(project, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      
      const fileHandle = await projectDirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      
      // Update current project file path
      setCurrentProjectFilePath(filename);
      console.log(`New project created: ${cleanProjectName}/project.json`);
      
      // Prompt user to enable auto-save
      setAutoSavePromptDialog({ visible: true, source: 'new' });
    } catch (e) {
      console.error('Failed to save new project:', e);
      alert('Failed to save new project file. See console for details.');
    }
  }, [initializeApplicationDefaults, buildProjectData, newProjectSetupDialog]);

  // Handle canceling new project setup
  const handleNewProjectSetupCancel = useCallback(() => {
    setNewProjectSetupDialog({ visible: false, projectName: '', locationPath: '', locationHandle: null });
  }, []);

  // Open Save As dialog
  const openSaveAsDialog = useCallback(() => {
    // Default filename based on current project name or generate one
    const defaultFilename = projectName ? `${projectName}.json` : '';
    setSaveAsDialog({ 
      visible: true, 
      filename: defaultFilename,
      locationPath: '',
      locationHandle: null,
    });
    // Focus the filename input after a short delay to allow dialog to render
    setTimeout(() => {
      saveAsFilenameInputRef.current?.focus();
      if (saveAsFilenameInputRef.current && defaultFilename) {
        // Select the filename part (without extension) for easy editing
        const nameWithoutExt = defaultFilename.replace(/\.json$/i, '');
        saveAsFilenameInputRef.current.setSelectionRange(0, nameWithoutExt.length);
      }
    }, 100);
  }, [projectName]);

  // Handle browsing for Save As location
  const handleSaveAsBrowseLocation = useCallback(async () => {
    const w = window as any;
    if (typeof w.showDirectoryPicker === 'function') {
      try {
        const locationHandle = await w.showDirectoryPicker();
        setSaveAsDialog(prev => ({
          ...prev,
          locationHandle,
          locationPath: locationHandle.name || 'Selected folder',
        }));
      } catch (e) {
        if ((e as any)?.name !== 'AbortError') {
          console.error('Failed to get directory:', e);
          alert('Failed to select location directory.');
        }
      }
    } else {
      alert('Directory picker is not supported in this browser. Please use a modern browser that supports the File System Access API.');
    }
  }, []);

  // Handle Save As save action
  const handleSaveAsSave = useCallback(async () => {
    const filenameInput = saveAsDialog.filename.trim();
    if (!filenameInput) {
      alert('Please enter a file name.');
      return;
    }
    
    // Ensure filename ends with .json
    const filename = filenameInput.endsWith('.json') ? filenameInput : `${filenameInput}.json`;
    const cleanFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
    
    if (!saveAsDialog.locationHandle) {
      alert('Please select a location for the file.');
      return;
    }
    
    const dirHandle = saveAsDialog.locationHandle;
    
    // Build project data and save
    try {
      const { project } = buildProjectData();
      const json = JSON.stringify(project, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      
      const fileHandle = await dirHandle.getFileHandle(cleanFilename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      
      // Update current project file path
      setCurrentProjectFilePath(cleanFilename);
      
      // Extract project name from filename and store it
      const projectNameFromFile = cleanFilename.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      if (projectNameFromFile) {
        setProjectName(projectNameFromFile);
        localStorage.setItem('pcb_project_name', projectNameFromFile);
      }
      
      // Update project directory handle
      setProjectDirHandle(dirHandle);
      
      // Close the dialog
      setSaveAsDialog({ visible: false, filename: '', locationPath: '', locationHandle: null });
      setOpenMenu(null);
      
      console.log(`Project saved as: ${cleanFilename} in selected directory`);
    } catch (e) {
      console.error('Failed to save project:', e);
      alert(`Failed to save project file "${cleanFilename}". See console for details.`);
    }
  }, [saveAsDialog, buildProjectData]);

  // Handle canceling Save As
  const handleSaveAsCancel = useCallback(() => {
    setSaveAsDialog({ visible: false, filename: '', locationPath: '', locationHandle: null });
  }, []);

  // Handler functions for new project dialog (defined after saveProject and newProject)
  const handleNewProjectYes = useCallback(async () => {
    setNewProjectDialog({ visible: false });
    await saveProject();
    newProject();
    // Perform initialization after new project is created
    initializeApplication();
  }, [saveProject, newProject, initializeApplication]);

  const handleNewProjectNo = useCallback(() => {
    setNewProjectDialog({ visible: false });
    newProject();
    // Perform initialization after new project is created
    initializeApplication();
  }, [newProject, initializeApplication]);

  const handleNewProjectCancel = useCallback(() => {
    setNewProjectDialog({ visible: false });
  }, []);

  // Focus Yes button when new project dialog opens and handle keyboard
  React.useEffect(() => {
    if (newProjectDialog.visible) {
      // Focus Yes button after a short delay to ensure it's rendered
      setTimeout(() => {
        newProjectYesButtonRef.current?.focus();
      }, 0);
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          // Yes - save and create new project
          handleNewProjectYes();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          // Cancel - close dialog
          setNewProjectDialog({ visible: false });
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [newProjectDialog.visible, handleNewProjectYes]);

  // Load project from JSON (images embedded)
  const loadProject = useCallback(async (project: any) => {
    try {
      // Restore project info (name and directory) if present
      if (project.projectInfo) {
        if (project.projectInfo.name) {
          setProjectName(project.projectInfo.name);
          localStorage.setItem('pcb_project_name', project.projectInfo.name);
        }
      } else {
        // If no project info, try to extract name from filename if available
        const savedName = localStorage.getItem('pcb_project_name');
        if (savedName) {
          setProjectName(savedName);
        }
      }

      // Restore view state
      if (project.view) {
        if (project.view.currentView) setCurrentView(project.view.currentView);
        if (project.view.viewScale != null) setViewScale(project.view.viewScale);
        if (project.view.viewPan) setViewPan(project.view.viewPan);
        if (project.view.showBothLayers != null) setShowBothLayers(project.view.showBothLayers);
        if (project.view.selectedDrawingLayer) setSelectedDrawingLayer(project.view.selectedDrawingLayer);
      }
      // Restore trace colors, sizes, and layer choice
      if (project.traceColors) {
        if (project.traceColors.top) {
          setTopTraceColor(project.traceColors.top);
          saveDefaultColor('trace', project.traceColors.top, 'top');
        }
        if (project.traceColors.bottom) {
          setBottomTraceColor(project.traceColors.bottom);
          saveDefaultColor('trace', project.traceColors.bottom, 'bottom');
        }
      }
      if (project.traceSizes) {
        // Use defaults (6) if values are missing or invalid
        // For existing projects, if bottom size is less than 6, default it to 6
        const topSize = project.traceSizes.top != null && project.traceSizes.top > 0 ? project.traceSizes.top : 6;
        let bottomSize = project.traceSizes.bottom != null && project.traceSizes.bottom > 0 ? project.traceSizes.bottom : 6;
        // Ensure bottom size defaults to 6 if it's less than 6 (migration for old projects)
        if (bottomSize < 6) {
          bottomSize = 6;
        }
        setTopTraceSize(topSize);
        setBottomTraceSize(bottomSize);
        saveDefaultSize('trace', topSize, 'top');
        saveDefaultSize('trace', bottomSize, 'bottom');
      } else {
        // If traceSizes doesn't exist in project, ensure defaults are set
        setTopTraceSize(6);
        setBottomTraceSize(6);
      }
      // Restore pad colors and sizes
      if (project.padColors) {
        if (project.padColors.top) {
          setTopPadColor(project.padColors.top);
          saveDefaultColor('pad', project.padColors.top, 'top');
        }
        if (project.padColors.bottom) {
          setBottomPadColor(project.padColors.bottom);
          saveDefaultColor('pad', project.padColors.bottom, 'bottom');
        }
      }
      if (project.padSizes) {
        const topSize = project.padSizes.top != null && project.padSizes.top > 0 ? project.padSizes.top : 26;
        const bottomSize = project.padSizes.bottom != null && project.padSizes.bottom > 0 ? project.padSizes.bottom : 26;
        setTopPadSize(topSize);
        setBottomPadSize(bottomSize);
        saveDefaultSize('pad', topSize, 'top');
        saveDefaultSize('pad', bottomSize, 'bottom');
      }
      // Restore component colors and sizes
      if (project.componentColors) {
        if (project.componentColors.top) {
          setTopComponentColor(project.componentColors.top);
          saveDefaultColor('component', project.componentColors.top, 'top');
        }
        if (project.componentColors.bottom) {
          setBottomComponentColor(project.componentColors.bottom);
          saveDefaultColor('component', project.componentColors.bottom, 'bottom');
        }
      }
      if (project.componentSizes) {
        const topSize = project.componentSizes.top != null && project.componentSizes.top > 0 ? project.componentSizes.top : 18;
        const bottomSize = project.componentSizes.bottom != null && project.componentSizes.bottom > 0 ? project.componentSizes.bottom : 18;
        setTopComponentSize(topSize);
        setBottomComponentSize(bottomSize);
        saveDefaultSize('component', topSize, 'top');
        saveDefaultSize('component', bottomSize, 'bottom');
      }
      if (project.traceToolLayer) {
        setTraceToolLayer(project.traceToolLayer);
        // If trace tool is active, update brush color and size to match the restored layer
        if (currentTool === 'draw' && drawingMode === 'trace') {
          const layer = project.traceToolLayer;
          setBrushColor(layer === 'top' ? (project.traceColors?.top || topTraceColor) : (project.traceColors?.bottom || bottomTraceColor));
          // Use defaults (6) if values are missing
          // Ensure bottom size is at least 6 (migration for old projects)
          const topSize = project.traceSizes?.top != null && project.traceSizes.top > 0 ? project.traceSizes.top : 6;
          let bottomSize = project.traceSizes?.bottom != null && project.traceSizes.bottom > 0 ? project.traceSizes.bottom : 6;
          if (bottomSize < 6) {
            bottomSize = 6;
          }
          setBrushSize(layer === 'top' ? topSize : bottomSize);
        }
      }
      // Restore tool settings
      if (project.toolSettings) {
        setToolRegistry(prev => {
          const updated = new Map(prev);
          // Restore settings for each tool if present in saved data
          if (project.toolSettings.trace) {
            const traceDef = updated.get('trace');
            if (traceDef) {
              updated.set('trace', { ...traceDef, settings: project.toolSettings.trace });
            }
          }
          if (project.toolSettings.via) {
            const viaDef = updated.get('via');
            if (viaDef) {
              updated.set('via', { ...viaDef, settings: project.toolSettings.via });
            }
          }
          if (project.toolSettings.pad) {
            const padDef = updated.get('pad');
            if (padDef) {
              updated.set('pad', { ...padDef, settings: project.toolSettings.pad });
            }
          }
          if (project.toolSettings.component) {
            const componentDef = updated.get('component');
            if (componentDef) {
              updated.set('component', { ...componentDef, settings: project.toolSettings.component });
            }
          }
          if (project.toolSettings.ground) {
            const groundDef = updated.get('ground');
            if (groundDef) {
              updated.set('ground', { ...groundDef, settings: project.toolSettings.ground });
            }
          }
          if (project.toolSettings.power) {
            const powerDef = updated.get('power');
            if (powerDef) {
              updated.set('power', { ...powerDef, settings: project.toolSettings.power });
            }
          }
          
          // If a tool is currently active, restore its settings immediately
          const currentToolDef = (() => {
            if (currentTool === 'draw' && drawingMode === 'trace') return updated.get('trace');
            if (currentTool === 'draw' && drawingMode === 'via') return updated.get('via');
            if (currentTool === 'draw' && drawingMode === 'pad') return updated.get('pad');
            if (currentTool === 'component') return updated.get('component');
            if (currentTool === 'power') return updated.get('power');
            if (currentTool === 'ground') return updated.get('ground');
            return null;
          })();
          
          if (currentToolDef) {
            setBrushColor(currentToolDef.settings.color);
            setBrushSize(currentToolDef.settings.size);
          }
          
          return updated;
        });
      }
      // Helper to build PCBImage from saved data
      const buildImage = async (img: any): Promise<PCBImage | null> => {
        if (!img) return null;
        let bitmap: ImageBitmap | null = null;
        if (img.dataUrl) {
          const blob = await (await fetch(img.dataUrl)).blob();
          bitmap = await createImageBitmap(blob);
        }
        return {
          url: img.dataUrl ?? '',
          name: img.name ?? 'image',
          width: img.width ?? (bitmap ? bitmap.width : 0),
          height: img.height ?? (bitmap ? bitmap.height : 0),
          dataUrl: img.dataUrl,
          x: img.x ?? 0,
          y: img.y ?? 0,
          scale: img.scale ?? 1,
          rotation: img.rotation ?? 0,
          flipX: !!img.flipX,
          flipY: !!img.flipY,
          skewX: img.skewX ?? 0,
          skewY: img.skewY ?? 0,
          keystoneV: img.keystoneV ?? 0,
          keystoneH: img.keystoneH ?? 0,
          bitmap,
        };
      };
      const newTop = await buildImage(project.images?.top);
      const newBottom = await buildImage(project.images?.bottom);
      setTopImage(newTop);
      setBottomImage(newBottom);

      // Restore point ID counter if present (for new projects, start from saved value)
      if (project.pointIdCounter && typeof project.pointIdCounter === 'number') {
        setPointIdCounter(project.pointIdCounter);
      }
      
      // Restore lock states if present
      if (project.locks) {
        // Support both new and old property names for backward compatibility
        if (typeof project.locks.areImagesLocked === 'boolean') {
          setAreImagesLocked(project.locks.areImagesLocked);
        } else if (typeof (project.locks as any).isImagesLocked === 'boolean') {
          // Legacy: support old name
          setAreImagesLocked((project.locks as any).isImagesLocked);
        }
        if (typeof project.locks.areViasLocked === 'boolean') setAreViasLocked(project.locks.areViasLocked);
        if (typeof project.locks.arePadsLocked === 'boolean') setArePadsLocked(project.locks.arePadsLocked);
        if (typeof project.locks.areTracesLocked === 'boolean') setAreTracesLocked(project.locks.areTracesLocked);
        if (typeof project.locks.areComponentsLocked === 'boolean') setAreComponentsLocked(project.locks.areComponentsLocked);
        // Support both new and old property names for backward compatibility
        if (typeof project.locks.areGroundNodesLocked === 'boolean') {
          setAreGroundNodesLocked(project.locks.areGroundNodesLocked);
        } else if (typeof (project.locks as any).isGroundLocked === 'boolean') {
          // Legacy: support old name
          setAreGroundNodesLocked((project.locks as any).isGroundLocked);
        }
        if (typeof project.locks.arePowerNodesLocked === 'boolean') setArePowerNodesLocked(project.locks.arePowerNodesLocked);
      }

      // Restore visibility states if present
      if (project.visibility) {
        if (typeof project.visibility.showViasLayer === 'boolean') setShowViasLayer(project.visibility.showViasLayer);
        if (typeof project.visibility.showTopPadsLayer === 'boolean') setShowTopPadsLayer(project.visibility.showTopPadsLayer);
        if (typeof project.visibility.showBottomPadsLayer === 'boolean') setShowBottomPadsLayer(project.visibility.showBottomPadsLayer);
        if (typeof project.visibility.showTopTracesLayer === 'boolean') setShowTopTracesLayer(project.visibility.showTopTracesLayer);
        if (typeof project.visibility.showBottomTracesLayer === 'boolean') setShowBottomTracesLayer(project.visibility.showBottomTracesLayer);
        if (typeof project.visibility.showTopComponents === 'boolean') setShowTopComponents(project.visibility.showTopComponents);
        if (typeof project.visibility.showBottomComponents === 'boolean') setShowBottomComponents(project.visibility.showBottomComponents);
        if (typeof project.visibility.showPowerLayer === 'boolean') setShowPowerLayer(project.visibility.showPowerLayer);
        if (typeof project.visibility.showGroundLayer === 'boolean') setShowGroundLayer(project.visibility.showGroundLayer);
      }

      // Restore auto save settings if present
      if (project.autoSave) {
        if (typeof project.autoSave.enabled === 'boolean') {
          setAutoSaveEnabled(project.autoSave.enabled);
        }
        if (typeof project.autoSave.interval === 'number') {
          setAutoSaveInterval(project.autoSave.interval);
        }
        if (typeof project.autoSave.baseName === 'string' && project.autoSave.baseName) {
          setAutoSaveBaseName(project.autoSave.baseName);
          // Update ref immediately
          autoSaveBaseNameRef.current = project.autoSave.baseName;
          // Directory handle cannot be restored from file handle (browser security restriction)
          // If auto save is enabled but directory handle is missing, disable auto save
          // User will need to re-enable it and select the directory again
          if (project.autoSave.enabled && !autoSaveDirHandle) {
            // This is expected behavior after page reload - directory handles can't be persisted
            // Silently disable auto save (user can re-enable via menu)
            // Only log at debug level, not as a warning
            console.log('Auto save: Directory handle not available after page reload (expected). Auto save disabled. Use File -> Auto Save -> Enable to re-enable.');
            setAutoSaveEnabled(false);
            setAutoSaveInterval(null);
            // Keep base name so user doesn't have to re-enter it
          }
        } else {
          // If auto save is enabled but base name is missing, disable auto save
          // User will need to re-enable it and provide the base name
          if (project.autoSave.enabled) {
            console.warn('Auto save was enabled in project file but base name is missing. Disabling auto save.');
            setAutoSaveEnabled(false);
            setAutoSaveInterval(null);
            setAutoSaveBaseName('');
            autoSaveBaseNameRef.current = '';
          }
        }
      } else {
        // Default: disable auto save when opening a project without auto save settings
        setAutoSaveEnabled(false);
        setAutoSaveInterval(null);
        setAutoSaveDirHandle(null);
        setAutoSaveBaseName('');
        autoSaveDirHandleRef.current = null;
        autoSaveBaseNameRef.current = '';
        if (autoSaveIntervalRef.current) {
          clearInterval(autoSaveIntervalRef.current);
          autoSaveIntervalRef.current = null;
        }
      }

      // Restore drawing strokes - prefer saved drawingStrokes with point IDs
      if (project.drawing?.drawingStrokes && Array.isArray(project.drawing.drawingStrokes)) {
        // New format: restore strokes with preserved point IDs
        // Truncate coordinates to 3 decimal places for consistency with new objects
        // Filter out single-point traces (traces must have at least 2 points to form a line)
        // Keep vias (which are single points by design) and traces with 2+ points
        const validStrokes = (project.drawing.drawingStrokes as DrawingStroke[]).map(s => ({
          ...s,
          points: s.points.map(p => ({
            ...p,
            ...truncatePoint(p)
          }))
        })).filter(s => {
          if (s.type === 'trace' && s.points.length < 2) {
            return false; // Remove single-point traces
          }
          return true; // Keep vias and valid traces
        });
        setDrawingStrokes(validStrokes);
      } else {
        // Legacy format: rebuild from vias/traces arrays (point IDs will be regenerated)
        const strokes: DrawingStroke[] = [];
        const pushVia = (v: Via, layer: 'top' | 'bottom') => {
          // Truncate coordinates to 3 decimal places for consistency with new objects
          const truncatedPos = truncatePoint({ x: v.x, y: v.y });
          strokes.push({
            id: v.id || `${Date.now()}-via-${Math.random()}`,
            points: [{ 
              id: v.pointId || generatePointId(), // Use saved point ID or generate new
              x: truncatedPos.x, 
              y: truncatedPos.y 
            }],
            color: v.color,
            size: v.size,
            layer,
            type: 'via',
          });
        };
        const pushSeg = (s: TraceSegment, layer: 'top' | 'bottom') => {
          // For legacy format, create separate strokes for each segment
          // This loses the original stroke grouping but preserves point IDs
          // Truncate coordinates to 3 decimal places for consistency with new objects
          const startPos = truncatePoint({ x: s.x1, y: s.y1 });
          const endPos = truncatePoint({ x: s.x2, y: s.y2 });
          strokes.push({
            id: s.id || `${Date.now()}-trace-${Math.random()}`,
            points: [
              { id: s.startPointId || generatePointId(), x: startPos.x, y: startPos.y },
              { id: s.endPointId || generatePointId(), x: endPos.x, y: endPos.y }
            ],
            color: s.color,
            size: s.size,
            layer,
            type: 'trace',
          });
        };
        // Back-compat: support either single 'vias' array or legacy viasTop/viasBottom
        if (project.drawing?.vias) {
          (project.drawing.vias as Via[]).forEach((v: Via) => pushVia(v, 'top'));
        } else {
          (project.drawing?.viasTop ?? []).forEach((v: Via) => pushVia(v, 'top'));
          (project.drawing?.viasBottom ?? []).forEach((v: Via) => pushVia(v, 'bottom'));
        }
        (project.drawing?.tracesTop ?? []).forEach((s: TraceSegment) => pushSeg(s, 'top'));
        (project.drawing?.tracesBottom ?? []).forEach((s: TraceSegment) => pushSeg(s, 'bottom'));
        // Filter out single-point traces (traces must have at least 2 points to form a line)
        // Keep vias (which are single points by design) and traces with 2+ points
        const validStrokes = strokes.filter(s => {
          if (s.type === 'trace' && s.points.length < 2) {
            return false; // Remove single-point traces
          }
          return true; // Keep vias and valid traces
        });
        setDrawingStrokes(validStrokes);
      }
      // load components if present, ensuring all properties are preserved including layer
      if (project.drawing?.componentsTop) {
        const compsTop = (project.drawing.componentsTop as PCBComponent[]).map(comp => {
          // Truncate coordinates to 3 decimal places for consistency with new objects
          const truncatedPos = truncatePoint({ x: comp.x, y: comp.y });
          return {
            ...comp,
            x: truncatedPos.x,
            y: truncatedPos.y,
            layer: comp.layer || 'top', // Ensure layer property is set (default to 'top' for backward compatibility)
            // Ensure pinConnections is always an array
            pinConnections: comp.pinConnections || new Array(comp.pinCount || 0).fill(''),
          };
        });
        setComponentsTop(compsTop);
      }
      if (project.drawing?.componentsBottom) {
        const compsBottom = (project.drawing.componentsBottom as PCBComponent[]).map(comp => {
          // Truncate coordinates to 3 decimal places for consistency with new objects
          const truncatedPos = truncatePoint({ x: comp.x, y: comp.y });
          return {
            ...comp,
            x: truncatedPos.x,
            y: truncatedPos.y,
            layer: comp.layer || 'bottom', // Ensure layer property is set (default to 'bottom' for backward compatibility)
            // Ensure pinConnections is always an array
            pinConnections: comp.pinConnections || new Array(comp.pinCount || 0).fill(''),
          };
        });
        setComponentsBottom(compsBottom);
      }
      if (project.drawing?.grounds) {
        const loadedGrounds = project.drawing.grounds as GroundSymbol[];
        // Filter out ground symbols with invalid coordinates (in border area or negative)
        // Also ensure pointId exists (for legacy projects without it)
        const validGrounds = loadedGrounds
          .map(g => {
            // Ensure pointId exists (for legacy projects without it)
            const pointId = g.pointId || generatePointId();
            // Truncate coordinates to 3 decimal places for consistency with new objects
            const truncatedPos = truncatePoint({ x: g.x, y: g.y });
            return { ...g, pointId, x: truncatedPos.x, y: truncatedPos.y };
          })
          .filter(g => {
            const isValid = g.y >= 0 && g.x >= 0 && 
                           typeof g.x === 'number' && typeof g.y === 'number' && 
                           !isNaN(g.x) && !isNaN(g.y) &&
                           isFinite(g.x) && isFinite(g.y);
            if (!isValid) {
              console.warn(`Filtered out invalid ground symbol at (${g.x}, ${g.y}) - likely in border area or invalid coordinates`);
            }
            return isValid;
          });
        setGrounds(validGrounds);
      }
      // Load power buses first (needed for legacy power node migration)
      let busesToUse = powerBuses; // Default buses
      if (project.powerBuses && Array.isArray(project.powerBuses)) {
        busesToUse = project.powerBuses as PowerBus[];
        setPowerBuses(busesToUse);
      }
      if (project.drawing?.powers) {
        const loadedPowers = project.drawing.powers as PowerSymbol[];
        // Ensure all power nodes have a powerBusId and layer (for legacy projects)
        // Also filter out power nodes with invalid coordinates (in border area or negative)
        const powersWithBusId = loadedPowers
          .map(p => {
            // Ensure pointId exists (for legacy projects without it)
            const pointId = p.pointId || generatePointId();
            // Truncate coordinates to 3 decimal places for consistency with new objects
            const truncatedPos = truncatePoint({ x: p.x, y: p.y });
            if (!p.powerBusId) {
              // Assign to first power bus or create a default one
              return { ...p, pointId, x: truncatedPos.x, y: truncatedPos.y, powerBusId: busesToUse.length > 0 ? busesToUse[0].id : 'default-5v', layer: p.layer || 'top' };
            }
            return { ...p, pointId, x: truncatedPos.x, y: truncatedPos.y, layer: p.layer || 'top' };
          })
          .filter(p => {
            // Filter out power nodes with negative coordinates or invalid values
            // These are likely accidentally placed in the border area or corrupted data
            // Coordinates are in content space, so they should be >= 0
            const isValid = p.y >= 0 && p.x >= 0 && 
                           typeof p.x === 'number' && typeof p.y === 'number' && 
                           !isNaN(p.x) && !isNaN(p.y) &&
                           isFinite(p.x) && isFinite(p.y);
            if (!isValid) {
              console.warn(`Filtered out invalid power node at (${p.x}, ${p.y}) - likely in border area or invalid coordinates`);
            }
            return isValid;
          });
        setPowers(powersWithBusId);
      }
      // Reset change tracking for auto save after loading project
      hasChangesSinceLastAutoSaveRef.current = false;
    } catch (err) {
      console.error('Failed to open project', err);
      alert('Failed to open project file. See console for details.');
    }
  }, [currentTool, drawingMode]);

  // Function to get list of auto-saved files from history subdirectory, sorted by timestamp
  // COMMENTED OUT: File history navigation is disabled
  const refreshAutoSaveFileHistory = useCallback(async () => {
    // File history navigation is disabled - this function is kept for potential future use
    return;
    /*
    const dirHandle = autoSaveDirHandleRef.current;
    const baseName = autoSaveBaseNameRef.current;
    
    if (!dirHandle || !baseName) return;
    
    try {
      // Get history subdirectory
      let historyDirHandle: FileSystemDirectoryHandle;
      try {
        historyDirHandle = await dirHandle.getDirectoryHandle('history', { create: false });
      } catch (e) {
        // History directory doesn't exist yet
        setAutoSaveFileHistory([]);
        autoSaveFileHistoryRef.current = [];
        setCurrentFileIndex(-1);
        currentFileIndexRef.current = -1;
        return;
      }
      
      const files: string[] = [];
      // Iterate through directory entries
      // File System Access API: use keys() to get file names, then check if it's a file
      for await (const name of (historyDirHandle as any).keys()) {
        try {
          // Try to get the file handle to verify it's a file
          await historyDirHandle.getFileHandle(name);
          if (name.startsWith(baseName) && name.endsWith('.json')) {
            files.push(name);
          }
        } catch (e) {
          // Skip if not a file or doesn't exist
          continue;
        }
      }
      // Sort by filename (which includes timestamp) in descending order (newest first)
      files.sort((a, b) => b.localeCompare(a));
      setAutoSaveFileHistory(files);
      autoSaveFileHistoryRef.current = files;
      
      // Find current file index
      const currentFile = currentProjectFilePath;
      const index = files.indexOf(currentFile);
      setCurrentFileIndex(index);
      currentFileIndexRef.current = index;
    } catch (e) {
      console.error('Failed to refresh file history:', e);
    }
    */
  }, [currentProjectFilePath]);

  // Function to load a file from auto-save history
  const loadFileFromHistory = useCallback(async (filename: string) => {
    const dirHandle = autoSaveDirHandleRef.current;
    if (!dirHandle) {
      console.warn('Cannot load file: no directory handle');
      return;
    }
    
    try {
      const fileHandle = await dirHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      
      // Check if file is empty
      if (file.size === 0) {
        console.warn(`File ${filename} is empty, skipping`);
        // Remove empty file from history
        const history = autoSaveFileHistoryRef.current;
        const newHistory = history.filter((f: string) => f !== filename);
        setAutoSaveFileHistory(newHistory);
        autoSaveFileHistoryRef.current = newHistory;
        return;
      }
      
      const text = await file.text();
      
      // Check if text is empty or whitespace only
      if (!text || text.trim().length === 0) {
        console.warn(`File ${filename} contains no data, skipping`);
        // Remove invalid file from history
        const history = autoSaveFileHistoryRef.current;
        const newHistory = history.filter((f: string) => f !== filename);
        setAutoSaveFileHistory(newHistory);
        autoSaveFileHistoryRef.current = newHistory;
        return;
      }
      
      let project;
      try {
        project = JSON.parse(text);
      } catch (parseError) {
        console.error(`Failed to parse JSON from file ${filename}:`, parseError);
        // Remove invalid file from history
        const history = autoSaveFileHistoryRef.current;
        const newHistory = history.filter((f: string) => f !== filename);
        setAutoSaveFileHistory(newHistory);
        autoSaveFileHistoryRef.current = newHistory;
        // Refresh history to update UI
        await refreshAutoSaveFileHistory();
        return;
      }
      
      // Call initialization BEFORE loading project to prevent visual flash
      // This sets the view state before the images are rendered
      // Set defaults immediately
      initializeApplicationDefaults();
      // Set view state immediately (synchronously) to prevent flash
      setViewScale(1);
      // Reset browser zoom to 100% immediately
      if (document.body) {
        document.body.style.zoom = '1';
      }
      if (document.documentElement) {
        document.documentElement.style.zoom = '1';
      }
      // Clear all selections immediately
      setSelectedIds(new Set());
      setSelectedComponentIds(new Set());
      setSelectedPowerIds(new Set());
      setSelectedGroundIds(new Set());
      // Also call full initialization for pan calculation (uses setTimeout)
      initializeApplication();
      
      await loadProject(project);
      setCurrentProjectFilePath(filename);
      
      // Update history and index
      const history = autoSaveFileHistoryRef.current;
      const index = history.indexOf(filename);
      if (index >= 0) {
        setCurrentFileIndex(index);
        currentFileIndexRef.current = index;
      } else {
        // File not in history, refresh it
        await refreshAutoSaveFileHistory();
      }
      
      // Reset change tracking since we loaded a saved file
      hasChangesSinceLastAutoSaveRef.current = false;
    } catch (e) {
      console.error('Failed to load file from history:', e);
      // Don't show alert for navigation errors, just log
      // Remove invalid file from history if it exists
      const history = autoSaveFileHistoryRef.current;
      if (history.includes(filename)) {
        const newHistory = history.filter((f: string) => f !== filename);
        setAutoSaveFileHistory(newHistory);
        autoSaveFileHistoryRef.current = newHistory;
        // Refresh history to update UI
        await refreshAutoSaveFileHistory();
      }
    }
  }, [loadProject, refreshAutoSaveFileHistory, initializeApplication]);

  // Navigate to previous file (older file, higher index) - reserved for future use
  // @ts-ignore - Reserved for future use
  const _navigateToPreviousFile = useCallback(async () => {
    const index = currentFileIndexRef.current;
    const history = autoSaveFileHistoryRef.current;
    if (index >= 0 && index < history.length - 1) {
      const nextIndex = index + 1; // Next index is older (higher index)
      const nextFile = history[nextIndex];
      if (nextFile) {
        await loadFileFromHistory(nextFile);
      }
    }
  }, [loadFileFromHistory]);

  // Navigate to next file (newer file, lower index) - reserved for future use
  // @ts-ignore - Reserved for future use
  const _navigateToNextFile = useCallback(async () => {
    const index = currentFileIndexRef.current;
    const history = autoSaveFileHistoryRef.current;
    
    // Early return if conditions aren't met
    if (index <= 0 || index >= history.length || history.length === 0) {
      console.warn('Cannot navigate to newer file: index is', index, 'history length is', history.length);
      return;
    }
    
    // Only navigate if we're not at the newest file (index 0) and there's a file to navigate to
    // Also check that index is valid and within bounds
    if (index > 0 && index < history.length && history.length > 0) {
      const prevIndex = index - 1; // Previous index is newer (lower index)
      if (prevIndex >= 0 && prevIndex < history.length) {
        const prevFile = history[prevIndex];
        if (prevFile) {
          await loadFileFromHistory(prevFile);
        } else {
          console.warn('No newer file found at index', prevIndex);
          // Refresh history in case files were removed
          await refreshAutoSaveFileHistory();
        }
      } else {
        console.warn('Cannot navigate to newer file: prevIndex', prevIndex, 'is out of bounds');
      }
    }
  }, [loadFileFromHistory, refreshAutoSaveFileHistory]);

  React.useEffect(() => {
    currentStrokeRef.current = currentStroke;
  }, [currentStroke]);

  // Finalize in-progress trace when switching mode (not on layer change) to avoid unintended commits
  const prevModeRef = React.useRef<'trace' | 'via' | 'pad'>(drawingMode);
  const prevLayerRef = React.useRef<'top' | 'bottom'>(selectedDrawingLayer);
  React.useEffect(() => {
    // Only react when mode actually changed; do NOT auto-finalize on layer change
    const modeChanged = drawingMode !== prevModeRef.current;
    if (currentTool === 'draw' && prevModeRef.current === 'trace' && modeChanged) {
      // finalize without losing the current points
      if (currentStrokeRef.current.length >= 2) {
        const newStroke: DrawingStroke = {
          id: `${Date.now()}-trace-autofinalize`,
          points: currentStrokeRef.current,
          color: brushColor,
          size: brushSize,
          layer: prevLayerRef.current,
          type: 'trace',
        };
        setDrawingStrokes(prev => [...prev, newStroke]);
        if (prevLayerRef.current === 'top') {
          setTraceOrderTop(prev => [...prev, newStroke.id]);
        } else {
          setTraceOrderBottom(prev => [...prev, newStroke.id]);
        }
      }
      setCurrentStroke([]);
      setIsDrawing(false);
    }
    prevModeRef.current = drawingMode;
    prevLayerRef.current = selectedDrawingLayer;
  }, [drawingMode, selectedDrawingLayer, currentTool, brushColor, brushSize]);

  // Simple HSV -> HEX for palette generation (currently unused)
  // const hsvToHex = useCallback((h: number, s: number, v: number): string => {
  //   const c = v * s;
  //   const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  //   const m = v - c;
  //   let r = 0, g = 0, b = 0;
  //   if (h < 60) { r = c; g = x; b = 0; }
  //   else if (h < 120) { r = x; g = c; b = 0; }
  //   else if (h < 180) { r = 0; g = c; b = x; }
  //   else if (h < 240) { r = 0; g = x; b = c; }
  //   else if (h < 300) { r = x; g = 0; b = c; }
  //   else { r = c; g = 0; b = x; }
  //   const R = Math.round((r + m) * 255);
  //   const G = Math.round((g + m) * 255);
  //   const B = Math.round((b + m) * 255);
  //   const toHex = (n: number) => n.toString(16).padStart(2, '0');
  //   return `#${toHex(R)}${toHex(G)}${toHex(B)}`;
  // }, []);

  // High-contrast 32-color palette tuned for PCB work (includes grays/blacks)
  const palette8x8 = React.useMemo(() => ([
    // Neutrals (4)
    '#000000', '#3C3C3C', '#7F7F7F', '#BFBFBF',
    // Blues/Cyans (8)
    '#0072B2', '#56B4E9', '#00BFC4', '#332288',
    '#1F77B4', '#A6CEE3', '#17BECF', '#6A3D9A',
    // Greens/Yellows (8)
    '#009E73', '#B3DE69', '#E69F00', '#F0E442',
    '#2CA02C', '#B2DF8A', '#BCBD22', '#FFED6F',
    // Reds/Purples/Browns (12)
    '#E15759', '#D62728', '#FB9A99', '#CC79A7',
    '#AA4499', '#F781BF', '#9467BD', '#CAB2D6',
    '#9C755F', '#8C564B', '#FF7F0E', '#FFFFFF',
  ]), []);

  // Force redraw when drawingStrokes change (for eraser)
  React.useEffect(() => {
    drawCanvas();
  }, [drawingStrokes]);
  // Redraw when components change (add/remove/edit)
  React.useEffect(() => {
    drawCanvas();
  }, [componentsTop, componentsBottom, grounds, showGroundLayer]);

  // Keep scrollbars in sync with viewPan changes from other interactions
  React.useEffect(() => {
    const h = hScrollRef.current;
    const v = vScrollRef.current;
    isSyncingScrollRef.current = true;
    if (h) {
      const maxX = Math.max(0, h.scrollWidth - h.clientWidth);
      const origin = contentOriginXRef.current;
      const desired = Math.max(0, Math.min(maxX, -(viewPan.x + origin)));
      if (Math.abs(h.scrollLeft - desired) > 0.5) h.scrollLeft = desired;
    }
    if (v) {
      const maxY = Math.max(0, v.scrollHeight - v.clientHeight);
      const origin = contentOriginYRef.current;
      const desired = Math.max(0, Math.min(maxY, -(viewPan.y + origin)));
      if (Math.abs(v.scrollTop - desired) > 0.5) v.scrollTop = desired;
    }
    requestAnimationFrame(() => { isSyncingScrollRef.current = false; });
  }, [viewPan.x, viewPan.y]);

  // Determine if we're in read-only mode (viewing file history, not the most recent file)
  const isReadOnlyMode = currentFileIndex > 0;

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔧 PCB Reverse Engineering Tool (v2.0)</h1>
      </header>

      {/* Application menu bar */}
      <div ref={menuBarRef} style={{ position: 'relative', background: 'rgba(250,250,255,0.9)', borderBottom: '1px solid #e6e6ef', padding: '6px 12px', display: 'flex', gap: 16, alignItems: 'center', zIndex: 3 }}>
        {/* File menu */}
        <div style={{ position: 'relative' }}>
          <button 
            onClick={(e) => { e.stopPropagation(); setOpenMenu(m => m === 'file' ? null : 'file'); }} 
            style={{ 
              padding: '6px 10px', 
              borderRadius: 6, 
              border: '1px solid #ddd', 
              background: openMenu === 'file' ? '#eef3ff' : '#fff', 
              fontWeight: 600, 
              color: '#222'
            }}
          >
            File ▾
          </button>
          {openMenu === 'file' && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 200, background: '#2b2b31', border: '1px solid #1f1f24', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', padding: 6 }}>
              <button 
                onClick={() => {
                  if (!isReadOnlyMode) {
                    setOpenMenu(null);
                    if (hasUnsavedChanges()) {
                      setNewProjectDialog({ visible: true });
                    } else {
                      newProject();
                    }
                  }
                }} 
                disabled={isReadOnlyMode}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isReadOnlyMode ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
              >
                New Project
              </button>
              <button onClick={async () => {
                const w = window as any;
                if (typeof w.showOpenFilePicker === 'function') {
                  try {
                    // Don't use restrictive types filter - accept all files and let user filter
                    const [handle] = await w.showOpenFilePicker({
                      multiple: false,
                      // Remove types filter to allow all .json files regardless of MIME type
                    });
                    const file = await handle.getFile();
                    // Only accept .json files
                    if (!file.name.toLowerCase().endsWith('.json')) {
                      alert('Please select a .json project file.');
                      setOpenMenu(null);
                      return;
                    }
                    // Update current project file path
                    setCurrentProjectFilePath(file.name);
                    const text = await file.text();
                    const project = JSON.parse(text);
                    
                    // Try to get the directory handle from the file handle
                    // Note: FileSystemFileHandle doesn't expose parent directly, but we can try to get it
                    // For now, we'll store the file handle and try to get directory when saving
                    // The directory handle will be restored when user saves next time
                    
                    await loadProject(project);
                    
                    // Extract project name from project data or filename
                    let projectNameToUse: string;
                    if (project.projectInfo?.name) {
                      // Project name is already restored from project data in loadProject
                      projectNameToUse = project.projectInfo.name;
                    } else {
                      // Extract from filename (remove .json extension)
                      const projectNameFromFile = file.name.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
                      projectNameToUse = projectNameFromFile || 'pcb_project';
                      setProjectName(projectNameToUse);
                      localStorage.setItem('pcb_project_name', projectNameToUse);
                    }
                    
                    // Ensure project name is set (loadProject may have set it, but verify)
                    if (!projectName) {
                      setProjectName(projectNameToUse);
                      localStorage.setItem('pcb_project_name', projectNameToUse);
                    }
                    
                    // Auto save settings are restored from project file if present
                    // Check if auto-save is enabled in the project file
                    // Use setTimeout to allow React state updates from loadProject to complete
                    setTimeout(() => {
                      // Check both the original project data and current state
                      // If project file doesn't have autoSave enabled, or if it was disabled by loadProject
                      // (e.g., due to missing directory handle), show the prompt
                      const wasAutoSaveEnabledInFile = project.autoSave?.enabled === true;
                      if (!wasAutoSaveEnabledInFile) {
                        setAutoSavePromptDialog({ visible: true, source: 'open' });
                      }
                    }, 100);
                    
                    setOpenMenu(null);
                    return;
                  } catch (e) {
                    if ((e as any)?.name === 'AbortError') { setOpenMenu(null); return; }
                    console.warn('showOpenFilePicker failed, falling back to input', e);
                  }
                }
                openProjectRef.current?.click();
                setOpenMenu(null);
              }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Open Project…</button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button 
                onClick={() => { if (!isReadOnlyMode) { void saveProject(); setOpenMenu(null); } }} 
                disabled={isReadOnlyMode}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isReadOnlyMode ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
              >
                Save Project…
              </button>
              <button 
                onClick={() => { if (!isReadOnlyMode) { openSaveAsDialog(); setOpenMenu(null); } }} 
                disabled={isReadOnlyMode}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isReadOnlyMode ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
              >
                Save As…
              </button>
              <button 
                onClick={() => { 
                  if (!isReadOnlyMode) { 
                    // Show dialog with 5 minutes as default
                    setAutoSaveDialog({ visible: true, interval: 5 });
                    setOpenMenu(null);
                  }
                }} 
                disabled={isReadOnlyMode}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isReadOnlyMode ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
              >
                Auto Save…
              </button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button
                onClick={() => {
                  if (!isReadOnlyMode) {
                    void exportSimpleSchematic(); 
                    setOpenMenu(null); 
                  }
                }} 
                disabled={isReadOnlyMode}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isReadOnlyMode ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
              >
                Export Simple Schematic…
              </button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button onClick={() => { handlePrint(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Print…</button>
              <button onClick={() => { handlePrint(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Printer Settings…</button>
            </div>
          )}
        </div>

        {/* Images menu */}
        <div style={{ position: 'relative' }}>
          <button 
            onClick={(e) => { if (!isReadOnlyMode) { e.stopPropagation(); setOpenMenu(m => m === 'transform' ? null : 'transform'); } }} 
            disabled={isReadOnlyMode}
            style={{ 
              padding: '6px 10px', 
              borderRadius: 6, 
              border: '1px solid #ddd', 
              background: openMenu === 'transform' ? '#eef3ff' : '#fff', 
              fontWeight: 600, 
              color: isReadOnlyMode ? '#999' : '#222',
              cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
              opacity: isReadOnlyMode ? 0.5 : 1
            }}
          >
            Images ▾
          </button>
          {openMenu === 'transform' && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 260, background: '#2b2b31', border: '1px solid #1f1f24', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', padding: 6 }}>
              <div style={{ padding: '4px 10px', fontSize: 12, color: '#bbb' }}>Load Images</div>
              <button 
                onClick={() => { if (!isReadOnlyMode) { fileInputTopRef.current?.click(); setOpenMenu(null); } }} 
                disabled={isReadOnlyMode}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isReadOnlyMode ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
              >
                Load Top PCB…
              </button>
              <button 
                onClick={() => { if (!isReadOnlyMode) { fileInputBottomRef.current?.click(); setOpenMenu(null); } }} 
                disabled={isReadOnlyMode}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: isReadOnlyMode ? '#777' : '#f2f2f2', background: 'transparent', border: 'none', cursor: isReadOnlyMode ? 'not-allowed' : 'pointer' }}
              >
                Load Bottom PCB…
              </button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <div style={{ padding: '4px 10px', fontSize: 12, color: '#bbb' }}>Select Image</div>
              <button disabled={!topImage} onClick={() => { setSelectedImageForTransform('top'); setCurrentTool('transform'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: topImage ? '#f2f2f2' : '#777', background: 'transparent', border: 'none' }}>{selectedImageForTransform === 'top' ? '✓ ' : ''}Top Image</button>
              <button disabled={!bottomImage} onClick={() => { setSelectedImageForTransform('bottom'); setCurrentTool('transform'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: bottomImage ? '#f2f2f2' : '#777', background: 'transparent', border: 'none' }}>{selectedImageForTransform === 'bottom' ? '✓ ' : ''}Bottom Image</button>
              <button disabled={!topImage || !bottomImage} onClick={() => { setSelectedImageForTransform('both'); setCurrentTool('transform'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: (topImage && bottomImage) ? '#f2f2f2' : '#777', background: 'transparent', border: 'none' }}>{selectedImageForTransform === 'both' ? '✓ ' : ''}Both Images</button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button onClick={() => { 
                if (selectedImageForTransform) {
                  if (selectedImageForTransform === 'both') {
                    // For both, toggle based on top image state
                    const newFlipX = !(topImage?.flipX || false);
                    updateImageTransform('both', { flipX: newFlipX });
                  } else {
                    const currentFlipX = selectedImageForTransform === 'top' ? (topImage?.flipX || false) : (bottomImage?.flipX || false);
                    updateImageTransform(selectedImageForTransform, { flipX: !currentFlipX });
                  }
                }
                setOpenMenu(null);
              }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Toggle Horizontal Flip</button>
              <button onClick={() => { 
                if (selectedImageForTransform) {
                  if (selectedImageForTransform === 'both') {
                    // For both, toggle based on top image state
                    const newFlipY = !(topImage?.flipY || false);
                    updateImageTransform('both', { flipY: newFlipY });
                  } else {
                    const currentFlipY = selectedImageForTransform === 'top' ? (topImage?.flipY || false) : (bottomImage?.flipY || false);
                    updateImageTransform(selectedImageForTransform, { flipY: !currentFlipY });
                  }
                }
                setOpenMenu(null);
              }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Toggle Vertical Flip</button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button onClick={() => { setTransformMode('nudge'); setCurrentTool('transform'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>{transformMode === 'nudge' ? '✓ ' : ''}Mode: Nudge</button>
              <button onClick={() => { setTransformMode('scale'); setCurrentTool('transform'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>{transformMode === 'scale' ? '✓ ' : ''}Mode: Scale</button>
              <button onClick={() => { setTransformMode('rotate'); setCurrentTool('transform'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>{transformMode === 'rotate' ? '✓ ' : ''}Mode: Rotate</button>
              <button onClick={() => { setTransformMode('slant'); setCurrentTool('transform'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>{transformMode === 'slant' ? '✓ ' : ''}Mode: Slant</button>
              <button onClick={() => { setTransformMode('keystone'); setCurrentTool('transform'); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>{transformMode === 'keystone' ? '✓ ' : ''}Mode: Keystone</button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button onClick={() => {
                setCurrentTool('transform');
                if (isGrayscale || isBlackAndWhiteEdges) {
                  setIsGrayscale(false);
                  setIsBlackAndWhiteEdges(false);
                  setIsBlackAndWhiteInverted(false);
                } else {
                  setIsGrayscale(true);
                }
                setOpenMenu(null);
              }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
                {(isGrayscale || isBlackAndWhiteEdges) ? 'Color Mode' : 'Grayscale Mode'}
              </button>
              <button onClick={() => {
                setCurrentTool('transform');
                if (!isBlackAndWhiteEdges) {
                  setIsBlackAndWhiteEdges(true);
                  setIsBlackAndWhiteInverted(false);
                } else {
                  setIsBlackAndWhiteInverted(prev => !prev);
                }
                setOpenMenu(null);
              }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
                {isBlackAndWhiteEdges ? 'Invert Edges' : 'Black & White Edges'}
              </button>
              <button onClick={() => { setCurrentTool('transform'); resetImageTransform(); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>Reset Transform</button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button onClick={() => { setAreImagesLocked(prev => !prev); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
                Lock Images {areImagesLocked ? '✓' : ''}
              </button>
            </div>
          )}
        </div>
        {/* Tools menu */}
        <div style={{ position: 'relative' }}>
          <button 
            onClick={(e) => { if (!isReadOnlyMode) { e.stopPropagation(); setOpenMenu(m => m === 'tools' ? null : 'tools'); } }} 
            disabled={isReadOnlyMode}
            style={{ 
              padding: '6px 10px', 
              borderRadius: 6, 
              border: '1px solid #ddd', 
              background: openMenu === 'tools' ? '#eef3ff' : '#fff', 
              fontWeight: 600, 
              color: isReadOnlyMode ? '#999' : '#222',
              cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
              opacity: isReadOnlyMode ? 0.5 : 1
            }}
          >
            Tools ▾
          </button>
          {openMenu === 'tools' && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 220, background: '#2b2b31', border: '1px solid #1f1f24', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', padding: 6 }}>
              <button
                onClick={() => {
                  increaseSize();
                  setOpenMenu(null);
                }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}
              >
                Increase Size (+)
              </button>
              <button
                onClick={() => {
                  decreaseSize();
                  setOpenMenu(null);
                }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}
              >
                Decrease Size (-)
              </button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button 
                onClick={() => {
                  // Determine current size to show in dialog
                  let currentSize = brushSize;
                  if (selectedIds.size > 0) {
                    const selectedStrokes = drawingStrokes.filter(s => selectedIds.has(s.id));
                    if (selectedStrokes.length > 0) {
                      currentSize = selectedStrokes[0].size;
                    }
                  } else if (selectedComponentIds.size > 0) {
                    const selectedComp = [...componentsTop, ...componentsBottom].find(c => selectedComponentIds.has(c.id));
                    if (selectedComp) {
                      currentSize = selectedComp.size || 18;
                    }
                  } else if (selectedPowerIds.size > 0) {
                    const selectedPower = powers.find(p => selectedPowerIds.has(p.id));
                    if (selectedPower) {
                      currentSize = selectedPower.size;
                    }
                  } else if (selectedGroundIds.size > 0) {
                    const selectedGround = grounds.find(g => selectedGroundIds.has(g.id));
                    if (selectedGround) {
                      currentSize = selectedGround.size || 18;
                    }
                  }
                  setSetSizeDialog({ visible: true, size: currentSize });
                  setOpenMenu(null);
                }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}
              >
                Set Size…
              </button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button onClick={() => { setAreViasLocked(prev => !prev); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
                Lock Vias {areViasLocked ? '✓' : ''}
              </button>
              <button onClick={() => { setArePadsLocked(prev => !prev); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
                Lock Pads {arePadsLocked ? '✓' : ''}
              </button>
              <button onClick={() => { setAreTracesLocked(prev => !prev); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
                Lock Traces {areTracesLocked ? '✓' : ''}
              </button>
              <button onClick={() => { setAreComponentsLocked(prev => !prev); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
                Lock Components {areComponentsLocked ? '✓' : ''}
              </button>
              <button onClick={() => { setAreGroundNodesLocked(prev => !prev); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
                Lock Ground Node {areGroundNodesLocked ? '✓' : ''}
              </button>
              <button onClick={() => { setArePowerNodesLocked(prev => !prev); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
                Lock Power Nodes {arePowerNodesLocked ? '✓' : ''}
              </button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button onClick={() => { setShowPowerBusManager(true); setOpenMenu(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}>
                Manage Power Buses…
              </button>
              <div style={{ height: 1, background: '#eee', margin: '6px 0' }} />
              <button 
                onClick={() => {
                  // Select all vias
                  const viaIds = drawingStrokes.filter(s => s.type === 'via').map(s => s.id);
                  setSelectedIds(new Set(viaIds));
                  setSelectedComponentIds(new Set());
                  setSelectedPowerIds(new Set());
                  setSelectedGroundIds(new Set());
                  setCurrentTool('select');
                  // Close menu after a brief delay to ensure state updates are processed
                  setTimeout(() => setOpenMenu(null), 0);
                }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}
              >
                Select all vias
              </button>
              <button 
                onClick={() => {
                  // Select all pads (top)
                  const padIds = drawingStrokes.filter(s => s.type === 'pad' && s.layer === 'top').map(s => s.id);
                  setSelectedIds(new Set(padIds));
                  setSelectedComponentIds(new Set());
                  setSelectedPowerIds(new Set());
                  setSelectedGroundIds(new Set());
                  setCurrentTool('select');
                  // Close menu after a brief delay to ensure state updates are processed
                  setTimeout(() => setOpenMenu(null), 0);
                }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}
              >
                Select all Pads (Top)
              </button>
              <button 
                onClick={() => {
                  // Select all pads (bottom)
                  const padIds = drawingStrokes.filter(s => s.type === 'pad' && s.layer === 'bottom').map(s => s.id);
                  setSelectedIds(new Set(padIds));
                  setSelectedComponentIds(new Set());
                  setSelectedPowerIds(new Set());
                  setSelectedGroundIds(new Set());
                  setCurrentTool('select');
                  // Close menu after a brief delay to ensure state updates are processed
                  setTimeout(() => setOpenMenu(null), 0);
                }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}
              >
                Select all Pads (Bottom)
              </button>
              <button 
                onClick={() => {
                  // Select all traces (top)
                  const traceIds = drawingStrokes.filter(s => s.type === 'trace' && s.layer === 'top').map(s => s.id);
                  setSelectedIds(new Set(traceIds));
                  setSelectedComponentIds(new Set());
                  setSelectedPowerIds(new Set());
                  setSelectedGroundIds(new Set());
                  setCurrentTool('select');
                  // Close menu after a brief delay to ensure state updates are processed
                  setTimeout(() => setOpenMenu(null), 0);
                }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}
              >
                Select all Traces (top)
              </button>
              <button 
                onClick={() => {
                  // Select all traces (bottom)
                  const traceIds = drawingStrokes.filter(s => s.type === 'trace' && s.layer === 'bottom').map(s => s.id);
                  setSelectedIds(new Set(traceIds));
                  setSelectedComponentIds(new Set());
                  setSelectedPowerIds(new Set());
                  setSelectedGroundIds(new Set());
                  setCurrentTool('select');
                  // Close menu after a brief delay to ensure state updates are processed
                  setTimeout(() => setOpenMenu(null), 0);
                }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}
              >
                Select all Traces (bottom)
              </button>
              <button 
                onClick={() => {
                  // Select all components (top)
                  const compIds = componentsTop.map(c => c.id);
                  setSelectedComponentIds(new Set(compIds));
                  setSelectedIds(new Set());
                  setSelectedPowerIds(new Set());
                  setSelectedGroundIds(new Set());
                  setCurrentTool('select');
                  // Close menu after a brief delay to ensure state updates are processed
                  setTimeout(() => setOpenMenu(null), 0);
                }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}
              >
                Select all Components (top)
              </button>
              <button 
                onClick={() => {
                  // Select all components (bottom)
                  const compIds = componentsBottom.map(c => c.id);
                  setSelectedComponentIds(new Set(compIds));
                  setSelectedIds(new Set());
                  setSelectedPowerIds(new Set());
                  setSelectedGroundIds(new Set());
                  setCurrentTool('select');
                  // Close menu after a brief delay to ensure state updates are processed
                  setTimeout(() => setOpenMenu(null), 0);
                }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', color: '#f2f2f2', background: 'transparent', border: 'none' }}
              >
                Select all Components (bottom)
              </button>
            </div>
          )}
        </div>
        {/* About menu */}
        <div style={{ position: 'relative' }}>
          <button 
            onClick={(e) => { e.stopPropagation(); setOpenMenu(m => m === 'about' ? null : 'about'); }} 
            style={{ 
              padding: '6px 10px', 
              borderRadius: 6, 
              border: '1px solid #ddd', 
              background: openMenu === 'about' ? '#eef3ff' : '#fff', 
              fontWeight: 600, 
              color: '#222'
            }}
          >
            About ▾
          </button>
          {openMenu === 'about' && (
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 400, maxWidth: 600, maxHeight: '80vh', background: '#fff', border: '1px solid #ccc', borderRadius: 6, boxShadow: '0 6px 18px rgba(0,0,0,0.25)', padding: 16, overflowY: 'auto', zIndex: 100 }}>
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ margin: '0 0 12px 0', color: '#000', fontSize: '18px', fontWeight: 700 }}>PCB Reverse Engineering Tool</h2>
                <p style={{ margin: '0 0 16px 0', color: '#ddd', fontSize: '14px', lineHeight: '1.6' }}>
                  A specialized tool for reverse engineering printed circuit boards (PCBs) by tracing and documenting circuit connections from PCB images.
                </p>
              </div>

              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '16px', fontWeight: 600 }}>Purpose</h3>
                <p style={{ margin: 0, color: '#ddd', fontSize: '14px', lineHeight: '1.6' }}>
                  This tool helps engineers and hobbyists document PCB layouts by allowing you to overlay traces, vias, pads, components, and power/ground connections on top of PCB images. The tool generates netlists and schematics that can be exported to KiCad and other EDA tools.
                </p>
              </div>

              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '16px', fontWeight: 600 }}>Features</h3>
                <ul style={{ margin: 0, paddingLeft: 20, color: '#ddd', fontSize: '14px', lineHeight: '1.8' }}>
                  <li>Support for <strong style={{ color: '#fff' }}>Typical 4-Layer PCBs</strong> (Top, Bottom, Ground Plane, Power Plane)</li>
                  <li>Layer-specific drawing tools (Traces, Pads, Components) for Top and Bottom layers</li>
                  <li>Via placement with automatic type detection (Signal, Power, Ground)</li>
                  <li>Component placement with 24+ component types and pin connection management</li>
                  <li>Power and Ground node placement with bus management</li>
                  <li>Netlist generation and export (KiCad, Protel formats)</li>
                  <li>Simple schematic export</li>
                  <li>Project save/load with auto-save functionality</li>
                  <li>Layer visibility controls and locking mechanisms</li>
                </ul>
              </div>

              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '16px', fontWeight: 600 }}>Limitations</h3>
                <ul style={{ margin: 0, paddingLeft: 20, color: '#ddd', fontSize: '14px', lineHeight: '1.8' }}>
                  <li>Currently supports <strong style={{ color: '#fff' }}>through-hole vias only</strong> (blind and buried vias not yet supported)</li>
                  <li>Designed for 4-layer PCBs (can be adapted for 2-layer with some limitations)</li>
                  <li>Manual tracing required (no automatic trace detection from images)</li>
                  <li>Component library limited to standard through-hole and SMD types</li>
                </ul>
              </div>

              <div style={{ marginBottom: 16 }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '16px', fontWeight: 600 }}>4-Layer PCB Support</h3>
                <p style={{ margin: '0 0 8px 0', color: '#ddd', fontSize: '14px', lineHeight: '1.6' }}>
                  The tool is optimized for the most common 4-layer PCB stackup:
                </p>
                <ul style={{ margin: '0 0 8px 0', paddingLeft: 20, color: '#ddd', fontSize: '14px', lineHeight: '1.8' }}>
                  <li><strong style={{ color: '#fff' }}>Layer 1 (Top):</strong> Signal layer</li>
                  <li><strong style={{ color: '#fff' }}>Layer 2 (Inner):</strong> Ground plane</li>
                  <li><strong style={{ color: '#fff' }}>Layer 3 (Inner):</strong> Power plane</li>
                  <li><strong style={{ color: '#fff' }}>Layer 4 (Bottom):</strong> Signal layer</li>
                </ul>
                <p style={{ margin: 0, color: '#ddd', fontSize: '14px', lineHeight: '1.6' }}>
                  Vias automatically connect Top and Bottom layers. See the <strong style={{ color: '#fff' }}>ABOUT_VIAS.md</strong> file in the project for detailed information about via types and usage in 4-layer PCBs.
                </p>
              </div>

              <div style={{ marginBottom: 0 }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '16px', fontWeight: 600 }}>Keyboard Shortcuts</h3>
                <div style={{ color: '#ddd', fontSize: '13px', lineHeight: '1.8', fontFamily: 'monospace' }}>
                  <div><strong style={{ color: '#fff' }}>S</strong> - Select tool</div>
                  <div><strong style={{ color: '#fff' }}>V</strong> - Via tool</div>
                  <div><strong style={{ color: '#fff' }}>D</strong> - Pad tool</div>
                  <div><strong style={{ color: '#fff' }}>T</strong> - Trace tool</div>
                  <div><strong style={{ color: '#fff' }}>C</strong> - Component tool</div>
                  <div><strong style={{ color: '#fff' }}>P</strong> - Power tool</div>
                  <div><strong style={{ color: '#fff' }}>G</strong> - Ground tool</div>
                  <div><strong style={{ color: '#fff' }}>E</strong> - Erase tool</div>
                  <div><strong style={{ color: '#fff' }}>H</strong> - Pan/Move tool</div>
                  <div><strong style={{ color: '#fff' }}>Z</strong> - Zoom tool</div>
                  <div><strong style={{ color: '#fff' }}>Esc</strong> - Return to Select tool</div>
                  <div><strong style={{ color: '#fff' }}>Option/Alt</strong> - Disable snap-to while drawing</div>
                  <div><strong style={{ color: '#fff' }}>+/-</strong> - Increase/Decrease size</div>
                  <div><strong style={{ color: '#fff' }}>Cmd/Ctrl+I</strong> - Detailed Information</div>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* File path display - right justified */}
        {currentProjectFilePath && (
          <div style={{ 
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            paddingLeft: '16px'
          }}>
            {/* File path */}
            <div style={{ 
              fontSize: '12px',
              color: '#333',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '40vw'
            }} title={currentProjectFilePath}>
              {currentProjectFilePath}
            </div>
          </div>
        )}
        {/* COMMENTED OUT: File navigation buttons and project review functionality
        {currentProjectFilePath && (
          <div style={{ 
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            paddingLeft: '16px'
          }}>
            {currentFileIndex > 0 && (
              <span style={{ 
                fontSize: '12px',
                color: '#666',
                fontStyle: 'italic',
                marginRight: '8px'
              }}>
                Project Review: Read Only
              </span>
            )}
            <button
              onClick={navigateToPreviousFile}
              disabled={currentFileIndex < 0 || currentFileIndex >= autoSaveFileHistory.length - 1}
              title="Navigate to older file"
              style={{
                padding: '4px 8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: (currentFileIndex < 0 || currentFileIndex >= autoSaveFileHistory.length - 1) ? '#f5f5f5' : '#fff',
                color: (currentFileIndex < 0 || currentFileIndex >= autoSaveFileHistory.length - 1) ? '#999' : '#333',
                cursor: (currentFileIndex < 0 || currentFileIndex >= autoSaveFileHistory.length - 1) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              ←
            </button>
            <button
              onClick={(e) => {
                const isDisabled = currentFileIndex <= 0 || currentFileIndex >= autoSaveFileHistory.length || autoSaveFileHistory.length === 0;
                if (isDisabled) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                navigateToNextFile();
              }}
              disabled={currentFileIndex <= 0 || currentFileIndex >= autoSaveFileHistory.length || autoSaveFileHistory.length === 0}
              title="Navigate to newer file"
              style={{
                padding: '4px 8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                background: (currentFileIndex <= 0 || currentFileIndex >= autoSaveFileHistory.length || autoSaveFileHistory.length === 0) ? '#f5f5f5' : '#fff',
                color: (currentFileIndex <= 0 || currentFileIndex >= autoSaveFileHistory.length || autoSaveFileHistory.length === 0) ? '#999' : '#333',
                cursor: (currentFileIndex <= 0 || currentFileIndex >= autoSaveFileHistory.length || autoSaveFileHistory.length === 0) ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                pointerEvents: (currentFileIndex <= 0 || currentFileIndex >= autoSaveFileHistory.length || autoSaveFileHistory.length === 0) ? 'none' : 'auto'
              }}
            >
              →
            </button>
          </div>
        )}
        */}
      </div>

      

      <div style={{ display: 'block', padding: 0, margin: 0, width: '100vw', height: 'calc(100vh - 70px)', boxSizing: 'border-box', position: 'relative' }}>
        {/* Control Panel removed - functionality moved to top menus and left toolstrip */}

        {/* Canvas Area */}
        <div ref={canvasContainerRef} style={{ position: 'relative', width: '100%', height: '100%', margin: 0, padding: 0, boxSizing: 'border-box', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', borderRadius: '16px', overflow: 'hidden' }}>
          {/* Left toolstrip (icons) */}
          <div style={{ position: 'absolute', top: 6, left: 6, bottom: 6, width: 44, display: 'flex', flexDirection: 'column', gap: 8, padding: '6px 6px', background: 'rgba(250,250,255,0.95)', borderRadius: 8, border: '1px solid #ddd', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 20 }}>
            <button 
              onClick={() => { if (!isReadOnlyMode) setCurrentTool('select'); }} 
              onMouseDown={(e) => e.currentTarget.blur()}
              disabled={isReadOnlyMode}
              title="Select (S)" 
              style={{ 
                width: 32, 
                height: 32, 
                display: 'grid', 
                placeItems: 'center', 
                borderRadius: 6, 
                border: currentTool === 'select' ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'select' ? '#e6f0ff' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                outline: 'none',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              <MousePointer size={16} />
            </button>
            <button 
              onClick={() => { if (!isReadOnlyMode) { setDrawingMode('via'); setCurrentTool('draw'); } }} 
              disabled={isReadOnlyMode}
              title="Draw Vias (V)" 
              style={{ 
                width: 32, 
                height: 32, 
                display: 'grid', 
                placeItems: 'center', 
                borderRadius: 6, 
                border: (currentTool === 'draw' && drawingMode === 'via') ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'draw' && drawingMode === 'via' ? '#e6f0ff' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                {(() => {
                  const viaDef = toolRegistry.get('via');
                  const viaColor = viaDef?.settings.color || persistedDefaults.viaColor || brushColor;
                  return (
                    <>
                      <circle cx="12" cy="12" r="8" fill="none" stroke={viaColor} strokeWidth="3" />
                      <circle cx="12" cy="12" r="4" fill={viaColor} />
                    </>
                  );
                })()}
              </svg>
            </button>
            <button 
              onClick={() => { 
                if (!isReadOnlyMode) { 
                  setDrawingMode('pad'); 
                  setCurrentTool('draw'); 
                  // Default to Top layer, but use last choice if available
                  const padLayerToUse = padToolLayer || 'top';
                  setSelectedDrawingLayer(padLayerToUse);
                  // The useEffect hook will load pad tool settings automatically
                  setShowPadLayerChooser(true);
                } 
              }} 
              disabled={isReadOnlyMode}
              title="Draw Pads (P)" 
              style={{ 
                width: 32, 
                height: 32, 
                display: 'grid', 
                placeItems: 'center', 
                borderRadius: 6, 
                border: (currentTool === 'draw' && drawingMode === 'pad') ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'draw' && drawingMode === 'pad' ? '#e6f0ff' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                {(() => {
                  const padDef = toolRegistry.get('pad');
                  const padSize = padDef?.settings.size || topPadSize || 26;
                  const padColor = padDef?.settings.color || topPadColor || brushColor;
                  // Scale pad size to fit in 16x16 icon (max 14 to leave some margin)
                  const iconSize = Math.min(14, Math.max(4, (padSize / 26) * 14));
                  const iconX = (24 - iconSize) / 2;
                  const iconY = (24 - iconSize) / 2;
                  return <rect x={iconX} y={iconY} width={iconSize} height={iconSize} fill={padColor} />;
                })()}
              </svg>
            </button>
            <button 
              onClick={() => { 
                if (!isReadOnlyMode) {
                  setDrawingMode('trace'); 
                  setCurrentTool('draw'); 
                  // Default to Top layer, but use last choice if available
                  const layerToUse = traceToolLayer || 'top';
                  setSelectedDrawingLayer(layerToUse);
                  // The useEffect hook will load trace tool settings automatically
                  setShowTraceLayerChooser(true);
                }
              }} 
              disabled={isReadOnlyMode}
              title="Draw Traces (T)" 
              style={{ 
                width: 32, 
                height: 32, 
                display: 'grid', 
                placeItems: 'center', 
                borderRadius: 6, 
                border: (currentTool === 'draw' && drawingMode === 'trace') ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'draw' && drawingMode === 'trace' ? '#e6f0ff' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              <PenLine size={16} color={toolRegistry.get('trace')?.settings.color || (traceToolLayer === 'top' ? topTraceColor : bottomTraceColor) || DEFAULT_TRACE_COLOR} />
            </button>
            <button 
              onClick={() => { 
                if (!isReadOnlyMode) {
                  setCurrentTool('component');
                  // Use current global layer setting (selectedDrawingLayer is the source of truth)
                  // Show layer chooser first (like trace/pad pattern)
                  setShowComponentLayerChooser(true);
                  setShowComponentTypeChooser(false);
                  setSelectedComponentType(null);
                }
              }} 
              disabled={isReadOnlyMode}
              title="Draw Component (C)" 
              style={{ 
                width: 32, 
                height: 32, 
                display: 'grid', 
                placeItems: 'center', 
                borderRadius: 6, 
                border: currentTool === 'component' ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'component' ? '#e6f0ff' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              {(() => {
                // Use layer-specific component colors based on componentToolLayer (like pad pattern)
                // Priority: componentToolLayer -> toolRegistry -> fallback
                const layer = componentToolLayer || 'top';
                const componentDef = toolRegistry.get('component');
                // Use layer-specific color based on componentToolLayer (this is the source of truth)
                const componentColor = (layer === 'top' ? topComponentColor : bottomComponentColor) || componentDef?.settings.color || DEFAULT_COMPONENT_COLOR;
                return selectedComponentType ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    {/* Square icon with text - show default abbreviation based on component type */}
                    <rect x="4" y="4" width="16" height="16" fill="rgba(255,255,255,0.9)" stroke={componentColor} strokeWidth="1.5" />
                    <text x="12" y="14" textAnchor="middle" fontSize="7" fill={componentColor} fontWeight="bold" fontFamily="monospace">{getDefaultAbbreviation(selectedComponentType)}</text>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                    {/* top body */}
                    <rect x="5" y="3" width="14" height="7" fill={componentColor} stroke={componentColor} strokeWidth="0.5" />
                    {/* pin headers */}
                    <g stroke={componentColor} fill="none" strokeWidth="1.5">
                      <rect x="5" y="10" width="14" height="4" rx="1.2" />
                      <path d="M7 14 v4 M10 14 v4 M13 14 v4 M16 14 v4" stroke={componentColor} />
                    </g>
                  </svg>
                );
              })()}
            </button>
            {/* Power tool */}
            <button 
              onClick={() => { if (!isReadOnlyMode) setCurrentTool('power'); }} 
              disabled={isReadOnlyMode}
              title="Draw Power (P)" 
              style={{ 
                width: 32, 
                height: 32, 
                display: 'grid', 
                placeItems: 'center', 
                borderRadius: 6, 
                border: currentTool === 'power' ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'power' ? '#e6f0ff' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              {/* Power symbol icon - use tool-specific color */}
              <span style={{ color: toolRegistry.get('power')?.settings.color || DEFAULT_POWER_COLOR, fontSize: '18px', fontWeight: 'bold', lineHeight: 1 }}>V</span>
            </button>
            {/* Ground tool */}
            <button 
              onClick={() => { if (!isReadOnlyMode) setCurrentTool('ground'); }} 
              disabled={isReadOnlyMode}
              title="Draw Ground (G)" 
              style={{ 
                width: 32, 
                height: 32, 
                display: 'grid', 
                placeItems: 'center', 
                borderRadius: 6, 
                border: currentTool === 'ground' ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'ground' ? '#e6f0ff' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              {/* Ground symbol icon */}
              <svg width="16" height="16" viewBox="0 0 24 20" aria-hidden="true" style={{ overflow: 'visible' }}>
                <g stroke={toolRegistry.get('ground')?.settings.color || '#000000'} strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="2" x2="12" y2="10" />
                  <line x1="5" y1="10" x2="19" y2="10" />
                  <line x1="7" y1="13" x2="17" y2="13" />
                  <line x1="9.5" y1="16" x2="14.5" y2="16" />
                </g>
              </svg>
            </button>
            <button 
              onClick={() => { if (!isReadOnlyMode) setCurrentTool('erase'); }} 
              disabled={isReadOnlyMode}
              title="Erase (E)" 
              style={{ 
                width: 32, 
                height: 32, 
                display: 'grid', 
                placeItems: 'center', 
                borderRadius: 6, 
                border: currentTool === 'erase' ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'erase' ? '#ffecec' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              {/* Tilted pink eraser */}
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <g transform="rotate(-35 12 12)">
                  <rect x="6" y="8" width="12" height="8" rx="1.5" fill="#f5a3b3" stroke="#111" strokeWidth="1.5" />
                  <rect x="6" y="13" width="12" height="3" fill="#f18ea4" stroke="none" />
                </g>
              </svg>
            </button>
              <button 
                onClick={() => { if (!isReadOnlyMode) setCurrentTool(prev => prev === 'pan' ? 'draw' : 'pan'); }} 
                disabled={isReadOnlyMode}
                title="Move (H)" 
                style={{ 
                  width: 32, 
                  height: 32, 
                  display: 'grid', 
                  placeItems: 'center', 
                  borderRadius: 6, 
                  border: currentTool === 'pan' ? '2px solid #000' : '1px solid #ddd', 
                  background: currentTool === 'pan' ? '#e6f0ff' : '#fff', 
                  color: isReadOnlyMode ? '#999' : '#222',
                  cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                  opacity: isReadOnlyMode ? 0.5 : 1
                }}
              >
              {/* Simple hand icon (matches canvas cursor style) */}
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <g stroke="#111" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 11v-4c0-.8.6-1.3 1.3-1.3S11 6.2 11 7v4" />
                  <path d="M11 11V6.5c0-.8.6-1.3 1.3-1.3S14 5.7 14 6.5V11" />
                  <path d="M14 11V7.2c0-.8.6-1.3 1.3-1.3.7 0 1.3.5 1.3 1.3V12c1 .6 1.6 1.5 1.6 2.7A4.3 4.3 0 0 1 14 19H9.2A4.2 4.2 0 0 1 5 14.8V11c0-.6.4-1 .9-1 .6 0 1 .4 1 1v2" />
                </g>
              </svg>
            </button>
            <button 
              onClick={() => { setIsShiftPressed(false); setCurrentTool(prev => prev === 'magnify' ? 'draw' : 'magnify'); }} 
              title={`${isShiftPressed ? 'Zoom Out' : 'Zoom In'} (Z)`} 
              style={{ 
                width: 32, 
                height: 32, 
                display: 'grid', 
                placeItems: 'center', 
                borderRadius: 6, 
                border: currentTool === 'magnify' ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'magnify' ? '#e6f0ff' : '#fff', 
                color: '#222',
                cursor: 'pointer'
              }}
            >
              {/* Enlarged magnifier lens and symbols */}
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="10" cy="10" r="7.5" fill="none" stroke="#111" strokeWidth="2" />
                <line x1="15.5" y1="15.5" x2="21" y2="21" stroke="#111" strokeWidth="2" strokeLinecap="round" />
                {isShiftPressed ? (
                  <line x1="6.5" y1="10" x2="13.5" y2="10" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
                ) : (
                  <>
                    <line x1="6.5" y1="10" x2="13.5" y2="10" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
                    <line x1="10" y1="6.5" x2="10" y2="13.5" stroke="#111" strokeWidth="2.4" strokeLinecap="round" />
                  </>
                )}
              </svg>
            </button>
            {/* Color picker moved just below magnify */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => { if (!isReadOnlyMode) setShowColorPicker(prev => !prev); }} 
                disabled={isReadOnlyMode}
                title="Color Picker" 
                style={{ 
                  width: 32, 
                  height: 32, 
                  display: 'grid', 
                  placeItems: 'center', 
                  borderRadius: 6, 
                  border: '1px solid #ddd', 
                  background: '#fff',
                  cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                  opacity: isReadOnlyMode ? 0.5 : 1
                }}
              >
                {/* Color palette grid icon - 4x4 grid representing the color picker */}
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  {/* Row 1 */}
                  <rect x="0" y="0" width="3.5" height="3.5" fill="#9E9E9E" stroke="#ccc" strokeWidth="0.3" />
                  <rect x="4" y="0" width="3.5" height="3.5" fill="#0072B2" stroke="#ccc" strokeWidth="0.3" />
                  <rect x="8" y="0" width="3.5" height="3.5" fill="#56B4E9" stroke="#ccc" strokeWidth="0.3" />
                  <rect x="12" y="0" width="3.5" height="3.5" fill="#00BFC4" stroke="#ccc" strokeWidth="0.3" />
                  {/* Row 2 */}
                  <rect x="0" y="4" width="3.5" height="3.5" fill="#6A3D9A" stroke="#ccc" strokeWidth="0.3" />
                  <rect x="4" y="4" width="3.5" height="3.5" fill="#2CA02C" stroke="#ccc" strokeWidth="0.3" />
                  <rect x="8" y="4" width="3.5" height="3.5" fill="#7FC97F" stroke="#ccc" strokeWidth="0.3" />
                  <rect x="12" y="4" width="3.5" height="3.5" fill="#FF7F0E" stroke="#ccc" strokeWidth="0.3" />
                  {/* Row 3 */}
                  <rect x="0" y="8" width="3.5" height="3.5" fill="#FFD700" stroke="#ccc" strokeWidth="0.3" />
                  <rect x="4" y="8" width="3.5" height="3.5" fill="#FF6B6B" stroke="#ccc" strokeWidth="0.3" />
                  <rect x="8" y="8" width="3.5" height="3.5" fill="#E74C3C" stroke="#ccc" strokeWidth="0.3" />
                  <rect x="12" y="8" width="3.5" height="3.5" fill="#FFB6C1" stroke="#ccc" strokeWidth="0.3" />
                  {/* Row 4 */}
                  <rect x="0" y="12" width="3.5" height="3.5" fill="#DDA0DD" stroke="#ccc" strokeWidth="0.3" />
                  <rect x="4" y="12" width="3.5" height="3.5" fill="#8B4513" stroke="#ccc" strokeWidth="0.3" />
                  <rect x="8" y="12" width="3.5" height="3.5" fill="#A0522D" stroke="#ccc" strokeWidth="0.3" />
                  <rect x="12" y="12" width="3.5" height="3.5" fill="#FF4500" stroke="#ccc" strokeWidth="0.3" />
                </svg>
              </button>
            {showColorPicker && (
                <div ref={colorPickerRef} style={{ position: 'absolute', left: 42, top: 0, padding: 8, background: '#fff', border: '1px solid #ddd', borderRadius: 6, boxShadow: '0 8px 18px rgba(0,0,0,0.18)', zIndex: 50 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 22px)', gap: 4 }}>
                    {palette8x8.map((c) => (
                      <div
                        key={c}
                      onClick={() => { 
                        setBrushColor(c);
                        setShowColorPicker(false);
                        // Save color for the current tool using the new per-tool system
                        const currentToolDef = getCurrentToolDef(toolRegistry);
                        if (currentToolDef) {
                          // This will trigger the useEffect that saves to localStorage
                          // The useEffect will call saveToolSettings automatically
                        }
                        // Legacy support: also save using old system for backward compatibility
                        saveDefaultColor('brush', c);
                        // If trace tool is active, save color to the appropriate layer (legacy)
                        if (currentTool === 'draw' && drawingMode === 'trace') {
                          if (selectedDrawingLayer === 'top') {
                            setTopTraceColor(c);
                            saveDefaultColor('trace', c, 'top');
                          } else {
                            setBottomTraceColor(c);
                            saveDefaultColor('trace', c, 'bottom');
                          }
                        } else if (currentTool === 'draw' && drawingMode === 'via') {
                          saveDefaultColor('via', c);
                        } else if (currentTool === 'draw' && drawingMode === 'pad') {
                          saveDefaultColor('pad', c);
                        } else if (currentTool === 'component') {
                          saveDefaultColor('component', c);
                        }
                        if (selectedIds.size > 0) {
                          // Determine object types from selected items to persist defaults
                          setDrawingStrokes(prev => prev.map(s => {
                            if (selectedIds.has(s.id)) {
                              // Persist default color for this object type
                              if (s.type === 'via') {
                                saveDefaultColor('via', c);
                                // Update toolRegistry
                                setToolRegistry(prev => {
                                  const updated = new Map(prev);
                                  const viaDef = updated.get('via');
                                  if (viaDef) {
                                    updated.set('via', { ...viaDef, settings: { ...viaDef.settings, color: c } });
                                  }
                                  return updated;
                                });
                              } else if (s.type === 'pad') {
                                saveDefaultColor('pad', c);
                                // Update toolRegistry
                                setToolRegistry(prev => {
                                  const updated = new Map(prev);
                                  const padDef = updated.get('pad');
                                  if (padDef) {
                                    updated.set('pad', { ...padDef, settings: { ...padDef.settings, color: c } });
                                  }
                                  return updated;
                                });
                              } else if (s.type === 'trace') {
                                saveDefaultColor('trace', c, s.layer);
                              }
                              return { ...s, color: c };
                            }
                            return s;
                          }));
                        }
                        if (selectedComponentIds.size > 0) {
                          saveDefaultColor('component', c);
                          setComponentsTop(prev => prev.map(cm => selectedComponentIds.has(cm.id) ? { ...cm, color: c } : cm));
                          setComponentsBottom(prev => prev.map(cm => selectedComponentIds.has(cm.id) ? { ...cm, color: c } : cm));
                        }
                        if (selectedPowerIds.size > 0) {
                          setPowers(prev => prev.map(p => selectedPowerIds.has(p.id) ? { ...p, color: c } : p));
                        }
                        if (selectedGroundIds.size > 0) {
                          setGrounds(prev => prev.map(g => selectedGroundIds.has(g.id) ? { ...g, color: c } : g));
                        }
                      }}
                        title={c}
                        style={{ width: 22, height: 22, backgroundColor: c, border: c === brushColor ? '2px solid #333' : '1px solid #ccc', cursor: 'pointer' }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Active tool layer chooser for Trace */}
          {(currentTool === 'draw' && drawingMode === 'trace' && showTraceLayerChooser) && (
            <div ref={traceChooserRef} style={{ position: 'absolute', top: 92, left: 56, padding: '4px 6px', background: '#fff', border: '2px solid #000', borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 25 }}>
              <label className="radio-label" style={{ marginRight: 6 }}>
                <input type="radio" name="traceToolLayer" checked={traceToolLayer === 'top'} onChange={() => { 
                  setTraceToolLayer('top'); 
                  setSelectedDrawingLayer('top'); 
                  // Use layer-specific trace colors and sizes
                  setBrushColor(topTraceColor);
                  setBrushSize(topTraceSize);
                  // Update toolRegistry to reflect current layer's color (like pad pattern)
                  setToolRegistry(prev => {
                    const updated = new Map(prev);
                    const traceDef = updated.get('trace');
                    if (traceDef) {
                      updated.set('trace', { ...traceDef, settings: { color: topTraceColor, size: topTraceSize } });
                    }
                    return updated;
                  });
                  setShowTraceLayerChooser(false); 
                  setShowTopImage(true); 
                }} />
                <span>Top</span>
              </label>
              <label className="radio-label">
                <input type="radio" name="traceToolLayer" checked={traceToolLayer === 'bottom'} onChange={() => { 
                  setTraceToolLayer('bottom'); 
                  setSelectedDrawingLayer('bottom'); 
                  // Use layer-specific trace colors and sizes
                  setBrushColor(bottomTraceColor);
                  setBrushSize(bottomTraceSize);
                  // Update toolRegistry to reflect current layer's color (like pad pattern)
                  setToolRegistry(prev => {
                    const updated = new Map(prev);
                    const traceDef = updated.get('trace');
                    if (traceDef) {
                      updated.set('trace', { ...traceDef, settings: { color: bottomTraceColor, size: bottomTraceSize } });
                    }
                    return updated;
                  });
                  setShowTraceLayerChooser(false); 
                  setShowBottomImage(true); 
                }} />
                <span>Bottom</span>
              </label>
            </div>
          )}
          {/* Active tool layer chooser for Pad */}
          {(currentTool === 'draw' && drawingMode === 'pad' && showPadLayerChooser) && (
            <div ref={padChooserRef} style={{ position: 'absolute', top: 92, left: 56, padding: '4px 6px', background: '#fff', border: '2px solid #000', borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 25 }}>
              <label className="radio-label" style={{ marginRight: 6 }}>
                <input type="radio" name="padToolLayer" checked={padToolLayer === 'top'} onChange={() => { 
                  setPadToolLayer('top'); 
                  setSelectedDrawingLayer('top'); 
                  // Use layer-specific pad colors and sizes
                  setBrushColor(topPadColor);
                  setBrushSize(topPadSize);
                  // Update toolRegistry to reflect current layer's color (like pad pattern)
                  setToolRegistry(prev => {
                    const updated = new Map(prev);
                    const padDef = updated.get('pad');
                    if (padDef) {
                      updated.set('pad', { ...padDef, settings: { color: topPadColor, size: topPadSize } });
                    }
                    return updated;
                  });
                  setShowPadLayerChooser(false); 
                  setShowTopImage(true); 
                }} />
                <span>Top</span>
              </label>
              <label className="radio-label">
                <input type="radio" name="padToolLayer" checked={padToolLayer === 'bottom'} onChange={() => { 
                  setPadToolLayer('bottom'); 
                  setSelectedDrawingLayer('bottom'); 
                  // Use layer-specific pad colors and sizes
                  setBrushColor(bottomPadColor);
                  setBrushSize(bottomPadSize);
                  // Update toolRegistry to reflect current layer's color (like pad pattern)
                  setToolRegistry(prev => {
                    const updated = new Map(prev);
                    const padDef = updated.get('pad');
                    if (padDef) {
                      updated.set('pad', { ...padDef, settings: { color: bottomPadColor, size: bottomPadSize } });
                    }
                    return updated;
                  });
                  setShowPadLayerChooser(false); 
                  setShowBottomImage(true); 
                }} />
                <span>Bottom</span>
              </label>
            </div>
          )}
          {/* Power Bus Selector */}
          {showPowerBusSelector && currentTool === 'power' && (
            <div style={{ position: 'absolute', top: 44, left: 52, padding: '8px', background: '#fff', border: '1px solid #ddd', borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 26, minWidth: '200px' }}>
              <div style={{ marginBottom: '6px', fontWeight: 600, fontSize: '12px', color: '#333' }}>Select Power Bus:</div>
              {powerBuses.length === 0 ? (
                <div style={{ padding: '8px', color: '#666', fontSize: '12px' }}>No power buses defined. Use Tools → Manage Power Buses to add one.</div>
              ) : (
                [...powerBuses].sort((a, b) => {
                  // Parse voltage strings to extract numeric values
                  const parseVoltage = (voltage: string): { absValue: number; isNegative: boolean; original: string } => {
                    // Try to extract a numeric value with optional sign
                    // Match patterns like: +3.3V, -5VDC, 3.3V, AC_120V, etc.
                    const match = voltage.match(/([+-]?)(\d+\.?\d*)/);
                    if (match) {
                      const sign = match[1] || '+';
                      const numValue = parseFloat(match[2]);
                      const absValue = Math.abs(numValue);
                      const isNegative = sign === '-';
                      return { absValue, isNegative, original: voltage };
                    }
                    // If no numeric value found, put at end with high absolute value
                    return { absValue: Infinity, isNegative: false, original: voltage };
                  };
                  
                  const aParsed = parseVoltage(a.voltage);
                  const bParsed = parseVoltage(b.voltage);
                  
                  // First sort by absolute value
                  if (aParsed.absValue !== bParsed.absValue) {
                    return aParsed.absValue - bParsed.absValue;
                  }
                  
                  // If absolute values are equal, sort negative before positive
                  if (aParsed.isNegative !== bParsed.isNegative) {
                    return aParsed.isNegative ? -1 : 1;
                  }
                  
                  // If both have same sign and absolute value, maintain original order
                  return 0;
                }).map((bus) => (
                  <button
                    key={bus.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Set the selected power bus and close the selector
                      setSelectedPowerBusId(bus.id);
                      setShowPowerBusSelector(false);
                    }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', marginBottom: '4px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', color: '#222' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: bus.color, border: '1px solid #ccc' }} />
      <div>
                        <div style={{ fontWeight: 600, fontSize: '13px' }}>{bus.name}</div>
                        <div style={{ fontSize: '11px', color: '#666' }}>{bus.voltage}</div>
      </div>
                    </div>
        </button>
                ))
              )}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowPowerBusSelector(false);
                  setSelectedPowerBusId(null);
                  // Switch back to select tool if user cancels
                  setCurrentTool('select');
                }}
                style={{ display: 'block', width: '100%', textAlign: 'center', padding: '6px 10px', marginTop: '8px', background: '#f0f0f0', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', color: '#222' }}
              >
                Cancel
              </button>
      </div>
          )}
          {/* Active tool layer chooser for Component */}
          {(currentTool === 'component' && showComponentLayerChooser) && (
            <div ref={componentLayerChooserRef} style={{ position: 'absolute', top: 92, left: 56, padding: '4px 6px', background: '#fff', border: '2px solid #000', borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 25 }}>
              <label className="radio-label" style={{ marginRight: 6 }}>
                <input type="radio" name="componentToolLayer" checked={selectedDrawingLayer === 'top'} onClick={() => { 
                  setComponentToolLayer('top'); 
                  setSelectedDrawingLayer('top'); 
                  // Use layer-specific component colors and sizes
                  setBrushColor(topComponentColor);
                  setBrushSize(topComponentSize);
                  // Update toolRegistry to reflect current layer's color (like pad pattern)
                  setToolRegistry(prev => {
                    const updated = new Map(prev);
                    const componentDef = updated.get('component');
                    if (componentDef) {
                      updated.set('component', { ...componentDef, settings: { color: topComponentColor, size: topComponentSize } });
                    }
                    return updated;
                  });
                  setShowComponentLayerChooser(false); 
                  setShowTopImage(true);
                  // Always show component type chooser after layer button is clicked
                  setShowComponentTypeChooser(true);
                }} />
                <span>Top</span>
              </label>
              <label className="radio-label">
                <input type="radio" name="componentToolLayer" checked={selectedDrawingLayer === 'bottom'} onClick={() => { 
                  setComponentToolLayer('bottom'); 
                  setSelectedDrawingLayer('bottom'); 
                  // Use layer-specific component colors and sizes
                  setBrushColor(bottomComponentColor);
                  setBrushSize(bottomComponentSize);
                  // Update toolRegistry to reflect current layer's color (like pad pattern)
                  setToolRegistry(prev => {
                    const updated = new Map(prev);
                    const componentDef = updated.get('component');
                    if (componentDef) {
                      updated.set('component', { ...componentDef, settings: { color: bottomComponentColor, size: bottomComponentSize } });
                    }
                    return updated;
                  });
                  setShowComponentLayerChooser(false); 
                  setShowBottomImage(true);
                  // Always show component type chooser after layer button is clicked
                  setShowComponentTypeChooser(true);
                }} />
                <span>Bottom</span>
              </label>
            </div>
          )}
          {/* Component Type Chooser - appears after layer is selected */}
          {currentTool === 'component' && showComponentTypeChooser && (
            <div ref={componentTypeChooserRef} style={{ position: 'absolute', top: 44, left: 52, padding: '8px', background: '#fff', border: '1px solid #ddd', borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 26, maxHeight: '400px', overflowY: 'auto', minWidth: '200px' }}>
              <div style={{ marginBottom: '6px', fontWeight: 600, fontSize: '12px', color: '#333' }}>Select Component Type:</div>
              {Object.entries(COMPONENT_TYPE_INFO).map(([type, info]) => (
                <button
                  key={type}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Set the selected component type and close the chooser (like power bus selector)
                    setSelectedComponentType(type as ComponentType);
                    setShowComponentTypeChooser(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '4px 8px',
                    marginBottom: '2px',
                    background: selectedComponentType === type ? '#e6f0ff' : '#fff',
                    border: '1px solid #ddd',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#333',
                  }}
                >
                  {info.prefix.join(', ')} - {type} ({info.defaultPins} pins)
                </button>
              ))}
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowComponentTypeChooser(false);
                  // Switch back to select tool if user cancels
                  setCurrentTool('select');
                }}
                style={{ display: 'block', width: '100%', textAlign: 'center', padding: '6px 10px', marginTop: '8px', background: '#f0f0f0', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', color: '#222' }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Layers miniatures (Pages-like) with visibility toggles and transparency */}
          <div style={{ position: 'absolute', top: 6, left: 56, bottom: 6, width: 168, padding: 8, display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(250,250,255,0.95)', borderRadius: 8, border: '1px solid #ddd', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 3 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#333', marginBottom: 2 }}>Layers</div>
            <div onClick={() => setSelectedDrawingLayer('top')} title="Top layer" style={{ cursor: 'pointer', padding: 4, borderRadius: 6, border: selectedImageForTransform === 'top' ? '2px solid #0b5fff' : '1px solid #ddd', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 12, color: '#444', fontWeight: 600 }}>Top Image</div>
                <label className="radio-label" style={{ margin: 0 }}>
                  <input type="checkbox" checked={showTopImage} onChange={(e) => setShowTopImage(e.target.checked)} />
                </label>
              </div>
              <canvas ref={topThumbRef} width={100} height={64} />
            </div>
            <div onClick={() => setSelectedDrawingLayer('bottom')} title="Bottom layer" style={{ cursor: 'pointer', padding: 4, borderRadius: 6, border: selectedImageForTransform === 'bottom' ? '2px solid #0b5fff' : '1px solid #ddd', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 12, color: '#444', fontWeight: 600 }}>Bottom Image</div>
                <label className="radio-label" style={{ margin: 0 }}>
                  <input type="checkbox" checked={showBottomImage} onChange={(e) => setShowBottomImage(e.target.checked)} />
                </label>
              </div>
              <canvas ref={bottomThumbRef} width={100} height={64} />
            </div>
            <div style={{ height: 1, background: '#e9e9ef', margin: '4px 0' }} />
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showViasLayer} onChange={(e) => setShowViasLayer(e.target.checked)} />
              <span>Vias</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showTopPadsLayer} onChange={(e) => setShowTopPadsLayer(e.target.checked)} />
              <span>Pads (Top)</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showBottomPadsLayer} onChange={(e) => setShowBottomPadsLayer(e.target.checked)} />
              <span>Pads (Bottom)</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showTopTracesLayer} onChange={(e) => setShowTopTracesLayer(e.target.checked)} />
              <span>Traces (Top)</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showBottomTracesLayer} onChange={(e) => setShowBottomTracesLayer(e.target.checked)} />
              <span>Traces (Bottom)</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showTopComponents} onChange={(e) => setShowTopComponents(e.target.checked)} />
              <span>Components (Top)</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showBottomComponents} onChange={(e) => setShowBottomComponents(e.target.checked)} />
              <span>Components (Bottom)</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showPowerLayer} onChange={(e) => setShowPowerLayer(e.target.checked)} />
              <span>Power</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showGroundLayer} onChange={(e) => setShowGroundLayer(e.target.checked)} />
              <span>Ground</span>
            </label>
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 12, color: '#333' }}>Transparency: {transparency}%</label>
                <label className="radio-label" style={{ margin: 0 }}>
                  <input type="checkbox" checked={isTransparencyCycling} onChange={(e) => {
                    const newValue = e.target.checked;
                    if (newValue) {
                      // When checked, select both Top Image and Bottom Image
                      setShowTopImage(true);
                      setShowBottomImage(true);
                    } else {
                      // When unchecked, stop cycling, reset transparency, and set tool to Select
                      setTransparency(50); // Reset to middle
                      setCurrentTool('select');
                    }
                    setIsTransparencyCycling(newValue);
                  }} />
                  <span style={{ marginLeft: 6, fontSize: 12 }}>Cycle</span>
                </label>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={transparency}
                onChange={(e) => setTransparency(Number(e.target.value))}
                onDoubleClick={() => handleSliderDoubleClick('transparency')}
                className="slider"
                style={{ width: '100%', marginTop: 6 }}
              />
            </div>
          </div>

          {/* Canvas welcome note - shown when no project is loaded */}
          {!topImage && !bottomImage && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              padding: '24px 32px',
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: 8,
              border: '2px solid #4CAF50',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              zIndex: 1,
              maxWidth: '500px'
            }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#000', marginBottom: '12px' }}>
                PCB Reverse Engineering Tool
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#000', marginBottom: '16px', lineHeight: '1.5' }}>
                Supports Typical 4-Layer PCBs
              </div>
              <div style={{ fontSize: '13px', color: '#555', marginBottom: '8px', lineHeight: '1.5' }}>
                Use the <strong>File</strong> menu to start a new project.
              </div>
              <div style={{ fontSize: '13px', color: '#555', marginBottom: '12px', lineHeight: '1.5' }}>
                Use the <strong>Images</strong> menu to load PCB photos.
              </div>
            </div>
          )}

          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleCanvasWheel}
            onDoubleClick={handleCanvasDoubleClick}
            className={`pcb-canvas ${currentTool === 'transform' ? 'transform-cursor' : currentTool === 'draw' ? 'draw-cursor' : currentTool === 'erase' ? 'erase-cursor' : 'default-cursor'}`}
            style={{
              ...(canvasCursor ? { cursor: canvasCursor } : (currentTool === 'pan' ? { cursor: isPanning ? 'grabbing' : 'grab' } : {})),
              width: `${canvasSize.width}px`,
              height: `${canvasSize.height}px`,
              maxHeight: 'none',
              aspectRatio: 'auto',
              border: 'none'
            }}
          />
          
          {/* Component Properties Editor Dialog */}
          {componentEditor && componentEditor.visible && (() => {
            // Find the component being edited - check both layers in case layer was changed
            let comp = componentsTop.find(c => c.id === componentEditor.id);
            let actualLayer: 'top' | 'bottom' = 'top';
            if (!comp) {
              comp = componentsBottom.find(c => c.id === componentEditor.id);
              actualLayer = 'bottom';
            }
            if (!comp) return null;
            
            // Update componentEditor layer if it doesn't match the actual component's layer
            if (componentEditor.layer !== actualLayer) {
              setComponentEditor({ ...componentEditor, layer: actualLayer });
            }
            
            return (
              <div
                data-component-editor-dialog
                onClick={(e) => {
                  // Don't interfere with pin connection clicks - let document handler deal with it
                  if (connectingPin && connectingPin.componentId === comp.id) {
                    // Only stop propagation for dialog content (buttons, inputs)
                    const target = e.target as HTMLElement;
                    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input')) {
                      e.stopPropagation();
                    }
                  }
                }}
                style={{
                  position: 'fixed',
                  top: componentDialogPosition ? `${componentDialogPosition.y}px` : '50%',
                  left: componentDialogPosition ? `${componentDialogPosition.x}px` : '50%',
                  transform: componentDialogPosition ? 'translate(-50%, -50%)' : 'translate(-50%, -50%)',
                  background: connectingPin && connectingPin.componentId === comp.id ? 'rgba(255, 255, 255, 0.95)' : '#fff',
                  border: '1px solid #0b5fff',
                  borderRadius: 4,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  zIndex: 1000,
                  minWidth: '175px',
                  maxWidth: '250px',
                  maxHeight: '40vh',
                  display: 'flex',
                  flexDirection: 'column',
                  pointerEvents: 'auto',
                  cursor: isDraggingDialog ? 'grabbing' : 'default',
                }}
              >
                {/* Fixed header - does not scroll */}
                <div 
                  onMouseDown={(e) => {
                    // Only start dragging if clicking on the header (not buttons/inputs)
                    const target = e.target as HTMLElement;
                    if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.closest('button') || target.closest('input')) {
                      return;
                    }
                    if (componentDialogPosition) {
                      setDialogDragOffset({
                        x: e.clientX - componentDialogPosition.x,
                        y: e.clientY - componentDialogPosition.y,
                      });
                      setIsDraggingDialog(true);
                      e.preventDefault();
                    }
                  }}
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '6px',
                    borderBottom: '1px solid #e0e0e0',
                    background: '#888', // Medium gray background for grabbable window border
                    cursor: isDraggingDialog ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    flexShrink: 0,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: '12px', color: '#fff', fontWeight: 600 }}>Component Properties</h3>
                  <button
                    onClick={() => {
                      setComponentEditor(null);
                      setConnectingPin(null); // Clear pin connection mode
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: '14px',
                      cursor: 'pointer',
                      color: '#fff',
                      padding: 0,
                      width: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ×
                  </button>
                </div>
                
                {/* Scrollable content area */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '4px',
                  padding: '6px',
                  overflowY: 'auto',
                  flex: 1,
                  minHeight: 0,
                }}>
                  {/* Type (read-only) - on one line */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>
                      Type:
                    </label>
                    <div style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', borderRadius: 2, fontSize: '10px', color: '#666' }}>
                      {comp.componentType}
                    </div>
                  </div>
                  
                  {/* Layer (editable) - moved under Component Type, on one line */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label htmlFor={`component-layer-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>
                      Layer:
                    </label>
                    <select
                      id={`component-layer-${comp.id}`}
                      name={`component-layer-${comp.id}`}
                      value={componentEditor.layer}
                      onChange={(e) => setComponentEditor({ ...componentEditor, layer: e.target.value as 'top' | 'bottom' })}
                      disabled={areComponentsLocked}
                      style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }}
                    >
                      <option value="top">Top</option>
                      <option value="bottom">Bottom</option>
                    </select>
                  </div>
                  
                  {/* Part Name - on one line */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label htmlFor={`component-designator-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>
                      Part Name:
                    </label>
                    <input
                      id={`component-designator-${comp.id}`}
                      name={`component-designator-${comp.id}`}
                      type="text"
                      value={componentEditor.designator}
                      onChange={(e) => setComponentEditor({ ...componentEditor, designator: e.target.value })}
                      disabled={areComponentsLocked}
                      style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }}
                      placeholder="e.g., Op Amp OP07"
                    />
                  </div>
                  
                  {/* Designator - on one line */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label htmlFor={`component-abbreviation-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>
                      Designator:
                    </label>
                    <input
                      id={`component-abbreviation-${comp.id}`}
                      name={`component-abbreviation-${comp.id}`}
                      type="text"
                      maxLength={4}
                      value={componentEditor.abbreviation.replace(/\*/g, '')}
                      onChange={(e) => {
                        const val = e.target.value.substring(0, 4).toUpperCase();
                        setComponentEditor({ ...componentEditor, abbreviation: val });
                      }}
                      onBlur={(e) => {
                        const val = e.target.value.substring(0, 4).toUpperCase();
                        setComponentEditor({ ...componentEditor, abbreviation: val });
                      }}
                      disabled={areComponentsLocked}
                      style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', fontFamily: 'monospace', textTransform: 'uppercase', opacity: areComponentsLocked ? 0.6 : 1 }}
                      placeholder="e.g., U2, R7, C1"
                    />
                  </div>
                  
                  {/* X - on one line */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label htmlFor={`component-x-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>
                      X:
                    </label>
                    <input
                      id={`component-x-${comp.id}`}
                      name={`component-x-${comp.id}`}
                      type="number"
                      value={componentEditor.x.toFixed(2)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setComponentEditor({ ...componentEditor, x: val });
                      }}
                      disabled={areComponentsLocked}
                      style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }}
                    />
                  </div>
                  
                  {/* Y - on one line */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label htmlFor={`component-y-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>
                      Y:
                    </label>
                    <input
                      id={`component-y-${comp.id}`}
                      name={`component-y-${comp.id}`}
                      type="number"
                      value={componentEditor.y.toFixed(2)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setComponentEditor({ ...componentEditor, y: val });
                      }}
                      disabled={areComponentsLocked}
                      style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }}
                    />
                  </div>
                  
                  {/* Manufacturer - on one line */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label htmlFor={`component-manufacturer-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>
                      Manufacturer:
                    </label>
                    <input
                      id={`component-manufacturer-${comp.id}`}
                      name={`component-manufacturer-${comp.id}`}
                      type="text"
                      value={componentEditor.manufacturer}
                      onChange={(e) => setComponentEditor({ ...componentEditor, manufacturer: e.target.value })}
                      disabled={areComponentsLocked}
                      style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }}
                    />
                  </div>
                  
                  {/* Part Number - on one line */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label htmlFor={`component-partnumber-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>
                      Part Number:
                    </label>
                    <input
                      id={`component-partnumber-${comp.id}`}
                      name={`component-partnumber-${comp.id}`}
                      type="text"
                      value={componentEditor.partNumber}
                      onChange={(e) => setComponentEditor({ ...componentEditor, partNumber: e.target.value })}
                      disabled={areComponentsLocked}
                      style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }}
                    />
                  </div>
                  
                  {/* Pin Count - on one line */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label htmlFor={`component-pincount-${comp.id}`} style={{ fontSize: '9px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap', width: '90px', flexShrink: 0 }}>
                      Pin Count:
                    </label>
                    <input
                      id={`component-pincount-${comp.id}`}
                      name={`component-pincount-${comp.id}`}
                      type="number"
                      min="1"
                      value={componentEditor.pinCount}
                      onChange={(e) => {
                        const newPinCount = Math.max(1, parseInt(e.target.value) || 1);
                        setComponentEditor({ ...componentEditor, pinCount: newPinCount });
                      }}
                      onBlur={(e) => {
                        // Update component immediately when focus leaves the field
                        if (areComponentsLocked) {
                          alert('Cannot edit: Components are locked. Unlock components to edit them.');
                          return;
                        }
                        const newPinCount = Math.max(1, parseInt(e.target.value) || 1);
                        // Find the component in the appropriate layer
                        const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
                        const currentComp = currentCompList.find(c => c.id === componentEditor.id);
                        if (currentComp && newPinCount !== currentComp.pinCount) {
                          // Resize pinConnections array, preserving existing connections
                          const currentConnections = currentComp.pinConnections || [];
                          const newPinConnections = new Array(newPinCount).fill('').map((_, i) => 
                            i < currentConnections.length ? currentConnections[i] : ''
                          );
                          // Update the component
                          const updatedComp = {
                            ...currentComp,
                            pinCount: newPinCount,
                            pinConnections: newPinConnections,
                          };
                          // Update in the appropriate layer array
                          if (componentEditor.layer === 'top') {
                            setComponentsTop(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                          } else {
                            setComponentsBottom(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                          }
                          // Update componentEditor to reflect the change
                          setComponentEditor({ ...componentEditor, pinCount: newPinCount });
                        }
                      }}
                      disabled={areComponentsLocked}
                      style={{ flex: 1, padding: '2px 3px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', color: '#666', opacity: areComponentsLocked ? 0.6 : 1 }}
                    />
                  </div>
                  
                  {/* Pin Connections */}
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: '#333', marginBottom: '2px' }}>
                      Pin Connections:
                    </label>
                    {connectingPin && connectingPin.componentId === comp.id && (
                      <div style={{ padding: '2px 3px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 2, marginBottom: '2px', fontSize: '9px', color: '#856404' }}>
                        Pin {connectingPin.pinIndex + 1} selected. Click on a via or pad to connect.
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '1px' }}>
                      {Array.from({ length: componentEditor.pinCount }, (_, i) => {
                        // Read pin connection from the current component state (should update reactively)
                        // Re-find the component to ensure we have the latest state
                        const currentCompList = componentEditor.layer === 'top' ? componentsTop : componentsBottom;
                        const currentComp = currentCompList.find(c => c.id === componentEditor.id);
                        const pinConnection = currentComp?.pinConnections && currentComp.pinConnections.length > i ? currentComp.pinConnections[i] : '';
                        const isSelected = connectingPin && connectingPin.componentId === comp.id && connectingPin.pinIndex === i;
                        // Debug: log pin connection state for all pins when in connection mode
                        if (connectingPin && connectingPin.componentId === comp.id) {
                          console.log(`Component Editor Pin ${i + 1}: pinConnection="${pinConnection}", comp.pinConnections=`, currentComp?.pinConnections);
                        }
                        return (
                          <label
                            key={i}
                            htmlFor={`pin-radio-${comp.id}-${i}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 4px',
                              cursor: 'pointer',
                              fontSize: '9px',
                              border: isSelected ? '1px solid #0b5fff' : pinConnection ? '1px solid #28a745' : '1px solid #ddd',
                              borderRadius: 2,
                              background: isSelected ? '#e6f0ff' : pinConnection ? '#d4edda' : '#fff',
                            }}
                            title={pinConnection ? `Connected to: ${pinConnection}` : 'Select this pin, then click on a via or pad to connect'}
                          >
                            <input
                              id={`pin-radio-${comp.id}-${i}`}
                              name={`pin-radio-${comp.id}`}
                              type="radio"
                              checked={!!isSelected}
                              onChange={() => {
                                if (areComponentsLocked) {
                                  alert('Cannot edit: Components are locked. Unlock components to edit them.');
                                  return;
                                }
                                if (isSelected) {
                                  // Deselect if already selected
                                  setConnectingPin(null);
                                } else {
                                  // Select this pin for connection
                                  setConnectingPin({ componentId: comp.id, pinIndex: i });
                                }
                              }}
                              disabled={areComponentsLocked}
                              style={{ margin: 0, cursor: areComponentsLocked ? 'not-allowed' : 'pointer', opacity: areComponentsLocked ? 0.6 : 1 }}
                            />
                            <span style={{ color: '#333', fontWeight: isSelected ? 600 : 400 }}>
                              Pin {i + 1}
                            </span>
                            {pinConnection && (
                              <span style={{ fontSize: '8px', color: '#28a745', fontWeight: 600, marginLeft: 'auto' }}>
                                {pinConnection}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Type-specific properties would go here - for now, just show basic ones */}
                  {/* TODO: Add type-specific property fields based on componentType */}
                </div>
                
                {/* Fixed footer - does not scroll */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'flex-end', 
                  gap: '3px',
                  padding: '6px',
                  borderTop: '1px solid #e0e0e0',
                  flexShrink: 0,
                }}>
                  <button
                    onClick={() => {
                      setComponentEditor(null);
                      setConnectingPin(null); // Clear pin connection mode
                    }}
                    style={{
                      padding: '2px 5px',
                      background: '#f5f5f5',
                      border: '1px solid #ddd',
                      borderRadius: 2,
                      cursor: 'pointer',
                      fontSize: '10px',
                      color: '#333',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // Don't allow saving if components are locked
                      if (areComponentsLocked) {
                        alert('Cannot edit: Components are locked. Unlock components to edit them.');
                        return;
                      }
                      // Update the component with new values
                      const updateComponent = (comp: PCBComponent): PCBComponent => {
                        const updated = { ...comp };
                        updated.designator = componentEditor.designator;
                        updated.x = componentEditor.x;
                        updated.y = componentEditor.y;
                        updated.layer = componentEditor.layer; // Update layer property
                        // Store abbreviation as a dynamic property (no padding needed, just use as-is)
                        (updated as any).abbreviation = componentEditor.abbreviation.trim() || getDefaultAbbreviation(comp.componentType);
                        if ('manufacturer' in updated) {
                          (updated as any).manufacturer = componentEditor.manufacturer;
                        }
                        if ('partNumber' in updated) {
                          (updated as any).partNumber = componentEditor.partNumber;
                        }
                        // Update pin count if changed
                        if (componentEditor.pinCount !== comp.pinCount) {
                          updated.pinCount = componentEditor.pinCount;
                          // Resize pinConnections array, preserving existing connections
                          const currentConnections = comp.pinConnections || [];
                          updated.pinConnections = new Array(componentEditor.pinCount).fill('').map((_, i) => 
                            i < currentConnections.length ? currentConnections[i] : ''
                          );
                        } else {
                          // Preserve existing pinConnections even if pin count didn't change
                          updated.pinConnections = comp.pinConnections || [];
                        }
                        return updated;
                      };
                      
                      // Handle layer changes - move component between layers if needed
                      // First, find the component in either layer array
                      const compInTop = componentsTop.find(c => c.id === componentEditor.id);
                      const compInBottom = componentsBottom.find(c => c.id === componentEditor.id);
                      const currentComp = compInTop || compInBottom;
                      
                      if (currentComp) {
                        // Component exists - update it
                        const updatedComp = updateComponent(currentComp);
                        
                        // Check if layer changed
                        const oldLayer = currentComp.layer;
                        const newLayer = componentEditor.layer;
                        
                        if (oldLayer !== newLayer) {
                          // Layer changed - move component between arrays
                          if (oldLayer === 'top') {
                            // Remove from top, add to bottom
                            setComponentsTop(prev => prev.filter(c => c.id !== componentEditor.id));
                            setComponentsBottom(prev => [...prev, updatedComp]);
                          } else {
                            // Remove from bottom, add to top
                            setComponentsBottom(prev => prev.filter(c => c.id !== componentEditor.id));
                            setComponentsTop(prev => [...prev, updatedComp]);
                          }
                        } else {
                          // Layer unchanged - update in place
                          if (newLayer === 'top') {
                            setComponentsTop(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                          } else {
                            setComponentsBottom(prev => prev.map(c => c.id === componentEditor.id ? updatedComp : c));
                          }
                        }
                      } else {
                        // Component not found - this shouldn't happen, but handle gracefully
                        console.warn(`Component ${componentEditor.id} not found in either layer array`);
                        // Try to find in the other layer and move it, or create a minimal component
                        // This is a fallback that shouldn't normally be needed
                        if (componentEditor.layer === 'top') {
                          const compInBottom = componentsBottom.find(c => c.id === componentEditor.id);
                          if (compInBottom) {
                            const updatedComp = updateComponent(compInBottom);
                            setComponentsBottom(prev => prev.filter(c => c.id !== componentEditor.id));
                            setComponentsTop(prev => [...prev, updatedComp]);
                          }
                        } else {
                          const compInTop = componentsTop.find(c => c.id === componentEditor.id);
                          if (compInTop) {
                            const updatedComp = updateComponent(compInTop);
                            setComponentsTop(prev => prev.filter(c => c.id !== componentEditor.id));
                            setComponentsBottom(prev => [...prev, updatedComp]);
                          }
                        }
                      }
                      
                      setComponentEditor(null);
                      setConnectingPin(null); // Clear pin connection mode
                    }}
                    disabled={areComponentsLocked}
                    style={{
                      padding: '2px 5px',
                      background: areComponentsLocked ? '#f5f5f5' : '#0b5fff',
                      color: areComponentsLocked ? '#999' : '#fff',
                      border: '1px solid #ddd',
                      borderRadius: 2,
                      cursor: areComponentsLocked ? 'not-allowed' : 'pointer',
                      fontSize: '10px',
                      opacity: areComponentsLocked ? 0.6 : 1,
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Power Properties Editor Dialog */}
          {powerEditor && powerEditor.visible && (() => {
            const power = powers.find(p => p.id === powerEditor.id);
            if (!power) return null;
            
            const bus = powerBuses.find(b => b.id === powerEditor.powerBusId);
            
            return (
              <div
                style={{
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: '#fff',
                  border: '1px solid #0b5fff',
                  borderRadius: 4,
                  padding: '6px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  zIndex: 1000,
                  minWidth: '175px',
                  maxWidth: '250px',
                  maxHeight: '40vh',
                  overflowY: 'auto',
                  pointerEvents: 'auto',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <h3 style={{ margin: 0, fontSize: '12px', color: '#333', fontWeight: 600 }}>Power Properties</h3>
                  <button
                    onClick={() => setPowerEditor(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: '14px',
                      cursor: 'pointer',
                      color: '#666',
                      padding: 0,
                      width: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ×
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* Power Bus (read-only) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: '#333', marginBottom: '1px' }}>
                      Power Bus:
                    </label>
                    <div style={{ padding: '2px 3px', background: '#f5f5f5', borderRadius: 2, fontSize: '10px', color: '#666' }}>
                      {bus ? `${bus.name} (${bus.voltage})` : 'Unknown'}
                    </div>
                  </div>
                  
                  {/* Layer */}
                  <div>
                    <label htmlFor={`power-layer-${powerEditor.id}`} style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: '#333', marginBottom: '1px' }}>
                      Layer:
                    </label>
                    <select
                      id={`power-layer-${powerEditor.id}`}
                      name={`power-layer-${powerEditor.id}`}
                      value={powerEditor.layer}
                      onChange={(e) => setPowerEditor({ ...powerEditor, layer: e.target.value as 'top' | 'bottom' })}
                      disabled={arePowerNodesLocked}
                      style={{ width: '100%', padding: '2px 3px', border: '1px solid #ddd', borderRadius: 2, fontSize: '10px', opacity: arePowerNodesLocked ? 0.6 : 1 }}
                    >
                      <option value="top">Top</option>
                      <option value="bottom">Bottom</option>
                    </select>
                  </div>
                  
                  {/* X Position (read-only) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: '#333', marginBottom: '1px' }}>
                      X:
                    </label>
                    <div style={{ padding: '2px 3px', background: '#f5f5f5', borderRadius: 2, fontSize: '10px', color: '#666' }}>
                      {powerEditor.x.toFixed(2)}
                    </div>
                  </div>
                  
                  {/* Y Position (read-only) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: '#333', marginBottom: '1px' }}>
                      Y:
                    </label>
                    <div style={{ padding: '2px 3px', background: '#f5f5f5', borderRadius: 2, fontSize: '10px', color: '#666' }}>
                      {powerEditor.y.toFixed(2)}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '3px', marginTop: '6px' }}>
                  <button
                    onClick={() => setPowerEditor(null)}
                    style={{
                      padding: '2px 5px',
                      background: '#f5f5f5',
                      border: '1px solid #ddd',
                      borderRadius: 2,
                      cursor: 'pointer',
                      fontSize: '10px',
                      color: '#333',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (arePowerNodesLocked) return;
                      setPowers(prev => prev.map(p => 
                        p.id === powerEditor.id 
                          ? { ...p, layer: powerEditor.layer }
                          : p
                      ));
                      setPowerEditor(null);
                    }}
                    disabled={arePowerNodesLocked}
                    style={{
                      padding: '2px 5px',
                      background: arePowerNodesLocked ? '#f5f5f5' : '#0b5fff',
                      color: arePowerNodesLocked ? '#999' : '#fff',
                      border: '1px solid #ddd',
                      borderRadius: 2,
                      cursor: arePowerNodesLocked ? 'not-allowed' : 'pointer',
                      fontSize: '10px',
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            );
          })()}
          
          {!topImage && !bottomImage && (
            <div className="placeholder">
            </div>
          )}

          {/* Horizontal scrollbar (bottom) */}
          <div
            ref={hScrollRef}
            className="scrollbar-horizontal"
            onScroll={(e) => {
              if (isSyncingScrollRef.current) return;
              const el = e.currentTarget;
              const origin = contentOriginXRef.current;
              setViewPan((p) => ({ x: -el.scrollLeft - origin, y: p.y }));
            }}
            aria-label="Horizontal pan"
          >
            <div className="scrollbar-horizontal-content" ref={hScrollContentRef} />
          </div>

          {/* Vertical scrollbar (right) */}
          <div
            ref={vScrollRef}
            className="scrollbar-vertical"
            onScroll={(e) => {
              if (isSyncingScrollRef.current) return;
              const el = e.currentTarget;
              const origin = contentOriginYRef.current;
              setViewPan((p) => ({ x: p.x, y: -el.scrollTop - origin }));
            }}
            aria-label="Vertical pan"
          >
          <div className="scrollbar-vertical-content" ref={vScrollContentRef} />
        </div>
      </div>

      {/* Power Bus Manager Dialog */}
      {showPowerBusManager && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', border: '2px solid #333', borderRadius: 8, padding: '20px', zIndex: 1000, minWidth: '500px', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#222' }}>Manage Power Buses</h2>
            <button onClick={() => setShowPowerBusManager(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}>×</button>
          </div>
          <div style={{ marginBottom: '16px' }}>
            {[...powerBuses].sort((a, b) => {
              // Parse voltage strings to extract numeric values (same logic as Power Bus Selector)
              const parseVoltage = (voltage: string): { absValue: number; isNegative: boolean; original: string } => {
                const match = voltage.match(/([+-]?)(\d+\.?\d*)/);
                if (match) {
                  const sign = match[1] || '+';
                  const numValue = parseFloat(match[2]);
                  const absValue = Math.abs(numValue);
                  const isNegative = sign === '-';
                  return { absValue, isNegative, original: voltage };
                }
                return { absValue: Infinity, isNegative: false, original: voltage };
              };
              
              const aParsed = parseVoltage(a.voltage);
              const bParsed = parseVoltage(b.voltage);
              
              if (aParsed.absValue !== bParsed.absValue) {
                return aParsed.absValue - bParsed.absValue;
              }
              
              if (aParsed.isNegative !== bParsed.isNegative) {
                return aParsed.isNegative ? -1 : 1;
              }
              
              return 0;
            }).map((bus) => {
              // Find the original index for state updates
              const originalIndex = powerBuses.findIndex(b => b.id === bus.id);
              return (
              <div key={bus.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', marginBottom: '8px', background: '#f5f5f5', borderRadius: 6, border: '1px solid #ddd' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: bus.color, border: '2px solid #333' }} />
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={bus.name}
                    onChange={(e) => {
                      const updated = [...powerBuses];
                      updated[originalIndex] = { ...bus, name: e.target.value };
                      setPowerBuses(updated);
                    }}
                    placeholder="Name"
                    style={{ width: '100%', padding: '4px 8px', marginBottom: '4px', border: '1px solid #ccc', borderRadius: 4, fontSize: '13px' }}
                  />
                  <input
                    type="text"
                    value={bus.voltage}
                    onChange={(e) => {
                      const updated = [...powerBuses];
                      updated[originalIndex] = { ...bus, voltage: e.target.value };
                      setPowerBuses(updated);
                    }}
                    placeholder="Voltage (e.g., +5VDC, +3.3VDC, -5VDC)"
                    style={{ width: '100%', padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, fontSize: '13px' }}
                  />
                </div>
                <input
                  type="color"
                  value={bus.color}
                  onChange={(e) => {
                    const updated = [...powerBuses];
                    updated[originalIndex] = { ...bus, color: e.target.value };
                    setPowerBuses(updated);
                  }}
                  style={{ width: '40px', height: '40px', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}
                />
                <button
                  onClick={() => {
                    // Don't allow deleting if any power nodes use this bus
                    const nodesUsingBus = powers.filter(p => p.powerBusId === bus.id);
                    if (nodesUsingBus.length > 0) {
                      alert(`Cannot delete: ${nodesUsingBus.length} power node(s) are using this bus. Remove or reassign them first.`);
                      return;
                    }
                    setPowerBuses(prev => prev.filter(b => b.id !== bus.id));
                  }}
                  style={{ padding: '6px 12px', background: '#ff4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '12px' }}
                >
                  Delete
                </button>
              </div>
            );
            })}
          </div>
          <button
            onClick={() => {
              const newBus: PowerBus = {
                id: `powerbus-${Date.now()}-${Math.random()}`,
                name: 'New Power Bus',
                voltage: '+0VDC',
                color: '#ff0000',
              };
              setPowerBuses(prev => [...prev, newBus]);
            }}
            style={{ width: '100%', padding: '10px', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}
          >
            + Add Power Bus
          </button>
          <button
            onClick={() => setShowPowerBusManager(false)}
            style={{ width: '100%', padding: '10px', background: '#666', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}
          >
            Close
          </button>
        </div>
      )}

      {/* Hidden file inputs for Load Top/Bottom PCB menu items */}
      <input
        ref={fileInputTopRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImageLoad(file, 'top');
          e.target.value = ''; // Reset so same file can be loaded again
        }}
      />
      <input
        ref={fileInputBottomRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImageLoad(file, 'bottom');
          e.target.value = ''; // Reset so same file can be loaded again
        }}
      />
      <input
        ref={openProjectRef}
        type="file"
        accept=".json,application/json"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            try {
              // Update current project file path
              setCurrentProjectFilePath(file.name);
              const text = await file.text();
              const project = JSON.parse(text);
              await loadProject(project);
              
              // Extract project name from project data or filename
              let projectNameToUse: string;
              if (project.projectInfo?.name) {
                projectNameToUse = project.projectInfo.name;
              } else {
                // Extract from filename (remove .json extension)
                const projectNameFromFile = file.name.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
                projectNameToUse = projectNameFromFile || 'pcb_project';
                setProjectName(projectNameToUse);
                localStorage.setItem('pcb_project_name', projectNameToUse);
              }
              
              // Ensure project name is set (loadProject may have set it, but verify)
              if (!projectName) {
                setProjectName(projectNameToUse);
                localStorage.setItem('pcb_project_name', projectNameToUse);
              }
              
              // Auto save settings are restored from project file if present
              // Check if auto-save is enabled in the project file
              // Use setTimeout to allow React state updates from loadProject to complete
              setTimeout(() => {
                // Check both the original project data and current state
                // If project file doesn't have autoSave enabled, or if it was disabled by loadProject
                // (e.g., due to missing directory handle), show the prompt
                const wasAutoSaveEnabledInFile = project.autoSave?.enabled === true;
                if (!wasAutoSaveEnabledInFile) {
                  setAutoSavePromptDialog({ visible: true, source: 'open' });
                }
              }, 100);
            } catch (err) {
              console.error('Failed to open project', err);
              alert('Failed to open project file. See console for details.');
            }
          }
          e.target.value = ''; // Reset so same file can be loaded again
        }}
      />
      
      {/* Detailed Information Dialog */}
      {debugDialog.visible && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: '20px',
            zIndex: 10000,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 8,
              padding: '20px',
              minWidth: '150px',
              maxWidth: '400px',
              width: 'fit-content',
              maxHeight: '80%',
              overflow: 'auto',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              position: 'relative',
              pointerEvents: 'auto',
              border: '1px solid #ddd',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#222' }}>Detailed Information</h2>
              <button
                onClick={() => setDebugDialog({ visible: false, text: '' })}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: 0,
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>
            <div
              style={{
                margin: 0,
                padding: 0,
                backgroundColor: '#f5f5f5',
                borderRadius: 4,
                fontSize: '12px',
                fontFamily: 'monospace',
                maxHeight: 'calc(80vh - 100px)',
                overflow: 'auto',
                color: '#000',
              }}
            >
              {/* Object Count - Display at top */}
              {(() => {
                const strokeCount = drawingStrokes.filter(s => selectedIds.has(s.id)).length;
                const componentCount = [...componentsTop, ...componentsBottom].filter(c => selectedComponentIds.has(c.id)).length;
                const powerCount = powers.filter(p => selectedPowerIds.has(p.id)).length;
                const groundCount = grounds.filter(g => selectedGroundIds.has(g.id)).length;
                const totalCount = strokeCount + componentCount + powerCount + groundCount;
                return totalCount > 0 ? (
                  <div style={{ 
                    padding: '12px 16px', 
                    backgroundColor: '#e8e8e8', 
                    borderBottom: '2px solid #ccc',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#333',
                    marginBottom: '8px'
                  }}>
                    {totalCount} Object{totalCount !== 1 ? 's' : ''} Selected
                  </div>
                ) : null;
              })()}
              
              {/* Components - Formatted UI */}
              {selectedComponentIds.size > 0 && (() => {
                // Check if there are any vias or pads in the selected items
                const hasViasOrPads = drawingStrokes.some(s => selectedIds.has(s.id) && (s.type === 'via' || s.type === 'pad'));
                return [...componentsTop, ...componentsBottom].filter(c => selectedComponentIds.has(c.id)).map((comp) => (
                  <div key={comp.id} style={{ marginTop: '16px', padding: 0, backgroundColor: '#fff', borderRadius: 4, border: '1px solid #ddd' }}>
                    <div style={{ backgroundColor: '#000', marginBottom: '12px', display: 'flex', alignItems: 'center', padding: '8px 12px', minHeight: '32px' }}>
                      <label style={{ fontSize: '11px', color: '#fff', marginRight: '8px' }}>Type:</label>
                      <div style={{ 
                        color: '#fff', 
                        padding: '4px 8px', 
                        fontSize: '12px',
                        fontWeight: 500
                      }}>
                        {comp.componentType}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                      <div>Layer: {comp.layer}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>Designator: {comp.designator || '(empty)'}</span>
                        {hasViasOrPads && (
                          <button
                            onClick={() => {
                              // Get all selected components of the same type
                              const allSelectedComponents = [...componentsTop, ...componentsBottom]
                                .filter(c => selectedComponentIds.has(c.id) && c.componentType === comp.componentType);
                              
                              const componentCount = allSelectedComponents.length;
                              
                              // Get all selected pads with their Node IDs (prioritize pads over vias)
                              const selectedPads = drawingStrokes
                                .filter(s => selectedIds.has(s.id) && s.type === 'pad' && s.points.length > 0 && s.points[0].id !== undefined)
                                .map(s => ({
                                  stroke: s,
                                  nodeId: s.points[0].id!
                                }))
                                .sort((a, b) => a.nodeId - b.nodeId); // Sort by Node ID ascending
                              
                              // If no pads, get vias instead
                              const selectedItems = selectedPads.length > 0 
                                ? selectedPads 
                                : drawingStrokes
                                    .filter(s => selectedIds.has(s.id) && s.type === 'via' && s.points.length > 0 && s.points[0].id !== undefined)
                                    .map(s => ({
                                      stroke: s,
                                      nodeId: s.points[0].id!
                                    }))
                                    .sort((a, b) => a.nodeId - b.nodeId); // Sort by Node ID ascending
                              
                              const totalItemCount = selectedItems.length;
                              if (totalItemCount === 0) {
                                console.warn('No vias or pads with Node IDs found in selection');
                                return;
                              }
                              
                              // Calculate pins per component
                              const pinsPerComponent = Math.floor(totalItemCount / componentCount);
                              if (pinsPerComponent === 0) {
                                console.warn(`Not enough ${selectedPads.length > 0 ? 'pads' : 'vias'} (${totalItemCount}) for ${componentCount} components`);
                                return;
                              }
                              
                              // Sort components by ID for consistent assignment
                              const sortedComponents = [...allSelectedComponents].sort((a, b) => a.id.localeCompare(b.id));
                              
                              // Assign pins to each component sequentially
                              sortedComponents.forEach((component, compIndex) => {
                                const startIndex = compIndex * pinsPerComponent;
                                const endIndex = startIndex + pinsPerComponent;
                                const componentNodeIds = selectedItems.slice(startIndex, endIndex);
                                
                                // Create pin connections array for this component
                                const newPinConnections = componentNodeIds.map(item => item.nodeId.toString());
                                
                                // Update component based on layer
                                if (component.layer === 'top') {
                                  setComponentsTop(prev => prev.map(c => {
                                    if (c.id === component.id) {
                                      return {
                                        ...c,
                                        pinCount: pinsPerComponent,
                                        pinConnections: newPinConnections
                                      };
                                    }
                                    return c;
                                  }));
                                } else {
                                  setComponentsBottom(prev => prev.map(c => {
                                    if (c.id === component.id) {
                                      return {
                                        ...c,
                                        pinCount: pinsPerComponent,
                                        pinConnections: newPinConnections
                                      };
                                    }
                                    return c;
                                  }));
                                }
                              });
                              
                              const itemType = selectedPads.length > 0 ? 'pads' : 'vias';
                              console.log(`Connected ${componentCount} components of type ${comp.componentType} to ${totalItemCount} ${itemType} (${pinsPerComponent} pins each)`);
                            }}
                            style={{
                              padding: '2px 8px',
                              fontSize: '10px',
                              backgroundColor: '#4CAF50',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#45a049';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#4CAF50';
                            }}
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    <div>Abbreviation: {(comp as any).abbreviation || '(empty)'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Color:</span>
                      <div style={{ width: '16px', height: '16px', backgroundColor: comp.color, border: '1px solid #ccc', borderRadius: 2 }}></div>
                      <span>{comp.color}</span>
                    </div>
                    <div>Size: {comp.size}</div>
                    <div>Pin Count: {comp.pinCount}</div>
                    {comp.pinConnections && comp.pinConnections.length > 0 && (
                      <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                        <div style={{ marginBottom: '4px', fontWeight: 600 }}>Pin Connections:</div>
                        <table style={{ 
                          width: '100%', 
                          borderCollapse: 'collapse', 
                          fontSize: '10px',
                          border: '1px solid #ddd'
                        }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f0f0f0' }}>
                              <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 600 }}>Pin #</th>
                              <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 600 }}>Node ID</th>
                            </tr>
                          </thead>
                          <tbody>
                            {comp.pinConnections.map((conn, idx) => (
                              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                                <td style={{ padding: '4px 8px', border: '1px solid #ddd' }}>{idx + 1}</td>
                                <td style={{ padding: '4px 8px', border: '1px solid #ddd' }}>{conn || '(not connected)'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {'manufacturer' in comp && (comp as any).manufacturer && (
                      <div>Manufacturer: {(comp as any).manufacturer}</div>
                    )}
                    {'partNumber' in comp && (comp as any).partNumber && (
                      <div>Part Number: {(comp as any).partNumber}</div>
                    )}
                    <div>Position: x={comp.x.toFixed(2)}, y={comp.y.toFixed(2)}</div>
                  </div>
                </div>
              ));
              })()}
              
              {/* Vias - Formatted UI */}
              {selectedIds.size > 0 && drawingStrokes.filter(s => selectedIds.has(s.id) && s.type === 'via' && s.points.length > 0).map((stroke) => {
                const point = stroke.points[0];
                // Determine via type - all vias are "Top and Bottom" since blind vias aren't supported yet
                // Vias always have an id, so this is safe
                const viaType = stroke.viaType || (point.id !== undefined ? determineViaType(point.id, powerBuses) : 'Via (Signal)');
                return (
                  <div key={stroke.id} style={{ marginTop: '16px', padding: 0, backgroundColor: '#fff', borderRadius: 4, border: '1px solid #ddd' }}>
                    <div style={{ backgroundColor: '#000', marginBottom: '12px', display: 'flex', alignItems: 'center', padding: '8px 12px', minHeight: '32px' }}>
                      <label style={{ fontSize: '11px', color: '#fff', marginRight: '8px' }}>Type:</label>
                      <div style={{ 
                        color: '#fff', 
                        padding: '4px 8px', 
                        fontSize: '12px',
                        fontWeight: 500
                      }}>
                        {viaType}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                      {point.id && <div>Node ID: {point.id}</div>}
                      <div>Layer: Top and Bottom</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Color:</span>
                        <div style={{ width: '16px', height: '16px', backgroundColor: stroke.color, border: '1px solid #ccc', borderRadius: 2 }}></div>
                        <span>{stroke.color}</span>
                      </div>
                      <div>Size: {stroke.size}</div>
                      <div>Position: x={point.x.toFixed(2)}, y={point.y.toFixed(2)}</div>
                    </div>
                  </div>
                );
              })}
              
              {/* Pads - Formatted UI */}
              {selectedIds.size > 0 && drawingStrokes.filter(s => selectedIds.has(s.id) && s.type === 'pad' && s.points.length > 0).map((stroke) => {
                const point = stroke.points[0];
                // Determine pad type - pads belong to only one layer (top or bottom)
                // Pads always have an id, so this is safe
                const padType = stroke.padType || (point.id !== undefined ? determinePadType(point.id, powerBuses) : 'Pad (Signal)');
                return (
                  <div key={stroke.id} style={{ marginTop: '16px', padding: 0, backgroundColor: '#fff', borderRadius: 4, border: '1px solid #ddd' }}>
                    <div style={{ backgroundColor: '#000', marginBottom: '12px', display: 'flex', alignItems: 'center', padding: '8px 12px', minHeight: '32px' }}>
                      <label style={{ fontSize: '11px', color: '#fff', marginRight: '8px' }}>Type:</label>
                      <div style={{ 
                        color: '#fff', 
                        padding: '4px 8px', 
                        fontSize: '12px',
                        fontWeight: 500
                      }}>
                        {padType}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                      {point.id && <div>Node ID: {point.id}</div>}
                      <div>Layer: {stroke.layer}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Color:</span>
                        <div style={{ width: '16px', height: '16px', backgroundColor: stroke.color, border: '1px solid #ccc', borderRadius: 2 }}></div>
                        <span>{stroke.color}</span>
                      </div>
                      <div>Size: {stroke.size}</div>
                      <div>Position: x={point.x.toFixed(2)}, y={point.y.toFixed(2)}</div>
                    </div>
                  </div>
                );
              })}
              
              {/* Traces - Formatted UI */}
              {selectedIds.size > 0 && drawingStrokes.filter(s => selectedIds.has(s.id) && s.type === 'trace').map((stroke) => {
                return (
                  <div key={stroke.id} style={{ marginTop: '16px', padding: 0, backgroundColor: '#fff', borderRadius: 4, border: '1px solid #ddd' }}>
                    <div style={{ backgroundColor: '#000', marginBottom: '12px', display: 'flex', alignItems: 'center', padding: '8px 12px', minHeight: '32px' }}>
                      <label style={{ fontSize: '11px', color: '#fff', marginRight: '8px' }}>Type:</label>
                      <div style={{ 
                        color: '#fff', 
                        padding: '4px 8px', 
                        fontSize: '12px',
                        fontWeight: 500
                      }}>
                        {stroke.type || 'unknown'}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                      {stroke.points.length > 0 && (
                        <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                          <div style={{ marginBottom: '4px', fontWeight: 600 }}>Points: {stroke.points.length}</div>
                          <table style={{ 
                            width: '100%', 
                            borderCollapse: 'collapse', 
                            fontSize: '10px',
                            border: '1px solid #ddd'
                          }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f0f0f0' }}>
                                <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 600 }}>Point #</th>
                                <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 600 }}>x</th>
                                <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 600 }}>y</th>
                                <th style={{ padding: '4px 8px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 600 }}>Node ID</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stroke.points.map((p, idx) => (
                                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                                  <td style={{ padding: '4px 8px', border: '1px solid #ddd' }}>{idx}</td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #ddd' }}>{p.x.toFixed(2)}</td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #ddd' }}>{p.y.toFixed(2)}</td>
                                  <td style={{ padding: '4px 8px', border: '1px solid #ddd' }}>{p.id || '(none)'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div style={{ marginTop: '4px' }}>Layer: {stroke.layer}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Color:</span>
                        <div style={{ width: '16px', height: '16px', backgroundColor: stroke.color, border: '1px solid #ccc', borderRadius: 2 }}></div>
                        <span>{stroke.color}</span>
                      </div>
                      <div>Size: {stroke.size}</div>
                    </div>
                  </div>
                );
              })}
              
              {/* Power Symbol Properties */}
              {selectedPowerIds.size > 0 && powers.filter(p => selectedPowerIds.has(p.id)).map((power) => {
                const bus = powerBuses.find(b => b.id === power.powerBusId);
                return (
                  <div key={power.id} style={{ marginTop: '16px', padding: 0, backgroundColor: '#fff', borderRadius: 4, border: '1px solid #ddd' }}>
                    <div style={{ backgroundColor: '#000', marginBottom: '12px', display: 'flex', alignItems: 'center', padding: '8px 12px', minHeight: '32px' }}>
                      <label style={{ fontSize: '11px', color: '#fff', marginRight: '8px' }}>Type:</label>
                      <div style={{ 
                        color: '#fff', 
                        padding: '4px 8px', 
                        fontSize: '12px',
                        fontWeight: 500
                      }}>
                        {power.type || (bus ? `${bus.name} Power Node` : 'Power Node')}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                      <div>Node ID: {power.pointId || '(not assigned)'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Color:</span>
                        <div style={{ width: '16px', height: '16px', backgroundColor: power.color, border: '1px solid #ccc', borderRadius: 2 }}></div>
                        <span>{power.color}</span>
                      </div>
                      <div>Size: {power.size}</div>
                      <div>Layer: {power.layer}</div>
                      <div>Power Bus: {bus?.name || power.powerBusId || '(unknown)'}</div>
                      <div>Position: x={power.x.toFixed(2)}, y={power.y.toFixed(2)}</div>
                    </div>
                  </div>
                );
              })}
              
              {/* Ground Symbol Properties */}
              {selectedGroundIds.size > 0 && grounds.filter(g => selectedGroundIds.has(g.id)).map((ground) => (
                <div key={ground.id} style={{ marginTop: '16px', padding: 0, backgroundColor: '#fff', borderRadius: 4, border: '1px solid #ddd' }}>
                  <div style={{ backgroundColor: '#000', marginBottom: '12px', display: 'flex', alignItems: 'center', padding: '8px 12px', minHeight: '32px' }}>
                    <label style={{ fontSize: '11px', color: '#fff', marginRight: '8px' }}>Type:</label>
                    <div style={{ 
                      color: '#fff', 
                      padding: '4px 8px', 
                      fontSize: '12px',
                      fontWeight: 500
                    }}>
                      {ground.type || 'Ground Node'}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                    <div>Node ID: {ground.pointId || '(not assigned)'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Color:</span>
                      <div style={{ width: '16px', height: '16px', backgroundColor: ground.color, border: '1px solid #ccc', borderRadius: 2 }}></div>
                      <span>{ground.color}</span>
                    </div>
                    <div>Size: {ground.size}</div>
                    <div>Position: x={ground.x.toFixed(2)}, y={ground.y.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New Project Confirmation Dialog */}
      {newProjectDialog.visible && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
          }}
          onClick={(e) => {
            // Close dialog if clicking on backdrop
            if (e.target === e.currentTarget) {
              handleNewProjectCancel();
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#2b2b31',
              borderRadius: 8,
              padding: '24px',
              minWidth: '400px',
              maxWidth: '500px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              border: '1px solid #1f1f24',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#f2f2f2' }}>
              New Project
            </h2>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#e0e0e0', lineHeight: '1.5' }}>
              You have unsaved changes. Do you want to save your project before creating a new one?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={handleNewProjectCancel}
                style={{
                  padding: '8px 16px',
                  background: '#444',
                  color: '#f2f2f2',
                  border: '1px solid #555',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleNewProjectNo}
                style={{
                  padding: '8px 16px',
                  background: '#555',
                  color: '#f2f2f2',
                  border: '1px solid #666',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                No
              </button>
              <button
                ref={newProjectYesButtonRef}
                onClick={handleNewProjectYes}
                style={{
                  padding: '8px 16px',
                  background: '#4CAF50',
                  color: '#fff',
                  border: '1px solid #45a049',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
                autoFocus
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Project Setup Dialog */}
      {newProjectSetupDialog.visible && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10002,
          }}
          onClick={(e) => {
            // Close dialog if clicking on backdrop
            if (e.target === e.currentTarget) {
              handleNewProjectSetupCancel();
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#2b2b31',
              borderRadius: 8,
              padding: '24px',
              minWidth: '400px',
              maxWidth: '500px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              border: '1px solid #1f1f24',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#f2f2f2' }}>
              New Project
            </h2>
            
            {/* Project Name */}
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#e0e0e0', fontWeight: 500 }}>
              Project Name:
            </label>
            <input
              ref={newProjectNameInputRef}
              type="text"
              value={newProjectSetupDialog.projectName}
              onChange={(e) => {
                // Allow all characters to be typed - validation happens on create
                setNewProjectSetupDialog(prev => ({ ...prev, projectName: e.target.value }));
              }}
              onKeyDown={(e) => {
                // Don't prevent any keys - allow all input including underscore, hyphen, etc.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleNewProjectCreate();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleNewProjectSetupCancel();
                }
                // All other keys (including underscore, hyphen, etc.) are allowed
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                marginBottom: '8px',
                background: '#1f1f24',
                border: '1px solid #444',
                borderRadius: 6,
                color: '#f2f2f2',
                fontSize: '14px',
              }}
              placeholder="e.g., my_pcb_project"
              autoFocus
            />
            {/* Validation feedback */}
            {newProjectSetupDialog.projectName && (() => {
              const invalidChars = newProjectSetupDialog.projectName.match(/[^a-zA-Z0-9_-]/g);
              if (invalidChars) {
                const uniqueInvalid = [...new Set(invalidChars)];
                return (
                  <div style={{ 
                    marginBottom: '12px', 
                    padding: '6px 10px', 
                    background: '#3a1f1f', 
                    border: '1px solid #a44', 
                    borderRadius: 4,
                    fontSize: '12px',
                    color: '#ffaaaa',
                  }}>
                    Invalid characters: {uniqueInvalid.map(c => `"${c}"`).join(', ')}. Only letters, numbers, underscore (_), and hyphen (-) are allowed.
                  </div>
                );
              }
              return null;
            })()}
            
            {/* Project Location */}
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#e0e0e0', fontWeight: 500 }}>
              Location:
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                value={newProjectSetupDialog.locationPath || 'Not selected'}
                readOnly
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: '#1f1f24',
                  border: '1px solid #444',
                  borderRadius: 6,
                  color: newProjectSetupDialog.locationPath ? '#f2f2f2' : '#888',
                  fontSize: '14px',
                  cursor: 'not-allowed',
                }}
                placeholder="Select a location..."
              />
              <button
                onClick={handleNewProjectBrowseLocation}
                style={{
                  padding: '8px 16px',
                  background: '#555',
                  color: '#f2f2f2',
                  border: '1px solid #666',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                Browse...
              </button>
            </div>
            
            {/* Project Path Preview */}
            {newProjectSetupDialog.projectName && newProjectSetupDialog.locationPath && (
              <div style={{ 
                marginBottom: '20px', 
                padding: '8px 12px', 
                background: '#1a1a1f', 
                border: '1px solid #333', 
                borderRadius: 6,
                fontSize: '12px',
                color: '#aaa',
                fontFamily: 'monospace',
              }}>
                <div style={{ marginBottom: '4px', color: '#888' }}>Project will be created at:</div>
                <div style={{ color: '#4CAF50' }}>
                  {newProjectSetupDialog.locationPath}/{newProjectSetupDialog.projectName}/project.json
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={handleNewProjectSetupCancel}
                style={{
                  padding: '8px 16px',
                  background: '#444',
                  color: '#f2f2f2',
                  border: '1px solid #555',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleNewProjectCreate}
                disabled={!newProjectSetupDialog.projectName.trim() || !newProjectSetupDialog.locationHandle}
                style={{
                  padding: '8px 16px',
                  background: (!newProjectSetupDialog.projectName.trim() || !newProjectSetupDialog.locationHandle) ? '#555' : '#4CAF50',
                  color: '#fff',
                  border: '1px solid ' + ((!newProjectSetupDialog.projectName.trim() || !newProjectSetupDialog.locationHandle) ? '#666' : '#45a049'),
                  borderRadius: 6,
                  cursor: (!newProjectSetupDialog.projectName.trim() || !newProjectSetupDialog.locationHandle) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  opacity: (!newProjectSetupDialog.projectName.trim() || !newProjectSetupDialog.locationHandle) ? 0.6 : 1,
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save As Dialog */}
      {saveAsDialog.visible && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10002,
          }}
          onClick={(e) => {
            // Close dialog if clicking on backdrop
            if (e.target === e.currentTarget) {
              handleSaveAsCancel();
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#2b2b31',
              borderRadius: 8,
              padding: '24px',
              minWidth: '400px',
              maxWidth: '500px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              border: '1px solid #1f1f24',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#f2f2f2' }}>
              Save As
            </h2>
            
            {/* File Name */}
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#e0e0e0', fontWeight: 500 }}>
              File Name:
            </label>
            <input
              ref={saveAsFilenameInputRef}
              type="text"
              value={saveAsDialog.filename}
              onChange={(e) => {
                setSaveAsDialog(prev => ({ ...prev, filename: e.target.value }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveAsSave();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleSaveAsCancel();
                }
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                marginBottom: '8px',
                background: '#1f1f24',
                border: '1px solid #444',
                borderRadius: 6,
                color: '#f2f2f2',
                fontSize: '14px',
              }}
              placeholder="e.g., my_project.json"
              autoFocus
            />
            
            {/* Location */}
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#e0e0e0', fontWeight: 500 }}>
              Location:
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                value={saveAsDialog.locationPath || 'Not selected'}
                readOnly
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: '#1f1f24',
                  border: '1px solid #444',
                  borderRadius: 6,
                  color: saveAsDialog.locationPath ? '#f2f2f2' : '#888',
                  fontSize: '14px',
                  cursor: 'not-allowed',
                }}
                placeholder="Select a location..."
              />
              <button
                onClick={handleSaveAsBrowseLocation}
                style={{
                  padding: '8px 16px',
                  background: '#555',
                  color: '#f2f2f2',
                  border: '1px solid #666',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                Browse...
              </button>
            </div>
            
            {/* File Path Preview */}
            {saveAsDialog.filename && saveAsDialog.locationPath && (
              <div style={{ 
                marginBottom: '20px', 
                padding: '8px 12px', 
                background: '#1a1a1f', 
                border: '1px solid #333', 
                borderRadius: 6,
                fontSize: '12px',
                color: '#aaa',
                fontFamily: 'monospace',
              }}>
                <div style={{ marginBottom: '4px', color: '#888' }}>File will be saved at:</div>
                <div style={{ color: '#4CAF50' }}>
                  {saveAsDialog.locationPath}/{saveAsDialog.filename.endsWith('.json') ? saveAsDialog.filename : `${saveAsDialog.filename}.json`}
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={handleSaveAsCancel}
                style={{
                  padding: '8px 16px',
                  background: '#444',
                  color: '#f2f2f2',
                  border: '1px solid #555',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAsSave}
                disabled={!saveAsDialog.filename.trim() || !saveAsDialog.locationHandle}
                style={{
                  padding: '8px 16px',
                  background: (!saveAsDialog.filename.trim() || !saveAsDialog.locationHandle) ? '#555' : '#4CAF50',
                  color: '#fff',
                  border: '1px solid ' + ((!saveAsDialog.filename.trim() || !saveAsDialog.locationHandle) ? '#666' : '#45a049'),
                  borderRadius: 6,
                  cursor: (!saveAsDialog.filename.trim() || !saveAsDialog.locationHandle) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  opacity: (!saveAsDialog.filename.trim() || !saveAsDialog.locationHandle) ? 0.6 : 1,
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Dialog */}
      {errorDialog.visible && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10004,
          }}
          onClick={(e) => {
            // Close dialog if clicking on backdrop
            if (e.target === e.currentTarget) {
              setErrorDialog({ visible: false, title: '', message: '' });
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#2b2b31',
              borderRadius: 8,
              padding: '24px',
              minWidth: '300px',
              maxWidth: '500px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              border: '2px solid #ff4444',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '24px', color: '#ff4444' }}>⚠️</div>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '18px', fontWeight: 600 }}>
                {errorDialog.title}
              </h3>
            </div>
            <div style={{ marginBottom: '20px', color: '#ddd', fontSize: '14px', lineHeight: '1.5' }}>
              {errorDialog.message}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setErrorDialog({ visible: false, title: '', message: '' })}
                style={{
                  padding: '8px 16px',
                  background: '#4CAF50',
                  color: '#fff',
                  border: '1px solid #45a049',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Set Size Dialog */}
      {setSizeDialog.visible && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10003,
          }}
          onClick={(e) => {
            // Close dialog if clicking on backdrop
            if (e.target === e.currentTarget) {
              setSetSizeDialog({ visible: false, size: 6 });
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#2b2b31',
              borderRadius: 8,
              padding: '24px',
              minWidth: '300px',
              maxWidth: '400px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              border: '1px solid #1f1f24',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#f2f2f2' }}>
              Set Size
            </h2>
            
            {/* Size Input */}
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#e0e0e0', fontWeight: 500 }}>
              Size (pixels):
            </label>
            <input
              ref={setSizeInputRef}
              type="number"
              min="1"
              max="99"
              value={setSizeDialog.size}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 1;
                // Limit to 2 digits (max 99)
                const limitedValue = Math.max(1, Math.min(99, value));
                setSetSizeDialog(prev => ({ ...prev, size: limitedValue }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSetSizeApply();
                } else if (e.key === 'Escape') {
                  setSetSizeDialog({ visible: false, size: 6 });
                }
                // Prevent typing more than 2 digits
                if (e.key.length === 1 && /[0-9]/.test(e.key)) {
                  const currentValue = setSizeDialog.size.toString();
                  if (currentValue.length >= 2 && setSizeInputRef.current?.selectionStart === setSizeInputRef.current?.selectionEnd) {
                    // If already 2 digits and no selection, prevent adding more
                    if (setSizeInputRef.current?.selectionStart === currentValue.length) {
                      e.preventDefault();
                    }
                  }
                }
              }}
              onInput={(e) => {
                // Ensure value doesn't exceed 2 digits
                const input = e.target as HTMLInputElement;
                const value = input.value;
                if (value.length > 2) {
                  input.value = value.slice(0, 2);
                  const numValue = parseInt(input.value) || 1;
                  setSetSizeDialog(prev => ({ ...prev, size: Math.max(1, Math.min(99, numValue)) }));
                }
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                marginBottom: '16px',
                background: '#1f1f24',
                border: '1px solid #444',
                borderRadius: 6,
                color: '#f2f2f2',
                fontSize: '14px',
              }}
              autoFocus
            />
            
            {/* Size Dropdown */}
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#e0e0e0', fontWeight: 500 }}>
              Or select from list:
            </label>
            <select
              value={(() => {
                const evenValues = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32];
                return evenValues.includes(setSizeDialog.size) ? setSizeDialog.size : '';
              })()}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (!isNaN(value) && value > 0) {
                  setSetSizeDialog(prev => ({ ...prev, size: value }));
                }
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                marginBottom: '20px',
                background: '#1f1f24',
                border: '1px solid #444',
                borderRadius: 6,
                color: '#f2f2f2',
                fontSize: '14px',
              }}
            >
              <option value="" style={{ background: '#1f1f24', color: '#f2f2f2' }}>-- Select --</option>
              {[2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32].map(sz => (
                <option key={sz} value={sz} style={{ background: '#1f1f24', color: '#f2f2f2' }}>
                  {sz} pixels
                </option>
              ))}
            </select>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setSetSizeDialog({ visible: false, size: 6 })}
                style={{
                  padding: '8px 16px',
                  background: '#444',
                  color: '#f2f2f2',
                  border: '1px solid #555',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSetSizeApply}
                style={{
                  padding: '8px 16px',
                  background: '#4CAF50',
                  color: '#fff',
                  border: '1px solid #45a049',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Save Dialog */}
      {autoSaveDialog.visible && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10003,
          }}
          onClick={(e) => {
            // Close dialog if clicking on backdrop
            if (e.target === e.currentTarget) {
              setAutoSaveDialog({ visible: false, interval: 5 });
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#2b2b31',
              borderRadius: 8,
              padding: '24px',
              minWidth: '300px',
              maxWidth: '400px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              border: '1px solid #1f1f24',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#f2f2f2' }}>
              Auto Save
            </h2>
            
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#e0e0e0', fontWeight: 500 }}>
              Select time interval:
            </label>
            <select
              value={autoSaveDialog.interval === null ? 'disable' : (autoSaveDialog.interval || 5).toString()}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'disable') {
                  setAutoSaveDialog({ visible: true, interval: null });
                } else {
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue) && numValue > 0) {
                    setAutoSaveDialog({ visible: true, interval: numValue });
                  }
                }
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                marginBottom: '20px',
                background: '#1f1f24',
                border: '1px solid #444',
                borderRadius: 6,
                color: '#f2f2f2',
                fontSize: '14px',
              }}
              autoFocus
            >
              <option value="1" style={{ background: '#1f1f24', color: '#f2f2f2' }}>1 minute</option>
              <option value="5" style={{ background: '#1f1f24', color: '#f2f2f2' }}>5 minutes</option>
              <option value="10" style={{ background: '#1f1f24', color: '#f2f2f2' }}>10 minutes</option>
              <option value="20" style={{ background: '#1f1f24', color: '#f2f2f2' }}>20 minutes</option>
              <option value="30" style={{ background: '#1f1f24', color: '#f2f2f2' }}>30 minutes</option>
              <option value="disable" style={{ background: '#1f1f24', color: '#f2f2f2' }}>Disable</option>
            </select>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setAutoSaveDialog({ visible: false, interval: 5 })}
                style={{
                  padding: '8px 16px',
                  background: '#444',
                  color: '#f2f2f2',
                  border: '1px solid #555',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAutoSaveApply}
                style={{
                  padding: '8px 16px',
                  background: '#4CAF50',
                  color: '#fff',
                  border: '1px solid #45a049',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Save Prompt Dialog (shown after New Project or Open Project) */}
      {autoSavePromptDialog.visible && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10004,
          }}
          onClick={(e) => {
            // Close dialog if clicking on backdrop
            if (e.target === e.currentTarget) {
              handleAutoSavePromptSkip();
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#2b2b31',
              borderRadius: 8,
              padding: '24px',
              minWidth: '400px',
              maxWidth: '500px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              border: '1px solid #1f1f24',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: '#f2f2f2' }}>
              Enable Auto Save?
            </h2>
            <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#e0e0e0', lineHeight: '1.5' }}>
              We recommend enabling Auto Save to automatically save your project at regular intervals. 
              This helps protect your work from accidental loss.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={handleAutoSavePromptSkip}
                style={{
                  padding: '8px 16px',
                  background: '#444',
                  color: '#f2f2f2',
                  border: '1px solid #555',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                Skip
              </button>
              <button
                onClick={handleAutoSavePromptEnable}
                style={{
                  padding: '8px 16px',
                  background: '#4CAF50',
                  color: '#fff',
                  border: '1px solid #45a049',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
                autoFocus
              >
                Enable Auto Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  </div>
  );
}

export default App;