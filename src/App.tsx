import React, { useState, useRef, useCallback } from 'react';
import { rectTransformedBounds, mergeBounds, type Bounds } from './utils/geometry';
import { PenLine, MousePointer } from 'lucide-react';
import { createComponent, autoAssignPolarity, loadDesignatorCounters, saveDesignatorCounters, getDefaultPrefix, updateDesignatorCounter } from './utils/components';
import { 
  COMPONENT_TYPE_INFO,
  COMPONENT_CATEGORIES,
  DEFAULT_VIA_COLOR, 
  DEFAULT_TRACE_COLOR, 
  DEFAULT_COMPONENT_COLOR, 
  DEFAULT_PAD_COLOR,
  DEFAULT_POWER_COLOR,
  VIA,
} from './constants';
import { generatePointId, setPointIdCounter, getPointIdCounter, truncatePoint } from './utils/coordinates';
import { formatTimestamp, removeTimestampFromFilename } from './utils/fileOperations';
import { createToolRegistry, getDefaultAbbreviation, saveToolSettings, saveToolLayerSettings } from './utils/toolRegistry';
import type { ComponentType, PCBComponent } from './types';
import { MenuBar } from './components/MenuBar';
import { WelcomeDialog } from './components/WelcomeDialog';
import { ErrorDialog } from './components/ErrorDialog';
import { DetailedInfoDialog } from './components/DetailedInfoDialog';
import { NotesDialog } from './components/NotesDialog';
import { BoardDimensionsDialog, type BoardDimensions } from './components/BoardDimensionsDialog';
import { ComponentEditor } from './components/ComponentEditor';
import {
  useDrawing,
  useSelection,
  useTransform,
  useImage,
  useView,
  useComponents,
  usePowerGround,
  useLayerSettings,
  useToolRegistry,
  useLocks,
  useDialogs,
  useFileOperations,
  type DrawingPoint,
  type DrawingStroke,
  type PCBImage,
  type PowerBus,
  type GroundBus,
  type PowerSymbol,
  type GroundSymbol,
  type Tool,
} from './hooks';
import './App.css';

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
// GroundSymbol, PowerBus, PowerSymbol, ViewMode, and Tool types are now imported from hooks

// ToolSettings, Layer, ToolDefinition types are now imported from hooks
// Tool registry functions are now imported from utils/toolRegistry.ts

function App() {
  const CONTENT_BORDER = 40; // fixed border (in canvas pixels) where nothing is drawn
  
  // Initialize hooks
  const image = useImage();
  const {
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
  } = image;
  
  const [currentTool, setCurrentTool] = useState<Tool>('none');
  // Layer settings hook
  const layerSettings = useLayerSettings();
  const {
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
    saveDefaultSize,
    saveDefaultColor,
  } = layerSettings;
  
  // Drawing hook
  const drawing = useDrawing();
  const {
    drawingStrokes,
    setDrawingStrokes,
    isDrawing,
    setIsDrawing,
    currentStroke,
    setCurrentStroke,
    tracePreviewMousePos,
    setTracePreviewMousePos,
    drawingMode,
    setDrawingMode,
    selectedDrawingLayer,
    setSelectedDrawingLayer,
    currentStrokeRef,
    lastTraceClickTimeRef,
    isDoubleClickingTraceRef,
  } = drawing;
  
  // Transform hook
  const transform = useTransform();
  const {
    selectedImageForTransform,
    setSelectedImageForTransform,
    isTransforming,
    setIsTransforming,
    transformStartPos,
    setTransformStartPos,
    transformMode,
    setTransformMode,
  } = transform;
  
  // View hook
  const view = useView();
  const {
    viewScale,
    setViewScale,
    viewPan,
    setViewPan,
    isShiftConstrained,
    setIsShiftConstrained,
    showBothLayers,
    setShowBothLayers,
  } = view;
  
  // Tool-specific layer defaults (persist until tool re-selected)
  const [traceToolLayer, setTraceToolLayer] = useState<'top' | 'bottom'>('top');
  const [padToolLayer, setPadToolLayer] = useState<'top' | 'bottom'>('top');
  const [componentToolLayer, setComponentToolLayer] = useState<'top' | 'bottom'>('top');
  
  // Tool registry hook
  const toolRegistryHook = useToolRegistry(
    createToolRegistry,
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
    componentToolLayer
  );
  const {
    toolRegistry,
    setToolRegistry,
    getCurrentToolDef,
    updateToolSettings,
    updateToolLayerSettings,
  } = toolRegistryHook;
  
  // Refs for tracking previous tool state (since hook doesn't export them)
  const prevToolIdRef = React.useRef<string | null>(null);
  const prevBrushColorRef = React.useRef<string>(brushColor);
  const prevBrushSizeRef = React.useRef<number>(brushSize);
  
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
          // Tool settings are project-specific, saved in project file
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
          // Update toolRegistry to reflect current layer's color and size, and sync all layer settings
          const layerSettings = new Map(currentToolDef.layerSettings);
          layerSettings.set('top', { color: topTraceColor, size: topTraceSize });
          layerSettings.set('bottom', { color: bottomTraceColor, size: bottomTraceSize });
          updated.set('trace', { 
            ...currentToolDef, 
            settings: { color: traceColor, size: traceSize },
            layerSettings 
          });
        } else if (currentTool === 'draw' && drawingMode === 'pad') {
          // Use layer-specific pad colors
          const layer = padToolLayer || 'top';
          const padColor = layer === 'top' ? topPadColor : bottomPadColor;
          const padSize = layer === 'top' ? topPadSize : bottomPadSize;
          setBrushColor(padColor);
          setBrushSize(padSize);
          prevBrushColorRef.current = padColor;
          prevBrushSizeRef.current = padSize;
          // Update toolRegistry to reflect current layer's color and size, and sync all layer settings
          const layerSettings = new Map(currentToolDef.layerSettings);
          layerSettings.set('top', { color: topPadColor, size: topPadSize });
          layerSettings.set('bottom', { color: bottomPadColor, size: bottomPadSize });
          updated.set('pad', { 
            ...currentToolDef, 
            settings: { color: padColor, size: padSize },
            layerSettings 
          });
        } else if (currentTool === 'component') {
          // Use layer-specific component colors
          const layer = componentToolLayer || 'top';
          const componentColor = layer === 'top' ? topComponentColor : bottomComponentColor;
          const componentSize = layer === 'top' ? topComponentSize : bottomComponentSize;
          setBrushColor(componentColor);
          setBrushSize(componentSize);
          prevBrushColorRef.current = componentColor;
          prevBrushSizeRef.current = componentSize;
          // Update toolRegistry to reflect current layer's color and size, and sync all layer settings
          const layerSettings = new Map(currentToolDef.layerSettings);
          layerSettings.set('top', { color: topComponentColor, size: topComponentSize });
          layerSettings.set('bottom', { color: bottomComponentColor, size: bottomComponentSize });
          updated.set('component', { 
            ...currentToolDef, 
            settings: { color: componentColor, size: componentSize },
            layerSettings 
          });
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
  
  // Sync state variables with tool registry on mount (ensure single source of truth)
  React.useEffect(() => {
    const traceDef = toolRegistry.get('trace');
    if (traceDef) {
      const topTrace = traceDef.layerSettings.get('top');
      const bottomTrace = traceDef.layerSettings.get('bottom');
      if (topTrace) {
        setTopTraceColor(topTrace.color);
        setTopTraceSize(topTrace.size);
      }
      if (bottomTrace) {
        setBottomTraceColor(bottomTrace.color);
        setBottomTraceSize(bottomTrace.size);
      }
    }
    
    const padDef = toolRegistry.get('pad');
    if (padDef) {
      const topPad = padDef.layerSettings.get('top');
      const bottomPad = padDef.layerSettings.get('bottom');
      if (topPad) {
        setTopPadColor(topPad.color);
        setTopPadSize(topPad.size);
      }
      if (bottomPad) {
        setBottomPadColor(bottomPad.color);
        setBottomPadSize(bottomPad.size);
      }
    }
    
    const componentDef = toolRegistry.get('component');
    if (componentDef) {
      const topComponent = componentDef.layerSettings.get('top');
      const bottomComponent = componentDef.layerSettings.get('bottom');
      if (topComponent) {
        setTopComponentColor(topComponent.color);
        setTopComponentSize(topComponent.size);
      }
      if (bottomComponent) {
        setBottomComponentColor(bottomComponent.color);
        setBottomComponentSize(bottomComponent.size);
      }
    }
  }, []); // Only run on mount
  
  // Sync tool registry layerSettings with state colors/sizes (keeps registry in sync with state)
  // This ensures toolbar and dialogs always show the correct colors/sizes
  // Following the same pattern used for size synchronization
  React.useEffect(() => {
    setToolRegistry(prev => {
      const updated = new Map(prev);
      
      // Sync trace layer settings
      const traceDef = prev.get('trace');
      if (traceDef) {
        const layerSettings = new Map(traceDef.layerSettings);
        layerSettings.set('top', { color: topTraceColor, size: topTraceSize });
        layerSettings.set('bottom', { color: bottomTraceColor, size: bottomTraceSize });
        updated.set('trace', { ...traceDef, layerSettings });
      }
      
      // Sync pad layer settings
      const padDef = prev.get('pad');
      if (padDef) {
        const layerSettings = new Map(padDef.layerSettings);
        layerSettings.set('top', { color: topPadColor, size: topPadSize });
        layerSettings.set('bottom', { color: bottomPadColor, size: bottomPadSize });
        updated.set('pad', { ...padDef, layerSettings });
      }
      
      // Sync component layer settings
      const componentDef = prev.get('component');
      if (componentDef) {
        const layerSettings = new Map(componentDef.layerSettings);
        layerSettings.set('top', { color: topComponentColor, size: topComponentSize });
        layerSettings.set('bottom', { color: bottomComponentColor, size: bottomComponentSize });
        updated.set('component', { ...componentDef, layerSettings });
      }
      
      return updated;
    });
  }, [topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize, topPadColor, bottomPadColor, topPadSize, bottomPadSize, topComponentColor, bottomComponentColor, topComponentSize, bottomComponentSize, setToolRegistry]);
  
  // Update tool-specific settings when color/size changes (for the active tool)
  // This persists to localStorage and updates the registry
  // Also saves layer-specific defaults for trace, pad, and component tools
  React.useEffect(() => {
    setToolRegistry(prev => {
      const currentToolDef = getCurrentToolDef(prev);
      
      if (currentToolDef) {
        // Save to localStorage - use layer-specific settings for tools that support layers
        if (currentTool === 'draw' && drawingMode === 'trace') {
          const layer = traceToolLayer || 'top';
          // Tool settings are project-specific, saved in project file
          // Update state and legacy defaults
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
          // Update registry with layer-specific settings
          const updated = new Map(prev);
          const layerSettings = new Map(currentToolDef.layerSettings);
          layerSettings.set(layer, { color: brushColor, size: brushSize });
          updated.set(currentToolDef.id, {
            ...currentToolDef,
            layerSettings,
            settings: { color: brushColor, size: brushSize }
          });
          prevBrushColorRef.current = brushColor;
          prevBrushSizeRef.current = brushSize;
          return updated;
        } else if (currentTool === 'draw' && drawingMode === 'pad') {
          const layer = padToolLayer || 'top';
          // Tool settings are project-specific, saved in project file
          // Update state and legacy defaults
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
          // Update registry with layer-specific settings
          const updated = new Map(prev);
          const layerSettings = new Map(currentToolDef.layerSettings);
          layerSettings.set(layer, { color: brushColor, size: brushSize });
          updated.set(currentToolDef.id, {
            ...currentToolDef,
            layerSettings,
            settings: { color: brushColor, size: brushSize }
          });
          prevBrushColorRef.current = brushColor;
          prevBrushSizeRef.current = brushSize;
          return updated;
        } else if (currentTool === 'component') {
          const layer = componentToolLayer || 'top';
          // Tool settings are project-specific, saved in project file
          // Update state and legacy defaults
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
          // Update registry with layer-specific settings
          const updated = new Map(prev);
          const layerSettings = new Map(currentToolDef.layerSettings);
          layerSettings.set(layer, { color: brushColor, size: brushSize });
          updated.set(currentToolDef.id, {
            ...currentToolDef,
            layerSettings,
            settings: { color: brushColor, size: brushSize }
          });
          prevBrushColorRef.current = brushColor;
          prevBrushSizeRef.current = brushSize;
          return updated;
        } else {
          // For other tools (via, etc.), tool settings are project-specific, saved in project file
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
      }
      return prev;
    });
  }, [brushColor, brushSize, currentTool, drawingMode, traceToolLayer, padToolLayer, componentToolLayer, getCurrentToolDef, saveDefaultColor, saveDefaultSize, saveToolLayerSettings, setTopTraceColor, setBottomTraceColor, setTopTraceSize, setBottomTraceSize, setTopPadColor, setBottomPadColor, setTopPadSize, setBottomPadSize, setTopComponentColor, setBottomComponentColor, setTopComponentSize, setBottomComponentSize]);
  
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
  
  // Show ground bus selector when ground tool is selected
  React.useEffect(() => {
    if (currentTool === 'ground') {
      setShowGroundBusSelector(true);
      setSelectedGroundBusId(null); // Reset selection when tool is selected
    } else {
      setShowGroundBusSelector(false);
      setSelectedGroundBusId(null);
    }
  }, [currentTool]);

  // Show trace layer chooser when trace tool is selected
  React.useEffect(() => {
    if (currentTool === 'draw' && drawingMode === 'trace') {
      setShowTraceLayerChooser(true);
    } else {
      setShowTraceLayerChooser(false);
    }
  }, [currentTool, drawingMode]);

  // Show pad layer chooser when pad tool is selected
  React.useEffect(() => {
    if (currentTool === 'draw' && drawingMode === 'pad') {
      setShowPadLayerChooser(true);
    } else {
      setShowPadLayerChooser(false);
    }
  }, [currentTool, drawingMode]);
  
  const [canvasCursor, setCanvasCursor] = useState<string | undefined>(undefined);
  const [, setViaOrderTop] = useState<string[]>([]);
  const [, setViaOrderBottom] = useState<string[]>([]);
  
  // Lock states are now managed by useLocks hook (see above)
  const [, setTraceOrderTop] = useState<string[]>([]);
  const [, setTraceOrderBottom] = useState<string[]>([]);
  // Independent lists (stacks) derived from drawingStrokes
  const [vias, setVias] = useState<Via[]>([]);
  // @ts-ignore - Reserved for future use: pads extracted from drawingStrokes
  const [pads, setPads] = useState<Pad[]>([]);
  const [tracesTop, setTracesTop] = useState<TraceSegment[]>([]);
  const [tracesBottom, setTracesBottom] = useState<TraceSegment[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Note: Point IDs are now generated globally via generatePointId() from coordinates.ts
  // This ensures globally unique IDs across all vias, traces, and connection points
  
  // Selection hook
  const selection = useSelection();
  const {
    selectedIds,
    setSelectedIds,
    isSelecting,
    setIsSelecting,
    selectedComponentIds,
    setSelectedComponentIds,
    selectedPowerIds,
    setSelectedPowerIds,
    selectedGroundIds,
    setSelectedGroundIds,
  } = selection;
  
  // Components hook
  const components = useComponents();
  const {
    componentsTop,
    setComponentsTop,
    componentsBottom,
    setComponentsBottom,
    componentEditor,
    setComponentEditor,
    connectingPin,
    setConnectingPin,
    componentDialogPosition,
    setComponentDialogPosition,
    isDraggingDialog,
    setIsDraggingDialog,
    dialogDragOffset,
    setDialogDragOffset,
    openComponentEditor,
  } = components;
  
  // Power/Ground hook
  const powerGround = usePowerGround();
  const {
    powerBuses,
    setPowerBuses,
    groundBuses,
    setGroundBuses,
    powerSymbols,
    setPowerSymbols,
    groundSymbols,
    setGroundSymbols,
    powerEditor,
    setPowerEditor,
    // groundEditor and setGroundEditor are available but not currently used
    // groundEditor,
    // setGroundEditor,
  } = powerGround;
  
  // Locks hook
  const locks = useLocks();
  const {
    areImagesLocked,
    setAreImagesLocked,
    areViasLocked,
    setAreViasLocked,
    arePadsLocked,
    setArePadsLocked,
    areTracesLocked,
    setAreTracesLocked,
    areComponentsLocked,
    setAreComponentsLocked,
    areGroundNodesLocked,
    setAreGroundNodesLocked,
    arePowerNodesLocked,
    setArePowerNodesLocked,
  } = locks;
  
  // Dialogs hook
  const dialogs = useDialogs();
  const {
    openMenu,
    setOpenMenu,
    setSizeDialog,
    setSetSizeDialog,
    autoSaveDialog,
    setAutoSaveDialog,
    autoSavePromptDialog,
    setAutoSavePromptDialog,
    debugDialog,
    setDebugDialog,
    errorDialog,
    setErrorDialog,
    newProjectDialog,
    setNewProjectDialog,
    newProjectSetupDialog,
    setNewProjectSetupDialog,
    saveAsDialog,
    setSaveAsDialog,
    showColorPicker,
    setShowColorPicker,
    // showWelcomeDialog and setShowWelcomeDialog are available but not currently used
    // showWelcomeDialog,
    // setShowWelcomeDialog,
  } = dialogs;
  
  // File operations hook
  const fileOperations = useFileOperations();
  const {
    autoSaveEnabled,
    setAutoSaveEnabled,
    autoSaveInterval,
    setAutoSaveInterval,
    autoSaveDirHandle,
    setAutoSaveDirHandle,
    autoSaveBaseName,
    setAutoSaveBaseName,
    currentProjectFilePath,
    setCurrentProjectFilePath,
    projectDirHandle,
    setProjectDirHandle,
    projectName,
    setProjectName,
    autoSaveFileHistory,
    setAutoSaveFileHistory,
    currentFileIndex,
    setCurrentFileIndex,
    autoSaveIntervalRef,
    hasChangesSinceLastAutoSaveRef,
    prevAutoSaveEnabledRef,
  } = fileOperations;
  const hScrollRef = useRef<HTMLDivElement>(null);
  const vScrollRef = useRef<HTMLDivElement>(null);
  const hScrollContentRef = useRef<HTMLDivElement>(null);
  const vScrollContentRef = useRef<HTMLDivElement>(null);
  const fileInputTopRef = useRef<HTMLInputElement>(null);
  const fileInputBottomRef = useRef<HTMLInputElement>(null);
  const performAutoSaveRef = useRef<(() => Promise<void>) | null>(null);
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
  // Component movement is now handled via keyboard arrow keys
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isOptionPressed, setIsOptionPressed] = useState(false);
  const [hoverComponent, setHoverComponent] = useState<{ component: PCBComponent; layer: 'top' | 'bottom'; x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 960, height: 600 });
  // Dialog and file operation states are now managed by useDialogs and useFileOperations hooks (see above)
  const setSizeInputRef = useRef<HTMLInputElement>(null);
  const newProjectYesButtonRef = useRef<HTMLButtonElement>(null);
  const newProjectNameInputRef = useRef<HTMLInputElement>(null);
  const saveAsFilenameInputRef = useRef<HTMLInputElement>(null);
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
  // Power and ground symbols are now managed by usePowerGround hook (see above)
  // Use powerSymbols, groundSymbols, and powerBuses from the hook
  const powers = powerSymbols;
  const grounds = groundSymbols;
  const [showPowerBusManager, setShowPowerBusManager] = useState(false);
  const [showPowerBusSelector, setShowPowerBusSelector] = useState(false);
  const [selectedPowerBusId, setSelectedPowerBusId] = useState<string | null>(null);
  // Ground bus management (similar to power buses)
  const [showGroundBusManager, setShowGroundBusManager] = useState(false);
  const [showGroundBusSelector, setShowGroundBusSelector] = useState(false);
  const [selectedGroundBusId, setSelectedGroundBusId] = useState<string | null>(null);
  // Designator management
  const [autoAssignDesignators, setAutoAssignDesignators] = useState<boolean>(() => {
    const saved = localStorage.getItem('autoAssignDesignators');
    return saved !== null ? saved === 'true' : true; // Default to true
  });
  const [useGlobalDesignatorCounters, setUseGlobalDesignatorCounters] = useState<boolean>(false); // Default to OFF (project-local)
  const [showDesignatorManager, setShowDesignatorManager] = useState(false);
  // Session-level counters for project-local mode (tracks designators created in this session)
  const sessionDesignatorCountersRef = useRef<Record<string, number>>({});
  // Ground layer
  const [showGroundLayer, setShowGroundLayer] = useState(true);
  // Connections layer
  const [showConnectionsLayer, setShowConnectionsLayer] = useState(true);
  // Detailed Info Dialog position and drag state
  const [detailedInfoDialogPosition, setDetailedInfoDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingDetailedInfoDialog, setIsDraggingDetailedInfoDialog] = useState(false);
  const [detailedInfoDialogDragOffset, setDetailedInfoDialogDragOffset] = useState<{ x: number; y: number } | null>(null);
  // Notes Dialog state
  const [notesDialogVisible, setNotesDialogVisible] = useState(false);
  const [notesDialogPosition, setNotesDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingNotesDialog, setIsDraggingNotesDialog] = useState(false);
  const [notesDialogDragOffset, setNotesDialogDragOffset] = useState<{ x: number; y: number } | null>(null);
  // Board dimensions for coordinate scaling
  const [boardDimensions, setBoardDimensions] = useState<BoardDimensions | null>(() => {
    const saved = localStorage.getItem('boardDimensions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [showBoardDimensionsDialog, setShowBoardDimensionsDialog] = useState(false);
  
  // Initialize power buses with defaults if empty
  React.useEffect(() => {
    if (powerBuses.length === 0) {
      setPowerBuses([
        { id: 'default-3v3', name: '+3.3V', voltage: '+3.3VDC', color: '#ff6600' },
        { id: 'default-5v', name: '+5V', voltage: '+5VDC', color: '#ff0000' },
      ]);
    }
  }, [powerBuses.length, setPowerBuses]);
  
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

  // Selection functions for "Select All" menu items
  const selectAllVias = useCallback(() => {
    const viaIds = drawingStrokes
      .filter(s => s.type === 'via')
      .map(s => s.id);
    setSelectedIds(new Set(viaIds));
    setSelectedComponentIds(new Set());
    setSelectedPowerIds(new Set());
    setSelectedGroundIds(new Set());
  }, [drawingStrokes, setSelectedIds, setSelectedComponentIds, setSelectedPowerIds, setSelectedGroundIds]);

  const selectAllTraces = useCallback(() => {
    const traceIds = drawingStrokes
      .filter(s => s.type === 'trace')
      .map(s => s.id);
    setSelectedIds(new Set(traceIds));
    setSelectedComponentIds(new Set());
    setSelectedPowerIds(new Set());
    setSelectedGroundIds(new Set());
  }, [drawingStrokes, setSelectedIds, setSelectedComponentIds, setSelectedPowerIds, setSelectedGroundIds]);

  const selectAllPads = useCallback(() => {
    const padIds = drawingStrokes
      .filter(s => s.type === 'pad')
      .map(s => s.id);
    setSelectedIds(new Set(padIds));
    setSelectedComponentIds(new Set());
    setSelectedPowerIds(new Set());
    setSelectedGroundIds(new Set());
  }, [drawingStrokes, setSelectedIds, setSelectedComponentIds, setSelectedPowerIds, setSelectedGroundIds]);

  const selectAllComponents = useCallback(() => {
    const componentIds = [...componentsTop, ...componentsBottom].map(c => c.id);
    setSelectedComponentIds(new Set(componentIds));
    setSelectedIds(new Set());
    setSelectedPowerIds(new Set());
    setSelectedGroundIds(new Set());
  }, [componentsTop, componentsBottom, setSelectedComponentIds, setSelectedIds, setSelectedPowerIds, setSelectedGroundIds]);

  const selectDisconnectedComponents = useCallback(() => {
    const disconnectedIds = [...componentsTop, ...componentsBottom]
      .filter(c => {
        const pinConnections = c.pinConnections || [];
        // Component is disconnected if not all pins are connected
        const allPinsConnected = pinConnections.length > 0 && 
          pinConnections.length === c.pinCount && 
          pinConnections.every(conn => conn && conn.trim() !== '');
        return !allPinsConnected;
      })
      .map(c => c.id);
    setSelectedComponentIds(new Set(disconnectedIds));
    setSelectedIds(new Set());
    setSelectedPowerIds(new Set());
    setSelectedGroundIds(new Set());
    // Automatically open the Detailed Information dialog
    setDebugDialog({ visible: true, text: '' });
  }, [componentsTop, componentsBottom, setSelectedComponentIds, setSelectedIds, setSelectedPowerIds, setSelectedGroundIds, setDebugDialog]);

  const findAndCenterComponent = useCallback((componentId: string, worldX: number, worldY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Calculate visible center in canvas content coordinates
    const contentWidth = canvas.width - 2 * CONTENT_BORDER;
    const contentHeight = canvas.height - 2 * CONTENT_BORDER;
    const visibleCenterX = contentWidth / 2;
    const visibleCenterY = contentHeight / 2;

    // Calculate viewPan to center the component at the visible center
    // Formula: viewPan = visibleCenter - world * scale
    const newPanX = visibleCenterX - worldX * viewScale;
    const newPanY = visibleCenterY - worldY * viewScale;

    // Update view pan to center on component
    setViewPan({ x: newPanX, y: newPanY });

    // Select the component and clear other selections
    setSelectedComponentIds(new Set([componentId]));
    setSelectedIds(new Set());
    setSelectedPowerIds(new Set());
    setSelectedGroundIds(new Set());
  }, [viewScale, setViewPan, setSelectedComponentIds, setSelectedIds, setSelectedPowerIds, setSelectedGroundIds]);

  const powerNodeNames = React.useMemo(() => {
    // Collect bus IDs that have at least one power symbol
    const busIdsWithSymbols = new Set(
      powers
        .map(p => p.powerBusId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    );
    const names = powerBuses
      .filter(b => busIdsWithSymbols.has(b.id))
      .map(b => b.name);
    return Array.from(new Set(names)).sort();
  }, [powers, powerBuses]);

  const groundNodeNames = React.useMemo(() => {
    const busIdsWithSymbols = new Set(
      grounds
        .map(g => g.groundBusId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    );
    const names = groundBuses
      .filter(b => busIdsWithSymbols.has(b.id))
      .map(b => b.name);
    return Array.from(new Set(names)).sort();
  }, [grounds, groundBuses]);

  const selectAllPowerNodes = useCallback(() => {
    const powerIds = powers.map(p => p.id);
    setSelectedPowerIds(new Set(powerIds));
    setSelectedIds(new Set());
    setSelectedComponentIds(new Set());
    setSelectedGroundIds(new Set());
  }, [powers, setSelectedPowerIds, setSelectedIds, setSelectedComponentIds, setSelectedGroundIds]);

  const selectAllGroundNodes = useCallback(() => {
    const groundIds = grounds.map(g => g.id);
    setSelectedGroundIds(new Set(groundIds));
    setSelectedIds(new Set());
    setSelectedComponentIds(new Set());
    setSelectedPowerIds(new Set());
  }, [grounds, setSelectedGroundIds, setSelectedIds, setSelectedComponentIds, setSelectedPowerIds]);

  const selectPowerNodesByName = useCallback((name: string) => {
    const busIds = powerBuses
      .filter(b => b.name === name)
      .map(b => b.id);
    if (busIds.length === 0) {
      return;
    }
    const powerIds = powers
      .filter(p => p.powerBusId && busIds.includes(p.powerBusId))
      .map(p => p.id);
    setSelectedPowerIds(new Set(powerIds));
    setSelectedIds(new Set());
    setSelectedComponentIds(new Set());
    setSelectedGroundIds(new Set());
  }, [powerBuses, powers, setSelectedPowerIds, setSelectedIds, setSelectedComponentIds, setSelectedGroundIds]);

  const selectGroundNodesByName = useCallback((name: string) => {
    const busIds = groundBuses
      .filter(b => b.name === name)
      .map(b => b.id);
    if (busIds.length === 0) {
      return;
    }
    const groundIds = grounds
      .filter(g => g.groundBusId && busIds.includes(g.groundBusId))
      .map(g => g.id);
    setSelectedGroundIds(new Set(groundIds));
    setSelectedIds(new Set());
    setSelectedComponentIds(new Set());
    setSelectedPowerIds(new Set());
  }, [groundBuses, grounds, setSelectedGroundIds, setSelectedIds, setSelectedComponentIds, setSelectedPowerIds]);

  // Utility function to get contextual value for a component
  const getComponentContextualValue = useCallback((comp: PCBComponent): string | null => {
    switch (comp.componentType) {
      case 'Resistor':
      case 'ResistorNetwork':
      case 'Thermistor':
      case 'VariableResistor':
        if ('resistance' in comp && comp.resistance && 'resistanceUnit' in comp && comp.resistanceUnit) {
          return `${comp.resistance} ${comp.resistanceUnit}`;
        }
        break;
      case 'Capacitor':
      case 'Electrolytic Capacitor':
        if ('capacitance' in comp && comp.capacitance && 'capacitanceUnit' in comp && comp.capacitanceUnit) {
          return `${comp.capacitance} ${comp.capacitanceUnit}`;
        }
        break;
      case 'Inductor':
        if ('inductance' in comp && comp.inductance && 'inductanceUnit' in comp && comp.inductanceUnit) {
          return `${comp.inductance} ${comp.inductanceUnit}`;
        }
        break;
      case 'Battery':
        if ('voltage' in comp && comp.voltage && 'voltageUnit' in comp && comp.voltageUnit) {
          return `${comp.voltage} ${comp.voltageUnit}`;
        }
        break;
      case 'Diode':
      case 'ZenerDiode':
        if ('voltage' in comp && comp.voltage && 'voltageUnit' in comp && comp.voltageUnit) {
          return `${comp.voltage} ${comp.voltageUnit}`;
        }
        break;
      case 'Fuse':
        if ('current' in comp && comp.current && 'currentUnit' in comp && comp.currentUnit) {
          return `${comp.current} ${comp.currentUnit}`;
        }
        break;
      case 'FerriteBead':
        if ('impedance' in comp && comp.impedance && 'impedanceUnit' in comp && comp.impedanceUnit) {
          return `${comp.impedance} ${comp.impedanceUnit}`;
        }
        break;
      case 'Relay':
        if ('coilVoltage' in comp && comp.coilVoltage && 'coilVoltageUnit' in comp && comp.coilVoltageUnit) {
          return `${comp.coilVoltage} ${comp.coilVoltageUnit}`;
        }
        break;
      case 'Speaker':
        if ('impedance' in comp && comp.impedance && 'impedanceUnit' in comp && comp.impedanceUnit) {
          return `${comp.impedance} ${comp.impedanceUnit}`;
        }
        break;
      case 'Motor':
        if ('voltage' in comp && comp.voltage && 'voltageUnit' in comp && comp.voltageUnit) {
          return `${comp.voltage} ${comp.voltageUnit}`;
        }
        break;
      case 'PowerSupply':
        if ('outputVoltage' in comp && comp.outputVoltage && 'outputVoltageUnit' in comp && comp.outputVoltageUnit) {
          return `${comp.outputVoltage} ${comp.outputVoltageUnit}`;
        }
        break;
      case 'Transistor':
        if ('partNumber' in comp && comp.partNumber) {
          return comp.partNumber;
        }
        break;
      case 'IntegratedCircuit':
        if ('partNumber' in comp && comp.partNumber) {
          return comp.partNumber;
        }
        break;
    }
    return null;
  }, []);
  
  // Tool-specific layer defaults are now declared above (before useToolRegistry hook)
  // Show chooser popovers only when tool is (re)selected
  const [showTraceLayerChooser, setShowTraceLayerChooser] = useState(false);
  const traceChooserRef = useRef<HTMLDivElement>(null);
  // Pad layer chooser (like trace layer chooser)
  const [showPadLayerChooser, setShowPadLayerChooser] = useState(false);
  const padChooserRef = useRef<HTMLDivElement>(null);
  // Power Bus selector
  const powerBusSelectorRef = useRef<HTMLDivElement>(null);
  const groundBusSelectorRef = useRef<HTMLDivElement>(null);
  // Component type selection (appears after clicking to set position)
  const [showComponentTypeChooser, setShowComponentTypeChooser] = useState(false);
  const [showComponentLayerChooser, setShowComponentLayerChooser] = useState(false);
  const [selectedComponentType, setSelectedComponentType] = useState<ComponentType | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const componentTypeChooserRef = useRef<HTMLDivElement>(null);
  const componentLayerChooserRef = useRef<HTMLDivElement>(null);
  const traceButtonRef = useRef<HTMLButtonElement>(null);
  const padButtonRef = useRef<HTMLButtonElement>(null);
  const componentButtonRef = useRef<HTMLButtonElement>(null);
  const powerButtonRef = useRef<HTMLButtonElement>(null);
  const groundButtonRef = useRef<HTMLButtonElement>(null);
  // Store pending component position (set by click, used when type is selected)
  const [pendingComponentPosition, setPendingComponentPosition] = useState<{ x: number; y: number; layer: 'top' | 'bottom' } | null>(null);
  
  const [isSnapDisabled, setIsSnapDisabled] = useState(false); // Control key disables snap-to
  // Selection state (selectedIds, isSelecting are now provided by useSelection hook - see above)
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
      // Calculate initial world position for image center
      // Images should start centered, which in world coordinates is:
      // worldX = (centerX - viewPan.x) / viewScale
      // For initial load, viewPan is typically set to center the view, so world position is approximately 0
      // But to be precise, we'll calculate it based on current canvas and view state
      const canvas = canvasRef.current;
      let initialWorldX = 0;
      let initialWorldY = 0;
      if (canvas) {
        const contentWidth = canvas.width - 2 * CONTENT_BORDER;
        const contentHeight = canvas.height - 2 * CONTENT_BORDER;
        const centerX = contentWidth / 2;
        const centerY = contentHeight / 2;
        // Convert center position to world coordinates
        initialWorldX = (centerX - viewPan.x) / viewScale;
        initialWorldY = (centerY - viewPan.y) / viewScale;
      }
      
      const imageData: PCBImage = {
        url,
        name: file.name,
        width: bitmap.width,
        height: bitmap.height,
        dataUrl,
        // Store images in world coordinates from the start
        // This ensures they stay aligned with drawn items when canvas resizes
        x: initialWorldX,
        y: initialWorldY,
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
  }, [viewPan.x, viewPan.y, viewScale, topImage, bottomImage]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Stop propagation to prevent document-level handlers from interfering
    e.stopPropagation();
    e.preventDefault(); // Also prevent default to ensure our handler runs first
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Ensure canvas has focus for keyboard shortcuts to work reliably
    if (document.activeElement !== canvas) {
      canvas.focus();
    }
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
        // Determine the final selection state after this click
        let finalSelectedIds: Set<string>;
        if (e.shiftKey) {
          // Shift-click: add to selection (toggle)
          const next = new Set(selectedComponentIds);
          if (next.has(comp.id)) {
            next.delete(comp.id);
          } else {
            next.add(comp.id);
          }
          finalSelectedIds = next;
          setSelectedComponentIds(finalSelectedIds);
        } else {
          // Regular click: select only this component (replace all selections)
          finalSelectedIds = new Set([comp.id]);
          setSelectedComponentIds(finalSelectedIds);
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
        // Determine the final selection state after this click
        let finalSelectedPowerIds: Set<string>;
        if (e.shiftKey) {
          // Shift-click: toggle selection
          const next = new Set(selectedPowerIds);
          if (next.has(hitPower.id)) {
            next.delete(hitPower.id);
          } else {
            next.add(hitPower.id);
          }
          finalSelectedPowerIds = next;
          setSelectedPowerIds(finalSelectedPowerIds);
        } else {
          // Regular click: select only this power node
          finalSelectedPowerIds = new Set([hitPower.id]);
          setSelectedPowerIds(finalSelectedPowerIds);
        }
        // Clear other selections
        setSelectedIds(new Set());
        setSelectedComponentIds(new Set());
        setSelectedGroundIds(new Set());
        
        // Power nodes are not moveable - only selectable
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
        // Determine the final selection state after this click
        let finalSelectedGroundIds: Set<string>;
        if (e.shiftKey) {
          // Shift-click: add to selection (toggle)
          const next = new Set(selectedGroundIds);
          if (next.has(hitGround.id)) {
            next.delete(hitGround.id);
          } else {
            next.add(hitGround.id);
          }
          finalSelectedGroundIds = next;
          setSelectedGroundIds(finalSelectedGroundIds);
          // Keep other selections when Shift-clicking
        } else {
          // Regular click: select only this ground node (replace all selections)
          finalSelectedGroundIds = new Set([hitGround.id]);
          setSelectedGroundIds(finalSelectedGroundIds);
          // Clear other selections
          setSelectedIds(new Set());
          setSelectedComponentIds(new Set());
          setSelectedPowerIds(new Set());
        }
        
        // Ground nodes are not moveable - only selectable
        // Don't start rectangle selection - we've already selected the ground node
        return;
      }
      
      // Check for via/pad hit - handle like components (direct selection, no rectangle selection)
      // Hit tolerance: maintain minimum 6 screen pixels clickable area at all zoom levels
      const minScreenPixels = 6; // Minimum clickable area in screen pixels
      const hitToleranceSelect = Math.max(minScreenPixels / viewScale, 4 / viewScale);
      // Ensure minimum world-space tolerance for very small objects
      const minWorldTolerance = 0.5; // Minimum 0.5 world units
      const finalHitTolerance = Math.max(hitToleranceSelect, minWorldTolerance);
      
      let hitStroke: DrawingStroke | null = null;
      for (const s of drawingStrokes) {
        if ((s.type === 'via' || s.type === 'pad') && s.points.length > 0) {
          // Check visibility based on type and layer
          let isVisible = false;
          if (s.type === 'via') {
            isVisible = showViasLayer;
          } else if (s.type === 'pad') {
            // Pads have layer-specific visibility
            const padLayer = s.layer || 'top';
            isVisible = padLayer === 'top' ? showTopPadsLayer : showBottomPadsLayer;
          }
          if (!isVisible) continue;
          
          const c = s.points[0];
          const r = Math.max(1, s.size / 2);
          const d = Math.hypot(c.x - x, c.y - y);
          // Use the larger of: object radius, or hit tolerance
          // This ensures small objects are still clickable at high zoom
          if (d <= Math.max(r, finalHitTolerance)) {
            hitStroke = s;
            break;
          }
        }
      }
      
      if (hitStroke) {
        // Handle via/pad selection directly (like components) - no rectangle selection
        let finalSelectedIds: Set<string>;
        
        if (e.shiftKey) {
          // Shift-click: toggle selection
          const next = new Set(selectedIds);
          if (next.has(hitStroke.id)) {
            next.delete(hitStroke.id);
          } else {
            next.add(hitStroke.id);
          }
          finalSelectedIds = next;
          setSelectedIds(finalSelectedIds);
        } else {
          // Regular click: select only this via/pad
          finalSelectedIds = new Set([hitStroke.id]);
          setSelectedIds(finalSelectedIds);
          // Clear other selections
          setSelectedComponentIds(new Set());
          setSelectedPowerIds(new Set());
          setSelectedGroundIds(new Set());
        }
        
        // Vias and pads are not moveable - only selectable
        return;
      }
      
      // If we didn't hit anything (no via, no component, no power, no ground), clear selection and start rectangle selection
      // Clear selection immediately when clicking on empty space (unless Shift is held for multi-select)
      if (!e.shiftKey) {
        setSelectedIds(new Set());
        setSelectedComponentIds(new Set());
        setSelectedPowerIds(new Set());
        setSelectedGroundIds(new Set());
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
        // Zoom-aware snap threshold: maintain ~10 screen pixels at all zoom levels
        // When zoomed in very far, allow extremely fine placement with sub-micron precision
        const SNAP_THRESHOLD_SCREEN = 10; // Screen pixels
        const baseThreshold = SNAP_THRESHOLD_SCREEN / viewScale;
        // Scale minimum threshold based on zoom level for ultra-fine control
        // At very high zoom (viewScale > 20), allow 0.0001 precision; at high zoom (>10), 0.001; otherwise 0.01
        const SNAP_THRESHOLD_WORLD = viewScale > 20 
          ? Math.max(baseThreshold, 0.0001) // Ultra-fine: 0.0001 world units (0.1 micron equivalent)
          : viewScale > 10 
            ? Math.max(baseThreshold, 0.001) // Fine: 0.001 world units (1 micron equivalent)
            : Math.max(baseThreshold, 0.01); // Normal: 0.01 world units minimum
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
        // Truncate coordinates to 4 decimal places for exact matching
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
        // Use brushSize and brushColor (which are synced with tool registry) for immediate updates
        const viaDef = toolRegistry.get('via');
        // Use brushSize and brushColor which are kept in sync with tool registry
        const viaColor = brushColor || viaDef?.settings.color || DEFAULT_VIA_COLOR;
        const viaSize = brushSize || viaDef?.settings.size || VIA.DEFAULT_SIZE;
        
        // Snap to nearest via, pad, power, or ground node unless Option/Alt key is held
        const snapToNearestNode = (wx: number, wy: number): { x: number; y: number; nodeId?: number } => {
          let bestDist = Infinity;
          let bestPoint: { x: number; y: number; id?: number } | null = null;
          // Zoom-aware snap threshold: maintain ~10 screen pixels at all zoom levels
          // When zoomed in very far (viewScale > 10), allow extremely fine placement by removing minimum threshold
          const SNAP_THRESHOLD_SCREEN = 10; // Screen pixels
          const baseThreshold = SNAP_THRESHOLD_SCREEN / viewScale;
          // At high zoom levels, allow sub-micron precision; at normal zoom, maintain reasonable minimum
          const SNAP_THRESHOLD_WORLD = viewScale > 10 
            ? Math.max(baseThreshold, 0.001) // Ultra-fine: 0.001 world units (1 micron equivalent)
            : Math.max(baseThreshold, 0.01); // Normal: 0.01 world units minimum
          for (const s of drawingStrokes) {
            if (s.type === 'via' || s.type === 'pad') {
              const c = s.points[0];
              const d = Math.hypot(c.x - wx, c.y - wy);
              if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) {
                bestDist = d;
                bestPoint = c;
              }
            }
          }
          // Also check power and ground nodes
          for (const p of powers) {
            if (p.pointId !== undefined) {
              const d = Math.hypot(p.x - wx, p.y - wy);
              if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) {
                bestDist = d;
                bestPoint = { x: p.x, y: p.y, id: p.pointId };
              }
            }
          }
          for (const g of grounds) {
            if (g.pointId !== undefined) {
              const d = Math.hypot(g.x - wx, g.y - wy);
              if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) {
                bestDist = d;
                bestPoint = { x: g.x, y: g.y, id: g.pointId };
              }
            }
          }
          const result = bestPoint ?? { x: wx, y: wy };
          const truncated = truncatePoint(result);
          return {
            x: truncated.x,
            y: truncated.y,
            nodeId: bestPoint?.id
          };
        };
        
        const snapped = !isSnapDisabled ? snapToNearestNode(x, y) : { x: truncatePoint({ x, y }).x, y: truncatePoint({ x, y }).y };
        const nodeId = snapped.nodeId ?? generatePointId();
        
        // Auto-detect via type based on power/ground connection
        const viaType = determineViaType(nodeId, powerBuses);
        
        const center = { id: nodeId, x: snapped.x, y: snapped.y };
        const viaStroke: DrawingStroke = {
          id: `${Date.now()}-via`,
          points: [center],
          color: viaColor,
          size: viaSize,
          layer: selectedDrawingLayer,
          type: 'via',
          viaType: viaType, // Auto-detected type
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
        
        // Snap to nearest via, pad, power, or ground node unless Option/Alt key is held
        const snapToNearestNode = (wx: number, wy: number): { x: number; y: number; nodeId?: number } => {
          let bestDist = Infinity;
          let bestPoint: { x: number; y: number; id?: number } | null = null;
          // Zoom-aware snap threshold: maintain ~10 screen pixels at all zoom levels
          // When zoomed in very far (viewScale > 10), allow extremely fine placement by removing minimum threshold
          const SNAP_THRESHOLD_SCREEN = 10; // Screen pixels
          const baseThreshold = SNAP_THRESHOLD_SCREEN / viewScale;
          // At high zoom levels, allow sub-micron precision; at normal zoom, maintain reasonable minimum
          const SNAP_THRESHOLD_WORLD = viewScale > 10 
            ? Math.max(baseThreshold, 0.001) // Ultra-fine: 0.001 world units (1 micron equivalent)
            : Math.max(baseThreshold, 0.01); // Normal: 0.01 world units minimum
          for (const s of drawingStrokes) {
            if (s.type === 'via' || s.type === 'pad') {
              const c = s.points[0];
              const d = Math.hypot(c.x - wx, c.y - wy);
              if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) {
                bestDist = d;
                bestPoint = c;
              }
            }
          }
          // Also check power and ground nodes
          for (const p of powers) {
            if (p.pointId !== undefined) {
              const d = Math.hypot(p.x - wx, p.y - wy);
              if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) {
                bestDist = d;
                bestPoint = { x: p.x, y: p.y, id: p.pointId };
              }
            }
          }
          for (const g of grounds) {
            if (g.pointId !== undefined) {
              const d = Math.hypot(g.x - wx, g.y - wy);
              if (d <= SNAP_THRESHOLD_WORLD && d < bestDist) {
                bestDist = d;
                bestPoint = { x: g.x, y: g.y, id: g.pointId };
              }
            }
          }
          const result = bestPoint ?? { x: wx, y: wy };
          const truncated = truncatePoint(result);
          return {
            x: truncated.x,
            y: truncated.y,
            nodeId: bestPoint?.id
          };
        };
        
        const snapped = !isSnapDisabled ? snapToNearestNode(x, y) : { x: truncatePoint({ x, y }).x, y: truncatePoint({ x, y }).y };
        const nodeId = snapped.nodeId ?? generatePointId();
        
        // Auto-detect pad type based on power/ground connection
        const padType = determinePadType(nodeId, powerBuses);
        
        // Add a square representing a pad at click location
        // Use brushColor and brushSize (which are synced with tool registry) for immediate updates
        const padColor = brushColor || (padToolLayer === 'top' ? topPadColor : bottomPadColor);
        const padSize = brushSize || (padToolLayer === 'top' ? topPadSize : bottomPadSize);
        const center = { id: nodeId, x: snapped.x, y: snapped.y };
        const padStroke: DrawingStroke = {
          id: `${Date.now()}-pad`,
          points: [center],
          color: padColor,
          size: padSize,
          layer: padToolLayer, // Use padToolLayer instead of selectedDrawingLayer
          type: 'pad',
          padType: padType, // Auto-detected type
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
      // Use brushColor and brushSize (which are synced with tool registry) for immediate updates
      const componentColor = brushColor || (componentToolLayer === 'top' ? topComponentColor : bottomComponentColor);
      const componentSize = brushSize || (componentToolLayer === 'top' ? topComponentSize : bottomComponentSize);
      // Pass all existing components for designator auto-assignment
      const allExistingComponents = [...componentsTop, ...componentsBottom];
      
      // Prepare counters based on mode
      let counters: Record<string, number>;
      if (useGlobalDesignatorCounters) {
        // Global mode: reload from localStorage each time to get latest values
        counters = loadDesignatorCounters();
      } else {
        // Project-local mode: use session counters (starts empty, gets updated as components are created)
        counters = { ...sessionDesignatorCountersRef.current };
      }
      const comp = createComponent(
        selectedComponentType,
        componentToolLayer, // Use componentToolLayer instead of selectedDrawingLayer
        truncatedPos.x,
        truncatedPos.y,
        componentColor,
        componentSize,
        allExistingComponents,
        counters, // Pass counters based on useGlobalDesignatorCounters setting
        autoAssignDesignators // Pass auto-assignment setting
      );
      
      // Initialize abbreviation to default based on component type prefix
      (comp as any).abbreviation = getDefaultAbbreviation(selectedComponentType);
      
      // IMPORTANT: Update counters immediately after component creation so the next component gets the correct number
      // This ensures that when placing multiple components rapidly, each gets a unique sequential designator
      if (autoAssignDesignators && comp.designator) {
        const prefix = getDefaultPrefix(selectedComponentType);
        const match = comp.designator.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`));
        if (match) {
          const number = parseInt(match[1], 10);
          if (useGlobalDesignatorCounters) {
            // Update global counters in localStorage
            const currentCounters = loadDesignatorCounters();
            const updatedCounters = updateDesignatorCounter(prefix, number, currentCounters);
            saveDesignatorCounters(updatedCounters);
          } else {
            // Update session counters for project-local mode
            sessionDesignatorCountersRef.current[prefix] = Math.max(
              sessionDesignatorCountersRef.current[prefix] || 0,
              number
            );
          }
        }
      }
      
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
        // Zoom-aware snap threshold: maintain ~10 screen pixels at all zoom levels
        // When zoomed in very far, allow extremely fine placement with sub-micron precision
        const SNAP_THRESHOLD_SCREEN = 10; // Screen pixels
        const baseThreshold = SNAP_THRESHOLD_SCREEN / viewScale;
        // Scale minimum threshold based on zoom level for ultra-fine control
        // At very high zoom (viewScale > 20), allow 0.0001 precision; at high zoom (>10), 0.001; otherwise 0.01
        const SNAP_THRESHOLD_WORLD = viewScale > 20 
          ? Math.max(baseThreshold, 0.0001) // Ultra-fine: 0.0001 world units (0.1 micron equivalent)
          : viewScale > 10 
            ? Math.max(baseThreshold, 0.001) // Fine: 0.001 world units (1 micron equivalent)
            : Math.max(baseThreshold, 0.01); // Normal: 0.01 world units minimum
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
        // Truncate coordinates to 4 decimal places for exact matching
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
        setPowerSymbols(prev => [...prev, p]);
        
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
      // Ground tool: place ground symbol at click location (similar to power tool)
      // Show ground bus selector if no bus is selected
      if (selectedGroundBusId === null) {
        if (groundBuses.length === 0) {
          // No ground buses exist - show error and suggest creating one
          setErrorDialog({
            visible: true,
            title: 'No Ground Bus',
            message: 'No ground buses are defined. Please create a ground bus first using Tools → Manage Ground Buses.',
          });
          return;
        }
        // Show ground bus selector
        setShowGroundBusSelector(true);
        return;
      }
      
      const bus = groundBuses.find(b => b.id === selectedGroundBusId);
      if (bus) {
      // Snap to nearest via, pad, or trace point unless Option/Alt key is held
      // Returns both coordinates and the Node ID of the snapped object (if any)
      const snapToNearestPoint = (wx: number, wy: number): { x: number; y: number; nodeId?: number } => {
        let bestDist = Infinity;
        let bestPoint: { x: number; y: number; id?: number } | null = null;
        // Zoom-aware snap threshold: maintain ~10 screen pixels at all zoom levels
        // When zoomed in very far, allow extremely fine placement with sub-micron precision
        const SNAP_THRESHOLD_SCREEN = 10; // Screen pixels
        const baseThreshold = SNAP_THRESHOLD_SCREEN / viewScale;
        // Scale minimum threshold based on zoom level for ultra-fine control
        // At very high zoom (viewScale > 20), allow 0.0001 precision; at high zoom (>10), 0.001; otherwise 0.01
        const SNAP_THRESHOLD_WORLD = viewScale > 20 
          ? Math.max(baseThreshold, 0.0001) // Ultra-fine: 0.0001 world units (0.1 micron equivalent)
          : viewScale > 10 
            ? Math.max(baseThreshold, 0.001) // Fine: 0.001 world units (1 micron equivalent)
            : Math.max(baseThreshold, 0.01); // Normal: 0.01 world units minimum
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
        // Truncate coordinates to 4 decimal places for exact matching
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
        const groundType = `${bus.name} Ground Node`;
      
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
      
        // Place ground node immediately
      const g: GroundSymbol = {
        id: `gnd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        x: snapped.x,
        y: snapped.y,
          color: bus.color, // Use ground bus color
        size: brushSize || toolRegistry.get('ground')?.settings.size || 18,
          groundBusId: bus.id,
          layer: selectedDrawingLayer,
          type: groundType, // Auto-populate type with bus name
        pointId: nodeId, // Use existing Node ID if snapped, otherwise generate new one
      };
      setGroundSymbols(prev => [...prev, g]);
      
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
    }
  }, [currentTool, selectedImageForTransform, brushSize, brushColor, drawingMode, selectedDrawingLayer, drawingStrokes, viewScale, viewPan.x, viewPan.y, isSnapDisabled, selectedPowerBusId, selectedGroundBusId, powerBuses, groundBuses, selectedComponentType, toolRegistry, padToolLayer, traceToolLayer, powers, grounds, determineViaType, determinePadType, showViasLayer, showTopPadsLayer, showBottomPadsLayer]);

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
        // Double-click ONLY opens properties dialog - do NOT select or make moveable
        // Use openComponentEditor to properly load all type-specific fields (resistance, capacitance, etc.)
        openComponentEditor(comp, layer);
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
        // Zoom-aware snap threshold: maintain ~10 screen pixels at all zoom levels
        // When zoomed in very far, allow extremely fine placement with sub-micron precision
        const SNAP_THRESHOLD_SCREEN = 10; // Screen pixels
        const baseThreshold = SNAP_THRESHOLD_SCREEN / viewScale;
        // Scale minimum threshold based on zoom level for ultra-fine control
        // At very high zoom (viewScale > 20), allow 0.0001 precision; at high zoom (>10), 0.001; otherwise 0.01
        const SNAP_THRESHOLD_WORLD = viewScale > 20 
          ? Math.max(baseThreshold, 0.0001) // Ultra-fine: 0.0001 world units (0.1 micron equivalent)
          : viewScale > 10 
            ? Math.max(baseThreshold, 0.001) // Fine: 0.001 world units (1 micron equivalent)
            : Math.max(baseThreshold, 0.01); // Normal: 0.01 world units minimum
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

    // Component hover detection (only when Option key is held)
    if (isOptionPressed) {
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
        setHoverComponent({ 
          component: hitComponent.comp, 
          layer: hitComponent.layer,
          x: e.clientX,
          y: e.clientY
        });
      } else {
        setHoverComponent(null);
      }
    } else {
      setHoverComponent(null);
    }

    // Component dragging is started immediately on click-and-hold, so no threshold check needed
    
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
          // Truncate coordinates to 4 decimal places for exact matching
          const truncatedSnapped = truncatePoint(snapped);
          const pt = { id: generatePointId(), x: truncatedSnapped.x, y: truncatedSnapped.y };
          setCurrentStroke([startPt, pt]);
        } else {
          // Truncate coordinates to 4 decimal places for exact matching
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
          setPowerSymbols(prev => {
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
          setGroundSymbols(prev => {
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
        // Also erase components intersecting the eraser square
        // Don't erase components if locked
        if (!areComponentsLocked) {
          const half = brushSize / 2;
          const minX = x - half;
          const maxX = x + half;
          const minY = y - half;
          const maxY = y + half;
          const intersects = (c: PCBComponent): boolean => {
            const size = c.size || 18;
            const radius = size / 2;
            const bbMinX = c.x - radius;
            const bbMaxX = c.x + radius;
            const bbMinY = c.y - radius;
            const bbMaxY = c.y + radius;
            const disjoint = maxX < bbMinX || minX > bbMaxX || maxY < bbMinY || minY > bbMaxY;
            return !disjoint;
          };
          setComponentsTop(prev => prev.filter(c => !intersects(c)));
          setComponentsBottom(prev => prev.filter(c => !intersects(c)));
        }
      }
    } else if (isTransforming && transformStartPos && selectedImageForTransform) {
      // Don't allow transforms if images are locked - stop the transform immediately
      if (areImagesLocked) {
        setIsTransforming(false);
        setTransformStartPos(null);
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
  }, [isDrawing, currentStroke, currentTool, brushSize, isTransforming, transformStartPos, selectedImageForTransform, topImage, bottomImage, isShiftConstrained, snapConstrainedPoint, selectedDrawingLayer, setDrawingStrokes, viewScale, viewPan.x, viewPan.y, isSelecting, selectStart, areImagesLocked, areViasLocked, arePadsLocked, areTracesLocked, arePowerNodesLocked, areGroundNodesLocked, componentsTop, componentsBottom, setComponentsTop, setComponentsBottom, isOptionPressed, setHoverComponent, isSnapDisabled, drawingStrokes, powers, grounds, currentStroke, drawingMode, tracePreviewMousePos, setTracePreviewMousePos, isPanning, panStartRef, setViewPan, CONTENT_BORDER, viewPan, generatePointId, truncatePoint]);

  const handleCanvasMouseUp = useCallback(() => {
    // Finalize selection if active
    if (currentTool === 'select' && isSelecting) {
      const rectSel = selectRect;
      const start = selectStart;
      setIsSelecting(false);
      setSelectStart(null);
      setSelectRect(null);
      if (rectSel && start) {
        // Make "tiny" threshold zoom-aware: use screen pixels instead of world units
        // At high zoom, 3 world units might be 30+ screen pixels, so we need to be more lenient
        const tinyThresholdWorld = 3; // World units
        const tinyThresholdScreen = 5; // Screen pixels - more lenient for high zoom
        const tinyThreshold = Math.max(tinyThresholdWorld, tinyThresholdScreen / viewScale);
        const tiny = rectSel.width < tinyThreshold && rectSel.height < tinyThreshold;
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
        // Hit tolerance: maintain minimum 6 screen pixels clickable area at all zoom levels
        // This ensures reliable clicking even at high zoom
        const minScreenPixels = 6;
        const hitTolerance = Math.max(minScreenPixels / viewScale, 4 / viewScale, 0.5);
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
        
        // CRITICAL FIX: Check hitStrokeId FIRST, regardless of rectangle size
        // At high zoom, even tiny mouse movements can create non-tiny rectangles in world space,
        // but if we detected a hit in mouseDown, we should use it (this is a click, not a drag)
        const hitStrokeId = (start as any)?.hitStrokeId;
        if (hitStrokeId) {
          // We had a hitStroke in mouseDown, use it directly (this was a click, not a drag)
          const hitStroke = drawingStrokes.find(s => s.id === hitStrokeId);
          if (hitStroke) {
            // Check visibility
            let isVisible = false;
            if (hitStroke.type === 'via' || hitStroke.type === 'pad') {
              isVisible = showViasLayer;
            } else {
              isVisible = hitStroke.layer === 'top' ? showTopTracesLayer : showBottomTracesLayer;
            }
            if (isVisible) {
              if (shiftWasPressed) {
                // Toggle selection
                if (next.has(hitStrokeId)) {
                  next.delete(hitStrokeId);
                } else {
                  next.add(hitStrokeId);
                }
              } else {
                // Replace selection
                next.clear();
                next.add(hitStrokeId);
              }
              setSelectedIds(next);
              setSelectedComponentIds(nextComps);
              setSelectedPowerIds(nextPowers);
              setSelectedGroundIds(nextGrounds);
              return; // Early return - we're done
            }
          }
        }
        
        if (tiny) {
          // Click selection: find the single nearest via, pad, or trace
          
          // Fallback: find the single nearest via, pad, or trace
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
              // Use improved hit tolerance: maintain minimum screen-space clickable area
              const minScreenPixels = 6;
              const improvedHitTolerance = Math.max(minScreenPixels / viewScale, 4 / viewScale, 0.5);
              if (dist <= Math.max(r, improvedHitTolerance)) {
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
            if (s.type === 'via') {
              isVisible = showViasLayer;
            } else if (s.type === 'pad') {
              // Pads have layer-specific visibility
              const padLayer = s.layer || 'top';
              isVisible = padLayer === 'top' ? showTopPadsLayer : showBottomPadsLayer;
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

    // Apply global view transform once (pan then scale)
    ctx.translate(viewPan.x, viewPan.y);
    ctx.scale(viewScale, viewScale);
    
    // Draw images with transformations (locked and unlocked use same coordinate system)
    // Locked images just can't be transformed, but they appear in the same position
    {
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
        // Images are stored with x,y values that are updated during transforms in world coordinates
        // So we can use them directly as world coordinates (the view transform is already applied)
        ctx.translate(topImage.x, topImage.y);
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
        // Images are stored with x,y values that are updated during transforms in world coordinates
        // So we can use them directly as world coordinates (the view transform is already applied)
        ctx.translate(bottomImage.x, bottomImage.y);
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
        const groundColor = g.color || '#000000'; // Use ground bus color if available
        
        // Check if this is Earth Ground (use Earth Ground symbol)
        const isEarthGround = g.groundBusId === 'groundbus-earth';
        
        if (isEarthGround) {
          // Draw Earth Ground symbol: vertical line with 3 horizontal bars (progressively shorter)
          const unit = Math.max(6, g.size || 18);
          const vLen = unit * 0.9; // Vertical line length
          const barG = unit * 0.24; // Gap between bars
          const width = unit * 1.6; // Width of first (longest) bar
          
        ctx.strokeStyle = groundColor;
        ctx.lineWidth = Math.max(1, (isSelected ? 3 : 2) / Math.max(viewScale, 0.001));
        ctx.lineCap = 'round';
          
          // Draw selection highlight if selected
          if (isSelected) {
            ctx.strokeStyle = '#0066ff';
            ctx.lineWidth = Math.max(1, 4 / Math.max(viewScale, 0.001));
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(g.x - width / 2 - 3, g.y - 3, width + 6, vLen + barG * 2 + 6);
            ctx.setLineDash([]);
          }
          
          ctx.strokeStyle = groundColor;
          ctx.lineWidth = Math.max(1, (isSelected ? 3 : 2) / Math.max(viewScale, 0.001));
          
          // Vertical line (from top)
          ctx.beginPath();
          ctx.moveTo(g.x, g.y);
          ctx.lineTo(g.x, g.y + vLen);
          ctx.stroke();
          
          // Three horizontal bars (progressively shorter)
          for (let i = 0; i < 3; i++) {
            const barY = g.y + vLen + i * barG;
            const barWidth = width * (1 - i * 0.25); // Each bar is 25% shorter than previous
            ctx.beginPath();
            ctx.moveTo(g.x - barWidth / 2, barY);
            ctx.lineTo(g.x + barWidth / 2, barY);
            ctx.stroke();
          }
        } else {
          // Draw GND or other ground symbol: circle with lines
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
        }
        
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
      
      // Check if all pins are connected - if so, use green background
      const pinConnections = c.pinConnections || [];
      const allPinsConnected = pinConnections.length > 0 && 
        pinConnections.length === c.pinCount && 
        pinConnections.every(conn => conn && conn.trim() !== '');
      
      // Fill background: #B2DF8A if all pins connected, white otherwise
      ctx.fillStyle = allPinsConnected ? 'rgba(178, 223, 138, 0.85)' : 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.rect(c.x - half, c.y - half, size, size);
      ctx.fill();
      ctx.stroke();
      
      // Draw designator text inside the component icon
      const designator = c.designator?.trim() || '';
      if (designator) {
      ctx.fillStyle = c.color || '#111';
        // Calculate font size based on component size and designator length
        // For longer designators (like "U123"), use smaller font
        const baseFontSize = Math.max(6, size * 0.35);
        const maxWidth = size * 0.9; // Leave 5% margin on each side
        let fontSize = baseFontSize;
        ctx.font = `bold ${fontSize}px sans-serif`;
        
        // Measure text and adjust font size if needed to fit
        const metrics = ctx.measureText(designator);
        if (metrics.width > maxWidth) {
          fontSize = (maxWidth / metrics.width) * fontSize;
          fontSize = Math.max(6, fontSize); // Minimum readable size
          ctx.font = `bold ${fontSize}px sans-serif`;
        }
        
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
        ctx.fillText(designator, c.x, c.y);
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
    // Draw connection lines from components to their connected nodes (behind components)
    if (showConnectionsLayer) {
      // Helper function to find node coordinates from Point ID
      const findNodeCoordinates = (pointIdStr: string): { x: number; y: number } | null => {
        const pointId = parseInt(pointIdStr, 10);
        if (isNaN(pointId)) return null;
        
        // Check vias and pads
        for (const stroke of drawingStrokes) {
          if ((stroke.type === 'via' || stroke.type === 'pad') && stroke.points.length > 0) {
            const point = stroke.points[0];
            if (point.id === pointId) {
              return { x: point.x, y: point.y };
            }
          }
        }
        
        // Check trace points
        for (const stroke of drawingStrokes) {
          if (stroke.type === 'trace') {
            for (const point of stroke.points) {
              if (point.id === pointId) {
                return { x: point.x, y: point.y };
              }
            }
          }
        }
        
        // Check power symbols
        for (const power of powers) {
          if (power.pointId === pointId) {
            return { x: power.x, y: power.y };
          }
        }
        
        // Check ground symbols
        for (const ground of grounds) {
          if (ground.pointId === pointId) {
            return { x: ground.x, y: ground.y };
          }
        }
        
        return null;
      };
      
      // Draw connection lines for all components
      const drawConnections = (comp: PCBComponent) => {
        const pinConnections = comp.pinConnections || [];
        
        // Check if component has polarity
        const hasPolarity = comp.componentType === 'Electrolytic Capacitor' || 
                           comp.componentType === 'Diode' || 
                           comp.componentType === 'Battery' || 
                           comp.componentType === 'ZenerDiode';
        const isTantalumCap = comp.componentType === 'Capacitor' && 
                             'dielectric' in comp && 
                             (comp as any).dielectric === 'Tantalum';
        const isPolarized = (hasPolarity || isTantalumCap) && comp.pinPolarities;
        
        // Collect unique node IDs with their polarity info to avoid drawing duplicate lines
        const connectedNodes = new Map<string, boolean>(); // Map<nodeId, isNegative>
        for (let pinIndex = 0; pinIndex < pinConnections.length; pinIndex++) {
          const connection = pinConnections[pinIndex];
          if (connection && connection.trim() !== '') {
            const nodeIdStr = connection.trim();
            // Check if this pin is negative (for polarized components)
            const isNegative: boolean = Boolean(isPolarized && 
                             comp.pinPolarities && 
                             pinIndex < comp.pinPolarities.length &&
                             comp.pinPolarities[pinIndex] === '-');
            // If node already exists, keep the negative flag if either connection is negative
            const existingValue = connectedNodes.get(nodeIdStr);
            if (existingValue !== undefined) {
              // existingValue is guaranteed to be boolean here (Map<string, boolean>)
              connectedNodes.set(nodeIdStr, existingValue || isNegative);
            } else {
              connectedNodes.set(nodeIdStr, isNegative);
            }
          }
        }
        
        // Draw one line per unique connected node, from component center to node center
        for (const [nodeIdStr, isNegative] of connectedNodes) {
          const nodePos = findNodeCoordinates(nodeIdStr);
          if (nodePos) {
            // Use component center as starting point
            const compCenter = { x: comp.x, y: comp.y };
            
            ctx.save();
            // Use black for negative connections of polarized components, blue otherwise
            ctx.strokeStyle = isNegative ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 150, 255, 0.6)'; // Black for negative, blue for others
            ctx.lineWidth = Math.max(1, 3 / Math.max(viewScale, 0.001));
            ctx.beginPath();
            ctx.moveTo(compCenter.x, compCenter.y);
            ctx.lineTo(nodePos.x, nodePos.y);
            ctx.stroke();
            ctx.restore();
          }
        }
      };
      
      // Draw connections for top and bottom components
      if (showTopComponents) componentsTop.forEach(drawConnections);
      if (showBottomComponents) componentsBottom.forEach(drawConnections);
    }
    
    // Draw components (on top of connections)
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
  }, [topImage, bottomImage, transparency, drawingStrokes, currentStroke, isDrawing, currentTool, brushColor, brushSize, isGrayscale, isBlackAndWhiteEdges, isBlackAndWhiteInverted, selectedImageForTransform, selectedDrawingLayer, viewScale, viewPan.x, viewPan.y, showTopImage, showBottomImage, showViasLayer, showTopTracesLayer, showBottomTracesLayer, showTopPadsLayer, showBottomPadsLayer, showTopComponents, showBottomComponents, componentsTop, componentsBottom, showPowerLayer, powers, showGroundLayer, grounds, showConnectionsLayer, selectRect, selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, traceToolLayer, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize, drawingMode, tracePreviewMousePos, areImagesLocked]);

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
      
      setCanvasSize(prev => {
        // If canvas size is changing, adjust viewPan to maintain the same world-to-screen mapping
        if (prev.width !== width || prev.height !== height) {
          const oldContentWidth = prev.width - 2 * CONTENT_BORDER;
          const oldContentHeight = prev.height - 2 * CONTENT_BORDER;
          const newContentWidth = width - 2 * CONTENT_BORDER;
          const newContentHeight = height - 2 * CONTENT_BORDER;
          
          // Calculate scale factors for content area
          const scaleX = oldContentWidth > 0 ? newContentWidth / oldContentWidth : 1;
          const scaleY = oldContentHeight > 0 ? newContentHeight / oldContentHeight : 1;
          
          // Adjust viewPan proportionally to maintain the same visual position
          // This ensures world coordinates stay aligned with images when canvas resizes
          setViewPan(prevPan => ({
            x: prevPan.x * scaleX,
            y: prevPan.y * scaleY,
          }));
        }
        return (prev.width === width && prev.height === height) ? prev : { width, height };
      });
    };
    computeSize();
    window.addEventListener('resize', computeSize);
    return () => window.removeEventListener('resize', computeSize);
  }, [setViewPan]);

  // Stop any active transform and clear image selections when images are locked
  React.useEffect(() => {
    if (areImagesLocked) {
      // Stop any active transform
      if (isTransforming) {
        setIsTransforming(false);
        setTransformStartPos(null);
      }
      // Clear selected image for transform
      setSelectedImageForTransform(null);
    }
  }, [areImagesLocked, isTransforming, setIsTransforming, setTransformStartPos, setSelectedImageForTransform]);

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
        setPowerSymbols(prev => prev.map(p => selectedPowerIds.has(p.id) ? { ...p, size: p.size + 1 } : p));
      }
      if (selectedGroundIds.size > 0) {
        const newSize = (grounds.find(g => selectedGroundIds.has(g.id))?.size || 18) + 1;
        saveDefaultSize('ground', newSize);
        setGroundSymbols(prev => prev.map(g => selectedGroundIds.has(g.id) ? { ...g, size: (g.size || 18) + 1 } : g));
      }
    } else {
      setBrushSize(b => {
        const newSize = Math.min(40, b + 1);
        // Tool settings are project-specific and will be saved in the project file
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
        setPowerSymbols(prev => prev.map(p => selectedPowerIds.has(p.id) ? { ...p, size: Math.max(1, p.size - 1) } : p));
      }
      if (selectedGroundIds.size > 0) {
        const newSize = Math.max(1, (grounds.find(g => selectedGroundIds.has(g.id))?.size || 18) - 1);
        saveDefaultSize('ground', newSize);
        setGroundSymbols(prev => prev.map(g => selectedGroundIds.has(g.id) ? { ...g, size: Math.max(1, (g.size || 18) - 1) } : g));
      }
    } else {
      setBrushSize(b => {
        const newSize = Math.max(1, b - 1);
        // Tool settings are project-specific and will be saved in the project file
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
        setPowerSymbols(prev => prev.map(p => selectedPowerIds.has(p.id) ? { ...p, size: sz } : p));
      }
      if (selectedGroundIds.size > 0) {
        saveDefaultSize('ground', sz);
        setGroundSymbols(prev => prev.map(g => selectedGroundIds.has(g.id) ? { ...g, size: sz } : g));
      }
    } else {
      setBrushSize(sz);
      // Tool settings are project-specific and will be saved in the project file
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
  // Handle auto-save prompt dialog - Skip button
  const handleAutoSavePromptSkip = useCallback(() => {
    // Just close the prompt dialog
    setAutoSavePromptDialog({ visible: false, source: null, interval: 5 });
  }, []);

  // Handle applying auto-save interval from dialog (used by both prompt dialog and menu dialog)
  const handleAutoSaveApply = useCallback(async (interval: number | null, closePromptDialog: boolean = false) => {
    // If interval is null, disable auto-save
    if (interval === null) {
      setAutoSaveEnabled(false);
      setAutoSaveInterval(null);
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
      setAutoSaveDialog({ visible: false, interval: 5 });
      if (closePromptDialog) {
        setAutoSavePromptDialog({ visible: false, source: null, interval: 5 });
      }
      console.log('Auto save: Disabled');
      return;
    }
    
    // Use project name (should be set from New Project or Open Project)
    if (!projectName) {
      alert('Please create a new project (File -> New Project) or open an existing project (File -> Open Project) first.');
      return;
    }
    
    // Use project directory for auto-save (same directory as project.json)
    // For both New Project and Open Project, projectDirHandle should be set
    // When a file is opened, projectDirHandle is automatically set to the opened file's directory
    // This ensures auto-save uses the same directory as the opened file
    let dirHandleToUse = projectDirHandle;
    if (!dirHandleToUse) {
      // This should only happen in fallback scenarios (file input without File System Access API)
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
        alert('Directory picker is not supported in this browser. Auto-save requires a directory handle.');
        return;
      }
    }
    
    // Use project directory for auto-save (same directory as project.json)
    setAutoSaveDirHandle(dirHandleToUse);
    // Use project name as base name for auto-save files, removing any existing timestamp
    const projectNameWithoutExt = projectName.replace(/\.json$/i, '');
    const projectNameWithoutTimestamp = removeTimestampFromFilename(projectNameWithoutExt);
    const cleanBaseName = projectNameWithoutTimestamp.replace(/[^a-zA-Z0-9_-]/g, '_');
    setAutoSaveBaseName(cleanBaseName);
    
    // Update refs immediately so performAutoSave can use them
    autoSaveDirHandleRef.current = dirHandleToUse;
    autoSaveBaseNameRef.current = cleanBaseName;
    
    // Set interval and enable auto-save
    setAutoSaveInterval(interval);
    setAutoSaveEnabled(true);
    
    // Mark that we have changes so initial save will happen
    hasChangesSinceLastAutoSaveRef.current = true;
    
    // Close dialogs
    setAutoSaveDialog({ visible: false, interval: 5 });
    if (closePromptDialog) {
      setAutoSavePromptDialog({ visible: false, source: null, interval: 5 });
    }
    
    // Perform initial save immediately after state updates
    setTimeout(() => {
      console.log(`Auto save: Enabled with interval ${interval} minutes`);
      if (performAutoSaveRef.current) {
        performAutoSaveRef.current();
      }
    }, 200);
  }, [projectName, projectDirHandle, setAutoSaveEnabled, setAutoSaveInterval, setAutoSaveDirHandle, setAutoSaveBaseName, setAutoSaveDialog, setAutoSavePromptDialog, setProjectDirHandle]);

  // Helper function to switch to Select tool and deselect all icons
  const switchToSelectTool = useCallback(() => {
    setCurrentTool('select');
    setSelectedIds(new Set());
    setSelectedComponentIds(new Set());
    setSelectedPowerIds(new Set());
    setSelectedGroundIds(new Set());
  }, [setSelectedIds, setSelectedComponentIds, setSelectedPowerIds, setSelectedGroundIds]);

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
    
    // Arrow keys: Move selected components
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selectedComponentIds.size > 0) {
      e.preventDefault();
      e.stopPropagation();
      
      // Movement step size (in world coordinates)
      const stepSize = e.shiftKey ? 10 : 1; // Shift = larger steps
      
      let deltaX = 0;
      let deltaY = 0;
      if (e.key === 'ArrowUp') {
        deltaY = -stepSize;
      } else if (e.key === 'ArrowDown') {
        deltaY = stepSize;
      } else if (e.key === 'ArrowLeft') {
        deltaX = -stepSize;
      } else if (e.key === 'ArrowRight') {
        deltaX = stepSize;
      }
      
      // Move all selected components
      for (const compId of selectedComponentIds) {
        const topComp = componentsTop.find(c => c.id === compId);
        if (topComp) {
          const newX = topComp.x + deltaX;
          const newY = topComp.y + deltaY;
          // Truncate coordinates to 4 decimal places for exact matching
          const truncated = truncatePoint({ x: newX, y: newY });
          setComponentsTop(prev => prev.map(c => 
            c.id === compId ? { ...c, x: truncated.x, y: truncated.y } : c
          ));
        } else {
          const bottomComp = componentsBottom.find(c => c.id === compId);
          if (bottomComp) {
            const newX = bottomComp.x + deltaX;
            const newY = bottomComp.y + deltaY;
            // Truncate coordinates to 4 decimal places for exact matching
            const truncated = truncatePoint({ x: newX, y: newY });
            setComponentsBottom(prev => prev.map(c => 
              c.id === compId ? { ...c, x: truncated.x, y: truncated.y } : c
            ));
          }
        }
      }
      return;
    }
    
    // Detailed Information: Display properties of selected objects (Ctrl+I)
    if (e.key === 'I' || e.key === 'i') {
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
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
    
    // Notes Dialog: Open notes editor for selected objects (Ctrl+N)
    if (e.key === 'N' || e.key === 'n') {
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        setNotesDialogVisible(true);
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
        // Layers panel: left: 60, width: 168
        const LAYERS_LEFT = 60;
        const LAYERS_WIDTH = 168;
        const LEFT_OVERLAY = LAYERS_LEFT + LAYERS_WIDTH + 6; // End of layers panel + gap (234px)
        
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
    
    // Option/Alt key: Disable snap-to while drawing and enable component hover
    if (e.key === 'Alt' || e.altKey) {
      setIsSnapDisabled(true);
      setIsOptionPressed(true);
    }
    
    // Escape key: Always return to Select tool (checkbox/radio blur handled at start of function)
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      // Switch to Select tool and deselect all
      switchToSelectTool();
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
          // Delete the strokes (cleanup will happen automatically via useEffect)
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
          setPowerSymbols(prev => prev.filter(p => !selectedPowerIds.has(p.id)));
          setSelectedPowerIds(new Set());
        }
      }
      if (selectedGroundIds.size > 0) {
        // Don't delete if ground is locked
        if (areGroundNodesLocked) {
          alert('Cannot delete: Ground nodes are locked. Unlock ground nodes to delete them.');
        } else {
          setGroundSymbols(prev => prev.filter(g => !selectedGroundIds.has(g.id)));
          setSelectedGroundIds(new Set());
        }
      }
      return;
    }
    // Drawing undo: Ctrl+Z removes last stroke on the selected layer
    // Also handles Power and Ground tool undo
    // Only handle undo keys here; let other keys pass through to tool shortcuts
    if ((currentTool === 'draw' || currentTool === 'erase' || currentTool === 'power' || currentTool === 'ground') && 
        (e.key === 'z' || e.key === 'Z') && 
        e.ctrlKey && 
        !e.shiftKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      
      // Power tool undo: remove last power symbol in reverse order
      if (currentTool === 'power') {
        setPowerSymbols(prev => {
          if (prev.length === 0) return prev;
          return prev.slice(0, -1); // Remove last power symbol
        });
        return;
      }
      
      // Ground tool undo: remove last ground symbol in reverse order
      if (currentTool === 'ground') {
        setGroundSymbols(prev => {
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
    if (!e.ctrlKey && !e.altKey) {
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
            switchToSelectTool();
            return;
          case 'b':
          case 'B':
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
            // The useEffect hook will automatically show the layer chooser
            return;
          case 't':
          case 'T':
            e.preventDefault();
            setDrawingMode('trace');
            setCurrentTool('draw');
            // Default to Top layer, but use last choice if available
            const layerToUse = traceToolLayer || 'top';
            setSelectedDrawingLayer(layerToUse);
            // The useEffect hook will automatically show the layer chooser
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
            // If not Ctrl+Z (handled above), select Zoom tool (default to zoom-in)
            if (!e.ctrlKey) {
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

      // Don't allow transforms if images are locked
      if (areImagesLocked) {
        return;
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
  }, [currentTool, selectedImageForTransform, transformMode, topImage, bottomImage, selectedIds, selectedComponentIds, selectedPowerIds, selectedGroundIds, drawingStrokes, componentsTop, componentsBottom, powers, grounds, powerBuses, drawingMode, finalizeTraceIfAny, traceToolLayer, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize, switchToSelectTool, setComponentsTop, setComponentsBottom]);

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
      // Option/Alt key released: Re-enable snap-to and disable component hover
      if (e.key === 'Alt') {
        setIsSnapDisabled(false);
        setIsOptionPressed(false);
        setHoverComponent(null);
      }
    };
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [handleKeyDown, selectedPowerIds, selectedGroundIds, arePowerNodesLocked, areGroundNodesLocked, powers, grounds, increaseSize, decreaseSize, switchToSelectTool, selectedComponentIds, componentsTop, componentsBottom, setComponentsTop, setComponentsBottom]);

  // Consolidated initialization function - sets all application defaults
  // This is used on app startup, browser refresh, and when creating a new project
  const initializeApplicationDefaults = useCallback(() => {
    // Reset session designator counters
    sessionDesignatorCountersRef.current = {};
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
    setTopPadSize(18);
    setBottomPadSize(18);
    // Save pad defaults to localStorage
    saveDefaultColor('pad', '#0072B2', 'top');
    saveDefaultColor('pad', '#56B4E9', 'bottom');
    saveDefaultSize('pad', 18, 'top');
    saveDefaultSize('pad', 18, 'bottom');
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
      { id: 'powerbus-1', name: '+3V3', voltage: '+3.3', color: '#ff0000' },
      { id: 'powerbus-2', name: '+5V', voltage: '+5.0', color: '#ff0000' },
    ]);
    // Reset ground buses to defaults (GND and Earth Ground)
    setGroundBuses([
      { id: 'groundbus-circuit', name: 'GND', color: '#000000' },
      { id: 'groundbus-earth', name: 'Earth Ground', color: '#333333' },
    ]);
    // Reset pad tool sizes to defaults (project-specific, will be saved in project file)
    // Reset power and ground tool sizes to defaults (project-specific, will be saved in project file)
    saveDefaultSize('power', 18);
    saveDefaultSize('ground', 18);
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
        // Layers panel: left: 60, width: 168
        const LAYERS_LEFT = 60;
        const LAYERS_WIDTH = 168;
        const LEFT_OVERLAY = LAYERS_LEFT + LAYERS_WIDTH + 6; // End of layers panel + gap (234px)
        
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

  // Helper function to get button position and calculate dialog position
  // Positions dialog to the right of the button, aligned with button's top
  const getDialogPosition = (buttonRef: React.RefObject<HTMLButtonElement | null>) => {
    if (!buttonRef.current) return { top: 0, left: 0 };
    const rect = buttonRef.current.getBoundingClientRect();
    const containerRect = canvasContainerRef.current?.getBoundingClientRect();
    if (!containerRect) return { top: 0, left: 0 };
    // Position dialog to the right of the button, aligned with button's top
    return {
      top: rect.top - containerRect.top,
      left: rect.left - containerRect.left + rect.width + 4,
    };
  };

  // Helper function to update trace chooser position
  const updateTraceChooserPosition = useCallback(() => {
    if (traceChooserRef.current && traceButtonRef.current) {
      requestAnimationFrame(() => {
        if (traceChooserRef.current && traceButtonRef.current) {
      const pos = getDialogPosition(traceButtonRef as React.RefObject<HTMLButtonElement | null>);
      traceChooserRef.current.style.top = `${pos.top}px`;
      traceChooserRef.current.style.left = `${pos.left}px`;
    }
      });
    }
  }, []);

  // Helper function to update pad chooser position
  const updatePadChooserPosition = useCallback(() => {
    if (padChooserRef.current && padButtonRef.current) {
      requestAnimationFrame(() => {
        if (padChooserRef.current && padButtonRef.current) {
      const pos = getDialogPosition(padButtonRef as React.RefObject<HTMLButtonElement | null>);
      padChooserRef.current.style.top = `${pos.top}px`;
      padChooserRef.current.style.left = `${pos.left}px`;
    }
      });
    }
  }, []);

  // Update dialog positions when they are shown
  React.useEffect(() => {
    if (showTraceLayerChooser) {
      updateTraceChooserPosition();
    }
  }, [showTraceLayerChooser, updateTraceChooserPosition]);

  React.useEffect(() => {
    if (showPadLayerChooser) {
      updatePadChooserPosition();
    }
  }, [showPadLayerChooser, updatePadChooserPosition]);

  React.useEffect(() => {
    if (showComponentLayerChooser && componentLayerChooserRef.current && componentButtonRef.current) {
      const pos = getDialogPosition(componentButtonRef as React.RefObject<HTMLButtonElement | null>);
      componentLayerChooserRef.current.style.top = `${pos.top}px`;
      componentLayerChooserRef.current.style.left = `${pos.left}px`;
    }
  }, [showComponentLayerChooser]);

  React.useEffect(() => {
    if (showPowerBusSelector && powerBusSelectorRef.current && powerButtonRef.current) {
      const pos = getDialogPosition(powerButtonRef as React.RefObject<HTMLButtonElement | null>);
      powerBusSelectorRef.current.style.top = `${pos.top}px`;
      powerBusSelectorRef.current.style.left = `${pos.left}px`;
    }
  }, [showPowerBusSelector]);

  React.useEffect(() => {
    if (showGroundBusSelector && groundBusSelectorRef.current && groundButtonRef.current) {
      const pos = getDialogPosition(groundButtonRef as React.RefObject<HTMLButtonElement | null>);
      groundBusSelectorRef.current.style.top = `${pos.top}px`;
      groundBusSelectorRef.current.style.left = `${pos.left}px`;
    }
  }, [showGroundBusSelector]);

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
          // Capture drawingStrokes for use in closure
          const currentDrawingStrokes = drawingStrokes;
          
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
            
            // Auto-assign polarity for 2-pin components with polarity
            const updatedComp = prev.find(c => c.id === componentId);
            const newPolarities = updatedComp ? autoAssignPolarity(updatedComp, newPinConnections, currentDrawingStrokes) : null;
            
            return prev.map(c => {
              if (c.id === componentId) {
                const updated = { ...c, pinConnections: newPinConnections };
                if (newPolarities) {
                  (updated as any).pinPolarities = newPolarities;
                }
                return updated;
              }
              return c;
            });
          });
        } else if (compBottom) {
          // Capture drawingStrokes for use in closure
          const currentDrawingStrokes = drawingStrokes;
          
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
            
            // Auto-assign polarity for 2-pin components with polarity
            const updatedComp = prev.find(c => c.id === componentId);
            const newPolarities = updatedComp ? autoAssignPolarity(updatedComp, newPinConnections, currentDrawingStrokes) : null;
            
            return prev.map(c => {
              if (c.id === componentId) {
                const updated = { ...c, pinConnections: newPinConnections };
                if (newPolarities) {
                  (updated as any).pinPolarities = newPolarities;
                }
                return updated;
              }
              return c;
            });
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
      const newPosition = {
        x: e.clientX - dialogDragOffset.x,
        y: e.clientY - dialogDragOffset.y,
      };
      setComponentDialogPosition(newPosition);
      // Save position to localStorage
      localStorage.setItem('componentDialogPosition', JSON.stringify(newPosition));
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

  // Handle detailed info dialog dragging
  React.useEffect(() => {
    if (!isDraggingDetailedInfoDialog) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!detailedInfoDialogDragOffset) return;
      const newPosition = {
        x: e.clientX - detailedInfoDialogDragOffset.x,
        y: e.clientY - detailedInfoDialogDragOffset.y,
      };
      setDetailedInfoDialogPosition(newPosition);
      // Save position to localStorage
      localStorage.setItem('detailedInfoDialogPosition', JSON.stringify(newPosition));
    };

    const handleMouseUp = () => {
      setIsDraggingDetailedInfoDialog(false);
      setDetailedInfoDialogDragOffset(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDetailedInfoDialog, detailedInfoDialogDragOffset]);

  // Handle notes dialog dragging
  React.useEffect(() => {
    if (!isDraggingNotesDialog) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!notesDialogDragOffset) return;
      const newPosition = {
        x: e.clientX - notesDialogDragOffset.x,
        y: e.clientY - notesDialogDragOffset.y,
      };
      setNotesDialogPosition(newPosition);
      // Save position to localStorage
      localStorage.setItem('notesDialogPosition', JSON.stringify(newPosition));
    };

    const handleMouseUp = () => {
      setIsDraggingNotesDialog(false);
      setNotesDialogDragOffset(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingNotesDialog, notesDialogDragOffset]);

  // Initialize notes dialog position when it opens (load from localStorage or default)
  React.useEffect(() => {
    if (notesDialogVisible && notesDialogPosition === null) {
      // Try to load saved position from localStorage
      const saved = localStorage.getItem('notesDialogPosition');
      if (saved) {
        try {
          const savedPosition = JSON.parse(saved);
          setNotesDialogPosition(savedPosition);
        } catch {
          // If parsing fails, use default right side position
          setNotesDialogPosition({
            x: window.innerWidth - 550, // Right side, similar to detailed info dialog
            y: 100,
          });
        }
      } else {
        // No saved position, use default right side position
        setNotesDialogPosition({
          x: window.innerWidth - 550,
          y: 100,
        });
      }
    }
  }, [notesDialogVisible, notesDialogPosition]);

  // Initialize dialog position when it opens (load from localStorage or center of screen)
  React.useEffect(() => {
    if (componentEditor && componentEditor.visible && componentDialogPosition === null) {
      // Try to load saved position from localStorage
      const saved = localStorage.getItem('componentDialogPosition');
      if (saved) {
        try {
          const savedPosition = JSON.parse(saved);
          setComponentDialogPosition(savedPosition);
        } catch {
          // If parsing fails, use default center position
          setComponentDialogPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          });
        }
      } else {
        // No saved position, use default center position
        setComponentDialogPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
      }
    } else if (!componentEditor || !componentEditor.visible) {
      // Don't reset position when dialog closes - keep it for next time
      // setComponentDialogPosition(null);
    }
  }, [componentEditor, componentDialogPosition]);

  // Initialize detailed info dialog position when it opens (load from localStorage or default)
  React.useEffect(() => {
    if (debugDialog.visible && detailedInfoDialogPosition === null) {
      // Try to load saved position from localStorage
      const saved = localStorage.getItem('detailedInfoDialogPosition');
      if (saved) {
        try {
          const savedPosition = JSON.parse(saved);
          setDetailedInfoDialogPosition(savedPosition);
        } catch {
          // If parsing fails, use default right side position
          setDetailedInfoDialogPosition({
            x: window.innerWidth - 450, // Right side, similar to current positioning
            y: 80, // Top padding
          });
        }
      } else {
        // No saved position, use default right side position
        setDetailedInfoDialogPosition({
          x: window.innerWidth - 450, // Right side, similar to current positioning
          y: 80, // Top padding
        });
      }
    } else if (!debugDialog.visible) {
      // Don't reset position when dialog closes - keep it for next time
      // setDetailedInfoDialogPosition(null);
    }
  }, [debugDialog.visible, detailedInfoDialogPosition]);

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
      const viaColor = viaDef?.settings.color || localStorage.getItem('defaultViaColor') || '#ff0000' || brushColor;
      
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
      // Draw ground symbol cursor based on selected ground bus type
      ctx.strokeStyle = '#000000'; // Ground symbols are always black
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      
      // Check if Earth Ground is selected
      const isEarthGround = selectedGroundBusId === 'groundbus-earth';
      
      if (isEarthGround) {
        // Draw Earth Ground symbol: vertical line with 3 horizontal bars (progressively shorter)
        const unit = r * 1.5; // Scale based on cursor radius
        const vLen = unit * 0.9; // Vertical line length
        const barG = unit * 0.24; // Gap between bars
        const width = unit * 1.6; // Width of first (longest) bar
        
        // Vertical line (from top)
        ctx.beginPath();
        ctx.moveTo(cx, cy - vLen / 2);
        ctx.lineTo(cx, cy + vLen / 2);
        ctx.stroke();
        
        // Three horizontal bars (progressively shorter)
        for (let i = 0; i < 3; i++) {
          const barY = cy + vLen / 2 + i * barG;
          const barWidth = width * (1 - i * 0.25); // Each bar is 25% shorter than previous
          ctx.beginPath();
          ctx.moveTo(cx - barWidth / 2, barY);
          ctx.lineTo(cx + barWidth / 2, barY);
          ctx.stroke();
        }
      } else {
        // Draw GND or other ground symbol: circle with crossing lines
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
      }
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
  }, [currentTool, drawingMode, brushColor, brushSize, viewScale, isShiftPressed, selectedComponentType, selectedPowerBusId, selectedGroundBusId, powerBuses, toolRegistry, traceToolLayer, topTraceColor, bottomTraceColor, componentToolLayer, topComponentColor, bottomComponentColor]);

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

  // Helper function to clean up connections when vias/pads are deleted
  const cleanupConnectionsForDeletedPointIds = useCallback((deletedPointIds: Set<number>) => {
    if (deletedPointIds.size === 0) return;
    
    const deletedPointIdStrings = Array.from(deletedPointIds).map(id => String(id));
    
    // Remove trace points that reference deleted pointIds
    setDrawingStrokes(prev => {
      return prev.map(stroke => {
        if (stroke.type === 'trace') {
          // Filter out points that match deleted pointIds
          const filteredPoints = stroke.points.filter(p => {
            if (p.id === undefined) return true;
            return !deletedPointIds.has(p.id);
          });
          
          // If trace has less than 2 points, remove the entire trace
          if (filteredPoints.length < 2) {
            return null; // Mark for removal
          }
          
          return { ...stroke, points: filteredPoints };
        }
        return stroke;
      }).filter(s => s !== null) as DrawingStroke[];
    });
    
    // Clear component pin connections that reference deleted pointIds
    setComponentsTop(prev => prev.map(comp => {
      const pinConnections = comp.pinConnections || [];
      const hasDeletedConnection = pinConnections.some(conn => 
        conn && deletedPointIdStrings.includes(conn)
      );
      if (hasDeletedConnection) {
        const updatedConnections = pinConnections.map(conn => 
          conn && deletedPointIdStrings.includes(conn) ? '' : conn
        );
        return { ...comp, pinConnections: updatedConnections };
      }
      return comp;
    }));
    setComponentsBottom(prev => prev.map(comp => {
      const pinConnections = comp.pinConnections || [];
      const hasDeletedConnection = pinConnections.some(conn => 
        conn && deletedPointIdStrings.includes(conn)
      );
      if (hasDeletedConnection) {
        const updatedConnections = pinConnections.map(conn => 
          conn && deletedPointIdStrings.includes(conn) ? '' : conn
        );
        return { ...comp, pinConnections: updatedConnections };
      }
      return comp;
    }));
  }, [setDrawingStrokes, setComponentsTop, setComponentsBottom]);

  // Track previous via/pad pointIds to detect deletions
  const prevViaPadPointIdsRef = useRef<Set<number>>(new Set());
  
  // Clean up connections when vias/pads are deleted (works for both delete key and erase tool)
  React.useEffect(() => {
    // Collect current via/pad pointIds
    const currentPointIds = new Set<number>();
    for (const stroke of drawingStrokes) {
      if ((stroke.type === 'via' || stroke.type === 'pad') && stroke.points.length > 0) {
        const pointId = stroke.points[0].id;
        if (pointId !== undefined) {
          currentPointIds.add(pointId);
        }
      }
    }
    
    // Find deleted pointIds (in previous but not in current)
    const deletedPointIds = new Set<number>();
    for (const pointId of prevViaPadPointIdsRef.current) {
      if (!currentPointIds.has(pointId)) {
        deletedPointIds.add(pointId);
      }
    }
    
    // Clean up connections if any vias/pads were deleted
    if (deletedPointIds.size > 0) {
      cleanupConnectionsForDeletedPointIds(deletedPointIds);
    }
    
    // Update ref for next comparison
    prevViaPadPointIdsRef.current = currentPointIds;
  }, [drawingStrokes, cleanupConnectionsForDeletedPointIds]);

  // Update via/pad types dynamically when power/ground nodes are added, removed, or moved
  React.useEffect(() => {
    // Update all vias and pads to reflect current power/ground connections
    setDrawingStrokes(prev => prev.map(s => {
      if (s.type === 'via' && s.points.length > 0 && s.points[0].id !== undefined) {
        const nodeId = s.points[0].id;
        const newViaType = determineViaType(nodeId, powerBuses);
        if (s.viaType !== newViaType) {
          return { ...s, viaType: newViaType };
        }
      } else if (s.type === 'pad' && s.points.length > 0 && s.points[0].id !== undefined) {
        const nodeId = s.points[0].id;
        const newPadType = determinePadType(nodeId, powerBuses);
        if (s.padType !== newPadType) {
          return { ...s, padType: newPadType };
        }
      }
      return s;
    }));
  }, [powers, grounds, powerBuses, determineViaType, determinePadType]);

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
          x: topImage.x, y: topImage.y, // World coordinates - saved as-is
          // Debug: Log image position when saving
          // console.log('Saving topImage position:', { x: topImage.x, y: topImage.y });
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
      groundBuses, // Save ground bus definitions
      pointIdCounter: getPointIdCounter(), // Save the point ID counter to preserve uniqueness
      designatorCounters: loadDesignatorCounters(), // Save designator counters for each prefix
      autoAssignDesignators, // Save auto-designator assignment setting
      useGlobalDesignatorCounters, // Save global designator counter setting
      // Save layer-specific tool settings from tool registry (project-specific)
      traceColors: {
        top: toolRegistry.get('trace')?.layerSettings.get('top')?.color || topTraceColor,
        bottom: toolRegistry.get('trace')?.layerSettings.get('bottom')?.color || bottomTraceColor,
      },
      traceSizes: {
        top: toolRegistry.get('trace')?.layerSettings.get('top')?.size || topTraceSize,
        bottom: toolRegistry.get('trace')?.layerSettings.get('bottom')?.size || bottomTraceSize,
      },
      padColors: {
        top: toolRegistry.get('pad')?.layerSettings.get('top')?.color || topPadColor,
        bottom: toolRegistry.get('pad')?.layerSettings.get('bottom')?.color || bottomPadColor,
      },
      padSizes: {
        top: toolRegistry.get('pad')?.layerSettings.get('top')?.size || topPadSize,
        bottom: toolRegistry.get('pad')?.layerSettings.get('bottom')?.size || bottomPadSize,
      },
      componentColors: {
        top: toolRegistry.get('component')?.layerSettings.get('top')?.color || topComponentColor,
        bottom: toolRegistry.get('component')?.layerSettings.get('bottom')?.color || bottomComponentColor,
      },
      componentSizes: {
        top: toolRegistry.get('component')?.layerSettings.get('top')?.size || topComponentSize,
        bottom: toolRegistry.get('component')?.layerSettings.get('bottom')?.size || bottomComponentSize,
      },
      traceToolLayer, // Save last layer choice
      toolSettings: {
        // Convert Map to plain object for JSON serialization
        trace: toolRegistry.get('trace')?.settings || { color: '#ff0000', size: 6 },
        via: toolRegistry.get('via')?.settings || { color: '#ff0000', size: 18 },
        pad: toolRegistry.get('pad')?.settings || { color: '#ff0000', size: 18 },
        component: toolRegistry.get('component')?.settings || { color: '#ff0000', size: 18 },
        ground: toolRegistry.get('ground')?.settings || { color: '#000000', size: 18 },
        power: toolRegistry.get('power')?.settings || { color: '#ff0000', size: 18 },
        erase: toolRegistry.get('erase')?.settings || { color: '#f5a3b3', size: 18 },
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
        showConnectionsLayer,
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
  }, [currentView, viewScale, viewPan, showBothLayers, selectedDrawingLayer, topImage, bottomImage, drawingStrokes, vias, tracesTop, tracesBottom, componentsTop, componentsBottom, grounds, toolRegistry, areImagesLocked, areViasLocked, arePadsLocked, areTracesLocked, areComponentsLocked, areGroundNodesLocked, arePowerNodesLocked, powerBuses, groundBuses, getPointIdCounter, topTraceColor, bottomTraceColor, topTraceSize, bottomTraceSize, topPadColor, bottomPadColor, topPadSize, bottomPadSize, topComponentColor, bottomComponentColor, topComponentSize, bottomComponentSize, traceToolLayer, autoSaveEnabled, autoSaveInterval, autoSaveBaseName, projectName, showViasLayer, showTopPadsLayer, showBottomPadsLayer, showTopTracesLayer, showBottomTracesLayer, showTopComponents, showBottomComponents, showPowerLayer, showGroundLayer, showConnectionsLayer, autoAssignDesignators, useGlobalDesignatorCounters]);

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
    // Remove any existing timestamp from baseName before appending new timestamp
    const cleanBaseName = removeTimestampFromFilename(baseName);
    const filename = `${cleanBaseName}_${timestamp}.json`;
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
      
      // Before saving new file, check if there's a previous project file in root directory
      // and move it to history/ (including the file that was opened, if it's in this directory)
      try {
        // Look for project files in root directory by checking file content
        const rootFiles: string[] = [];
        const currentFilePath = currentProjectFilePathRef.current;
        
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
              // This includes the file that was just opened, which should be moved to history
              // when auto-save is first invoked
              if (parsed.version && (
                parsed.fileType === 'PCB_REVERSE_ENGINEERING_AUTOSAVE' ||
                !parsed.fileType // Manually saved files don't have fileType
              )) {
                rootFiles.push(name);
                const fileType = parsed.fileType ? 'auto-saved' : 'manually saved/opened';
                const isOpenedFile = name === currentFilePath;
                console.log(`Auto save: Found PCB project file in root: ${name} (${fileType}${isOpenedFile ? ' - this is the opened file' : ''})`);
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
  
  // Update ref so it can be accessed by handleAutoSaveApply
  performAutoSaveRef.current = performAutoSave;

  // Save project state as JSON (including embedded images)
  const saveProject = useCallback(async () => {
    const { project } = buildProjectData();
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    // If we have a project directory handle and name, use them (from New Project or previous save)
    // Always add timestamp to project files and move old files to history
    if (projectDirHandle && projectName) {
      try {
        // Get or create history directory
        let historyDirHandle: FileSystemDirectoryHandle | null = null;
        try {
          historyDirHandle = await projectDirHandle.getDirectoryHandle('history', { create: true });
        } catch (e) {
          console.error('Failed to get/create history directory:', e);
          // Continue with save even if history directory creation fails
          historyDirHandle = null;
        }
        
        // Remove any existing timestamp from project name and add new timestamp
        const projectNameWithoutExt = projectName.replace(/\.json$/i, '');
        const projectNameWithoutTimestamp = removeTimestampFromFilename(projectNameWithoutExt);
        const { timestamp } = buildProjectData();
        const filename = `${projectNameWithoutTimestamp}_${timestamp}.json`;
        
        // Move any existing project files in root to history before saving
        if (historyDirHandle) {
          try {
            const rootFiles: string[] = [];
            for await (const name of (projectDirHandle as any).keys()) {
              try {
                // Skip directories and the file we're about to create
                if (name === 'history' || name === filename) {
                  continue;
                }
                
                const fileHandle = await projectDirHandle.getFileHandle(name);
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
                  if (parsed.version) {
                    rootFiles.push(name);
                    console.log(`Save: Found PCB project file in root: ${name}`);
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
            
            // Move existing project files to history
            for (const oldFilename of rootFiles) {
              try {
                const oldFileHandle = await projectDirHandle.getFileHandle(oldFilename);
                const oldFile = await oldFileHandle.getFile();
                const oldFileContent = await oldFile.text();
                
                // Write to history directory
                const historyFileHandle = await historyDirHandle.getFileHandle(oldFilename, { create: true });
                const historyWritable = await historyFileHandle.createWritable();
                await historyWritable.write(new Blob([oldFileContent], { type: 'application/json' }));
                await historyWritable.close();
                
                // Remove from root directory
                await projectDirHandle.removeEntry(oldFilename);
                console.log(`Save: Moved ${oldFilename} from root to history/`);
              } catch (e) {
                console.warn(`Save: Failed to move ${oldFilename} to history:`, e);
                // Continue with other files even if one fails
              }
            }
          } catch (e) {
            console.warn('Save: Error checking for old files in root:', e);
            // Continue with save even if moving old files fails
          }
        }
        
        // Save new file to root directory with timestamp
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
          // Remove timestamp from filename and clean it for use as base name
          const filenameWithoutExt = handle.name.replace(/\.json$/i, '');
          const baseNameWithoutTimestamp = removeTimestampFromFilename(filenameWithoutExt);
          const baseName = baseNameWithoutTimestamp.replace(/[^a-zA-Z0-9_-]/g, '_');
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
    setPowerSymbols([]);
    setGroundSymbols([]);
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
    
    // Save the project file immediately with project name and timestamp
    try {
      const { project, timestamp } = buildProjectData();
      // Remove any existing timestamp from project name and add current timestamp
      const projectNameWithoutTimestamp = removeTimestampFromFilename(cleanProjectName);
      const filename = `${projectNameWithoutTimestamp}_${timestamp}.json`;
      const json = JSON.stringify(project, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      
      const fileHandle = await projectDirHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      
      // Update current project file path
      setCurrentProjectFilePath(filename);
      console.log(`New project created: ${cleanProjectName}/${filename}`);
      
      // Prompt user to enable auto-save
      setAutoSavePromptDialog({ visible: true, source: 'new', interval: 5 });
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
        // Tool settings are project-specific, loaded from project file
      } else {
        // If traceSizes doesn't exist in project, ensure defaults are set
        setTopTraceSize(6);
        setBottomTraceSize(6);
        // Tool settings are project-specific, using defaults
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
        const topSize = project.padSizes.top != null && project.padSizes.top > 0 ? project.padSizes.top : 18;
        const bottomSize = project.padSizes.bottom != null && project.padSizes.bottom > 0 ? project.padSizes.bottom : 18;
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
              // Restore general settings
              const restoredSettings = { ...traceDef, settings: project.toolSettings.trace };
              // Also restore layer-specific settings from traceSizes and traceColors
              const layerSettings = new Map(traceDef.layerSettings);
              if (project.traceSizes && project.traceColors) {
                layerSettings.set('top', { 
                  color: project.traceColors.top || traceDef.layerSettings.get('top')?.color || '#AA4499', 
                  size: project.traceSizes.top || traceDef.layerSettings.get('top')?.size || 6 
                });
                layerSettings.set('bottom', { 
                  color: project.traceColors.bottom || traceDef.layerSettings.get('bottom')?.color || '#F781BF', 
                  size: project.traceSizes.bottom || traceDef.layerSettings.get('bottom')?.size || 6 
                });
              }
              updated.set('trace', { ...restoredSettings, layerSettings });
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
              // Restore general settings
              const restoredSettings = { ...padDef, settings: project.toolSettings.pad };
              // Also restore layer-specific settings from padSizes and padColors
              const layerSettings = new Map(padDef.layerSettings);
              if (project.padSizes && project.padColors) {
                layerSettings.set('top', { 
                  color: project.padColors.top || padDef.layerSettings.get('top')?.color || '#0072B2', 
                  size: project.padSizes.top || padDef.layerSettings.get('top')?.size || 18 
                });
                layerSettings.set('bottom', { 
                  color: project.padColors.bottom || padDef.layerSettings.get('bottom')?.color || '#56B4E9', 
                  size: project.padSizes.bottom || padDef.layerSettings.get('bottom')?.size || 18 
                });
              }
              updated.set('pad', { ...restoredSettings, layerSettings });
            }
          }
          if (project.toolSettings.component) {
            const componentDef = updated.get('component');
            if (componentDef) {
              // Restore general settings
              const restoredSettings = { ...componentDef, settings: project.toolSettings.component };
              // Also restore layer-specific settings from componentSizes and componentColors
              const layerSettings = new Map(componentDef.layerSettings);
              if (project.componentSizes && project.componentColors) {
                layerSettings.set('top', { 
                  color: project.componentColors.top || componentDef.layerSettings.get('top')?.color || '#6A3D9A', 
                  size: project.componentSizes.top || componentDef.layerSettings.get('top')?.size || 18 
                });
                layerSettings.set('bottom', { 
                  color: project.componentColors.bottom || componentDef.layerSettings.get('bottom')?.color || '#9467BD', 
                  size: project.componentSizes.bottom || componentDef.layerSettings.get('bottom')?.size || 18 
                });
              }
              updated.set('component', { ...restoredSettings, layerSettings });
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
          if (project.toolSettings.erase) {
            const eraseDef = updated.get('erase');
            if (eraseDef) {
              updated.set('erase', { ...eraseDef, settings: project.toolSettings.erase });
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
            // For layer-specific tools, use layer-specific settings
            if (currentTool === 'draw' && drawingMode === 'trace') {
              const layer = traceToolLayer || 'top';
              const layerSettings = currentToolDef.layerSettings.get(layer);
              if (layerSettings) {
                setBrushColor(layerSettings.color);
                setBrushSize(layerSettings.size);
                if (layer === 'top') {
                  setTopTraceColor(layerSettings.color);
                  setTopTraceSize(layerSettings.size);
                } else {
                  setBottomTraceColor(layerSettings.color);
                  setBottomTraceSize(layerSettings.size);
                }
              } else {
                setBrushColor(currentToolDef.settings.color);
                setBrushSize(currentToolDef.settings.size);
              }
            } else if (currentTool === 'draw' && drawingMode === 'pad') {
              const layer = padToolLayer || 'top';
              const layerSettings = currentToolDef.layerSettings.get(layer);
              if (layerSettings) {
                setBrushColor(layerSettings.color);
                setBrushSize(layerSettings.size);
                if (layer === 'top') {
                  setTopPadColor(layerSettings.color);
                  setTopPadSize(layerSettings.size);
                } else {
                  setBottomPadColor(layerSettings.color);
                  setBottomPadSize(layerSettings.size);
                }
              } else {
                setBrushColor(currentToolDef.settings.color);
                setBrushSize(currentToolDef.settings.size);
              }
            } else if (currentTool === 'component') {
              const layer = componentToolLayer || 'top';
              const layerSettings = currentToolDef.layerSettings.get(layer);
              if (layerSettings) {
                setBrushColor(layerSettings.color);
                setBrushSize(layerSettings.size);
                if (layer === 'top') {
                  setTopComponentColor(layerSettings.color);
                  setTopComponentSize(layerSettings.size);
                } else {
                  setBottomComponentColor(layerSettings.color);
                  setBottomComponentSize(layerSettings.size);
                }
              } else {
                setBrushColor(currentToolDef.settings.color);
                setBrushSize(currentToolDef.settings.size);
              }
            } else {
              // For other tools, use general settings
              setBrushColor(currentToolDef.settings.color);
              setBrushSize(currentToolDef.settings.size);
            }
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
          x: img.x ?? 0, // World coordinates - loaded as-is
          y: img.y ?? 0, // World coordinates - loaded as-is
          // Debug: Log image position when loading
          // console.log('Loading image position:', { x: img.x ?? 0, y: img.y ?? 0, name: img.name });
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
      // If not present (old project files), calculate the max ID from existing elements
      if (project.pointIdCounter && typeof project.pointIdCounter === 'number') {
        setPointIdCounter(project.pointIdCounter);
      } else {
        // For backward compatibility: find the maximum Node ID in the project
        // and set the counter to max + 1 to ensure uniqueness
        let maxId = 0;
        
        // Check all drawing strokes (vias, pads, traces)
        if (project.drawing?.drawingStrokes) {
          for (const stroke of project.drawing.drawingStrokes) {
            if (stroke.points) {
              for (const point of stroke.points) {
                if (point.id && typeof point.id === 'number' && point.id > maxId) {
                  maxId = point.id;
                }
              }
            }
          }
        }
        
        // Check component pin connections
        const allComponents = [
          ...(project.drawing?.componentsTop || []),
          ...(project.drawing?.componentsBottom || [])
        ];
        for (const comp of allComponents) {
          if (comp.pinConnections) {
            for (const conn of comp.pinConnections) {
              if (conn) {
                const nodeId = parseInt(conn.trim(), 10);
                if (!isNaN(nodeId) && nodeId > maxId) {
                  maxId = nodeId;
                }
              }
            }
          }
        }
        
        // Check power and ground nodes
        if (project.drawing?.powers) {
          for (const power of project.drawing.powers) {
            if (power.pointId && typeof power.pointId === 'number' && power.pointId > maxId) {
              maxId = power.pointId;
            }
          }
        }
        if (project.drawing?.grounds) {
          for (const ground of project.drawing.grounds) {
            if (ground.pointId && typeof ground.pointId === 'number' && ground.pointId > maxId) {
              maxId = ground.pointId;
            }
          }
        }
        
        // Set counter to max + 1 to ensure next ID is unique
        setPointIdCounter(maxId + 1);
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
        if (typeof project.visibility.showConnectionsLayer === 'boolean') setShowConnectionsLayer(project.visibility.showConnectionsLayer);
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
      
      // Restore designator counters from project file, or initialize from existing components
      if (project.designatorCounters && typeof project.designatorCounters === 'object') {
        // Load saved counters
        const savedCounters = project.designatorCounters as Record<string, number>;
        saveDesignatorCounters(savedCounters);
      } else {
        // For legacy projects or if counters are missing, initialize from existing components
        const allComponents = [
          ...(project.drawing?.componentsTop || []),
          ...(project.drawing?.componentsBottom || [])
        ];
        const counters: Record<string, number> = {};
        for (const comp of allComponents) {
          if (comp.designator && comp.designator.trim()) {
            const prefix = getDefaultPrefix(comp.componentType);
            const match = comp.designator.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`));
            if (match) {
              const num = parseInt(match[1], 10);
              if (!counters[prefix] || num > counters[prefix]) {
                counters[prefix] = num;
              }
            }
          }
        }
        // Merge with any existing localStorage counters (take the max)
        const existingCounters = loadDesignatorCounters();
        for (const [prefix, num] of Object.entries(counters)) {
          counters[prefix] = Math.max(num, existingCounters[prefix] || 0);
        }
        saveDesignatorCounters(counters);
      }
      
      // Restore auto-designator assignment setting
      if (typeof project.autoAssignDesignators === 'boolean') {
        setAutoAssignDesignators(project.autoAssignDesignators);
        localStorage.setItem('autoAssignDesignators', String(project.autoAssignDesignators));
      }
      
      // Restore global designator counter setting (default to false/OFF)
      if (typeof project.useGlobalDesignatorCounters === 'boolean') {
        setUseGlobalDesignatorCounters(project.useGlobalDesignatorCounters);
      } else {
        setUseGlobalDesignatorCounters(false); // Default to OFF
      }
      
      // Reset session counters when loading a project
      sessionDesignatorCountersRef.current = {};
      
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
        setGroundSymbols(validGrounds);
      }
      // Load power buses first (needed for legacy power node migration)
      let loadedPowerBuses: PowerBus[];
      if (project.powerBuses && Array.isArray(project.powerBuses) && project.powerBuses.length > 0) {
        // Load saved power buses (preserves user edits)
        loadedPowerBuses = project.powerBuses as PowerBus[];
        setPowerBuses(loadedPowerBuses);
      } else {
        // Initialize default power buses if project doesn't have any (for legacy projects)
        loadedPowerBuses = [
          { id: 'powerbus-1', name: '+3V3', voltage: '+3.3', color: '#ff0000' },
          { id: 'powerbus-2', name: '+5V', voltage: '+5.0', color: '#ff0000' },
        ];
        setPowerBuses(loadedPowerBuses);
      }
      // Load ground buses
      if (project.groundBuses && Array.isArray(project.groundBuses) && project.groundBuses.length > 0) {
        // Load saved ground buses (preserves user edits)
        // Remove value field if present (legacy projects may have it)
        const migratedGroundBuses = (project.groundBuses as any[]).map(bus => {
          const { value, ...busWithoutValue } = bus;
          return busWithoutValue as GroundBus;
        });
        setGroundBuses(migratedGroundBuses);
      } else {
        // Initialize default ground buses if project doesn't have any (for legacy projects)
        setGroundBuses([
          { id: 'groundbus-circuit', name: 'GND', color: '#000000' },
          { id: 'groundbus-earth', name: 'Earth Ground', color: '#333333' },
        ]);
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
              return { ...p, pointId, x: truncatedPos.x, y: truncatedPos.y, powerBusId: loadedPowerBuses.length > 0 ? loadedPowerBuses[0].id : 'default-5v', layer: p.layer || 'top' };
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
        setPowerSymbols(powersWithBusId);
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

  // Handler for opening a project file
  const handleOpenProject = useCallback(async () => {
    const w = window as any;
    if (typeof w.showOpenFilePicker === 'function') {
      try {
        const [handle] = await w.showOpenFilePicker({
          multiple: false,
        });
        const file = await handle.getFile();
        if (!file.name.toLowerCase().endsWith('.json')) {
          alert('Please select a .json project file.');
          return;
        }
        setCurrentProjectFilePath(file.name);
        const text = await file.text();
        const project = JSON.parse(text);
        
        // Get the directory handle from the file handle (parent directory)
        // This sets the project directory so that when auto-save is enabled,
        // it will automatically use this directory (no need to prompt user)
        try {
          const dirHandle = await handle.getParent();
          setProjectDirHandle(dirHandle);
          console.log(`Opened project file: ${file.name} in directory (auto-save will use this directory)`);
        } catch (e) {
          console.warn('Could not get directory handle from file handle:', e);
          // Continue without directory handle (fallback will prompt if needed)
        }
        
        await loadProject(project);
        
        let projectNameToUse: string;
        if (project.projectInfo?.name) {
          projectNameToUse = project.projectInfo.name;
        } else {
          const projectNameFromFile = file.name.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
          projectNameToUse = projectNameFromFile || 'pcb_project';
          setProjectName(projectNameToUse);
          localStorage.setItem('pcb_project_name', projectNameToUse);
        }
        
        if (!projectName) {
          setProjectName(projectNameToUse);
          localStorage.setItem('pcb_project_name', projectNameToUse);
        }
        
        setTimeout(() => {
          // Always show auto-save prompt dialog after opening a project
          setAutoSavePromptDialog({ visible: true, source: 'open', interval: 5 });
        }, 100);
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return;
        console.warn('showOpenFilePicker failed, falling back to input', e);
        openProjectRef.current?.click();
      }
    } else {
      openProjectRef.current?.click();
    }
  }, [loadProject, projectName, setCurrentProjectFilePath, setProjectName, setProjectDirHandle, setAutoSavePromptDialog]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🔧 PCB Reverse Engineering Tool (v2.1)</h1>
      </header>

      {/* Application menu bar */}
      <MenuBar
        openMenu={openMenu}
        setOpenMenu={setOpenMenu}
        isReadOnlyMode={isReadOnlyMode}
        currentProjectFilePath={currentProjectFilePath}
        onNewProject={newProject}
        onOpenProject={handleOpenProject}
        onSaveProject={saveProject}
        onSaveAs={openSaveAsDialog}
        onPrint={handlePrint}
        hasUnsavedChanges={hasUnsavedChanges}
        setNewProjectDialog={setNewProjectDialog}
        setAutoSaveDialog={setAutoSaveDialog}
        topImage={topImage}
        bottomImage={bottomImage}
        selectedImageForTransform={selectedImageForTransform}
        setSelectedImageForTransform={setSelectedImageForTransform}
        setCurrentTool={setCurrentTool}
        transformMode={transformMode}
        setTransformMode={setTransformMode}
        updateImageTransform={updateImageTransform}
        resetImageTransform={resetImageTransform}
        isGrayscale={isGrayscale}
        setIsGrayscale={setIsGrayscale}
        isBlackAndWhiteEdges={isBlackAndWhiteEdges}
        setIsBlackAndWhiteEdges={setIsBlackAndWhiteEdges}
        isBlackAndWhiteInverted={isBlackAndWhiteInverted}
        setIsBlackAndWhiteInverted={setIsBlackAndWhiteInverted}
        areImagesLocked={areImagesLocked}
        setAreImagesLocked={setAreImagesLocked}
        onEnterBoardDimensions={() => setShowBoardDimensionsDialog(true)}
        fileInputTopRef={fileInputTopRef}
        fileInputBottomRef={fileInputBottomRef}
        openProjectRef={openProjectRef}
        increaseSize={increaseSize}
        decreaseSize={decreaseSize}
        brushSize={brushSize}
        drawingStrokes={drawingStrokes}
        selectedIds={selectedIds}
        selectedComponentIds={selectedComponentIds}
        selectedPowerIds={selectedPowerIds}
        selectedGroundIds={selectedGroundIds}
        componentsTop={componentsTop}
        componentsBottom={componentsBottom}
        powers={powers}
        grounds={grounds}
        powerNodeNames={powerNodeNames}
        groundNodeNames={groundNodeNames}
        setSetSizeDialog={setSetSizeDialog}
        areViasLocked={areViasLocked}
        setAreViasLocked={setAreViasLocked}
        arePadsLocked={arePadsLocked}
        setArePadsLocked={setArePadsLocked}
        areTracesLocked={areTracesLocked}
        setAreTracesLocked={setAreTracesLocked}
        areComponentsLocked={areComponentsLocked}
        setAreComponentsLocked={setAreComponentsLocked}
        areGroundNodesLocked={areGroundNodesLocked}
        setAreGroundNodesLocked={setAreGroundNodesLocked}
        arePowerNodesLocked={arePowerNodesLocked}
        setArePowerNodesLocked={setArePowerNodesLocked}
        setSelectedIds={setSelectedIds}
        setSelectedComponentIds={setSelectedComponentIds}
        setSelectedPowerIds={setSelectedPowerIds}
        setSelectedGroundIds={setSelectedGroundIds}
        selectAllVias={selectAllVias}
        selectAllTraces={selectAllTraces}
        selectAllPads={selectAllPads}
        selectAllComponents={selectAllComponents}
        selectDisconnectedComponents={selectDisconnectedComponents}
        selectAllPowerNodes={selectAllPowerNodes}
        selectAllGroundNodes={selectAllGroundNodes}
        selectPowerNodesByName={selectPowerNodesByName}
        selectGroundNodesByName={selectGroundNodesByName}
        setShowPowerBusManager={setShowPowerBusManager}
        setShowGroundBusManager={setShowGroundBusManager}
        setShowDesignatorManager={setShowDesignatorManager}
        toolRegistry={toolRegistry}
        updateToolSettings={updateToolSettings}
        updateToolLayerSettings={updateToolLayerSettings}
        setBrushSize={setBrushSize}
        setBrushColor={setBrushColor}
        saveToolSettings={saveToolSettings}
        saveToolLayerSettings={saveToolLayerSettings}
        colorPalette={palette8x8}
        currentTool={currentTool}
        drawingMode={drawingMode}
        traceToolLayer={traceToolLayer}
        padToolLayer={padToolLayer}
        componentToolLayer={componentToolLayer}
        setTopTraceSize={setTopTraceSize}
        setBottomTraceSize={setBottomTraceSize}
        setTopPadSize={setTopPadSize}
        setBottomPadSize={setBottomPadSize}
        setTopComponentSize={setTopComponentSize}
        setBottomComponentSize={setBottomComponentSize}
        topTraceColor={topTraceColor}
        bottomTraceColor={bottomTraceColor}
        topPadColor={topPadColor}
        bottomPadColor={bottomPadColor}
        topComponentColor={topComponentColor}
        bottomComponentColor={bottomComponentColor}
        setTopTraceColor={setTopTraceColor}
        setBottomTraceColor={setBottomTraceColor}
        setTopPadColor={setTopPadColor}
        setBottomPadColor={setBottomPadColor}
        setTopComponentColor={setTopComponentColor}
        setBottomComponentColor={setBottomComponentColor}
        saveDefaultSize={saveDefaultSize}
        saveDefaultColor={saveDefaultColor}
        menuBarRef={menuBarRef}
      />

      <div style={{ display: 'block', padding: 0, margin: 0, width: '100vw', height: 'calc(100vh - 70px)', boxSizing: 'border-box', position: 'relative' }}>
        {/* Control Panel removed - functionality moved to top menus and left toolstrip */}

        {/* Canvas Area */}
        <div ref={canvasContainerRef} style={{ position: 'relative', width: '100%', height: '100%', margin: 0, padding: 0, boxSizing: 'border-box', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', borderRadius: '16px', overflow: 'hidden' }}>
          {/* Left toolstrip (icons) */}
          <div style={{ position: 'absolute', top: 6, left: 6, bottom: 6, width: 46, display: 'flex', flexDirection: 'column', gap: 8, padding: '6px 3px', background: 'rgba(250,250,255,0.95)', borderRadius: 8, border: '1px solid #ddd', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 20 }}>
            <button 
              onClick={() => { if (!isReadOnlyMode) switchToSelectTool(); }} 
              onMouseDown={(e) => e.currentTarget.blur()}
              disabled={isReadOnlyMode}
              title="Select (S)" 
              style={{
                width: '100%', 
                height: 32, 
                display: 'flex', 
                alignItems: 'center',
                gap: 3,
                padding: '4px 3px',
                borderRadius: 6, 
                border: currentTool === 'select' ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'select' ? '#e6f0ff' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                outline: 'none',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              <MousePointer size={14} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>S</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>-</span>
              </div>
            </button>
            <button 
              onClick={() => { if (!isReadOnlyMode) { setDrawingMode('via'); setCurrentTool('draw'); } }} 
              disabled={isReadOnlyMode}
              title="Draw Vias (V)" 
              style={{ 
                width: '100%', 
                height: 32, 
                display: 'flex', 
                alignItems: 'center',
                gap: 3,
                padding: '4px 3px',
                borderRadius: 6, 
                border: (currentTool === 'draw' && drawingMode === 'via') ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'draw' && drawingMode === 'via' ? '#e6f0ff' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                {(() => {
                  const viaDef = toolRegistry.get('via');
                  const viaColor = viaDef?.settings.color || DEFAULT_VIA_COLOR;
                  return (
                    <>
                      <circle cx="12" cy="12" r="8" fill="none" stroke={viaColor} strokeWidth="3" />
                      <circle cx="12" cy="12" r="4" fill={viaColor} />
                    </>
                  );
                })()}
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>V</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>{toolRegistry.get('via')?.settings.size ?? 26}</span>
              </div>
            </button>
            <button 
              ref={padButtonRef}
              onClick={() => { 
                if (!isReadOnlyMode) { 
                  setDrawingMode('pad'); 
                  setCurrentTool('draw'); 
                  // Default to Top layer, but use last choice if available
                  const padLayerToUse = padToolLayer || 'top';
                  setSelectedDrawingLayer(padLayerToUse);
                  // The useEffect hook will automatically show the layer chooser
                  // Force position recalculation on every click, even if dialog is already visible
                  setTimeout(() => updatePadChooserPosition(), 0);
                } 
              }} 
              disabled={isReadOnlyMode}
              title="Draw Pads (P)" 
              style={{ 
                width: '100%', 
                height: 32, 
                display: 'flex', 
                alignItems: 'center',
                gap: 3,
                padding: '4px 3px',
                borderRadius: 6, 
                border: (currentTool === 'draw' && drawingMode === 'pad') ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'draw' && drawingMode === 'pad' ? '#e6f0ff' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                {(() => {
                  const padDef = toolRegistry.get('pad');
                  const padLayer = padToolLayer || 'top';
                  // Read from tool registry layerSettings (one source of truth)
                  const padColor = padDef?.layerSettings.get(padLayer)?.color ?? padDef?.settings.color ?? DEFAULT_PAD_COLOR;
                  // Fixed icon size for toolbar (constant, regardless of actual pad size)
                  const iconSize = 10;
                  const iconX = (24 - iconSize) / 2;
                  const iconY = (24 - iconSize) / 2;
                  return <rect x={iconX} y={iconY} width={iconSize} height={iconSize} fill={padColor} />;
                })()}
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>P</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>{(() => {
                  const padDef = toolRegistry.get('pad');
                  const padLayer = padToolLayer || 'top';
                  // Read from tool registry layerSettings (one source of truth)
                  return padDef?.layerSettings.get(padLayer)?.size ?? padDef?.settings.size ?? 18;
                })()}</span>
              </div>
            </button>
            <button 
              ref={traceButtonRef}
              onClick={() => { 
                if (!isReadOnlyMode) {
                  setDrawingMode('trace'); 
                  setCurrentTool('draw'); 
                  // Default to Top layer, but use last choice if available
                  const layerToUse = traceToolLayer || 'top';
                  setSelectedDrawingLayer(layerToUse);
                  // The useEffect hook will automatically show the layer chooser
                  // Force position recalculation on every click, even if dialog is already visible
                  setTimeout(() => updateTraceChooserPosition(), 0);
                }
              }} 
              disabled={isReadOnlyMode}
              title="Draw Traces (T)" 
              style={{ 
                width: '100%', 
                height: 32, 
                display: 'flex', 
                alignItems: 'center',
                gap: 3,
                padding: '4px 3px',
                borderRadius: 6, 
                border: (currentTool === 'draw' && drawingMode === 'trace') ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'draw' && drawingMode === 'trace' ? '#e6f0ff' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              <PenLine size={14} color={(() => {
                const traceDef = toolRegistry.get('trace');
                const layer = traceToolLayer || 'top';
                // Read from tool registry layerSettings (one source of truth)
                return traceDef?.layerSettings.get(layer)?.color ?? traceDef?.settings.color ?? DEFAULT_TRACE_COLOR;
              })()} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>T</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>{(() => {
                  const traceDef = toolRegistry.get('trace');
                  const layer = traceToolLayer || 'top';
                  // Read from tool registry layerSettings (one source of truth)
                  return traceDef?.layerSettings.get(layer)?.size ?? traceDef?.settings.size ?? 6;
                })()}</span>
              </div>
            </button>
            <button 
              ref={componentButtonRef}
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
                width: '100%', 
                height: 32, 
                display: 'flex', 
                alignItems: 'center',
                gap: 3,
                padding: '4px 3px',
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
                const layer = componentToolLayer || 'top';
                const componentDef = toolRegistry.get('component');
                // Read from tool registry layerSettings (one source of truth)
                const componentColor = componentDef?.layerSettings.get(layer)?.color ?? componentDef?.settings.color ?? DEFAULT_COMPONENT_COLOR;
                return selectedComponentType ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                    {/* Square icon with text - show default abbreviation based on component type */}
                    <rect x="4" y="4" width="16" height="16" fill="rgba(255,255,255,0.9)" stroke={componentColor} strokeWidth="1.5" />
                    <text x="12" y="14" textAnchor="middle" fontSize="7" fill={componentColor} fontWeight="bold" fontFamily="monospace">{getDefaultAbbreviation(selectedComponentType)}</text>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>C</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>{(() => {
                  const componentDef = toolRegistry.get('component');
                  const layer = componentToolLayer || 'top';
                  // Read from tool registry layerSettings (one source of truth)
                  return componentDef?.layerSettings.get(layer)?.size ?? componentDef?.settings.size ?? 18;
                })()}</span>
              </div>
            </button>
            {/* Power tool */}
            <button 
              ref={powerButtonRef}
              onClick={() => { if (!isReadOnlyMode) setCurrentTool('power'); }} 
              disabled={isReadOnlyMode}
              title="Draw Power (B)" 
              style={{ 
                width: '100%', 
                height: 32, 
                display: 'flex', 
                alignItems: 'center',
                gap: 3,
                padding: '4px 3px',
                borderRadius: 6, 
                border: currentTool === 'power' ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'power' ? '#e6f0ff' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              {/* Power symbol icon - use tool-specific color */}
              <span style={{ color: toolRegistry.get('power')?.settings.color || DEFAULT_POWER_COLOR, fontSize: '18px', fontWeight: 'bold', lineHeight: 1, flexShrink: 0 }}>V</span>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>B</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>{toolRegistry.get('power')?.settings.size ?? 18}</span>
              </div>
            </button>
            {/* Ground tool */}
            <button 
              ref={groundButtonRef}
              onClick={() => { if (!isReadOnlyMode) setCurrentTool('ground'); }} 
              disabled={isReadOnlyMode}
              title="Draw Ground (G)" 
              style={{ 
                width: '100%', 
                height: 32, 
                display: 'flex', 
                alignItems: 'center',
                gap: 3,
                padding: '4px 3px',
                borderRadius: 6, 
                border: currentTool === 'ground' ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'ground' ? '#e6f0ff' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              {/* Ground symbol icon */}
              <svg width="14" height="14" viewBox="0 0 24 20" aria-hidden="true" style={{ overflow: 'visible', flexShrink: 0 }}>
                <g stroke={toolRegistry.get('ground')?.settings.color || '#000000'} strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="2" x2="12" y2="10" />
                  <line x1="5" y1="10" x2="19" y2="10" />
                  <line x1="7" y1="13" x2="17" y2="13" />
                  <line x1="9.5" y1="16" x2="14.5" y2="16" />
                </g>
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>G</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>{toolRegistry.get('ground')?.settings.size ?? 18}</span>
              </div>
            </button>
              <button 
                onClick={() => { if (!isReadOnlyMode) setCurrentTool(prev => prev === 'pan' ? 'draw' : 'pan'); }} 
                disabled={isReadOnlyMode}
                title="Move (H)" 
                style={{ 
                  width: '100%', 
                  height: 32, 
                  display: 'flex', 
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 6px',
                  borderRadius: 6, 
                  border: currentTool === 'pan' ? '2px solid #000' : '1px solid #ddd', 
                  background: currentTool === 'pan' ? '#e6f0ff' : '#fff', 
                  color: isReadOnlyMode ? '#999' : '#222',
                  cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                  opacity: isReadOnlyMode ? 0.5 : 1
                }}
              >
              {/* Simple hand icon (matches canvas cursor style) */}
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                <g stroke="#111" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 11v-4c0-.8.6-1.3 1.3-1.3S11 6.2 11 7v4" />
                  <path d="M11 11V6.5c0-.8.6-1.3 1.3-1.3S14 5.7 14 6.5V11" />
                  <path d="M14 11V7.2c0-.8.6-1.3 1.3-1.3.7 0 1.3.5 1.3 1.3V12c1 .6 1.6 1.5 1.6 2.7A4.3 4.3 0 0 1 14 19H9.2A4.2 4.2 0 0 1 5 14.8V11c0-.6.4-1 .9-1 .6 0 1 .4 1 1v2" />
                </g>
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>H</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>-</span>
              </div>
            </button>
            <button 
              onClick={() => { setIsShiftPressed(false); setCurrentTool(prev => prev === 'magnify' ? 'draw' : 'magnify'); }} 
              title={`${isShiftPressed ? 'Zoom Out' : 'Zoom In'} (Z)`} 
              style={{ 
                width: '100%', 
                height: 32, 
                display: 'flex', 
                alignItems: 'center',
                gap: 3,
                padding: '4px 3px',
                borderRadius: 6, 
                border: currentTool === 'magnify' ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'magnify' ? '#e6f0ff' : '#fff', 
                color: '#222',
                cursor: 'pointer'
              }}
            >
              {/* Enlarged magnifier lens and symbols */}
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>Z</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>-</span>
              </div>
            </button>
            {/* Erase tool - moved below Zoom tool */}
            <button 
              onClick={() => { if (!isReadOnlyMode) setCurrentTool('erase'); }} 
              disabled={isReadOnlyMode}
              title="Erase (E)" 
              style={{ 
                width: '100%', 
                height: 32, 
                display: 'flex', 
                alignItems: 'center',
                gap: 3,
                padding: '4px 3px',
                borderRadius: 6, 
                border: currentTool === 'erase' ? '2px solid #000' : '1px solid #ddd', 
                background: currentTool === 'erase' ? '#ffecec' : '#fff', 
                color: isReadOnlyMode ? '#999' : '#222',
                cursor: isReadOnlyMode ? 'not-allowed' : 'pointer',
                opacity: isReadOnlyMode ? 0.5 : 1
              }}
            >
              {/* Tilted pink eraser */}
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                <g transform="rotate(-35 12 12)">
                  <rect x="6" y="8" width="12" height="8" rx="1.5" fill="#f5a3b3" stroke="#111" strokeWidth="1.5" />
                  <rect x="6" y="13" width="12" height="3" fill="#f18ea4" stroke="none" />
                </g>
              </svg>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', lineHeight: 1 }}>E</span>
                <span style={{ fontSize: '9px', lineHeight: 1, opacity: 0.7 }}>{toolRegistry.get('erase')?.settings.size ?? 18}</span>
              </div>
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
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
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
                          // Save layer-specific settings for tools that support layers
                          if (currentTool === 'draw' && drawingMode === 'trace') {
                            const layer = traceToolLayer || 'top';
                            const layerSettings = currentToolDef.layerSettings.get(layer);
                            const currentSize = layerSettings?.size || currentToolDef.settings.size;
                            const newLayerSettings = { color: c, size: currentSize };
                            updateToolLayerSettings(currentToolDef.id, layer, newLayerSettings);
                            saveToolLayerSettings(currentToolDef.id, layer, c, currentSize);
                            if (layer === 'top') {
                              setTopTraceColor(c);
                              saveDefaultColor('trace', c, 'top');
                            } else {
                              setBottomTraceColor(c);
                              saveDefaultColor('trace', c, 'bottom');
                            }
                          } else if (currentTool === 'draw' && drawingMode === 'pad') {
                            const layer = padToolLayer || 'top';
                            const layerSettings = currentToolDef.layerSettings.get(layer);
                            const currentSize = layerSettings?.size || currentToolDef.settings.size;
                            const newLayerSettings = { color: c, size: currentSize };
                            updateToolLayerSettings(currentToolDef.id, layer, newLayerSettings);
                            saveToolLayerSettings(currentToolDef.id, layer, c, currentSize);
                            if (layer === 'top') {
                              setTopPadColor(c);
                              saveDefaultColor('pad', c, 'top');
                            } else {
                              setBottomPadColor(c);
                              saveDefaultColor('pad', c, 'bottom');
                            }
                          } else if (currentTool === 'component') {
                            const layer = componentToolLayer || 'top';
                            const layerSettings = currentToolDef.layerSettings.get(layer);
                            const currentSize = layerSettings?.size || currentToolDef.settings.size;
                            const newLayerSettings = { color: c, size: currentSize };
                            updateToolLayerSettings(currentToolDef.id, layer, newLayerSettings);
                            saveToolLayerSettings(currentToolDef.id, layer, c, currentSize);
                            if (layer === 'top') {
                              setTopComponentColor(c);
                              saveDefaultColor('component', c, 'top');
                            } else {
                              setBottomComponentColor(c);
                              saveDefaultColor('component', c, 'bottom');
                            }
                          } else {
                            // For other tools (via, etc.), save general tool settings
                            const newSettings = { ...currentToolDef.settings, color: c };
                            updateToolSettings(currentToolDef.id, newSettings);
                            saveToolSettings(currentToolDef.id, c, currentToolDef.settings.size);
                            if (currentTool === 'draw' && drawingMode === 'via') {
                              saveDefaultColor('via', c);
                            }
                          }
                        }
                        // Legacy support: also save using old system for backward compatibility
                        saveDefaultColor('brush', c);
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
                          setPowerSymbols(prev => prev.map(p => selectedPowerIds.has(p.id) ? { ...p, color: c } : p));
                        }
                        if (selectedGroundIds.size > 0) {
                          setGroundSymbols(prev => prev.map(g => selectedGroundIds.has(g.id) ? { ...g, color: c } : g));
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
            <div ref={traceChooserRef} style={{ position: 'absolute', padding: '4px 6px', background: '#fff', border: '2px solid #000', borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 25 }}>
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
            <div ref={padChooserRef} style={{ position: 'absolute', padding: '4px 6px', background: '#fff', border: '2px solid #000', borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 25 }}>
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
            <div ref={powerBusSelectorRef} style={{ position: 'absolute', padding: '4px 6px', background: '#fff', border: '2px solid #000', borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 25, minWidth: '200px' }}>
              <div style={{ marginBottom: '4px', fontWeight: 600, fontSize: '12px', color: '#333' }}>Select Power Bus:</div>
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
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 6px', marginBottom: '2px', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', color: '#222' }}
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
              <div style={{ height: 1, background: '#ddd', margin: '4px 0' }} />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowPowerBusSelector(false);
                  setShowPowerBusManager(true);
                }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 6px', marginBottom: '2px', background: '#f0f0f0', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', color: '#333', fontSize: '11px' }}
              >
                Manage Power Buses…
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowPowerBusSelector(false);
                  setSelectedPowerBusId(null);
                  // Switch back to select tool if user cancels
                  setCurrentTool('select');
                }}
                style={{ display: 'block', width: '100%', textAlign: 'center', padding: '4px 6px', marginTop: '2px', background: '#f0f0f0', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', color: '#666', fontSize: '11px' }}
              >
                Cancel
              </button>
            </div>
          )}
          {/* Ground Bus Selector */}
          {showGroundBusSelector && currentTool === 'ground' && (
            <div ref={groundBusSelectorRef} style={{ position: 'absolute', padding: '4px 6px', background: '#fff', border: '2px solid #000', borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 25, minWidth: '200px' }}>
              <div style={{ marginBottom: '4px', fontWeight: 600, fontSize: '12px', color: '#333' }}>Select Ground Bus:</div>
              {groundBuses.length === 0 ? (
                <div style={{ padding: '8px', color: '#666', fontSize: '12px' }}>No ground buses defined. Use Tools → Manage Ground Buses to add one.</div>
              ) : (
                [...groundBuses].sort((a, b) => a.name.localeCompare(b.name)).map((bus) => {
                  const isEarthGround = bus.id === 'groundbus-earth';
                  const isSelected = selectedGroundBusId === bus.id;
                  return (
                    <button
                      key={bus.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Set the selected ground bus and close the selector
                        setSelectedGroundBusId(bus.id);
                        setShowGroundBusSelector(false);
                      }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 6px', marginBottom: '2px', background: isSelected ? '#e0e0e0' : '#f5f5f5', border: isSelected ? '2px solid #000' : '1px solid #ddd', borderRadius: 4, cursor: 'pointer', color: '#222' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* Ground Symbol Icon */}
                        <div style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {isEarthGround ? (
                            // Earth Ground symbol: vertical line with 3 horizontal bars
                            <svg width="20" height="20" viewBox="0 0 20 20" style={{ display: 'block' }}>
                              <line x1="10" y1="2" x2="10" y2="10" stroke="#000" strokeWidth="2" strokeLinecap="round" />
                              <line x1="4" y1="10" x2="16" y2="10" stroke="#000" strokeWidth="2" strokeLinecap="round" />
                              <line x1="5" y1="12.5" x2="15" y2="12.5" stroke="#000" strokeWidth="2" strokeLinecap="round" />
                              <line x1="6" y1="15" x2="14" y2="15" stroke="#000" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          ) : (
                            // GND symbol: circle with crossing lines
                            <svg width="20" height="20" viewBox="0 0 20 20" style={{ display: 'block' }}>
                              <circle cx="10" cy="10" r="6" fill="none" stroke="#000" strokeWidth="2" />
                              <line x1="10" y1="2" x2="10" y2="18" stroke="#000" strokeWidth="2" strokeLinecap="round" />
                              <line x1="2" y1="10" x2="18" y2="10" stroke="#000" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{bus.name}</div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
              <div style={{ height: 1, background: '#ddd', margin: '4px 0' }} />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowGroundBusSelector(false);
                  setShowGroundBusManager(true);
                }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '4px 6px', marginBottom: '2px', background: '#f0f0f0', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', color: '#333', fontSize: '11px' }}
              >
                Manage Ground Buses…
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowGroundBusSelector(false);
                  setSelectedGroundBusId(null);
                  // Switch back to select tool if user cancels
                  setCurrentTool('select');
                }}
                style={{ display: 'block', width: '100%', textAlign: 'center', padding: '4px 6px', marginTop: '2px', background: '#f0f0f0', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', color: '#666', fontSize: '11px' }}
              >
                Cancel
              </button>
            </div>
          )}
          {/* Active tool layer chooser for Component */}
          {(currentTool === 'component' && showComponentLayerChooser) && (
            <div ref={componentLayerChooserRef} style={{ position: 'absolute', padding: '4px 6px', background: '#fff', border: '2px solid #000', borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 25 }}>
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
          {/* Component Type Chooser - hierarchical menu */}
          {currentTool === 'component' && showComponentTypeChooser && (
            <div ref={componentTypeChooserRef} style={{ position: 'absolute', top: 44, left: 52, padding: '8px', background: '#fff', border: '1px solid #ddd', borderRadius: 6, boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 26, maxHeight: '500px', overflowY: 'auto', minWidth: '250px', maxWidth: '350px' }}>
              <div style={{ marginBottom: '8px', fontWeight: 600, fontSize: '13px', color: '#333', borderBottom: '1px solid #eee', paddingBottom: '6px' }}>Select Component Type:</div>
              {Object.entries(COMPONENT_CATEGORIES).map(([category, subcategories]) => {
                const isExpanded = expandedCategories.has(category);
                return (
                  <div key={category} style={{ marginBottom: '4px' }}>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setExpandedCategories(prev => {
                          const next = new Set(prev);
                          if (next.has(category)) {
                            next.delete(category);
                          } else {
                            next.add(category);
                          }
                          return next;
                        });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        textAlign: 'left',
                        padding: '6px 8px',
                        background: isExpanded ? '#f0f0f0' : '#fff',
                        border: '1px solid #ddd',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#333',
                      }}
                    >
                      <span style={{ marginRight: '6px', fontSize: '10px' }}>{isExpanded ? '▼' : '▶'}</span>
                      {category}
                    </button>
                    {isExpanded && (
                      <div style={{ marginLeft: '12px', marginTop: '2px', marginBottom: '4px' }}>
                        {Object.entries(subcategories).map(([subcategory, types]: [string, readonly string[]]) => (
                          <div key={subcategory} style={{ marginBottom: '2px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 500, color: '#666', padding: '2px 4px', marginBottom: '2px' }}>{subcategory}:</div>
                            {types.map((type: string) => {
                              const info = COMPONENT_TYPE_INFO[type as keyof typeof COMPONENT_TYPE_INFO];
                              if (!info) return null;
                              return (
                                <button
                                  key={type}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // For special cases (LED, Schottky, Tantalum), we need to handle them differently
                                    // For now, just set the base type - user can modify in properties dialog
                                    setSelectedComponentType(type as ComponentType);
                                    setShowComponentTypeChooser(false);
                                  }}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '4px 8px 4px 16px',
                                    marginBottom: '2px',
                                    background: selectedComponentType === type ? '#e6f0ff' : '#fff',
                                    border: '1px solid #ddd',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    color: '#333',
                                  }}
                                >
                                  {info.prefix.join(', ')} - {type} ({info.defaultPins} pins)
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
          <div style={{ position: 'absolute', top: 6, left: 60, bottom: 6, width: 168, padding: 6, display: 'flex', flexDirection: 'column', gap: 2, background: 'rgba(250,250,255,0.95)', borderRadius: 8, border: '1px solid #ddd', boxShadow: '0 2px 6px rgba(0,0,0,0.08)', zIndex: 3 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#333', marginBottom: 2 }}>Layers</div>
            <div onClick={() => setSelectedDrawingLayer('top')} title="Top layer" style={{ cursor: 'pointer', padding: 2, borderRadius: 4, border: selectedImageForTransform === 'top' ? '2px solid #0b5fff' : '1px solid #ddd', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <div style={{ fontSize: 10, color: '#444', fontWeight: 600 }}>Top Image</div>
                <label className="radio-label" style={{ margin: 0 }}>
                  <input type="checkbox" checked={showTopImage} onChange={(e) => setShowTopImage(e.target.checked)} />
                </label>
              </div>
              <canvas ref={topThumbRef} width={60} height={40} style={{ width: '60px', height: '40px' }} />
            </div>
            <div onClick={() => setSelectedDrawingLayer('bottom')} title="Bottom layer" style={{ cursor: 'pointer', padding: 2, borderRadius: 4, border: selectedImageForTransform === 'bottom' ? '2px solid #0b5fff' : '1px solid #ddd', background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <div style={{ fontSize: 10, color: '#444', fontWeight: 600 }}>Bottom Image</div>
                <label className="radio-label" style={{ margin: 0 }}>
                  <input type="checkbox" checked={showBottomImage} onChange={(e) => setShowBottomImage(e.target.checked)} />
                </label>
              </div>
              <canvas ref={bottomThumbRef} width={60} height={40} style={{ width: '60px', height: '40px' }} />
            </div>
            <div style={{ height: 1, background: '#e9e9ef', margin: '2px 0' }} />
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showViasLayer} onChange={(e) => setShowViasLayer(e.target.checked)} />
              <span>Vias</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showTopPadsLayer} onChange={(e) => setShowTopPadsLayer(e.target.checked)} />
              <span>Pads (Top)</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showTopTracesLayer} onChange={(e) => setShowTopTracesLayer(e.target.checked)} />
              <span>Traces (Top)</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showTopComponents} onChange={(e) => setShowTopComponents(e.target.checked)} />
              <span>Components (Top)</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showBottomPadsLayer} onChange={(e) => setShowBottomPadsLayer(e.target.checked)} />
              <span>Pads (Bottom)</span>
            </label>
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showBottomTracesLayer} onChange={(e) => setShowBottomTracesLayer(e.target.checked)} />
              <span>Traces (Bottom)</span>
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
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={showConnectionsLayer} onChange={(e) => setShowConnectionsLayer(e.target.checked)} />
              <span>Connections</span>
            </label>
            <div style={{ height: 1, background: '#e9e9ef', margin: '2px 0' }} />
            <label className="radio-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input 
                type="checkbox" 
                checked={showViasLayer && showTopPadsLayer && showBottomPadsLayer && showTopTracesLayer && showBottomTracesLayer && showTopComponents && showBottomComponents && showPowerLayer && showGroundLayer && showConnectionsLayer}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  setShowViasLayer(newValue);
                  setShowTopPadsLayer(newValue);
                  setShowBottomPadsLayer(newValue);
                  setShowTopTracesLayer(newValue);
                  setShowBottomTracesLayer(newValue);
                  setShowTopComponents(newValue);
                  setShowBottomComponents(newValue);
                  setShowPowerLayer(newValue);
                  setShowGroundLayer(newValue);
                  setShowConnectionsLayer(newValue);
                }}
              />
              <span style={{ fontWeight: 600, fontSize: 11 }}>Select All Layers</span>
            </label>
            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: 10, color: '#333' }}>Transparency: {transparency}%</label>
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
                  <span style={{ marginLeft: 6, fontSize: 10 }}>Cycle</span>
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
                style={{ width: '100%', marginTop: 3 }}
              />
            </div>
          </div>

          {/* Canvas welcome note - shown when no project is loaded */}
          <WelcomeDialog visible={!topImage && !bottomImage} />

          <canvas
            ref={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            tabIndex={0}
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
          <ComponentEditor
            componentEditor={componentEditor}
            setComponentEditor={setComponentEditor}
            componentsTop={componentsTop}
            componentsBottom={componentsBottom}
            setComponentsTop={setComponentsTop}
            setComponentsBottom={setComponentsBottom}
            connectingPin={connectingPin}
            setConnectingPin={setConnectingPin}
            componentDialogPosition={componentDialogPosition}
            setComponentDialogPosition={setComponentDialogPosition}
            isDraggingDialog={isDraggingDialog}
            setIsDraggingDialog={setIsDraggingDialog}
            dialogDragOffset={dialogDragOffset}
            setDialogDragOffset={setDialogDragOffset}
            areComponentsLocked={areComponentsLocked}
            setSelectedComponentIds={setSelectedComponentIds}
            setNotesDialogVisible={setNotesDialogVisible}
          />

          {/* Component Hover Tooltip (only shown when Option key is held) */}
          {hoverComponent && isOptionPressed && (() => {
            const comp = hoverComponent.component;
            const contextualValue = getComponentContextualValue(comp);
            if (!comp) return null;
            return (
              <div
                style={{
                  position: 'fixed',
                  left: `${hoverComponent.x + 10}px`,
                  top: `${hoverComponent.y + 10}px`,
                  background: 'rgba(0, 0, 0, 0.85)',
                  color: '#fff',
                  padding: '8px 12px',
                  borderRadius: 4,
                  fontSize: '12px',
                  lineHeight: '1.4',
                  zIndex: 10000,
                  pointerEvents: 'none',
                  width: 'max-content',
                  maxWidth: '400px',
                  minWidth: '150px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                  {comp.componentType}
                </div>
                {contextualValue && (
                  <div style={{ marginBottom: '4px', color: '#e0e0e0' }}>
                    {contextualValue}
                  </div>
                )}
                {comp.notes && (
                  <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.2)', fontSize: '11px', color: '#d0d0d0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {comp.notes}
                  </div>
                )}
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
                      setPowerSymbols(prev => prev.map(p => 
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
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '8px', zIndex: 1000, minWidth: '280px', maxWidth: '320px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#222' }}>Manage Power Buses</h2>
            <button onClick={() => setShowPowerBusManager(false)} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#666', padding: 0, width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          <div style={{ marginBottom: '12px' }}>
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
              // Check for duplicate names within Power Buses only (excluding current bus)
              const nameIsDuplicate = powerBuses.some(pb => pb.name === bus.name && pb.id !== bus.id);
              // Check for duplicate values within Power Buses only (excluding current bus)
              const valueIsDuplicate = powerBuses.some(pb => pb.voltage === bus.voltage && pb.id !== bus.id);
              return (
              <div key={bus.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px', marginBottom: '4px', background: '#f9f9f9', borderRadius: 4, border: '1px solid #e0e0e0' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: bus.color, border: '1px solid #ccc', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ fontSize: '10px', color: '#666', width: '40px', flexShrink: 0 }}>Name</div>
                  <input
                    type="text"
                    value={bus.name}
                    onChange={(e) => {
                      const updated = [...powerBuses];
                      updated[originalIndex] = { ...bus, name: e.target.value };
                      setPowerBuses(updated);
                    }}
                      placeholder="e.g., +3V3, -3V3"
                      style={{ flex: 1, padding: '2px 4px', border: nameIsDuplicate ? '1px solid #ff0000' : '1px solid #ccc', borderRadius: 3, fontSize: '11px' }}
                  />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ fontSize: '10px', color: '#666', width: '40px', flexShrink: 0 }}>Value</div>
                  <input
                    type="text"
                      inputMode="decimal"
                    value={bus.voltage}
                    onChange={(e) => {
                        const inputValue = e.target.value;
                        // Allow empty, numbers, decimal point, and + or - at start only
                        if (inputValue === '' || /^[+-]?\d*\.?\d*$/.test(inputValue)) {
                      const updated = [...powerBuses];
                          updated[originalIndex] = { ...bus, voltage: inputValue };
                      setPowerBuses(updated);
                        }
                      }}
                      onBlur={(e) => {
                        // Validate and format on blur: ensure it's a valid float
                        const inputValue = e.target.value.trim();
                        if (inputValue === '') {
                          return; // Allow empty
                        }
                        // Try to parse as float
                        const numericValue = parseFloat(inputValue);
                        if (!isNaN(numericValue)) {
                          // Format with sign and up to 1 decimal place
                          const sign = numericValue >= 0 ? '+' : '-';
                          const absValue = Math.abs(numericValue);
                          const formatted = `${sign}${absValue.toFixed(1).replace(/\.?0+$/, '')}`;
                          const updated = [...powerBuses];
                          updated[originalIndex] = { ...bus, voltage: formatted };
                          setPowerBuses(updated);
                        }
                      }}
                      placeholder="e.g., +3.3, -3.3"
                      style={{ flex: 1, padding: '2px 4px', border: valueIsDuplicate ? '1px solid #ff0000' : '1px solid #ccc', borderRadius: 3, fontSize: '11px' }}
                    />
                  </div>
                </div>
                <input
                  type="color"
                  value={bus.color}
                  onChange={(e) => {
                    const updated = [...powerBuses];
                    updated[originalIndex] = { ...bus, color: e.target.value };
                    setPowerBuses(updated);
                  }}
                  style={{ width: '28px', height: '28px', border: '1px solid #ccc', borderRadius: 3, cursor: 'pointer', flexShrink: 0 }}
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
                  style={{ padding: '3px 6px', background: '#e0e0e0', color: '#333', border: '1px solid #ccc', borderRadius: 3, cursor: 'pointer', fontSize: '10px', flexShrink: 0 }}
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
                voltage: '+0.0',
                color: '#ff0000',
              };
              setPowerBuses(prev => [...prev, newBus]);
            }}
            style={{ width: '100%', padding: '4px 8px', background: '#f0f0f0', color: '#333', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: '11px', marginBottom: '6px' }}
          >
            + Add Power Bus
          </button>
          <button
            onClick={() => setShowPowerBusManager(false)}
            style={{ width: '100%', padding: '4px 8px', background: '#f0f0f0', color: '#333', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: '11px' }}
          >
            Close
          </button>
        </div>
      )}

      {/* Ground Bus Manager Dialog */}
      {showGroundBusManager && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '8px', zIndex: 1000, minWidth: '280px', maxWidth: '320px', maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#222' }}>Manage Ground Buses</h2>
            <button onClick={() => setShowGroundBusManager(false)} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#666', padding: 0, width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          <div style={{ marginBottom: '12px' }}>
            {[...groundBuses].sort((a, b) => a.name.localeCompare(b.name)).map((bus) => {
              // Find the original index for state updates
              const originalIndex = groundBuses.findIndex(b => b.id === bus.id);
              // Check for duplicate names within Ground Buses only (excluding current bus)
              const nameIsDuplicate = groundBuses.some(gb => gb.name === bus.name && gb.id !== bus.id);
              return (
              <div key={bus.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px', marginBottom: '4px', background: '#f9f9f9', borderRadius: 4, border: '1px solid #e0e0e0' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: bus.color, border: '1px solid #ccc', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ fontSize: '10px', color: '#666', width: '40px', flexShrink: 0 }}>Name</div>
                    <input
                      type="text"
                      value={bus.name}
                      onChange={(e) => {
                        const updated = [...groundBuses];
                        updated[originalIndex] = { ...bus, name: e.target.value };
                        setGroundBuses(updated);
                      }}
                      placeholder="e.g., GND, Earth"
                      style={{ flex: 1, padding: '2px 4px', border: nameIsDuplicate ? '1px solid #ff0000' : '1px solid #ccc', borderRadius: 3, fontSize: '11px' }}
                    />
                  </div>
                </div>
                <input
                  type="color"
                  value={bus.color}
                  onChange={(e) => {
                    const updated = [...groundBuses];
                    updated[originalIndex] = { ...bus, color: e.target.value };
                    setGroundBuses(updated);
                  }}
                  style={{ width: '28px', height: '28px', border: '1px solid #ccc', borderRadius: 3, cursor: 'pointer', flexShrink: 0 }}
                />
                <button
                  onClick={() => {
                    // Don't allow deleting if any ground nodes use this bus
                    const nodesUsingBus = grounds.filter(g => g.groundBusId === bus.id);
                    if (nodesUsingBus.length > 0) {
                      alert(`Cannot delete: ${nodesUsingBus.length} ground node(s) are using this bus. Remove or reassign them first.`);
                      return;
                    }
                    setGroundBuses(prev => prev.filter(b => b.id !== bus.id));
                  }}
                  style={{ padding: '3px 6px', background: '#e0e0e0', color: '#333', border: '1px solid #ccc', borderRadius: 3, cursor: 'pointer', fontSize: '10px', flexShrink: 0 }}
                >
                  Delete
                </button>
              </div>
            );
            })}
          </div>
          <button
            onClick={() => {
              const newBus: GroundBus = {
                id: `groundbus-${Date.now()}-${Math.random()}`,
                name: 'New Ground Bus',
                color: '#000000',
              };
              setGroundBuses(prev => [...prev, newBus]);
            }}
            style={{ width: '100%', padding: '4px 8px', background: '#f0f0f0', color: '#333', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: '11px', marginBottom: '6px' }}
          >
            + Add Ground Bus
          </button>
          <button
            onClick={() => setShowGroundBusManager(false)}
            style={{ width: '100%', padding: '4px 8px', background: '#f0f0f0', color: '#333', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: '11px' }}
          >
            Close
          </button>
        </div>
      )}

      {/* Designator Manager Dialog */}
      {showDesignatorManager && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '16px', zIndex: 1000, minWidth: '300px', maxWidth: '400px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#222' }}>Manage Designators</h2>
            <button onClick={() => setShowDesignatorManager(false)} style={{ background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#666', padding: 0, width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#333', marginBottom: '12px' }}>
              <input
                type="checkbox"
                checked={autoAssignDesignators}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  setAutoAssignDesignators(newValue);
                  localStorage.setItem('autoAssignDesignators', String(newValue));
                }}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>Automatically assign designators</span>
            </label>
            <div style={{ marginTop: '8px', padding: '8px', background: '#f5f5f5', borderRadius: 4, fontSize: '11px', color: '#666', lineHeight: '1.4', marginBottom: '12px' }}>
              {autoAssignDesignators ? (
                <div>
                  When enabled, new components automatically receive sequential designators (e.g., C1, C2, C3 for Capacitors; R1, R2, R3 for Resistors).
                </div>
              ) : (
                <div>
                  When disabled, you must manually assign designators to each component. The designator field will be empty when components are created.
                </div>
              )}
            </div>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#333' }}>
              <input
                type="checkbox"
                checked={useGlobalDesignatorCounters}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  setUseGlobalDesignatorCounters(newValue);
                }}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>Use global designator counters</span>
            </label>
            <div style={{ marginTop: '8px', padding: '8px', background: '#f5f5f5', borderRadius: 4, fontSize: '11px', color: '#666', lineHeight: '1.4' }}>
              {useGlobalDesignatorCounters ? (
                <div>
                  When ON, designators continue from global counters across all projects. New components start with the next value from the global counter (e.g., if global counter is C10, new capacitor will be C11).
                </div>
              ) : (
                <div>
                  When OFF (default), designators start at 1 for each project. Each project maintains its own independent designator sequence (e.g., C1, C2, C3...).
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowDesignatorManager(false)}
            style={{ width: '100%', padding: '6px 12px', background: '#f0f0f0', color: '#333', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: '12px' }}
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
              
              // Always show auto-save prompt dialog after opening a project
              // Use setTimeout to allow React state updates from loadProject to complete
              setTimeout(() => {
                setAutoSavePromptDialog({ visible: true, source: 'open', interval: 5 });
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
      <DetailedInfoDialog
        visible={debugDialog.visible}
        selectedIds={selectedIds}
        selectedComponentIds={selectedComponentIds}
        selectedPowerIds={selectedPowerIds}
        selectedGroundIds={selectedGroundIds}
        drawingStrokes={drawingStrokes}
        componentsTop={componentsTop}
        componentsBottom={componentsBottom}
        powers={powers}
        grounds={grounds}
        powerBuses={powerBuses}
        onClose={() => {
          setDebugDialog({ visible: false, text: '' });
          // Don't reset position - keep it for next time
        }}
        setComponentsTop={setComponentsTop}
        setComponentsBottom={setComponentsBottom}
        determineViaType={determineViaType}
        determinePadType={determinePadType}
        onFindComponent={findAndCenterComponent}
        position={detailedInfoDialogPosition}
        isDragging={isDraggingDetailedInfoDialog}
        onDragStart={(e) => {
          if (detailedInfoDialogPosition) {
            setDetailedInfoDialogDragOffset({
              x: e.clientX - detailedInfoDialogPosition.x,
              y: e.clientY - detailedInfoDialogPosition.y,
            });
            setIsDraggingDetailedInfoDialog(true);
            e.preventDefault();
          }
        }}
      />

      {/* Notes Dialog */}
      <NotesDialog
        visible={notesDialogVisible}
        selectedIds={selectedIds}
        selectedComponentIds={selectedComponentIds}
        selectedPowerIds={selectedPowerIds}
        selectedGroundIds={selectedGroundIds}
        drawingStrokes={drawingStrokes}
        componentsTop={componentsTop}
        componentsBottom={componentsBottom}
        powers={powers}
        grounds={grounds}
        powerBuses={powerBuses}
        onClose={() => {
          setNotesDialogVisible(false);
          // Don't reset position - keep it for next time
        }}
        setComponentsTop={setComponentsTop}
        setComponentsBottom={setComponentsBottom}
        setDrawingStrokes={setDrawingStrokes}
        setPowerSymbols={setPowerSymbols}
        setGroundSymbols={setGroundSymbols}
        determineViaType={determineViaType}
        determinePadType={determinePadType}
        position={notesDialogPosition}
        isDragging={isDraggingNotesDialog}
        onDragStart={(e) => {
          if (notesDialogPosition) {
            setNotesDialogDragOffset({
              x: e.clientX - notesDialogPosition.x,
              y: e.clientY - notesDialogPosition.y,
            });
            setIsDraggingNotesDialog(true);
            e.preventDefault();
          }
        }}
      />

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
      <ErrorDialog
        visible={errorDialog.visible}
        title={errorDialog.title}
        message={errorDialog.message}
        onClose={() => setErrorDialog({ visible: false, title: '', message: '' })}
      />

      <BoardDimensionsDialog
        visible={showBoardDimensionsDialog}
        dimensions={boardDimensions}
        onSave={(dimensions) => {
          setBoardDimensions(dimensions);
          localStorage.setItem('boardDimensions', JSON.stringify(dimensions));
        }}
        onClose={() => setShowBoardDimensionsDialog(false)}
      />

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
                onClick={() => handleAutoSaveApply(autoSaveDialog.interval, false)}
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

      {/* Auto Save Prompt Dialog (shown after New Project or Open Project) - Combined with interval selector */}
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
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#e0e0e0', lineHeight: '1.5' }}>
              We recommend enabling Auto Save to automatically save your project at regular intervals. 
              This helps protect your work from accidental loss.
            </p>
            
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: '#e0e0e0', fontWeight: 500 }}>
              Select time interval:
            </label>
            <select
              value={autoSavePromptDialog.interval === null ? 'disable' : (autoSavePromptDialog.interval || 5).toString()}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'disable') {
                  setAutoSavePromptDialog({ ...autoSavePromptDialog, interval: null });
                } else {
                  const numValue = parseFloat(value);
                  if (!isNaN(numValue) && numValue > 0) {
                    setAutoSavePromptDialog({ ...autoSavePromptDialog, interval: numValue });
                  }
                }
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                marginBottom: '24px',
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
            </select>
            
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
                onClick={() => handleAutoSaveApply(autoSavePromptDialog.interval, true)}
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